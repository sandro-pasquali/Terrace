module.exports = function(options) {

options = options || {};

var	$	= this;

var pad = function($t, d, padstr, len, sub) {

	var s = new String(sub || $t.$);

	while(s.length < len) {
		s = d === "r" ? s + padstr : padstr + s;
	}

	return s;
};

//	Originally part of sprintf implementation. Work this into our system.
//
var str_repeat = function(i, m) {
	for (var o = []; m > 0; o[--m] = i);
	return o.join('');
}

$.addKit("string", {

	//	##padLeft
	//
	padLeft		: function(p, l, s) {
		return pad(this, "l", p, l, s);
	},

	//	##padRight
	//
	padRight 	: function(p, l, s) {
		return pad(this, "r", p, l, s);
	},

	//	##collapse
	//
	//	Remove all leading/trailing whitespace + collapse extra spaces
 	//	within the string.
 	//
 	//	@type  	{String}
 	//
	collapse	: function(v) {
		return new String(v || this.$).replace(/\s/g, "");
	},

	//	##toArray
	//
	//	String converted to Array, with each character indexed by its position.
	//
	//	@type  	{Array}
	//
	toArray	: function(v) {
		return new String(v || this.$).split("");
	},

	//	##reverse
	//
	reverse	: function(v) {
		var a = new String(v || this.$).split('');
      	a.reverse();
      	return a.join('');
    },

	//	##wrap
	//
 	//	Wraps words at a boundary, with a given boundary character, either
	//	wrapping on spaces, or cutting every x number of characters.
 	//	Based on discussion at: http://snippets.dzone.com/posts/show/869.
	//
 	//	@param      {String}  wid   The line width.
 	//	@param      {String}  bnd   The boundary character (default is '\n').
 	//	@param      {String}  cut   If true, string is simply cut every `wid` characters.
 	//	@return     {String}        The string with boundaries inserted.
 	//	@type       {String}
 	//
 	wrap	: function(wid, bnd, cut, v) {
      	var i;
      	var j;
      	var s;
      	var r	= new String(v || this.$).split("\n");

		if(wid > 0) {
			for(i in r) {
				for(s = r[i], r[i] = ""; s.length > wid;
					j = cut ? wid : (j = s.substr(0, wid).match(/\S*$/)).input.length - j[0].length
					|| wid,
					r[i] += s.substr(0, j) + ((s = s.substr(j)).length ? bnd : "")
				);
				  r[i] += s;
			}
		}

      	return r.join("\n");
 	},

    //	##camelize
    //
    //	When sent a string containing dashes(-) or underscores(_) will return a string that
    //	has removed either character and uppercased the character immediately following.
    //
    //	@param		{String}		s		A string to camelize.
    //	@see		#uncamelize
    //
    //	@example							.camelize('font-size') 	// fontSize
    //
    camelize 	: function(s) {
    	return s.replace(/[-_]+(\S)/g, function(m,c){ return c.toUpperCase();} );
    },

    //	##uncamelize
    //
    //	Returns a camelized string to a uncamelized state.  Reverses the process in #camelize.
    //
    //	@param		{String}		[s]		A string to decamelize.
    //	@param		{String}		[d]		The character to use as the separator.  Default is
    //										a dash(-).
    //	@see		#camelize
    //
    //	@example							.uncamelize('fontSize',"-") // font-size
    //
    uncamelize 	: function(s, d) {

		var sub	= true;

		if(arguments.length === 0) {
			d = "-";
			s = new String(this.$);
		} else if(arguments.length  === 1) {
    		if(s.length === 1) {
    			d = s;
    			s = new String(this.$);
    		} else {
    			d = "-";
    			sub = false;
    		}
		} else {
			sub = false;
		}

    	//	@see https://developer.mozilla.org/en/Core_JavaScript_1.5_Reference/Objects/String/replace
    	//
    	return s.replace(/[A-Z]/g, d + '$&').toLowerCase();
    },

	//	Capitalizes the first character of all words in a string.
	//
	// 	@type         {String}
	//
	ucwords		: function(v) {

		var s	= new String(v || this.$);
		var w 	= s.split(' ');
		var i;

		for(i=0; i < w.length; i++) {
			w[i] = w[i].charAt(0).toUpperCase() + w[i].substring(1);
		}

		return w.join(" ");
	},

	//	Returns a string with all HTML tags stripped.
	//	NOTE: HTML is often malformed or oddly formed. This may fail on some strings.
	//
	//	@type 	{String}
	//
	stripTags	: function(s) {
		return s.replace(/(<([^>]+)>)/ig, '');
	},

	/**
	sprintf() for JavaScript 0.6

	Copyright (c) Alexandru Marasteanu <alexaholic [at) gmail (dot] com>
	All rights reserved.

	Redistribution and use in source and binary forms, with or without
	modification, are permitted provided that the following conditions are met:
		* Redistributions of source code must retain the above copyright
		  notice, this list of conditions and the following disclaimer.
		* Redistributions in binary form must reproduce the above copyright
		  notice, this list of conditions and the following disclaimer in the
		  documentation and/or other materials provided with the distribution.
		* Neither the name of sprintf() for JavaScript nor the
		  names of its contributors may be used to endorse or promote products
		  derived from this software without specific prior written permission.

	THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
	ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
	WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
	DISCLAIMED. IN NO EVENT SHALL Alexandru Marasteanu BE LIABLE FOR ANY
	DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
	(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
	LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
	ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
	(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
	SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.


	Changelog:
	2007.04.03 - 0.1:
	 - initial release
	2007.09.11 - 0.2:
	 - feature: added argument swapping
	2007.09.17 - 0.3:
	 - bug fix: no longer throws exception on empty paramenters (Hans Pufal)
	2007.10.21 - 0.4:
	 - unit test and patch (David Baird)
	2010.05.09 - 0.5:
	 - bug fix: 0 is now preceeded with a + sign
	 - bug fix: the sign was not at the right position on padded results (Kamal Abdali)
	 - switched from GPL to BSD license
	2010.05.22 - 0.6:
	 - reverted to 0.4 and fixed the bug regarding the sign of the number 0
	 Note:
	 Thanks to Raphael Pigulla <raph (at] n3rd [dot) org> (http://www.n3rd.org/)
	 who warned me about a bug in 0.5, I discovered that the last update was
	 a regress. I appologize for that.
	**/

	sprintf	: function () {
		var i = 0, a, f = arguments[i++], o = [], m, p, c, x, s = '';
		while (f) {
			if (m = /^[^\x25]+/.exec(f)) {
				o.push(m[0]);
			}
			else if (m = /^\x25{2}/.exec(f)) {
				o.push('%');
			}
			else if (m = /^\x25(?:(\d+)\$)?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-fosuxX])/.exec(f)) {
				if (((a = arguments[m[1] || i++]) == null) || (a == undefined)) {
					throw('Too few arguments.');
				}
				if (/[^s]/.test(m[7]) && (typeof(a) != 'number')) {
					throw('Expecting number but found ' + typeof(a));
				}
				switch (m[7]) {
					case 'b': a = a.toString(2); break;
					case 'c': a = String.fromCharCode(a); break;
					case 'd': a = parseInt(a); break;
					case 'e': a = m[6] ? a.toExponential(m[6]) : a.toExponential(); break;
					case 'f': a = m[6] ? parseFloat(a).toFixed(m[6]) : parseFloat(a); break;
					case 'o': a = a.toString(8); break;
					case 's': a = ((a = String(a)) && m[6] ? a.substring(0, m[6]) : a); break;
					case 'u': a = Math.abs(a); break;
					case 'x': a = a.toString(16); break;
					case 'X': a = a.toString(16).toUpperCase(); break;
				}
				a = (/[def]/.test(m[7]) && m[2] && a >= 0 ? '+'+ a : a);
				c = m[3] ? m[3] == '0' ? '0' : m[3].charAt(1) : ' ';
				x = m[5] - String(a).length - s.length;
				p = m[5] ? str_repeat(c, x) : '';
				o.push(s + (m[4] ? a + p : p + a));
			}
			else {
				throw('Huh ?!');
			}
			f = f.substring(m[0].length);
		}
		return o.join('');
	}


});

return $.string;

} // end module export / function