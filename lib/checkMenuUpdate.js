let _      = require('./lib/util')
let state  = _.getState();
let moment = require('moment');
/**
 * Menu updated on each friday morning (may be later)
 * Logic
 * 1. If today is friday, around 8AM, read menu-sheet from start row of old-menu
 * down to 10 more rows, if we get any thing like "Menu (xx-Dec)"
 *
 * 2. Save to storage
 *  isNewMenuAvailable = true
 *  newMenuRange = xyz
 *
 *  3. When we come to new week
 *  (on Monday)
 *  isNewMenuAvailable = false
 *  menuRange changed
 */
let checkMenuUpdate = function(){
	//noinspection JSUnresolvedFunction
	let today    = moment().utcOffset(7 * 60);
	let isFriday = today.isoWeekday() == 5;
	let hours    = today.hours();

	/**
	 * Only check update when FRIDAY & > 9:00 AM
	 */
	if(!state.update_range_menu && isFriday && hours > 9){
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
			.then(res => {
				let rows = res.values;
				if (!rows || rows.length == 0) {
					console.log('Fail to getCheckNewMenu');
					return new Promise((res, rej) => {rej('Fail to getCheckNewMenu');});
				}

				let rowMenuIndex;
				rows.forEach((row, index) => {
					let menuSignal = row[0];

					try{
						let hasMenuSignal = menuSignal.match(/Menu/);
						if(hasMenuSignal){
							rowMenuIndex = index;
						}
					}catch(err){
						console.log(menuSignal);
					}
				});

				// console.log(rows, rowMenuIndex);
				
				if(rowMenuIndex){
					console.log('Find out NEW menu');
					let newMenuStartRow = currentEndRow + rowMenuIndex;
					// Menu range define here on FRIDAY
					// Only get out Monday value of next week
					// Then add it to dateMenus
					let newMenuEndRow = newMenuStartRow + (rows.length -1) - rowMenuIndex;
					let newMenuRange  = `A${newMenuStartRow}:${newMenuEndRow}`;

					state.range             = newMenuRange;
					state.update_range_menu = true;
					_.saveState(state);

					require('./getMenu')(true);
				}
			});
	}

	if(!isFriday){
		state.update_range_menu = false;
		_.saveState(state);
	}
}

module.exports = checkMenuUpdate;