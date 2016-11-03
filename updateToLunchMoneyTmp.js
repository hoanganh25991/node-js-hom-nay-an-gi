	let oauth2Promise = require(`${__dirname}/oauth2Client`)();
	let google = require('googleapis');
	// let natural = require('natural');

	const nuiBayUtItId = '1osEF3thjxDgQiXk95N-xc9Ms9ZtgYI1CmZgKCLwIamY';
	const lunchMoneyId = '1CM6BNJn4K24JZbn5zJLwkcES9BZ4o9wzr8t9W6kNb-8';

	let lunchMoneyConfig = require(`${__dirname}/lib/lunchMoneyConfig.js`);
	let updateConfig = false;
	let updatedRowsNum = 0;
	let today = new Date();
	let fs = require('fs');
	let lunchMoneyConfigStat = fs.statSync(`${__dirname}/lib/lunchMoneyConfig.json`);
	let mtime = lunchMoneyConfigStat.mtime;

	let _ = require(`${__dirname}/lib/util`);
	updateConfig = _.getWeekNumber(today) > _.getWeekNumber(new Date(mtime));
	// updateConfig = (_.getWeekNumber(today) + 1) > _.getWeekNumber(new Date(mtime));

	// check this config mtime
	// if older than this week
	// move on

	let sheets = google.sheets('v4');

	// Open 'lunchMoneyId', get out users
	// Open 'nuiBayUtItId', get menu on each day of week
	// Append back into 'lunchMoneyId'

	/**
	 * Step 1: Open 'lunchMoneyId', get out users
	 * @type {[type]}
	 */
	let globalAuth;
	let globalUsers;

	oauth2Promise
		.then(auth => {
			// console.log(auth);
			console.log('\033[32mAuth\033[0m: success');
			console.log(auth);
			globalAuth = auth;

			let getUsersPromise = new Promise((resolve, reject) => {
				sheets.spreadsheets.values.get({
					auth: globalAuth,
					spreadsheetId: lunchMoneyId,
					range: '2016!1:1'
				}, (err, res) => {
					if (err) {
						reject('The API returned an error: ' + err);
					}

					resolve(res);
				});
			});

			return getUsersPromise;
		})
		.then(res => {
			// console.log(res);
			console.log('\033[32mGot users\033[0m: success');
			// console.log(res);

			let rows = res.values;
			if (!rows || rows.length == 0) {
				reject('Fail to users from getUsersPromise_res');
			}
			//["", "Hoan", "Loc", "Duy", "Hoang", "Vinh", "Toan web", "Nam", "D. Vu"]
			globalUsers = rows[0];
			// console.log(globalUsers);
			let dateMenusPromise = require(`${__dirname}/getMenu`)(false);
			return dateMenusPromise;
		}).then(dateMenus => {
			// console.log('\033[32mdateMenus pass through promise\033[0m: success');
			// console.log('dateMenus.length', dateMenus.length);
			console.log(`Got dateMenus`);

			let records = [];
			// Empty row to separate,just UI
			records.push([]);

			dateMenus.forEach(menu => {
				let recordMenuX = [];
				for(let i = 0; i < globalUsers.length; i++){
					recordMenuX.push(null);
				}
				
				menu.dishes.forEach(dish => {
					let unmatchedUsers = [];
					
					dish.users.forEach((user, userIndex) => {
						let matched = false;
						globalUsers.forEach((userName, index) => {
							// let matchPercent = natural.JaroWinklerDistance(user, userName);
							let isMatch = (user.toLowerCase() == userName.toLowerCase());
							if (index == 0){
								recordMenuX[index] = menu.date;
							// }else if(matchPercent > 0.6){
							}else if(isMatch){
								matched = true;
								recordMenuX[index] = dish.price;
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

			console.log('record.length', records.length);
			// console.log('\033[32mrecords[0]\033[0m', records[0]);
			console.log('records[0].length', records[0].length);
			console.log('globalUsers', globalUsers.length);
			updatedRowsNum = records.length;
			// just empty rows for blank
			records.push([]);
			records.push([]);
			records.push([]);
			records.push([]);

			let range = '';	
			let startCell = lunchMoneyConfig['startCell'];
			let rowNumStr = startCell.match(/\d+/)[0];
			let colName = startCell.replace(rowNumStr, '');
			// @warn check rowNum
			let rowNum = parseInt(rowNumStr);
			rowNum += lunchMoneyConfig['lastUpdatedRowsNum'];

			// let newStartCell = startCell;
			// if(updateConfig){
			// 	newStartCell = colName + rowNum;
			// }
			if(updateConfig){
				startCell = colName + rowNum;
				lunchMoneyConfig['startCell'] = startCell;
			}

			console.log('updateConfig', 'startCell', "lunchMoneyConfig['lastUpdatedRowsNum']");
			console.log(updateConfig, startCell, lunchMoneyConfig['lastUpdatedRowsNum']);

			let updateLunchMoney = new Promise((resolve, reject) => {
				sheets.spreadsheets.values.append({
					auth: globalAuth,
					spreadsheetId: lunchMoneyId,
					valueInputOption: 'USER_ENTERED',
					// range: '2016!A277:A277',
					range: `${lunchMoneyConfig['sheet_name']}!${lunchMoneyConfig['startCell']}`,
					resource: {
						values: records,
						majorDimension: 'ROWS'
					}
				}, function(err, res) {
					if (err) {
						reject('The API returned an error: ' + err);
					}

					resolve(res);
				});
			});

			return updateLunchMoney;
		})
		.then(res => {
			console.log('Update to LunchMoney success');
			// console.log(res);
			// After update success
			// Next time move on
			lunchMoneyConfig.lastUpdatedRowsNum = updatedRowsNum;
			console.log('lunchMoneyConfig');
			console.log(lunchMoneyConfig);
			
			let fs = require('fs');
			let wstream = fs.createWriteStream(`${__dirname}/lib/lunchMoneyConfig.json`);
			wstream.on('open', function(){
				wstream.write(JSON.stringify(lunchMoneyConfig));
				wstream.end(function(){
					console.log('\033[32mWriteStream on lunchMoneyConfig.json success');
				});
			});
			// fs.writeFileSync(`${__dirname}/lib/lunchMoneyConfig.json`, JSON.stringify(lunchMoneyConfig));

			let updateGlobalUsers = new Promise((resolve, reject) => {
				sheets.spreadsheets.values.batchUpdate({
					auth: globalAuth,
					spreadsheetId: lunchMoneyId,
					resource: {
						valueInputOption: 'USER_ENTERED',
						data: {
							range: '2016!A1:1',
							values: [globalUsers],
							majorDimension: 'ROWS',
						}
					}
				}, function(err, res) {
					if (err) {
						// console.log(err);
						reject('The API returned an error: ' + err);
					}
					resolve(res);
				});
			});

			return updateGlobalUsers;
		})
		.then(res => {
			console.log('Update header users success');
		})
		.catch(err => {
			console.log(err)
		});