"use strict";

//	%concierge sets up the transaction server. This means it starts a server, creates core
//	routes:
//			#log
//			#authenticate
//	Generally ensures that the caller is allowed to make calls, handles favicon, adds
//	to the request and response objects (importantly response#send), and provides an
//	api for requests about users, transactions, etc.
//

//	As this is the server, might as well catch anything that hasn't been handled
//	in kits before it hits the exception loop. This keeps the server up, which is nice.
//
//	TODO: reporting of some sort, logging, maybe something more active.
//
process.on('uncaughtException', function(e) {
  console.log('uncaughtException: ' + e);
});

//	%concierge
//
//	The first contact with the server by a client.

module.exports = function(options) {

options = options || {};

var	$	= this;

//	Terrace deps.
//
$.require("data", "router", "file", "dictionary");

//	All keys in redis should be prefixed by this.
//
var KEY_PREFIX 	= require("../../../config.json").db_prefix + ":";

//	Info for SSL
//
var CERT_KEYS 	= options.certKeys;

//	%concierge handles validation and login. Once that is completed, most other requests
//	need to be routed. Normal is to simply use %router. Another method responsible for
//	routing can be passed here (overriding default router).
//
var ROUTER = options.router;

//	Where log files are put.
//
var LOG_DIRECTORY = options.logDirectory || "logs/";

//	Whether to try to find and return a favicon, or ignore those requests.
//	Might be faster to turn off favicon handling (less work for the server).
//
var USE_FAVICON	= options.useFavicon === void 0 ? true : !!options.useFavicon;

//	The activity timeout for anonymous users, in seconds. Default is ten minutes.
//	This timeout is refreshed on each access.
//
var ANON_INACT_TIMEOUT = options.anonTimeout || 600;

//	When a client sends a @transaction-id header with a request this indicates that the
//	client may want to check on the status of the transaction at some point in the future.
//	This is the expiry time, in seconds, of the transaction record which will be created
//	against the sent id (key).
//
var TRANSACTION_LIFESPAN = options.transactionLifespan || 120;

//	When logging, a collection of writeStreams.
//
var LOG_STREAMS = {};

var LOGGING_ENABLED = false;

//	Will contain a reference to the server created via #listen.  Note that there
//	can only be one server in existence.  Multiple calls to #listen override
// 	previous references.
//
var SERVER = {};

//	You MUST set the acceptable request origin host. This works to ensure that the server
//	only responds to requests from the proper domain (the machine hosting this Node server).
//
var	VALID_HOSTS	= options.validHosts;
if(!VALID_HOSTS) {
	console.log("No @validHosts option set. This is mandatory. Server startup has failed.");
	process.exit(1);
}

/**********************************************************************************************/

//	Native Node modules.
//
var http 	= require('http');
var https	= require('https');
var net		= require('net');
var url		= require('url');
var	fs		= require('fs');
var path	= require('path');
var qs		= require('querystring');
var crypto	= require('crypto');
var redis	= require("redis").createClient();
var util	= require("util");

//	When logging (a route) we will need to create a log file, which is unique to that route.
//	This converts a route into a valid filename, replacing `/` with `_`, and removing
//	any remaining non-alphanumeric characters.
//
var normalizedRoute = function(r) {
	return r.replace(/\//g, "_").replace(/[^_\w]/g, "");
};


//	##processRequest
//
//	Handles all requests received by Node server.  This includes challenge/authenticate
//	system.  Mainly, routing of requests.  What is returned is a command object, which
//	will contain all information necessary to create and send a response to the client,
//	including response status code, content type, content, etc.
//
var processRequest 	= function(request, response) {

	var headers 	= request.headers;

	response.fingerprint    = headers.fingerprint;
	response.client_id      = headers.client_id;
	response.transaction_id	= headers.transaction_id;

	var urlParse 	= url.parse(request.url, true);
	var inf			= path.normalize(urlParse.pathname).split("/");

	//	We'll have an empty 0 element since paths start with /
	//
	inf.shift();

	var key = inf.shift();

	var logRoute;
	var routeIdx;
	var logFile;
	var z;
	var _log;

	//////////////////////////////////////////////////////////////////////////////////////
	//																					//
	//		VALIDATE BOTH THE ORIGIN, AND THAT THE CLIENT HAS A PROPER ID				//
	//																					//
	//////////////////////////////////////////////////////////////////////////////////////

	var generateHash = function(s) {
	    return crypto.createHash('sha256').update($.uuid() + (s || Math.random())).digest('hex');
	};

	//	Ensure that the original request is on the valid origin list.
	//
	if(!VALID_HOSTS[headers.host]) {
	
		console.log('Invalid host', headers)
	
		return response.end(":/");
	}

	//	The client should be posting his #client_id and a client challenge (#cChallenge)
	//	which matches the expected authorisation response value calculated
	//	in #createServerChallenge.
	//
	//	If authenticated, the client object created by #createChallenge will have its
	//	#authenticated attribute set to "Y", which is the flag used going forward to
	//	validate incoming requests.
	//
	//	If authentication fails, nothing is reported to client, and the client object is
	//	destroyed.
	//
	if(key === "authenticate" && request.method === "POST") {

		var postData = "";

		request.on("data", function(chunk) {
			postData += chunk;
		});

		request.on("end", function() {
			var pd			= qs.parse(postData);
			var username	= pd.username;
			var password	= pd.password;

			redis.hget($.data.$get("config.user_hash"), username, function(err, pw) {
				var clientObj;

				//	Checking if the sent password matches username. Responding with
				//	status code #401 unauthorized if not matched.
				//
				//	pw === null if no record found.
				//
				if(err || !pw || (pw !== password)) {
					response.send(true, {
						status		: 401
					});
				} else {

					response.client_id 	    = generateHash();
					response.fingerprint    = generateHash();

					$.dictionary.setAndExpire(KEY_PREFIX + response.client_id, ANON_INACT_TIMEOUT, JSON.stringify({
						"client_id"		: response.client_id,
						"fingerprint"	: response.fingerprint || null,
						"stamp"			: new String(request.info.requestTime)
					}), function(err) {
						response.send(null);
					});
				}
			});
		});

	//	Register this client, returning application globals
	//
	} else if(key === "registerClient") {

		//	All users (even anon, not auth'd) get a #client_id -- #fingerprint is the
		//	unique item that authenticated users get.
		//
        if(!response.client_id) {
            response.client_id = generateHash();
        }

       	return response.send(null, {
            body : $.data.$get("config.globals") || {}
        });

	//	Send username as second segment of route:
	//
	//	@eg		/usernameExists/maximillian
	//
	} else if(key === "usernameExists") {
		$.concierge.finger(inf[0], function(err, exists) {
			response.send(err, {
				body 	: exists ? "Y" : "N"
			});
		});

	//	Handles a request for the current status of a transaction. Expects second segment
	//	of route to be the transaction id:
	//
	//	@eg		/transaction/204987908432/
	//
	} else if(key === "transaction") {

		if(!response.client_id || !response.fingerprint) {
			return response.send(true);
		}

		$.dictionary.get(inf[0], function(err, data) {
			response.send(err, {
				body	: JSON.parse(data)
			});
		});

	//	Turn on logging if we receive a route, cancel all logging if not.
	//
	} else if(key === "log") {

		if(!response.client_id || !response.fingerprint || !response.isAdmin) {
			return response.send(true);
		}

		//	Did we receive a route to log?
		//
		if(inf.length) {

			//	If logging, what follows /log/ is the route we want logged. This has been
			//	split (above, into #inf), so re-assemble.
			//
			logRoute = "/" + inf.join("/");

			routeIdx 	= normalizedRoute(logRoute);
			logFile		= LOG_DIRECTORY + routeIdx + "." + request.info.requestTime + ".csv";

			//	Create a writable stream if none. Note that we are appending.
			//
			if(!LOG_STREAMS[routeIdx]) {

				_log = function() {
					LOG_STREAMS[routeIdx] = fs.createWriteStream(logFile, { flags: 'a' });
					LOG_STREAMS[routeIdx].write("start,end\n", "utf8");
					LOGGING_ENABLED = true;
					response.end("Logging started to file " + logFile);
				};

				//	Ensure that /#LOG_DIRECTORY exists, and start logging.
				//
				fs.stat(LOG_DIRECTORY, function(err, stat) {
					if(err) {
						fs.mkdir(LOG_DIRECTORY, "0777", _log);
					} else {
						_log();
					}
				});
			}
		} else {

			for(z in LOG_STREAMS) {
				LOG_STREAMS[z].destroySoon();
				LOG_STREAMS[z].end();
			}

			LOG_STREAMS 	= {};
			LOGGING_ENABLED = false;

			response.end("LOGGING TERMINATED");
		}

	//	This is a request for event notifications. If this is never called, notifications
	//	are never sent.
	//
	} else if(key === "bindReceiver") {

		if(!response.client_id) {
			return response.send(true);
		}

		response.writeHead(200, {
		  'Content-Type'				: 'text/event-stream',
		  'Cache-Control'				: 'no-cache',
		  'Connection'					: 'keep-alive',
		  'Access-Control-Allow-Origin'	: '*'
		});

		response.write(':' + Array(2049).join(' ') + '\n'); //2kb padding for IE

		var __t = setInterval(function() {
			var mess = 'id: ' + 'myEvent' + '\ndata: {"time":"' + Date() + '"}\n\n';
		  response.write(mess);
		}, 1000);

		response.socket.on('close', function() {
		  clearInterval(__t);
		});

	//	All other routes are handled by #router.
	//
	}  else {


		//	Do something here to validate that the client has permissions to call
		//	this (or *any*) method...
		//

		ROUTER ? ROUTER(request, response) : $.router.route(request, response);
	}
};

//////////////////////////////////////////////////////////////////////////////////////////
//																						//
//									The request listener.								//
//																						//
//////////////////////////////////////////////////////////////////////////////////////////

//	##listener
//
//	This is the handler for server requests.
//
//	@see	%concierge#listen
//
var listener = function(request, response) {

	var uri 	= url.parse(request.url, 1);
	var route	= uri.pathname;

	//	If we're dealing with a favicon, fetch and return it
	//
	if(route.indexOf("favicon.ico") !== -1) {

		if(!USE_FAVICON) {
			return response.end();
		}

        return fs.readFile("public/favicon.ico", function(err, buffer) {
			if(buffer) {
				response.writeHead(200, {
					'Content-Type'		: 'image/x-icon',
					'Content-Length'	: buffer.length,
					'Cache-Control'		: 'public, max-age=86400',
					'ETag'				: '"' + crypto.createHash('md5').update(buffer).digest('hex') + '"'
				});
			} 
			
			response.end(buffer);
        });
	}

	request.info = {
		method			: request.method.toLowerCase(),
		protocol		: $.is(https.Server, SERVER) ? "https:" : "http:",
		requestTime		: new Date().getTime(),
		uriInfo			: uri,
		route			: route
	};
	
	//	##redirect
	//
	request.redirect = function(newUrl) {
		response.writeHead(302, {
			'Location': newUrl
		});
		response.end();
	};

	//	##send
	//
	//	Delegates should use this to respond to requests.
	//
	//	@param	{Boolean}	err		Whether the response is in an error state.
	//	@param	{Object}	routed	The routed response object. Definition:
	//
	//		#status		HTTP response status. Default is `200`.
	//		#type		The value "content-type" header, such as "text/html".
	//					Default is "application/json".
	//		#body		Any sort of string to be returned. If #type is
	//					"text/html" then #body will form the response body.
	//
	response.send = function(err, routed) {
		routed = routed || {};

		//	Delegates can set headers in the delegation result set.
		//
		var sentHeaders	= routed.headers	|| {};

		var tid = response.transaction_id;

		//	This is the collection of data as returned by delegates, which will be returned
		//	in some format to the caller. It may be augmented within this method.
		//
		var fin	= {
			body			: routed.body || null,
			results			: response.resultSet || {},
			env				: {
				permissions			: {},
				languageZone		: "us/en",
				defaultTimeout		: 3000
			}
		};

		//	We don't need #last anymore (it's the last element in stack),
		//	and for convenience we indicate the last element's index.
		//	Note that it's possible for there not to be a stack, and that if the
		//	stack is empty (or nonexistent), its length is -1.
		//
		delete fin.results.last;
		fin.results.length = fin.results.stack ? fin.results.stack.length -1 : -1;

//console.log("**********SENT RESULTS**********");
//console.log(fin.results);
//console.log("****************************");

		var p;
		var headers	= {
			'content-type' 	: $.is(String, routed.type) ? routed.type.toLowerCase() : "application/json",
			'client_id'		: response.client_id,
			'fingerprint'	: response.fingerprint,
			'transaction_id': tid
		};

		//	Update headers with any sent headers
		//
		for(p in sentHeaders) {
			headers[p] = sentHeaders[p];
		}

		//	If there has been a #transaction_id header sent, then we are going to store
		//	this transaction result for #TRANSACTION_LIFESPAN seconds.
		//
		if(tid) {
			$.dictionary.setAndExpire(KEY_PREFIX + tid, TRANSACTION_LIFESPAN, JSON.stringify({
				errored	: fin.results.errored,
				stack	: fin.results.stack
			}));
		}

		//	The /log/ route is in play.
		//
		if(LOGGING_ENABLED) {

			//	#__ROUTE__ is written by %router
			//
			var ridx = normalizedRoute(request.__ROUTE__);

			if(LOG_STREAMS[ridx] && LOG_STREAMS[ridx].writable) {
				LOG_STREAMS[ridx].write(request.info.requestTime + "," + (new Date().getTime() - request.info.requestTime) + "\n", "ascii");
			}
		}

		//////////////////////////////////////////////////////////////////////////////////
		//																				//
		//						Prepare and send the response							//
		//																				//
		//////////////////////////////////////////////////////////////////////////////////

		response.writeHead($.is("numeric", routed.status) ? routed.status : 200, headers);


        //  Prepare and send response.
        //
		switch(headers['content-type']) {
			//	You must send a body for this content-type.
			//
			case "text/html":
				response.end(routed.body);
			break;

			case "application/json":
				response.end(JSON.stringify(fin));
			break;

			default:
				response.end();
			break;
		}

		response.__SENT__ = true;
	};

	processRequest(request, response);
};

//////////////////////////////////////////////////////////////////////////////////////////
//																						//
//									The event broadcaster								//
//																						//
//////////////////////////////////////////////////////////////////////////////////////////

$.addKit("concierge", {

	listen	: function(port) {

		//	First, fetch configuration files for this server. These will be added
		//	the the %data k/v store.
		//
		redis.hgetall(KEY_PREFIX + "server:config", function(err, data) {

			if(err) {
				return console.log("Unable to fetch server config. Did you run Make?");
			}

			var globals = {};
			var k;
			var v;

			for(k in data) {

				v = data[k];

				if(k.charAt(0) === "_") {

					//	We're transferring these to #globals, which object will be
					//	assigned to the #globals attribute of #data.
					//
					delete data[k];

					k = k.substring(1, Infinity);

					globals[k] = v;

					//	Create a RegExp object for the local representation.
					//	Note that #global remains set to the regex object string.
					//
					if(k.indexOf("regexp_") === 0) {
						data[k] =  Function("a", "a = a || '';" + v);
					}
				}
			}

			data.globals = globals;

			$.data.set("config", data);

			if(options.https) {
				port = port || 443;
				SERVER = https.createServer(CERT_KEYS, listener).listen(port);
			} else {
				port = port || 80;
				SERVER = http.createServer(listener).listen(port);
			}
			
			console.log(((options.https) ? "HTTPS" : "HTTP") + " server started on port " + port);
		});
	},

	grant	: function(cred, val, customerId, cb) {

		//	TODO
		//
		cb(null, true);
	},

	expel	: function(cb) {
		// TODO
		//
		cb(false, "expelled");
	},

	finger : function(username, cb) {
		redis.hget($.data.$get("config.user_hash"), username, cb);
	},

	has	: function(credential, identifier, cb) {

		//	TODO: actually fetch/check credentials...
		//
		var cred 	= "`has` result";

		setTimeout(function() {
			cb(false, cred); // cb(true, cred) tests .tries()
		}, 3500);
	}
});

return $.concierge;

} // end exports / function



