Terrace.subscribe("bit:typesetter:loaded", function(bit) {
    var fonts = bit.params.$get("fonts").split(" ");
	this.each(fonts, function(f, i) {
		bit.load.css("fonts/" + f + "/stylesheet.css")
	});

	bit.load.done();
});