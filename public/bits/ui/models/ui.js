Terrace.subscribe("bit:ui:loaded", function(bit) {

	var $		= this;
	var model 	= bit.model;

	var currentValue;
	var lastValue;

	model.set({
		value	: function() {
			return currentValue;
		},
		lastValue	: function() {
			return lastValue;
		}
	});

	model.extend({
		setCurrentValue	: function(v) {
			if(v === void 0) {
				return "";
			}
			lastValue		= $.copy(v);
			currentValue 	= v;
		}
	});
});