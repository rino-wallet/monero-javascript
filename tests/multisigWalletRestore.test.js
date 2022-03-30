const fs = require('fs');
const monerojs = require("@rino-wallet/monero-javascript");
const { createMultisigWallets, createRegularWallet } = require('./utils');

const tmpFilesFolder = './tmpMultisigWalletRestore';

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

test('multisigWalletRestore', async() => {
  const { serverWallet: be, userWallet: fe } = await createMultisigWallets(tmpFilesFolder);

  // happy path
  const ok_resp = await be.getMultisigSeed('');
  const address = await be.getAddress(0, 0);
  console.dir(`BE addres: ${address}`);
  console.dir(`happy path resp: ${ok_resp}`);
  expect(ok_resp).toBeTruthy()

  // error
  const regularWallet = await createRegularWallet(tmpFilesFolder);
  const err_resp = regularWallet.getMultisigSeed('');
  console.dir(`error resp: ${err_resp}`);
  await expect(err_resp).rejects.toThrow('Error in obtaining multisig seed.');
}, 120 * 1000);
