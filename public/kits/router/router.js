"use strict";

module.exports = function(options) {

options = options || {};

var	$	= this;

//	Terrace dependencies
//
$.require("file");

var util		= require('util');
var	http		= require('http');
var https		= require('https');
var url			= require('url');
var	path		= require('path');
var qs			= require('querystring');
var	fs			= require('fs');
var formidable	= require('formidable');

var config		= require("../../../config.json");

//	Where routes for each #methods are collected. Will receive an attribute of type `object`
//	named for for each of #methods. See below, during kit definition.
//
//	ie. COLLECTIONS.post = {}, COLLECTIONS.get = {} ...
//
var COLLECTIONS = {};

//	##parseRoute
//
//	Accepts a route (eg. /users/:userid/:type) and returns an object containing:
//
//	#serialized	: {String} A regular expression to match the route.
//	#compiled	: {RegExp}
//	#parameters	: {Object} name:type, for above: { userid: String, type: String } [TODO]
//
//	Also accepts RegExp objects as a route.
//
var parseRoute = function(route, opts) {

	opts = opts || {};

	var ret = {
		parameters	: []
	};

	if($.is(RegExp, route)) {
		ret.serialized 	= new String(route);
		ret.compiled	= route;

		return ret;
	}

	//	Note, optional trailing `/`.
	//
	//	TODO, more checking of route, addition of token directives.
	//
	ret.serialized	= new String('^' + route + '/?$').replace(/:([\w][\w]*)/g, function(token, key, idx, orig) {

		// Can do something eventually here to expand the types/dynamism of tokens.
		//
		ret.parameters.push({
			type	: String,
			key		: key
		})

		return "([^/.]+)";

	}).replace(/([\/.])/g, '\\$1');

	ret.compiled = new RegExp(ret.serialized);

	return ret;
};

//	##route
//
var route = function(request, response) {

	var path	= request.info.route;
	var meth	= request.info.method;
	var head	= request.headers;
	var body 	= "";
	var coll	= COLLECTIONS[meth];
	var $this	= this;
	var rex;
	var pms;
	var routeVals;
	var hasRouted;
	var pathMatch;

	//	Non-blocking execution of delegates, serially
	//
	//	@param	{Object}	routeObj	Route info, as defined in #addDelegates.
	//
	var runRoutes = function(routeObj) {
		var active	= true;
		var error	= "";
		var tryOn	= routeObj.options.tryOn || {};
		var timeout	= routeObj.options.timeout || options.timeout;

		//	Handler for request abort & error. See below for event binding.
		//
		var deactivate	= function(err) {

			console.log("&&& " + err);

			active 	= false;
			error	= err || "UNSPECIFIED_ROUTE_ERROR";
			request.terminator && request.terminator();
			timer.cancel();
		}

		var timer	= $.$wait(timeout, function() {
			deactivate("ROUTE_TIMEOUT");
			console.log(routeObj)
		});

		//	These are handlers for client error events. An important one is cancelling an
		//	upload, which would fire #abort.
		//
		request
			.on('error', function(err) {
				deactivate("REQUEST_ERROR_" + err);
			})
			.on('aborted', function() {
				deactivate("REQUEST_ABORTED");
			})

		//	Must clear this on each execution of route.
		//
		delete request.terminator;

		//////////////////////////////////////////////////////////////////////////////////////////
		//																						//
		//									The route runner									//
		//																						//
		//////////////////////////////////////////////////////////////////////////////////////////
		$.asyncEach(function(delegate, idx, resultSet, next) {

			response.resultSet = resultSet;

			//	This will form the array of delegates to be tried should
			//	tryOn[#idx] be set, length === tryOn[#idx]
			//
			var to = [];
			var tx = tryOn[idx];
			var tc = tx || 0;
			var terminate;

			//	Continue to call delegates until finished, or terminated.
			//
			if(!active) {

				//	This will force-terminate the iterator (#asynchEach), which will
				//	call the terminal function, which follows...
				//
				return false;

			} else {

				//	A delegate is normally given one(1) execution. If so designated, this
				//	delegate will be given #tc chances to succeed. Prior to calling
				//	the #next method of the containing #asyncEach, we run the current
				//	delegate until it does not error (or #tc is reached).
				//
				if(tx) {
					do {
						to.push(delegate);
					} while(--tc);

					$.asyncEach(function(_d, _i, _rs, _next) {

						if(terminate) {
							return false;
						}

						//	Once delegate executes without error, flag exit.
						//
						_d.call($this, request, response, function(err, r) {
							terminate = !err;
							_next(err, r);
						});

					}, function(r) {
						//	Passing along our inner results to the outer...
						//
						next(r.errored, r.last);
					}, to);
				} else {
					delegate.call($this, request, response, next);
				}
			}
		}, function(finalResults) {

			timer.cancel();

			if(!response.__SENT__) {
				//	Our route was terminated imperially. Delegates subsequent to this event
				//	will *not* be called.  As such, we can expect that whatever client
				//	response was expected will not happen naturally.  At any rate, we need to
				//	send a response with termination reason.
				//
				if(!active) {
					response.send(true, {
						errorcode	: error
					});
				}
			}

/*
console.log("**********RESOLVED**********");
console.log(routeObj);
console.log("****************************");
*/

		}, routeObj.delegates);
	};

	//	If #__ROUTE__ is set this request has already been handled. See below.
	//
	if(!request.hasOwnProperty("__ROUTE__")) {
		//	Run any routes whose #regexp tests positive against #path.
		//
		for(rex in coll) {
			if(routeVals = coll[rex].regexp.exec(path)) {

				//	Store the original route definition.
				//
				request.__ROUTE__ = coll[rex].original;

				hasRouted = true;

				//	#exec returns an array whose zero index contains the original match string,
				//	with matches occupying subsequent slots. We reset so that matches
				//	begin at index zero.
				//
				routeVals.shift();

				pms = coll[rex].parameters;

				//	Passing along route parameters for delegates.
				//
				request.params = {};

				routeVals.forEach(function(p, i) {

					//	Build the #params collection, :key => value.
					//	Here's where we might do checks on the sent values.
					//
					request.params[pms[i].key] = p;

				});

				runRoutes(coll[rex]);
			}
		}

		if(hasRouted) {
			return;
		}

		//	No routes available. Stream a file if it exists at given path, or 404.
		//	NOTE that only GET or HEAD will be responded to.  Also, lowercase, as
		//	these method names are taken from the Node request itself.
		//
		if(meth === "get" || meth === "head") {

			//	__dirname will have "/kits/router" at its tail, replaced now by path.
			//
			path = __dirname.replace("/kits/router", path);

			//	The client response is fully handled by the #stream interface (sending
			//	of headers, etag, etc).
			//
			return $.file.stream(path, request, response);
		} 

		//	Other methods can only operate against a defined route
		//	405 Method Not Allowed
		//
		response.send(true, {
			status	: 405
		});
	}
};

//	##postParser
//
//	All POST or PUT routes will have this method appended its delegation IF
//	#options#usePostParser is set to TRUE (default).
//
//	Its purpose is to parse and record form fields, and to handle multipart posts.
//	#request will receive a #body object containing form fieldname/value pairs.
//
//	@see	https://github.com/felixge/node-formidable
//	@see	#route
//
var postParser = function(request, response, next) {
	request.terminator = function() {
		try {
			request.pause();

			fileObjects.forEach(function(fo) {
				fo._writeStream.destroy();
				fs.unlink(fo.path);
			});

			fileObjects = [];

			request.connection.destroy();
		} catch(e) {
			console.log(e);
		}
	};

    var form 		= new formidable.IncomingForm();
    var files 		= [];
    var fields 		= [];
    var fileObjects = [];

	//	Handler on termination of post parser. Handles errors on failures. If a file
	//	upload is being handled, validates the upload, etc.
	//
	var responder = function(err, uploadInfo) {

		var rs 	= response.resultSet;

		if(rs.errored) {
			response.send(null, {
				status	: 202
			});

			return next(true);
		}

		//	This will be set if there was an upload.
		//
		if(uploadInfo && $.is(Array, uploadInfo.files) && uploadInfo.files.length) {
			var uploadRecords = [];
			$.asyncEach(function(targ, idx, res, next) {

				//	Data is stored in second arg...
				//
				targ = targ[1]

				//	See if we can match the file extension against what `file` believes the file is.
				//
				$.file.type(targ.path, function(err, stdout, stderr) {

					//	Just grabbing everything after the last `.`
					//
					var ext = targ.name.substring(targ.name.lastIndexOf(".") +1, Infinity);

					// This is not accurate, but ok for now to check against PDF.
					//
					if(stdout.indexOf(ext.toUpperCase() + " document") !== -1) {
						uploadRecords.push({
							size			: targ.size,
							lastModified	: targ.lastModifiedDate
						});
						next(null);
					} else {
						next(true);
					}
				})
			}, function(res) {

				next(null, uploadRecords);

			}, uploadInfo.files);

		} else {

			next(null);
		}
	};

    form.uploadDir = options.uploadDir;

    form
    	.on('error', function(err) {
    		console.log(">>>>> upload error");
			responder(true, err);
		})
		.on('aborted', function(err) {
			console.log(">>>>>> upload aborted");
			responder(true, err);
		})
		.on('field', function(field, value) {
			fields.push([field, value]);
		})
		.on('fileBegin', function(partName, file) {
			fileObjects.push(file);
		})
		.on('file', function(field, file) {
			//console.log(field, file);
			files.push([field, file]);
		})
		.on('end', function() {

			request.body = {};

			fields.forEach(function(f) {
				request.body[f[0]] = f[1];
			});

			responder(null, {
				fields	: fields,
				files	: files
			});

		});

    form.parse(request);
};

//	Going to dynamically add methods to the %router kit, so we'll use a temp object for now.
//
var kitDef	= {

	route	: route,

	removeRoute : function(meth, route) {
		var r 	= parseRoute(route);
		var	c	= COLLECTIONS[meth];

		if(c) {
			delete c[r.serialized];
		}
	},

	getRouteObject	: function(meth, route) {
		var r 	= parseRoute(route);
		var	c	= COLLECTIONS[meth];

		return c ? c[r.serialized] : null;
	},

	setOptions	: function(o) {

		var op = options;

		op.acceptedMimeTypes 	= o.acceptedMimeTypes || op.acceptedMimeTypes || {};
		op.uploadDir			= o.uploadDir || op.uploadDir || "/tmp/";
		op.timeout 				= o.timeout || op.timeout || $.options("defaultTransactionTimeout");
		op.usePostParser		= o.usePostParser === void 0 ? true : !!o.usePostParser;
	}
};

//	Extend the router kit definition with supported REST methods, eg. GET, PUT, POST...
//	The first argument is always a route (/my/route/).
//	Optionally, the second argument may be an object containing route options.
//	All other arguments should be functions, and are assumed to be delegates.
//	Note the "overloading" of second parameter, and how it is shifted below.
//
[
	"head"		,
	"get"		,
	"post"		,
	"put"		,
	"delete"	,
	"connect"	,
	"options"	,
	"trace"		,
	"copy"		,
	"lock"		,
	"mkcol"		,
	"move"		,
	"propfind"	,
	"proppatch"	,
	"unlock"	,
	"report"	,
	"mkactivity",
	"checkout"	,
	"merge"
].forEach(function(meth) {

	COLLECTIONS[meth] = {};
	
	kitDef[meth] = function(route) {
	
		var delegates 	= $.argsToArray(arguments, 1);
		var r 			= parseRoute(route);
		var rex			= r.serialized;
		var opts;

		if(delegates.length > 0) {
			if($.is(Object, delegates[0])) {
				opts = delegates.shift();
			}

			//	Note that existing route defs with identical route sigs are overwritten.
			//
			COLLECTIONS[meth][rex] = {
				original	: route,
				delegates	: delegates,
				regexp		: r.compiled,
				parameters	: r.parameters,
				options		: opts || {},
				usingPost	: options.usePostParser
			};
		
			//	If a custom POST parser has been sent it needs to be placed at the
			//  head of the delegation.
			//
			if(options.usePostParser) {
				if(meth === "post" || meth === "put") {
					COLLECTIONS[meth][rex].delegates.unshift(postParser);
				}
			}
		}
	}
});

$.addKit("router", kitDef);

$.router
	.setOptions(options)

	//	Landing page. Always a good idea to have one.
	//	This is a default. It is easily overridden with another .get("/", ...)
	//
	.get("/", function(request, response, next) {
		$.file.stream("public/" + config.default_http_index, request, response, next);
	})

return $.router;

} // end module export / function
