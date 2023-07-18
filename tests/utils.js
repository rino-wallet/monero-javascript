const monerojs = require("@rino-wallet/monero-javascript");
const {
  moneroDaemonUrl,
  moneroNetwork,
  defaultWalletsPassword,
} = require('./constants.js')


async function createMultisigWallets(dir) {
  const serverWallet = await monerojs.createWalletFull({
    networkType: moneroNetwork,
    serverUri: moneroDaemonUrl,
    password: defaultWalletsPassword,
    path: `${dir}/serverWallet`,
  });
  await serverWallet.sync();
  await serverWallet.save();
  const preparedServerMs = await serverWallet.prepareMultisig();

  // User and Backup wallets are offline. No need to sync
  const userWallet = await monerojs.createWalletFull({
    networkType: moneroNetwork,
    password: defaultWalletsPassword,
    path: `${dir}/userWallet`,
  });
  const preparedUserMs = await userWallet.prepareMultisig()

  const backupWallet = await monerojs.createWalletFull({
    networkType: moneroNetwork,
    password: defaultWalletsPassword,
    path: `${dir}/backupWallet`,
  });
  const preparedBackupMs = await backupWallet.prepareMultisig();

  // MAKE MS
  const madeServerMs = await serverWallet.makeMultisig(
    [preparedUserMs, preparedBackupMs], 2, defaultWalletsPassword
  )
  console.log("Finished making Server Multisig")
  const madeUserMs = await userWallet.makeMultisig(
    [preparedServerMs, preparedBackupMs], 2, defaultWalletsPassword
  )
  console.log("Finished making User Multisig")
  const madeBackupMs = await backupWallet.makeMultisig(
    [preparedServerMs, preparedUserMs], 2, defaultWalletsPassword,
  )
  console.log("Finished making Backup Multisig")

  // FIRST ROUND OF EXCHANGE MULTISIG KEYS
  const firstServerMs = await serverWallet.exchangeMultisigKeys(
    [madeUserMs, madeBackupMs], defaultWalletsPassword
  )
  console.log("First round exchanging multisig keys Server Multisig")

  const firstUserMs = await userWallet.exchangeMultisigKeys(
    [madeServerMs, madeBackupMs], defaultWalletsPassword,
  )
  console.log("First round exchanging multisig keys User Multisig")

  const firstBackupMs = await backupWallet.exchangeMultisigKeys(
    [madeServerMs, madeUserMs], defaultWalletsPassword,
  )
  console.log("First round exchanging multisig keys  Backup Multisig")

  // SECOND ROUND OF EXCHANGE MULTISIG KEYS - PREVIOUSLY EQUAL TO FINALIZE MS
  const finalizedServerMs = await serverWallet.exchangeMultisigKeys(
    [firstUserMs.getMultisigHex(), firstBackupMs.getMultisigHex()], defaultWalletsPassword
  )
  console.log("Finalized Server Multisig")
  await serverWallet.save();

  const finalizedUserMs = await userWallet.exchangeMultisigKeys(
    [firstServerMs.getMultisigHex(), firstBackupMs.getMultisigHex()], defaultWalletsPassword,
  )
  console.log("Finalized User Multisig")
  await userWallet.save();

  const finalizedBackupMs = await backupWallet.exchangeMultisigKeys(
    [firstServerMs.getMultisigHex(), firstUserMs.getMultisigHex()], defaultWalletsPassword,
  )
  console.log("Finalized Backup Multisig")
  await backupWallet.save();

  const success = (
    (finalizedServerMs && finalizedUserMs && finalizedBackupMs)
    && finalizedServerMs.getAddress() === finalizedUserMs.getAddress()
    && finalizedServerMs.getAddress() === finalizedBackupMs.getAddress()
  );
  if (!success) {
    throw new Error("Address mismatch after finishing multisig process")
  }

  console.log("Multisig Wallets created");
  return { serverWallet, userWallet, backupWallet };
}

async function createRegularWallet(dir) {
  const regularWallet = await monerojs.createWalletFull({
    networkType: moneroNetwork,
    serverUri: moneroDaemonUrl,
    password: defaultWalletsPassword,
    path: `${dir}/regularWallet`,
  });
  await regularWallet.sync();
  await regularWallet.save();

  return regularWallet;
}

exports.createMultisigWallets = createMultisigWallets;
exports.createRegularWallet = createRegularWallet;
