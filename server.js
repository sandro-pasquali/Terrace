"use strict";

var	fs	= require("fs");

var $ = require("./public/terrace.js");

$
.configure({
	useNativeArrayMethods		: true,
	defaultTransactionTimeout	: 5000
})
.require(
	"dictionary",
	"file", {
		useCache: false
	},
	"template",
	"concierge", {
		//https		: true,
		certKeys	: {
			//key		: fs.readFileSync('rsa/private-key.pem'),
			//cert	: fs.readFileSync('rsa/public-cert.pem')
		},
		useFavicon	: true,
		router		: null,
		validHosts	: {
			"terracejs.com" : "ec2-user",
			"www.terracejs.com"	: "ec2-user",
			"localhost:2113" : "dev"
		},

		mustHaveClientId	: false,//true
		anonTimeout			: 600,
		transactionLifespan	: 600
	},
	"router", {
		timeout			: 500000,
		uploadDir		: "uploads/",
		usePostParser	: true,
		acceptedMimeTypes	: {
			"text/plain"		: "txt",
			"application/pdf" 	: "pdf"
		}
	}
)

//	This spins up the Node server.
//
.concierge.listen(2113)


//	Set your routes here
//
.router

	.post("/dummy", function(request, response, next) {
		next(null, "first");
	}, function(request, response, next) {
		next(null, "second");
	}, function(request, response, next) {
		next(null, "third");
	}, function(request, response, next) {
		next(null, "fourth");
	}, function(request, response, next) {
		response.send(response.errored, {
			body:	response.resultSet
		});

		next();
	})

	//	Multipart handler for uploads
	//
	.post('/upload', {
		tryOn	: {
			1	: 5
		},
		timeout	: 100000
	}, function(request, response, next) {

		console.log("*** COMPLETED UPLOAD ROUTE ***");

		response.send(null, response.resultSet);

		//	Randomize whether this has errored
		//
		//next(!(parseInt(Math.random() * 3) > 1));
		next();
	})

	//	For testing, generalized post handler, passing forward delegate responses.
	//
	//	@see	https://url/login :: sandro/password
	//
	.post("/formData/", function(request, response, next) {

		next(null, "methodId: " + request.body.methodId);

	}, function(request, response, next) {

		next(null, "clientId: " + request.body.clientId);

	}, function(request, response, next) {

		next(null, "transactionId: " + request.headers.transaction_id);

	}, function(request, response, next) {

		next(null, "timeout: " + request.body.timeout);

	}, function(request, response, next) {

		next(null, "object: " + request.body.object);

	}, function(request, response, next) {

		$.template.prepareFile("../templates/test.tmp", function(err, tmp) {
			response.send(err, {
				type:	"text/html",
				body:	err ? "" : $.template.$render(response.resultSet)
			});

			next();
		});
	})

	//	Artificial delay.
	//
	//	********* MAKE SURE YOU ERASE THIS BEFORE GOING TO PRODUCTION!!! ****************
	//
	.get("/delay/:time/", function(request, response, next) {
		setTimeout(function() {
			response.send(null, {
				type	: "text/html",
				body	: ""
			});
			next();
		}, request.params.time);
	})

	.get("/fetchLogData/", function(request, response, next) {

		if(!response.client_id || !response.fingerprint || !response.isAdmin) {
			return response.send(true);
		}

		response.writeHead(200, {
			'content-type' : 'text/html'
		});

		fs.readdir(logDirectory, function(err, files) {

			var out = "";

			if(!err) {
				out = "/" + logDirectory + files.join("|/" + logDirectory);
			}

			response.end(out);
		});

		next();
	})
