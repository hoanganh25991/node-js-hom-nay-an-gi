let _ = require(`${__dirname}/util`);

let parseUserText = function(req){
	/**
	 * Query from user has 2 parameter
	 * user_name
	 * text
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
		case 'view':
		case 'cancel':
		case 'delete':
		case 'menu':
			let date = text_chunks[1];
			userTextArr['whichDate'] = whichDate(date);
			break;
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
		case 'name':
			let user_name_arr = text_chunks.slice(1);
			userTextArr['new_name'] = user_name_arr.join(' ');
			break;
	}

	function whichDate(date){
		let moment = require('moment');
		let today = moment().utcOffset(7 * 60);
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
		if(date && acceptedInputDates[date]){
			whichDate = today.clone().isoWeekday(acceptedInputDates[date]);
			// whichDate = today.clone().isoWeekday("Friday");
		}
		// console.log(whichDate.format());
		/**
		 * Case user want to review on THIS day
		 */
		if(date == 'today'){
			whichDate = today;
		}

		return whichDate;
	}
	
	// console.log(userTextArr);
	return userTextArr;
}

module.exports = parseUserText;