//	%notifier
//
//	The controller simply listens for !.notification events.  This is a fancier notifier,
//	intended to augment the basic Terrace#notify functionality.
//
//	@see	Terrace#notify
//
Terrace.subscribe("bit:notifier:loaded", function(bit) {
	this.subscribe('.notification', function(ob) {

//console.log(this.data.$get("system:options"));

		if(!ob) {
			return;
		}

		var type 	= ob.type || "info";
		var msg		= ob.msg;
		var notice 	= "";

		//	if value of type is `1`, it is sticky.
		//
		var types = {
			announce	: 0,
			saving		: 0,
			error		: 1,
			info		: 0,
			help		: 1,
			deleting	: 0,
			loading		: 0,
			alert		: 1,
			note		: 0,
			publishing	: 0
		}

		notice = '\
			<div class="notifier">\
				<div class="notifier-icon notifier-icon-' + type + '" alt="" ></div>\
				<div class="notifier-body">';

					notice += '<h3>' + ob.title + '</h3>';
					notice += '<p>' + msg + '</p>\
				</div>\
				<div class="notifier-bottom"></div>\
			</div>';

		jQuery(notice).purr({
			usingTransparentPNG	: true,
			isSticky			: !!types[type],

			removeTimer			: ob.delay || 3000

			//removeTimer			: ob.delay || this.data.$get("system:options").notificationDelay


		});
	});
});