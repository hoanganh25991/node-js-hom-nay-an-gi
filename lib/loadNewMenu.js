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

				return Promise.reject('Still not update');
			})
			//.catch(rej_msg => console.log(rej_msg));
	
	return loadNewMenu;
}

let slackNotifyMenuUpdated = function(){
	// slack msg notify OHH YEAHH YEAHH we have new menu
	let slackMsg = {
		text: `New menu comes...`,
		attachments: [
			{
				title: `Menu for next week updated`,
				title_link: `https://tinker.press`,
				fields: [
					{
						title: `Run command`,
						value: `/lunch menu`,
						short: true
					}
				],
				color: '#3AA3E3',
				ts: Math.floor(new Date().getTime() / 1000)
			}
		]
	};

	// Post to originally group, notification channel
	var options = {
		method : 'POST',
		url    : 'https://hooks.slack.com/services/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',
		body   : JSON.stringify(slackMsg)
	};
	// Push back msg to user base on reponse_url of slack
	let request       = require('request');
	request(options, function (err, response, body) {
		if (err) throw err;
		console.log(body);
	});
}

let slackNotifyMenuNotUpdated = function(){
	// slack msg notify OHH YEAHH YEAHH we have new menu
	let slackMsg = {
		text: `Menu for next week not found...`,
		attachments: [
			{
				title: `Please ask admin to update the menu`,
				title_link: `https://tinker.press`,
				fields: [
					{
						title: `¯\\_(ツ)_/¯`,
						value: `ლ(´ڡ\`ლ) `,
						short: true
					}
				],
				color: '#3AA3E3',
				ts: Math.floor(new Date().getTime() / 1000)
			}
		]
	};

	// Post to originally group, notification channel
	var options = {
		method : 'POST',
		url    : 'https://hooks.slack.com/services/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',
		body   : JSON.stringify(slackMsg)
	};
	// Push back msg to user base on reponse_url of slack
	let request       = require('request');
	request(options, function (err, response, body) {
		if (err) throw err;
		console.log(body);
	});
}


module.exports = {
	buildLoadMenu,
	slackNotifyMenuUpdated,
	slackNotifyMenuNotUpdated
};