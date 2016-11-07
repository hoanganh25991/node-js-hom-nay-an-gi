let storage = require('node-persist');
storage.initSync();
/**
 * lastReport info
 */
let lastReport = {
	date: '2016-11-06T09:43:13+07:00',
	numOfRows: 8,
	startRow: 277,
};
storage.setItemSync('lastReport', lastReport);

/**
 * timezone
 */
storage.setItemSync('timezone', 7);

/**
 * sheetLunchMoeny
 */
let sheetLunchMoney = {
	id: '1CM6BNJn4K24JZbn5zJLwkcES9BZ4o9wzr8t9W6kNb-8',
	activeSheetName: '2016'
};
storage.setItemSync('sheetLunchMoney', sheetLunchMoney);

/**
 * sheetNuiBayUtIt
 */
let sheetNuiBayUtIt = {
	id: '1osEF3thjxDgQiXk95N-xc9Ms9ZtgYI1CmZgKCLwIamY',
	activeSheetName: 'Gia chanh Cam Tuyet',
	menuRange: 'A585:AD608'
};
storage.setItemSync('sheetNuiBayUtIt', sheetNuiBayUtIt);

let acceptedInputDates = {
	mon: 'Monday',
	tue: 'Tuesday',
	wed: 'Wednesday',
	thu: 'Thursday',
	fri: 'Friday',
	sat: 'Saturday',
	sun: 'Sunday'
};
storage.setItemSync('acceptedInputDates', acceptedInputDates);

/**
 * Map Slack name > Sheet name
 */
let mapName = {'torinnguyen':'Torin OUS','hoanganh25991':'anh OUS'};
storage.setItemSync('mapName', mapName);

let allowedUsersRunReport = ['hoanganh25991', 'torinnguyen'];
storage.setItemSync('allowedUsersRunReport', allowedUsersRunReport);





