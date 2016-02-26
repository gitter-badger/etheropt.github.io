var config = (typeof(global.config) == 'undefined' && typeof(config) == 'undefined') ? require('./config.js') : global.config;
var fs = require('fs');
var request = require('request');
var async = (typeof(window) === 'undefined') ? require('async') : require('async/dist/async.min.js');
var Web3 = require('web3');
var SolidityFunction = require('web3/lib/web3/function.js');
var coder = require('web3/lib/solidity/coder.js');
var utils = require('web3/lib/utils/utils.js');
var sha3 = require('web3/lib/utils/sha3.js');
var Tx = require('ethereumjs-tx');

function roundToNearest(numToRound, numToRoundTo) {
    numToRoundTo = 1 / (numToRoundTo);
    return Math.round(numToRound * numToRoundTo) / numToRoundTo;
}

function weiToEth(wei) {
  return (wei/1000000000000000000).toFixed(3);
}

function ethToWei(eth) {
  return eth*1000000000000000000;
}

function roundTo(numToRound, numToRoundTo) {
  return numToRound.toFixed(numToRoundTo);
}

function readFile(filename, callback) {
  if (callback) {
    try {
      if (typeof(window) === 'undefined') {
        fs.readFile(filename,{ encoding: 'utf8' }, function(err, data) {
          if (callback) {
            callback(data);
          }
        });
      } else {
        request.get(config.home_url+"/"+filename, function(err, httpResponse, body){
          callback(body);
        });
      }
    } catch (err) {
      callback(undefined);
    }
  } else {
    try {
      return fs.readFileSync(filename,{ encoding: 'utf8' });
    } catch (err) {
      return undefined;
    }
  }
}

function writeFile(filename, data) {
  fs.writeFile(filename, data, function(err) {
    if(err) {
        console.error("Could not write file: %s", err);
    }
	});
}

function proxyGetBalance(web3, address, callback) {
  try {
    callback(web3.eth.getBalance(address));
  } catch(err) {
    var url = 'http://'+(config.eth_testnet ? 'testnet' : 'api')+'.etherscan.io/api?module=account&action=balance&address='+address+'&tag=latest';
    request.get(url, function(err, httpResponse, body){
      if (!err) {
        result = JSON.parse(body);
        callback(result['result']);
      }
    });
  }
}

function proxyCall(web3, contract, address, functionName, args, callback) {
  try {
    callback(contract[functionName].call.apply(null, args));
  } catch(err) {
    var web3 = new Web3();
    var data = contract[functionName].getData.apply(null, args);
    var result = undefined;
    var url = 'http://'+(config.eth_testnet ? 'testnet' : 'api')+'.etherscan.io/api?module=proxy&action=eth_call&to='+address+'&data='+data;
    request.get(url, function(err, httpResponse, body){
      if (!err) {
        result = JSON.parse(body);
        var functionAbi = contract.abi.find(function(element, index, array) {return element.name==functionName});
        var solidityFunction = new SolidityFunction(web3._eth, functionAbi, address);
        callback(solidityFunction.unpackOutput(result['result']));
      }
    });
  }
}

