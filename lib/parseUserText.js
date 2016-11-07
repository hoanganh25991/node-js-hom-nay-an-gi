let _ = require(`${__dirname}/util`);
let storage = _.getStorage();
let parseUserText = function(req){
	let userName = req.query['user_name'];
	let userText = req.query['text'].replace(/\s+/g, ' ');
// Build basic info from user slack command
	let userTextArr = userText.split(' ');
	let mapName = storage.getItemSync('mapName');
	let userNameInSheet = mapName[userName];
	userTextArr['text'] = userText;
	userTextArr['cmd'] = userTextArr[0];
	userTextArr['user_name'] = userName;
	userTextArr['sheet_name'] = userNameInSheet;



	switch(userTextArr['cmd']){
		case 'view':
		case 'delete':
		case 'menu':
			let date = userTextArr[1];
			userTextArr['whichDate'] = whichDate(date);
			break;
		case 'order':
			if(userTextArr[1]){
				// Check if userTextArr[1] is dish index
				let dishIndex = parseInt(userTextArr[1], 10);
				if(!isNaN(dishIndex)){
					userTextArr['dishIndex'] = dishIndex;
					userTextArr['whichDate'] = whichDate(undefined);
					// return;
				}else{
					dishIndex = parseInt(userTextArr[2], 10);
					if(!isNaN(dishIndex)){
						userTextArr['dishIndex'] = dishIndex;
						userTextArr['whichDate'] = whichDate(userTextArr[1]);
						// return;
					}
				}
			}
			break;
	}

	function whichDate(userTextArrDate){
		let moment = require('moment');
		let today = moment().utcOffset(storage.getItemSync('timezone') * 60);
		// console.log(today.format());

		/**
		 * By default selected day is tommorrow
		 */
		let whichDate = today.clone().add(1, 'days');
		// console.log(whichDate.format());
		// Check is today fri day
		if(today.day() >= 5){
			// Move to mon of next week
			whichDate = today.clone().isoWeekday("Monday").add(7, 'days');
		}

		/**
		 * In case use specify which userTextArrDate
		 * get out for him
		 */
		let acceptedInputDates = storage.getItemSync('acceptedInputDates');
		// console.log(userTextArrDate, acceptedInputDates[userTextArrDate])
		if(userTextArrDate && acceptedInputDates[userTextArrDate]){
			whichDate = today.clone().isoWeekday(acceptedInputDates[userTextArrDate]);
			// whichDate = today.clone().isoWeekday("Friday");
		}
		// console.log(whichDate.format());

		return whichDate;
	}
	
	// console.log(userTextArr);
	return userTextArr;
}

module.exports = parseUserText;