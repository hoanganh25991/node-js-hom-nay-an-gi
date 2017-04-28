let _      = require('./util')
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

	let state    = _.getState();
	/**
	 * Only check update when FRIDAY & > 9:00 AM
	 */
	if(!state.update_range_menu && isFriday && hours > 9){
		let loadNewMenu = require('./loadNewMenu')();
		loadNewMenu
			.then(res => {
				console.log(res);
				let state = _.getState();
				state.update_range_menu = true;
				_.saveState(state);

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

			})
			.catch(console.log('Still not update new menu'));
	}

	if(!isFriday){
		state.update_range_menu = false;
		_.saveState(state);
	}
}

let run = function(){
	setTimeout(function(){
		checkMenuUpdate();
		run();
	}, 1000 * 10 * 60);
};

module.exports = run;