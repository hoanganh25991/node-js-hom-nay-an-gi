let _ = require(`${__dirname}/lib/util`);
let storage = _.getStorage();

let lastReport = {
	date: '2016-11-06T09:43:13+07:00',
	numOfRows: 8,
	startRow: 297,
};

storage.setItemSync('lastReport', lastReport);