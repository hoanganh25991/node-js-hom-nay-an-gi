let oauth2Promise = require(`${__dirname}/oauth2Client`)();
let google = require('googleapis');

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

oauth2Promise
	.then(auth => {
	  // console.log(auth);
	  console.log('\033[32mAuth\033[0m: success');
	  console.log(auth);
	  
	  let getUsersPromise = new Promise((resolve, reject) => {
	  	sheets.spreadsheets.values.get({
		    auth: auth,
		    spreadsheetId: lunchMoneyId,
		    range: '2016!1:1'
		  }, (err, res) => {
		    if (err) {
		      reject('The API returned an error: ' + err);
		    }

		    resolve(res, auth);
		  });
	  });

	  return getUsersPromise;
	})
	.then((res, auth) => {
		// console.log(res);
		console.log('\033[32mGot users\033[0m: success');
		console.log(res);
		console.log(auth);

		let rows = res.values;
		if(!rows || rows.length == 0){
			reject('Fail to users from getUsersPromise_res');
		}
		//["", "Hoan", "Loc", "Duy", "Hoang", "Vinh", "Toan web", "Nam", "D. Vu"]
		let users = rows[0];
		// console.log(users);

		let getMenuInWeek = new Promise((resolve, reject)=>{
			sheets.spreadsheets.values.get({
		    auth: auth,
		    spreadsheetId: nuiBayUtItId,
		    range: 'Gia chanh Cam Tuyet!A558:AD581'
		  }, (err, res2) => {
		    if (err) {
		      reject('The API returned an error: ' + err);
		    }

		    resolve(users, res2);
		  });
		});



		return getMenuInWeek;
	})
	.then((users, res2)=>{
		console.log('\033[32mGot menu\033[0m: success');
		console.log(res2);
	});