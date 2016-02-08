Terrace.subscribe("bit:list-adder:loaded", function(bit) {
	var $			= this;
	var model		= bit.model;
	var controller	= bit.controller;
	var view		= bit.view;
	var $node		= view.$get("node");
	var binding		= bit.model.$set("binding", {});
	var targetModel	= $.bits.$get($node.parent().closest(".bits").attr("id")).model;

	controller.submit(function() {
		alert("SUBMIT");
		return false;
	});

	controller.click('button,input[type="submit"],input[type="button"]', function(ev, el, bitObj) {

console.log("ADDING>>>>");
		//	Get copy of local object, and check for duplicates in target.
		//
		var newob 	= $.copy(binding);
		var nLen	= $.$objectToArray(newob).length;
		var tOb		= targetModel.$get("binding");
		var attM;
		var t;
		var p;

		for(t in tOb) {
			attM = 0;
			for(p in newob) {
				if(newob[p] === tOb[t][p]) {
					console.log("HIT ON " + p)
					++attM;
				}
			}

			if(attM === nLen) {
				return;
			}
		}

		targetModel.last("binding", newob);

		console.log(binding)

		targetModel.shuffle("binding");
	});
});