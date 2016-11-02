let oauth2Promise = require(`${__dirname}/oauth2Client`)();
let google = require('googleapis');
let natural = require('natural');

const nuiBayUtItId = '1osEF3thjxDgQiXk95N-xc9Ms9ZtgYI1CmZgKCLwIamY';

let sheets = google.sheets('v4');
let config = require(`${__dirname}/lib/nuiBayUtItConfig`);
console.log(`${config['sheet_name']}!${config['menu_range']}`);

// Open 'lunchMoneyId', get out users
// Open 'nuiBayUtItId', get menu on each day of week
// Append back into 'lunchMoneyId'

/**
 * Step 1: Open 'lunchMoneyId', get out users
 * @type {[type]}
 */
let globalAuth;

let getDatesMenuPromise = oauth2Promise
	.then(auth => {
		console.log('Start get menu in week');
		globalAuth = auth;
		let getMenuInWeek = new Promise((resolve, reject) => {
			sheets.spreadsheets.values.get({
				auth: globalAuth,
				spreadsheetId: nuiBayUtItId,
				// range: 'Gia chanh Cam Tuyet!A558:AD581',
				range: `${config['sheet_name']}!${config['menu_range']}`,
				majorDimension: 'COLUMNS',
			}, function (err, res){
				if (err) {
					console.log('The API returned an error: ' + err);
					reject('The API returned an error: ' + err);
				}

				resolve(res);
			});
		});

		return getMenuInWeek;
	})
	.then((res, reject) => {
		console.log('Get menu success');
		let rows = res.values;
		if (!rows || rows.length == 0) {
			console.log('Fail to menu from getMenuInWeek_res');
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

		let dateMenus = chunkedRows.map((dateMenu, col) => {
			// dateMenu[0] Menu: [menu, 'mon 1', 'mon 2', 'mon 3']
			// dateMenu[1] Price: [price, '29000', '17000']
			// dateMenu[2] Date: [mon 1st Oct, 'Tu, Anh, Quoi', 'Bao, Minh, Binh']
			// dateMenu[3] Order: not important
			// dateMenu[4] Total: not important
			let menu = {
				// col: col * 6 + 1,
				col: col * 6,
				date: '',
				dishes: []
			};

			dateMenu.forEach((val, index) => {
				switch (index) {
					case 0:
						//remove header 'menu'
						val.splice(0, 1);
						val.forEach((dishName, index) => {
							let dish = {
								row: index + 1,
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
		let fs = require('fs');
		fs.writeFile('menus.json', JSON.stringify(dateMenus));
		let dateMenusPromise = new Promise(resolve => resolve(dateMenus));

		// console.log('\033[32mdateMenus\033[0m: success', dateMenus[0]['dishes']);
		console.log('\033[32mdateMenus\033[0m: success', dateMenus.length);
		console.log('\033[32mdateMenus[0]\033[0m: ', dateMenus[0]);

		return dateMenusPromise;
	});

module.exports = getDatesMenuPromise;