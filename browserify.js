var Web3 = require('web3');
var utility = require('./utility.js');
var request = require('request');
var async = (typeof(window) === 'undefined') ? require('async') : require('async/dist/async.min.js');

function Main() {
}
//functions
Main.alertInfo = function(message) {
  $('#alerts').append('<div class="alert alert-info"><button type="button" class="close" data-dismiss="alert">&times;</button>' + message + '</div>');
}
Main.alertTxHash = function(txHash) {
  Main.alertInfo('You just created an Ethereum transaction. Track its progress here: <a href="http://'+(config.eth_testnet ? 'testnet.' : '')+'etherscan.io/tx/'+txHash+'" target="_blank">'+txHash+'</a>.');
}
Main.tooltip = function(message) {
  return '<a href="#" data-toggle="tooltip" data-placement="bottom" title="'+message+'"><i class="fa fa-question-circle fa-lg"></i></a>';
}
Main.tooltips = function() {
  $(function () {
    $('[data-toggle="tooltip"]').tooltip()
  });
}
Main.popovers = function() {
  $(function () {
    $('[data-toggle="popover"]').popover()
  });
}
Main.createCookie = function(name,value,days) {
  if (localStorage) {
    localStorage.setItem(name, value);
  } else {
    if (days) {
      var date = new Date();
      date.setTime(date.getTime()+(days*24*60*60*1000));
      var expires = "; expires="+date.toGMTString();
    }
    else var expires = "";
    document.cookie = name+"="+value+expires+"; path=/";
  }
}
Main.readCookie = function(name) {
  if (localStorage) {
    return localStorage.getItem(name);
  } else {
    var nameEQ = name + "=";
    var ca = document.cookie.split(';');
    for(var i=0;i < ca.length;i++) {
      var c = ca[i];
      while (c.charAt(0)==' ') c = c.substring(1,c.length);
      if (c.indexOf(nameEQ) == 0) return c.substring(nameEQ.length,c.length);
    }
    return null;
  }
}
Main.eraseCookie = function(name) {
  if (localStorage) {
    localStorage.removeItem(name);
  } else {
    createCookie(name,"",-1);
  }
}
Main.logout = function() {
  addrs = [config.eth_addr];
  pks = [config.eth_addr_pk];
  selectedAddr = 0;
  Main.refresh();
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
Main.withdraw = function(amount) {
  amount = utility.ethToWei(amount);
  utility.proxySend(web3, myContract, config.contract_market_addr, 'withdrawFunds', [amount, {gas: 1000000, value: 0}], addrs[selectedAddr], pks[selectedAddr], nonce, function(result) {
    txHash = result[0];
    nonce = result[1];
    Main.alertTxHash(txHash);
  });
}
Main.cancelOrders = function() {
  utility.proxySend(web3, myContract, config.contract_market_addr, 'cancelOrders', [{gas: 1000000, value: 0}], addrs[selectedAddr], pks[selectedAddr], nonce, function(result) {
    txHash = result[0];
    nonce = result[1];
    Main.alertTxHash(txHash);
  });
}
Main.connectionTest = function() {
  var connection = undefined;
  try {
    web3.eth.getBalance('0x0000000000000000000000000000000000000000');
    connection = {connection: 'Geth', provider: config.eth_provider, testnet: config.eth_testnet};
  } catch(err) {
    connection = {connection: 'Proxy', provider: 'http://'+(config.eth_testnet ? 'testnet.' : '')+'etherscan.io', testnet: config.eth_testnet};
  }
  new EJS({url: config.home_url+'/'+'connection.ejs'}).update('connection', {connection: connection});
  Main.popovers();
  return connection;
}
Main.loadAddresses = function() {
  if (Main.connectionTest().connection=='Geth') {
    $('#pk_div').hide();
  }
  async.map(addrs,
    function(addr, callback) {
      utility.proxyGetBalance(web3, addr, function(balance) {
        callback(null, {addr: addr, balance: balance});
      });
    },
    function(err, addresses) {
      new EJS({url: config.home_url+'/'+'addresses.ejs'}).update('addresses', {addresses: addresses, selectedAddr: selectedAddr});
    }
  );
}
Main.loadFunds = function() {
  utility.proxyCall(web3, myContract, config.contract_market_addr, 'getFundsAndAvailable', [addrs[selectedAddr]], function(result) {
    funds = result[0].toString();
    fundsAvailable = result[1].toString();
    new EJS({url: config.home_url+'/'+'funds.ejs'}).update('funds', {funds: funds, fundsAvailable: fundsAvailable});
  });
}
Main.loadMarket = function() {
  $('#market-spinner').show();
  utility.proxyCall(web3, myContract, config.contract_market_addr, 'getMarket', [], function(result) {
    var optionIDs = result[0];
    var strikes = result[1];
    var ids = result[2];
    var positions = result[3];
    var cashes = result[4];
    utility.proxyCall(web3, myContract, config.contract_market_addr, 'getMarketTopLevels', [], function(result) {
      var buyPrices = result[0];
      var buySizes = result[1];
      var sellPrices = result[2];
      var sellSizes = result[3];
      var is = [];
      var optionChainIDs = [];
      for (var i=0; i<optionIDs.length; i++) {
        if (strikes[i]>0) {
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
          optionChainDescription = {expiration: expiration, fromcur: fromcur, tocur: tocur};
          optionChainDescriptions[optionChainID] = optionChainDescription;
        });
      });
      async.map(is,
        function(i, callback_map) {
          var optionChainID = Math.floor(optionIDs[i].toNumber() / 1000);
          var optionID = optionIDs[i].toNumber() % 1000;
          var id = ids[i].toNumber();
          var strike = strikes[i].toNumber();
          var cash = cashes[i].toNumber();
          var position = positions[i].toNumber();
          var buyPrice = buyPrices[i].toNumber();
          var buySize = buySizes[i].toNumber();
          var sellPrice = sellPrices[i].toNumber();
          var sellSize = sellSizes[i].toNumber();
          var option = Object();
          option.strike = strike / 100.0;
          option.optionChainID = optionChainID;
          option.optionID = optionID;
          option.cash = cash;
          option.position = position;
          option.id = id;
          option.buy_orders = [];
          if (buySize>0) {
            option.buy_orders.push({price: buyPrice / 10000.0, size: buySize});
          }
          option.sell_orders = [];
          if (sellSize>0) {
            option.sell_orders.push({price: sellPrice / 10000.0, size: sellSize});
          }
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
              callback_map(null, option);
            }
          );
        },
        function(err, options) {
          new EJS({url: config.home_url+'/'+'market.ejs'}).update('market', {options: options});
          $('#market-spinner').hide();
          Main.tooltips();
        }
      );
    });
  });
}
Main.refresh = function() {
  Main.createCookie("user", JSON.stringify({"addrs": addrs, "pks": pks, "selectedAddr": selectedAddr}), 999);
  Main.connectionTest();
  Main.loadAddresses();
  Main.loadFunds();
  Main.loadMarket();
}

//globals
var addrs = [config.eth_addr];
var pks = [config.eth_addr_pk];
var selectedAddr = 0;
var cookie = Main.readCookie("user");
if (cookie) {
  cookie = JSON.parse(cookie);
  addrs = cookie["addrs"];
  pks = cookie["pks"];
  selectedAddr = cookie["selectedAddr"];
}
var nonce = undefined;
var funds = 0;
var fundsAvailable = 0;
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
