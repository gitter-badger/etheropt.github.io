var config = require('./config.js');
var utility = require('../etheropt/utility.js');
var Web3 = require('web3');
var request = require('request');
var commandLineArgs = require('command-line-args');
var async = require('async');

var cli = commandLineArgs([
	{ name: 'help', alias: 'h', type: Boolean },
  { name: 'armed', type: Boolean, defaultValue: false },
]);
var cli_options = cli.parse()

if (cli_options.help) {
	console.log(cli.getUsage());
} else {
  var web3 = new Web3();
  web3.setProvider(new web3.providers.HttpProvider(config.eth_provider));
  var saved = utility.readFile(config.contract_market+'.compiled');
  var compiled = JSON.parse(saved);
  var code = compiled.Market.code;
  var abi = compiled.Market.info.abiDefinition;
  web3.eth.defaultAccount = config.eth_addr;
  var myContract = web3.eth.contract(abi);
  myContract = myContract.at(config.contract_market_addr);

  utility.proxyCall(web3, myContract, config.contract_market_addr, 'getNumOptionChains', [], function(result) {
    var numOptionChains = parseInt(result.toString());
    var optionChainIDs = [];
    for (var optionChainID = Math.max(0,numOptionChains-2); optionChainID<numOptionChains; optionChainID++) {
      optionChainIDs.push(optionChainID);
    }
    async.map(optionChainIDs,
      function(optionChainID, callback_map) {
        utility.proxyCall(web3, myContract, config.contract_market_addr, 'getNumOptions', [optionChainID], function(result) {
          callback_map(null, {optionChainID: optionChainID, numOptions: result.toString()});
        });
      },
      function(err, results){
        var optionLookups = [];
        for (var i=0; i<results.length; i++) {
          for (var j=0; j<results[i].numOptions; j++) {
            optionLookups.push({optionChainID: results[i].optionChainID, optionID: j});
          }
        }
        async.map(optionLookups,
          function(optionLookup, callback_map) {
            var optionChainID = optionLookup.optionChainID;
            var optionID = optionLookup.optionID;
            utility.proxyCall(web3, myContract, config.contract_market_addr, 'getOption', [optionChainID, optionID], function(result) {
              var option = result;
              var id = option[0].toString();
              var strike = option[1].toString();
              var result = undefined;
              request.get('https://www.realitykeys.com/api/v1/exchange/'+id+'?accept_terms_of_service=current', function(err, httpResponse, body){
                if (!err) {
                  result = JSON.parse(body);
                  var option = Object();
                  option.strike = strike / 100.0;
                  option.optionChainID = optionChainID;
                  option.optionID = optionID;
                  option.id = id;
                  option.expiration = result.settlement_date;
                  option.signed_hash = result.signature_v2.signed_hash;
                  option.signed_value = result.signature_v2.signed_value;
                  option.fact_hash = result.signature_v2.fact_hash;
                  option.sig_r = result.signature_v2.sig_r;
                  option.sig_s = result.signature_v2.sig_s;
                  option.sig_v = result.signature_v2.sig_v;
                  option.winner_value = result.winner_value;
                  callback_map(null, option);
                }
              });
            });
          },
          function(err, options) {
            var nonce = undefined;
            for (var i=0; i<optionChainIDs.length; i++) {
              var optionChainID = optionChainIDs[i];
              var relatedOptions = options.filter(function(x){return x.optionChainID==optionChainID});
              if (relatedOptions.filter(function(x){return !x.sig_r || !x.sig_s || !x.sig_v || !x.signed_value}).length==0) {
                relatedOptions.sort(function(a,b){return a.optionID>b.optionID ? 1 : -1});
                var v = relatedOptions.map(function(x){return x.sig_v});
                var r = relatedOptions.map(function(x){return '0x'+x.sig_r});
                var s = relatedOptions.map(function(x){return '0x'+x.sig_s});
                var value = relatedOptions.map(function(x){return x.signed_value});
                console.log("Should expire",relatedOptions[0].expiration,relatedOptions[0].winner_value);
                if (cli_options.armed) {
                  console.log("Expiring");
                  utility.proxySend(web3, myContract, config.contract_market_addr, 'expire', [optionChainID, v, '0x'+r, '0x'+s, value, {gas: 1000000, value: 0}], config.eth_addr, config.eth_addr_pk, nonce, function(result) {
                    txHash = result[0];
                    nonce = result[1];
                  });
                }
              }
            }
          }
        );
      }
    );
  });
}
