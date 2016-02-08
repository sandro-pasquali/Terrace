Terrace.subscribe("bit:layout:loaded", function(bit) {

    var params      = bit.params;
    var responsive  = bit.params.$get("responsive");

    //  The plugins which are available to this layout.
    //
	var boots	= {
		alert		: "vendor/bootstrap/js/bootstrap-alert.js",
		button		: "vendor/bootstrap/js/bootstrap-button.js",
		carousel	: "vendor/bootstrap/js/bootstrap-carousel.js",
		collapse	: "vendor/bootstrap/js/bootstrap-collapse.js",
		dropdown	: "vendor/bootstrap/js/bootstrap-dropdown.js",
		modal		: "vendor/bootstrap/js/bootstrap-modal.js",
		//popover		: "vendor/bootstrap/js/bootstrap-popover.js", Constructor not defined error from jquery?
		scrollspy	: "vendor/bootstrap/js/bootstrap-scrollspy.js",
		tab			: "vendor/bootstrap/js/bootstrap-tab.js",
		tooltip		: "vendor/bootstrap/js/bootstrap-tooltip.js",
		transition	: "vendor/bootstrap/js/bootstrap-transition.js",
		typeahead	: "vendor/bootstrap/js/bootstrap-typeahead.js"
	};

    //  Will only execute for IE.
    //
	bit.load.conditional("if IE", "!http://html5shim.googlecode.com/svn/trunk/html5.js");

	//  Responsive plugin requires collapse. We load and remove from options to avoid
	//  duplicate loading.
	//
	if(responsive) {
	    bit .load
	        .css("/vendor/bootstrap/docs/assets/css/bootstrap-responsive.css")
	        .js(boots.collapse);

	    delete boots.collapse;
	}

    bit.params.get("using").within(function() {
        return this.$ ? this.$.split(",") : [];
    }).each(function(u) {
        boots[u] && bit.load.js(boots[u]);
    });

	bit.load.done();
});

