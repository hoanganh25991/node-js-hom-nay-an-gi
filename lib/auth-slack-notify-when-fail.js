let slackNotifyAuthFail = function(err = ''){
	// slack msg notify OHH YEAHH YEAHH we have new menu
	let slackMsg = {
		text: `Auth for Google Sheet fail`,
		attachments: [
			{
				title: `Please ask admin for help`,
				title_link: `https://tinker.press`,
				fields: [
					{
						title: `At root project, run command`,
						value: `node lib/manual-get-access-token`,
						short: true
					},
					
					{
						title: 'Error Info',
						value: JSON.stringify(err),
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

module.exports = slackNotifyAuthFail;