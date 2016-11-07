let buildReport = function(){
	let googleSheetAuthPromise = require(`${__dirname}/googleSheetAuth`)();
	let google = require('googleapis');
	let sheets = google.sheets('v4');

	/**
	 * Step 1: Open 'lunchMoneyId', get out users
	 * @type {[type]}
	 */
	let globalAuth;
	let globalUsers;
	let records;
	let startRow;
	let buildReportPromise =
		googleSheetAuthPromise
			.then(auth => {
				globalAuth = auth;

				let storage = require('node-persist');
				storage.initSync();

				let sheetLunchMoney = storage.getItemSync('sheetLunchMoney');

				let getUsersPromise =
					new Promise((resolve, reject) => {
						sheets.spreadsheets.values.get({
							auth: globalAuth,
							spreadsheetId: sheetLunchMoney.id,
							range: `${sheetLunchMoney['activeSheetName']}!1:1`
						}, function cb(err, res){
							if (err) {
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
				}
				
				globalUsers = rows[0];
				let dateMenusPromise = require(`${__dirname}/getMenu`)(false);

				return dateMenusPromise;
			})
			.then(dateMenus => {
				// Bring records in to global
				records = [];
				records.push([]); //empty row

				dateMenus.forEach(menu => {
					let recordMenuX = [];

					menu.dishes.forEach(dish => {
						let unmatchedUsers = [];

						recordMenuX[0] = menu.date;
						
						dish.users.forEach((user, userIndex) => {
							let matched = false;
							globalUsers.forEach((userName, index) => {
								// let matchPercent = natural.JaroWinklerDistance(user, userName);
								let isMatch = (user.toLowerCase() == userName.toLowerCase());
								let cellVal = '';
								if (index == 0){
									cellVal = menu.date;
									// }else if(matchPercent > 0.6){
								}else if(isMatch){
									matched = true;
									cellVal = dish.price;
								}
								recordMenuX[index] = cellVal;
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
				startRow = require(`${__dirname}/sheetRange`)();

				let _ = require(`${__dirname}/util`);
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

				let storage = require('node-persist');
				storage.initSync();
				
				let sheetLunchMoney = storage.getItemSync('sheetLunchMoney');
				
				let updateLunchMoney = 
					new Promise((resolve, reject) => {
						sheets.spreadsheets.values.append({
							auth: globalAuth,
							spreadsheetId: sheetLunchMoney.id,
							valueInputOption: 'USER_ENTERED',
							// range: '2016!A277:A277',
							range: `${sheetLunchMoney['activeSheetName']}!A${startRow}`,
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
			})
			.then((updateInfo) => {
				let moment = require('moment');
				let storage = require('node-persist');
				storage.initSync();
				let lastReportDate = moment().utcOffset(storage.getItemSync('timezone'));
				
				let lastReport = {
					date: lastReportDate.format(),
					numOfRows: updateInfo.numOfRows,
					startRow: updateInfo.startRow
				};
				storage.setItemSync('lastReport', lastReport);
				
				let sheetLunchMoney = storage.getItemSync('sheetLunchMoney');
				
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
							// console.log(err);
							reject('The API returned an error: ' + err);
						}
						resolve(res);
					});
				});

				return updateGlobalUsers;
			});

	return buildReportPromise;
}

// buildReport();

module.exports = buildReport;