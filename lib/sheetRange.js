let _ = require(`${__dirname}/util`);
let storage = _.getStorage();

let google = require('googleapis');
let sheets = google.sheets('v4');

let globalAuth;

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
		console.log(`startRow for new week: ${startRow}`);
		/**
		 * At this point we unsure startRow just += lastReport.numOfRows
		 * may startRow +2 +3 bcs of NAME insert budget at early of each 2 month
		 */

		/**
		 * Open google sheet from startRow, down to several rows
		 * get out if it empty YEAH
		 */
		let authPromise = require(`${__dirname}/auth`)();
		
		let promise = 
			authPromise
				.then(auth => {
					globalAuth = auth;
					
					let sheetLunchMoney = storage.getItemSync('sheetLunchMoney');

					let getRowsFromStartRow =
						new Promise((resolve, reject) => {
							sheets.spreadsheets.values.get({
								auth: globalAuth,
								spreadsheetId: sheetLunchMoney.id,
								range: `${sheetLunchMoney['activeSheetName']}!A${startRow}:${startRow + 4}`
							}, function cb(err, res){
								if (err) {
									console.log(err);
									reject('The API returned an error: ' + err);
								}

								resolve(res);
							});
						});
					
					return getRowsFromStartRow;
				})
				.then(resRowsFromStartRow => {
					let rows = resRowsFromStartRow.values;
					if (!rows || rows.length == 0) {
						console.log('Fail to users from getUsersPromise_resGetUsers');
						return new Promise(reject => reject('Fail to users from getUsersPromise_resGetUsers'));
					}

					/**
					 * Find out where startRow
					 * should add up
					 */
					let rowsWithVal = rows.filter((row, rowIndex) => {
						console.log('row has lenght: ', row.length);
						let cellsHasVal = row.filter(cell => cell);

						return cellsHasVal.length > 0 || rowIndex == 0;
					});

					let addUp = rowsWithVal.length;

					startRow += addUp;
					console.log(`Add up ${addUp} to startRow`);
					return new Promise(res =>  res(startRow));
				});
		/**
		 * We need logic check here for what going on
		 * when Nam decide to add budget at first month
		 * (any time she want)
		 */
		
		return promise;
	}
	
	// console.log(startRow);
	return new Promise(res => res(startRow));
};

// sheetRange();

module.exports = sheetRange;