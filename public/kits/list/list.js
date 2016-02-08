"use strict";

module.exports   = function(options) {

options = options || {};

var	$	= this;

//  The kit methods, with value being whether they are destructive (boolean).
//	(Whether they activate the #executeChangeBindings method on a model)
//
var LIST_M = {
    "bump" 			: 1,
    "commit" 		: 1,
    "compact" 		: 1,
    "compose" 		: 1,
    "contains" 		: 0,
    "destroy" 		: 1,
    "diff" 			: 1,
    "findFirst" 	: 0,
    "findLast" 		: 0,
    "first" 		: 1,
    "firstx" 		: 0,
    "flatten" 		: 0,
    "getAt" 		: 0,
    "group" 		: 0,
    "insert" 		: 1,
    "insertBefore" 	: 1,
    "insertAfter" 	: 1,
    "intersect" 	: 0,
    "invoke" 		: 1,
    "iterator" 		: 0,
    "last" 			: 1,
    "lastx" 		: 0,
    "max" 			: 0,
    "min" 			: 0,
   // "$original" 	: 1,
    "page" 			: 0,
    "paginate" 		: 0,
    "pluck" 		: 0,
    "range" 		: 0,
    "remove" 		: 1,
    "reset" 		: 1,
    "sequence" 		: 0,
    "setAt" 		: 1,
    "shuffle" 		: 1,
    "search" 		: 0,
    "size" 			: 0,
    "sortBy" 		: 1,
    "sortedIndex" 	: 0,
    "totalPages" 	: 0,
    "union" 		: 0,
    "unique" 		: 1,
  //  "$value" 		: 1,
  //  "$without" 	: 1,
    "zip" 			: 0
};

var ORIGINAL 	= [];
var ACTIVE		= [];

var PAGINATION	= 0;
var CUR_PAGE	= 1;

var	OP_TO_STRING	= Object.prototype.toString;
var AP_SLICE		= Array.prototype.slice;

var M_MIN   = Math.min;
var M_MAX   = Math.max;

//	This object will be sent to #addKit.
//
var $$ = {};

//	##ITERATOR
//
//	Returns accumulator as modified by passed selective function.
//	Note that no checking of target is done, expecting that you send either an
//	array or an object. Error otherwise. Also see notes on @acc, below.
//
//	@param		{Function}		fn		The selective function.
//	@param		{Object}		[targ]	The object to work against.
//	@param		{Mixed}			[acc]	An accumulator, which is set to result of selective
//										function on each interation through target.  If this
//                                      is undefined (void 0) this method returns the last
//                                      index reached.
//  @param      {Object}        [ctxt]  A context to run the iterator in.
//
var	ITERATOR	= function(fn, targ, acc, ctxt) {
	var c	= targ.length;
	var n	= 0;
	var idx = acc === void 0 ? true : false;

	if($.is(Array, targ)) {
		while(n < c) {
			acc = ctxt ? fn.call(ctxt, targ[n], n, targ, acc) : fn(targ[n], n, targ, acc);
			if(acc === true) {
			    break;
			}
			n++;
		}
	} else {
		for(n in targ) {
			acc = ctxt ? fn.call(ctxt, targ[n], n, targ, acc) : fn(targ[n], n, targ, acc);
			if(acc === true) {
			    break;
			}
		}
	}

	return idx ? n : acc;
};

//	##PROC_ARR_ARGS
//
//	Ensures that sent array members are each arrays. For each member:
//  If array, do nothing;
//  If string, check if exists ACTIVE[string], use if so;
//  Else, empty array ([]).
//
//  Note that the sent array reference itself is modified, so there is no return value.
//
//	@see	#union
//	@see	#intersect
//	@see	#diff
//
var PROC_ARR_ARGS = function(a) {
	var len = a.length;
	var c;
	while(len--) {
		c = a[len];
		a[len] = 	$.is(Array, c)
					? c
					: typeof c === "string" && ACTIVE[c]
						? ACTIVE[c]
						: [];
	}
};

//  ##SORTER
//
//  Creates reusable sort functions.
//
//  @see    #sortBy
//  @href   http://stackoverflow.com/questions/979256/how-to-sort-an-array-of-javascript-objects
//
var SORTER = $.$memoize(function(field, primer, descending) {
    var key = function(x) {
        return primer ? primer(x[field]) : x[field];
    };

    return function(a,b) {
       var left = key(a);
       var right = key(b);
       //   [-1,1][+!!reverse] : Cast truth value of #descending(!!) to a number(+) which
       //   will be (f || t) <- (0 || 1) <- [-1,1]. This function is intended as an
       //   Array.sort argument, which sorts based on what its sort method returns:
       //   -1  : left < right
       //   1   : left > right
       //   0   : left == right
       //   Normally sorted ascending. By passing #descending, we multiply by -1,
       //   inverting above table.
       //
       return ((left < right) ? -1 : (left > right) ? 1 : 0) * [1,-1][+!!descending];
    }
});

//  ##LIST_METHOD
//
//	These list methods only return a value if their operation is non-destructive.
//	The current operating list is passed by reference, and as such does not need
//	to be returned.
//
var LIST_METHOD = {

    //  ##bump
    //
    //  Replace #original at #key with a new list.
    //  Returns bumped #original.
    //
    bump    : function(cur, a, len, key) {
        var o = ORIGINAL[key];
        if(ORIGINAL[key] && $.is(Array, cur)) {
            ORIGINAL[key] = cur;
        }
        return o;
    },

    //  ##compact
    //
    //  Removes all falsy values from list: false, null, 0, "", undefined, NaN.
    //
    compact : function(cur, a, len) {
        while(len--) {
            if(!cur[len]) {
                cur.splice(len, 1);
            }
        }
        return cur;
    },

    //  ##commit
    //
    //	Will replace the #original list with the current #active list.
    //  Returns previous #original.
    //
    commit	: function(cur, a, len, key) {
        var o = ORIGINAL[key];
    	ORIGINAL[key] = $.copy(ACTIVE[key]);
    	return a;
    },

    //  ##compose
    //
    //  Returns the composed result of a list of functions processed tail to head.
    //  Expects a single argument, which is the value to pass to the tail function.
    //  NOTE that no checking is done of list member types. If any member is not a
    //  function this will error.
    //
    compose		: function(cur, a, len) {
    	var last = a;
    	while(len--) {
    		last = cur[len].apply(this, last);
    	}

    	return last;
    },

    //  ##contains
    //
    //  Whether sent value exists in list
    //
    contains    : function(cur, a, len) {
        return this.$search(cur, a[0]) !== -1;
    },

	//	##diff
	//
	//	Difference between first list (#prime) and subsequent lists (members of #prime
	//	list which do not exist in any other list). NOTE: all duplicate entries in the
	//  #prime array are reduced to single entries, regardless of differences.
	//
	//	@return	{Array}
	//
    diff   : function(cur, a, len) {

        var prime 	= $.$arrayToObject(cur);
        var si;
        var m;

        PROC_ARR_ARGS(a);

        while(m = a.shift()) {
            si	= m.length;
            while(si--) {
                if(prime[m[si]] !== void 0) {
                	delete prime[m[si]];
                }
            }
        }

        return $.$objectToArray(prime);
    },

    //  ##findFirst
    //
    //  Returns the first value matching iterator.
    //
    findFirst    : function(cur, a) {
        return cur[ITERATOR(a[0], cur)];
    },

    //  ##findLast
    //
    //  Returns the last value matching iterator.
    //
    findLast    : function(cur, a) {
        var c = $.copy(cur).reverse();
        return c[ITERATOR(a[0], c)];
    },

    //  ##first
    //
    //  Regarding the first item, either fetch it by sending zero arguments,
    //  or set it by sending a single item value. If the list does not
    //  exist, a new list will be created.
    //
    first   : function(cur, a) {
    	var c = a.length;
        if(c) {
        	while(c--) {
        		cur.unshift(a[c]);
        	}
        } else {
        	return cur.slice(0,1);
        }

        return cur;
    },

    //  ##firstx
    //
    //  Regarding the first item, either fetch it by sending zero arguments,
    //  or set it by sending a single item value.
    //
    //  Unlike #first, #firstx will *not* create a list if one does not exist.
    //
    firstx  : function(cur, a) {
        return cur ? this.$first(cur, a) : null;
    },

    //  ##flatten
    //
    //  Reduces an array of nested arrays to a single depth.
    //
    //  @example    : #flatten(['frank', ['bob', 'lisa'], ['jill', ['tom', 'sally']]])
    //              : ["sally", "tom", "jill", "lisa", "bob", "frank"]
    //
    flatten     : function(cur, a, len, key) {
        var r = [];
        var c;
        var f = function(a) {
            var i = a.length;
            while(i--) {
                if(typeof a[i] === "object") {
                    f(a[i])
                } else {
                    r[r.length] = a[i];
                }
            }
            return r;
        }

        c = f(cur);
        if(key) {
            ACTIVE[key] = c;
        }
        return c;
    },

    //  ##getAt
    //
    //  Return item at sent index.
    //
    //  Indexes can be positive or negative, and are zero based.
    //  `0` is first item, `1` is second, `-1` is last, `-2` is penultimate.
    //
    //  @argumentList
    //      [0]: {Number}   The index.
    //
    getAt	: function(cur, a, len) {
        return cur[a[0] >= 0 ? a[0] : len + a[0]];
    },

    //  ##group
    //
    //  Returns a grouping of list members based on results of passed iterator method.
    //
    //  @argumentList
    //      0       : {Mixed}     Either an iterator function, or a string property.
    //      [1]     : {Object}    A scope to execute iterator within.
    //
    //  @example    #group([1.3, 2.1, 2.4], function(num){ return Math.floor(num); }))
    //                  { 1: [1.3], 2: [2.1, 2.4]}
    //              #group(['one', 'two', 'three'], "length")
    //                  { 3: ["one", "two"], 5: ["three"] }
    //
    group   : function(cur, a, len) {
        var i = a[0]
        var f = $.is(String, i) ? function(elem) {
            return elem[i];
        } : i;
        return ITERATOR(function(elem, idx, targ, acc) {
            var r = f.call(this, elem, idx, targ);
            (acc[r] || (acc[r] = [])).push(elem);
            return acc;
        }, cur, {}, a[1]);
    },

    //  ##insert
    //
    //  Insert item before or after another item value.
    //
    //  @argumentList
    //      0:  {String}    One of "before" or "after".
    //      1:  {Mixed}     The pivot value.
    //      n:  {Mixed}     Any number of arguments (items) to be inserted
    //                      before or after given pivot value.
    //
    insert  : function(cur, a, len) {
        var ins = a.slice(2);
        var piv = 1;

        while(len--) {
            if(cur[len] === a[1]) {

                if(a[0] == "before") {
                    piv = -piv;
                }

                [].splice.apply(cur, [len + piv, 0].concat(ins));
                break;
            }
        }

        return cur;
    },

    //  ##insertBefore
    //
    //  Shortcut to #insert("before", ...);
    //
    insertBefore    : function(cur, a, len) {
        return this.$insert(cur, "before", a[0]);
    },

    //  ##insertAfter
    //
    //  Shortcut to #insert("after", ...);
    //
    insertAfter     : function(cur, a, len) {
        return this.$insert(cur, "after", a[0]);
    },

	//	##intersect
	//
	//	Intersection of all lists (members which exist in all lists).
	//
	//	@return	{Array}
	//
    intersect   : function(cur, a, len) {

        var aLength = a.push(cur);
        var map     = {};
        var res     = [];
        var m;
        var si;
        var c;

		PROC_ARR_ARGS(a);

        while(m = a.shift()) {
            si 	= m.length;
            while(si--) {
            	c = map[m[si]];
                ((map[m[si]] = c ? c += 1 : 1) === aLength) && (res[res.length] = m[si]);
            }
        }

        return res;
    },

    //  ##invoke
    //
    //  Executes named method on list, passing named method any additional arguments
    //  passed to #invoke.
    //
    invoke  : function(cur, a, len) {
        var m = this[a.shift()];
        while(len--) {
            cur[len] = m.apply(this, [cur[len]].concat(a)).$;
        }
        return cur;
    },

    //  ##iterator
    //
    //	Create a basic iterator for a list.
    //
    //	To fetch iterator for #ACTIVE list, send no arguments.
    //	To fetch iterator for #ORIGINAL list, send argument {String} "original".
    //	To fetch iterator for any given array, send nothing, not even a key.
    //
    iterator	: function(cur, a, len, key) {

    	return new function() {
    		var list = 	$.copy(	$.is(Array, key)
							? key
							: a[0] === "original"
								? ORIGINAL[key]
								: ACTIVE[key], 1);

    		this.idx		= -1;
    		this.moveIdx	= function(d, circ) {
    			var i	= this.idx + d;
    			var len = list.length -1;

				// 	If the operation exceeds list bound and the #circ(ular) directive
				//	was not sent, the result of the operation is `undefined`.
				//
    			if(!circ && (d === -1 ? i < 0 : i > len)) {
    				return void 0;
    			}

    			this.idx =	i < 0
							? len
							: i > len
								? 0
								: i;
				return this.idx;
    		};
    		this.next	= function(circ) {
    			return list[this.moveIdx(1, circ)];
    		};
    		this.prev	= function(circ) {
    			return list[this.moveIdx(-1, circ)];
    		};
    		this.nextIndex	= function() {
    			return this.moveIdx(1);
    		};
    		this.prevIndex	= function() {
    			return this.moveIdx(-1);
    		};
    		this.hasNext	= function() {
    			return !((this.idx + 1) === list.length)
    		};
    		this.hasPrev	= function() {
    			return !((this.idx - 1) === 0)
    		};
    		this.remove		= function() {
    			var s = list.splice(this.idx, 1);
    			if(list.length === this.idx) {
    				this.prev();
    			}
    			return s;
    		};
    		this.set	= function() {
    			list[this.idx] = key;
    			return a[0];
    		}
    	};
    },

    //  ##last
    //
    //  Regarding the last item, either fetch it by sending zero arguments,
    //  or set it by sending a single item value. If the list does not
    //  exist, a new list will be created.
    //
    last     : function(cur, a, len) {
    	var c 	= a.length;
    	var i	= 0;
        if(c) {
        	for(; i < c; i++) {
        		cur[cur.length] = a[i];
        	}
        } else {
        	return cur.slice(len -2, 1);
        }

        return cur;
    },

    //  ##lastx
    //
    //  Regarding the last item, either fetch it by sending zero arguments,
    //  or set it by sending a single item value. If the list does not
    //  exist, a new list will be created.
    //
    //  Unlike #last, #lastx will *not* create a list if one does not exist.
    //
    lastx   : function(cur, a) {
        return cur ? this.$last(cur, a) : null;
    },

    //  ##max
    //
    //  Returns the maximum value in list.
    //
    //  Arguments:
    //      0:  {Function}      [it]     An iterator
    //      1:  {Object}        [scp]    Scope to run iterator in.
    //(fn, targ, acc, ctxt)
    max : function(cur, a) {
        return a[0] ? ITERATOR(a[0], cur, -Infinity, a[1])
                    : M_MAX.apply(Math, cur);
    },

    //  ##min
    //
    //  Returns the minimum value in list.
    //
    //  Arguments:
    //      0:  {Function}      [it]     An iterator
    //      1:  {Object}        [scp]    Scope to run iterator in.
    //
    min : function(cur, a) {
        return a[0] ? ITERATOR(a[0], cur, Infinity, a[1])
                    : M_MIN.apply(Math, cur);
    },

    //  ##paginate
    //
    //  Set the page width.
    //
    //  @see    #page
    //  @see    #totalPages
    //
    paginate	: function(cur, a, len) {
    	PAGINATION = M_MAX(0, a[0]);
    },

	//	##page
	//
	//	Returns the requested page array if #a is set, or the current page # if not.
	//
	//  @argumentList
	//      [0]     : {Number}  Page index. Returns page at page index. If undefined, returns
	//                          the current page index.
	//
	//	@example	#page(3)    // ["foo","bar","baz"]
	//              #page()     // 3
	//
	//  @see    #paginate
	//  @see    #totalPages
	//
    page	: function(cur, a, len) {

    	var p 		= a[0];
    	var pages 	= Math.ceil((len -1) / PAGINATION);
    	var start;
    	var end;

		//	If #p is positive or negative the request is for a page array so run block.
		//	If undefined, requesting #CUR_PAGE. Skip.
		//	If 0(zero), treat like undefined.
		//
    	if(p) {
			if(p < 0) {
				p = M_MAX(pages + p +1, 1);
			} else {
				p = M_MIN(p, pages);
			}

			start 	= M_MIN((p-1) * PAGINATION, len);
			end		= M_MIN(start + PAGINATION, len);

			CUR_PAGE = p;
			return cur.slice(start, end);
    	}
    	return CUR_PAGE;
    },

    //  ##pluck
    //
    //  Given a list of objects, will return a list of the values at given
    //  index in each object.
    //
    //  @example    .pluck([    {user: 'tom', state: 'NY'},
    //                          {user: 'dick', state: 'NJ'},
    //                          {user: 'harry', state: 'ND'}], "state");
    //              // ['NY','NJ','ND']
    //
    pluck   : function(cur, a, len) {
        var p = a[0];
        var r = [];
        var i = 0;
        var c;
        while(i < len) {
            c = cur[i];
            if(typeof c === "object") {
                r[r.length] = c[p];
            }
            i++
        }

        return r;
    },

    //  ##range
    //
    //  Returns a range of elements.
    //
    //  Indexes can be positive or negative, and are zero based.
    //  `0` is first item, `1` is second, `-1` is last, `-2` is penultimate.
    //  NOTE: There is no range checking done.
    //
    //  @argumentList
    //      [0]:    {Number}    Start index. If no arguments are sent, the entire
    //                          array is returned.
    //      [1]:    {Number}    End index. If none sent, range is start->end.
    //
    range   : function(cur, a, len) {
    	var v 	= [	a[0] >= 0
    				? a[0]
    				: len + a[0] ,
    				a[1]
    				? a[1] >= 0
    					? a[1]
    					: len + a[1]
    				: len].sort();

        return cur.slice(v[0], v[1]);
    },

    //  ##remove
    //
    //  Removes #c(ount) members of list === #v(alue).
    //  #c > 0: moving from head to tail.
    //  #c < 0: moving from tail to head.
    //  #c = 0: Remove all.
    //
    //  Arguments
    //      0:  {Number}    #c  The number of instances of #v to remove
    //      1:  {Mixed}     #v  The value to remove
    //
    remove  : function(cur, a, len) {
        var max     = a[0] === 0 ? len : Math.abs(a[0]);
        var pos     = a[0] > 0;
        var hits    = [];
        var hLen    = 0;
        var cLen    = len;

        while(cLen--) {
            if(cur[cLen] === a[1]) {
                hLen = hits.push(cLen);
                if(!pos && hLen === max) {
                    break;
                }
            }
        }

        //  Sort and truncate. If negative (from right), there will be no effect,
        //  as the length of hits is controlled in above loop. If positive (or zero)
        //  will be sorted smaller->larger, and truncated to #max length.
        //
        hits.sort();
        hLen 		= M_MIN(hits.length, max);
        hits.length = hLen;

        while(hLen--) {
            cur.splice(hits[hLen], 1);
        }

        return cur;
    },

    //  ##reset
    //
    //	Will replace the #active list with the #original list.
    //  Returns last #active.
    //
    reset	: function(cur, a, len, key) {
        var a = ACTIVE[key];
    	ACTIVE[key] = $.copy(ORIGINAL[key]);
    	return a;
    },

    //  ##sequence
    //
    //  Returns the composed result of a list of functions processed head to tail.
    //  Expects a single argument, which is the value to pass to the head function.
    //  NOTE that no checking is done of list member types. If any member is not a
    //  function this will error.
    //
    sequence	: function(cur, a, len) {
    	var last    = a;
    	var i       = 0
    	while(i < len) {
    		last = cur[len].apply(this, last);
    		i++;
    	}

    	return last;
    },

    //  ##setAt
    //
    //  Set item at sent index.
    //
    //  Indexes can be positive or negative, and are zero based.
    //  `0` is first item, `1` is second, `-1` is last, `-2` is penultimate.
    //  NOTE: There is no range checking done.
    //
    //  @argumentList
    //      0: {Number}     The index.
    //      1: {Mixed}      The value to set
    //
    setAt  	: function(cur, a, len) {
        return (cur[a[0] >= 0 ? a[0] : len + a[0]] = a[1]);
    },

    //  ##size
    //
    //  Returns the length of the list
    //
    size   	: function(cur, a, len) {
        return len;
    },

    //  ##shuffle
    //
    //	Shuffle a list randomly.
    //
    //	Implements Fisher-Yates algorithm.
    //	@see	http://en.wikipedia.org/wiki/Fisher%E2%80%93Yates_shuffle
    //
    shuffle		: function(cur, a, len) {
		var s;
		var r;

		while(len) {
			// Select one of the remaining and swap with current.
			//
			r = Math.floor(Math.random() * (len - 1));
			s = cur[--len];
			cur[len] = cur[r];
			cur[r] = s;
		}

		return cur;
    },

    //  ##search
    //
    //  Binary search on a sorted array (NOTE: *sorted*).
    //  Use to fetch either the index of a value, or the index where the value should be
    //  inserted in order to keep the array ordered.
    //
    //  @argumentList
    //      0   : {Mixed}   The value to search for.  You may also pass an iterator function,
    //                      whose return value will then determine sort ranking.
    //      [1] : {Boolean} Whether to return the sorted index.
    //
    //  @href   http://jsfromhell.com/array/search
    //
    search : function(cur, a, len) {
        var low = -1;
        var v   = a[0];
        var i   = a[1];
        var mid;
        while(len - low > 1) {
            if(cur[mid = len + low >> 1] < v) {
                low = mid;
            } else {
                len = mid;
            }
        }
        return cur[len] != v ? i ? len : -1 : len;
    },

    //  ##sortBy
    //
    //  Sorts an array
    //
    //  @argumentsList
    //      0   : field
    //      1   : primer
    //      2   : descending
    //
    sortBy  : function(cur, a) {
        if($.is(Function, a[1])) {
            return cur.sort(SORTER(a[0], a[1], a[2]));
        }

        return cur.sort(SORTER(a[0], false, a[1]));
    },

    //  ##sortedIndex
    //
    //  Shortcut for #search(val, true), which returns sorted index.
    //
    sortedIndex : function(cur, a, len) {
        return this.$search(cur, a[0], true);
    },

    //  ##totalPages
    //
    //  The total number of pages in the current list.
    //
    //  @see    #paginate
    //
    totalPages	: function(cur, a, len) {
    	return Math.ceil(len / PAGINATION);
    },

    //  ##unique
    //
    //	Unique-ifys the #active list.
    //
    unique  	: function(cur, a, len) {
		var map = {};
		var c;
		while(len--) {
			c = map[cur[len]];
			((map[cur[len]] === c ? c += 1 : 1) > 1) && cur.splice(len, 1);
		}

		return cur;
    },

	//	##union
	//
	//	Union of all lists (add unique members of all lists).
	//
	//	@return	{Array}
	//
    union  : function(cur, a, len) {

        var map	= {};
        var si;
        var m;

		a[a.length] = cur;
		PROC_ARR_ARGS(a);

        while(m = a.shift()) {
            si	= m.length;
            while(si--) {
            	map[m[si]] = 1;
            }
        }

		return $.$objectToArray(map);
    },

    //  ##destroy
    //
    //	Will remove a key (a list) entirely, returning an object containing
    //  list's last #active and last #original
    //
    destroy	: function(cur, a, len, key) {
        var r = {
            active      : ACTIVE[key],
            original    : ORIGINAL[key]
        }

        delete ACTIVE[key];
    	delete ORIGINAL[key];

    	return r;
    },

    //  ##zip
    //
    //  Take any number of input arrays and returns an array where corresponding elements
    //  in input arrays are merged. The length of the returned array equals the maximum length
    //  found in the input arrays.
    //
    //  @argumentList:
    //      0..n    : {Array}   Any number of arrays.
    //
    //  @example    .zip(   ["Barack", "James", "John"],
    //                      ["Hussein", "Earl", "Fitzgerald"],
    //                      ["Obama", "Carter", "Kennedy"] );
    //              [   ["Barack", "Hussein", "Obama"],
    //                  ["James", "Earl", "Carter", "Bush"], <-- note useless member(4)
    //                  ["John", "Fitzgerald", "Kennedy"],
    //                  [undefined, undefined, undefined, "Bush"]];
    //
    zip : function(cur, a, len) {

        a.unshift(cur);

        var cL  = this.$max(this.$pluck(a, "length"));
        var r   = [];

        while(cL--) {
            r[cL]   = this.$pluck(a, cL);
        }

       return r;
    }
}

//  Attach list methods.
//
for(var p in LIST_M) {
    (function(m) {
        $$[m] = function(key) {
            var a   	= $.argsToArray(arguments, 1);
            var cur 	= ACTIVE[key];
            var initial	= false;
            var result;
			var binding;

            //  There is no value set.
            //
            if(!cur) {
                if($.is(Array, key)) {
                    cur = key;
                    key = null;

                //	If the key is a path in the Object binding, and that path resolves
                //	to an array, use that.
                //
                } else if($.is(String, key) && $.is(Array, (cur = this.$get(key)))) {
                    binding = true;

				//	#first and #last will create a list if it doesn't exist.
				//
                } else if(a[0] !== void 0 && (m == "first" || m == "last")) {
                    cur = ACTIVE[key] = [];
                    initial = true;
                } else if(m === "iterator") {
                    cur = [];
                } else {
                    return null;
                }
            }

            //	Run transformation on #active list.
            //
            result = LIST_METHOD[m].call(this, cur, a, cur.length, key);

            //	If first list operation on this key, store *copy* of #active.  NOTE that the
            //	copy is shallow, which means that objects are not copied. Being in a list
            //	doesn't insulate list members from external access which may, or may not, be
            //	what you want.
            //
            if(initial) {
                ORIGINAL[key] = $.copy(cur, 1);
            }

			//	If we've performed an operation on a model, execute any bindings.
			//	This guarantees the same behavior as directly #set-ting on a model.
			//
            if(binding && LIST_M[m]) {
            	this.executeChangeBindings(key, a.length > 1 ? a : a[0]);
            }

            //  Return any truthy values.
            //  Return `false` or `0` as those are valid results.
            //  If otherwise falsy, return null.
            //
            return (result === false || result === 0) ? result : result || null;
        };
    })(p);
}

$.addKit("list", $$);

return $.list;

};