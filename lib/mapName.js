let fs = require('fs');
let config = {};

try{
	config = JSON.parse(fs.readFileSync(`${__dirname}/mapSlacknameUsername.json`).toString());
}catch(err){
	if(err){
		console.log('Parse mapSlacknameUsername.json failed!');
	}

	config = {};
}

module.exports = config;