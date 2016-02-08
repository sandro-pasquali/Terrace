module.exports = function() {

var Terrace	= this;

Terrace.addKit("assess", {

	"set"		: function(a, b, resolver) {
		setTimeout(function() {
			resolver(false, "#set result");
		}, 6000);
	},
	"get"		: function(a, resolver) {
		setTimeout(function() {
			resolver(false, "#get result");
		}, 4000);

	},
	"getset"	: function(a, b, resolver) {
		client.getset(a, b, function(err, resp) {
			resolver(err, resp);
		});
	},
	"unset"		: function(a, b, resolver) {
		client.del(a, b, function(err, resp) {
			resolver(err, resp);
		});
	},


	"foo"		: function(a, resolver) {
		setTimeout(function() {
			resolver(false, "#foo result");
		}, 3000);

	},

	"bar"		: function(a, resolver) {
		setTimeout(function() {
			resolver(false, "#bar result");
		}, 8000);

	},

	"spic"		: function(a, resolver) {
		setTimeout(function() {
			resolver(false, "#spic result");
		}, 1000);

	},

	"span"		: function(a, resolver) {
		setTimeout(function() {
			resolver(false, "#span result");
		}, 2000);

	},

	"nick"		: function(a, resolver) {
		setTimeout(function() {
			resolver(false, "#nick result");
		}, 5000);

	},

	"nack"		: function(a, resolver) {
		setTimeout(function() {
			resolver(false, "#nack result");
		}, 4000);

	}

});

return Terrace.assess;

} // end module export / function


/*

var redis = require("redis"),
    client = redis.createClient();

client.on("error", function (err) {
  console.log("Error " + err);
});

client.set("string key", "string val", redis.print);
client.hset("hash key", "hashtest 1", "some value", redis.print);
client.hset(["hash key", "hashtest 2", "some other value"], redis.print);
client.hkeys("hash key", function (err, replies) {
  console.log(replies.length + " replies:");
  replies.forEach(function (reply, i) {
      console.log("    " + i + ": " + reply);
  });
  client.quit();
});

*/

	/**
		client.get(a, function(err, resp) {
			resolver(err, resp);
		});
	**/

		/***
		client.set(a, b, function(err, resp) {
			resolver(err, resp);
		});
	**/

/*



	console.log($.options("useNativeArrayMethods"));
	console.log("RES");

	$.map([3,4,5], function(e, i, a) {
		return 2;
	});
	console.log($.$);

	$.reduce([2,4,6,8], function(prev, cur, idx, t) {
		console.log(prev + " -- " + cur);
		return prev + cur;
	});
	console.log($.$);

	$.reduceRight([2,4,6,8], function(prev, cur, idx, t) {
		console.log(prev + " -- " + cur);
		return prev + cur;
	}, 100);
	console.log($.$);

	$.filter([3,4,5], function(e, i, a) {
		return e === 3 || e === 4;
	});
	console.log($.$);

	$.every(function(e, i, a) {
		return e <= 5;
	}, [3,4,5]);
	console.log($.$);

	$.some(function(e, i, a) {
		return e === 3;
	}, [3,4,5]);
	console.log($.$);

*/