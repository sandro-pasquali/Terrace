Terrace.subscribe("bit:bracelet:loaded", function(bit) {

var Events =   function(groupPrefix) {

	var doc			= document;
	var docEl		= doc.documentElement;
	var $this		= this;

	var numericCssProps = {
		"fill-opacity"	: 1,
		"font-weight"	: 1,
		"line-height"	: 1,
		"opacity"		: 1,
		"orphans"		: 1,
		"widows"		: 1,
		"z-index"		: 1,
		"zoom"			: 1
	};

	//	##getPixelValue
	//
	//	IE computedStyle will return original measurement instead of computed (px) size. Such
	//	as with a font set as `font-size: 1em` -- we want to get the computed `16px` (for
	//	example), and not what IE sends, which is `1em`.  This normalizes, returning an
	//	integer.
	//
	// 	From: http://erik.eae.net/archives/2007/07/27/18.54.15/#comment-102291
	//
	//	@see		#css
	//
	var getPixelValue = function(el, value) {

		var px 		= /^\d+(px)?$/i;
		var e		= el;
		var ers		= el.runtimeStyle;
		var rs;
		var st;

		if(px.test(value)) {
			return parseInt(value);
		}

		if(ers) {
			st = e.style.left;
			rs = ers.left;
			ers.left = e.currentStyle.left;
			e.style.left = value || 0;
			value = e.style.pixelLeft;
			e.style.left = st;
			ers.left = rs;
		}

		return value;
	};

	$this.handlers	= {};

	//	##Animation
    //
	//	This "hard codes" Penner's #easeOutQuint
	//	@href http://www.robertpenner.com/easing/
	//
	//	@param	{Number}	start		The initial value.
	//	@param	{Number}	change		The change between initial value and final value.
	//	@param	{Number}	duration	How many steps. Running off ~1 ms interval,
	//									so roughly #duration ms.
	//	@param	{Function}	f			The function to receive current value.
	//
	//	@example	new Animation(0, 200, 100, function(pos) {
	//					myElement.left = pos; // pseudo
	//				};
	//
	$this.Animation = function(start, change, duration, f, cb) {
		var t = 0;
		var v;
		var animation = setInterval(function() {
			t++;
			var i = t;
			if(t <= duration) {
				i /= duration;
				i--;
				f(v = change*(i*i*i*i*i + 1) + start);
			} else {
			    cb && cb(v);
				clearInterval(animation);
			}
		}, 1);
	};

	$this.findPos	= function(obj) {
		var left    = 0;
		var top     = 0;
		if(obj.offsetParent) {
			while(obj.offsetParent) {
				left	+= obj.offsetLeft;
				top    	+= obj.offsetTop;
				obj     = obj.offsetParent;
			}
		} else if(obj.x) {
			left   += obj.x;
			top    += obj.y;
		}

		return {left: left, top: top};
	};

	$this.empty = function(n) {
		while(n.hasChildNodes()) {
			n.removeChild(n.firstChild);
		}
	};

	//	Very basic implementation.
	//
	$this.css 	= function() {
		var a 			= Array.prototype.slice.apply(arguments);
		var rule 		= a[0];
		var targ 		= a[1];
		var str 		= "";
		var numericV 	= !isNaN(parseFloat(targ)) && isFinite(targ);
		var css;
		var pcv;

		//	Uncamelize: accepts dashed properties, not camelcase ('font-size' not 'fontSize').
		//
		rule	= rule.replace(/[A-Z]/g, '-$&').toLowerCase();

		//	If 3 args, then we are setting.
		//
		if(a.length === 3) {
			return a[2].style[rule] = targ + (numericCssProps[rule] || !numericV ? "" : "px");
		}

		if(document.defaultView && document.defaultView.getComputedStyle) {

			css = document.defaultView.getComputedStyle(targ, null);
			str = css ? css.getPropertyValue(rule) : null;

		} else if(targ.currentStyle) {

			rule = rule.replace(/\-(\w)/g, function(strMatch, p1) {
				return p1.toUpperCase();
			});

			str = targ.currentStyle[rule];
		}

		return getPixelValue(targ, str);
	};

	$this.hasClass = function(cn, el) {
		el = el || $this.eventInfo.el;
		return el.getAttribute('class').match(new RegExp('(\\s|^)' + cn + '(\\s|$)'));
	};

	$this.addClass	= function(cn, el) {
		el = el || $this.eventInfo(cn, el);
		if(!$this.hasClass(cn)) {
			el.className += " " + cn;
		}
	};

	$this.removeClass = function(cn, el) {
		el = el || $this.eventInfo.el;
		el.className = el.className.replace(cn, "");
	};

	$this.eventInfo = {
		css 		: function(rule, val) {
			var e = $this.eventInfo.el;
			if(val === void 0) {
				return $this.css(rule, e);
			}
			return $this.css(rule, val, e);
		},
		hasClass	: $this.hasClass,
		addClass	: $this.addClass,
		removeClass	: $this.removeClass
	};

	$this.monitor 	= function(e)  {
		var eInf    = $this.eventInfo;
		var ev     	= e || window.event;
		var gRex	= [];
		var gN;
		var evs;

		eInf.el		= ev.srcElement || ev.target;
		eInf.x 		= ev.pageX || ev.clientX + docEl.scrollLeft;
		eInf.y 		= ev.pageY || ev.clientY + docEl.scrollTop;

		var el 		= eInf.el;
		var pos     = $this.findPos(el);

		eInf.left   	= pos.left;
		eInf.top    	= pos.top;
		eInf.width  	= el.offsetWidth;
		eInf.right		= eInf.left + eInf.width;
		eInf.height 	= el.offsetHeight;
		eInf.parent		= el.parentNode;
		eInf.type  		= ev.type;
		eInf.id      	= el.getAttribute('id');
		eInf.group		= el.getAttribute('data-' + groupPrefix);
		eInf.tag      	= el.nodeName || false;

		//	If anyone is listening for this type, call.
		//
		if(evs = $this.handlers[eInf.type]) {
			for(gN in evs) {
				if(eInf.group && eInf.group.match(gRex[gN] || (gRex[gN] = new RegExp('(\\s|^)' + gN + '(\\s|$)')))) {
					evs[gN](eInf);
				}
			}
		}
	};

	$this.addEvent	= function(e, type, fn) {
		if(e.addEventListener) {
			e.addEventListener(type, fn, false);
		} else if(e.attachEvent) {
			e.attachEvent( "on" + type, fn );
		} else {
			e["on"+type] = fn;
		}
	};

	$this.on	= function(events, groups, func) {

		events 	= events.split(' ');
		groups	= groups.split(' ');

		var si			= events.length;
		var handlers	= this.handlers;
		var gi;
		var t;

		while(si--) {
			t = events[si];
			if(!handlers[t]) {
				this.addEvent(doc, t, this.monitor);
				handlers[t] = {}
			};
			gi = groups.length;
			while(gi--) {
				handlers[t][groups[gi]] = func;
			}
		}
	};

	$this.off	= function(events, groups) {
		events 	= events.split(' ');
		groups	= groups.split(' ');
		var ei	= events.length;
		var gi	= groups.length;
		var h	= this.handlers;
		var t;
		while(ei--) {
			t = events[ei];
			while(t && gi--) {
				delete h[t][groups[gi]];
			}
		}
	};
};

var Bracelet = function(containerId, options) {

	var T	= this;
	var E 	= new Events("blind");
	var css = E.css;

	//	Shortcuts.
	//
	var _w	= "width";
	var _h	= "height";
	var _t	= "top";
	var _l	= "left";

	var cycle 			= options.cycle !== void 0 ? options.cycle : true;
	var orientation		= options.orientation === "vertical" ? -1 : 1;
	var forceDirection	= options.forceDirection === void 0 ? true : false;

	//	The original container.
	//
	var container 		= document.getElementById(containerId);
	var containerWidth;
	var containerHeight;

	//	See initialization. This value tracks indexes for *initial* #add's on elements
	//	contained by #container.
	//
	var initIndex		= 0;

	//	See initialization. The actual control elements.
	//
	var braceletWindow;
	var braceletCharms;

	//	Contains Charm object
	//
	var bracelet = [];

	//	The position in the bracelet
	//
	var pointer 	= 0;
	var lastPointer	= 0;

	//	Whether we are currently animating.
	//	@see	#moveTo
	//
	var animating = false;

	var isNode = function(o) {
		return 	typeof Node === "object"
				? o instanceof Node
				: o && typeof o === "object" && typeof o.nodeType === "number" && typeof o.nodeName==="string";
	};

	//	Whenever we need to hide the non-targeted charms. Internal.
	//
	//	@see	#resize
	//	@see	#showCharm
	//
	var shiftHidden = function(ptr, hideProp) {
		var len	= bracelet.length;
		while(len--) {
			if(len !== ptr) {
				//	Just add two measures together for offset, instead of
				//	adding argument.
				//
				css(hideProp, containerWidth + containerHeight, bracelet[len]);
			}
		}
	};

	//	@see	#resize
	//
	var updateContainerDimensions = function() {
		containerWidth	= css(_w, container);
		containerHeight	= css(_h, container);
	}

	//	Accepts a dom element as a charm and adds it. Internal.
	//
	//	@see	#add
	//
	var addCharm = function(el, idx) {

		var nextCharm 	= bracelet[idx +1];
		var charmEl 	= document.createElement("div");

		//	Take the element we've been sent and wrap it in charm container.
		//
		charmEl.appendChild(el);

		//	If the bracelet is empty, or there is no charm following the sent
		//	index, append. If there is a charm following index, we need to splice.
		//
		if(bracelet.length === 0 || !nextCharm) {
			braceletCharms.appendChild(charmEl);
		} else {
			braceletCharms.insertBefore(charmEl, nextCharm);
		}

		charmEl.setAttribute("class", "bracelet-charm");
		css("position", "absolute", charmEl);

		bracelet.splice(idx, 0, charmEl);
	};

	//	The action. Moves a charm into view. Internal.
	//	Note treatment of different orientations.
	//
	//	@see	#moveTo
	//
	var showCharm = function(direction, cb) {

		var curEl 	= bracelet[lastPointer];
		var targEl	= bracelet[pointer];

		var show = function(factor, moveProp, hideProp) {

			var delta 	= -factor;
			var pos 	= 0;
			var cur		= 0;
			var tar		= factor;

			var mvCall	= function(v) {
				//	Cut down on the number of function calls.
				//
				braceletCharms.style[moveProp] = v + "px";
			};

			var finCall	= function() {
				shiftHidden(pointer, hideProp);
				cb && cb()
			};

			//	Raise the two lucky charms.
			//
			css(hideProp, 0, curEl);
			css(hideProp, 0, targEl);

			//	Defaults for next (1) are initial.
			//	This is previous (-1).
			//
			if(direction === -1) {
				cur		= factor;
				tar 	= 0;
				delta 	= factor;
				pos 	= -factor;
			}

			css(moveProp, pos, braceletCharms);
			css(moveProp, cur, curEl);
			css(moveProp, tar, targEl);

			if(direction === 0) {
				mvCall(pos + delta);
				finCall();
			} else {
				new E.Animation(pos, delta, options.speed || 200, mvCall, finCall);
			}
		};

		orientation === 1 ? show(containerWidth, _l, _t) : show(containerHeight, _t, _l);
	};

	T.nextIndex = function() {
		if((pointer +1) > (bracelet.length -1)) {
			if(cycle) {
				return 0;
			}
			return null;
		}
		return pointer + 1;
	};

	T.previousIndex = function() {
		if((pointer -1) < 0) {
			if(cycle) {
				return bracelet.length -1;
			}
			return null;
		}
		return pointer -1;
	};

	T.next = function() {
		T.moveTo(T.nextIndex(), 1);
	};

	T.previous = function() {
		T.moveTo(T.previousIndex(), -1);
	};

	//	Alias
	//
	T.prev 		= T.previous;
	T.prevIndex = T.previousIndex;

	//	##moveTo
	//
	//	All movement methods (#next, #previous, etc) will call this method.
	//	Note that this method ignores calls while it is animating, with prejudice.
	//
	//	NOTE: The directive #forceDirection will, by default, force easing to be from
	//	left if sought index < #pointer, and vice versa. Set this option to
	//	false in the instantiation object to allow any direction to any pointer.
	//
	//	@param	{Number}	index	The charm to jump to.
	//
	T.moveTo = function(index, direction) {

		if(animating === true || index === pointer) {
			return;
		}

		if(direction !== 0 && forceDirection) {
			direction = index > pointer ? 1 : -1;
		}

		if(index !== null && bracelet[index]) {

			animating 	= true;
			lastPointer = pointer;
			pointer 	= index;

			showCharm(direction, function(v) {
				animating = false;
			});
		}
	};

	T.current = function() {
		return pointer;
	};

	T.add	= function(obj, idx) {

		var charmObj	= {};
		var coll 		= [];
		var len			= bracelet.length;

		idx = idx === void 0 ? len : idx;

		if(idx > len) {
			idx = len;
		} else if(idx < 0) {
			idx = 0;
		}

		if(idx >= 0 && idx <= len) {
			if(isNode(obj) && obj.nodeType === 1) {
				addCharm(obj, idx);
			} else if(obj.url) {
				// Ajaxy stuff
				//
				addCharm("ajax data", idx);
			}
		}

		//T.moveTo(idx, 1);
	};

	T.destroy = function(idx) {
		var charm = bracelet[idx];
		if(charm) {
			charm.parentNode.removeChild(charm);
			bracelet.splice(idx, 1);
			T.moveTo(idx, 1);
		}
	};

	T.resize = function() {

		//container.style.width = Math.ceil(Math.random() * 1000) + "px";
		//container.style.height = Math.ceil(Math.random() * 1000) + "px";

		var b	= bracelet;
		var idx	= b.length;
		var hor	= orientation === 1;
		var p	= b[pointer];

		updateContainerDimensions()

		//	Hide everything that isn't our lucky charm.
		//
		shiftHidden(pointer, hor ? _t : _l);

		//	Resize all charms to current container dimensions.
		//
		while(idx--) {

			if(hor) {
				css(_l, containerWidth * idx, b[idx]);
				css(_t, 0, p);
			} else {
				css(_t, containerHeight * idx, b[idx]);
				css(_l, 0, p);
			}

			css(_w, containerWidth, b[idx]);
			css(_h, containerHeight, b[idx]);
		}

		//	Resize the bracelet window.
		//
		css("clip", "rect(0px, " + containerWidth + "px, " + containerHeight + "px, 0px)", braceletWindow);

		T.moveTo(pointer, 0);
	};

	//////////////////////////////////////////////////////////////////////////////////////
	//																					//
	//										INITIALIZE									//
	//																					//
	//////////////////////////////////////////////////////////////////////////////////////

	//	The bracelet container. Some arbitrarily large numbers to ensure
	//	that there is room for the two slots we need.
	//
	braceletWindow = document.createElement("div");
	css("position", "absolute", braceletWindow);
	css("overflow", "hidden", braceletWindow);
	css(_w, 10000, braceletWindow);
	css(_h, 10000, braceletWindow);

	//	This element contains each of the charms.
	//
	braceletCharms = document.createElement("div");
	css("position", "absolute", braceletCharms);

	braceletWindow.appendChild(braceletCharms);

	//	We're going to move each of the child elements of the sent node into the bracelet node.
	//	At the end, the sent node will be empty, at which point we insert the new bracelet
	//	element, and size the whole structure.
	//
	while(container.hasChildNodes()) {
		T.add(container.removeChild(container.firstChild), initIndex);
		++initIndex;
	}

	container.appendChild(braceletWindow);

	T.resize();

}

bit.model.set({
    charms  : [
	    "http://soulinthemachine.com/dev/wp-content/uploads/2011/08/37.jpg",
	    "http://graphics8.nytimes.com/images/2012/02/28/arts/JP-DESIGN-1/JP-DESIGN-1-articleLarge.jpg",
	    "http://4.bp.blogspot.com/_ue2_vDGeEV8/TGwi5oOiL2I/AAAAAAAAC8I/vN92gVkQEYs/s1600/modernarchitect.jpg",
	    "http://www.trendir.com/house-design/modern-spanish-architecture-8.jpg"
    ]
});


brace = new Bracelet("starter", {
    //orientation	: "vertical",
    cycle		: true,
    speed		: 100
});

window.onresize = brace.resize;


});