Terrace.subscribe("bit:ui:loaded", function(bit) {

	var stepSetting = false;

	//stepSetting=20;


	// clear the $("#noUiSlider") div, then initialize.
	$(".noUiSlider").empty().noUiSlider( 'init', {

		step: stepSetting,
		change:
			function(){

				// the noUiSlider( 'value' ) method returns an array.
				var values = $(this).noUiSlider( 'value' );

				$(this).find('.noUi-lowerHandle .infoBox').text(values[0]);
				$(this).find('.noUi-upperHandle .infoBox').text(values[1]);

			},
		end:
			function(type){
				// 'type' can be 'click', 'slide' or 'move'
			}

	// the number displays aren't noUiSliders default, so we need to add elements for those.
	// index is a counter that counts all objects .each() has passed.
	}).find('.noUi-handle div').each(function(index){

		// appending the element, calling the 'value' function each time to get the value for the knob.
		$(this).append('<span class="infoBox">'+$(this).parent().parent().noUiSlider( 'value' )[index]+'</span>');

	});


});