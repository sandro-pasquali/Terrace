module.exports = function(options) {

var $	= this;

//	Terrace dependencies
//
$.require("file");


const	http 		= require('http');
const	util 		= require('util');
const 	fs 			= require('fs');
const	exec		= require('child_process').exec;

//////////////////////////////////////////////////////////////////////////////////////////
//
//	'uploads' kit definition
//
//////////////////////////////////////////////////////////////////////////////////////////

$.addKit("uploads", {

});	//	End kit definition


return $.uploads;

} // end module export / function

