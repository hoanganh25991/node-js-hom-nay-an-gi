let _ = require(`${__dirname}/util`)
let storage = _.getStorage();
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
	let today = moment().utcOffset(storage.getItemSync('timezone') * 60);
	// let today = moment().utcOffset(storage.getItemSync('timezone') * 60).isoWeekday('Friday');
	let friday = today.clone().isoWeekday('Friday');

	let isTodayFriday = today.isSame(friday, 'd');
	let hours = today.hours();

	/**
	 * If we have detect NEW menu range
	 * don't have to run again logic
	 */
	// if(storage.getItemSync('isNewMenuAvailable')){
	// 	return;
	// }

	/**
	 * Only check update when FRIDAY & > 9:00 AM
	 */
	if(!storage.getItemSync('isNewMenuAvailable') && isTodayFriday && hours > 9){
		console.log(`isNewMenuAvailable false, is friday, hours > 9`);
		let authPromise = require(`${__dirname}/auth`)();
		let google = require('googleapis');
		let sheets = google.sheets('v4');

		let sheetNuiBayUtIt = storage.getItemSync('sheetNuiBayUtIt');

		let menuRange = sheetNuiBayUtIt['menuRange'];

		let currentEndRow = menuRange.match(/\d+$/)[0];
		currentEndRow = parseInt(currentEndRow, 10);

		const getDownNumRows = 30;
		// To save data load, ONLY get data on MONDAY for Friday get menu request
		let newMenuRange = `A${currentEndRow}:${_.convertA1Notation(4)}${currentEndRow + getDownNumRows}`;
		// console.log(newMenuRange);

		authPromise
			.then(auth => {
				let getCheckNewMenu =
					new Promise((resolve, reject) => {
						sheets.spreadsheets.values.get({
							auth: auth,
							spreadsheetId: sheetNuiBayUtIt.id,
							range: `${sheetNuiBayUtIt['activeSheetName']}!${newMenuRange}`,
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
					let newMenuRange = `A${newMenuStartRow}:${_.convertA1Notation(4)}${newMenuEndRow}`;
					/**
					 * Save them as persist data
					 * STATUS
					 */
					storage.setItemSync('isNewMenuAvailable', true);
					
					sheetNuiBayUtIt['newMenuRange'] = newMenuRange;
					storage.setItemSync('sheetNuiBayUtIt', sheetNuiBayUtIt);
					storage.setItemSync('isUpdateNewMenuRange', false);
					
					console.log(`Got newMenuRange (only range for Monday to save load data)`);
					console.log(storage.getItemSync('sheetNuiBayUtIt'));
				}
			})
			.catch(err => console.log(err));
	}
	
	let monday = today.clone().isoWeekday('Monday');
	let isTodayMonday = today.isSame(monday, 'd');

	/**
	 * On Friday we ONLY handle dateMenus add up the monday of NEXT week
	 * We NOT update full menu persistent
	 * today (MONDAY) is the right time to do it
	 */
	let isUpdateNewMenuRange = storage.getItemSync('isUpdateNewMenuRange');
	
	if(isTodayMonday && !isUpdateNewMenuRange){
		console.log(`is Monday, isUpdateNewMenuRange false`);
		let sheetNuiBayUtIt = storage.getItemSync('sheetNuiBayUtIt');
		let newMenuRange = sheetNuiBayUtIt['newMenuRange'];
		
		let startRow = newMenuRange.match(/\d+/)[0];
		startRow = parseInt(startRow, 10);
		
		let endRow = newMenuRange.match(/\d+$/)[0];
		endRow = parseInt(endRow, 10);

		/**
		 * This is full newMenuRange
		 * rather than just on Monday for Friday get data
		 */
		newMenuRange = `A${startRow}:${endRow}`;
		
		sheetNuiBayUtIt['menuRange'] = newMenuRange;
		sheetNuiBayUtIt['newMenuRange'] = null;
		
		storage.setItemSync('isNewMenuAVailable', false);
		storage.setItemSync('sheetNuiBayUtIt', sheetNuiBayUtIt);
		storage.setItemSync('isUpdateNewMenuRange', true);
	}
	
}

module.exports = checkMenuUpdate;