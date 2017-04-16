let googleAuth= require('./lib/googleAuth')();
let google    = require('googleapis');
let sheets    = google.sheets('v4');
let _         = require(`${__dirname}/util`);
let buildMenu = require(`${__dirname}/buildMenu`);

let buildPromise = function (isWriteCacheFile){
	isWriteCacheFile = isWriteCacheFile || false;

	let globalAuth;
	let state = _.getState();

	let getDatesMenuPromise =
		googleAuth
			.then(auth => {
				globalAuth = auth;

				let getMenuInWeek = new Promise((resolve) => {
					sheets.spreadsheets.get({
						auth: globalAuth,
						spreadsheetId: state.id,
						ranges: `'${state.active_sheet}'!${state.range}`,
						majorDimension: 'COLUMNS',
					}, function(err, response) {
						if (err) {
							console.log(err);
							return;
						}

						resolve(response);
					});
				});

				return getMenuInWeek;
			})
			.then(res => {
				let dateMenus = buildMenu(res);
				return new Promise(res => res(dateMenus));
			})
			.then(dateMenus => {
				if(isWriteCacheFile){
					console.log('\033[32mStart write cache file\033[0m');

					let fs = require('fs');
					let wstream = fs.createWriteStream(`${_.getPath('root')}/menus.json`);
					
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

	return getDatesMenuPromise;
}

module.exports = buildPromise;