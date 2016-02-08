"use strict";

module.dependencies	= [
    "data",
    "receiver",
	"sajax",
	"list",
	"template"
];
module.exports  = function(options) {

options = options || {};

var	$	= this;
var $j	= jQuery;

//	Actions to perform once the document is available.  Mainly this involves seeking bits
//	and initializing them. Upon document ready we are going to:
//	1. 	Find all bits/controls (Dom pass) and determine any dependencies.
//	2.	We're going to load those dependencies.  These are views, controllers, models.
//	3.	As loading progresses we notify of bits coming "on line".
//	4. 	Once we've completed a pass, we *repeat* the process, as the loading of views
//		may have introduced further bits, etc.
//	5.	Once a pass has nothing to do notify that the ui is initialized, and return.
//

//	Whenever a bit commences loading its (dom) node is pushed onto this
//
//	@see		#pass
//	@see		#bitLoader
//
var BIT_LOADING_QUEUE = [];

//	The collection of registered bits. A bit type not in this collection is ignored.
//
var BIT_DATA = $.data.$get("bitData");

//	How bits are identified. Any element with this class is a bit candidate.
//	@see	#bind
//
var BIT_SELECTOR = ".bits";

//	The format for template <script> definition. Mainly you are describing how
//	the #type field is defined as a selector.
//
var TEMPLATE_SCRIPT_DEF = 'script[type="text/x-template"]';

//	When a bit has been accepted for processing this attribute is toggled.
//
var BIT_PROCESSED_FLAG = "data-bit-processed";

//	When a bit has fully loaded this attribute is toggled.
//
var BIT_LOADED_FLAG = "data-bit-loaded";

//	When a bit has a timeout this attribute is set to the action to take on timeout;
//
var BIT_TIMEOUT_ACTION = "data-timeout-action";

//	@see	#processTemplates
//
var BINDER_PATH = "data-dynamic-binding";

//	@see	#delegateBitEvents
//
var BINDABLE_EVENTS = "abort change click dblclick error mouseup mousedown mouseout mouseover mouseenter mouseleave keydown keyup keypress focus blur focusin focusout load unload submit reset resize select scroll";

//  ##bitLoader
//
//	When a bit is found in #pass, we pass it here for processing.  Get
//	dependencies, check against defaults, load, track load progress, notify
//	subscribers of load states.
//
//	@param		{String}	$bitNode		The element with a ".bits" class...
//
var bitLoader = function($bitNode) {

    //	The bit name, key in #BIT_DATA, which we cycle through below.
    //
    var bitTypeName;

    //	This will contain the original #binding attribute, useful later if we
    //	want to know the path, or original datapoint, etc.
    //
    var bindingDef;

    //	Will hold a $.sajax instance.
    //
    var S;

    //	The method to fire following the loading of model and
    //	controller.
    //
    var afterMC;

	//	When bits go into a loading state #BIT_LOADING_QUEUE is pushed onto.
	//	At some point in the future the bit will be loaded and will need to be
	//	removed, by calling this method.
	//
	//
	var removeBitFromLoadingQueue = function() {
		var len	= BIT_LOADING_QUEUE.length;

		//	If this is a live bit (currently loading) we need to remove
		//	our obligation to load it.
		//
		while(len--) {
			if(BIT_LOADING_QUEUE[len] === $bitNode) {
				BIT_LOADING_QUEUE.splice(len, 1);
			}
		}
	};

	//	Helper, supposed to find the path to 'bits'.
	//
	var path = function(t) {
		var p;
		switch(t) {

			case 'tmpl':
			break;

			default:
				p = $.$n.path + "bits/";
			break;
		}

		return p;
	};

	//	##createModel
	//
	//	Expects to be passed all binding and other info for this model (#struct)
	//
	//	Note that the model extends %list.
	//
	//	@see	#afterMC
	//
	var createModel = function(struct) {
		return $.list.spawn(struct).extend({
			"clean"	: function() {

				var bId			= struct.id;
				var bitTypeName	= struct.name;
				var primeId		= this.$get("bindingPrimeId");
				var primeBit	= $.bits.$get(primeId);
				var prime 		= this.$get("bindingPrime");

				console.log("KILLING: " + bitTypeName + " - " + bId);

				if(!prime) {
					prime = primeBit ? primeBit.model : Terrace;
				}

				//  Destroy all change bindings on this bit, as this bit
				//  is being destroyed.
				//
				//  Destroy all change bindings on prime whose #data attribute
				//  matches this bit's id.
				//
				this.clearChangeBinding();
				prime && prime.clearChangeBinding(function(c) {
					return c.data === bId;
				});

				//	It is possible that we are mid-load, dependencies are
				//	asynchronously loading, and if so this is the channel which
				//	will be broadcast to when they are done. We don't want those
				//	bits to initialize.
				//
				$.unsubscribe(".depsFinished:" + bId);

				//	@see	#flagGarbage
				//
				$.each(this.$get("garbage"), function(el) {
					el.remove();
				});
				this.set("garbage", []);

				//	Unobserve any subscribers bound during this bit's setup.
				//	@see #bitLoader.
				//
				$.each(this.$get("subscribers"), function(s) {
					$.unsubscribe(s.name, function() {
						return this.fn === s.fn;
					});
				});

				this.unset("subscribers");

				//	Remove bit reference by id.
				//
				$.bits.unset(bId);
			},

			//	Your bits should not write to DOM nodes external to its own view.
			//	However, there are occasions where this might be justified (these
			//	are RARE!!!! You are probably doing it wrong!!!!). If you do write
			//	outside of your view, pass the element(s) you are adding so they
			//	can be cleaned up if the bit is destroyed.
			//
			flagGarbage	: function(el) {
				this.last("garbage", $j(el));
			}
		})
	};

	//  ##createView
	//
	var createView	= function(bitType) {

		var id 	= $bitNode.attr("id");
		var p;

		//	@see	#exposeEvent
		//	@see	#hideEvent
		//
		var changeEvents = function(ev, add) {
			var curEvs 	= $bitNode.attr("data-events");
			var newEvs	= ev.split(" ");

			var f = $.$reject(curEvs ? curEvs.split(" ") : [], function(e) {
				return e in this;
			}, $.$arrayToObject(newEvs));

			$bitNode.attr("data-events", (add ? f.concat(newEvs) : f).join(" "));

			//	When events are changed after the bit has initialized we need to
			//	re-delegate. #exposeEvent may be called prior to initialization, say in
			//	the case of it being called by the bit controller during init, in
			//	which case #delegate will be called naturally by the init process.
			//
			if($bitNode.attr(BIT_LOADED_FLAG)) {
				this.delegate();
			}
		};

		return $.spawn({
			node	: $bitNode,
			id		: id
		}).extend({

			"append" : function(el) {
				$bitNode.append(el);
				return this;
			},

			//	Exposes a bit to re-binding, via %bits#bind.
			//	We simply have to flag the bit as unprocessed.
			//
			"expose" : function() {
				$bitNode.attr(BIT_PROCESSED_FLAG, 0);
				return this;
			},

			"hide" : function(dur) {
				$bitNode.hide(dur || 1);
				return this;
			},

			"show" : function(dur) {
				$bitNode.show(dur || 100);
				return this;
			},

			//	Destroys the bit completely, including the defining element.
			//	If you would like to simply empty the bit of its view, use
			//	:empty.  Note that we want to have some way to cancel this in the future.
			//
			"destroy" : function() {
				$.publish("bit:beforeDestroy", $bitNode);
				removeBitFromLoadingQueue();
				$.bits.$get(id).model.clean();
				this.empty();
				$bitNode.remove();

				return this;
			},

			//	Empties all content (innerHTML) of a bit.  If you would like to
			//	completely destroy the bit, use :destroy.
			//
			"empty" : function() {
				$bitNode.find(BIT_SELECTOR).reverse().each(function(i, e) {
					var b =  $.bits.$get(e.getAttribute("id"));
					b && b.view.destroy();
				});

				$bitNode.empty();

				this.undelegate();

				return this;
			},

			//	Re-attach delegation system, for instance after an #undelegate
			//
			"delegate" : function() {
				this.undelegate();
				delegateBitEvents(bitType);
				return this;
			},

			//	Clears all #listensTo event tracking.
			//
			"undelegate" : function() {
				$bitNode.off($bitNode.attr("data-events"));
				return this;
			},

			//	Adds an event to the #data-events attribute for a bit, and re-#delegate's,
			//	exposing the bit controller to that event.
			//
			//	@param	{String}	ev		Any number of event names, space-separated.
			//
			"exposeEvent"	: function(ev) {
				changeEvents.call(this, ev, 1);
				return this;
			},

			//	Removes an event from the #data-events attribute for a bit, and re-#delegate's,
			//	no longer notifying the bit controller when the event fires.
			//
			//	@param	{String}	ev		Any number of event names, space-separated.
			//
			"hideEvent" : function(ev) {
				changeEvents.call(this, ev);
				return this;
			},

			//  Allows a request for a complete rebinding of a bit.  A developer
			//  can target a bit, change its attributes (typically its model/
			//  view/controller attributes) and re-bind it.
			//
			//	@param		{Object}	[atts]	A map of attributes to set.
			//	@param		{Function}	[cb]	Callback, called when bit has been rebound,
			//									passing back [bit] Object.
			//	@param		{Boolean}	[clear]	Whether or not to clear all bit attributes prior
			//									bit attributes prior to setting new ones.  Default
			//									is false.
			//
			"rebind" : function(atts, cb, clear) {

				atts	= atts || {};

				var p;
				for(p in atts) {
					$bitNode.attr(p, atts[p]);
				}

				//	All descendants are destroyed.
				//
				this.empty();

				//	Indicate that on the next bind pass this bit should be bound.
				//
				this.expose();

				//	Upon completion of next binding operation, respond with this bit's
				//	newly bound object.
				//
				if(cb) {
					$.subscribeOnce("bind:complete", function() {
						cb($bitNode);
					});
				}

				//	...and start the bind pass.
				//
				$.bits.bind($bitNode);

				return this;
			}
		}, {
			//	We don't need $returnValue methods
			//	@see	Terrace#extend
			//
			returnValue	: false
		});
	};

	//	##createController
	//
	var createController = function() {

		var controller	= $.spawn({
			invoker		: {},
			handlers	: {}
		}).extend("clear", function(targ, ev) {
			var h 	= this.$get("handlers");
			var p;

			for(p in h) {
				if(ev && p !== ev) {
					continue;
				}

				var i = h[p].length;
				while(i--) {
					if(h[p][i][4] === targ) {
						h[p].splice(i, 1);

						//console.log("KILL: " + p)
					}
				}
			}
		});

		//	#binder will create a controller method for each #BINDABLE_EVENTS
		//	For each of these events (like "click") there can be any number of handlers.
		//	In order to allow undo of event handler actions, we create an #invoker method
		//	for each event [eg. invoker.click() ], which handles iterating through the
		//	#handlers, and determining the type of execution (via undo stack or direct call).
		//
		//	@see	Terrace#addToUndoAndExec
		//	@see	#delegateBitEvents
		//
		var binder = function(eventName) {
			controller
			.set("handlers." + eventName, [])
			.extend(eventName, function(selector, eventDef, id) {

				var invoker 	= this.$get("invoker");
				var handlers	= this.$get("handlers." + eventName);

				//	Some sort of treachery, or the bit has since been destroyed.
				//
				if(!handlers || !invoker) {
					controller = null;
					return;
				}

				if(typeof selector === "function" || typeof selector === "object") {
					id			= eventDef;
					eventDef 	= selector;
					selector 	= null;
				}

				handlers.push([
					selector,
					eventDef,
					typeof eventDef === "function",
					this,
					id
				]);

				invoker[eventName] = invoker[eventName] || function() {

					//	0:	event object
					//	1:	$target element
					//	2: 	bit object
					//
					var a = $.argsToArray(arguments);
					var i = handlers.length;
					var h;

					while(i--) {
						h = handlers[i];

						if(!h[0] || a[1].is(h[0])) {

							h[2]	? h[1].apply(h[3], a)
									: $.addToUndoAndExec(h[1].exec, h[1].undo, h[3], a);
						}
					}
				};

				return handlers.length -1;

			}, {
				//	We don't need $returnMethods
				//
				//	@see	Terrace#extend
				//
				returnValue : false
			});
		};

		$.each(BINDABLE_EVENTS.split(" "), binder);

		return controller;
	};

	//  ##delegateBitEvents
	//
	//	All bit events are delegated to the main bit container, whose event handler is defined here.
	//
	var delegateBitEvents = function(bitName) {

		var bId 		= $bitNode.attr("id");
		var bOb 		= $.bits.$get(bId);

		var invoker		= bOb.controller.$get("invoker");

		bitName = bitName || bOb.name;

		//	You may set a list of events to listen for (#data-events="event event ..."), request
		//	that no events are listened for (remove #data-events attribute), or that *all*
		//	(#data-events = "all").  You are encouraged, if listening for events, to
		//	provide a list -- there is overhead in handling an event, so it is good practice
		//	to only take this cost if needed.
		//
		var evs	= BINDABLE_EVENTS;

		var lf	= $bitNode.attr("data-events");

		if(lf) {
			if(lf !== "all") {
				evs = lf;
			}
		} else {
			return;
		}

		//  All events occurring on nodes contained by bit will be delegated to the
		//  attached function.
		//
		return $bitNode.on(evs, function(ev) {

			//	Get a reference to the #controller of the bit we have delegated
			//	to (cmp), and determine if we have a controller method for this
			//	event type.  See below for the call of this method.
			//
			var $targ	= $j(ev.target);
			var type	= ev.type;

			//	If bit controller defined a handler for this event type, call it.
			//
			invoker[type] && invoker[type](ev, $targ, bOb);

			console.log(type + " on element<" + ev.target.tagName + "> with id<" + ev.target.id + "> delegated for bit<" + bitName + "> with id<" + bId + ">")

			//	All events on bits can be subscribed to using index of bitName:eventType,
			//  eg. list:click
			//
			$.publish(bitName + ":" + type, {
				event       : ev,
				bitId       : bId
			});
		});
	};

	//	##processBitAttribute
	//
    //	bits are defined by their attributes.  Those attributes usually involve
    //	the loading of some dependency. There are also default attributes contained
    //	in the bit definitions (@see %data). This method handles the
    //	determination and loading of dependencies.
    //
    //	@param		{String}	attr		The name of the attribute, such as "data-model".
    //	@param		{String}	[stype]		The type of loading that $.sajax will do, such
    //										as "css" or "json" or "js"...
    //	@param		{Object}	[sajax]		The instance of $.sajax for this bit.
    //	@param		{Function}	[func]		The callback fired when the dependency has
    //										loaded.
    //
    var processBitAttribute	= function(attr, stype, sajax, func) {

		var ret = [];
		var i;
		var p;
		var pp;

        //  Dependency location translations.
        //
        var depT = {
            "data-controller"   : "controllers",
            "data-view"         : "views",
            "data-model"        : "models",
            "data-css"			: "css"
        };

        //	If bit has attribute #attr, return that. If not, check if there
        //	is a default attr for this bit in the registry. If not, return
        //	false.
        //
        var a = $bitNode.attr(attr)	|| 	(	BIT_DATA[bitTypeName] && BIT_DATA[bitTypeName][attr]
                                            ? BIT_DATA[bitTypeName][attr]
                                            : "");
		a = a.split(" ");

		for(i=0; i < a.length; i++) {
			//  Determine path to dependencies. See #deptT, above.
			//
			//	Any path attribute preceded by `!` will be used exactly as is, with no
			//	modification. This would likely be used for loading remote files (http).
			//
			//  If asking for controller "foo.js" for bit "bar", file will be sought in:
			//  path() + "bar/controllers/foo.js".  Note the pluralization of
			//  "view(s)/controller(s)/model(s)".
			//
			//	If the dependency begins with a forward slash (/), then the path will be set
			//	relative to the bit directory, and *not* the dependency-type subdirectory. If
			//	the controller was "/foo.js" then:
			//	path() + "bar/foo.js" (no "controllers/" subdirectory).
			//
			//	If path == "parent", then use parent controller.
			//
			//	This is all really ugly, and should be improved.
			//
			if(a[i] !== "") {
				pp = a[i].replace("!","");
				if(pp !== a[i]) {
					p = pp;
				} else {
					pp = a[i].charAt(0) === "/" ? "" : (depT[attr] || attr) + "/";
					p = path() + bitTypeName + "/" + pp + a[i];
				}
			}

			//	If no stype is sent, the request is for the attribute values only.
			//	Otherwise, assume this is a file to be loaded, and run through sajax.
			//
			if(stype) {
				if(a[i] !== "") {
					sajax[stype](p, function(data) {
						func(data, p);
					});
				}
			} else {
				p && ret.push(p);
			}
		}

		return ret;
    };

	//	##processTemplates
	//
	//	Called by #afterMC.
	//
	//	@param	{Object}	bit		A bit object.
	//
	//	@see	#afterMC
	//
    var processTemplates = function(bit) {
		var templateProcessor = function(i, tmp) {
			var BM	= bit.model;

			//	Identify the template by its id, or give it an addressable one.
			//	Fetch the bit model binding path, extending it if requested via
			//	#data-path attribute of template.
			//	Fetch the binding, and render this template in its context.
			//
			//  #fixed  : If set, dynamic bindings will *not* be set on the template. You
			//  should set this property in every case where no changes will be made
			//  to the template in the future, to avoid unnecessary binding overhead.
			//
			var idx		= tmp.getAttribute("id") || ("-template-" + i);
			var fixed   = tmp.getAttribute("data-fixed");
			var refresh = tmp.getAttribute("data-refresh");

			//  Maintain the original (prime) binding source, as this bit may be inheriting.
			//
			var primePath	= BM.$get("bindingPrimePath");
			var primeId		= BM.$get("bindingPrimeId");
			var primeModel	= primeId === "Terrace" ? $ : $.bits.$get(primeId).model;

			//	The fragment that will receive a rendered template, eventually replacing
			//	the original template <script> element. Note that this is where the
			//	binding owner id is set as an attribute.
			//
			var templateNode = document.createElement("div");
			templateNode.setAttribute("id", bit.id + idx);
			templateNode.setAttribute("data-prime-binding-id", primeId);

			//	Fetched compiled template. Note that if this is not a fixed template we send binder.
			//
			var compiledTemplate = $.template.$prepare(tmp.innerHTML, null, null, fixed ? null : function(code, obj, directive, suffix, cstart, cend) {
				return cstart + "(function(c, o, pp, pid, suff){ var model = Terrace.bits.$get('" + bit.id + "').model;  var path = (Terrace.$find(null, function(curKey, val, key, node) { return node === o; }, pp, model.$get('binding')).first || '') + (suff ? '.' + suff : ''); return" + (directive === "*" ? " pid + '~~' + Terrace.$trim(path); })(" :  " '<ins style=\"text-decoration:none\" " + BINDER_PATH + "=\"' + Terrace.$trim(path) + '\">' + c + '</ins>'; })(") + code + "," + obj + ",'" + primePath + "','" + primeId + "','" + suffix + "')" + cend;
			});

			var templateBinding	= BM.$get("binding");

			//	We render the template into #templateNode, which is still
			//	not inserted into the DOM...
			//
			compiledTemplate.renderInto(templateNode, templateBinding);

			//	Now find all the bindings and create their update methods.
			//	Note that while templates can conceivably create new bits, those
			//	bits won't be rendered yet, so will have no #binderName's,
			//	ensuring that this pass will assign bindings to their proper bits.
			//
			//	If refreshing, we have a straight template redraw every time the
			//	relevant model changes. Note that we re-#bind() afterwards.
			//
			//	If dynamic, each individual dynamic element (identified by <ins>, see
			//	above) is updated when the relevant model changes.
			//
			//	Also note that this bit #id is passed as the second parameter to #onChange.
			//	This is done so that when a bit is destroyed all change events bound to
			//	that bit can be removed.
			//
			//	@see	model#clean
			//
			if(refresh && !fixed) {
				(function(ct, tn, bnd, pModel, bit){
					pModel.onChange(function() {
						ct.$renderInto(tn, bnd);
						tn.parentNode.replaceChild(tn, tn);

						//	As the ultimate result of the template render may differ
						//	from what was previously bound, we re-bind for controls.
						//	Note that this only matters for #refresh cases.
						//
						bindFormControls(bit);

						$.bits.bind(tn);
					}, bit.id);
				})(compiledTemplate, templateNode, templateBinding, primeModel, bit);
			} else {
				$j(templateNode).find('ins[' + BINDER_PATH + ']').each(function(i) {
					var $bind   = $j(this);
					(function(el, dPath, pModel, bit) {
						if(!refresh) {
							pModel.onChange(function() {
								el.html(this.$get(dPath));
							}, bit.id);
						}
					})($bind, $bind.attr(BINDER_PATH), primeModel, bit);
				});
			}

			tmp.parentNode.replaceChild(templateNode, tmp);

			BM.last("templates", {
				node	: templateNode,
				binding	: templateBinding,
				cTemp	: compiledTemplate,
				render	: function() {
					this.cTemp.renderInto(this.node, this.binding);
				}
			});
		};

        //  If a template contains other templates within it which themselves are
        //  contained by a bit, those templates-in-bits need to be snipped out during
        //  this pass, as they will execute prior to their containing bit, which cannot
        //  happen. Once the nested bit is loaded, prior to it being bound ("beforeBind"),
        //  this snipped-out nested template will be re-attached, and processing will
        //  continue as normal.
        //
        //  Note that this sort of handling will only be necessary to process inline bit
        //  views (cases where templates contain other templates directly).
        //
		$bitNode.find(".bits").each(function(i, b) {
			var innerBit 	= $j(b);
			var iid			= innerBit.attr("id");
			innerBit.find(TEMPLATE_SCRIPT_DEF).each(function(i, s) {
				var snip = $j(s).replaceWith('<span id="__' + iid + '__" style="visibility:hidden"></span>');
				$.subscribe("bit:" + iid + ":beforeBind", function() {
					innerBit.find("#__" + iid + "__").replaceWith(snip);
				}, {
				    greedy: false
				});
			});
		});

		$bitNode.find(TEMPLATE_SCRIPT_DEF).each(templateProcessor);
	};

	//	##processBindings
	//
	//	Processes the #data-binding attribute of a bit, which arrives as #bindingDef.
	//
	//	@param	{String}	bindingDef	The value of #data-binding attribute.
	//
	var processBindings = function(bindingDef, onBound) {

	    onBound = onBound || $.noop;

	    var bId     = $bitNode.attr("id");
		var binding;

	    //	If there is no binding path available, simply set #binding to an empty object.
	    //
	    if(!bindingDef) {
	    	return onBound({});
	    }

		//	Parse out the binding info. Note that in cases where there is no third value (#val),
		//	#val is made identical to #key.
		//
		//	e.g. 	parent|animals.dogs.poodle
		//			remote|../foo.json|*
		//			channel|newUser|messages.latest|once
		//
		var bs		= bindingDef.split("|");
		var type	= bs[0];
		var key	    = bs[1];
		var val		= bs[2] || bs[1];
		var opt		= bs[3];

		var error = function(targBitId, msg) {
		    msg = msg ? msg + "<br />" : "";
		    $.error(msg + "Binding->" + bindingDef + "<br />Bit Id->" + bId + "<br />Target Bit Id->" + targBitId, "Bit binding not resolvable-> " + key);
		};

		var respond = function(a) {

			var bindingPrime;
			var bindingPrimePath;
			var primeId;
			var tmp;
			//	If there is a prime ancestor for this binding, we need to find it.
			//
			if(a) {
				bindingPrime 	= a
				primeId			= bindingPrime.$get("id");

				while(tmp = bindingPrime.$get("bindingPrime")) {
					primeId 		= tmp.$get("id") || primeId;
					bindingPrime 	= tmp;
				};

				//	We are going to fetch the string path, in #bindingPrime, to #binding.
				//
				bindingPrimePath = bindingPrime.$find(null, function(curKey, val, key, node) {
					return node === binding;
				}).first;
			}

			//	#primeId will be null if we started with Terrace, or model is this, the bit
			//	currently being processed (not yet done, so model is not initialized).
			//	Otherwise, use the #id of the bit whose model === final #bindingPrime.
			//
			primeId = primeId || (bindingPrime === $ ? "Terrace" : bId);

			onBound({
				binding		: binding,
				prime		: bindingPrime,
				primePath	: bindingPrimePath,
				primeId		: primeId
			});
		};

		var bindByBitId = function(id) {
			var targ = $.bits.$get(id);

			//  Creating the ultimate binding path by adding "binding" prefix, appending
			//  additional local path info if given, or by handling unspecified pointer.
			//
			var bVal = val === "*" ? "binding" : "binding." + val;

			if((binding = targ.model.$get(bVal)) === null) {
				error(id);
			}

			respond(targ.model);
		};

		//	For callback-related bindings this simply processes a callback response into
		//	a proper model, and responds, initiating final bit initialization.
		//
		var bindCallback = function(data) {
            binding = findVal(data);
			respond($.spawn({
				"binding" : binding
			}));
		};

		//	Delays initialization of bit until first message from publisher. Continues to
		//	update model on each subsequent message, unless "once" option is passed
		//	in binding arguments.
		//
		//	Note the "delays initialization" part! If you expect that this data will
		//	not arrive until some time much later (or not at all) you should simply
		//	listen for the event and insert your bit at that point ($.bits.insert(...))
		//
		//	Used by @channel and @receive directives.
		//
		var subscribeToChannel = function(key) {
			$.subscribeOnce(key, function(data) {
			    bindCallback(data);
			    if(opt !== "once") {
					$.subscribeOnce("bit:" + bId + ":ready", function(bit) {
						$.subscribe(key, function(data) {
							bit.model.set("binding", findVal(data));
						}, {
							//	We don't want to fetch any previous values, only future values
							//
							greedy	: false
						});
					});
				}
			});
		};

		//	Utility method to handle the @val parameter, checking for splat (etc),
		//	determining path within data model, and returning the node at that path.
		//
		var findVal = function(data) {
		    if(!$.is(Object, data)) {
                error(bId, type + " bind error. Non-object #data received.");
                return respond();
            }
            val = val === "*" ? "" : val;
            return val === "" ? data : $.$get(val, data);
		};

		//	NOTE that for types which accept a path, use "*" as a path
		//	if you wish to work from binding root.  Do not leave blank.
		//
		switch(type){

			//	Binding to Terrace Object.
			//
			//  @example	"main  	|path"
			//          			 ^key
			//
			case "main":
				if((binding = $.$get(key)) === null) {
				   error(bId);
				}
				respond($);
			break;

			//	Bind to another bit's model.  Note that a bit with one of these bindings will
			//	not be processed (will not get here) until its bound bit has arrived.
			//	This synchronization is handled in #bind.
			//
			//  @example	"other  |otherBitId   	|path"
			//          			 ^key            ^val
			//
			//	Bind to immediate parent bit's model.
			//
			//  @example	"parent |path"
			//          			 ^key
			//
			//	Bind to previous sibling (bit)'s model.
			//
			//  @example	"previous 	|path"
			//          				 ^key
			//
			//	Bind to next sibling (bit)'s model.
			//
			//  @example	"next 	|path"
			//          			 ^key
			//
			//	@see	#bind
			//
			case "other":
			case "parent":
			case "previous":
			case "next":
				bindByBitId($bitNode.attr("data-bindid"));
			break;

            //  Fetch from the %data collection
            //
            case "data":
                var data = $.data.$get(key);

                if(!data) {
                    error(bId, "No reference at path '" + key + "' in %data");
                    respond();
                }

                respond($.spawn({
					"binding" : findVal(data)
				}));
            break;

			//	Fetch a data object (json) from a remote source.
			//
			//  @example	"remote |url   	|path"
			//          			 ^key    ^val
			//
			case "remote":

				//	Automatically set the "data-waitfor" property to the value of this bit id
				//	for the immediate descendent bits, ignoring those which have an
				//	existing data-waitfor property.
				//
				$bitNode.find(".bits:not(.bits .bits):not([data-waitfor])").each(function() {
					$j(this).attr("data-waitfor", bId);
				});

			    $j.getJSON(key, bindCallback);

			break;

			//	Wait for data to be published to a channel.
			//
			//  @example	"channel 	|channelName   	|path	|[once]"
			//          				 ^key    		 ^val	 ^opt
			//
			case "channel":
			    subscribeToChannel(key);
			break;

			//	Listen for data events pushed by the server.
			//
			//	#eventName is the name of the event that you will listen for.  If you
			//	would like to be informed of all messages (not recommnded), simply
			//  #subscribe to `%receiver:message`
			//
			//	#controllerMethod should be the name of a method in your bit controller
			//	that will receive message data [@eventName, @data]
			//
			//  @example	"receive 	|eventName  |path	|[once]
			//          				 ^key        ^val	 ^opt
			//
			case "receive":
				$.receiver.listen(key, function() {
					subscribeToChannel("%receiver:" + key);
				});
			break;

			default:
			    error(bId, "Unknown type `" + type + "` or data-binding initialization error.");
			break;
		};
	};

	//  ##bindFormControls
	//
	//	Within a bit UI controls (like an input element) will need to be bound to a model node.
	//	A text input, in other words, has to change a real value, and has to reflect that
	//	value should it be changed elsewhere.
	//
	//	Adding a #data-binding attribute to an element will achieve that effect, and the
	//	binding is accomplished here.
	//
	//	Typically:
	//
	//	<div id="mybit">...<input data-binding="mybit~~binding.somecollection.deeper.1">
	//
	//	Note the "~~" split, with first item being the bit whose model we are referring
	//	to (could be any bit name...), and the second being the model path.
	//
	//	This attribute will normally be written by %template, where given the
	//	following template iterating over a collection and in scope of `e`:
	//
	//	<div id="mybit"><input value="{{= e.name }}" data-binding="{{= *e.name }}" />
	//
	//	...where the above would be translated into:
	//
	//	<input value="John" data-binding="mybit~~binding.0.name">
	//
	//	Note how the template processor will find and interpolate the string path to the
	//	targeted data node.
	//
	//	TODO: need to build in all the other UI elements... now only input.
	//
	var bindFormControls = function(bOb) {

		//	This id is sent below to identify controller bindings (click, etc), which allows
		//	the clearing of existing form control bindings whenever #bindFormControls
		//	is re-called (we re-bind, in other words, as the bit contents may have changed).
		//
		var evId = "__bc__";

		//	Clear previous bindings.
		//
		bOb.controller.clear(evId);

		//console.log(bOb.view.$get("node").find(".bits:not(.bits .bits)"))

		//	Find all inputs which are not descendants of a sub-bit (which bit will
		//	bind its own inputs when it is parsed).
		//
		bOb.view.$get("node").find("input:not(.bits input)").each(function(i) {

			var $el 	= $j(this);
			var binding = $el.attr("data-binding") || "";
			//	This is always uppercase
			//
			var inputNode	= $el.prop("nodeName");
			var inputType	= ($el.attr("type") || "").toUpperCase();
			var inputId		= $el.attr("id");
			var fn;

			//	Is this input requesting an external bit model? If so it would have 3 parts.
			//
			var bMatch			= binding.match(/^(.+)~~(.+)$/) || [];
			var directedBind 	= bMatch.length === 3;
			//	If not an external bit binding request, then the value of any #data-binding
			//	must be a path in the model of the containing bit.
			//
			var boundBit 		= directedBind ? $.bits.$get(bMatch[1]) : bOb;
			var path			= directedBind ? bMatch[2] : "binding." + binding;
			var boundController = boundBit.controller;
			var boundView		= boundBit.view;

			//	These buttons always activate an action (click || submit or both), even
			//	if they do not have a binding.
			//
			/BUTTON|IMAGE|SUBMIT/.test(inputType) && boundView.exposeEvent("click submit");
			inputNode === "BUTTON" && boundView.exposeEvent("click");

			//	Elements without bindings require no further processing.
			//
			if(!binding) {
				return false;
			}

			//  All inputs need to have an #id set, as we use this as a
			//	lookup elsewhere.
			//
			if(!inputId) {
				inputId = $el.attr('id', $.uuid()).attr("id");
			}

			//	We are using this a selector target, so "normalize" for jQuery.
			//
			inputId = "#" + inputId;

			//	We're in an error state if there is a binding requested but no model
			//	existing at #boundBit
			//
			if(!boundBit.model.$get("binding")) {
				$.error("Form input of type " + inputType + " has requested data-binding `" + binding + "` but no model binding is defined at target.", "Form Binding Aborted");
				return false;
			}

			if(inputNode === "INPUT") {
				switch(inputType) {
					case "CHECKBOX":
					case "RADIO":
						boundView.exposeEvent("click");
						boundController.click(inputId, function() {
							console.log("____ CHECKBOX ____" + $el.attr("id"));
							boundBit.model.set(path, !boundBit.model.$get(path));
						}, evId);
						boundBit.model.set(path, !!boundBit.model.$get(path));
					break;

					case "TEXT":
					case "PASSWORD":
						boundView.exposeEvent("keyup");
						boundController.keyup(inputId, function() {
							boundBit.model.set(path, $el.val() || "");
													console.log(boundBit.model.$get("binding"))
						}, evId);
						$el.val(boundBit.model.$get(path) || "");
					break;

					case "BUTTON":
					case "SUBMIT":
					case "IMAGE":
					break;

					case "HIDDEN":
						boundBit.model.setIfNone(path, $el.val() || false);
						console.log("HID");
						console.log(boundBit.model.$get("binding"));
					break;

					default:
					break;
				}
			} else {
				switch(inputNode) {
					case "SELECT":
						boundView.exposeEvent("change");
						boundController.change(inputId, function() {
							console.log(arguments);
						});
					break;

					case "TEXTAREA":
					break;

					case "BUTTON":
					break;
				}
			}
		});
	};

    //////////////////////////////////////////////////////////////////////////////
    //																		  	//
    //	Cycling through all registered bits to see if we can match this	bit		//
    //																			//
    //////////////////////////////////////////////////////////////////////////////
    for(bitTypeName in BIT_DATA) {

        //	See model construction, below, for usage.  Each bit can request the
        // 	loading of various data sources. These are use for template rendering
        //	and data binding
        //
        bindingDef = false;

        if($bitNode.hasClass(bitTypeName)) {

            //	bit will now be loaded. Increment working count.
            //
            BIT_LOADING_QUEUE.push($bitNode);

            //	Instructions for defining the data model for this bit. This is the
            //	model which will be used by templates as well.
            //
            bindingDef = $bitNode.attr("data-binding");

            //////////////////////////////////////////////////////////////////////////////
            //																			//
            //	##afterMC																//
            //																			//
            //	After a bit has lazily loaded its MVC dependencies, this is		    	//
            //	the method which initializes the bit model/controller, and notifies 	//
            //	of the bit's availability.	                                            //
            //                                                                          //
            //  Receives model binding info, and the number of model files for this     //
            //	bit (zero or more).  #numModelFiles is used below to fetch and run 		//
            //	model files first, before controllers, while tracking if the models		//
            //	loaded any further files.  If they did, we will further wait for those	//
            //	files prior to firing controllers.										//
            //																			//
            //	Note that subscribers at this point are adopted, as multiple bits may	//
            //	be of the same type (listen on the same channel for bitName publish).	//
            //																			//
            //////////////////////////////////////////////////////////////////////////////
            afterMC = function(bindingInfo, numModelFiles) {

                var bId     = $bitNode.attr("id");

                var bitPath	= path() + bitTypeName + "/";
                var bitJax	= $.sajax.$instance({
                    cache           : $.data.$get("cacheBitFiles"),
                    currentBitName  : bitTypeName
                });
                var binding	= bindingInfo.binding;
				var mcSubscribers;
				var subscrF;
                var i;
                var d;

				//	Paths sent to the the #load methods can be preceeded by `!` to force
				//	the loader to accept them unchanged. Otherwise, they are understood to
				//	be relative to the bit's root path.
				//
                var normalizePath = function(dep) {
                	var chk = dep.replace("!","");
                	return chk === dep ? bitPath + dep : chk;
                };

                //  The bit definition. This is what is passed to bit load subscribers.
                //
                var bOb	= $.bits.$set(bId, {

					//	The #id of the bit element.
					//
                    id : bId,

                    //	The name of the bit, like "notifier" or "list".
                    //
                    name : bitTypeName,

					//	Models may use the bits #load system to load further dependencies
					//	(which, it should be stressed, have *nothing* to do with bit
					//	dependencies but are special to a bit/model and are irrelevant to the
					//	general system). This attribute tracks if loading, mainly impacting
					//	when ".depsFinished" is called (the moment when a bit is perfected).
					//	See below, and the #load methods.
					//
					//	NOTE: While any model file can use the #load system, only the first
					//	to do so will block (perfection) until it has completed. If you have
					//	two model files both #load-ing, the Model(1) will block until its
					//	dependencies are ready, and Model(2) will not (perfecting immediately,
					//	with dependencies loading as they will).
					//
                    loading : false,

                    //  Provide a simple %sajax interface for models to load additional
                    //  dependencies (js & css). Communication on the @.depsFinished
                    //  channel coordinates model/controller loading. Controllers will
                    //  not be called until the model has finished dep loading.
                    //  See below.
                    //
                    load : $.spawn({
                    	scripts			: [],
                    	conditionals	: false
                    }).extend({
                    	css	: function(dep) {
                    		bOb.loading = true;
                    		bitJax.css(normalizePath(dep));
                    	},
                    	js	: function(dep) {
                    		bOb.loading = true;
                    		this.$get("scripts").push(normalizePath(dep));
                    	},
                    	conditional : function(cond, src) {
                    	    bOb.loading = true;
                    		var c = '[' + cond + ']>%v<![endif]';
                    		var s = document.getElementsByTagName('script')[0].parentNode;
                    		s.appendChild(document.createComment(c.replace(/%v/, '<script src="' + normalizePath(src) + '"></script>')));
                    		s.appendChild(document.createComment(c.replace(/%v/, '<script>console.log(">>>>>>>>> cOnDiTiOnAl");</script>')));
                    	},
                    	done : function(f) {
                    	    var scr = this.$get("scripts");
                    	    var fnc = function() {
                    			f && f();
                    			bOb.loading = false;
                    			$.publishOnce(".depsFinished:" + bId);
                    		};

                    		scr.length ? bitJax.bundle.apply(bitJax, scr.concat(fnc)) : fnc();
                    	}
                    }),

					//	Reading #data-params attribute of bit.
					//
					//	split k/v with bar(|). Space separated.
					//
					//	@example	data-params = "   foo | bar       eeny | meeny   "
					//	produces : {foo : bar, eeny: meeny}
					//
                    params : (function(params) {
                    	var ob	= new String(params).match(/([\w]+[\s]*\|[\s]*[\w$,.:%/&?#=\ \-\+]+)/g) || [];
                    	var x	= 0;
                    	var len	= ob.length;
                    	var out = {};
                    	var s;

                    	for(; x < len; x++) {
                    		s = ob[x].split("|");
                    		out[$.$trim(s[0])] = $.$trim(s[1]);
                    	}

                    	return $.spawn(out);
                    })($bitNode.attr("data-params") || ""),

                    path : bitPath,

                    view : createView(name),

                    controller : createController(),

                    //	Importantly the model contains data bindings.
                    //	Note: #garbage is a hack, for use when a plugin or other external
                    //	code creates dom elements outside of the modelled bit. This
                    //	should be avoided, but if it must be, we need to mark garbage
                    //	targets and clean them up.
                    //
                    model : createModel({
						id					: bId,
						name				: bitTypeName,
						sub					: [],
						garbage				: [],
						subscribers			: [],
						templates			: [],
						binding				: binding,
						bindingDef			: bindingDef,
						bindingPrime		: bindingInfo.prime,
						bindingPrimePath	: bindingInfo.primePath,
						bindingPrimeId		: bindingInfo.primeId
					})
                });

				//	Many bits do not have a data binding declared as an attribute. However,
				//	a .model still exists which #set/#get still updates. Ensure that
				//	the binding properties are properly self-referential.
				//
				if(!bindingDef) {
					bOb.model.set({
						bindingPrime		: bOb.model,
						bindingPrimePath	: "binding",
						bindingPrimeId		: bId
					});
				}

				//	If bit A is bound to bit B (such as "other|bitB|*"), B.set("foo") will
				//	update any templates in A which reference their shared model. What if
				//	I try A.set("foo")? This will update the shared model, but it will *not*
				//	fire #onChange handlers bound to B -- each bit has its one #onChange space.
				//	Generally, we want to make sure that any bit which inherits its binding
				//	from another bit will fire the #onChange handler of its prime -- this
				//	ensures that any change in a binding is broadcast to all bound bits.
				//
				(function(bM) {
					var pId = bM.$get("bindingPrimeId");
					var p	= $.bits.$get(pId) || {};
					var pM	= pId === "Terrace" ? $ : p.model;
					if(pM && bM !== pM) {
						bM.onChange(pM.executeChangeBindings);
					}
				})(bOb.model)

                //  When a bit's Model and Controller are executing they may subscribe
                //	to other events, for whatever reason. We need to keep track of
                //	any subscriptions made by this bit, as they have to be cleaned up if
                //	the bit is destroyed.
                //
                //  Prior to Model/Controller init we listen for the ".subscribed" event
                //  (published by Terrace#subscribe), and push the subscriber reference (#ob)
                //  onto bit#model#subscribers.
                //
                subscrF = function(ob) {
                    bOb.model.$get("subscribers").push(ob);
                };

                //  Adopt any subscribers to bit:bitName:loaded, which will be the
                //  subscribers set by model/controller files (#mcSubscribers).
                //
				mcSubscribers = $.$adoptSubscribers("bit:" + bitTypeName + ":loaded");

                //  When we are sure the model dependencies have loaded, finalize bit
                //  initialization and notify of completion.
                //
                //  @see #bOb#load#done
                //  @see below
                //
				$.subscribeOnce(".depsFinished:" + bId, function() {
					$.publishOnce("bit:" + bId + ":beforeBind");

					//	Fetch template objects existing in the final view.
					//	Will receive an object with template indexes, assigned to the model.
					//
					processTemplates(bOb);

					//	Fire any remaining m/c load subscribers.
					//
					$.each(mcSubscribers, function(s) {
					    $.subscribe(".subscribed", subscrF);
						s.publish(bOb);
						$.unsubscribe(".subscribed", subscrF);
					});

					//	There may have been other subscribers to this event, outside of
					//	m/c listeners.
					//
					$.publishOnce("bit:" + bOb.id + ":loaded", bOb);

					//	Form controls (<input>, etc) are bound to the model, if any.
					//	This may also introduce new, custom bits to handle special
					//	UI functions.
					//
					bindFormControls(bOb);

					//  Each bit is delegated events occurring within its node.
					//
					delegateBitEvents(bitTypeName);

					//	Indicate that this bit has been loaded
					//
					$bitNode.attr(BIT_LOADED_FLAG, "Y");

					removeBitFromLoadingQueue();

					//	General bit ready announcement, which *follows* broadcast
					//	to bit initializers. The bit is ready at this point, IOW,
					//	its Controller and Model having executed fully, and all
					//	DOM event bindings attached.
					//
                    $.publishOnce("bit:" + bId + ":ready", bOb);

					console.log("_________________________________________");
                    console.log("CREATED BIT >>>> " + bOb.id);
                    console.log(bOb);

                    $.bits.bind();
				});

                //  If there are models, publish those first.
                //	This gives the models an opportunity to, internally, request
                //	further dependencies via bit.load(). When this happens the
                //	bit object #loading prop will be set.
                //
				if(numModelFiles) {
				    $.subscribe(".subscribed", subscrF);
				    for(i=0; i < numModelFiles; i++) {
				    	if(d = mcSubscribers.shift()) {
				    		d.publish(bOb);
				    	} else {
				    		$.error("Bit type > " + bitTypeName + " with #id > " + bId + " has non-reciprocal binding. This likely means a mismatched load channel name, which should be `bit:" + bitTypeName + ":loaded`");
				    	}
				    }
					$.unsubscribe(".subscribed", subscrF);
				}

                //  If the models didn't ask for dependencies, complete immediately.
                //
				if(!bOb.loading) {
					$.publishOnce(".depsFinished:" + bId);
				}
            };

            //////////////////////////////////////////////////////////////////////////////
            //																		  	//
            //	Process the bit dependency files. The %sajax kit asynchronously fetches	//
            //	files and, when *all* are ready, sequentially executes them (ie.		//
            //	inserts as script file, as css, sends response to callback, etc).		//
            //																			//
            //	So we are assembling a sajax collection, eventually load model and 		//
            //	controller, and when those two are ready execute #afterMC.  			//
            //	Somewhat confusing async stuff, but is solid.							//
            //																			//
            //////////////////////////////////////////////////////////////////////////////

            S = $.sajax.$instance({
                cache: $.data.$get("cacheBitFiles"),
                currentBitName: bitTypeName
            });

            //  Initiate loading of css dependencies.
            //
            processBitAttribute("data-css", "css", S, $.noop);

            //  Initiate loading of views.
			//	NOTE that views are appended.
			//
            processBitAttribute("data-view", "html", S, function(data) {
                if($.trim(data) !== "") {
                    $bitNode.append(data);
                }
            });

			//	All other dependencies are attached to the Sajax loader instance.
			//	We now need to attach the Model and Controller, if any.
			//	These will depend on any requested data bindings.
			//	Process data bindings, which are often asynchronous.  When
			// 	binding is assured (we will receive #bindingInfo if any), start
			//	the M/C loading process, eventually initializing the entire bit
			//	via #afterMC, which is passed #bindingInfo.
			//
            //	The special requirements of bindings, of M/C being loaded in order,
            //	executed together, and with a common callback, requires this
            //	divergence from the way other files are lazily loaded.
            //
            processBindings(bindingDef, function(bindingInfo) {

    			var dm	= processBitAttribute("data-model");
    			var dc	= processBitAttribute("data-controller");
    			var mL	= dm.length;
    			var cL	= dc.length;

				//	However the MC are bundled, this will be the final callback, which
				//	importantly passes
                var ff  = function() {
                    afterMC(bindingInfo, mL);
                };

                !mL && !cL
                    ? S.bundle(path() + "null.js", ff)
                    : !cL
                        ? S.bundle.apply(S, dm.concat(ff))
                        : !mL
                            ? S.bundle.apply(S, dc.concat(ff))
                            : S.bundle.apply(S, dm.concat(dc).concat(ff));
			});

            break;

        }	// 	End bit initialization
    }	// 	End bit sweep
}; 	// 	End #bitLoader


//////////////////////////////////////////////////////////////////////////////////
//																				//
//									Bit Kit										//
//																				//
//////////////////////////////////////////////////////////////////////////////////

$.addKit("bits", {

	//	Trigger a controller action on a bit.
	//
    trigger : function(action, bitId, data) {
        var b = $.bits.$get(bitId);
        if(b && b.controller[action]) {
            b.controller[action].apply(b.view.$get("node"), $.argsToArray(arguments, 2));
        }
    },

	//	Will manufacture a bit with certain attributes, append it to a given element, and
	//	bind it.
	//
	//	@param	{Mixed}		targ	A selector, or a DOM element, identifying node to append to.
	//	@param	{String}	type	The type of bit.
	//	@param	{Object}	atts	Containing bit attributes.
	//	@param	{Boolean}	[empty]	Whether to empty the target element. Default is to append.
	//
    insert : function(targ, type, atts, empty) {
		var k;
    	var $b 		= $j("<div>");
    	var $targ 	= $j(targ);

    	if($targ.length === 0) {
    		return;
    	}

    	$b.addClass("bits " + type);

    	for(k in atts) {
    		$b.attr("data-" + k, atts[k]);
    	}

		if(empty) {
			if($targ.hasClass("bits")) {
				$.bits.$get($targ.attr("id")).view.empty();
			} else {
				$targ.empty();
			}
		}

    	this.bind($targ.append($b));
    },

	//  ##bind
	//
	//	Find any bits. If they are to be loaded, pass them to #bitLoader, which does all the
	//	heavy lifting.
	//
	//	A bit will not be loaded if it has declared a dependency, either through #waitfor
	//	or one of the various #data-binding directives, which does not exist.  In these cases
	//	the relevant bit is ignored on this pass. As #bind is run on every pass completion (when
	//	all bits being loaded in current pass are in fact loaded) those dependencies will
	//	continue to be checked until all bits loading has executed.
	//
	//	As such, a bit bound to another bit which never loads will itself never load.  This can
	//	be leveraged in an interesting way, as one can create "sleeper" bits which come to life
	//	at some point in the future when their "master" is introduced.
	//
	//	@param		{Mixed}		startSel		A selector, domNode, or other valid
	//											$j() argument, setting the start
	//											node for bit searches.
	//
    bind : function(startSel) {

		//  Do not execute new bind if a pass is in progress.
		//
		if(BIT_LOADING_QUEUE.length > 0) {
			return;
		}

		var $cSelect = startSel ? $j(startSel).find(BIT_SELECTOR) : $j(BIT_SELECTOR);

		var bitTimeoutRecheckMs	= $.data.$get("bitTimeoutRecheckMs");

		$cSelect.each(function() {

			var $this 	  	= $j(this);
			var tid			= $this.attr("id");
			var waitFor     = $this.attr("data-waitfor");
			var tout		= $this.attr("data-timeout") || $.data.$get("defaultBitLoadTime");
			var bindData    = ($this.attr("data-binding") || "").split("|");

			//	Ignore if this bit has been tainted (already parsed).  Note that
			//	we are in an #each block, so we are performing the equivalent of
			//	a "continue"...
			//
			if($this.attr(BIT_PROCESSED_FLAG) == "Y") {
				return;
			}

			//  All bits etc must have an #id set.  If not, we set
			//	#id to a random value.
			//
			if(!tid) {
				tid = $this.attr('id', $.uuid()).attr("id");
			}

			//  We are only interested in bit bindings to other bits, so we check for those
			//  directives, assigning the proper master id.
			//
			//	@see	#processBindings
			//
			var binds       = {
				"other"     : bindData[1],
				"parent"    : $this.parent().closest(BIT_SELECTOR).attr("id"),
				"previous"  : $this.prevAll(BIT_SELECTOR).eq(0).attr("id"),
				"next"      : $this.nextAll(BIT_SELECTOR).eq(0).attr("id")
			};
			var bindId = binds[bindData[0]];

			//	#waitFor simply waits for another bit to be arrive. The other bit may *never*
			//	arrive, which is *allowed*. This has nothing to do with binding, only load order.
			//	Additionally, this is not a timeout situation.
			//
			//	@see	#processBindings
			//
			if(waitFor && !$.bits.$get(waitFor)) {
				return;
			}

			//  If we are dealing with a bit dependency (other || parent || previous || next),
			//	similar to #waitfor, we wait for that to arrive. When it has, we set
			//	an attribute to be used by #processBindings.
			//
			if(binds.hasOwnProperty(bindData[0])) {
				if(!bindId || !$.bits.$get(bindId)) {
					return;
				}

				//	The bound bit is ready. Store its id for #processBindings, which saves it the
				//	trouble of repeating the search we've been doing for parent/previous/etc.
				//
				$this.attr("data-bindid", bindId);
			}

			//	All bits, from this point on, have a timeout for loading. Use any requested
			//	timeout (#data-timeout), or the default. When the timeout flags we check the
			//	#data-timeout-action attribute for instructions on what to do. If none is set
			//	the default is to @die. If @retry then second argument of #data-timeout-action
			//	will be # of tries.
			//
			//	@example	#data-timeout-action = "die";		// destroy bit completely on fail.
			//	@example	#data-timeout-action = "ignore";	// empties bit but leave ref.
			//	@example	#data-timeout-action = "retry|3";	// try 3 times.
			//
			$.wait(tout, function(tob) {

				var bitChk 		= $.bits.$get(tid);
				var loading		= bitChk ? !!bitChk.loading : false;
				var params;
				var action;

				tob.cancel();

				//	The bit may be in any state of processing -- if it does not yet exist in the
				//	%bits collection, or has not fully loaded, then we need to check timeouts.
				//
				if(!bitChk || loading) {

					params 	= ($this.attr(BIT_TIMEOUT_ACTION) || "die").split("|");

					//	One of die|ignore|retry
					//
					action	= params.shift();

					({
						die		: function() {
							//	The bit may have been destroyed in the interim. If it has, only
							//	need to remove the DOM node itself.
							//
							if(bitChk) {
								bitChk.view.destroy();
								$.error("Bit with id: " + tid + " has timed out (" + tout + ")");
							} else {
								$this.remove();
							}
							$.bits.bind();
						},
						ignore	: function() {
							bitChk && bitChk.view.empty();
							$.bits.bind();
						},
						retry	: function(attempts) {
							//	Checking if we have any retry time left.
							//
							if(attempts > 0) {
								if(loading) {
									console.log(attempts);
									$this.attr(BIT_TIMEOUT_ACTION, "retry|" + (attempts - (bitTimeoutRecheckMs/tout).toFixed(2)));
									tob.reset(bitTimeoutRecheckMs);
									return;
								} else {
									bitChk && bitChk.view.rebind({
										BIT_TIMEOUT_ACTION 	: "retry|" + (attempts -= 1)
									})
								}
							} else {
								this.die();
							}
						}
					})[action](params[0]);
				}
			});

			//	Taint ui element, preventing repeat initialization.
			//
			$this.attr(BIT_PROCESSED_FLAG, "Y");

			//	Start the bit dependency loading.
			//
			bitLoader($this);
		});

		if(BIT_LOADING_QUEUE.length === 0) {

			//	#bind is part of an execution chain which should be allowed to terminate
			//	gracefully prior to starting up other contexts.
			//
			$.nextTick(function() {
				console.log("********* PASS FINISHED ********");
				$.publish("ui:resized");
				$.publishOnce("bind:complete", $cSelect);

				$cSelect.each(function(i, e) {
					$j(e).animate({
						"opacity": 1
					}, $.data.$get("bitFadeSpeed"));
				});
			});
		}
    }
});

//  Track key events and delegate to currently focused

return $.bits;

} // end module export / function
