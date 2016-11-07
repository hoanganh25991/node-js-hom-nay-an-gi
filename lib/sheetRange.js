let sheetRange = function(){
	/**
	 * lunchMoneyConfig.json store lastReport info
	 * lastReport: {
		 *  date: '2016-11-06T09:43:13+07:00',
		 *  numOfRows: 8,
		 *  startRow: 277
		 * }
	 */
	let storage = require('node-persist');
	storage.initSync();

	let lastReport = storage.getItemSync('lastReport');
	console.log(lastReport);
	let moment = require('moment');
	lastReport.date = moment(lastReport.date);

	let timezone = storage.getItemSync('timezone');
	let today = moment().utcOffset(timezone * 60);
	// console.log(today.format());

	let lastReportWeek = lastReport.date.isoWeekday(1).week();
	let todayWeek = today.isoWeekday(1).week();
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

sheetRange();

module.exports = sheetRange;