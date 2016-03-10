var config = {};

// config.home_url = 'http://etherboost.github.io/etheropt';
config.home_url = 'http://localhost:8080';
config.contract_market = 'market.sol';
config.contract_market_addr = '0xac05cf4324c48d1cbf18fa4868d0d698d8aea366';
config.eth_testnet = true;
config.eth_provider = 'http://localhost:8545';
config.eth_addr = '0x0000000000000000000000000000000000000000';
config.eth_addr_pk = '';

try {
  global.config = config;
  module.exports = config;
} catch (err) {}
