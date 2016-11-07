let _ = require(`${__dirname}/util`);
let storage = _.getStorage();

let sheetRange = function(){
	let lastReport = storage.getItemSync('lastReport');
	let timezone = storage.getItemSync('timezone');

	let moment = require('moment');
	let lastReportDate = moment(lastReport.date).utcOffset(timezone * 60);
	// let lastReportDate = moment('2016-11-06T19:58:02+07:00');

	let today = moment().utcOffset(timezone * 60);
	// console.log(today.format());
	// Check week as ISO-week (start on monday)
	let lastReportWeek = lastReportDate.isoWeek();
	let todayWeek = today.isoWeek();

	console.log(lastReportWeek, todayWeek);

	/**
	 * lastReport week < thisWeek
	 * startRow today move on
	 */
	let startRow = lastReport.startRow;
	if(lastReportWeek < todayWeek){
		startRow += lastReport.numOfRows;
	}
	// console.log(startRow);

	return startRow;
};

// sheetRange();

module.exports = sheetRange;