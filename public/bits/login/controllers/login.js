Terrace.subscribe("bit:login:loaded", function(bit) {

	var $ 		= this;
	var $j 		= jQuery;
	var globals	= $.data.$get("globals");

	$view = bit.view.$get("node");

	var $username	= $view.find(".username");
	var $password	= $view.find(".password");
	var $message	= $view.find(".message");
	var $submit		= $view.find(".submit");

	var authenticate = function() {
		$.client.post("/authenticate", {
			username 	: $username.val(),
			password 	: $password.val()
		}, function(data, resp, ob) {
			if(!resp) {
				return message("Unknown account, or bad password.");
			}
			document.location.href = "/";
		})
	};

	var validPassword = function() {
		var v = globals.regexp_password($password.val());

		if(!v) {
			message("Not a valid password");
		}

		return v;
	};

	var validUsername = function() {
		var un = $username.val();
		var v = globals.regexp_username(un);

		if(!v) {
			message("Not a valid username");
		}

		return v;
	};

	var message = function(msg) {
		$message.html(msg);
	};


	//	The login bit definition does not require the implementer to
	//	bind #data-events herself.
	//
	bit.view.exposeEvent("click focusout keydown");


	/*
	bit.view.hideEvent("mousedown mouseup");

setTimeout(function() {
	console.log("ADD");
	bit.view.exposeEvent("mousedown mouseup");
}, 2000);
*/
	bit.controller
	.click("#dummy", function() {
		$.client.post("/dummy", {
			foo: "BAR"
		}, function(data, resp, ob) {
			console.log(arguments)
		});
	})
	.click(".submit", function(ev, $targ) {
		validPassword() && validUsername() && authenticate();
	})
	.focusout(function() {
		message("");
		validUsername()
		&& Terrace.client.json("/usernameExists/" + $username.val(), function(err, data, transId) {
			(!$.is(Object, data) || data.body === "N")
			&& message("username <b>" + $username.val() + "</b> does not exist");
		});
	})
	//	Simply allowing submit on <return>
	//
	.keydown(function(ev) {
		if(ev.keyCode === 13) {
			$submit.click();
		}
	});

	setTimeout(function() {
		$view.trigger("mycustomevent");
	}, 500);

});
