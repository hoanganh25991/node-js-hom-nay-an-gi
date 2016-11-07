let buildReport = require('D:\\work-station\\node-js-google-drive-api-get-started/lib/getMenu.js');
let buildReportPromise = buildReport();
buildReportPromise.then(res => {
	console.log(res);
});