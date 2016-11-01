var express = require('express');
var bodyParser = require('body-parser');
var multer = require('multer'); // v1.0.5
var upload = multer(); // for parsing multipart/form-data

var app = require('express')();
if(process.argv[2] == 'production'){
	var fs = require('fs');
	var privateKey = fs.readFileSync('/etc/letsencrypt/live/tinker.press/privkey.pem');
	var certificate = fs.readFileSync('/etc/letsencrypt/live/tinker.press/cert.pem');
	var credentials = {key: privateKey, cert: certificate};
	var https = require('https');
	var httpsPort = 3000;
	var app = express.createServer(credentials);
	var secureServer = https.createServer(credentials, app).listen(httpsPort);
	app.set(httpsPort);
}else{
	app.listen(3000, function () {
		console.log('Example app listening on port 3000!');
	});
}

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.get('/', function (req, res) {
	let userName = req.param('user_name', 'Hoang Anh');
	let acceptedUserCommand = ['menu', 'order'];
	let userText = req.param('text').replace(/\s+/g, ' ');
	let userTextArr = userText.split(' ');
	if(!acceptedUserCommand.includes(userTextArr[0])){
		userTextArr = ['menu', 'today'];
	}
	userTextArr['user_name'] = userName;

	let response = {text : 'i hear you'};
	switch(userTextArr[0]){
		case 'menu':
			if(!(userTextArr[1])){
				userTextArr[1] = 'today';
			}

			response = loadMenu(userTextArr);
			break;
		case 'order':
			response = 'in develop process';
			break;
	}

  	res.send(response);
});

app.post('/', function (req, res) {
	let userName = req.param('user_name', 'Hoang Anh');
  	res.send(userName);
});

app.get('/menu', function (req, res) {
  let getDateMenusPromise = require(`${__dirname}/getMenu`);
  getDateMenusPromise.then(dateMenus => {
  	let menu = dateMenus.filter(dateMenu => {
  		let date = new Date().getDate();console.log(date);
  		let menuDate = new Date(dateMenu.date).getDate();console.log(menuDate);

  		return date == menuDate;
  	});
  	if(menu.length == 0)
  		menu[0] = dateMenus[0];

  	res.send(JSON.stringify(menu[0]));
  });
});

function loadMenu(userTextArr){
	let fs = require('fs');
	let menus = JSON.parse(fs.readFileSync('menus.json').toString());
	// console.log(menus);
	let menu = menus[0];
	let dishesV2 = [];
	menu.dishes.forEach((dish, index) => {
		let tmp = {
			value: `[${index}] ${dish.name}`,
			short: true
		};
		dishesV2.push(tmp);

		tmp = {
			value: `${dish.price},000`,
			short: true
		};
		dishesV2.push(tmp);
	});

	let slackMsg = {
		text: `Hi, @${userTextArr['user_name']}, menu for ${userTextArr[1]}`,
		attachments: [
			{
				title: 'Quan Chanh Cam Tuyet',
				title_link: 'https://api.slack.com/',
				fields: dishesV2,
				color: '#3AA3E3',
				footer: 'Type `/lunch order [num]` to order',
				footer_icon: 'https://tinker.press/favicon-64x64.png',
            	ts: Math.floor(new Date().getTime()/1000)
			}
		]
	};

	console.log(slackMsg);

	return slackMsg;
}