var redis = require('redis').createClient();

var config 		= require("../config.json");
var db_prefix 	= config.db_prefix + ":";

describe('Redis->' + db_prefix + 'users', function() {
	it('should have at least one field', function() {
		redis.hlen(db_prefix + 'users', function(err, cnt) {
			if(err || cnt < 1) {
				throw new Error('User table does not exist or initial admin record not created.');
			}
		})
	})
})
