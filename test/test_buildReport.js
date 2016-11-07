let buildReport = require('D:\\work-station\\node-js-google-drive-api-get-started/lib/buildReportToLunchMoney');
let buildReportPromise = buildReport();
buildReportPromise
	.then(res => {
		console.log(res);
	})
	.catch(err => {
		console.log(err);
	})
;
