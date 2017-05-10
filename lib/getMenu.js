let googleAuth= require('./auth')();
let google    = require('googleapis');
//noinspection JSUnresolvedFunction
let sheets    = google.sheets('v4');
let _         = require('./util');
let buildMenu = require('./buildMenu');

let buildPromise = function (isWriteCacheFile){
	isWriteCacheFile = isWriteCacheFile || false;

	let auth;
	let state = _.getState();

	let getDatesMenuPromise =
		googleAuth
			.then(authState => {
				auth = authState;

				let spreadsheetId = state.id;
				let range         = `'${state.active_sheet}'!${state.range}`;
				let majorDimension= 'COLUMNS';
				
				let getMenuInWeek = new Promise((resolve) => {
					//noinspection JSUnresolvedVariable,JSCheckFunctionSignatures
					sheets.spreadsheets.values.get({
						auth,
						spreadsheetId,
						range,
						majorDimension,
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
			.catch(err => {
				require('./auth-slack-notify-when-fail')(err);

				return Promise.reject('Update menu fail due to auth fail');
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