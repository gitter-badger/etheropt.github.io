var http = require('http');
var natUpnp = require('nat-upnp');
var os = require('os');
var async = require('async');
var express = require('express');
var body_parser = require('body-parser');

function Server(domain, port) {
	//self
	var self = this;

	//config
	this.domain = domain;
	this.port = port;

  //prices
  this.data = undefined

	//upnp punch
	if (this.domain==undefined) {
		var client = natUpnp.createClient();
		client.timeout = 1000000;
		//get local ip
		var ifaces = os.networkInterfaces();
		var ips = [];
		for (ifname in ifaces) {
		  for (i in ifaces[ifname]) {
		    var iface = ifaces[ifname][i];
		    if ('IPv4' === iface.family && iface.internal == false) {
		      ips.push(iface.address)
		    }
		  }
		}
		var ip = ips[0];
		//upnp punch the port
		client.portMapping(
      {
  			public: { host: '', port: self.port },
  			private: { host: ip, port: self.port },
  			protocol: 'tcp',
  			ttl: 0,
  			description: 'Etheropt'
		  },
      function(err) {
		  }
    );
		//get external ip
		client.externalIp(function(err, ip) {
			self.domain = ip;
			self.url = 'http://'+self.domain+':'+self.port;
		});
	} else {
		this.url = 'http://'+this.domain+':'+this.port;
	}

  this.app = express();
	this.app.use(body_parser.json());
	this.app.use(body_parser.urlencoded({ extended: true }));
  this.server = http.Server(this.app);
	this.server.timeout = 1000*10;
	this.server.listen(this.port);
  this.app.get('/', function(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.writeHead(200);
    res.end(JSON.stringify(self.data));
	});

	//begin loop
	this.loop();
}
Server.prototype.loop = function() {
  var self = this;
	async.until(
		function() { return self.url!=undefined; },
		function(callback) { setTimeout(function () { callback(null); }, 1000); },
		function(err) {
			async.forever(
				function(next) {
					setTimeout(function () { next(); }, 2000);
				},
				function(err) {
					console.log(err);
				}
			);
		}
	);
}

module.exports = {Server: Server}
