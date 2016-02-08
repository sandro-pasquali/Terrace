"use strict";

module.exports = function(options) {

options	= options || {};

var	$		= this;
var db		= require("redis");
var client 	= db.createClient();

//	TODO should be able to pass handlers through #options for catching #end and other
//	emitted events.
//
client.on("end", function(err, res) {

});

$.addKit("dictionary", {

	"close"	: function(cb) {
		client.quit();
		cb && cb(null);
	},

	"setIfNot"	: function(k, v, cb) {
		client.setnx(k, v, cb);
	},

	"setAndExpire"	: function(k, secs, v, cb) {
		client.setex(k, secs, v, cb);
	},

	"mget"	: function() {
		client.mget.apply(client, $.argsToArray(arguments));
	},

	"mset"	: function() {
		client.mset.apply(client, $.argsToArray(arguments));
	},

	//	##set
	//
	//	Set a key value as either a string or a hash.
	//
	//	@param	{String}	k		A key.
	//	@param	{Mixed}		v		Either a string or a map of k/v pairs. If a map, creates a hash.
	//	@param	{Function}	[cb]	Optional callback.
	//
	"set"	: function(k, v, cb) {

		var args = [];
		var keys;

		if($.is(Object, v)) {
			keys = Object.keys(v);
			if(keys.length === 1) {

				client.hset(k, keys[0], v[keys[0]], cb);

			} else if(keys.length > 1) {

				args[0] = k;
				keys.reduce(function(prev, curr) {
					args.push(curr, v[curr]);
				}, keys[0]);
				args.push(cb || $.noop);

				client.hmset.apply(client, args);

			} else {
				//	Zero properties in object. Error.
				//
				cb(true);
			}
		} else {
			client.set(k, v, cb);
		}
	},

	//	##get
	//
	//	Get the string value at a key, or multiple field values of a hash.
	//
	//	@example	#get(key, callback) // string
	//	@example	#get(key, field, ... field, callback) // hash
	//
	"get"	: function() {

		var a 	= $.argsToArray(arguments);

		if(a.length === 2) {

			client.get(a[0], a[1]);

		} else if(a.length > 2) {

			client.hmget.apply(client, a);

		} else {
			//	Wrong parameter count. Error.
			//
			throw "Wrong parameter count for %dictionary#get";
		}
	},

	"getset"	: function(k, v, cb) {
		client.getset(k, v, cb);
	},

	"unset"		: function(k, cb) {
		client.del(k, cb);
	},

	"expire"	: function(k, sec, cb) {
		client.expire(k, sec);
		cb && cb(null);
	},

	"exists"	: function(k, cb) {
		client.exists(k, cb);
	}
});

return $.dictionary;

} // end module export / function
