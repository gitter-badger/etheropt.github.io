var fs = require('fs');
var Web3 = require('web3');
var config = require('./config.js');
var utility = require('./utility.js');

var web3 = new Web3();
web3.setProvider(new web3.providers.HttpProvider(config.eth_provider));
var source = fs.readFileSync(config.contract_market,{ encoding: 'utf8' });
var compiled = web3.eth.compile.solidity(source);
utility.writeFile(config.contract_market+'.compiled', JSON.stringify(compiled));
var code = compiled.Market.code;
var abi = compiled.Market.info.abiDefinition;
web3.eth.defaultAccount = config.eth_addr;
var myContract = web3.eth.contract(abi);
myContract.new({data: code, gas: 3141592}, function (err, contract) {
	if(err) {
		console.error(err);
	} else if(contract.address){
		console.log(contract.address);
	}
});
