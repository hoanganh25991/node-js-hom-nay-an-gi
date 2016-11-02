let bodyParser = require('body-parser');
let app = require('express')();
let _ = require(`${__dirname}/lib/util`);
// Detect mode
let config = {mode: 'dev'};
try{
	config = require(`${__dirname}/config`);
}catch(err){
	console.log(`No config file supported${_.eol}Default mode: dev`);
}

if(config.mode == 'production'){
	let fs = require('fs');
	let privateKey = fs.readFileSync('/etc/letsencrypt/live/tinker.press/privkey.pem');
	let certificate = fs.readFileSync('/etc/letsencrypt/live/tinker.press/cert.pem');
	let credentials = {key: privateKey, cert: certificate};
	let https = require('https');
	let httpsPort = 3000;
	https.createServer(credentials, app).listen(httpsPort, function(){
		console.log('HTTPS server listening on port 3000!');
	});
}else{
	app.listen(3000, function(){
		console.log('Server listening on port 3000!');
	});
}

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded

app.get('/', function(req, res){
	// userTextArr as destination
	// Contain any useful info from user
	let userName = req.param('user_name');
	const acceptedUserCommand = ['menu', 'order'];
	let userText = req.param('text').replace(/\s+/g, ' ');
	// read user text
	let userTextArr = userText.split(' ');
	if(!acceptedUserCommand.includes(userTextArr[0])){
		userTextArr = ['menu', 'today'];
	}
	// store user name
	userTextArr['user_name'] = userName;
	// Build up default response
	let response = {text: 'i hear you'};
	let resPromise;
	// Switch case on user command
	switch(userTextArr[0]){
		case 'menu':
			if(!(userTextArr[1])){
				userTextArr[1] = 'today';
			}
			// load menu return menu-info promise
			resPromise = slackMsgMenu(userTextArr);
			break;
		case 'order':
			// response = 'in develop process';
			// resPromise = new Promise(resolve => resolve(response));
			resPromise = slackMsgOrder(userTextArr);
			// right after res
			// we need to callback to NuiBayUtIt sheet
			// get updated info
			// batchUpdate
			let updatePromise = updateOrderToSheet(userTextArr);
			break;
	}

	resPromise.then(slackMsg => {
		res.send(slackMsg);
	});
});

app.get('/menu', function(req, res){
	let getDateMenusPromise = require(`${__dirname}/getMenu`);
	getDateMenusPromise.then(dateMenus =>{
		let menu = dateMenus.filter(dateMenu =>{
			let date = new Date().getDate();
			console.log(date);
			let menuDate = new Date(dateMenu.date).getDate();
			console.log(menuDate);

			return date == menuDate;
		});
		if(menu.length == 0)
			menu[0] = dateMenus[0];

		res.send(JSON.stringify(menu[0]));
	});
});

function loadMenu(){
	let fs = require('fs');

	let statMenusJsonPromise = new Promise((resolve, reject) => {
		fs.stat(`${__dirname}/menus.json`, function(err, stats){
			if(err){
				reject(err);
			}else{
				let mtime = new Date(stats.mtime);
				resolve(mtime);
			}
		});
	});

	let checkOutdatedPromise = statMenusJsonPromise.then(mtime => {
		let thisWeek = _.getWeekNumber(new Date());
		let menuJsonCreatedWeek = _.getWeekNumber(mtime);

		let outdated = (thisWeek > menuJsonCreatedWeek);
		return new Promise(resolve => resolve(outdated));
	})
    .catch(err => {
		console.log(err);
		return new Promise(resolve => resolve(true));
	});

	let getDateMenusPromise = checkOutdatedPromise.then(outdated => {
		console.log('move to outdated');
		console.log(outdated);
		let promise;
		if(!outdated){
			promise = new Promise(resolve => {
				resolve(JSON.parse(fs.readFileSync('menus.json').toString()));
			});
		}else{
			// promise = require(`${__dirname}/getMenu`).then(dateMenus => {
			// 	return new Promise(resolve => resolve(dateMenus));
			// });
			promise = require(`${__dirname}/getMenu`);
		}

		return promise;
	});

	return getDateMenusPromise;
}

