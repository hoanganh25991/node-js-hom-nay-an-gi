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

let mondayOfNextWeek = function() {
	var d =  new Date();
	var diff = d.getUTCDate() - d.getUTCDay() + 1;
	diff += 7; // ugly hack to get next monday instead of current one

	return new Date(d.setUTCDate(diff));
};

let dayOfCurrentWeek = function(dayName) {
	// const dayNameOrders = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
	// var d = new Date();
	// var diff = d.getUTCDate() - d.getUTCDay() + 1;
	//
	// if(dayNameOrders.includes(dayName)){
	// 	diff += dayNameOrders[dayName]; // ugly hack to get next monday instead of current one
	// }else{
	// 	diff += 0;
	// }
	//
	// return new Date(d.setUTCDate(diff));
	let storage = require('node-persist');
	storage.initSync();

	let acceptedInputDates = storage.getItemSync('acceptedInputDates');
	let diff = acceptedInputDates.indexOf(dayName);
	console.log(diff);

	let moment = require('moment');
	let today = moment().utcOffset(storage.getItemSync('timezone'))
	let monday = today.startOf('isoWeek');;
	
	return monday.day(diff);
};

const rootFolder = __dirname.replace(/lib$/, '');
let getPath = function(folderName){
	folderName = folderName || '';
	if(folderName == '' || folderName == 'root'){
		return rootFolder;
	}
	
	return `${rootFolder}/${folderName}`;
};

let util = {
	eol: os.EOL,
	getWeekNumber,
	convertA1Notation,
	mondayOfNextWeek,
	dayOfCurrentWeek,
	getPath
};

module.exports = util;