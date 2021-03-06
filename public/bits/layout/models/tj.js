//	Original idea for code highlighting in Express docs, which I assume TJ did, and hence...
//
Terrace.subscribe("bit:layout:loaded", function(bit) {

	var $node = bit.view.$get("node");
	
	var highlight = function(js) {
		return js
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/(["'].*?['"])/gm, '<span class="string">$1</span>')
			.replace(/\/\/(.*)/gm, '<span class="comment">//$1</span>')
			.replace(/(\d+\.\d+)/gm, '<span class="number">$1</span>')
			.replace(/(\d+)/gm, '<span class="number">$1</span>')
			.replace(/\bnew *(\w+)/gm, '<span class="keyword">new</span> <span class="init">$1</span>')
			.replace(/\b(function|new|throw|return|var|if|else)\b/gm, '<span class="keyword">$1</span>')
			.replace(/.(apply|call)\b/gm, '<span class="scope">.$1</span>')
	}
	
	$node.find('pre.js code').each(function(){
		$(this).html(highlight($(this).text()));
	})
});

