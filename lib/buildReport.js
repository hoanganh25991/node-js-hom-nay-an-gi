let _ = require(`${__dirname}/util`);
let authPromise = require(`${__dirname}/auth`)();
let google = require('googleapis');
let sheets = google.sheets('v4');

let storage = _.getStorage();
let moment = require('moment');

/**
 * Build rule
 * Interval loop run buildReport
 * Current 10m loop
 * But auto buildReport ONLY accept interval loop on Friday
 */
let buildReportRule = function(){
	let today = moment().utcOffset(storage.getItemSync('timezone'));
	// let today = moment().utcOffset(storage.getItemSync('timezone') * 60).isoWeekday('Friday');
	let friday = today.clone().isoWeekday('Friday');
	
	let isTodayFriday = today.isSame(friday, 'd');
	
	return {
		check(){
			return isTodayFriday && today.hours() > 9;
		},
		fail(){
			return !this.check();
		}
	}
};

/**
 * Build report read current state of nuiBayUtIt menu
 * then update needed info to lunchMoney
 * @returns {Promise.<TResult>}
 */
let buildReport = function(buidNow = true){
	console.log('Build report run, buildNow val', buidNow);
	/**
	 * Info need reference as global
	 */
	let globalAuth;
	let globalUsers;
	let storage = _.getStorage();
	// Bring to global
	let sheetLunchMoney = storage.getItemSync('sheetLunchMoney');
	let startRow;
	
	if(!buidNow){
		console.log(`buildRepot auto`);
		// if(buildReportRule().fail()){
		// 	console.log(`buildRepot rule FAIL`);
		// 	return new Promise(res => res(`Auto buildReport, not run bcs buildRule fail!`));
		// }

		console.log(`buildRepot rule OK`);
	}

	let buildReportPromise =
		authPromise
			.then(auth => {
				// Store this googleAuth for any call to google sheet in this file
				// googleAuth can be used up to 1 hour
				globalAuth = auth;
				// sheet LunchMoney config from storage
				// Call to google sheet through promise
				// Wait for return
				let getUsersPromise =
					new Promise((resolve, reject) => {
						sheets.spreadsheets.values.get({
							auth: globalAuth,
							spreadsheetId: sheetLunchMoney.id,
							range: `${sheetLunchMoney['activeSheetName']}!1:1`
						}, function cb(err, res){
							if (err) {
								console.log(err);
								reject('The API returned an error: ' + err);
							}

							resolve(res);
						});
					});

				return getUsersPromise;
			})
			.then(resGetUsers => {
				let rows = resGetUsers.values;
				if (!rows || rows.length == 0) {
					console.log('Fail to users from getUsersPromise_resGetUsers');
					return new Promise((resolve, reject) => reject('Fail to users from getUsersPromise_resGetUsers'));
				}
				// Store list users
				globalUsers = rows[0];
				// console.log(globalUsers);
				// Get menu, which contains needed info to update
				let dateMenusPromise = require(`${__dirname}/getMenu`)(false);

				return dateMenusPromise;
			})
			.then(dateMenus => {
				/**
				 * Records is array of each row, updated into lunchMoney
				 * @type {Array}
				 */
				let records = [];

				records.push([]); //empty row
				/**
				 * When new menu on next week come
				 * remove him out
				 */
				let now = moment().utcOffset(storage.getItemSync('timezone') * 60);
				dateMenus = dateMenus.filter(menu => {
					let menuDate = moment(menu.date, 'D-MMM-YYYY').utcOffset(storage.getItemSync('timezone') * 60);
					
					return menuDate.isSame(now, 'week');
				});

				if(dateMenus.length < 5){
					/**
					 * In this case, we don't have enough
					 * report for this week
					 * > no build more
					 */
					return new Promise((res, rej) => rej(`Not enough info to build report, dateMenus.lenght: ${dateMenus.length}`));
				}

				dateMenus.forEach(menu => {
					let recordMenuX = [];

					globalUsers.forEach(() => {
						recordMenuX.push('');
					});

					menu.dishes.forEach(dish => {
						let unmatchedUsers = [];

						recordMenuX[0] = menu.date;
						
						dish.users.forEach((user, userIndex) => {
							let matched = false;
							globalUsers.forEach((userName, index) => {
								// let matchPercent = natural.JaroWinklerDistance(user, userName);
								let isMatch = (user.toLowerCase() == userName.toLowerCase());
								/**
								 * Allow user pick more than one dish
								 */
								if(index != 0 && isMatch){
									matched = true;
									let sum = recordMenuX[index];

									if(recordMenuX[index] != ''){
										sum += dish.price;
										recordMenuX[index] = sum;
									}else{
										recordMenuX[index] = dish.price;
									}
								}
							});
							// Check if user not MATCH
							if (!matched) {
								unmatchedUsers.push(userIndex);
							}
						});

						// Handle unmatched users
						unmatchedUsers.forEach(userIndex => {
							// Push user into globalUsers
							globalUsers.push(dish.users[userIndex]);
							// Also update into recordMenuX
							recordMenuX.push(dish.price);
						});
					});

					records.push(recordMenuX);
				});

				// just empty rows for blank
				records.push([]); //empty row
				// records.push(['balance']);
				records.push([]); //for balance

				let balanceRow = records[records.length - 1];
				// Bring startRow in to global
				// let startRow = require(`${__dirname}/sheetRange`)();
				let startRowPromise = require(`${__dirname}/sheetRange`)();

				let promise =
					startRowPromise
						.then(startRowVal => {
							console.log(startRowVal);
							startRow = startRowVal;

							globalUsers.forEach((name, index) => {
								let startIndex = startRow;
								let cellVal = '';
								if(index == 0){
									cellVal = 'balance';
								}

								if(index > 0){
									let colName = _.convertA1Notation(index);
									let preBalanceIndex = startIndex - 1;
									let startSumIndex = startIndex + 1;
									let endSumIndex = startIndex + (records.length  - 1) -1 -1;

									let sumStr = `sum(${colName}${startSumIndex}:${colName}${endSumIndex})`;
									let formula = `=${colName}${preBalanceIndex} - ${sumStr}`;
									cellVal = formula;
								}

								balanceRow.push(cellVal);
							});

							let updateLunchMoney =
								new Promise((resolve, reject) => {
									sheets.spreadsheets.values.append({
										auth: globalAuth,
										spreadsheetId: sheetLunchMoney.id,
										valueInputOption: 'USER_ENTERED',
										// range: '2016!A277:A277',
										range: `${sheetLunchMoney['activeSheetName']}!A${startRow}:A${startRow}`,
										resource: {
											values: records,
											majorDimension: 'ROWS'
										}
									}, function cb(err) {
										if (err) {
											reject('The API returned an error: ' + err);
										}

										resolve({
											numOfRows: records.length,
											startRow: startRow
										});
									});
								});

							return updateLunchMoney;
						});

				return promise;
			})
			.then((updateInfo) => {
				// let moment = require('moment');
				let lastReportDate = moment().utcOffset(storage.getItemSync('timezone'));
				
				let lastReport = {
					date: lastReportDate.format(),
					numOfRows: updateInfo.numOfRows,
					startRow: updateInfo.startRow
				};
				storage.setItemSync('lastReport', lastReport);
				
				let updateGlobalUsers = new Promise((resolve, reject) => {
					sheets.spreadsheets.values.batchUpdate({
						auth: globalAuth,
						spreadsheetId: sheetLunchMoney.id,
						resource: {
							valueInputOption: 'USER_ENTERED',
							data: {
								range: `${sheetLunchMoney['activeSheetName']}!1:1`,
								values: [globalUsers],
								majorDimension: 'ROWS',
							}
						}
					}, function cb(err, res) {
						if (err) {
							console.log(err);
							reject('The API returned an error: ' + err);
						}
						resolve(res);
					});
				});

				return updateGlobalUsers;
			});

	return buildReportPromise;
}

module.exports = buildReport;