module.exports = function(options) {

options = options || {};

var	$	= this;

var dgram 	= require("dgram");
var ports	= {};

//	TODO: add unix datagram.
//
$.addKit("udp", {

	listen	: function(port, opts) {

		var client = ports[port] = dgram.createSocket(opts.type || "udp4");

		client.on("message", function(msg, rinfo) {
			opts.onMessage && opts.onMessage(null, msg, rinfo);
		});

		client.on("listening", function() {
			opts.onListen && opts.onListen(null, client.ip);
		});

		client.bind(port, opts.address || null);
	},

	send	: function(port, msg) {
		var client = ports[port];

		if(client && msg) {
			msg = new Buffer(msg);
			client.send(msg, 0, msg.length, client.port, client.ip);
		}
	}
});

return $.udp;

} // end exports / function
