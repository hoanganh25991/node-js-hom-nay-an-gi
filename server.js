let bodyParser = require('body-parser');
let app = require('express')();
const dayOfWeekConvert = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
// Detect mode
let config = {mode: 'dev'};
try{
	config = require(`${__dirname}/config`);
}catch(err){
	console.log(`No config file supported\nDefault mode: dev`);
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
	// let userName = req.param('user_name');
	let userName = req.query['user_name'];
	const acceptedUserCommand = ['menu', 'order', 'batchFix', 'view', 'delete'];
	// let userText = req.param('text').replace(/\s+/g, ' ');
	let userText = req.query['text'].replace(/\s+/g, ' ');
	// let responseUrl = req.param('response_url');
	// read user text
	let userTextArr = userText.split(' ');
	if(!acceptedUserCommand.includes(userTextArr[0])){
		userTextArr = ['menu', 'today'];
	}
	// store user name
	userTextArr['user_name'] = userName;
	let mapName = require(`${__dirname}/lib/mapName`);
	let userNameInSheet = mapName[userTextArr['user_name']];
	if(!userNameInSheet)
		userNameInSheet = userTextArr['user_name'];
	// ReAdd back to userTextArr
	userTextArr['sheet_name'] = userNameInSheet;
	// userTextArr['response_url'] = responseUrl;
	console.log(userTextArr);
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
			let updatePromise = updateOrder(userTextArr);
			updatePromise.then(msg => {
				// TRY TO BUILD MUTIPLE RES for slack-cmd
				// console.log(userTextArr['response_url']);
				console.log(msg);
				// if(typeof msg != 'strig')
				// 	msg = JSON.stringify(msg);
				//
				// res.send({text: msg});
			});
			break;
		case 'batchFix':
			// let menu_range = req.query['menu_range'] || req.body['menu_range'];
			let menu_range = userTextArr[1];
			let nBUIConfig = require(`${__dirname}/lib/nuiBayUtItConfig`);
			// Update on menu_range
			// Check menu_range, detect ITS FORMAT A558:AD581
			if(menu_range && menu_range.match(/[a-zA-Z]+\d+:[a-zA-Z]+\d+/)){
				nBUIConfig['menu_range'] = menu_range;

				resPromise = new Promise((resolve, reject) => {
					let fs = require('fs');

					fs.writeFile(`${__dirname}/lib/nuiBayUtItConfig.json`, 'w', function(err){
						if(err){
							console.log('Write nuiBayUtItConfig.json failed');
							reject('Write nuiBayUtItConfig.json failed');
						}else{
							console.log('Write nuiBayUtItConfig.json success');

							let slackMsg = {
								text: 'Write nuiBayUtItConfig.json success'
							};
							resolve(slackMsg);
						}
					})
				});
			}else{
				resPromise = new Promise(resolve => {
					let slackMsg = {
						text: `Please resubmit\ninclude header`,
						attachments: [
							{
								title: 'Menu range format',
								title_link: 'https://tinker.press',
								fields: [
									{
										value: `A558:AD581`,
										short: true
									}
								],
								color: '#3AA3E3',
								footer_icon: 'https://tinker.press/favicon-64x64.png',
								ts: Math.floor(new Date().getTime() / 1000)
							}
						]
					}

					resolve(slackMsg);
				});
			}
			break;
		case 'view':
			resPromise = slackMsgView(userTextArr);
		case 'delete':
			resPromise = slackMsgDelete(userTextArr);
			// Now update delete order int sheet
			let deleteOrderPromise = deleteOrder(userTextArr);
			deleteOrderPromise
				.then(msg => console.log(msg))
				.catch(err => console.log(err));
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
				// console.log(err);
				reject(err);
			}else{
				let mtime = new Date(stats.mtime);
				resolve(mtime);
			}
		});
	});

	let checkOutdatedPromise = statMenusJsonPromise.then(mtime => {
		let _ = require(`${__dirname}/lib/util`);
		let thisWeek = _.getWeekNumber(new Date());
		let menuJsonCreatedWeek = _.getWeekNumber(mtime);
		console.log('Menus.json mtime (week): ', menuJsonCreatedWeek);
		console.log('Request for menus (week): ', thisWeek);

		let isOutOfDate = (thisWeek > menuJsonCreatedWeek);
		return new Promise(resolve => resolve(isOutOfDate));
	})
    .catch(err => {
		// console.log(err);
		console.log('Menus.json not exist');
		return new Promise(resolve => resolve(true));
	});

	let getDateMenusPromise = checkOutdatedPromise.then(isOutOfDate => {
		console.log('Menus.json isOutOfDate: ', isOutOfDate);

		if(!isOutOfDate){
			return new Promise(resolve => {
				resolve(JSON.parse(fs.readFileSync(`${__dirname}/menus.json`).toString()));
			});
		}else{
			return require(`${__dirname}/getMenu`);
		}
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
		// console.log(err);
		if(err == 'nuiBayUtItConfig.json is outOfDate'){
			let slackMsg = {
				text: 'Menu not updated',
				attachments: [
					{
						title: 'For admin',
						fields: [
							{
								value: 'Type /lunch batchFix <menu range>, to update menu',
								short: true,
								color: 'danger',
								footer_icon: 'https://tinker.press/favicon-64x64.png',
								ts: Math.floor(new Date().getTime() / 1000)
							}
						]
					}
				]
			};

			return new Promise(resolve => resolve(slackMsg));
		}
	});

	return slackMsgPromise;
}

