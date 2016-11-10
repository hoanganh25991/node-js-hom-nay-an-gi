let googleSheetAuthPromise = require(`${__dirname}/auth`)();
let google = require('googleapis');
let sheets = google.sheets('v4');
let _ = require(`${__dirname}/util`);

let buildMenu = require(`${__dirname}/buildMenu`);

let buildPromise = function (isWriteCacheFile){
	isWriteCacheFile = isWriteCacheFile || false;

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
			.then(res => {
				let dateMenus = buildMenu(res);
				
				console.log('Parse dateMenus success, dateMenus.length: ', dateMenus.length);

				let isNewMenuAvailable = storage.getItemSync('isNewMenuAvailable');

				if(!isNewMenuAvailable){
					return new Promise(res => res(dateMenus));
				}

				console.log(sheetNuiBayUtIt['newMenuRange']);
				// process.exit();

				if(isNewMenuAvailable){
					console.log(`New menu available, @@, start load it`);
					let getNewMenuInWeek = new Promise((resolve, reject) => {
						sheets.spreadsheets.values.get({
							auth: globalAuth,
							spreadsheetId: sheetNuiBayUtIt.id,
							// range: 'Gia chanh Cam Tuyet!A558:AD581',
							range: `${sheetNuiBayUtIt['activeSheetName']}!${sheetNuiBayUtIt['newMenuRange']}`,
							majorDimension: 'COLUMNS',
						}, function cb(err, res){
							if (err) {
								console.log('The API returned an error: ' + err);
								reject('The API returned an error: ' + err);
							}

							resolve(res);
						});
					});

					let newNOldDateMenusPromise =
						getNewMenuInWeek
							.then(res => {
								console.log(`getNewMenuInWeek success`)
								let newDateMenus = buildMenu(res);
								dateMenus.concat(newDateMenus);

								console.log(`Added newMenu into this week dateMenus, dateMenus.length`, dateMenus.length);

								return new Promise(res => res(dateMenus));
							})
							.catch(err => console.log(err));

					return newNOldDateMenusPromise;
				}
			})
			.then(dateMenus => {
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