function proxySend(web3, contract, address, functionName, args, fromAddress, privateKey, nonce, callback) {
  try {
    web3.eth.defaultAccount = fromAddress;
    callback([contract[functionName].sendTransaction.apply(null, args),0]);
  } catch(err) {
    if (privateKey && privateKey.substring(0,2)=='0x') {
      privateKey = privateKey.substring(2,privateKey.length);
    }
    var web3 = new Web3();
    args = Array.prototype.slice.call(args).filter(function (a) {return a !== undefined; });
    var options = {};
    var functionAbi = contract.abi.find(function(element, index, array) {return element.name==functionName});
    var inputTypes = functionAbi.inputs.map(function(x) {return x.type});
    if (typeof(args[args.length-1])=='object' && args[args.length-1].gas!=undefined) {
      args[args.length-1].gasPrice = 50000000000;
      args[args.length-1].gasLimit = args[args.length-1].gas;
      delete args[args.length-1].gas;
    }
    if (args.length > inputTypes.length && utils.isObject(args[args.length -1])) {
        options = args[args.length - 1];
    }
    if (nonce==undefined) {
      var url = 'http://'+(config.eth_testnet ? 'testnet' : 'api')+'.etherscan.io/api?module=account&action=txlist&address='+fromAddress+'&sort=desc';
      request.get(url, function(err, httpResponse, body){
        if (!err) {
          var result = JSON.parse(body);
          try {
            for (var i=0; i<result['result'].length; i++) {
              if (nonce==undefined && result['result'][i]['from']==fromAddress) {
                nonce = parseInt(result['result'][i]['nonce']);
              }
            }
          } catch (err) {
            nonce = 0;
          }
        }
      });
    }
    async.whilst(
      function () { return nonce==undefined; },
      function (callback) {
          setTimeout(function () {
              callback(null);
          }, 1000);
      },
      function (err) {
        if (!err) {
          nonce = nonce + 1;
          options.nonce = nonce;
          options.to = address;
          options.data = '0x' + sha3(functionName+"()").slice(0, 8) + coder.encodeParams(inputTypes, args);
          var tx = new Tx(options);
          tx.sign(new Buffer(privateKey, 'hex'));
          var serializedTx = tx.serialize().toString('hex');
          var result = undefined;
          var url = 'http://'+(config.eth_testnet ? 'testnet' : 'api')+'.etherscan.io/api?module=proxy&action=eth_sendRawTransaction&hex='+serializedTx;
          request.get(url, function(err, httpResponse, body){
            if (!err) {
              result = JSON.parse(body);
              callback([result['result'], nonce]);
            }
          });
        }
      }
    );
  }
}

function diffs(data) {
  var result = [];
  for (var i=1; i<data.length; i++) {
    result.push(data[i]-data[i-1]);
  }
  return result;
}

function rets(data) {
  var result = [];
  for (var i=1; i<data.length; i++) {
    result.push((data[i]-data[i-1])/data[i-1]);
  }
  return result;
}

function mean(data){
  return data.reduce(function(sum, value){ return sum + value; }, 0) / data.length;
}

function std_zero(data){
  return Math.sqrt(mean(data.map(function(value){ return Math.pow(value, 2) })));
}

function std(data){
  var avg = mean(data);
  return Math.sqrt(mean(data.map(function(value){ return Math.pow(value - avg, 2) })));
}

function random_hex(n) {
    var text = "";
    var possible = "ABCDEF0123456789";
    for( var i=0; i < n; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    return text;
};

if (!Array.prototype.find) {
  Array.prototype.find = function(predicate) {
    if (this === null) {
      throw new TypeError('Array.prototype.find called on null or undefined');
    }
    if (typeof predicate !== 'function') {
      throw new TypeError('predicate must be a function');
    }
    var list = Object(this);
    var length = list.length >>> 0;
    var thisArg = arguments[1];
    var value;

    for (var i = 0; i < length; i++) {
      value = list[i];
      if (predicate.call(thisArg, value, i, list)) {
        return value;
      }
    }
    return undefined;
  };
}

if (typeof Object.assign != 'function') {
  (function () {
    Object.assign = function (target) {
      'use strict';
      if (target === undefined || target === null) {
        throw new TypeError('Cannot convert undefined or null to object');
      }

      var output = Object(target);
      for (var index = 1; index < arguments.length; index++) {
        var source = arguments[index];
        if (source !== undefined && source !== null) {
          for (var nextKey in source) {
            if (source.hasOwnProperty(nextKey)) {
              output[nextKey] = source[nextKey];
            }
          }
        }
      }
      return output;
    };
  })();
}

Array.prototype.getUnique = function(){
   var u = {}, a = [];
   for(var i = 0, l = this.length; i < l; ++i){
      if(u.hasOwnProperty(this[i])) {
         continue;
      }
      a.push(this[i]);
      u[this[i]] = 1;
   }
   return a;
}

exports.random_hex = random_hex;
exports.rets = rets;
exports.diffs = diffs;
exports.std = std;
exports.std_zero = std_zero;
exports.mean = mean;
exports.proxyGetBalance = proxyGetBalance;
exports.proxySend = proxySend;
exports.proxyCall = proxyCall;
exports.readFile = readFile;
exports.writeFile = writeFile;
exports.roundTo = roundTo;
exports.weiToEth = weiToEth;
exports.ethToWei = ethToWei;
exports.roundToNearest = roundToNearest;
