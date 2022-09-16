const fs = require('fs');
const monerojs = require("@rino-wallet/monero-javascript");
const { requestFunds, sleep } = require('./faucetClient');
const { melotoolsStagenetFaucet } = require('./constants.js')
const { createMultisigWallets } = require('./utils');


const tmpFilesFolder = './tmpMultisigTxFlowTestSuccess';


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


test('reconstructValidateTx flow succeeds', async() => {
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
  const importedOutputs = await fe.importOutputs(await be.exportOutputs(true, true));
  expect(importedOutputs).toBeGreaterThan(0);


  // We should see a non-zero number of outputs signed by the `be` (key images), because:
  // * `be` was synced and `fe` wasn't, but `fe` imported the outputs of `be` (see import outputs step)
  // * this multisig wallet was pre-funded, so we know it has outputs (see import outputs step)
  const feMultisigInfo = await fe.exportMultisigHex();
  const outputsSignedByBE = await be.importMultisigHex([feMultisigInfo]);
  expect(outputsSignedByBE).toBeGreaterThan(0)

  // We cant send  all the funds back to the faucet, because we need to account for fees
  const correctTxConfig = new monerojs.MoneroTxConfig({
    destinations: [{address: melotoolsStagenetFaucet, amount: `${'0.00001' * 1e12}`}],
    skipSigning: true,
    relay: false,
    accountIndex: 0
  });

  const balance = await be.getBalance();
  console.log(`Balance before creating the first Tx: ${balance}`);
  
  const unlockedBalance = await be.getUnlockedBalance();
  console.log(`Unlocked balance before creating the first Tx: ${unlockedBalance}`);

  // The BE produces the initial unsigned Tx, which is exported as a hex string
  const unsignedTxs = await be.createTxs(correctTxConfig);
  const unsignedTxsHex = unsignedTxs[0].getTxSet().getMultisigTxHex()
  expect(typeof unsignedTxsHex).toEqual('string');

  // We should see a non-zero number of outputs signed by the `fe` (key images), that matches the
  // number of outputs that `be` signed previously, because:
  // * `be` was synced and `fe` wasn't, but `fe` imported the outputs of `be` (see import outputs step)
  // * this multisig wallet was pre-funded, so we know it has outputs (see import outputs step)
  const beMultisigInfo = await be.exportMultisigHex();
  const outputsSignedByFE = await fe.importMultisigHex([beMultisigInfo]);
  expect(outputsSignedByFE).toEqual(outputsSignedByBE);

  // expect(await fe.getBalance(0, 0)).toEqual(await be.getBalance(0, 0));

  const loadedConfig = await fe.loadMultisigTx(unsignedTxsHex);
  expect(loadedConfig.getFee()).toBeGreaterThan(0);

  // The `fe` reconstructs the unsigned tx from its hex, and puts the first partial signature. Validating
  // that the destinations encoded in the txHex match the expected ones
  const partiallySignedTx = await fe.reconstructValidateTx(unsignedTxsHex, correctTxConfig);
  // It then exports the partially-signed tx as a hex string
  const partiallySignedTxsHex = partiallySignedTx[0].getTxSet().getMultisigTxHex()
  expect(typeof partiallySignedTxsHex).toEqual('string');

  // The `be` imports the partially-signed tx and completes the signature.
  const signedMultisigTx = await be.signMultisigTxHex(partiallySignedTxsHex);
  // It then exports the fully signed Tx as a hex string.
  const signedMultisigTxHex = signedMultisigTx.getSignedMultisigTxHex();
  expect(typeof signedMultisigTxHex).toEqual('string');

  // One or more transactions should have been created. Probably a single tx, but
  // due to tx size limits it could be more than one.
  const txids = await be.submitMultisigTxHex(signedMultisigTxHex);
  expect(txids.length).toBeGreaterThan(0);

  let summary = `Created ${txids.length} stagenet transactions. Their IDs are:\n`
  for (const txid of txids) {
    summary += `    * ${txid}\n`;
  }
  console.log(summary);

// Setting test timeout to 50m, because this test waits for a Tx from faucet to unlock,
// to be able to fund the rest of the test.
}, 50 * 60 * 1000)
