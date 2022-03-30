# End-To-End Tests for `monero-javascript`

### Requirements

Most of the requirements of the tests should be listed in `package.json`, except `monero-javascript` itself.
That's because on CI we probably want to install it from a `.tgz` file right after it's compiled.

When developing locally just install whatever version of `monero-javascript` you want to test.

### Running the tests

Run:
```
yarn test
```

### Notes:

* Split long-running tests into their own files, so they're run in parallel.
