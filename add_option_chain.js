var config = require('./config.js');
var utility = require('./utility.js');
var Web3 = require('web3');
var request = require('request');
var async = require('async');
require('datejs');

var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider(config.eth_provider));
var saved = utility.readFile(config.contract_market+'.compiled');
var compiled = JSON.parse(saved);
var code = compiled.Market.code;
var abi = compiled.Market.info.abiDefinition;
web3.eth.defaultAccount = config.eth_addr;
var myContract = web3.eth.contract(abi);
myContract = myContract.at(config.contract_market_addr);

var expiration = Date.parse('Friday').add(7).days().toString('yyyy-MM-dd');
var strike_width = 0.5;
var strike_num = 5;
var strike_round = 0.5;

var i = 0;
var price = undefined;
request.get('https://poloniex.com/public?command=returnTicker', function(err, httpResponse, body) {
  var result = JSON.parse(body);
  price = result['BTC_ETH']['last']*result['USDT_BTC']['last'];
});
async.whilst(
  function () { return price==undefined; },
  function (callback) {
      setTimeout(function () {
          callback(null);
      }, 1000);
  },
  function (err) {
    if (!err) {
      var strikes = [];
      for (i = 0; i<strike_num; i++) {
        var strike = utility.roundToNearest(price+(i-strike_num/2)*strike_width, strike_round);
        strikes.push(strike);
      }
      async.map(strikes,
        function(strike, callback) {
          var result = undefined;
          request.post('https://www.realitykeys.com/api/v1/exchange/new', {form: {fromcur: 'ETH', comparison: 'ge', tocur: 'USD', value: strike, settlement_date: expiration, objection_period_secs: '86400', accept_terms_of_service: 'current', use_existing: '1'}}, function(err, httpResponse, body){
            if (!err) {
              result = JSON.parse(body);
              callback(null, result);
            }
          });
        },
        function(err, results) {
          var ids = results.map(function(result) { return result.id });
          var original_strikes = results.map(function(result) { return result.value });
          var strikes = results.map(function(result) { return result.value*100 });
          var factHashes = results.map(function(result) { return result.signature_v2.fact_hash });
          var ethAddrs = results.map(function(result) { return '0x'+result.signature_v2.ethereum_address });
          console.log("Expiration", expiration);
          console.log("Strikes", original_strikes);
          var nonce = undefined;
          utility.proxySend(web3, myContract, config.contract_market_addr, 'addOptionChain', [ids, strikes, factHashes, ethAddrs, {gas: 1000000, value: 0}], config.eth_addr, config.eth_addr_pk, nonce, function(result) {
            txHash = result[0];
            nonce = result[1];
            console.log(txHash);
          });
        }
      );
    }
  }
);
