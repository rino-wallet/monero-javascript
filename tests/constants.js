const monerojs = require("@rino-wallet/monero-javascript");

const moneroDaemonUrl = 'stagenet.tools.rino.io:38081';
const moneroNetwork = monerojs.MoneroNetworkType.STAGENET;
const defaultWalletsPassword = 'password'

// We want to return the funds to melotools at the end of test
const melotoolsStagenetFaucet = '73a4nWuvkYoYoksGurDjKZQcZkmaxLaKbbeiKzHnMmqKivrCzq5Q2JtJG1UZNZFqLPbQ3MiXCk2Q5bdwdUNSr7X9QrPubkn'

exports.moneroDaemonUrl = moneroDaemonUrl;
exports.moneroNetwork = moneroNetwork;
exports.defaultWalletsPassword = defaultWalletsPassword;
exports.melotoolsStagenetFaucet = melotoolsStagenetFaucet;
