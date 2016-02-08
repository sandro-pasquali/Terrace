module.dependencies = ["string", "auditor"];
module.exports 		= function() {

	var $ = this;

	//	Storage space for call options.
	//
	//	@see	kit#set
	//
	var options		= {};

	//	Storage space for post data.
	//
	//	@see	#procOb
	//	@see	kit#post
	//	@see	kit#data
	//
	var data		= "";

	//	Default headers set on every request.
	//
	var defaultH	= {
		'Accept':	'applications/json, application/xml, text/javascript, text/plain, text/html, text/xml, */*'
	};

	//	Stores response data from GETs.
	//
	//	@see		#main
	//
	var cache		= {};

	//	A Factory which creates an object which will be attached to the #auditors list.  Its
	//	#main routine continues to be checked until it finds that its xhr request has returned.
	//	At which point the #main routine will augment the call object where necessary (adding
	//	an xml facade, for instance), then execute all relevant handlers, and finally indicate
	//	that it is done, which will result in it being removed from the audit list.
	//
	var xhr = function() {
		var p;
		var ret = {

			handle:	window.XMLHttpRequest	? new XMLHttpRequest()
											: new ActiveXObject("Microsoft.XMLHTTP"),
/*
	Uncomment to force native IE object, which allows local file access, for testing only.

			handle:	new ActiveXObject("Microsoft.XMLHTTP"),
*/
			//	Will return you the status code for a request.
			//
			status: function() {

				var s = this.handle.status;

				//	IE will set status for 204 to this strange code... adjust.
				//
				if(s == 1223) {
					return 204;
				}

				return s;
			},

			//	Use this method to set and get header values.  Sending a header key will retrieve
			//	the header with that name. Send a second value argument to set that value.
			//
			//	@param		{String}		k		The header key to work with.
			//	@param		{String}		[v]		If sent a value, will set.
			//
			header: function(k, v) {
				if(!v) {
					return this.handle.getResponseHeader(k);
				}

				this.handle.setRequestHeader(k, v);
			},

			//
			setDefaultHeaders: function() {
				for(var h in defaultH) {
					this.header(h, defaultH[h]);
				}
			},

			//	Cleans up the

			//	This should be assigned to #readystatechange of handler.
			//
			main: function(inf) {
				if(this.handle.readyState === 4 || this.async === false) {
					var t 		= this;
					var	st 		= t.status();
					var	cac		= cache[t.url];
					var	data 	= t.responseText = (t.handle.responseText || '');
console.log(this)
					switch(t.type) {

						case 'json':
							data = t.responseJson = JSON.parse(t.responseText).$;
						break;

						case 'jsonp':
							// build in jsonp handling
						break;

						case 'insert':
							// do the dom insert
						break;

						default:
						break;
					}

					//	If a 304, map the cached data onto the *current* request object.
					//
					if(cac && st == 304) {

						t.responseText 	= cac.responseText;
						t.responseXML	= cac.responseXml;
						t.responseJson	= cac.responseJson;

					//	Create a cache entry for GET requests on successful fetch.
					//
					} else if(st === 200 && t.method === 'GET') {
						t.Etag 			= t.header("Etag") || '"0"';
						cache[t.url]  	= t;
					}

					//	Any success function (on success, of course...)
					//
					if((st == 0 && location.protocol === 'file:') || (st >= 200 && st < 300)) {
						t.success.call(t.callObj, false, data, st);
					}

					//	If the developer has asked for a status-specific handler, run that now.
					//
					t['on' + st] && t['on' + st].call(t.callObj, false, data, st);

					//	Note that all other handlers/callbacks have run prior to #complete
					//	being called.
					//
					t.complete.call(t.callObj, false, data, st);

					return false;
				}

				return true;
			}
		};

		//	Transfer any options that were set in this transaction to the audit object,
		//	and clear the internal options collection (so it doesn't carry to next).
		//
		for(p in options) {
			ret[p] = ret[p] || options[p];
		}

		//	Once we've perfected an Xhr object, options and data cannot carry over.
		//
		options = {};
		data	= "";

		return ret;
	};

	var send = function() {

		var Xhr	= xhr();

		//	Create the native transport object.
		//
		Xhr.handle.open(
			Xhr.method,
			Xhr.url,
			Xhr.async,
			Xhr.username,
			Xhr.password
		);

		Xhr.setDefaultHeaders();

		//	If we have a cached copy (only relevant on GETs), only fetch new content if
		//	its Etag differs from ours (If-None-Match).
		//
		if(Xhr.cache && cache[Xhr.url] && Xhr.method == 'GET') {
			Xhr.header("If-None-Match", cache[Xhr.url].Etag);
		}

		//	POST
		//
		if(Xhr.method == 'POST') {
			Xhr.header("Content-type", "application/x-www-form-urlencoded");
		}

		Xhr.beforeSend.call(Xhr.callObj, false, this);

		//	This is the native xmlHttpRequest sending mechanism.
		//
		Xhr.handle.send(Xhr.body);

		$.auditor.audit(Xhr.main, Xhr);
	};

	//	Mainly a sanitizer, is called by all xhr methods in the kit prior to calling #send.
	//
	//	@see		#send
	//
	var procOb = function(url, cb, scp, typ) {

		var o 	= options;

		o.url		= url;
		o.success	= cb;

		//	The Object on which #xhr is called is *always* passed by kit methods,
		//	and is the scope in which all callback functions are executed in.
		//
		o.callObj	= scp;

		o.type	= typ || false;

		//	This is the default, which will be overridden by specific http methods in
		//	the kit (such as #post).  See below.
		//
		o.method	= o.method || 'GET';

		o.body 		= data;

		o.async		= o.async === undefined ? true : !!o.async;

		//	Whether to disable caching.  Default is no caching.
		//
		o.cache		= o.cache === void 0 ? false : !!o.cache;

		o.maxTime		= o.maxTime		|| false;
		o.complete		= o.complete	|| $.noop;
		o.beforeSend	= o.beforeSend	|| $.noop;
		o.contentType	= o.contentType	|| false;
		o.body			= o.body		|| "";

		return options;
	};

	$.addKit('xhr', {

		//	#get
		//
		//	@param		{String}		url		The url to GET.
		//	@param		{Function}		cb		The callback function.
		//
		get			: function(url, cb) {
			procOb(url, cb, this);
			send();
		},

		//	#post
		//
		//	@param		{String}		url		The url to GET.
		//	@param		{Function}		cb		The callback function.
		//	@param		{
		//
		post		: function(url, cb) {
			options.method	= 'POST';
			procOb(url, cb, this);
			send();
		},

		getJson		: function(url, cb) {
			procOb(url, cb, this, 'json');
			send();
		},


		data	: function(d, resolver) {
			var pq	= {};
			var p;

			data = data || "";

			//	Handle #body data (usually used for POST). Can send post body either as a
			//	string or data object (array, object).  If a string, values are teased out
			//	and encoded.
			//
			if(d) {
				if($.is(String, d)) {
					d.replace(/([^=&?]+)(=([^&]*))?/g, function(pair, k, $2, v, idx, str) {

					console.log(arguments);

						if(k) {
							pq[k] = v;
						}
					});
					d = pq;
				}

				for(p in d) {
					data += encodeURIComponent(p) + '=' + encodeURIComponent(d[p]) + '&'
				}
			}

			resolver && resolver(false, data);
		},

		set		: function(ops, resolver) {

			var p;

			for(p in ops) {
				options[p] = ops[p];
			}

			resolver && resolver();
		},

		extend	: function(resolver) {

			console.log("testing extended methodsss......");

			resolver && resolver();
		}
	});

	return $.xhr;
}





