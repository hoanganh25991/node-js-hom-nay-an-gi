let buildLoadMenu = function (){
	let _           = require('./util')
	let state       = _.getState();
	let moment      = require('moment');
	let googleAuth  = require('./auth')();
	let google      = require('googleapis');
//noinspection JSUnresolvedFunction
	let sheets      = google.sheets('v4');

	let currentEndRow = state.range.match(/\d+$/)[0];
	currentEndRow     = parseInt(currentEndRow, 10);

	const getDownNumRows = 30;
// To save data load, ONLY get data on MONDAY for Friday get menu request
	let newMenuRange = `A${currentEndRow}:${currentEndRow + getDownNumRows}`;
// console.log(newMenuRange);

	let loadNewMenu =
		googleAuth
			.then(auth => {
				let getCheckNewMenu =
					new Promise((resolve, reject) => {
						//noinspection JSUnresolvedVariable
						sheets.spreadsheets.values.get({
							auth: auth,
							spreadsheetId: state.id,
							range: `'${state.active_sheet}'!${newMenuRange}`,
							majorDimension: 'ROWS',
						}, function cb(err, res){
							if (err) {
								console.log(err);
								reject('The API returned an error: ' + err);
							}

							resolve(res);
						});
					});

				return getCheckNewMenu;
			})
			//.catch(reject_msg => console.log(reject_msg))
			.then(res => {
				let rows = res.values;
				if (!rows || rows.length == 0) {
					console.log('Fail to getCheckNewMenu');
					return new Promise((res, rej) => {rej('Fail to getCheckNewMenu');});
				}

				let rowMenuIndex = null;

				const try_times = 4;
				let i = 0, found = false;

				while(i < try_times && !found){
					try{
						let menuSignal = rows[i][0];
						found = menuSignal.match(/Menu/);
						// Store where we find it out
						if(found){
							rowMenuIndex = i;
						}
					}catch(e){}

					i++;
				}

				if(rowMenuIndex !== null){
					let newMenuStartRow = currentEndRow + rowMenuIndex;
					// Menu range define here on FRIDAY
					// Only get out Monday value of next week
					// Then add it to dateMenus
					let newMenuEndRow = newMenuStartRow + (rows.length -1) - rowMenuIndex;
					let newMenuRange  = `A${newMenuStartRow}:${newMenuEndRow}`;
					console.log('Find out new menu range', newMenuRange);


					state.range = newMenuRange;
					_.saveState(state);

					require('./getMenu')(true);

					console.log('Run getMenu(true) to save menus');
					return Promise.resolve('Menu updated');
				}

				return Promise.resolve('Still not update');
			})
			//.catch(rej_msg => console.log(rej_msg));
	
	return loadNewMenu;
}

module.exports = buildLoadMenu;