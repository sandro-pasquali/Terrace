Terrace.subscribe("bit:generic:loaded", function(bit) {

	var $ 	= this;
	var $j	= jQuery;

	$.subscribe("%receiver:myEvent", function(data) {
	    //console.log("controller:");
	    //console.log(data);
	});
});