"use strict";

module.exports = function(options) {

	options = options || {};

	var	$	= this;

	$.addKit("data", {

		//	This is the default initialization data (now accessible vie %data#$get)
		//
		init : 	{

			name					: "Terrace",
			version					: "0.1.5",

			permissionsMap          : {},

			validUploadTypes		: "pdf png",
			notificationDelay		: 5,
			dialogMinimizeWidth 	: 500,
			dialogDefaultWidth		: 690,
			dialogDefaultHeight 	: 460,
			dialogInitZIndex		: 10000,
			searchMaxResults		: 10,
			itemMaxHistoryEntries	: 10,

			bitFadeSpeed			: 400,

            //  The maximum amount of time a general XHR call can take prior to
            //  being considered a failure. This MAY be overridden by a specific
            //  implementation.
            //
            //  @see    %client
            //
            maximumXhrCallTime      : 2000,

			//	The maximum amount of time allowed for a bit to acquire its binding.
			//
			dataBindingTimeout      : 1000,

			//	The default maximum amount of time allowed for a bit to fully render. Total
			//	completion = loading dependencies, binding, and rendering. Each bit can
			//	set its own timeout via #data-timeout
			//
			defaultBitLoadTime		: 2000,

			//	The maximum amount of time allowed for the totality of the application view
			//	to render (all bits loaded, #bind has nothing to do).
			//
			applicationLoadTimeout	: 5000,

			//	The ms polling interval for bit timeouts when the bit has exceeded its
			//	timeout due to model dependency #loading. The bit timeout has a #retry action,
			//	this poll will continue until ~ retry*timeoutms have passed.
			//
			bitTimeoutRecheckMs		: 500,

			//	Whether to cache bit files, to be reused the next time.
			//	@see	%bits
			//
			cacheBitFiles			: false,

			bitData					: {

				"adder"             : {
					"data-controller"	: "adder.js",
					"data-view"			: "adder.html"
				},

				"bracelet"              : {

				},

				"footer"                : {
					"data-css"			: "footer.css"
				},

				"generic"          : {
				},


				"grid"                  : {
					"data-model"        : "slickgrid.js",
					"data-view"         : "demo.html"
				},

				"header"                : {
				    "data-controller"	: "header.js",
				    "data-view"         : "header.template",
				    "data-model"   		: "examples.header.js"
				},

				//	Note that default layout is bootstrap.
				//
				"layout"                : {
					"data-css"			: "/vendor/bootstrap/docs/assets/css/bootstrap.css bootstrap.css",
					"data-model"		: "bootstrap.js"
				},

				"list"                  : {
					"data-model"		: "list.js",
					"data-controller"	: "list.js lista.js listb.js"
				},

				"list-adder"			: {
					"data-controller"	: "list-adder.js"
				},

				"list-remover"			: {
				},

				"login"                 : {
					"data-controller"	: "login.js",
					"data-view"			: "login.template"
				},

				"notifier"              : {
					"data-model"		: "notifier.js",
					"data-controller"	: "notifier.js",
					"data-css"			: "notifier.css"
				},

				"slidePanel"            : {
					"data-controller"	: "slidePanel.js",
					"data-css"			: "slidePanel.css"
				},

				"stats"					: {
					"data-model"		: "stats.js"
				},

				"typesetter"	        : {
					"data-model"		: "typesetter.js"
				},

				"ui"					: {
					"data-model"		: "ui.js"
				},

				"upload"                : {
					"data-controller"   : "upload.js",
					"data-view"			: "upload.template"
				},

				"windbox"				: {
					"data-controller"	: "windbox.js",
					"data-css"			: "windbox.css",
					"data-view"			: "windbox.template"
				}
			}
		}
	});

	return $.data;

} // end exports / function