function slackMsgOrder(userTextArr){
	let getDateMenusPromise = loadMenu();

	let slackMsgPromise = getDateMenusPromise.then(menus => {
		// let dayOfWeek = new Date().getDay() - 1;
		let userInputDay = userTextArr[1].toLocaleLowerCase();
		let isUserInputDay = dayOfWeekConvert.indexOf(userInputDay) != -1;

		let day = new Date().getDate();
		if(isUserInputDay){
			let dayOfWeek = dayOfWeekConvert.indexOf(userInputDay);
			// let dayOfWeek = 5;
			let dd = new Date();
			let dayx = dd.getDay();
			let	diff = dd.getDate() - dayx + (dayx == 0 ? -6 : 1) + dayOfWeek;

			day = new Date(dd.setDate(diff)).getDate();
		}
		
		// let menu = menus[dayOfWeek];
		// Better check menu by reading out
		let menu = menus.filter(menu =>{
			let menuDate = new Date(menu.date);
			return (day == menuDate.getDate());
		})[0];

		if(!menu){
			return new Promise(resolve => {
				let slackMsg = {
					text: `Hi @${userTextArr['user_name']}`,
					attachments:[
						{
							title: `Order error`,
							text: `Menu for today not exist`,
							color: 'danger',
							footer: 'Type /lunch menu <day>, to view menu\nChúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
							footer_icon: 'https://tinker.press/favicon-64x64.png',
							ts: Math.floor(new Date().getTime() / 1000)
						}
					]
				}

				resolve(slackMsg);
			});
		}

		// LOGIC ON CASE order mon 19
		let dishIndex = parseInt(userTextArr[1], 10);
		if(isUserInputDay){
			dishIndex = parseInt(userTextArr[2], 10);
		}

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
		// Improve info by REMOVE him from his self
		let otherUsersBookDishArr = dish.users.filter(userName => userName != userTextArr['sheet_name']);
		if(otherUsersBookDishArr.length > 0)
			otherUsersBookDish = otherUsersBookDishArr.join(', ');

		let slackMsg = {
			text: `Hi @${userTextArr['user_name']}`,
			attachments: [
				{
					title: `Order on ${menu.date}`,
					title_link: 'https://tinker.press/good-food-good-life.jpg',
					fields: [
						{
							value: `You've ordered: \`${dish['name']}\``,
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

function updateOrder(userTextArr){
	let getDateMenusPromise = require(`${__dirname}/getMenu`);
	let updatePromise = getDateMenusPromise.then(dateMenus => {
		let selectedDishIndex = userTextArr[1];
		// console.log(userTextArr);

		// let dayOfWeek = new Date().getDay() - 1;
		// let menu = dateMenus[dayOfWeek];
		// let dayOfWeek = new Date().getDay() - 1;
		let day = new Date().getDate();
		// let menu = menus[dayOfWeek];
		// Better check menu by reading out
		let menu = dateMenus.filter(menu =>{
			let menuDate = new Date(menu.date);
			return (day == menuDate.getDate());
		})[0];
		if(!menu){
			return new Promise(resolve => resolve('No menu'));
		}

		let dish = menu.dishes[selectedDishIndex];
		if(!dish){
			return new Promise(resolve => resolve('User choose dishIndex, which not exist'));
		}

		/**
		 * IN CASE USER UPDATE HIS ORDER, detect from previous, then update
		 */
		let preOrderDishIndexs = [];
		// Only check ONE TIME
		// If he append in mutilple row?
		menu.dishes.forEach((dish, index) => {
			let removingUserIndexs = [];
			dish.users.forEach((userName, userIndex) => {
				if(userName == userTextArr['sheet_name']){
					// store which dish need UPDATE
					if(!preOrderDishIndexs.includes(index) && selectedDishIndex != index)
						preOrderDishIndexs.push(index);
					// store which user need REMOVED
					removingUserIndexs.push(userIndex);
				}
			});

			dish.users = dish.users.filter((val, index) => {
				return !removingUserIndexs.includes(index);
			});
		});
		console.log('preOrderDishIndexs', preOrderDishIndexs);

		let preOrderDishPromises = [];
		preOrderDishIndexs.forEach(preOrderDishIndex => {
			// Build cellAddress, cellVal
			// Run update in to sheet
			// NEED PROMISE ALL
			let preOrderDish = menu.dishes[preOrderDishIndex];
			let cell = buildCell(menu, preOrderDish);

			let updatePromise = require(`${__dirname}/updateOrderToSheet`)(cell);
			updatePromise
				.then(msg => console.log(msg))
				.catch(err => console.log(err));

			preOrderDishPromises.push(updatePromise);
		});

		// ONLY UPDATE NEW ONE after remove user from others
		return Promise.all(preOrderDishPromises).then(function (){
			console.log('Remove user from others book success');

			if(dish.users.includes(userTextArr['sheet_name'])){
				// He just re-submit, no thing NEW
				return new Promise(resolve => resolve('Your order saved\nNo need to resubmit'));
			}else{
				dish.users.push(userTextArr['sheet_name']);
				let cell = buildCell(menu, dish);

				console.log(`${__dirname}/updateOrderToSheet`);
				let updatePromise = require(`${__dirname}/updateOrderToSheet`)(cell);
				updatePromise.then(msg => console.log(msg));

				return updatePromise;
			}
		});
	});

	return updatePromise;
}

function buildCell(menu, dish){
	let col = menu.col;
	let row = dish.row;
	// Build cell address, base on dish-row, menu-col
	// Read out basic info from config
	let nBUUConfig = require(`${__dirname}/lib/nuiBayUtItConfig`);
	// console.log(col, row, nBUUConfig);
	// ONLY read out the first one A558:AD581
	// Build up row, col logic
	let startRow = nBUUConfig['menu_range'].match(/\d+/);
	startRow = parseInt(startRow, 10);
	row += startRow;
	col += 2; //col for menu, +2 for userList
	// Parse to A1 notation
	let _ = require(`${__dirname}/lib/util`);
	let cellAddress = `${_.convertA1Notation(col).toUpperCase()}${row}`;
	// Build up cellVal, update dish.users
	let cellVal = dish.users.join(',');
	console.log('build Cell', cellAddress, cellVal);

	return {cellAddress, cellVal};
}

function slackMsgView(userTextArr){
	let getDateMenusPromise = loadMenu();

	let slackMsgPromise = getDateMenusPromise.then(menus => {
		let dayOfWeek = new Date().getDay() - 1;
		let menu = menus[dayOfWeek];

		let orderedDish = 'You haven\'t order dish'
		menu.dishes.forEach(dish => {
			dish.users.forEach(userName => {
				if(userName == userTextArr['sheet_name'])
					orderedDish = dish['name'];
			});
		});

		let slackMsg = {
			text: `Hi @${userTextArr['user_name']}`,
			attachments: [
				{
					title: 'Review Order',
					fields: [
						{
							value: `${orderedDish}`,
							short: true,
							color: '#3AA3E3',
							footer: 'Type /lunch order [dish num], to order',
							footer_icon: 'https://tinker.press/favicon-64x64.png',
							ts: Math.floor(new Date().getTime() / 1000)
						}
					]
				}
			]
		};

		return new Promise(resolve => resolve(slackMsg));
	});

	return slackMsgPromise;
}

function slackMsgDelete(userTextArr){
	let slackMsg = {
		text: `Hi @${userTextArr['user_name']}`,
		attachments: [
			{
				title: 'Delete order',
				fields: [
					{
						value: `I'm deleting your order`,
						short: true
					}
				],
				color: '#3AA3E3',
				footer_icon: 'https://tinker.press/favicon-64x64.png',
				ts: Math.floor(new Date().getTime() / 1000)
			}
		]
	}

	return new Promise(resolve => resolve(slackMsg));
}

function deleteOrder(userTextArr){
	let getDateMenusPromise = require(`${__dirname}/getMenu`);
	let updatePromise = getDateMenusPromise.then(dateMenus => {
		// console.log(userTextArr);

		// let dayOfWeek = new Date().getDay() - 1;
		// let menu = dateMenus[dayOfWeek];
		// let dayOfWeek = new Date().getDay() - 1;
		let day = new Date().getDate();
		// let menu = menus[dayOfWeek];
		// Better check menu by reading out
		let menu = dateMenus.filter(menu =>{
			let menuDate = new Date(menu.date);
			return (day == menuDate.getDate());
		})[0];
		if(!menu){
			return new Promise(resolve => resolve('No menu'));
		}

		/**
		 * IN CASE USER UPDATE HIS ORDER, detect from previous, then update
		 */
		let preOrderDishIndexs = [];
		// Only check ONE TIME
		// If he append in mutilple row?
		menu.dishes.forEach((dish, index) => {
			let removingUserIndexs = [];
			dish.users.forEach((userName, userIndex) => {
				if(userName == userTextArr['sheet_name']){
					// store which dish need UPDATE
					// check include because, on that row
					// userName may appear more than one
					if(!preOrderDishIndexs.includes(index))
						preOrderDishIndexs.push(index);
					// store which user need REMOVED
					removingUserIndexs.push(userIndex);
				}
			});

			dish.users = dish.users.filter((val, index) => {
				return !removingUserIndexs.includes(index);
			});
		});
		console.log('preOrderDishIndexs', preOrderDishIndexs);

		let preOrderDishPromises = [];
		preOrderDishIndexs.forEach(preOrderDishIndex => {
			// Build cellAddress, cellVal
			// Run update in to sheet
			// NEED PROMISE ALL
			let preOrderDish = menu.dishes[preOrderDishIndex];
			let cell = buildCell(menu, preOrderDish);

			let updatePromise = require(`${__dirname}/updateOrderToSheet`)(cell);
			updatePromise
				.then(msg => console.log(msg))
				.catch(err => console.log(err));

			preOrderDishPromises.push(updatePromise);
		});

		// ONLY UPDATE NEW ONE after remove user from others
		return Promise.all(preOrderDishPromises).then(function (){
			console.log('Remove user from others book success');

			return new Promise(resolve => resolve('Remove success'));
		});
	});

	return updatePromise;
}