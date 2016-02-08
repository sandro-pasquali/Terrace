Terrace.subscribe("bit:list:loaded", function(bit) {
	console.log("LIST PRIME")

	bit.view.exposeEvent("click")

	bit.controller.click(function() {
		console.log("____ CLICK ____");
	});
});
