var config = {};

config.home_url = 'http://etherboost.github.io/etheropt';
config.contract_market = 'market.sol';
config.contract_market_addr = '0xc9f9d36d3942c99479ff6075e8a3a9fc8d74b443';
config.eth_testnet = true;
config.eth_provider = 'http://localhost:8545';
config.eth_addr = '0x0000000000000000000000000000000000000000';
config.eth_addr_pk = '';

try {
  global.config = config;
  module.exports = config;
} catch (err) {}
