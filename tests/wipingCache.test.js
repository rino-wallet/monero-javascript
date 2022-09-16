// Our fork of monero-javascript. Compiled by us
const monerojsFork = require("@rino-wallet/monero-javascript");
// monero-javascript as installed from npm. Original codebase, compiled by maintainers
const monerojsOrig = require('monerojs-orig');
const fs = require('fs');


const moneroDaemonUrl = 'stagenet.community.rino.io:38081';
const moneroNetwork = monerojsFork.MoneroNetworkType.STAGENET;
const tmpFilesFolder = './tmpWipingCache';


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

test(
  'Using the original monero-javascript:\n'
  + '1. create wallet with monero-js: it succeeds\n'
  + '2. drop its cache and reopen the wallet: it succeeds, and the cache is recreated\n',
  async() => {
    const walletFile = `${tmpFilesFolder}/createWithOrigThenWipeCache`;
    const config = {
      networkType: moneroNetwork,
      serverUri: moneroDaemonUrl,
      password: "password",
      path: walletFile,
    };

    let w1 = await monerojsOrig.createWalletFull(config);
    await w1.sync();
    await w1.save();
    await w1.close();
    w1 = undefined;

    // Then drop the wallet-cache (replace with an empty one)
    fs.rmSync(walletFile);
    fs.closeSync(fs.openSync(walletFile, 'w'));
    expect(fs.statSync(walletFile).size).toEqual(0);

    // Open the wallet again, this time with empty wallet-cache
    let w2 = await monerojsOrig.openWalletFull(config);
    await w2.sync();
    await w2.save();
    await w2.close();
    w2 = undefined;
    // And the cache gets populated successfully (the wallet-cache of an empty
    // monero wallet is around 11mb)
    expect(10000000 < fs.statSync(walletFile).size < 12000000).toBeTruthy();
})

test(
  'Using our fork of monero-javascript:\n'
  + '1. create wallet with monero-js: it succeeds\n'
  + '2. drop its cache and reopen the wallet: it succeeds, and the cache is recreated\n'
  + '3. attempt to open it once more, using the recreated cache: it succeeds',
  async() => {
    const walletFile = `${tmpFilesFolder}/createWithForkThenWipeCache`;
    const config = {
      networkType: moneroNetwork,
      serverUri: moneroDaemonUrl,
      password: "password",
      path: walletFile,
    };

    let w1 = await monerojsFork.createWalletFull(config);
    await w1.sync();
    await w1.save();
    await w1.close();
    w1 = undefined;

    // Then drop the wallet-cache (replace with an empty one)
    fs.rmSync(walletFile);
    fs.closeSync(fs.openSync(walletFile, 'w'));
    expect(fs.statSync(walletFile).size).toEqual(0);

    // Open the wallet again, this time with empty wallet-cache
    let w2 = await monerojsFork.openWalletFull(config);
    await w2.sync();
    await w2.save();
    await w2.close();
    w2 = undefined
    // And the cache gets populated successfully (the wallet-cache of an empty
    // monero wallet is around 11mb)
    expect(10000000 < fs.statSync(walletFile).size < 12000000).toBeTruthy();


    // The next time we try to open, our fork of monero-javascript is able
    // to open the wallet-cache just fine.
    let w3 = await monerojsFork.openWalletFull(config);
    await w3.sync();
    await w3.save();
    await w3.close();
    expect(10000000 < fs.statSync(walletFile).size < 12000000).toBeTruthy();
})
