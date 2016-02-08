Terrace.subscribe("bit:grid:loaded", function(bit) {

    var grid;

	var data = [];
	for(var i = 0; i < 500; i++) {
		data[i] = {
		title: "Task " + i,
		duration: "5 days",
		percentComplete: Math.round(Math.random() * 100),
		start: "01/01/2009",
		finish: "01/05/2009",
		effortDriven: (i % 5 == 0)
		};
	}

	bit
		.model
		.set("data", data)
		.set("options", {
			enableCellNavigation: true,
			enableColumnReorder: false
		})
		.set("columns", [
			{id: "title", name: "Title", field: "title"},
			{id: "duration", name: "Duration", field: "duration"},
			{id: "%", name: "% Complete", field: "percentComplete"},
			{id: "start", name: "Start", field: "start"},
			{id: "finish", name: "Finish", field: "finish"},
			{id: "effort-driven", name: "Effort Driven", field: "effortDriven"}
		]);

	bit
		.load
			.css("vendor/SlickGrid/slick.grid.css")

			//	Add this if you are using a layout with jqueryUI theme support.
			//.css("vendor/SlickGrid/css/smoothness/jquery-ui-1.8.16.custom.css")

			.js("vendor/SlickGrid/lib/jquery.event.drag-2.0.min.js")
			.js("vendor/SlickGrid/slick.core.js")
			.js("vendor/SlickGrid/slick.grid.js")
			//.js("!/delay/1000/")
		.done();
});
