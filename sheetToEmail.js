const linkEmail = 'https://script.google.com/macros/s/AKfycby8z-aB5cMxVFd6zMZnRq5GgTf8ja07QyzKNAHHTfw/dev';
let nBUUConfig = require(`${__dirname}/lib/nuiBayUtItConfig`);
let sheetName = nBUUConfig['sheet_name'];
let numOut = nBUUConfig['menu_range'].match(/\d+/g);
let startRow = numOut[0];
let endRow = numOut[1];
startRow = parseInt(startRow, 10);
endRow = parseInt(endRow, 10);

let day = new Date().getUTCDate();

const dayOfWeekConvert = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

let buildEmailLink = function(userTextArr){
	let userText = userTextArr['text'].replace(/\s+/g, ' ');
	// let responseUrl = req.param('response_url');
	// read user text
	let userTextArrTmp = userText.split(' ');

	let userInputDay = '';
	if(userTextArrTmp[1]){
		userInputDay = userTextArrTmp[1].toLocaleLowerCase();
	}

	
	let isUserInputDay = dayOfWeekConvert.indexOf(userInputDay) != -1;

	let sendForDay = new Date();
	
	if(isUserInputDay){
		let dayOfWeek = dayOfWeekConvert.indexOf(userInputDay);
		// let dayOfWeek = 5;
		let dd = new Date();
		let dayx = dd.getDay();
		let	diff = dd.getUTCDate() - dayx + (dayx == 0 ? -6 : 1) + dayOfWeek;

		sendForDay = new Date(dd.setDate(diff));
	}

	// let dayOfWeek = sendForDay.getDay() - 1;
	let dayOfWeek = sendForDay.getDay() - 1 + 1;
	// console.log(dayOfWeek);
	// let col = dayOfWeek * 6;
	let _ = require(`${__dirname}/lib/util`);
	console.log(_.convertA1Notation(dayOfWeek));
	let startCol = dayOfWeek * 6;
	let sRange = `${_.convertA1Notation(startCol)}${startRow}`;
	// let eRange = `${_.convertA1Notation(startCol + 5)}${endRow + 5}`;
	let eRange = `${_.convertA1Notation(startCol + 5)}${endRow + 4}`;
	let range = `${sRange}:${eRange}`;
	let link = linkEmail + `?sheet_name=${sheetName}&range=${range}`;
	console.log(link);

	return link;
}

module.exports =buildEmailLink;