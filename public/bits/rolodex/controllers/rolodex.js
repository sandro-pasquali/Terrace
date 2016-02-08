Terrace.subscribe("bit:rolodex:loaded", function(bit) {

	var $			= this;
	var controller	= bit.controller;
	var model		= bit.model;
	var $view		= bit.$get("node");
	var tid			= $.uuid();

	$view.append('<ul id="rolodex-list-' + tid + '"></ul>');
	var container = $view.find("ul");

	$view.find("ul").append($.reduce(model.$get("binding.keywords"), function(a, e, i) {
		a.push('<li><a href="#">' + e["@displayName"] + '</a></li>');
		return a;
	}, []).join(""));

	$view.listmenu();

	console.log('rolodex');

	var addValue = function(valOb) {
	/*
	{
                	text	: title,
                	value	: value,
                	type	: tagId
                }
                */

        //	Update the data on the component, which will be checked by the Form
        //	#change handler (in component#form model).
        //
        var dataContainer = $view.closest(".ui.components");

        if(dataContainer.data("newValue") === undefined) {
            dataContainer.data("newValue", {
                name	: "autocomplete",
                value	: []
            });
        }

        dataContainer.data("newValue").value.push(valOb);
    }
});