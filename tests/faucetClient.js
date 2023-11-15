const axios = require('axios');

/**
 * Requests funds from the Melotools stagenet faucet
 */
async function requestFunds(amount, address) {
  const url = 'https://tools.rino.io/faucet/stagenet/request-amount-transaction/';
  const params = {destination_address: address, amount}

  // The auth token is hardcoded on the faucet, and it allows requests
  // to request a desired amount, instead of letting the faucet decide
  const headers = {Authorization: 'Bearer OmJvN3RkdjE2N3RxIXN6eWJyIQ=='};

  return await axios.post(url, params, { headers });
}

async function sleep (milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
};

exports.sleep = sleep;
exports.requestFunds = requestFunds;
