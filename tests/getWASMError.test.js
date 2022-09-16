const fs = require('fs');
const monerojs = require("@rino-wallet/monero-javascript");

const moneroNetwork = monerojs.MoneroNetworkType.STAGENET;
const tmpFilesFolder = './tmpWASMErrorTest';
const defaultWalletsPassword = 'password'

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

test("Fetch errors from WASM", async () => {
  const serverWallet = await monerojs.createWalletFull({
    networkType: moneroNetwork,
    password: defaultWalletsPassword,
    path: `${tmpFilesFolder}/serverWallet`,
  });

  try {
    await serverWallet.importOutputs("abcd");
  } catch(err) {
    // The following article explains why the error is a number
    // https://emscripten.org/docs/porting/Debugging.html#handling-c-exceptions-from-javascript
    console.log(`err: ${err}`);
    expect((typeof err) == "number").toBeTruthy()

    const errMsg = monerojs.MoneroUtils.extractExceptionMessage(err);
    console.log(`errMsg: ${errMsg}`);
    expect((typeof errMsg) == "string").toBeTruthy()
    expect(errMsg).toEqual('Bad magic from outputs')
    return;
  }
  // This line should never run if the test passes. This impossible
  // assertion makes sure to notify us of the failure
  expect(true).toEqual(false);
})
