let googleSheetAuthPromise = require(`${__dirname}/auth`)();
let google = require('googleapis');
let sheets = google.sheets('v4');
let _ = require(`${__dirname}/util`);

let buildMenu = require(`${__dirname}/buildMenu`);

let buildPromise = function (isWriteCacheFile){
	isWriteCacheFile = isWriteCacheFile || false;

	let globalAuth;
	let storage = _.getStorage();
	let sheetNuiBayUtIt = {
		"id":"1ZRaQ0B3PNaJmix9BQXe3XHpOpJKa_6l6puMpO57AYJY",
		"activeSheetName":"2017",
		"menuRange":"A298:325"
	};

	let getDatesMenuPromise =
		googleSheetAuthPromise
			.then(auth => {
				globalAuth = auth;

				let getMenuInWeek = new Promise((resolve, reject) => {
					sheets.spreadsheets.get({
						auth: globalAuth,
						ranges: "'2017'!A325:352",
						spreadsheetId: sheetNuiBayUtIt.id,
					}, function(err, response) {
						if (err) {
							console.log(err);
							return;
						}

						// TODO: Change code below to process the `response` object:
						let data = JSON.stringify(response, null, 2);
						console.log(data);
						resolve(response);
					});
					// sheets.spreadsheets.values.get({
					// 	auth: globalAuth,
					// 	spreadsheetId: sheetNuiBayUtIt.id,
					// 	// range: 'Gia chanh Cam Tuyet!A558:AD581',
					// 	range: `'${sheetNuiBayUtIt['activeSheetName']}'!${sheetNuiBayUtIt['menuRange']}`,
					// 	majorDimension: 'COLUMNS',
					// }, function cb(err, res){
					// 	if (err) {
					// 		console.log('The API returned an error: ' + err);
					// 		reject('The API returned an error: ' + err);
					// 	}
					//
					// 	resolve(res);
					// });
				});

				return getMenuInWeek;
			})
			.catch(err => console.log(err))
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
								dateMenus = dateMenus.concat(newDateMenus);

								console.log(`Added newMenu into this week dateMenus, dateMenus.length`, dateMenus.length);

								return new Promise(res => res(dateMenus));
							})
							.catch(err => console.log(err));

					return newNOldDateMenusPromise;
				}
			})
			.catch(err => console.log(err))
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
			})
			.catch(err => console.log(err));

	return getDatesMenuPromise;
}

module.exports = buildPromise;