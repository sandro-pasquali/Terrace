"use strict";

module.exports = function(options) {

options = options || {};

var	$	= this;
var $j	= jQuery;

/*
 * jquery.Sexy v0.8.0
 * http://sexyjs.com/
 *
 * Copyright 2010, Dave Furfero
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://sexyjs.com/license
 */

var loc         = window.location,
  HOST        = loc.protocol + '//' + loc.hostname + (loc.port !== '' ? ':' + loc.port : ''),
  RESULT_DATA = '__',
  dataTypes   = ['html', 'json', 'jsonp', 'script', 'style', 'text', 'xml'],
  i, n;

var cached = {};

/**
* Implicit callbacks
*/
function passData (data) {
return data;
}

function passPrevious (data, previous) {
return previous;
}

function couple (data, previous) {
return (previous || '') + data;
}

/**
* Constructs a new Sexy instance
*/
function Sexy (cfg) {

/**
 * Allow instantiation without new keyword
 */
if (!(this instanceof Sexy)) {
  return new Sexy(cfg);
}

this.cfgs = [];
this.setup(cfg);
}

Sexy.prototype = {

setup: function (cfg) {
  this.cfg = cfg || {};
  return this;
},

sajax: function (cfg) {

  var cfgs     = this.cfgs;
  var uid      = cfgs.length;
  var prev     = cfgs[uid - 1];
  var realType = cfg.dataType;
  var remote   = cfg.url.indexOf('http') === 0 && cfg.url.indexOf(HOST) === -1;
  var isScript = realType === 'script';
  var isStyle  = realType === 'style';
  var defer    = uid > 0 ? remote && (isScript || isStyle) ? true : cfg.defer : false;
  var success  = cfg.success || (isScript || isStyle ? passPrevious : passData);
  var error    = cfg.error || this.cfg.error || $j.ajaxSettings.error || $j.noop;
  var complete = cfg.complete ||  this.cfg.complete || $j.ajaxSettings.complete || $j.noop;

	//	Don't reload existing stylesheets
	//
	if(isStyle) {
		var exi = document.getElementById(cfg.url);
		if(exi) {
			return success(exi)
		}
	}

  cfgs.push($j.extend(true, cfg, this.cfg, cfg, {

    sendAfterSend: [],

    /**
     * Retrieve script and style data types as text for deferred
     * evaluation to guarantee ordering. Scripts and styles are inserted
     * into the DOM immediately before the success callback is fired.
     */
    dataType: (!remote && isScript || isStyle) ? 'text' : realType,

    /**
     * Wrap the user-configured success callback with an
     * event-driven handler.
     */
    success: function (data, status) {
		
		//	Stylesheets are cached "on the page". See relevant code above and below.
		//
		if(!isStyle) {
			cached[cfg.url] = data;
		}

      /**
       * If the request is first or the previous request has completed,
       * evaluate the response data (if necessary) and execute the success
       * callback.
       */
      if (!prev || RESULT_DATA in prev) {

        /**
         * Evaluate (local) script and style dataTypes.
         */
        if (isScript && !remote) {
          $j.globalEval(data);
        } else if (isStyle && !remote) {
			data = $j.styleEval(data, cfg);  
			
			//	Give the stylesheet an id. If a further attempt is made to load this
			//	existing stylesheet, it will be ignored. See head of this function.
			//
			$j(data).attr("id", cfg.url);
        }

        /**
         * Normalize the status argument for remote dataTypes which use
         * non-XHR techniques for loading.
         */
        cfg.status = remote ? 'success' : status;

        /**
         * Execute the original success callback, passing the response
         * data, the return value of the previous success callback, the
         * next configuration object, and the success status.
         */
        cfg[RESULT_DATA] = success.call(cfg, data, prev && prev[RESULT_DATA], cfgs[uid + 1], cfg.status);

        /**
         * If the next request completed before this one, fire it's
         * success callback.
         */
        if (cfg.nextSuccess) {
          cfg.nextSuccess();

        /**
         * If the next request is deferred, trigger it's send method.
         */
        } else if (cfg.sendAfterSuccess) {
          cfg.sendAfterSuccess();
        }

      /**
       * If the previous request has not yet completed, bind the success
       * callback to its response arguments and attach it to the
       * nextSuccess event of the previous request.
       */
      } else {
        prev.nextSuccess = $j.proxy(function () {
          cfg.success(data, status);
        }, cfg);
      }

    },

    error: function (xhr, status, e) {
      error.call(cfg, xhr, status, e);
    },

    complete: function (xhr, status) {
      complete.call(cfg, xhr, status);
    }
  }));

  function send () {

    var i, n;

	if(cached[cfg.url]) {
		console.log("cached: " + cfg.url);
		cfg.success.call(null, cached[cfg.url], "success");
		return;
	}

    if (isStyle && remote) {
      $j.getCSS(cfg.url, cfg.success);
    } else {

      $j.ajax(cfg);
    }

    if (cfg.sendAfterSend.length > 0) {
      for (i = 0, n = cfg.sendAfterSend.length; i < n; ++i) {
        cfg.sendAfterSend[i]();
      }
    }
  }

  /**
   * Since requests for remote scripts and styles use direct DOM insertion
   * (via <script> and <link> tags) and execute immediatele, we defer the
   * request until after the successful response of the previous request.
   */
  if (defer) {
    prev.sendAfterSuccess = send;
    this.lastDefer = cfg;
  } else if (this.lastDefer) {
    this.lastDefer.sendAfterSend.push(send);
  } else {
    send();
  }

  return this;
},

bundle: function (/* url, url2, ..., fn */) {

  var args = arguments,
      fn   = $j.isFunction(args[args.length - 1]) ? Array.prototype.pop.call(args) : passPrevious,
      i, n;

  for (i = 0, n = args.length - 1; i < n; ++i) {
    this.text(args[i], couple);
  }

  return this.text(args[i], function (data, previous, next, status) {
    var src = couple(data, previous);
    $j.globalEval(src);
    return fn(src, previous, next, status);
  });
}

};

/**
* Add sexy convenience methods
*/
function addDataTypeMethod (dataType) {
Sexy.prototype[dataType] = function (cfg, defer, success) {

  if (typeof cfg === 'string') {

    if (typeof defer !== 'boolean') {
      success = defer;
      defer   = false;
    }

    cfg = {
      url:     cfg,
      defer:   defer,
      success: success
    };
  }

  cfg.dataType = dataType;

  return this.sajax(cfg);
};
}

for (i = 0, n = dataTypes.length; i < n; ++i) {
addDataTypeMethod(dataTypes[i]);
}

Sexy.prototype.js  = Sexy.prototype.script;
Sexy.prototype.css = Sexy.prototype.style;

/**
* Add sexier static methods
*/
function addStaticMethod (method) {
Sexy[method] = function () {
  return Sexy.prototype[method].apply(new Sexy(), arguments);
};
}

for (i in Sexy.prototype) {
addStaticMethod(i);
}

$j.sajax = Sexy;

/*
* $j.styleEval plugin
* http://github.com/furf/$j-styleEval
*
* Copyright 2010, Dave Furfero
* Dual licensed under the MIT or GPL Version 2 licenses.
*
*	NOTE: This has been modified to *only* handle local css files, as well
* 	as a new css url() fixing system.
*/
$j.styleEval = function (data, cfg) {
	if(data && /\S/.test(data)) {
		var head  = document.getElementsByTagName('head')[0] || document.documentElement;
		var style = document.createElement('style');

		style.type = 'text/css';

		//	CSS files inserted using the standard HEAD method base any url() declarations
		//	in the folder where the .css file was found. This is the exptected behavior for
		//	CSS files. Because we are dynamically loading CSS via XHR, then "manually"
		//	inserting into the *calling* page, the browser understands the css file to now
		//	be relative to this calling page's folder.  We do not want developers to have to
		//	rewrite their css. So, we need to implement the expected behavior.
		//
		//	Fetch all the url() declarations which are relative (does not begin with
		//	a protocol such as http://, does not begin with a forward slash `/`) and
		//	rewrite this path to be relative to the calling page folder.
		//

		//	#cfg#url is the path to the css file proper, which is what we use to determine
		//	our new path.
		//
		var styleP  = cfg.url.replace(cfg.url.substring(cfg.url.lastIndexOf("/"), Infinity), "/");

		var urls    = data.match(/url(.+)/g);
		var len     = urls ? urls.length : 0;
		var map     = {};
		var _urls   = [];
		var tmp;
		var str;

		//	Get all the unique matches, as there may be duplicate declarations.
		//
		while(len--) {
			tmp = urls[len];
			if(!map[tmp]) {
				map[tmp] = 1;
				_urls.push(tmp);
			}
		}

		//	We have the full url() declarations. Find the url argument, lose any
		//	surrounding apostrophes, append the new path, replace with single
		//	apostrope, replace in original declaration.
		//
		len = _urls.length;
		while(len--) {
			tmp = _urls[len];
			map = tmp.substring(tmp.indexOf("(") +1, tmp.indexOf(")"));
			str = map.replace(/\"|\'/g, "");
			if(!str.match(/(ht|f)t(p|ps):\/\//) && str.charAt(0) !== "/") {
				str = "'" + styleP + str + "'";
				data = data.replace(map,str);
			}
		}

		if(style.styleSheet) {
			style.styleSheet.cssText = data;
		} else {
			style.textContent = data;
		}

		head.insertBefore(style, head.lastChild);

		return style;
	}
};

$.addKit("sajax", {

    instance    : $j.sajax,

    clearCache  : function() {
        cache = {};
    },

    cached : function(key) {
    	return cached[key] !== void 0;
    }

});

};
