const fs = require('fs');
const monerojs = require("@rino-wallet/monero-javascript");
const { requestFunds, sleep } = require('./faucetClient');
const { melotoolsStagenetFaucet } = require('./constants.js')
const { createMultisigWallets, createRegularWallet } = require('./utils');

const tmpFilesFolder = './tmpReceivingAddress';

beforeAll(async() => {
  if (fs.existsSync(tmpFilesFolder)) {
    fs.rmSync(tmpFilesFolder, { recursive: true});
  }

  if (!fs.existsSync(tmpFilesFolder)) {
    fs.mkdirSync(tmpFilesFolder);
  }
});

afterAll(async() => {
  if (fs.existsSync(tmpFilesFolder)) {
    fs.rmSync(tmpFilesFolder, { recursive: true});
  }
});

test('receivingAddress', async() => {
    
  const regularWallet = await createRegularWallet(tmpFilesFolder);
  
  regularWallet.createSubaddress(0);
  const subaddresses = await regularWallet.getSubaddresses(0);
  console.log(`Wallet subaddresses: ${subaddresses}`);

  const newSubaddres = await subaddresses[1].getAddress();
  console.log(`New subaddress: ${newSubaddres}`);
  
  const resp = await requestFunds('0.001', await regularWallet.getAddress(0, 1));
  expect(resp.data.transaction_id).toBeTruthy()
  await regularWallet.sync()
  
  while ((await regularWallet.getBalance(0)).toString() == '0') {
    console.log(
      `Waiting a couple of seconds for transaction ${resp.data.transaction_id}
        to appear in the receiving wallet.`
    );
    await sleep(30 * 1000);
    await regularWallet.sync();
  }

  const transfers = await regularWallet.getTransfers({accountIndex: 0});
  console.log(`Transfers:`);
  console.log(`${transfers}`);
  console.log(`------------`);

  console.log(`Transfers[0]`);
  console.log(`${transfers[0]}`);
  console.log(`------------`);
 
  const receivingAddress = await transfers[0].getAddress();
  console.log(`Receiving address: ${receivingAddress}`);

  expect(receivingAddress).toEqual(newSubaddres);

}, 300 * 1000);
