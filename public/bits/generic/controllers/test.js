Terrace.subscribe("bit:generic:loaded", function(bit) {

    bit.controller.click({
        exec : function() {
            Terrace.notify("****CLICKED", "announce");

            console.log(arguments)

        },
        undo : function() {

        }
	 });

	bit.controller.mouseover(function() {
	        console.log("*****MOVER")
	});
});
