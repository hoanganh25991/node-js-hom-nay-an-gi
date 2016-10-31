let oauth2Promise = require(`${__dirname}/oauth2Client`)();
let google = require('googleapis');
let natural = require('natural');

const nuiBayUtItId = '1osEF3thjxDgQiXk95N-xc9Ms9ZtgYI1CmZgKCLwIamY';
const lunchMoneyId = '1CM6BNJn4K24JZbn5zJLwkcES9BZ4o9wzr8t9W6kNb-8';

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
		console.log(res);

		let rows = res.values;
		if (!rows || rows.length == 0) {
			reject('Fail to users from getUsersPromise_res');
		}
		//["", "Hoan", "Loc", "Duy", "Hoang", "Vinh", "Toan web", "Nam", "D. Vu"]
		globalUsers = rows[0];
		console.log(globalUsers);

		let getMenuInWeek = new Promise((resolve, reject) => {
			sheets.spreadsheets.values.get({
				auth: globalAuth,
				spreadsheetId: nuiBayUtItId,
				range: 'Gia chanh Cam Tuyet!A558:AD581',
				majorDimension: 'COLUMNS',
			}, (err, res) => {
				if (err) {
					reject('The API returned an error: ' + err);
				}

				resolve(res);
			});
		});

		return getMenuInWeek;
	})
	.then(res => {
		console.log('\033[32mGot menu\033[0m: success');
		// console.log(res);

		// console.log(res.values[0]);
		// console.log(globalUsers);
		let rows = res.values;
		if (!rows || rows.length == 0) {
			reject('Fail to menu from getMenuInWeek_res');
		}

		let chunkedRows = [];
		let currentChunkPos = -1;
		let i;
		for (i = 0; i < rows.length + 1; i++) {
			if (i % 6 == 5) {
				chunkedRows.push(rows.slice(currentChunkPos + 1, i));
				currentChunkPos = i;
			}
		}

		console.log('\033[32mChunk rows\033[0m: success');
		console.log(chunkedRows[0]);

		let dateMenus = chunkedRows.map(dateMenu => {
			// dateMenu[0] Menu: [menu, 'mon 1', 'mon 2', 'mon 3']
			// dateMenu[1] Price: [price, '29000', '17000']
			// dateMenu[2] Date: [mon 1st Oct, 'Tu, Anh, Quoi', 'Bao, Minh, Binh']
			// dateMenu[3] Order: not important
			// dateMenu[4] Total: not important
			let menu = {
				date: '',
				dishes: []
			};

			dateMenu.forEach((val, index) => {
				switch (index) {
					case 0:
						//remove header 'menu'
						val.splice(0, 1);
						val.forEach(dishName => {
							let dish = {
								name: '',
								price: '',
								users: []
							};
							dish.name = dishName;
							menu.dishes.push(dish);
						});

						break;
					case 1:
						val.splice(0, 1);
						val.forEach((dishPrice, index) => {
							let dish = menu.dishes[index];
							dishPrice = dishPrice.replace(',000', '');
							dish.price = parseInt(dishPrice, 10);
							// console.log(dishPrice);
						});

						break;
					case 2:
						//store menu-date
						var date = val[0]; // 'mon (31 Oct)'
						//parse menu-date
						date = date.substr(5, date.length - 5 - 1).replace(/\s/g, '-');
						menu.date = `${date}-2016`;
						console.log(menu.date);

						val.splice(0, 1);
						val.forEach((users, index) => {
							// console.log(users);
							users = users.split(',')
								.map(user => user.trim())
								.filter(notEmpty => notEmpty);
							let dish = menu.dishes[index];
							dish.users = users;
						});

						break;
				}
			});

			menu.dishes = menu.dishes.filter(dish => dish.name);

			return menu;
		});

		// let dateMenusPromise = new Promise((resolve, reject) => {
		// 	resolve(dateMenus);
		// });
		let dateMenusPromise = new Promise(resolve => resolve(dateMenus));

		// console.log('\033[32mdateMenus\033[0m: success', dateMenus[0]['dishes']);
		console.log('\033[32mdateMenus\033[0m: success', dateMenus.length);
		console.log('\033[32mdateMenus[0]\033[0m: ', dateMenus[0]);

		return dateMenusPromise;
	}).then(dateMenus => {
		console.log('\033[32mdateMenus pass through promise\033[0m: success');
		console.log('dateMenus.length', dateMenus.length);

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
						let matchPercent = natural.JaroWinklerDistance(user, userName);
						if (index == 0){
							recordMenuX[index] = menu.date;
						}else if(matchPercent > 0.6){
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

		console.log('\033[32mrecords.length\033[0m', records.length);
		// console.log('\033[32mrecords[0]\033[0m', records[0]);
		console.log('\033[32mrecords[0]\033[0m', records[0].length);
		console.log('\033[32mglobalUsers\033[0m', globalUsers.length);

		let updateLunchMoney = new Promise((resolve, reject) => {
			sheets.spreadsheets.values.append({
				auth: globalAuth,
				spreadsheetId: lunchMoneyId,
				valueInputOption: 'USER_ENTERED',
				range: '2016!A277:A277',
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
		console.log('update success');
		console.log(res);
		return new Promise(resolve => {
			resolve(res)
		});
	})
	.catch(err => {
		console.log(err);
	})
	.then(res => {
		console.log('promise after update success');
		console.log(res);
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
					reject('The API returned an error: ' + err);
				}
				resolve(res);
			});
		});

		return updateGlobalUsers;
	})
	.then(res => {
		console.log('update header users success');
	})
	.catch(err => {
		console.log(err)
	});