function slackMsgMenu(userTextArr){
	let getDateMenusPromise = loadMenu();

	let slackMsgPromise = getDateMenusPromise.then(menus => {
		let dayOfWeek = new Date().getDay() - 1;
		let menu = menus[dayOfWeek];
		
		let dishesV2 = [];
		menu.dishes.forEach((dish, index) =>{
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

		// let today = new Date();
		let slackMsg = {
			// text: `Hi, @${userTextArr['user_name']}, menu for ${userTextArr[1]}`,
			text: `Hi, @${userTextArr['user_name']}, menu ${userTextArr[1]} ${new Date().toString().substr(0,10)}`,
			attachments: [
				{
					title: 'Quan Chanh Cam Tuyet',
					// title_link: 'https://api.slack.com/',
					title_link: 'https://tinker.press/good-food-good-life.jpg',
					fields: dishesV2,
					color: '#3AA3E3',
					footer: 'Type `/lunch order [num]` to order',
					footer_icon: 'https://tinker.press/favicon-64x64.png',
					ts: Math.floor(new Date().getTime() / 1000)
				}
			]
		};

		return new Promise(resolve => resolve(slackMsg));
	})
	.catch(err => {
		console.log(err);
	});

	return slackMsgPromise;
}

function slackMsgOrder(userTextArr){
	let getDateMenusPromise = loadMenu();

	let slackMsgPromise = getDateMenusPromise.then(menus => {
		let dayOfWeek = new Date().getDay() - 1;
		let menu = menus[dayOfWeek];

		let dishIndex = parseInt(userTextArr[1], 10);
		if(isNaN(dishIndex)){
			dishIndex = 0;
		}
		// Update back into userTextArr
		userTextArr[1] = dishIndex;

		let dish = menu.dishes[dishIndex];
		if(!dish){
			return new Promise(resolve => {
				let slackMsg = {
					text: `Order error`,
					attachments: [
						{
							text: `You have order dish [${dishIndex}], which not exist`,
							color: 'danger',
							footer: 'ReType `/lunch order [num]` to reorder\nChúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
							footer_icon: 'https://tinker.press/favicon-64x64.png',
							ts: Math.floor(new Date().getTime() / 1000)
						}
					]
				}

				resolve(slackMsg);
			});
		}

		let otherUsersBookDish = 'No one';
		if(dish.users.length > 0)
			otherUsersBookDish = dish.users.join(', ');

		let slackMsg = {
			text: `Hi @${userTextArr['user_name']}`,
			attachments: [
				{
					title: 'Quan Chanh Cam Tuyet',
					title_link: 'https://tinker.press/good-food-good-life.jpg',
					fields: [
						{
							value: `You have ordered: \`${dish['name']}\``,
							short: true
						},
						{
							value: `${dish['price']}k`,
							short: true
						},
						{
							value: `Other users:`,
							short: true
						},
						{
							value: `${otherUsersBookDish}`,
							short: true
						}
					],
					color: '#3AA3E3',
					footer: 'ReType `/lunch order [num]` to reorder\nChúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
					footer_icon: 'https://tinker.press/favicon-64x64.png',
					ts: Math.floor(new Date().getTime() / 1000)
				}
			]
		};

		return new Promise(resolve => resolve(slackMsg));
	});

	return slackMsgPromise;
}

function updateOrderToSheet(userTextArr){
	// Have to use userName in sheet, which different from slackName
	let mapName = require(`${__dirname}/lib/mapName`);
	let userNameInSheet = mapName[userTextArr['user_name']];
	if(!userNameInSheet)
		userNameInSheet = userTextArr['user_name'];
	// ReAdd back to userTextArr
	userTextArr['sheet_name'] = userNameInSheet;

	let getDateMenusPromise = require(`${__dirname}/getMenu`);
	getDateMenusPromise.then(dateMenus => {
		let selectedDishIndex = userTextArr[1];
		// console.log(selectedDishIndex);
		

	});
}