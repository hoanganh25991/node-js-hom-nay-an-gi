let googleSheetAuthPromise = require(`${__dirname}/auth`)();
let google = require('googleapis');
let sheets = google.sheets('v4');
let _ = require(`${__dirname}/util`);

let buildPromise = function (isWriteCacheFile){
	isWriteCacheFile = isWriteCacheFile || true;

	let globalAuth;
	let storage = _.getStorage();
	let sheetNuiBayUtIt = storage.getItemSync('sheetNuiBayUtIt');

	let getDatesMenuPromise =
		googleSheetAuthPromise
			.then(auth => {
				globalAuth = auth;

				let getMenuInWeek = new Promise((resolve, reject) => {
					sheets.spreadsheets.values.get({
						auth: globalAuth,
						spreadsheetId: sheetNuiBayUtIt.id,
						// range: 'Gia chanh Cam Tuyet!A558:AD581',
						range: `${sheetNuiBayUtIt['activeSheetName']}!${sheetNuiBayUtIt['menuRange']}`,
						majorDimension: 'COLUMNS',
					}, function cb(err, res){
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
				console.log('Chunk row success, chunkedRows.length', chunkedRows.length);

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
								// console.log(date);
								// console.log(date.match(/\d+ [a-zA-Z]+/));
								//parse menu-date
								// date = date.substr(5, date.length - 5 - 1).replace(/\s/g, '-');
								date = date.match(/\d+ [a-zA-Z]+/)[0].replace(/\s/g, '-');
								menu.date = `${date}-2016`;
								// console.log(menu.date);

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
				console.log('Parse dateMenus success, dateMenus.length: ', dateMenus.length);

				if(isWriteCacheFile){
					console.log('\033[32mStart write cache file\033[0m');

					let fs = require('fs');
					let wstream = fs.createWriteStream(`${_.getPath('root')}/menus.json`);
					// wstream.write(JSON.stringify(dateMenus));
					// fs.writeFileSync(require(`${__dirname}/menus.json`), JSON.stringify(dateMenus));
					// console.log('\033[32mWrite cache file SYNC success\033[0m');
					wstream.once('open', function() {
						wstream.write(JSON.stringify(dateMenus));
						wstream.end(function(){
							console.log('\033[32mWriteStream for cache file success\033[0m');
						});
					});
				}

				let dateMenusPromise = new Promise(resolve => resolve(dateMenus));

				return dateMenusPromise;
			});

	return getDatesMenuPromise;
}

module.exports = buildPromise;