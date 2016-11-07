let parseUserText = function(req){
	let userName = req.query['user_name'];
	let userText = req.query['text'].replace(/\s+/g, ' ');
// Build basic info from user slack command
	let userTextArr = userText.split(' ');
	let mapName = require(`${__dirname}/lib/mapName`);
	let userNameInSheet = mapName[userName];
	userTextArr['text'] = userText;
	userTextArr['cmd'] = userTextArr[0];
	userTextArr['user_name'] = userName;
	userTextArr['sheet_name'] = userNameInSheet;
	console.log(userTextArr);

	switch(userTextArr['cmd']){
		case 'view':
		case 'delete':
		case 'menu':
			let date = userTextArr[1];
			let moment = require('moment');
			let storage = require('node-persist');
			storage.initSync();

			let today = moment().utcOffset(storage.getItemSync('timezone'));
			today.isoWeekday(1);
			let todayByName = today.format('ddd').toLowerCase();
			/**
			 * By default selected day is tommorrow
			 */
			userTextArr['selected_date'] = today.day(1);
			// Check is today fri day
			if(todayByName == 'fri'){
				// Move to mon of next week
				userTextArr['selected_date'] = today.day(3);
			}

			/**
			 * In case use specify which date
			 * get out for him
			 */
			let acceptedInputDates = storage.getItemSync('acceptedInputDates');
			if(date && acceptedInputDates.includes(date)){
				
			}

			break;
	}
}