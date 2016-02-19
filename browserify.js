var Web3 = require('web3');
var config = require('./config.js');
var utility = require('./utility.js');
var request = require('request');
var open = require("open");
var async = (typeof(window) === 'undefined') ? require('async') : require('async/dist/async.min.js');

//globals
var addrs = [config.eth_addr];
var pks = [config.eth_addr_pk];
var selectedAddr = 0;
var nonce = undefined;
var funds = 0;
var fundsAvailable = 0;

function Main() {
}
//functions
Main.alertInfo = function(message) {
  $('#alerts').append('<div class="alert alert-info"><button type="button" class="close" data-dismiss="alert">&times;</button>' + message + '</div>');
  Main.externalLinks();
}
Main.alertTxHash = function(txHash) {
  Main.alertInfo('You just created an Ethereum transaction. Track its progress here: <a href="http://'+(config.testnet ? 'testnet' : 'api')+'.etherscan.io/tx/'+txHash+'" target="_blank">'+txHash+'</a>.');
}
Main.tooltip = function(message) {
  return '<a href="#" data-toggle="tooltip" data-placement="bottom" title="'+message+'"><i class="fa fa-question-circle fa-lg"></i></a>';
}
Main.externalLinks = function() {
  $('a[target=_blank]').on('click', function(){
    open(this.href);
    return false;
  });
}
Main.tooltips = function() {
  $(function () {
    $('[data-toggle="tooltip"]').tooltip()
  });
}
Main.buy = function(optionChainID, optionID, price, size) {
  size = utility.ethToWei(size);
  price = price * 10000;
  utility.proxySend(web3, myContract, config.contract_market_addr, 'placeBuyOrder', [optionChainID, optionID, price, size, {gas: 1000000, value: 0}], addrs[selectedAddr], pks[selectedAddr], nonce, function(result) {
    txHash = result[0];
    nonce = result[1];
    Main.alertTxHash(txHash);
  });
}
Main.sell = function(optionChainID, optionID, price, size) {
  size = utility.ethToWei(size);
  price = price * 10000;
  utility.proxySend(web3, myContract, config.contract_market_addr, 'placeSellOrder', [optionChainID, optionID, price, size, {gas: 1000000, value: 0}], addrs[selectedAddr], pks[selectedAddr], nonce, function(result) {
    txHash = result[0];
    nonce = result[1];
    Main.alertTxHash(txHash);
  });
}
Main.selectAddress = function(i) {
  selectedAddr = i;
  Main.refresh();
}
Main.addAddress = function(addr, pk) {
  addrs.push(addr);
  pks.push(pk);
  selectedAddr = addrs.length-1;
  Main.refresh();
}
Main.fund = function(amount) {
  utility.proxySend(web3, myContract, config.contract_market_addr, 'addFunds', [{gas: 1000000, value: utility.ethToWei(amount)}], addrs[selectedAddr], pks[selectedAddr], nonce, function(result) {
    txHash = result[0];
    nonce = result[1];
    Main.alertTxHash(txHash);
  });
}
Main.loadAddresses = function() {
  async.map(addrs,
    function(addr, callback) {
      utility.proxyGetBalance(web3, addr, function(balance) {
        callback(null, {addr: addr, balance: balance});
      });
    },
    function(err, addresses) {
      new EJS({url: 'addresses.ejs'}).update('addresses', {addresses: addresses, selectedAddr: selectedAddr});
    }
  );
}
Main.loadFunds = function() {
  utility.proxyCall(web3, myContract, config.contract_market_addr, 'getFunds', [addrs[selectedAddr]], function(result) {
    funds = result.toString();
    new EJS({url: 'funds.ejs'}).update('funds', {funds: funds, fundsAvailable: fundsAvailable});
  });
  utility.proxyCall(web3, myContract, config.contract_market_addr, 'getAvailableFunds', [addrs[selectedAddr]], function(result) {
    fundsAvailable = result.toString();
    new EJS({url: 'funds.ejs'}).update('funds', {funds: funds, fundsAvailable: fundsAvailable});
  });
  new EJS({url: 'funds.ejs'}).update('funds', {funds: funds, fundsAvailable: fundsAvailable});
}
Main.loadMarket = function() {
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
                  // document.getElementById("content").innerHTML += "<br />"+id;
                  utility.proxyCall(web3, myContract, config.contract_market_addr, 'getOptionBuyOrders', [option.optionChainID, option.optionID], function(result) {
                    var orders = [];
                    for (var i=0; i<result[0].length; i++) {
                      var order = Object();
                      order.price = parseFloat(result[0][i].toString())/10000.0;
                      order.size = parseFloat(result[1][i].toString());
                      if (order.size>0) {
                        orders.push(order);
                      }
                    }
                    option.buy_orders = orders;
                  });
                  utility.proxyCall(web3, myContract, config.contract_market_addr, 'getOptionSellOrders', [option.optionChainID, option.optionID], function(result) {
                    var orders = [];
                    for (var i=0; i<result[0].length; i++) {
                      var order = Object();
                      order.price = parseFloat(result[0][i].toString())/10000.0;
                      order.size = parseFloat(result[1][i].toString());
                      if (order.size>0) {
                        orders.push(order);
                      }
                    }
                    option.sell_orders = orders;
                  });
                  utility.proxyCall(web3, myContract, config.contract_market_addr, 'getPosition', [option.optionChainID, option.optionID, addrs[selectedAddr]], function(result) {
                    option.position = result.toString();
                  });
                  utility.proxyCall(web3, myContract, config.contract_market_addr, 'getCash', [option.optionChainID, addrs[selectedAddr]], function(result) {
                    option.cash = result.toString();
                  });
                  async.whilst(
                    function () { return option.buy_orders==undefined || option.sell_orders==undefined || option.position==undefined || option.cash==undefined; },
                    function (callback_waiting) {
                        setTimeout(function () {
                            callback_waiting(null);
                        }, 1000);
                    },
                    function (err) {
                      callback_map(null, option);
                    }
                  );
                }
              });
            });
          },
          function(err, options) {
            new EJS({url: 'market.ejs'}).update('market', {options: options});
            Main.tooltips();
          }
        );
      }
    );
  });
}
Main.refresh = function() {
  Main.loadMarket();
  Main.loadAddresses();
  Main.loadFunds();
}
//web3
var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider(config.eth_provider));
var myContract = undefined;
utility.readFile(config.contract_market+'.compiled', function(result){
  var compiled = JSON.parse(result);
  var code = compiled.Market.code;
  var abi = compiled.Market.info.abiDefinition;
  web3.eth.defaultAccount = config.eth_addr;
  myContract = web3.eth.contract(abi);
  myContract = myContract.at(config.contract_market_addr);
  Main.refresh(); //iniital refresh
});

module.exports = {Main: Main, utility: utility};
