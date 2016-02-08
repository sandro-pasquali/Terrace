"use strict";

module.exports = function(options) {

options	= options || {};

var	$ = this;

var dictionary = $.require("dictionary");

var	exec	= require("child_process").exec;
var	fs		= require("fs");
var	path	= require("path");
var	zlib 	= require("zlib");
var util	= require("util");
var	gzip 	= zlib.createGzip();

var	mimeTypes	= require("./mimeTypes").mimeTypes;
var useCache 	= !!useCache;

//	The number of seconds the file is stored (Redis EXPIRE).
//	The cache expiry is reset to this number on each fetch.
//	The pattern is to set a short (default ten minute) period of time within which more
//	than one access should occur. If a file is not being accessed at least once during this
//	time, it falls out of cache.
//
//	Note that 304's still apply: "if-none-match" (esp. Etag), "if-modified-since", are
//	recognized prior to a cache check, so even more efficient serving can be achieved
//	given an aware client sending such header checks.
//
var cacheExpireSeconds	= options.cacheExpireSeconds || 600;

var	stream = function(filepath, request, response, next) {

	var meth 	= request.info.method;
	var opts 	= {};

	next 	= next || $.noop;

	if($.is(Object, filepath)) {
		opts 		= filepath;
		filepath 	= opts.filepath;
	}

	if(!$.is(String, filepath)) {
		next(true, {
			status	: 500,
			code	: "FILE_MALFORMED_FILENAME",
			trace	: []
		});
		return;
	}

	//	We always check if the true file exists, even if it is in cache.
	//
	fs.stat(filepath, function(err, stat) {

		//	Any file stat error is treated as a 404.
		//
		if(err) {
			return response.send(true, {
				status	: 404
			});
		}

		//	If the path is to a directory, assume an index.html file was
		//	requested, and re-call.
		//
		if(stat.isDirectory()) {
			if(filepath.lastIndexOf("/") !== filepath.length -1) {
				filepath += "/";
			}
			return stream(filepath + "index.html", request, response, next);
		}

		var fileType 	= path.extname(filepath).replace(".","");
		var offset 		= $.is("numeric", opts.offset) ? opts.offset : 0;
		var	mtime		= Date.parse(stat.mtime);
		var headers 	= {};
		var cacheKey	= "filecache:" + filepath;

		//	When we don't have anything in the cache, this fetches a file and
		//	pipes it to the response stream.
		//
		var sendFileStream = function() {
			var accumulator	= "";
			var uc 			= useCache;

			headers['transfer-encoding'] 	= 'chunked';
			headers['client_id']		 	= response.client_id;
			headers['fingerprint']			= response.fingerprint;
			headers['transaction_id']	 	= response.transaction_id;

			response.writeHead(200, headers);

			//	TODO: add a timeout
			//
			fs.createReadStream(filepath, {
				'flags'			: 'r',
				'mode'			: '0666',
				'bufferSize'	: 4096
			})
			.addListener("data", function(chunk) {
				uc && (accumulator += chunk);
				response.write(chunk, 'binary');
			})
			.addListener("end", function() {
				uc && $.dictionary.setAndExpire(cacheKey, cacheExpireSeconds, accumulator, $.noop);
				next();
			})
			.addListener("close",function() {
				response.end();
			})
			.addListener("error", function (e) {
				next(true, "file read error on > " + filepath);
			});
		};

		headers['Etag']          	= JSON.stringify([stat.ino, stat.size, mtime].join('-'));
		headers['Date']          	= new Date().toUTCString();
		headers['Last-Modified'] 	= new Date(stat.mtime).toUTCString();

		//	Handle HEAD requests, or 304 situations.
		//
		if(request.headers['if-none-match'] === headers['Etag'] || Date.parse(request.headers['if-modified-since']) >= mtime) {
			return response.send(null, {
				status 	: 304,
				headers	: headers
			});
		} else if (request.method === 'head') {
			return response.send(null, {
				status	: 200,
				headers	: headers
			});
		}

		headers['Content-Type']   		= mimeTypes[fileType] || 'application/octet-stream';
		headers['Content-Length']		= stat.size;

		//	Send file stream if not caching.
		//	Otherwise, check if there is something in the cache, and send that if
		//	available, file stream if not.
		//
		if(!useCache) {
			return sendFileStream();
		}

		$.dictionary.$get(cacheKey, function(err, cachedFile) {
			if(!err && cachedFile) {

				//	Update expires on every serve.
				//
				$.dictionary.expire(cacheKey, cacheExpireSeconds);

				console.log("fromCache: " + filepath);
				response.writeHead(200, headers);
				response.write(cachedFile);
				response.end();
				return next();

			} else {
				sendFileStream();
			}
		});
	});
};

$.addKit("file", {

	"type"	: function(file, cb) {
  		exec("file " + file, cb);
	},

	"stream"	: stream,

	"read"		: function(path, cb) {
		fs.readFile(path, "utf8", cb);
	},

	"write"		: function() {},
	"delete"	: function() {}
});

return $.file;

};

		/*
			  if (fn) return fn(err);
  return ('ENOENT' == err.code || 'ENAMETOOLONG' == err.code)
	? next()
	: next(err);
	*/