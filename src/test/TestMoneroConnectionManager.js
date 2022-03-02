const assert = require("assert");
const TestUtils = require("./utils/TestUtils");
const monerojs = require("../../index");
const GenUtils = monerojs.GenUtils;
const MoneroRpcConnection = monerojs.MoneroRpcConnection;
const MoneroConnectionManager = monerojs.MoneroConnectionManager;
const MoneroConnectionManagerListener = monerojs.MoneroConnectionManagerListener;

/**
 * Test the Monero RPC connection manager.
 */
class TestMoneroConnectionManager {
  
  runTests() {
    describe("Test connection manager", function() {
      it("Can manage connections", async function() {
        let err;
        let walletRpcs = [];
        try {
          
          // start monero-wallet-rpc instances as test server connections (can also use monerod servers)
          for (let i = 0; i < 5; i++) walletRpcs.push(await TestUtils.startWalletRpcProcess());
          
          // create connection manager
          let connectionManager = new MoneroConnectionManager();
          
          // listen for changes
          let listener = new ConnectionChangeCollector();
          connectionManager.addListener(listener);
          
          // add prioritized connections
          connectionManager.addConnection(walletRpcs[4].getRpcConnection().setPriority(1));
          connectionManager.addConnection(walletRpcs[2].getRpcConnection().setPriority(2));
          connectionManager.addConnection(walletRpcs[3].getRpcConnection().setPriority(2));
          connectionManager.addConnection(walletRpcs[0].getRpcConnection()); // default priority is lowest
          connectionManager.addConnection(new MoneroRpcConnection(walletRpcs[1].getRpcConnection().getUri())); // test unauthenticated
          
          // test connections and order
          let orderedConnections = connectionManager.getConnections();
          assert(orderedConnections[0] === walletRpcs[4].getRpcConnection());
          assert(orderedConnections[1] === walletRpcs[2].getRpcConnection());
          assert(orderedConnections[2] === walletRpcs[3].getRpcConnection());
          assert(orderedConnections[3] === walletRpcs[0].getRpcConnection());
          assert.equal(orderedConnections[4].getUri(), (walletRpcs[1].getRpcConnection()).getUri());
          for (let connection of orderedConnections) assert.equal(undefined, connection.isOnline());
          
          // auto connect to best available connection
          connectionManager.setAutoSwitch(true);
          await connectionManager.startCheckingConnection(TestUtils.SYNC_PERIOD_IN_MS);
          assert(connectionManager.isConnected());
          let connection = connectionManager.getConnection();
          assert(connection.isOnline());
          assert(connection === walletRpcs[4].getRpcConnection());
          assert.equal(1, listener.changedConnections.length);
          assert(listener.changedConnections[listener.changedConnections.length - 1] === connection);
          connectionManager.setAutoSwitch(false);
          connectionManager.stopCheckingConnection();
          connectionManager.disconnect();
          assert.equal(2, listener.changedConnections.length);
          assert(listener.changedConnections[listener.changedConnections.length - 1] === undefined);
          
          // start periodically checking connection
          await connectionManager.startCheckingConnection(TestUtils.SYNC_PERIOD_IN_MS);
          
          // connect to best available connection in order of priority and response time
          connection = await connectionManager.getBestAvailableConnection();
          connectionManager.setConnection(connection);
          assert(connection === walletRpcs[4].getRpcConnection());
          assert(connection.isOnline());
          assert(connection.isAuthenticated());
          assert.equal(3, listener.changedConnections.length);
          assert(listener.changedConnections[listener.changedConnections.length - 1] === connection);
          
          // test connections and order
          orderedConnections = connectionManager.getConnections();
          assert(orderedConnections[0] === walletRpcs[4].getRpcConnection());
          assert(orderedConnections[1] === walletRpcs[2].getRpcConnection());
          assert(orderedConnections[2] === walletRpcs[3].getRpcConnection());
          assert(orderedConnections[3] === walletRpcs[0].getRpcConnection());
          assert.equal(orderedConnections[4].getUri(), walletRpcs[1].getRpcConnection().getUri());
          for (let i = 1; i < orderedConnections.length; i++) assert.equal(undefined, orderedConnections[i].isOnline());
          
          // test auto connect by shutting down connected instance
          await TestUtils.stopWalletRpcProcess(walletRpcs[4]);
          if (GenUtils.isBrowser()) connectionManager.getConnection()._setFakeDisconnected(true); // browser does not start or stop instances
          await GenUtils.waitFor(TestUtils.SYNC_PERIOD_IN_MS + 100);
          assert.equal(false, connectionManager.isConnected());
          assert.equal(false, connectionManager.getConnection().isOnline());
          assert.equal(undefined, connectionManager.getConnection().isAuthenticated());
          assert.equal(4, listener.changedConnections.length);
          assert(listener.changedConnections[listener.changedConnections.length - 1] === connectionManager.getConnection());
          
          // test connection order
          orderedConnections = connectionManager.getConnections();
          assert(orderedConnections[0] === walletRpcs[4].getRpcConnection());
          assert(orderedConnections[1] === walletRpcs[2].getRpcConnection());
          assert(orderedConnections[2] === walletRpcs[3].getRpcConnection());
          assert(orderedConnections[3] === walletRpcs[0].getRpcConnection());
          assert.equal(orderedConnections[4].getUri(), walletRpcs[1].getRpcConnection().getUri());
          
          // check all connections
          await connectionManager.checkConnections();
          
          // test connection order
          orderedConnections = connectionManager.getConnections();
          assert(orderedConnections[0] === walletRpcs[4].getRpcConnection());
          assert(orderedConnections[1] === walletRpcs[2].getRpcConnection());
          assert(orderedConnections[2] === walletRpcs[3].getRpcConnection());
          assert(orderedConnections[3] === walletRpcs[0].getRpcConnection());
          assert.equal(orderedConnections[4].getUri(), walletRpcs[1].getRpcConnection().getUri());
          
          // test online and authentication status
          for (let i = 0; i < orderedConnections.length; i++) {
            let isOnline = orderedConnections[i].isOnline();
            let isAuthenticated = orderedConnections[i].isAuthenticated();
            if (i === 0) assert.equal(false, isOnline);
            else assert(isOnline);
            if (i === 0) assert.equal(undefined, isAuthenticated);
            else if (i === 4) assert.equal(false, isAuthenticated);
            else assert(isAuthenticated);
          }
          
          // test auto switch when disconnected
          connectionManager.setAutoSwitch(true);
          await GenUtils.waitFor(TestUtils.SYNC_PERIOD_IN_MS + 100); // allow time to poll
          assert(connectionManager.isConnected());
          connection = connectionManager.getConnection();
          assert(connection.isOnline());
          assert(connection === walletRpcs[2].getRpcConnection() || connection === walletRpcs[3].getRpcConnection());
          assert.equal(5, listener.changedConnections.length);
          assert(listener.changedConnections[listener.changedConnections.length - 1] === connection);
          
          // test connection order
          orderedConnections = connectionManager.getConnections();
          assert(orderedConnections[0] === connection);
          assert(connection === walletRpcs[2].getRpcConnection() ? orderedConnections[1] === walletRpcs[3].getRpcConnection() : orderedConnections[1] === walletRpcs[2].getRpcConnection());
          assert(orderedConnections[2] === walletRpcs[0].getRpcConnection()); // assumes uri is first alphabetically
          assert.equal(orderedConnections[3].getUri(), walletRpcs[1].getRpcConnection().getUri());
          assert(orderedConnections[4] === walletRpcs[4].getRpcConnection());
          for (let i = 0; i < orderedConnections.length - 1; i++) assert(orderedConnections[i].isOnline());
          assert.equal(false, orderedConnections[4].isOnline());
          
          // connect to specific endpoint without authentication
          connection = orderedConnections[3];
          assert.equal(false, connection.isAuthenticated());
          connectionManager.setConnection(connection);
          assert.equal(false, connectionManager.isConnected());
          assert.equal(6, listener.changedConnections.length);
          
          // connect to specific endpoint with authentication
          connectionManager.setAutoSwitch(false);
          orderedConnections[3].setCredentials("rpc_user", "abc123");
          await connectionManager.checkConnection();
          assert.equal(connection.getUri(), walletRpcs[1].getRpcConnection().getUri());
          assert(connection.isOnline());
          assert(connection.isAuthenticated());
          assert.equal(7, listener.changedConnections.length);
          assert(listener.changedConnections[listener.changedConnections.length - 1] === connection);
          
          // test connection order
          orderedConnections = connectionManager.getConnections();
          assert(orderedConnections[0] === connectionManager.getConnection());
          assert.equal(orderedConnections[0].getUri(), walletRpcs[1].getRpcConnection().getUri());
          assert(orderedConnections[1] === walletRpcs[2].getRpcConnection());
          assert(orderedConnections[2] === walletRpcs[3].getRpcConnection());
          assert(orderedConnections[3] === walletRpcs[0].getRpcConnection());
          assert(orderedConnections[4] === walletRpcs[4].getRpcConnection());
          for (let i = 0; i < orderedConnections.length - 1; i++) assert(orderedConnections[i].isOnline());
          assert.equal(false, orderedConnections[4].isOnline());
          
          // set connection to existing uri
          connectionManager.setConnection(walletRpcs[2].getRpcConnection().getUri());
          assert(connectionManager.isConnected());
          assert(walletRpcs[2].getRpcConnection() === connectionManager.getConnection());
          assert.equal(TestUtils.WALLET_RPC_CONFIG.username, connectionManager.getConnection().getUsername());
          assert.equal(TestUtils.WALLET_RPC_CONFIG.password, connectionManager.getConnection().getPassword());
          assert.equal(8, listener.changedConnections.length);
          assert(listener.changedConnections[listener.changedConnections.length - 1] === walletRpcs[2].getRpcConnection());
          
          // set connection to new uri
          connectionManager.stopCheckingConnection();
          let uri = "http://localhost:49999";
          connectionManager.setConnection(uri);
          assert.equal(connectionManager.getConnection().getUri(), uri);
          assert.equal(9, listener.changedConnections.length);
          assert.equal(uri, listener.changedConnections[listener.changedConnections.length - 1].getUri());
          
          // set connection to empty string
          connectionManager.setConnection("");
          assert.equal(undefined, connectionManager.getConnection());
          assert.equal(10, listener.changedConnections.length);
          
          // check all connections and test auto switch
          connectionManager.setAutoSwitch(true);
          await connectionManager.checkConnections();
          assert.equal(11, listener.changedConnections.length);
          assert(connectionManager.isConnected());
          
          // check connection promises
          await Promise.all(connectionManager.checkConnectionPromises());
          
          // shut down all connections
          connection = connectionManager.getConnection();
          await connectionManager.startCheckingConnection(TestUtils.SYNC_PERIOD_IN_MS);
          for (let walletRpc of walletRpcs) walletRpc.getRpcConnection()._setFakeDisconnected(true); // browser does not start or stop instances
          await GenUtils.waitFor(TestUtils.SYNC_PERIOD_IN_MS + 100);
          assert.equal(false, connection.isOnline());
          assert.equal(12, listener.changedConnections.length);
          assert(listener.changedConnections[listener.changedConnections.length - 1] == connection);
          
          // stop polling connection
          connectionManager.stopCheckingConnection();
        } catch(err2) {
          err = err2;
        }
        
        // stop monero-wallet-rpc instances
        for (let walletRpc of walletRpcs) {
          try { await TestUtils.stopWalletRpcProcess(walletRpc); }
          catch (err2) { }
        }
        
        // throw error if applicable
        if (err) throw err;
      });
    });
  }
}

class ConnectionChangeCollector extends MoneroConnectionManagerListener {
  constructor() {
    super();
    this.changedConnections = [];
  }
  async onConnectionChanged(connection) {
    this.changedConnections.push(connection);
  }
}

module.exports = TestMoneroConnectionManager;