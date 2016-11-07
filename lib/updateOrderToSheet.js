// let __dirname = '.';
let _ = require(`${__dirname}/util`);
let auth = require(`${__dirname}/auth`)();
let google = require('googleapis');
let sheets = google.sheets('v4');

let updateOrderToSheet = function(cell){
	let cellAddress = cell.cellAddress;
	let cellVal= cell.cellVal;

	let storage = _.getStorage();
	let sheetNuiBayUtIt = storage.getItemSync('sheetNuiBayUtIt');
	let globalAuth;

	let promise = auth
		.then(auth =>{
			globalAuth = auth;
			let updatePromise = new Promise((resolve, reject) =>{
				sheets.spreadsheets.values.batchUpdate({
					auth: globalAuth,
					spreadsheetId: sheetNuiBayUtIt.id,
					resource: {
						valueInputOption: 'USER_ENTERED',
						data: {
							values: [[cellVal]],
							range: `${sheetNuiBayUtIt['activeSheetName']}!${cellAddress}:${cellAddress}`,
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
		})
		.catch(err => {
			console.log(err);
			return new Promise(resolve => resolve(err));
		});
	// return new Promise(r => r('hello'));
	return promise;
}

module.exports = updateOrderToSheet;