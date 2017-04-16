let parseUserText = require('../lib/parseUserText');

let req = {};

req.query = {
	user_name:    'hoanganh25991',
	text:         'menu',
	response_url: 'https://hello.world.com',
	command:      'lunch'
};

console.log(parseUserText(req));