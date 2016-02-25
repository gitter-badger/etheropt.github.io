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
	    var ids = result[2];
	    var positions = result[3];
	    var cashes = result[4];
      var is = [];
      for (var i=0; i<optionIDs.length; i++) {
        if (strikes[i]>0) {
          is.push(i);
        }
      }
      async.map(is,
        function(i, callback_map) {
          var optionChainID = Math.floor(optionIDs[i].toNumber() / 1000);
          var optionID = optionIDs[i].toNumber() % 1000;
          var id = ids[i].toNumber();
          var strike = strikes[i].toNumber();
          var cash = cashes[i].toNumber();
          var position = positions[i].toNumber();
          var result = undefined;
          request.get('https://www.realitykeys.com/api/v1/exchange/'+id+'?accept_terms_of_service=current', function(err, httpResponse, body){
            if (!err) {
              result = JSON.parse(body);
              var option = Object();
              option.strike = strike / 100.0;
              option.optionChainID = optionChainID;
              option.optionID = optionID;
              option.cash = cash;
              option.position = position;
              option.id = id;
              option.expiration = result.settlement_date;
              option.fromcur = result.fromcur;
              option.tocur = result.tocur;
              option.signed_hash = result.signature_v2.signed_hash;
              option.signed_value = result.signature_v2.signed_value;
              option.fact_hash = result.signature_v2.fact_hash;
              option.sig_r = result.signature_v2.sig_r;
              option.sig_s = result.signature_v2.sig_s;
              option.sig_v = result.signature_v2.sig_v;
              callback_map(null, option);
            }
          });
        },
        function(err, options) {
					var nonce = undefined;
					var optionChainIDs = options.map(function(x){return x.optionChainID}).getUnique();
					for (var i=0; i<optionChainIDs.length; i++) {
						var optionChainID = optionChainIDs[i];
						var relatedOptions = options.filter(function(x){return x.optionChainID==optionChainID});
						console.log(relatedOptions[0].expiration);
						if (relatedOptions.filter(function(x){return !x.sig_r || !x.sig_s || !x.sig_v || !x.signed_value}).length==0) {
							relatedOptions.sort(function(a,b){return a.optionID>b.optionID ? 1 : -1});
							var v = relatedOptions.map(function(x){return x.sig_v});
							var r = relatedOptions.map(function(x){return '0x'+x.sig_r});
							var s = relatedOptions.map(function(x){return '0x'+x.sig_s});
							var value = relatedOptions.map(function(x){return x.signed_value});
							console.log("Should expire");
							if (cli_options.armed) {
								console.log("Expiring");
								utility.proxySend(web3, myContract, config.contract_market_addr, 'expire', [0, optionChainID, v, r, s, value, {gas: 3141592, value: 0}], config.eth_addr, config.eth_addr_pk, nonce, function(result) {
									txHash = result[0];
									nonce = result[1];
								});
							}
						}
					}
        }
      );
	  });
	});
}
