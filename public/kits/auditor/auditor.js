"use strict";

module.exports = function(options) {

options	= options || {};

var	$ = this;

var AUDITORS = [];

//	##audit
//
//	Executes a function until said function returns false.  This means your function
//	needs to return true if it wants to remain on the audit list.
//
//	@param		{Function}		fn		The function to execute.
//	@param		{Object}		[op]	Options:
//
//		{String}	id			An id for the function. Useful if you want
//								to remove it "by hand".  Default is
//								the result of #uuid.
//
//		{Number}	maxTime		The maximum number of (milliseconds) to live.
//								Expiration consequence identical to returning false.
//
//		{Number}	maxCycles	The maximum number of executions of function.
//								Expiration consequence identical to returning false.
//
//		{Function}	onComplete	Executes whenever `false` is returned. Passed any
//								error conditions.
//
var audit = function(fn, op) {

   	op	=	op || {};

   	var t		= new Date().getTime();
   	var $this	= this;

   	op.id 			= op.id	|| $.uuid();
   	op.startTime 	= t;
   	op.currentTime 	= t;
   	op.lastTime 	= t;
   	op.totalTime 	= 0;
   	op.maxTime		= op.maxTime || false;
   	op.cycles 		= 0;
   	op.maxCycles 	= op.maxCycles || false;
   	op.main 		= fn;

   	op.abort		= function(f) {
   		$.each($.$filter(AUDITORS, f), function(e) {
   			e.main = function() { return false; }
   		});
   	};

   	op.onComplete	= op.onComplete || $.noop;

   	//	Create the execution context. If there is more than one item in #AUDITORS, a loop
   	//	is already running, so only start it if we've added a lonely member.
   	//
   	if(AUDITORS.push(op) === 1) {

		//	Audit. If the stack hasn't cleared, queue another run. This continues
		//	until the stack clears (which may be never. It is up to you if such
		//	a continuous performance hit is acceptable).
		//
		//	@see	#audit
		//	@see	#hasAuditor
		//
		(function _a() {
			var n 	= AUDITORS.length;
			var t 	= new Date().getTime();
			var c;
			var r;
			var mt;
			var mc;

			while(n--) {

				c = AUDITORS[n];

				c.cycles++;
				c.lastTime 		= c.currentTime;
				c.currentTime  	= t;
				c.totalTime		= c.currentTime - c.startTime;

				r 	= !!c.main(c);
				mt	= (c.maxTime && c.maxTime <= c.totalTime);
				mc	= (c.maxCycles && c.maxCycles <= c.cycles);

				//	This is the active bit.  We check if death conditions have arrived for
				//	this auditor. Most commonly such condition will be triggered if the
				//	auditor returns anything non truthy. As well, if the auditor had limits
				// 	place on it (max count, max time), those will flag if reached.  If a death
				//	condition, remove auditor.
				//
				if(mt || mc || !r) {
					c.onComplete.call($this, {
						lastResult	: r,
						timedOut	: mt,
						cycledOut	: mc,
						auditor		: c
					}, AUDITORS.splice(n, 1));
				}
			}

			if(AUDITORS.length) {
				setTimeout(_a, 1);
			}
		})();
	}
};

//	##find
//
//	Returns all auditors against which the selective function returns true.
//
//	@param		{Function}		f		The selective function.
//
//	@see		#audit
//
var find = function(f) {
	return $.$filter(AUDITORS, f);
};

$.addKit("auditor", {
	audit	: audit,
	find	: find
});

return $.auditor;

};