Terrace.subscribe("bit:grid:loaded", function(bit) {

		var bM 		= bit.model;
		var data	= bM.$get("data");
		var columns	= bM.$get("columns");
		var options	= bM.$get("options");

		bit.view.$get("node").find(".slick-grid").each(function(i, g) {
			grid = new Slick.Grid(	"#__myGrid" + i, data, columns, options);
			$("#__myGrid" + i).show();
		});

});
