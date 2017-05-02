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
		let loadNewMenu = require('./loadNewMenu').buildLoadMenu();

		loadNewMenu
			.then((res) => {
				console.log(res);
				let state = _.getState();
				state.update_range_menu = true;
				_.saveState(state);

				require('./loadNewMenu').slackNotifyMenuUpdated();

			})
			.catch((res) => {
				console.log(res);

				if(hours >= 16){
					require('./loadNewMenu').slackNotifyMenuNotUpdated();
				}
			});
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