//
//	NOTE!!!!
//
//	This implementation is from an independent, non-jquery component.
//	As such it sets various document-level event handlers.
//	TODO!: Rework into a proper bit, isolating container.
//

Terrace.subscribe("bit:ui:loaded", function(bit) {

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

var Slider = function(options) {

	options = options || {};

	var E 	= new Events("slider");
	var css = E.css;

	var min;
	var max;
	var container;
	var cchildren;
	var elTicker;
	var elRangeInset;
	var elRangeFill;
	var elLeftHandleNet;
	var elLeftHandle;
	var elRightHandleNet;
	var elRightHandle;
	var elLeftDisplay;
	var elRightDisplay;
	var elLeftCurDisplay;
	var elRightCurDisplay;
	var regionLeft;
	var regionWidth;
	var handleWidth;
	var handleNetWidth;
	var halfHandleWidth;
	var curDisplayBorder;
	var curDisplayWidth;
	var rangeInsetHeight;
	var rangeFillHeight;
	var handleHeight;
	var tickerHeight;
	var tickerWidth;
	var curDisplayHeight;
	var sideDisplayHeight;
	var sideDisplayWidth;
	var	tickOffset;
	var handle;
	var rangeDrag;
	var dragMax;
	var dragMin;
	var delta;
	var scale;
	var activePoint;
	var leftActivePoint;
	var rightActivePoint;
	var lastLeftActivePoint;
	var lastRightActivePoint;
	var curLeftValue;
	var curRightValue;
	var lastLeftValue;
	var lastRightValue;
	var lastHandlePosition;
	var handleMoveSound;
	var lastMousedownX;
	var pixelValueMap;
	var tickSnapMap;
	var tickPositions;
	var clickThreshold;

	var _l = "left";
	var _r = "right";
	var _w = "width";
	var _h = "height";
	var _t = "top";

	//	Only need to create these once, even through #refresh.
	//	@see	drawTicks()
	//
	var tick = document.createElement("div");
	tick.setAttribute("class", "tickmark");
	var label = document.createElement("div");
	label.setAttribute("class", "ticklabel");

	//	##Sound
	//
	//	A general sound constructor. Expects a filename without extension.
	//	Browsers do not consistently support audio types. All browsers that
	//	support the audio api will support either .ogg or .mp3 or both.
	//	Create two files, .ogg and .mp3, of the sound file you will use.
	//	Pass the root filename to the constructor (ie. without an extension).
	//
	//	@example	var s = new Sound("mysoundfile"); // one of .ogg or .mp3 will load
	//				s.play();
	//
	var Sound = function(fileName, opts) {

		opts = opts || {};

		var a 		= document.createElement('audio');
		var ogg 	= !!(a.canPlayType && a.canPlayType('audio/ogg; codecs="vorbis"').replace(/no/, ''));
		var sound 	= new Audio(fileName += ogg ? ".ogg" : ".mp3");

		sound.preload 	= true;

		return {
			play	: function(vol) {
				sound.volume = opts.volume || .1;
				sound.play();
			}
		}
	}

	//	##getHandlePositionValue
	//
	var getHandlePositionValue = function(d) {
		var p = d === _l
				? leftActivePoint
				: d === _r
					? rightActivePoint
					: activePoint;

		//	Return value at pixel index.  See initialization of ticks.
		//
		return pixelValueMap[p];
	};

	//	##handleInfo
	//
	var handleInfo = function(h) {
		var cs	= css(_l, h === _l ? elLeftHandle : elRightHandle);

		return {
			left	: cs,
			right	: cs + handleWidth
		};
	};

	//	##animateToActivePoint
	//
	//	Whenever a click happens in a select-region of the slider that is
	//	not a handle, we animate the nearest handle to that point.  NOTE that
	//	clicking between handles (on the range fill) does not cause handles
	//	to move, as that action is the start of a range fill drag.
	//
	var animateToActivePoint = function(e) {
		var hL 	= handleInfo(_l).left;
		var hR	= handleInfo(_r).right;
		var h 	= activePoint < hL
					? elLeftHandle
					: activePoint > hR
						? elRightHandle
						: (activePoint - hL) > (hR - activePoint)
							? elRightHandle
							: elLeftHandle;
		if(h) {
			var start 	= parseInt(h.style.left);
			var end 	= -start + activePoint;

			//	Animation will call F on each tick, passing it the current
			//	animation position.
			//
			new E.Animation(start, end, options.animationSpeed, function(pos) {
				updateActivePoint(Math.ceil(pos));
				lastMousedownX = 0;
				updateHandlePosition(h);
				updateCurrentPositionDisplay(h);
			});
		}
	};

	//	##updateHandlePosition
	//
	var updateHandlePosition = function(h) {

		//	When we are in #snapTo mode recalculate #activePoint
		//
		if(options.snapTo) {
			updateActivePoint(tickSnapMap[activePoint]);
		}

		var newPos	= activePoint - halfHandleWidth;
		var isLeft	= h === elLeftHandle;

		//  Store last handle position to avoid duplicate work when in
		//	snapTo mode (where the same position is re-sent across pixel ranges).
		//
		if(lastHandlePosition === newPos) {
			return;
		}
		lastHandlePosition = newPos;

		//	Move handle, updateActivePoints, move handle net.
		//
		css(_l, newPos, h);
		isLeft ? (leftActivePoint = activePoint) : (rightActivePoint = activePoint);
		css(_l, newPos - (handleNetWidth - handleWidth)/2, isLeft ? elLeftHandleNet : elRightHandleNet);

		//	Fire sounds if requested as handles hit tick marks.
		//
		if(!rangeDrag && tickPositions[activePoint] && options.withSound) {
			if(!handleMoveSound) {
				handleMoveSound = new Sound(options.withSound);
			}
			handleMoveSound.play();
		}

		updateRangePosition();
		updateHandlePositionDisplay();
	};

	//	##updateRangePosition
	//
	//	Updates the range position both for when dragging
	//	a handle, or dragging the range itself.
	//
	var updateRangePosition = function(dragging) {
		var e = dragging;
		if(e) {
			var diff 	= -lastMousedownX + activePoint;
			var left	= lastLeftActivePoint + diff;
			var right	= lastRightActivePoint + diff;

			//	If the range movement has pushed either the left or the right
			//	handle past its allowed boundaries do not update the range, as
			//	this means it will change in width.
			//
			if(updateActivePoint(left) !== left || updateActivePoint(right) !== right) {
				return;
			}

			updateActivePoint(left);
			updateHandlePosition(elLeftHandle);

			updateActivePoint(right);
			updateHandlePosition(elRightHandle);
		}

		css(_l, leftActivePoint, elRangeFill);
		css(_w, rightActivePoint - leftActivePoint, elRangeFill);
	};

	//	##updateCurrentPositionDisplay
	//
	//	The display immediately above the handle being dragged.
	//
	var updateCurrentPositionDisplay = function(handle) {

		var cdw		= curDisplayWidth/2;
		var v 		= "visibility";
		var vv		= "visible";
		var isLeft	= handle === elLeftHandle;
		var rWidth	= rightActivePoint - leftActivePoint;
		var rCent	= leftActivePoint + Math.floor(rWidth/2);

		css(_l, leftActivePoint - cdw, elLeftCurDisplay);
		css(_l, rightActivePoint - cdw, elRightCurDisplay);
		elLeftCurDisplay.innerHTML 	= getHandlePositionValue(_l);
		elRightCurDisplay.innerHTML = getHandlePositionValue(_r);

		if(handle) {
			css(v, vv, isLeft ? elLeftCurDisplay : elRightCurDisplay);
			css(v, "hidden", isLeft ?  elRightCurDisplay : elLeftCurDisplay);
		} else {

			//	When no handle is set then we are updating both displays. This
			//	normally happens when a range is being dragged. Now the
			//	possibility of overlap exists. Recalculate l/r in those
			//	cases
			//

			if(rWidth < curDisplayWidth) {
				css(_l, rCent - curDisplayWidth, elLeftCurDisplay);
				css(_l, rCent + 1, elRightCurDisplay);
			}

			//Math.max(0, rangeWidth/2 - (displayerWidth/2))

			css(v, vv, elLeftCurDisplay);
			css(v, vv, elRightCurDisplay);
		}
	};

	//	##hideCurrentPositionDisplay
	//
	var hideCurrentPositionDisplay = function(handle) {
		var v 		= "visibility";
		var h 		= "hidden";
		if(handle) {
			css(v, h, (handle === elLeftCurDisplay ? elLeftCurDisplay : elRightCurDisplay));
		} else {
			css(v, h, elLeftCurDisplay);
			css(v, h, elRightCurDisplay);
		}
	};

	//	##updateHandlePositionDisplay
	//
	//	Display the left/right handle position values.
	//
	var updateHandlePositionDisplay = function() {
		elLeftDisplay.innerHTML 	= curLeftValue		= getHandlePositionValue(_l);
		elRightDisplay.innerHTML 	= curRightValue 	= getHandlePositionValue(_r);
	};

	//	##updateActivePoint
	//
	//	Ensure active points are within acceptable range.
	//
	//	Active points are the points which handles adhere to. If we receive
	//	an event object, we set the active point to event.x, which is the point
	//	the operator clicked. We might also receive a point (number) directly.
	//
	var updateActivePoint = function(e) {
		activePoint = typeof e === "number" ? e : e ? e.x - delta : 0;
		if(activePoint <= dragMin) {
			activePoint = dragMin;
		} else if(activePoint >= dragMax) {
			activePoint = dragMax;
		}
		return activePoint;
	};

	//	##storeLastPosition
	//
	var storeLastPosition = function(left, right) {

		lastLeftActivePoint 	= leftActivePoint;
		lastRightActivePoint	= rightActivePoint;

		lastLeftValue	= curLeftValue;
		lastRightValue 	= curRightValue;

		if(left && right) {
			lastLeftValue 	= left;
			lastRightValue 	= right;
		}
	}

	//	##undo
	//
	//	Move handles to previous position, if any.
	//
	var undo	= function() {
		jumpToValue(lastLeftValue, lastRightValue);
	};

	//	##jumpToValue
	//
	//	Jump a handle to a value on the ticker.
	//	Defaults to left handle.
	//
	//	@param	{Number}	val		The value. If none, default to zero.
	//	@param	{Boolean}	right	Default is left handle. Set for right.
	//
	var jumpToValue = function(a, b) {

		var left;
		var right;
		var v;
		var nL;
		var nR;

		//	If we receive a handle + value update the relevant l/r value.
		//
		if(typeof a === "object") {
			if(a === elLeftHandle) {
				left = b;
			} else {
				right = b;
			}
		} else {
			left 	= a;
			right	= b;
		}

		for(v in pixelValueMap) {
			if(pixelValueMap[v] === left) {
				nL = +v;
			} else if(pixelValueMap[v] === right) {
				nR = +v;
			}

			if(nL && nR) {
				updateActivePoint(nL);
				updateHandlePosition(elLeftHandle);
				updateActivePoint(nR);
				updateHandlePosition(elRightHandle);
				updateCurrentPositionDisplay();
				break;
			}
		}
	};

	//	##jumpToPosition
	//
	//	Jump a handle to a pixel position in the ticker.
	//
	var jumpToPosition = function(a, b) {
		if(typeof a === "object") {
			jumpToValue(a, pixelValueMap[b]);
		} else {
			jumpToValue(pixelValueMap[a], pixelValueMap[b]);
		}
	};

	//	##drawTicks
	//
	//	Draws the ticks and labels for the slider. Sets "global" variables #scale,
	//	#pixelValueMap,  #tickSnapMap.
	//
	var drawTicks = function() {

		min	= options.minValue;
		max	= options.maxValue;

		var precision		= options.precision;
		var tickFunc		= options.drawTicks || function() { return -1; };
		var drawTick		= !!tickFunc;
		var curRangePos		= min;
		var lastValue 		= min;
		var lastPixel		= null;
		var lastTick		= null;
		var tickDist		= 0;
		var tw				= tickerWidth;
		var lastTw;
		var lastSnapV;
		var tickFuncResult;
		var cv;
		var tclone;
		var lclone;
		var curPixel;
		var moff;
		var i;

		//	Set the ticker scale.
		//
		scale	= (max-min)/(tickerWidth - tickOffset*2);

		//	Count through the given range, pass tick function the current value,
		//	and based on its response, create ticks, labels, etc.
		//
		do {
			cv 		= curRangePos / scale;
			moff 	= min / scale;

			// 	A range of numbers is being mapped to a fixed pixel width. So if you
			//	are mapping a range of 600 within a 300 pixel wide slider space each
			//	pixel will map to a multiple ~ 2, for example.
			//
			curPixel = Math.ceil(cv - moff + tickOffset);

			//	The user supplied function that tells us whether to create a tick.
			//
			tickFuncResult = tickFunc(curRangePos);

			//	Because we are likely scaling a range down (ie. our numeric range
			//	has to be fit into a smaller total pixel width) #curPixel (via
			//	flooring of #cv and #moff) will often repeat the same values.  We
			//	want to avoid creating duplicates, so skip if #curPixel === #lastPixel.
			//	However, we do not want to skip any values which are major/minor ("ticked").
			//	So, we ensure that a major/minor result appears in the displayed range.
			//
			if(curPixel === lastPixel && tickFuncResult === -1) {
				continue;
			}

			if(tickFuncResult !== -1) {

				//	#tickSnapMap, #pixelValueMap map data to pixel positions.
				//	In cases where we are using #snapTo or #fuzzyRange the
				//	mapping pivots on ticks -- if we're snapping, for example,
				//	each pixel does not have an individual value but is mapped
				//	to the previous tick (as we can't know when the *next* tick
				//	is going to appear).  Once we hit a  tick, we want to adjust
				//	these settings, such that at ~ midpoint between ticks we
				//	snap to (or display) the current tick, instead of always
				//	referring to the previous tick.
				//
				if(lastTick) {
					tickDist = parseInt((curPixel - lastTick)/2);
					while(tickDist--) {
						tickSnapMap[curPixel - tickDist] = curPixel;
						if(options.fuzzyRange) {
							pixelValueMap[curPixel - tickDist] = curRangePos;
						}
					}
				}

				//	A lookup useful for checking whether any given pixel
				//	is a tick point.
				//
				tickPositions[lastTick = curPixel] = curRangePos;

				//	Maps the value that should be displayed when a pixel
				//	is hovered over.
				//
				pixelValueMap[curPixel] = curRangePos;
				lastValue 				= curRangePos;

				//	Create ticks, and if a major tick (===1) create label.
				//
				if(drawTick) {
					tclone = tick.cloneNode(true);
					css(_l, curPixel, tclone);
					elTicker.appendChild(tclone);

					if(tickFuncResult === 1) {
						lclone = label.cloneNode(true);
						lclone.appendChild(document.createTextNode(curRangePos));
						elTicker.appendChild(lclone);
						css(_l, tickOffset + cv - moff - css(_w, lclone)/2, lclone);
					}
				}
			} else {
				pixelValueMap[curPixel] = options.fuzzyRange ? lastValue : curRangePos;
			}

			tickSnapMap[curPixel] = lastTick;

		} while((curRangePos = +(curRangePos + precision).toFixed(2)) <= max);

		//	If the sent range is smaller than the total pixel width of the ticker,
		//	then there will be gaps in the pixel map. Simply fill gaps with
		//	next mapped value.
		//
		if((max-min) < tw) {
			while(tw--) {
				if(pixelValueMap[tw] === void 0) {
					pixelValueMap[tw]	= lastTw || max;
					tickSnapMap[tw] 	= lastSnapV || max;
				}
				lastTw 		= pixelValueMap[tw];
				lastSnapV 	= tickSnapMap[tw];
			}
		}

		//	Ensure that tick position value is sync'ed with value map. These
		//	can go out of sync with decimal precision.
		//
		for(i in tickPositions) {
			pixelValueMap[i] = tickPositions[i];
		}

		//console.log(pixelValueMap);
		//console.log(tickSnapMap);
		//console.log(tickPositions);
	};

	//	##build
	//
	var build = function(opts) {

		var lrv;
		var fTick;
		var lTick;

		//	Can override existing options
		//
		for(var p in opts) {
			options[p] = opts[p];
		}

		var slider	= document.getElementById(options.id);

		if(slider.childNodes.length < 1) {
			slider.innerHTML = '\
				<div class="container" data-slider="control-region">\
					<div class="ticker" data-slider="control-region select-region"></div>\
					<div class="range-inset rounded-corners-3" data-slider="control-region select-region">\
						<div class="range-inset-inner" data-slider="control-region select-region"></div>\
					</div>\
					<div class="range-fill rounded-corners-3" data-slider="range-fill control-region select-region">\
						<div class="range-fill-inner" data-slider="range-fill control-region select-region"></div>\
					</div>\
					<div class="handle-net left-handle-net" data-slider="handle select-region"></div>\
					<div class="handle left-handle" data-slider="handle select-region"></div>\
					<div class="handle-net right-handle-net" data-slider="handle select-region"></div>\
					<div class="handle right-handle" data-slider="handle select-region"></div>\
					<div class="rl-value-display left-value-display" data-slider="control-region"></div>\
					<div class="rl-value-display right-value-display" data-slider="control-region"></div>\
					<div class="current-value-display rounded-corners-3" data-slider="control-region"></div>\
					<div class="current-value-display rounded-corners-3" data-slider="control-region"></div>\
				</div>\
				<div class="bottom-border" data-slider="control-region"></div>';

			//	Add control-region to all parents.
			//
			var _obj = slider;
			do {
				if(_obj.nodeType === 1) {
					_obj.setAttribute("data-slider", "control-region");
				}
			} while(_obj = _obj.parentNode);

		} else {
			//	Exists. Going to be redrawn.
			//	Clean out the tick container, as this will be redrawn.
			//
			while(elTicker.hasChildNodes()) {
				elTicker.removeChild(elTicker.lastChild);
			}
		}

		container	= slider.children.item(0);
		cchildren	= container.children;

		//	The slider container width.
		//	You can also send nothing, which allows more css control,
		//	and flexibility if you want to resize later.
		//
		options.width && css(_w, options.width, container);

		elTicker			= cchildren.item(0);
		elRangeInset		= cchildren.item(1);
		elRangeFill			= cchildren.item(2);
		elLeftHandleNet		= cchildren.item(3);
		elLeftHandle		= cchildren.item(4);
		elRightHandleNet	= cchildren.item(5);
		elRightHandle		= cchildren.item(6);
		elLeftDisplay		= cchildren.item(7);
		elRightDisplay		= cchildren.item(8);
		elLeftCurDisplay	= cchildren.item(9);
		elRightCurDisplay	= cchildren.item(10);

		//	Initialize the handle positions, relative to tickline, etc.
		//
		regionLeft 			= container.offsetLeft;
		regionWidth 		= css(_w, container);
		handleWidth			= elLeftHandle.offsetWidth;
		curDisplayWidth		= css(_w, elLeftCurDisplay);
		rangeInsetHeight	= elRangeInset.offsetHeight;
		rangeFillHeight		= elRangeFill.offsetHeight;
		handleHeight		= elLeftHandle.offsetHeight;
		tickerHeight		= elTicker.offsetHeight;
		tickerWidth			= css(_w, elTicker);
		curDisplayHeight	= elLeftCurDisplay.offsetHeight;
		sideDisplayHeight	= elLeftDisplay.offsetHeight;
		sideDisplayWidth	= css(_w, elLeftDisplay);

		halfHandleWidth		= Math.floor(handleWidth/2);

		//	See bottom, where component elements are relatively positioned.
		//
		curDisplayBorder 	= elLeftCurDisplay.offsetHeight - curDisplayHeight;

		//	Distances from the left and right of the slider container representing
		//	the leftmost and rightmost ends of the range.
		//
		tickOffset 	= options.tickOffset || halfHandleWidth;

		handle		= false;
		rangeDrag	= false;
		dragMax		= regionWidth - tickOffset;
		dragMin		= tickOffset;
		delta		= regionLeft + tickOffset - halfHandleWidth;
		scale		= 1;

		activePoint				= 0;
		leftActivePoint			= dragMin;
		rightActivePoint 		= dragMax;
		lastLeftActivePoint		= 0;
		lastRightActivePoint	= 0;
		lastHandlePosition		= null;
		handleMoveSound			= null;

		lastMousedownX = 0;

		//	Ranges are compressed into a fixed space (the container of the slider).
		//	Each pixel in that space is mapped to a value (what you see when your
		//	mouse is over a pixel). Each tick is further mapped, used when we
		//	are using #snapTo and #fuzzyRange. Exact tick positions stored as well.
		//
		//	@see	#drawTicks
		//
		pixelValueMap	= {};
		tickSnapMap		= {};
		tickPositions	= {};

		clickThreshold	= options.clickThreshold || 2;

		//	The drawing of tick marks for the slider.
		//
		drawTicks();

		//console.log(pixelValueMap)

		//	Set up catch nets for clicks around handles.
		//
		handleNetWidth		= parseInt(css(_w, handleWidth + (options.handleBuffer || 10), elLeftHandleNet));
		css(_w, handleNetWidth, elRightHandleNet);

		//	Set handles at left/right-most positions.
		//
		fTick	= updateActivePoint(-Infinity);
		lTick	= updateActivePoint(Infinity);

		css(_l, fTick - halfHandleWidth, elLeftHandle);
		css(_l, lTick - halfHandleWidth, elRightHandle);
		css(_l, fTick - handleNetWidth/2, elLeftHandleNet);
		css(_l, lTick - handleNetWidth/2, elRightHandleNet);

		//	Set ranges to proper dimensions
		//
		css(_l, fTick, elRangeFill);
		css(_w, lTick - fTick, elRangeFill);
		css(_l, fTick, elRangeInset);
		css(_w, lTick - fTick, elRangeInset);

		//	Set nets to handle height.
		//
		css(_h, handleHeight, elLeftHandleNet);
		css(_h, handleHeight, elRightHandleNet);

		//	TODO: Most of the below could probably be handled algorithmically,
		//	determining based on position in the component element stack.
		//


		//	Position fill range. Inset range is actually the first element under
		//	ticker, so does not need to be positioned.
		//
		css(_t, -rangeFillHeight, elRangeFill);

		//	Position handles
		//
		//	NOTE: handleNetHeight === handleHeight;
		//
		css(_t, -(rangeFillHeight + handleHeight*2 - rangeFillHeight/2), elLeftHandle);
		css(_t, -(rangeFillHeight + handleHeight*4 - rangeFillHeight/2), elRightHandle);
		css(_t, -(rangeFillHeight + handleHeight - rangeFillHeight/2), elLeftHandleNet);
		css(_t, -(rangeFillHeight + handleHeight*3 - rangeFillHeight/2), elRightHandleNet);

		//	Handle z-indexing of handles
		//
		css("z-index", 100, elLeftHandle);
		css("z-index", 101, elRightHandle);

		//	The current value displays.
		//
		css(_t, -(curDisplayHeight + tickerHeight + handleHeight*3 + sideDisplayHeight*2), elLeftCurDisplay);
		css(_t, -(curDisplayHeight*2 + tickerHeight + handleHeight*3 + sideDisplayHeight*2), elRightCurDisplay);

		//	The r/l value displays
		//
		css(_t, -(rangeFillHeight + handleHeight*4 + sideDisplayHeight), elLeftDisplay);
		css(_l, -(sideDisplayWidth), elLeftDisplay);
		css(_l, regionWidth + handleWidth, elRightDisplay);
		css(_t, -(rangeFillHeight + handleHeight*4 + sideDisplayHeight + sideDisplayHeight), elRightDisplay);

		//	For IE we limit text selection with this call. Others should be covered
		//	by the CSS solution provided. See css definition for `.slider`.
		//
		slider.onselectstart = function(){
			return false;
		};

		//	If there are existing values then this #build method is being
		//	called via #refresh. Maintain existing handle positions in new rendering.
		//
		if(curLeftValue) {
			jumpToValue(curLeftValue, curRightValue);
		} else {
			//	Seed history.
			//
			storeLastPosition(min,max);
		}
	};

	E.on("mousedown", "range-fill", function(e) {
		rangeDrag = e.el;
		storeLastPosition();
	});

	E.on("mousedown", "select-region", function(e) {

		//	These are always the default min/max bounds. When a handle
		//	is selected, however, one bound changes to the edge of the
		//	opposite handle: if we've selected the left handle, its right
		//	bound is now the left edge (or so) of the right handle. Etc.
		//
		dragMin = tickOffset;
		dragMax = regionWidth - tickOffset;

		handle	= false;

		var net	= e.hasClass("handle-net");

		if(net || e.hasClass("handle")) {
			handle 	= net ? e.el.nextSibling.nextSibling : e.el;

			E.addClass("handleActive", handle);

			if(handle === elLeftHandle) {
				dragMax = css(_l, elRightHandle) - halfHandleWidth;
			} else {
				dragMin = css(_l, elLeftHandle) + handleWidth + halfHandleWidth;
			}

			storeLastPosition();
		}

		updateActivePoint(e);

		//	Store, mainly to check movement threshold on mouseup.
		//
		lastMousedownX = activePoint;

		//	Exit if we're clicking on a range-fill.
		//
		if(e.el === elRangeFill || e.el.parentNode === elRangeFill) {
			return;
		}

		if(handle) {
			updateHandlePosition(handle);
			updateCurrentPositionDisplay(handle);
		} else {
			animateToActivePoint(e);
		}
	});

	E.on("mousemove mouseup", "control-region handle", function(e) {
		var mv 			= Math.abs(lastMousedownX - (e.x - delta))
		if(e.type === "mouseup") {

			E.removeClass("handleActive", handle);

			handle 		= false;
			rangeDrag	= false;

			hideCurrentPositionDisplay();

			//	Treating this a click. Jump to point.
			//	Threshold === distance to move before we call this a drag.
			//
			if(mv >= 0 && mv <= clickThreshold) {
				updateActivePoint(e);
				animateToActivePoint(e);
			}

			return;
		}

		updateActivePoint(e)

		if(handle) {
			updateHandlePosition(handle);
			updateCurrentPositionDisplay(handle);
		} else if(rangeDrag) {
			updateRangePosition(e);
			updateCurrentPositionDisplay();
		}

		updateHandlePositionDisplay();
	});

	build();

	return {

		refresh	: function(opts) {
			build(opts);
		},

		jumpToPosition 	: jumpToPosition,
		jumpToValue		: jumpToValue,
		undo			: undo
	};
};

		slider = new Slider({
			id				: "sliderA",
			minValue		: 0,
			maxValue		: 300,
			width			: 310,
			tickOffset		: 5,
			handleBuffer	: 10,
			animationSpeed	: 60,
			precision		: 1,
			clickThreshold	: 2,
			snapTo			: false,
			fuzzyRange		: false,
			withSound		: false,//"tick",
			opacity			: .1,

			drawTicks		: function(i) {
				return 	i % 100 === 0
						? 1
						: i % 50 === 0
							? 0
							: -1;
			}

		});

return;

        window.onresize = function() {

			var c = document.body.clientWidth;
			var w = parseInt(Math.random() * 3000);

			document.getElementById("sliderA").style.width = (c - 100 + "px");
			document.getElementById("sliderA").childNodes.item(1).style.width = (c - 200 + "px");
/*
			slider.refresh({
				minValue	: 100,
				maxValue	: w - (w%50) + 100,
				precision	: 1
			})
*/
			slider.refresh({
				width: c - 200
			})

		}

});