Terrace.subscribe("bit:header:loaded", function(bit) {
	bit.model.set("binding", {
		sections 	: [{
			title   : "scratch",
			action 	: {
				target	: "#container",
				type	: "generic",
				atts	: {
					id		: "demo-scratch",
					view	: "demo/demo.scratch.template"
				}
			}
		}, {
			title   : "nested",
			action 	: {
				target	: "#container",
				type	: "generic",
				atts	: {
					id		: "demo-nested",
					view	: "demo/demo.nested.template"
				}
			}
		}, {
			title   : "linked",
			action 	: {
				target	: "#container",
				type	: "generic",
				atts	: {
					id		: "demo-linked",
					view	: "demo/demo.linked.template"
				}
			}
		}, {
			title   : "editable",
			action 	: {
				target	: "#container",
				type	: "generic",
				atts	: {
					id		: "demo-editable",
					view	: "demo/demo.editable.template"
				}
			}
		}, {
			title   : "list",
			action 	: {
				target	: "#container",
				type	: "generic",
				atts	: {
					id		: "demo-list",
					view	: "demo/demo.list.template"
				}
			}
		}, {
			title   : "bracelet",
			action  : "bracelet.html"
		}, {
			title   : "todo",
			action  : "todo.html"
		}, {
			title   : "grid",
			action  : "grid.html"
		}]
	});

    //  Headers will likely want the document body content to drop below its bottom line.
    //  #padTop results in document.body.padding-top being set.
    //
    var padTop = bit.params.$get("padTop") || 54;

    this.styles.createSheet("body {padding-top: " + padTop + "px;}");

    $(".nav-collapse").collapse()


});
