// 	%template
//
//	Templating engine. Core is a fork of doT.js, with slight mods to handle Terrace
//	specific features and file (template) retrieval, and larger mods to enable
//	template data binding, mainly in #prepare.
//
// 	doT.js
// 	2011, Laura Doktorova
// 	https://github.com/olado/doT
//
// 	doT is a custom blend of templating functions from jQote2.js
// 	(jQuery plugin) by aefxx (http://aefxx.com/jquery-plugins/jqote2/)
// 	and underscore.js (http://documentcloud.github.com/underscore/)
// 	plus extensions.
//
// 	Licensed under the MIT license.
//

module.exports = function(options) {

options = options || {};

var	$	= this;

//	If we're in Node, use direct file access.
//
//	@see	%template#prepareFile.
//
if(!$.document()) {
	var fs = require("fs");
}

var doT = {
	version: '0.2.0',
	templateSettings : {
		evaluate    	: /<%([\s\S]+?)%>/g,
		interpolate		: /\{\{=([\s\S]+?)\}\}/g,
		encode			: /\{\{!([\s\S]+?)\}\}/g,
		use				: /\{\{#([\s\S]+?)\}\}/g,
		define			: /\{\{##\s*([\w\.$]+)\s*(\:|=)([\s\S]+?)#\}\}/g,
		conditional		: /\{\{\?(\?)?\s*([\s\S]*?)\s*\}\}/g,
		iterate			: /\{\{~\s*(?:\}\}|([\s\S]+?)\s*\:\s*([\w$]+)\s*(?:\:\s*([\w$]+))?\s*\}\})/g,
		varname			: 'binding',
		strip			: true,
		append			: true,
		selfcontained	: false
	},
	template: undefined, //fn, compile template
	compile:  undefined  //fn, for express
};

var global = (function(){ return this || (0,eval)('this'); }());

var encodeHTMLSource = function() {
	var encodeHTMLRules = { "&": "&#38;", "<": "&#60;", ">": "&#62;", '"': '&#34;', "'": '&#39;', "/": '&#47;' },
		matchHTML = /&(?!#?\w+;)|<|>|"|'|\//g;
	return function(code) {
		return code ? code.toString().replace(matchHTML, function(m) {return encodeHTMLRules[m] || m;}) : code;
	};
}
global.encodeHTML = encodeHTMLSource();

var startend = {
	append: { start: "'+(",      end: ")+'",      startencode: "'+encodeHTML(" },
	split:  { start: "';out+=(", end: ");out+='", startencode: "';out+=encodeHTML("}
}, skip = /$^/;

function resolveDefs(c, block, def) {
	return ((typeof block === 'string') ? block : block.toString())
	.replace(c.define || skip, function(m, code, assign, value) {
		if (code.indexOf('def.') === 0) {
			code = code.substring(4);
		}
		if (!(code in def)) {
			if (assign === ':') {
				def[code]= value;
			} else {
				eval("def['"+code+"']=" + value);
			}
		}
		return '';
	})
	.replace(c.use || skip, function(m, code) {
		var v = eval(code);
		return v ? resolveDefs(c, v, def) : v;
	});
}

function unescape(code) {
	return code.replace(/\\('|\\)/g, "$1").replace(/[\r\t\n]/g, ' ');
}

doT.compile = function(tmpl, def) {
	return doT.template(tmpl, null, def);
};

$.addKit("template", {

	//	@spasquali@gmail.com
	//
	//	This kit method is a cut and paste of doT.template = function(tmpl, c, def) { ...
	//	Note the addition of #parseBindings, and of the addition of @binder to
	//	function signature.
	//
	prepare	: function(tmpl, c, def, binder) {

		c = c || doT.templateSettings;
		var cse = c.append ? startend.append : startend.split, str, needhtmlencode, sid=0, indv;

		if (c.use || c.define) {
			var olddef = global.def; global.def = def || {}; // workaround minifiers
			str = resolveDefs(c, tmpl, global.def);
			global.def = olddef;
		} else str = tmpl;

		//	@spasquali@gmail.com
		//
		//	This is a new method added to doT, which also requires the signature of #prepare
		//	to have @binder added to it.
		//

		//	For each interpolation check if a request for a special binding has been made.
		//	This is where you might send a #binder to do something with an interpolation.
		//	Otherwise, just process the stringification of the code and return that.
		//
		var parseBindings = function(match, code) {

			var useBinder 	= !!binder;
			var directive	= false;

			//	Preceeding an interpolation instruction with bang(!) overrides any
			//	#binding requests. That is, bang guarantees that the code will not
			//	be passed to any @binding processor.
			//
			//	Preceeding an interpolation instruction with a star(*) will result in
			//	the interpolation of the string path to the node value, such as:
			//
			//	<input value="{{= e.name }}" data-binding="{{= *e.name }}" />
			//	<input value="Huey" data-binding="editable~~binding.0.name">
			//
			code = $.$trim(code);

			if(code.charAt(0) === "!") {
				code = code.substring(1,Infinity);
				useBinder = false;
			} else if(code.charAt(0) === "*") {
				code = code.substring(1,Infinity);
				directive = "*";
			}

			var obj     = code.split(".");
			var suff    = obj.pop();

			//	Only one element...
			//
			if(obj.length === 0) {
				obj = suff;
				suff = "";
			} else {
				obj = obj.join(".");
			}

			return useBinder ? binder(code, obj, directive, suff, cse.start, cse.end) : cse.start + code + cse.end;
		};

		str = ("var out='" + (c.strip ? str.replace(/(^|\r|\n)\t* +| +\t*(\r|\n|$)/g,' ')
					.replace(/\r|\n|\t|\/\*[\s\S]*?\*\//g,''): str)
			.replace(/'|\\/g, '\\$&')

			//	@spasquali@gmail.com
			//
			//	If you update the engine, this is the main place where changes are made
			//	to the traditional doT handling.
			//
			.replace(c.interpolate || skip, function(match, code) {

				code = code.replace(/\\'/g, "'").replace(/\\\\/g,"\\").replace(/[\r\t\n]/g, ' ');

				return parseBindings(match, code);
			})
			.replace(c.encode || skip, function(m, code) {
				needhtmlencode = true;
				return cse.startencode + unescape(code) + cse.end;
			})
			.replace(c.conditional || skip, function(m, elsecase, code) {
				return elsecase ?
					(code ? "';}else if(" + unescape(code) + "){out+='" : "';}else{out+='") :
					(code ? "';if(" + unescape(code) + "){out+='" : "';}out+='");
			})
			.replace(c.iterate || skip, function(m, iterate, vname, iname) {
				if (!iterate) return "';} } out+='";
				sid+=1; indv=iname || "i"+sid; iterate=unescape(iterate);
				return "';var arr"+sid+"="+iterate+";if(arr"+sid+"){var "+vname+","+indv+"=-1,l"+sid+"=arr"+sid+".length-1;while("+indv+"<l"+sid+"){"
					+vname+"=arr"+sid+"["+indv+"+=1];out+='";
			})
			.replace(c.evaluate || skip, function(m, code) {
				return "';" + unescape(code) + "out+='";
			})
			+ "';return out;")
			.replace(/\n/g, '\\n').replace(/\t/g, '\\t').replace(/\r/g, '\\r')
			.replace(/(\s|;|}|^|{)out\+='';/g, '$1').replace(/\+''/g, '')
			.replace(/(\s|;|}|^|{)out\+=''\+/g,'$1out+=');

		if (needhtmlencode && c.selfcontained) {
			str = "var encodeHTML=(" + encodeHTMLSource.toString() + "());" + str;
		}

		//	@spasquali@gmail.com
		//
		//	This replaces the automatic returning of a template, moving it into
		//	the kit's namespace.
		//
		var template = this.spawn({
			$Template	: function() {
				return new Function(c.varname, str);
			}
		});

		return def ? template.$render(def) : template;
	},

  	prepareFile	: function(path, cb) {

  		var cbF = function(err, tmpl) {
			if(!err) {
				$.template.prepare(tmpl);
			}
			cb(err, tmpl);
		}

		$.document()    ?   jQuery
		                    ? jQuery.get(path, $.noop)
		                        .success(function(d) { cbF(false, d); })
		                        .error(function(d) { cbF(true, d); })
		                    : $.xhr.get(path, cbF)
		                : fs.readFile(path, "utf8", cbF);
  	},

	//	## render
	//
	//	Will render a template. Usually the template is set, internally, by
	//	executing #prepare on this Object. You may also pass another template Object.
	//
  	render	: function(data, template) {

  		console.log("+ rendering +");

  	    var t = template || this.$get("$Template") || this.$;
  		return $.is(Function, t) && (typeof data === "object" ? t.call(this, data) : false);
  	},

	//	## renderInto
	//
	//	Renders a template like #render, but inserts the result into a target
	//	element, which may be either a proper DOM element, or a jQuery object.
	//
  	renderInto : function(target, data, template) {
  		var r = this.$render(data, template);
  		target instanceof jQuery ? target.html(r) : target.innerHTML = r;
  		return target;
  	}
});

return $.template;

} // end exports / function


