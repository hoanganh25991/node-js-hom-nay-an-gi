let os = require('os');

let getWeekNumber = function(d){
    d.setHours(0,0,0,0);
    d.setDate(d.getDate()+4-(d.getDay()||7));
    return Math.ceil((((d-new Date(d.getFullYear(),0,1))/8.64e7)+1)/7);
};

let convertA1Notation = function(i){
	return (i >= 26 ? convertA1Notation((i / 26 >> 0) - 1) : '') +
		'abcdefghijklmnopqrstuvwxyz'[i % 26 >> 0];
}

let util = {
	eol: os.EOL,
	getWeekNumber,
	convertA1Notation
};

module.exports = util;