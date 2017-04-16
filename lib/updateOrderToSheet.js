let _      = require('./util');
let googleAuth   = require('./auth')();
let google = require('googleapis');
//noinspection JSUnresolvedFunction
let sheets = google.sheets('v4');

let updateOrderToSheet = function(cell){
	let cellAddress = cell.cellAddress;
	let cellVal= cell.cellVal;

	let state = _.getState();
	let auth;

	let promise =
		googleAuth
			.then(authJson =>{
				auth = authJson;
				let updatePromise = new Promise((resolve, reject) =>{
					//noinspection JSUnresolvedVariable
					sheets.spreadsheets.values.batchUpdate({
						auth,
						spreadsheetId: state['id'],
						resource: {
							valueInputOption: 'USER_ENTERED',
							data: {
								values: [[cellVal]],
								range: `'${state['active_sheet']}'!${cellAddress}:${cellAddress}`,
								majorDimension: 'ROWS'
							}
						}
					}, function cb(err, res){
						if(err){
							console.log('The API returned an error: ' + err);
							reject('The API returned an error: ' + err);
						}

						resolve(res);
					});
				});

				return updatePromise;
			});

	return promise;
}

module.exports = updateOrderToSheet;