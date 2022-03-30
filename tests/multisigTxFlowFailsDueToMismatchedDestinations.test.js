const fs = require('fs');
const monerojs = require("@rino-wallet/monero-javascript");
const { requestFunds, sleep } = require('./faucetClient');
const { melotoolsStagenetFaucet } = require('./constants.js')
const { createMultisigWallets } = require('./utils');


const tmpFilesFolder = './failMismatchedDestinations';


beforeAll(async() => {
  if (fs.existsSync(tmpFilesFolder)) {
    fs.rmdirSync(tmpFilesFolder, { recursive: true});
  }

  if (!fs.existsSync(tmpFilesFolder)) {
    fs.mkdirSync(tmpFilesFolder);
  }
});

afterAll(async() => {
  if (fs.existsSync(tmpFilesFolder)) {
    fs.rmdirSync(tmpFilesFolder, { recursive: true});
  }
});


test('reconstructValidateTx flow fails due to mismatch between desired and actual destinations', async() => {
  const { serverWallet: be, userWallet: fe } = await createMultisigWallets(tmpFilesFolder);

  const resp = await requestFunds('0.001', await be.getAddress(0, 0));
  expect(resp.data.transaction_id).toBeTruthy()
  console.dir(`transactionID: ${resp.data.transaction_id}`);
  await be.sync()

  while ((await be.getUnlockedBalance(0, 0)).toString() == '0') {
    console.log(
      `Waiting a couple of minutes for transaction ${resp.data.transaction_id}
       to be confirmed and its funds unlocked`
    );
    await sleep(2 * 60 * 1000);
    await be.sync();
  }

  // Only the Backend wallet should be connceted to a Monero Daemon
  expect(await be.isConnectedToDaemon()).toBeTruthy();
  expect(await fe.isConnectedToDaemon()).toBeFalsy();

  await be.sync();

  // Only the BE wallet would report non-zero balance initially
  expect(await be.getBalance(0, 0)).not.toEqual(monerojs.BigInteger('0'))
  expect(await fe.getBalance(0, 0)).toEqual(monerojs.BigInteger('0'));

  // We should see a non-zero number of outputs imported to `fe`, because:
  // * `be` was synced and `fe` wasn't
  // * this multisig wallet was pre-funded, so we know it has outputs
  const importedOutputs = await fe.importOutputs(await be.exportOutputs());
  expect(importedOutputs).toBeGreaterThan(0);


  // We should see a non-zero number of outputs signed by the `be` (key images), because:
  // * `be` was synced and `fe` wasn't, but `fe` imported the outputs of `be` (see import outputs step)
  // * this multisig wallet was pre-funded, so we know it has outputs (see import outputs step)
  console.log('Sending feMultisigInfo to the BE');
  const feMultisigInfo = await fe.getMultisigHex();
  const outputsSignedByBE = await be.importMultisigHex([feMultisigInfo]);
  expect(outputsSignedByBE).toBeGreaterThan(0)

  // We cant send  all the funds back to the faucet, because we need to account for fees
  const correctTxConfig = {
    destinations: [{address: melotoolsStagenetFaucet, amount: `${'0.0009' * 1e12}`}],
    skipSigning: true,
    relay: false,
    accountIndex: 0
  };

  // The BE produces the initial unsigned Tx, which is exported as a hex string
  const unsignedTxs = await be.createTxs(correctTxConfig);
  const unsignedTxsHex = unsignedTxs[0].getTxSet().getMultisigTxHex()
  expect(typeof unsignedTxsHex).toEqual('string');

  // We should see a non-zero number of outputs signed by the `fe` (key images), that matches the
  // number of outputs that `be` signed previously, because:
  // * `be` was synced and `fe` wasn't, but `fe` imported the outputs of `be` (see import outputs step)
  // * this multisig wallet was pre-funded, so we know it has outputs (see import outputs step)
  console.log('Sending beMultisigInfo to the FE');
  const beMultisigInfo = await be.getMultisigHex();
  const outputsSignedByFE = await fe.importMultisigHex([beMultisigInfo]);
  expect(outputsSignedByFE).toEqual(outputsSignedByBE);

  const badTxConfigs = [
    new monerojs.MoneroTxConfig({
      // to same address, but different amount
      destinations: [
        {address: melotoolsStagenetFaucet, amount: `${'0.0005' * 1e12}`},
      ],
      skipSigning: true,
      relay: false,
      accountIndex: 0
    }),
    new monerojs.MoneroTxConfig({
      // to different address, same amount
      destinations: [
        {address: await fe.getAddress(0, 0), amount: `${'0.0009' * 1e12}`},
      ],
      skipSigning: true,
      relay: false,
      accountIndex: 0
    }),
    new monerojs.MoneroTxConfig({
      // to same address, same amount, but divided between more outputs
      destinations: [
        {address: melotoolsStagenetFaucet, amount: `${'0.0004' * 1e12}`},
        {address: melotoolsStagenetFaucet, amount: `${'0.0005' * 1e12}`},
      ],
      skipSigning: true,
      relay: false,
      accountIndex: 0
    }),
  ]

  for (const badTxConfig of badTxConfigs) {
    // The `fe` tries to reconstruct the unsigned tx from its hex, but it fails to do so,
    // because the txHex doesn't encode the expected destinations
    let failed = false;
    try {
      await fe.reconstructValidateTx(unsignedTxsHex, badTxConfig);
    } catch (err) {
      expect(err.toString().includes('Tx does not match the expected destinations')).toBeTruthy()
      failed = true;
    }
    expect(failed).toEqual(true);
  }

// Setting test timeout to 50m, because this test waits for a Tx from faucet to unlock,
// to be able to fund the rest of the test.
}, 50 * 60 * 1000)
