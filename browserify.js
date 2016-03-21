var Web3 = require('web3');
var utility = require('./utility.js');
var request = require('request');
var sha256 = require('js-sha256').sha256;
var async = (typeof(window) === 'undefined') ? require('async') : require('async/dist/async.min.js');

function Main() {
}
//functions
Main.alertInfo = function(message) {
  $('#alerts').append('<div class="alert alert-info"><button type="button" class="close" data-dismiss="alert">&times;</button>' + message + '</div>');
  console.log(message);
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
Main.createAddress = function() {
  var newAddress = utility.createAddress();
  var addr = '0x'+newAddress[0].toString('hex');
  var pk = '0x'+newAddress[1].toString('hex');
  Main.addAddress(addr, pk);
}
Main.deleteAddress = function() {
  addrs.splice(selectedAddr, 1);
  pks.splice(selectedAddr, 1);
  selectedAddr = 0;
  Main.refresh();
}
Main.buy = function(order, price, size) {
  order = JSON.parse(order);
  size = utility.ethToWei(size);
  price = price * 1000000000000000000;
  if (price==order.price && size>0 && order.size<0 && size<=Math.abs(order.size)) {
    size = +size;
    utility.proxyCall(web3, myContract, config.contract_market_addr, 'orderMatchTest', [order.optionChainID, order.optionID, order.price, order.size, order.orderID, order.blockExpires, order.addr, addrs[selectedAddr], size], function(result) {
      if (result) {
        utility.proxySend(web3, myContract, config.contract_market_addr, 'orderMatch', [order.optionChainID, order.optionID, order.price, order.size, order.orderID, order.blockExpires, order.addr, order.v, order.r, order.s, size, {gas: 2000000, value: 0}], addrs[selectedAddr], pks[selectedAddr], nonce, function(result) {
          txHash = result[0];
          nonce = result[1];
          Main.alertTxHash(txHash);
        });
      }
    });
  }
}
Main.sell = function(order, price, size) {
  order = JSON.parse(order);
  size = utility.ethToWei(size);
  price = price * 1000000000000000000;
  if (price==order.price && size>0 && order.size>0 && size<=Math.abs(order.size)) {
    size = -size;
    utility.proxySend(web3, myContract, config.contract_market_addr, 'orderMatch', [order.optionChainID, order.optionID, order.price, order.size, order.orderID, order.blockExpires, order.addr, order.v, order.r, order.s, size, {gas: 2000000, value: 0}], addrs[selectedAddr], pks[selectedAddr], nonce, function(result) {
      txHash = result[0];
      nonce = result[1];
      Main.alertTxHash(txHash);
    });
  }
}
Main.selectAddress = function(i) {
  selectedAddr = i;
  Main.refresh();
}
Main.addAddress = function(addr, pk) {
  if (pk!=undefined && pk!='' && !utility.verifyPrivateKey(addr, pk)) {
    Main.alertInfo('For account '+addr+' , the private key is invalid.');
  } else if (!web3.isAddress(addr)) {
    Main.alertInfo('The specified address, '+addr+', is invalid.');
  } else {
    addrs.push(addr);
    pks.push(pk);
    selectedAddr = addrs.length-1;
    Main.refresh();
  }
}
Main.showPrivateKey = function() {
  var addr = addrs[selectedAddr];
  var pk = pks[selectedAddr];
  if (pk==undefined || pk=='') {
    Main.alertInfo('For account '+addr+', there is no private key available. You can still transact if you are connected to Geth and the account is unlocked.');
  } else {
    Main.alertInfo('For account '+addr+', the private key is '+pk);
  }
}
Main.shapeshift_click = function(a,e) {
  e.preventDefault();
  var link=a.href;
  window.open(link,'1418115287605','width=700,height=500,toolbar=0,menubar=0,location=0,status=1,scrollbars=1,resizable=0,left=0,top=0');
  return false;
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
Main.connectionTest = function() {
  var connection = undefined;
  try {
    web3.eth.getBalance('0x0000000000000000000000000000000000000000');
    connection = {connection: 'Geth', provider: config.eth_provider, testnet: config.eth_testnet};
  } catch(err) {
    connection = {connection: 'Proxy', provider: 'http://'+(config.eth_testnet ? 'testnet.' : '')+'etherscan.io', testnet: config.eth_testnet};
  }
  connection.contract = '<a href="http://'+(config.eth_testnet ? 'testnet.' : '')+'etherscan.io/address/'+config.contract_market_addr+'" target="_blank">'+config.contract_market_addr+'</a>';
  new EJS({url: config.home_url+'/'+'connection.ejs'}).update('connection', {connection: connection});
  Main.popovers();
  return connection;
}
Main.loadAddresses = function() {
  if (Main.connectionTest().connection=='Geth') {
    $('#pk_div').hide();
  }
  if (addrs.length<=0 || addrs.length!=pks.length) {
    addrs = [config.eth_addr];
    pks = [config.eth_addr_pk];
    selectedAddr = 0;
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
  utility.proxyCall(web3, myContract, config.contract_market_addr, 'getMarket', [addrs[selectedAddr]], function(result) {
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
        var margin = result[2].toNumber() / 1000000000000000000.0;
        var realityID = result[3].toNumber();
        optionChainDescription = {expiration: expiration, fromcur: fromcur, tocur: tocur, margin: margin, realityID: realityID};
        optionChainDescriptions[optionChainID] = optionChainDescription;
      });
    });
    utility.proxyCall(web3, myContract, config.contract_market_addr, 'getMarketMakers', [], function(result) {
      var market_makers = result.filter(function(x){return x!=''});
      async.reduce(market_makers, [],
        function(memo, market_maker, callback) {
          request.get(market_maker, function(err, httpResponse, body) {
            try {
              callback(null, memo.concat(JSON.parse(body)));
            } catch (err) {
              callback(null, memo);
            }
          });
        },
        function(err, markets){
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
              var orders = markets.filter(function(x){return x.optionChainID==optionChainID && x.optionID==optionID});
              orders = orders.map(function(x){return {size: Math.abs(x.size), price: x.price/1000000000000000000, order: x}});
              option.buy_orders = orders.filter(function(x){return x.order.size>0});
              option.sell_orders = orders.filter(function(x){return x.order.size<0});
              option.buy_orders.sort(function(a, b) {return b.price - a.price});
              option.sell_orders.sort(function(a, b) {return a.price - b.price});
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
              new EJS({url: config.home_url+'/'+'market.ejs'}).update('market', {options: options});
              $('#market-spinner').hide();
              Main.tooltips();
            }
          );
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
