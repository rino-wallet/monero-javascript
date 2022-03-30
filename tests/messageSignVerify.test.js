const fs = require('fs');
const monerojs = require("@rino-wallet/monero-javascript");
const { createMultisigWallets, createRegularWallet } = require('./utils');
const { moneroNetwork } = require('./constants.js')
const MoneroSubaddress = monerojs.MoneroSubaddress;
const MoneroMessageSignatureResult = monerojs.MoneroMessageSignatureResult;
const MoneroMessageSignatureType = monerojs.MoneroMessageSignatureType;
const MoneroWalletFull = monerojs.MoneroWalletFull;

const tmpFilesFolder = './tmpMessageSignVerify';

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

test('testMessageSignVerify', async() => {
  let regularWallet = await createRegularWallet(tmpFilesFolder);
  
  let msg1 = "Message.";
  let msg2 = "Different message.";
  const subaddress = new MoneroSubaddress(undefined, 0, 0);
  const address = await regularWallet.getAddress(subaddress.getAccountIndex(), subaddress.getIndex());
  
  let signature1 = await regularWallet.signMessage(msg1, MoneroMessageSignatureType.SIGN_WITH_SPEND_KEY, subaddress.getAccountIndex(), subaddress.getIndex());
  let signature2 = await regularWallet.signMessage(msg2, MoneroMessageSignatureType.SIGN_WITH_SPEND_KEY, subaddress.getAccountIndex(), subaddress.getIndex());
 
  // Normal verification succeeds.
  let verificationResult = await regularWallet.verifyMessage(msg1, address, signature1);
  expect(verificationResult).toEqual(new MoneroMessageSignatureResult(true, false, MoneroMessageSignatureType.SIGN_WITH_SPEND_KEY, 2));

  // Normal verification fails - signature for different message.
  verificationResult = await regularWallet.verifyMessage(msg2, address, signature1);
  expect(verificationResult).toEqual(new MoneroMessageSignatureResult(false, undefined, undefined, undefined));

  // Static now - delete the wallet to make sure it's indeed static.
  regularWallet = null;

  // Static verification succeeds.
  verificationResult = await MoneroWalletFull.verifyMessageStatic(msg1, address, signature1, moneroNetwork);
  expect(verificationResult).toEqual(new MoneroMessageSignatureResult(true, false, MoneroMessageSignatureType.SIGN_WITH_SPEND_KEY, 2));
  
  // Static verification fails - signature for different message.
  verificationResult = await MoneroWalletFull.verifyMessageStatic(msg2, address, signature1, moneroNetwork);
  expect(verificationResult).toEqual(new MoneroMessageSignatureResult(false, undefined, undefined, undefined));

}, 60 * 1000); 
