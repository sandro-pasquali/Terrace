//	Methods facilitating the construction of serial and parallel transactions, which
//	transactions comprise a collection of asynchronous methods:
//	#parallel
//	#serial
//	#end
//
//	These methods directly extend the Object: Terrace#parallel...
//
//	Additionally, pre-advice is used.
//
module.exports = function(options) {

options = options || {};

var	$	= this;

//	##parallel
//
//	Flags the start of a sequence of Object calls which will be wrapped by a transaction.
//	Also flags the beginning of a transaction. Object methods following .parallel() will become
//	members of this transaction, and each of those members may attach promise methods to
//	themselves, executed when the promise for that method is resolved.
//
//	To exit this transaction mode, use #end. Note that the binding of the resolver method
//	for each transaction member is done in #extend, as part of the Object method wrapper.
//
//	The transaction members execute in parallel, calling their promise methods when resolved.
//	When all are resolved their #ns#onTransactionDone method is fired. This method is
//	set in #end, which can be passed said method as an argument.
//
//	#serial transactions and its members are set up in exactly the same way, except that
//	#serial transaction members are queued until #end is reached, at which point #end will
//	start their execution by passing them to #asyncEach.
//
//	@see	#end
//	@see	#serial
//	@see	#extend
//
$.hoist("parallel", function(options) {

	options	= options || {};

	//	We want to fire callbacks in the scope of the caller.
	//
	var $origObj	= this;

	//	Note that a transaction object is an enhanced, new, Object.
	//
	var $this		= options.scope ? options.scope.spawn() : this.spawn();

	var rejOnError	= options.rejectTransOnError || $this.options("rejectTransOnError");

	//	Whether *any* transaction method has errored (ie. whether transaction is in error state).
	//
	var transErrored;

	//	Whether the current transaction method has errored.
	//
	var	errored;

	var transactionTimeout;

	//	@param	{Number}	[filt]	A filter, run in scope of each timeout, which will cancel
	//								the timeout by returning true.
	//
	var cancelMethodTimeouts	= function(filt) {
		filt = $.is(Function, filt) ? filt : function() { return true; };
		$.each(pr.timeouts, function(e, i) {
			if(filt.call(e)) {
				e.cancel();
				delete pr.timeouts[i];
			}
		});
	};

	var sanitizedResults	= function() {
		var r = $.copy(pr);
		delete r.callbacks;
		return r;
	}

	var cleanup		= function() {
		transactionTimeout && transactionTimeout.cancel();
		cancelMethodTimeouts();
		$this.$n.resolve 	= $.noop;
		runPromiseMethods	= $.noop;
		pr.tries			= {};
	};

	//	Fires all the promise methods (#then, #or, #always) attached to the transaction promise.
	//	Following which checks if the transaction is resolved, and executes relevant methods.
	//
	var runPromiseMethods	= function(methId, methName, result) {
		//	Run through the promise methods bound to the transaction method #methId,
		//	calling each in context of $this. Note that a promise method is passed the
		//	transaction method result, and if it returns a new value, this changes the
		//	original result.
		//
		var run 	= function(rmeth) {
			$.each(pr.callbacks[methId] ? pr.callbacks[methId][rmeth] || [] : [], function(e) {
				var r = e.callback.call($origObj, errored, result);
				result = r === void 0 ? result : r;
			});
		};

		//	#or 	will fire if there was an error, and not otherwise.
		//	#then 	will fire if the call did not error.
		//	#always	will *always* fire, regardless of error.
		//
		if(errored) {
			pr.errors.push(methId);
			if(rejOnError) {
				$this.$n.reject();
			}
			run("or");
		} else {
			run("then");
		}

		run("always");

		if(!pr.resolved) {

			//	This array follows completion order.
			//
			pr.results.push(result);

			//	This array follows the original call stack.
			//
			pr.orderedResults[methId] = result;

			//	When the number of results === the number of transaction instructions
			//	(the transaction stack) then we know the transaction is complete.
			//
			//	If the transaction has been rejected, then we also fire the done method.
			//
			if(!$this.$n.currTransaction && (pr.rejected || pr.results.length === pr.stack.length)) {

				pr.resolved	= true;
				cleanup();

				//	The developer can set a #end method to follow a #parallel
				//	method, which accepts a funtion to be called following completion
				//	of all transaction methods.  #end sets this value on $this.
				//
				if($.is(Function, $this.$n.onTransactionDone)) {
					$this.$n.onTransactionDone.call($origObj, transErrored, sanitizedResults());
				}
			}
		}
	};

	var pr 	= $this.resultInfo	= {
		resolved		: false,
		rejected		: false,
		errors			: [],
		stack			: [],
		results			: [],
		orderedResults	: [],
		timeouts		: [],
		firedTimeouts	: [],
		tries			: {},
		callbacks		: {}
	};

	//	#then, #or, #always, #until, #tries are tranaction promise methods.
	//	#then, #or, #always function identically, differing only by name (they are of course
	//	called for different reasons, but are simply accessors to identical types of lists).
	//
	//	@see	self#runPromiseMethods
	//
	var setPromiseMethod	= function(rmeth, f) {

		f	= $.is(Array, f) ? f : [f];

		var mid	= $this.$n.lastMethodId;
		var cbs = pr.callbacks[mid] = pr.callbacks[mid] || {};

		cbs[rmeth] = cbs[rmeth] || [];

		$.each(f, function(e) {
			cbs[rmeth].push({
				methodId	: mid,
				callback	: e
			});
		});

		if(pr.resolved) {
			runPromiseMethods(mid);
		}

		return $this;
	};

	//	Fired when a transaction methods succeeds.
	//
	//	@see	#runPromiseMethods
	//
	$this.then	= function(f) {
		return setPromiseMethod("then", f);
	};

	//	Fired when a transaction methods fails.
	//
	//	@see	#runPromiseMethods
	//
	$this.or		= function(f) {
		return setPromiseMethod("or", f);
	};

	//	Always runs, regardless of success or failure.
	//
	//	@see	#runPromiseMethods
	//
	$this.always	= function(f) {
		return setPromiseMethod("always", f);
	};

	//	A maximum runtime on a transaction method. If this transaction method does not
	//	resolve in #t time, the transaction is rejected and #f is executed, being passed
	//	whatever results have been accumulated up to this point.
	//
	//	@param		{Number}		t		Timeout, in milliseconds.
	//	@param		{Function}		f		Callback should this fire.
	//
	$this.until = function(t, f) {

		var mid	= $this.$n.lastMethodId;

		if($.is("numeric", t)) {
			pr.timeouts[mid] = $this.$wait(t, function() {
				pr.firedTimeouts.push(mid);
				$this.$n.reject();
				f && f.call($origObj, sanitizedResults());
			});
		}

		return $this;
	};

	//	Request that promise fulfillment be attempted #n times (in case of error).
	//	Note that this is #n times *in addition to* to original attempt.
	//	Upon failure of all tries execution proceeds normally (as if there had been
	//	a failure, with no implications due to additional tries).
	//
	$this.tries	= function(n) {
		pr.tries[$this.$n.lastMethodId] = n || void 0;
		return $this;
	};

	//	The total time a transaction may exist for prior to being rejected.
	//	NOTE that #until timeouts which are longer than this timeout are cancelled once
	//	this timeout is fired (their callbacks are not called).
	//
	$this.$n.setTransactionTimeout = function(f, timer) {

		//	We're setting a timeout for the entire transaction -- if this flag falls
		//	the transaction methods stop processing.  Cancel any method timeouts which
		//	are sheduled later than this transaction's timeout.
		//
		cancelMethodTimeouts(function() {
			return this.time() >= timer;
		});

		transactionTimeout = $this.$wait(timer, function() {

			console.log("+++++++++++++++++++++++++++++++++++++++++++++HAS TRANS TIMEOUT");

			pr.firedTimeouts.push("transaction");
			$this.$n.reject();
			f && f.call($origObj, false, sanitizedResults());
		});
	};

	//	This is the "public" method which is executed by transaction methods when they
	//	want to resolve their promise.  It is bound in #extend.
	//
	//	@see	#extend
	//
	$this.$n.resolve	= function(err, res, methId, methName) {
console.log("RESOLVING");
		//	If we're in an error state, and this transaction method has asked for
		//	retries (#tries), and there are some left, handle those.
		//
		var tries = pr.tries[methId];
		if(!!err && tries !== void 0 && tries > 0) {
			pr.tries[methId]--;

			$.each(pr.stack, function(e) {
				if(e.methodId === methId) {
					e.context[e.methodName].apply(e.context, e.args);
				}
			});

			return;
		}

		errored 		= !!err;
		transErrored	= transErrored || errored;

		//  Enforces async behavior. Not all methods in a transaction are async. As such they
		//	will resolve immediately --> prior to the transaction being fully assembled (prior
		//	to reaching #end).
		//
		res = $.copy(res);
		$.nextTick(function() {
			runPromiseMethods(methId, methName, res);
		});
	};

	//	To reject a transaction is to kill all resolvers and timeouts.
	//	This will kill all further action on this transaction.
	//
	//	@see	#end
	//
	$this.$n.reject	= function() {
		console.log("REJECTED");
		cleanup();
		pr.rejected	= true;
	}

	//	By giving #currTransaction a value we flag that we are in transaction.  Further
	//	#extend-ed method calls will be extensible (as promises) within this transaction.
	//
	$this.$n.currTransaction	= $.nextId();

	return $this;
});

//	##serial
//
//	Serial transactions.
//
//	@see	#parallel
//
$.hoist("serial", function(options) {
	var t = this.$parallel(options);
	t.$n.serialTransaction = true;

	return t;
});

//	##end
//
//	Terminates transaction groups initiated by #parallel and #serial.
//
//	If you would like a callback to run when this transaction is finished, pass as the
//	first argument to this method.  This callback receives two argument:
//
//	1.	Whether or not the transaction errored.
//	2.	The current result set (array) for the transaction.
//
//	You may set a timeout for the transaction by passing a numeric value (in milliseconds)
//	as the first parameter of this method, followed by the callback.
//
//	@param	{Mixed}		[a]		Either a timeout value in ms, or a callback function.
//	@param	{Function}	[b]		Will be a function if a timout value has been passed.
//
//	@see	#parallel
//	@see	#serial
//
$.hoist("end", function(a, b) {

	var ns 		= this.$n;
	var f		= $.noop;
	var timer	= false;
	var $this	= this;

	//	NOTE: no checking is done. Either the first is a number, or it is assumed
	//	to be a function.  You'll error otherwise.  And maybe worse.
	//
	if($.is("numeric", a)) {
		timer 	= a;
		f		= b;
	} else {
		f 	= a;
	}

	ns.onTransactionDone = f;

	if(timer) {
		ns.setTransactionTimeout(f, timer);
	}

	//	There must be at least one promise resolver or any final callback will not
	//	resolve. This should be fixed. Minor.
	//
	this.then($.noop);

	//	Terminates further modifications of this transaction.
	//
	ns.currTransaction 	= false;

	//	If we entered a serial transaction, #serialTransaction will contain an array
	//	of transaction methods (they are not executed, but stored, until #end).
	//	Run those now.
	//
	if(ns.serialTransaction) {
		this.asyncEach(function(e, i, resultSet, cb) {

			var scope 	= e.context;
			var args	= e.args;

			var lastArg	= args[args.length -1];

			args[args.length -1] = function(err, res) {
				$this.sub(res);
				cb(err, res);
				lastArg.call(scope, err, res);
			}

			//	This is exactly like calling an extended method of Object.
			//
			scope[e.methodName].apply(scope, args);

		}, $.noop,  this.resultInfo.stack);
	}
});

$.advise(function(a) {
	var $this		= a.$this;
	var ns			= $this.$n;
	var methodName	= a.methodName;
	var methodId	= a.methodId;
	var args		= a.args || [];
	var lastArg		= args[args.length -1];
	var lastIsFunc	= $.is(Function, lastArg);
	var tailResolve = false;

	//	If #parallel or #serial has started a transaction
	//	update the transaction method's promise object, adding a resolver.
	//
	//	Non-serial transactions will simply execute the methods as normal,
	//	in parallel, and the terminal method, if any, will be called when
	//	they are all finished.
	//
	//	@see	#parallel
	//	@see	#serial
	//	@see	#promise
	//	@see 	#end
	//
	if(ns.currTransaction && methodName !== "end") {
		resolver	= function(err, res) {
			//	If we're in an active transactional state, resolve.
			//
			!$this.resultInfo.resolved && $this.$n.resolve(err, res, methodId, methodName);
		};

		//	Async methods usually have a callback as the final argument. They may
		//	be called within or without a transaction. If called within a transaction,
		//	these callbacks would need to be passed a #resolve method for them to
		//	call. Which means the developer would need to check if method is within
		//	a transaction and call callback + resolver if so.  In order to avoid that,
		//	we simply check if the last argument is a function and "curry" it such that
		//	the developer can assume that in a transaction #resolve will be called
		//	naturally, and can focus on simply calling the general callback.
		//
		//	Conversely, a method within a transaction may not be receiving a function
		//  as a final callback. The assumption is that the method is not asynchronous, or
		//  at least that eventual callbacks for the method are not relevant to the
		//  transaction envelope. Simply return resolver as a function -- when advice returns  
		//  a function that function will be called following method invocation (post-advice).
		//
		//  Failure may come if a method receives a function as final argument that is not
		//  a callback, or has the callback inserted somewhere else in the function
		//  signature. The second case can be dealt with by consistent interfaces. The first
		//  has no reasonable solution that I can see, other than the attempt made. Callbacks
		//  should follow this format: callbackF(error, result). If error is not a 
		//  Boolean, do not treat as a callback. Another consistency effort, which still
		//  does not solve all cases.
		//
		if(lastIsFunc) {
			args[args.length -1] = function(err) {
				var ta = $.argsToArray(arguments);
				if($.is(Boolean, err)) {
				    resolver.apply($this, ta);
				}
				return lastArg.apply($this, ta);
			}
		} else {
			tailResolve = function(r) {
			    resolver(false, r);
			    return r;
			};
		}

		//	Each transaction stores a stack of its methods.
		//
		//	@see	#parallel
		//
		$this.resultInfo.stack.push({
			methodName	: methodName,
			methodId	: methodId,
			args		: args,
			context		: $this
		});

		//	Serial transaction methods are not executed immediately (like parallel
		//	transactions are).  When #end is encountered the stored transaction stack
		//	will be run in parallel.
		//
		//	@see	#end
		//
		if(ns.serialTransaction) {
			return $this;
		}
		
		//  This will become post-advice.
		//
		return tailResolve;
	}
});

$.addKit("testing", {
	has	: function(credential, identifier, cb) {

		//	TODO: actually fetch/check credentials...
		//
		var cred 	= "`has` result";

		setTimeout(function() {
			cb(false, cred); // cb(true, cred) tests .tries()
		}, 1500);
	},

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

	"spic"		: function(a) {
		return "spic result > " + a;
	},

	"span"		: function(a) {
		return "span result > " + a;
	},

	"nick"		: function() {
		return "nick result";
	},

	"nack"		: function(a) {
		return "nack result";
	}

	
});

return $;

} // end module export / function
