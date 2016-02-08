Terrace.subscribe("bit:upload:loaded", function(bit) {
	this.subscribe("server:upload:complete", function(r) {
		console.log(r);
	});
});
