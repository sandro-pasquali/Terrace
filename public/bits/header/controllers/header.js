Terrace.subscribe("bit:header:loaded", function(bit) {

	var $ 	= this;
	var $j	= jQuery;

	var binding		= bit.model.$get("binding");
	var startIdx	= bit.params.$get("title");
	var startNode	= binding.sections[0];
	var url			= $.$url();

	bit.controller.click(function(ev, el) {
		var $link 	= $j(ev.target).closest("*[data-key]");
		var key 	= $link.attr("data-key");

		if(!key) {
			return;
		}

		var node = bit.model.$find("title", key, "", binding).node;

		if(!node) {
			return;
		}

		node = node.action;

		if($.is(String, node)) {
			top.location = node;
			return;
		}

		if($.is(Object, node) && node.type && node.atts) {
			$.bits.insert(node.target || document.body, node.type, node.atts, true);
		}
	});

	if(startIdx) {
		startNode = $.find("title", startIdx, "sections", binding).node;
	}

	bit.view.$get("node").find("a").each(function() {
		var $t = $j(this);
		//	If we hit on key AND the action doesnt match the current page
		//
		if($t.attr("data-key") === startNode.title && url.path.indexOf("/" + startNode.action) === -1) {
			$.subscribeOnce("bind:complete", function() {
				$t.trigger("click");
			});
		}
	});
});