var config = {};

config.home_url = 'http://etherboost.github.io/etheropt';
config.contract_market = 'market.sol';
config.contract_market_addr = '0xe282cd4e0860c1ad573b3bc10191bf2f339bb1ef';
config.eth_testnet = true;
config.eth_provider = 'http://localhost:8545';
config.eth_addr = '0x0000000000000000000000000000000000000000';
config.eth_addr_pk = '';

try {
  global.config = config;
  module.exports = config;
} catch (err) {}
