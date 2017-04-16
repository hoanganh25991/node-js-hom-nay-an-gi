let _ = require('./util');

function whichDate(date){
	let moment = require('moment');
	//noinspection JSUnresolvedFunction
	let today = moment().utcOffset(7 * 60);
	// By default selected day is tommorrow
	let whichDate = today.clone().add(1, 'days');
	// Check is today friday
	// When on friday, next day is monday of next week
	// That is the day user want to ask
	if(today.day() >= 5){
		// Move to mon of next week
		whichDate = today.clone().isoWeekday("Monday").add(7, 'days');
	}

	// User specify the date
	let acceptedInputDates = {
		today: today.isoWeekday(),
		mon:  1,
		tue:  2,
		wed:  3,
		thur: 4,
		fri:  5,
		sat:  6,
		sun:  7
	};

	if(date && acceptedInputDates[date]){
		whichDate = today.clone().isoWeekday(acceptedInputDates[date]);
	}

	return whichDate;
}

let parseUserText = function(req){
	/**
	 * Query from user
	 * user_name
	 * text
	 * response_url
	 * command
	 *
	 * base on text > parse what user want
	 */
	let user_name    = req.query['user_name'];
	let text         = req.query['text'].replace(/\s+/g, ' ');
	let response_url = req.query['response_url'];
	let command      = req.query['command'];
	// Chunk user text to read it
	let text_chunks  = text.split(' ');
	let state        = _.getState();

	let userTextArr = {
		text,
		cmd:  text_chunks[0],
		user_name,
		sheet_name: state[user_name],
		response_url,
		command
	};

	switch(userTextArr['cmd']){
		// These cmd share same format
		// <cmd> <day>
		case 'view':
		case 'cancel':
		case 'delete':
		case 'menu':
			let date = text_chunks[1];
			userTextArr['whichDate'] = whichDate(date);
			break;
		// When order, implicit order for tomorrow
		// <cmd> <dish_index>
		// Or order with specify day
		// <cmd> <day> <dish_index>
		case 'order':
			if(text_chunks[1]){
				// Check if userTextArr[1] is dish index
				let dishIndex = parseInt(text_chunks[1], 10);
				if(!isNaN(dishIndex)){
					userTextArr['dishIndex'] = dishIndex;
					userTextArr['whichDate'] = whichDate(undefined);
					// return;
				}else{
					dishIndex = parseInt(text_chunks[2], 10);
					if(!isNaN(dishIndex)){
						userTextArr['dishIndex'] = dishIndex;
						userTextArr['whichDate'] = whichDate(text_chunks[1]);
						// return;
					}
				}
			}
			break;
		// Call name > review or set up
		// Review
		// <cmd>
		// Set up
		// <cmd> <sheet_name>
		case 'name':
			let user_name_arr = text_chunks.slice(1);
			userTextArr['new_name'] = user_name_arr.join(' ');
			break;
	}

	return userTextArr;
}

module.exports = parseUserText;