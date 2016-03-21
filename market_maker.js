var config = require('./config.js');
var utility = require('../etheropt.github.io/utility.js');
var server = require('../etheropt.github.io/server.js');
var Web3 = require('web3');
var request = require('request');
var async = require('async');
var gaussian = require('gaussian');
var commandLineArgs = require('command-line-args');
var sha256 = require('js-sha256').sha256;
require('datejs');

var cli = commandLineArgs([
	{ name: 'help', alias: 'h', type: Boolean },
  { name: 'armed', type: Boolean, defaultValue: false },
	{ name: 'domain', type: String, defaultValue: config.domain },
  { name: 'port', type: String, defaultValue: config.port },
	{ name: 'eth_addr', type: String, defaultValue: config.eth_addr },
]);
var cli_options = cli.parse()

if (cli_options.help) {
	console.log(cli.getUsage());
} else {
	var server = new server.Server(cli_options.domain, cli_options.port);
  var web3 = new Web3();
  web3.setProvider(new web3.providers.HttpProvider(config.eth_provider));
	utility.readFile(config.contract_market+'.compiled', function(result){
	  var compiled = JSON.parse(result);
	  var code = compiled.Market.code;
	  var abi = compiled.Market.info.abiDefinition;
	  web3.eth.defaultAccount = config.eth_addr;
	  var myContract = web3.eth.contract(abi);
	  myContract = myContract.at(config.contract_market_addr);

		//publish server address
		utility.proxyCall(web3, myContract, config.contract_market_addr, 'getMarketMakers', [], function(result) {
			var market_makers = result;
			utility.proxyCall(web3, myContract, config.contract_market_addr, 'getMarketMakerFunds', [], function(result) {
				var min_funds = result.map(function(x){return x.toNumber()}).min();
				utility.proxyCall(web3, myContract, config.contract_market_addr, 'getFundsAndAvailable', [], function(result) {
					var funds = result[0].toNumber();
					async.whilst(
						function() { return server.url==undefined; },
						function(callback) { setTimeout(function () { callback(null); }, 1000); },
						function(err) {
							if (market_makers.indexOf(server.url)<=0 && funds>=min_funds) {
								console.log('Need to announce server to blockchain.');
								var nonce = undefined;
								if (cli_options.armed) {
									utility.proxySend(web3, myContract, config.contract_market_addr, 'marketMaker', [server.url, {gas: 3141592, value: 0}], cli_options.eth_addr, undefined, nonce, function(result) {
										txHash = result[0];
										nonce = result[1];
										console.log(txHash);
									});
								} else {
									console.log('To send the transaction, run with the --armed flag.');
								}
							}
						}
					);
				});
			});
		});

		//market maker loop
		async.forever(
			function(next) {
				var blockNumber = web3.eth.blockNumber;
				var orderID = utility.getRandomInt(0,Math.pow(2,64));
        var nonce = undefined;
				utility.proxyCall(web3, myContract, config.contract_market_addr, 'getMarket', [], function(result) {
	        var optionIDs = result[0];
	        var strikes = result[1];
	        var positions = result[2];
	        var cashes = result[3];
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
							optionChainDescription = {expiration: expiration, fromcur: fromcur, tocur: tocur, margin: margin, realityID: realityID};
	            optionChainDescriptions[optionChainID] = optionChainDescription;
	          });
	        });
          async.map(is,
            function(i, callback_map) {
              var optionChainID = Math.floor(optionIDs[i].toNumber() / 1000);
              var optionID = optionIDs[i].toNumber() % 1000;
              var strike = strikes[i].toNumber() / 1000000000000000000;
              var cash = cashes[i].toNumber() / 1000000000000000000;
              var position = positions[i].toNumber();
              var option = Object();
              if (strike>0) {
                option.kind = 'Call';
              } else {
                option.kind = 'Put';
              }
              option.strike = Math.abs(strike);
              option.optionChainID = optionChainID;
              option.optionID = optionID;
              option.cash = cash;
              option.position = position;
              async.whilst(
                function () { return !(optionChainID in optionChainDescriptions) },
                function (callback) {
                    setTimeout(function () {
                        callback(null);
                    }, 1000);
                },
                function (err) {
                  option.expiration = optionChainDescriptions[optionChainID].expiration;
                  option.fromcur = optionChainDescriptions[optionChainID].fromcur;
                  option.tocur = optionChainDescriptions[optionChainID].tocur;
                  option.margin = optionChainDescriptions[optionChainID].margin;
                  callback_map(null, option);
                }
              );
            },
            function(err, options) {
              options.sort(function(a,b){ return a.expiration+(a.strike+10000000).toFixed(3).toString()+a.kind<b.expiration+(b.strike+10000000).toFixed(3).toString()+b.kind ? -1 : 1 });
							var today = Date.now();
							var nonce = undefined;
							var data = options.reduce(function(data, option) {
								var expiration = Date.parse(option.expiration+" 00:00:00 UTC");
								var t_days = (expiration - today)/86400000.0;
								var t = t_days / 365.0;
								if (t>0) {

                  //fill in your pricing algorithm here
									var buy_price = 0.0001;
									var sell_price = option.margin;

									console.log(option.expiration, option.kind, option.strike);
									var size = utility.ethToWei(1);
									var price_buy = buy_price * 1000000000000000000;
									var price_sell = sell_price * 1000000000000000000;
									var blockExpires = blockNumber + 10;
									var condensed = utility.pack([option.optionChainID, option.optionID, price_buy, size, orderID, blockExpires], [256, 256, 256, 256, 256]);
									var hash = sha256(new Buffer(condensed,'hex'));
									var sig = utility.sign(web3, cli_options.eth_addr, hash);
									data.push({optionChainID: option.optionChainID, optionID: option.optionID, price: price_buy, size: size, orderID: orderID, blockExpires: blockExpires, addr: cli_options.eth_addr, v: sig.v, r: sig.r, s: sig.s});
									var condensed = utility.pack([option.optionChainID, option.optionID, price_sell, -size, orderID, blockExpires], [256, 256, 256, 256, 256]);
									var hash = sha256(new Buffer(condensed,'hex'));
                  var sig = utility.sign(web3, cli_options.eth_addr, hash);
									data.push({optionChainID: option.optionChainID, optionID: option.optionID, price: price_sell, size: -size, orderID: orderID, blockExpires: blockExpires, addr: cli_options.eth_addr, v: sig.v, r: sig.r, s: sig.s});
									return data;
								}
							}, []);
							server.data = data;
            }
          );
	      });
				setTimeout(function () { next(); }, 30*1000);
			},
			function(err) {
				console.log(err);
			}
		);
	});
}
