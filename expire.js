var config = require('./config.js');
var utility = require('../etheropt.github.io/utility.js');
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
	utility.readFile(config.contract_market+'.compiled', function(result){
	  var compiled = JSON.parse(result);
	  var code = compiled.Market.code;
	  var abi = compiled.Market.info.abiDefinition;
	  web3.eth.defaultAccount = config.eth_addr;
	  var myContract = web3.eth.contract(abi);
	  myContract = myContract.at(config.contract_market_addr);
	  utility.proxyCall(web3, myContract, config.contract_market_addr, 'getMarket', [], function(result) {
	    var optionIDs = result[0];
	    var strikes = result[1];
      var is = [];
			var optionChainIDs = [];
			for (var i=0; i<optionIDs.length; i++) {
				if (strikes[i]!=0) {
					is.push(i);
					var optionChainID = Math.floor(optionIDs[i].toNumber() / 1000);
					if (optionChainIDs.indexOf(optionChainID)<0) {
						optionChainIDs.push(optionChainID);
					}
				}
			}
			var optionChainDescriptions = {};
			optionChainIDs.forEach(function(optionChainID) {
				utility.proxyCall(web3, myContract, config.contract_market_addr, 'getOptionChain', [optionChainID], function(result) {
					var expiration = (new Date(result[0].toNumber()*1000)).toISOString().substring(0,10);
					var fromcur = result[1].split("/")[0];
					var tocur = result[1].split("/")[1];
					var margin = result[2].toNumber() / 1000000000000000000;
					var realityID = result[3].toNumber();
					request.get('https://www.realitykeys.com/api/v1/exchange/'+realityID+'?accept_terms_of_service=current', function(err, httpResponse, body){
						if (!err) {
							result = JSON.parse(body);
							var signed_hash = '0x'+result.signature_v2.signed_hash;
							var value = '0x'+result.signature_v2.signed_value;
							var fact_hash = '0x'+result.signature_v2.fact_hash;
							var sig_r = '0x'+result.signature_v2.sig_r;
							var sig_s = '0x'+result.signature_v2.sig_s;
							var sig_v = result.signature_v2.sig_v;
							console.log(result);
							var settlement = result.winner_value;
							if (sig_r && sig_s && sig_v && value) {
								console.log("Should expire "+expiration+", settlement:", settlement);
								if (cli_options.armed) {
									console.log("Expiring");
									var nonce = undefined;
									utility.proxySend(web3, myContract, config.contract_market_addr, 'expire', [0, optionChainID, sig_v, sig_r, sig_s, value, {gas: 3141592, value: 0}], config.eth_addr, config.eth_addr_pk, nonce, function(result) {
										txHash = result[0];
										nonce = result[1];
										console.log(txHash);
									});
								}
							}
						}
					});
				});
			});
	  });
	});
}
