// let __dirname = '.';
let nBUUConfig = require(`${__dirname}/lib/nuiBayUtItConfig`);

let updateOrderToSheet = function(cellAddress, cellVal){
	// Open google sheet to update
	let oauth2Promise = require(`${__dirname}/oauth2Client`)();
	let google = require('googleapis');
	let sheets = google.sheets('v4');

	const nuiBayUtItId = '1osEF3thjxDgQiXk95N-xc9Ms9ZtgYI1CmZgKCLwIamY';

	let globalAuth;
	let promise = oauth2Promise
		.then(auth =>{
			console.log('Auth success\nStart open sheet to update');

			globalAuth = auth;
			let updatePromise = new Promise((resolve, reject) =>{
				sheets.spreadsheets.values.batchUpdate({
					auth: globalAuth,
					spreadsheetId: nuiBayUtItId,
					resource: {
						valueInputOption: 'USER_ENTERED',
						data: {
							values: [[cellVal]],
							range: `${nBUUConfig['sheet_name']}!${cellAddress}:${cellAddress}`,
							majorDimension: 'ROWS'
						}
					}
				}, function(err, res){
					if(err){
						console.log('The API returned an error: ' + err);
						reject('The API returned an error: ' + err);
					}

					resolve(res);
				});
			});

			return updatePromise;
		})
		.catch(err => console.log(err));
	// return new Promise(r => r('hello'));
	return promise;
}

module.exports = updateOrderToSheet;