/**
 * This is TRACE
 */
// require('@risingstack/trace');
// your application's code
/**
 * THIS IS FOR MONITOR ON HTTP LAG on keymetric
 */
// require("appdynamics").profile({
// 	controllerHostName: 'paid108.saas.appdynamics.com',
// 	controllerPort: 443, 
// 	// controllerPort: 1234, 

// 	// If SSL, be sure to enable the next line
// 	controllerSslEnabled: true,
// 	accountName: 'originallyussg',
// 	accountAccessKey: 'j3i8ckm981gf',
// 	applicationName: 'Hom nay an gi',
// 	tierName: 'AppDynamic',
// 	nodeName: 'process' // The controller will automatically append the node name with a unique number
// });
// require('pmx').init();
/**
 * Build report 10 minutes interval
 * @type {number}
 */
let buildReport = require(`${__dirname}/lib/buildReport`);
setInterval(function(){
	// console.log('Run buildReport interval');
	//noinspection JSValidateTypes
	let buildReportPromise = buildReport(false);
	buildReportPromise.then(() => {
		let content = `[${new Date().toString().substr(0,10)}] Report built\n`;
		let fs = require('fs');
		fs.writeFileSync(`${__dirname}/buildReport.log`, content, {flag: 'a'});
	})
}, 60 * 60000);
// }, 10000);

let checkMenuUpdate = require(`${__dirname}/lib/checkMenuUpdate`);
setInterval(function(){
	checkMenuUpdate();
}, 10 * 60000);
// }, 5000);

/**
 * Create server
 * @type {Parsers}
 */
let bodyParser = require('body-parser');
let app = require('express')();
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
let rollbar = require('rollbar');
app.use(bodyParser.urlencoded({extended: true})); // for parsing application/x-www-form-urlencoded
/**
 * debug with rollbar
 */
app.use(rollbar.errorHandler('4a831c1b57ff4b6ba24c49fd9bf36a66'));
app.get('/error/rollbar', function(req, res){
	rollbar.reportMessage('Test rollbar debug-track', 'error', req, function(){
		console.log('Test rollbar debug-track');
	});
	res.send('Rollbar has reported debug msg');
})

/**
 * Listen to command
 */
let _ = require(`${__dirname}/lib/util`);
let parseUserText = require(`${__dirname}/lib/parseUserText`);
let storage = _.getStorage();
app.get('/', function(req, res){
	console.log(req.query);
	let userTextArr = parseUserText(req);
	/**
	 * Some command NEED USERNAME
	 * check it here
	 * @type {string[]}
	 */
	let cmdsDependOnUsername = ['order', 'view', 'delete'];
	if(!userTextArr['sheet_name'] && cmdsDependOnUsername.includes(userTextArr['cmd'])){
		slackMsgCmdNeedUserName(userTextArr).then(slackMsg => {
			res.send(slackMsg);
		});
		
		return;
	}

	/**
	 * Base on user cmd, build res
	 */
	let resPromise;
	switch(userTextArr[0]){
		case 'menu':
			resPromise = getMenuMsgPromise(userTextArr);
			break;
		case 'order':
			resPromise = getOrderMsgPromise(userTextArr);
			let updatePromise = updateOrder(userTextArr);
			updatePromise.then(()=>{console.log('Update order success')});
			break;
		case 'batchFix':
			let menu_range = userTextArr[1];
			// Check right menu_range format
			if(menu_range && menu_range.match(/[a-zA-Z]+\d+:[a-zA-Z]+\d+/)){
				resPromise = new Promise(r => r(slackMsgBatchFixMenuRangeAccepted(menu_range)));
			}else{
				resPromise = new Promise(resolve =>resolve(slackMsgBatchFixMenuRangeFail()));
			}
			break;
		case 'view':
			resPromise = getViewMsgPromise(userTextArr);
			break;
		case 'cancel':
		case 'delete':
			resPromise = getDeleteMsgPromise(userTextArr);
			// Now update delete order int sheet
			let deleteOrderPromise = deleteOrder(userTextArr);
			deleteOrderPromise.then(()=>{console.log('Delete order success')});
			break;
		case 'name':
			resPromise = getNameMsgPromise(userTextArr);
			let storeNamePromise = storeName(userTextArr);
			storeNamePromise.then(msg => console.log(msg));
			break;
		case 'help':
			resPromise = getHelpMsgPromise(userTextArr);
			break;
		case 'report':
			userTextArr['report_msg'] =
				userTextArr['isAllowedRunReport'] ? 'I\'m building report' : 'Sorry, you don\'t have permission to build report';

			resPromise = new Promise(r => r(slackMsgReport(userTextArr)));

			if(userTextArr['isAllowedRunReport']){
				let buildReportPromise = buildReport();
				buildReportPromise.then(() => {console.log('Build report success')})
			}
			break;
		case 'email':
			let buildEmailLink = require(`${__dirname}/sheetToEmail`);
			let emailInfo = buildEmailLink(userTextArr);
			let slackMsg = {
				text: `Hi @${userTextArr['user_name']}`,
				attachments:[
					{
						title: `Email for menu on ${emailInfo.sendForDay.toString().substr(0,10)}`,
						// title_link: `https://tinker.press`,
						fields: [
							{
								value: `Please <${emailInfo.link}|click here> to confirm`,
								short: true
							}
						],
						color: 'danger',
						footer: 'Chúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
						footer_icon: 'https://tinker.press/favicon-64x64.png',
						ts: Math.floor(new Date().getTime() / 1000)
					}
				]
			}
			resPromise = new Promise(resolve => resolve(slackMsg));

			break;
		default:
			resPromise = new Promise(resolve => resolve(slackMsgCmdNotFound(userTextArr)));

			break;
	}

	resPromise.then(slackMsg => {
		res.send(slackMsg);
	});
});

function loadMenu(){
	let fs = require('fs');

	return new Promise(resolve => resolve(JSON.parse(fs.readFileSync(`${__dirname}/menus.json`).toString())));
}

function getMenuMsgPromise(userTextArr){
	let getDateMenusPromise = loadMenu();

	let slackMsgPromise = getDateMenusPromise.then(menus => {
		let menu = whichMenu(userTextArr, menus);

		if(!menu){
			return new Promise(r => r(slackMsgMenuNotFound(userTextArr)));
		}

		return new Promise(resolve => resolve(slackMsgMenuFound(userTextArr, menu)));
	})
	.catch(err => {
		// console.log(err);
		if(err == 'nuiBayUtItConfig.json is outOfDate'){
			let slackMsg = {
				text: 'Menu not updated',
				attachments: [
					{
						title: 'For admin',
						title_link: 'https://tinker.press',
						fields: [
							{
								value: 'Type /lunch batchFix <menu range>, to update menu',
								short: true,
								color: 'danger',
								footer: 'Chúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
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

function getOrderMsgPromise(userTextArr){
	let getDateMenusPromise = loadMenu();

	let slackMsgPromise = getDateMenusPromise.then(menus => {
		// let dayOfWeek = new Date().getDay() - 1;
		console.log('dishIndex', userTextArr['dishIndex']);
		if(userTextArr['dishIndex'] == undefined){
			return new Promise(resolve => resolve(slackMsgNoDishIndex(userTextArr)));
		}

		let menu = whichMenu(userTextArr, menus);

		if(!menu){
			return new Promise(resolve =>resolve(slackMsgNoMenu(userTextArr)));
		}

		// LOGIC ON CASE order mon 19
		let dish = menu.dishes[userTextArr['dishIndex']];

		if(!dish){
			return new Promise(resolve => resolve(slackMsgNoDishIndex(userTextArr)));
		}

		return new Promise(resolve => resolve(slackMsgOrder(userTextArr, menu)));
	});

	return slackMsgPromise;
}

function updateOrder(userTextArr){
	let getDateMenusPromise = require(`${__dirname}/lib/getMenu`)(false);

	let updatePromise = getDateMenusPromise.then(dateMenus => {

		let menu = whichMenu(userTextArr, dateMenus);
		if(!menu || !menu.dishes[userTextArr['dishIndex']]){
			return new Promise(res => res('Not right case to update order'));
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
					if(!preOrderDishIndexs.includes(index) && userTextArr['dishIndex'] != index)
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

			let updatePromise = require(`${__dirname}/lib/updateOrderToSheet`)(cell);
			// updatePromise
			// 	.then(msg => console.log(msg))
			// 	.catch(err => console.log(err));

			preOrderDishPromises.push(updatePromise);
		});

		// ONLY UPDATE NEW ONE after remove user from others

		return Promise.all(preOrderDishPromises).then(function (){
			console.log('Remove user from others book success');

			let dish = menu.dishes[userTextArr['dishIndex']];

			if(dish.users.includes(userTextArr['sheet_name'])){
				// He just re-submit, no thing NEW
				return new Promise(resolve => resolve('Your order saved\nNo need to resubmit'));
			}else{
				dish.users.push(userTextArr['sheet_name']);
				let cell = buildCell(menu, dish);
				let updatePromise = require(`${__dirname}/lib/updateOrderToSheet`)(cell);

				writeCacheFile(dateMenus);

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
	let sheetNuiBayUtIt = storage.getItemSync('sheetNuiBayUtIt');
	// console.log(col, row, sheetNuiBayUtIt);
	// ONLY read out the first one A558:AD581
	// Build up row, col logic
	/** 
	 * FALL CASE
	 * when new_range available, what the heck???
	 * menu.col still right, BUT, startRow need to change
	 * @type {[type]}
	 */
	let moment = require('moment');
	let today = moment().utcOffset(storage.getItemSync('timezone') * 60);
	let menuDate = moment(menu.date, 'D-MMM-YYYY').utcOffset(storage.getItemSync('timezone') * 60);

	let startRow = sheetNuiBayUtIt['menuRange'].match(/\d+/)[0];
	startRow = parseInt(startRow, 10);

	/**
	 * When new range come, this fail
	 */
	console.log(today.format());
	console.log(menuDate.format());
	if(!menuDate.isSame(today, 'isoWeek')){
		console.log('Different week');
		startRow = sheetNuiBayUtIt['newMenuRange'].match(/\d+/)[0];
		startRow = parseInt(startRow, 10);

		if(!menuDate.isSame(today, 'isoWeek')){
			console.log(`Menu date not match ANYTHING`);
		}
	}
	row += startRow;
	col += 2; //col for menu, +2 for userList
	// Parse to A1 notation
	let cellAddress = `${_.convertA1Notation(col).toUpperCase()}${row}`;
	// Build up cellVal, update dish.users
	let cellVal = dish.users.join(',');
	console.log('build Cell', cellAddress, cellVal);

	return {cellAddress, cellVal};
}

function getViewMsgPromise(userTextArr){
	let getDateMenusPromise = loadMenu();

	let slackMsgPromise = getDateMenusPromise.then(menus => {
		let  menu = whichMenu(userTextArr, menus);

		if(!menu){
			return new Promise(r => r({text: 'No menu found'}));
		}

		let orderedDish = 'You haven\'t order dish'
		console.log(userTextArr['sheet_name']);
		menu.dishes.forEach(dish => {
			dish.users.forEach(userName => {
				// console.log(userName);
				if(userName == userTextArr['sheet_name'])
					orderedDish = `${dish['name']} - ${dish['price']}k`;
			});
		});

		let slackMsg = {
			text: `Hi @${userTextArr['user_name']}`,
			attachments: [
				{
					title: `Review order on ${menu.date}`,
					title_link: `https://tinker.press`,
					fields: [
						{
							value: `${orderedDish}`,
							short: true
						}
					],
					// color: '#3AA3E3',
					// footer: 'Type /lunch order [dish num], to order',
					footer: 'Chúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
					footer_icon: 'https://tinker.press/favicon-64x64.png',
					ts: Math.floor(new Date().getTime() / 1000)
				}
			]
		};

		return new Promise(resolve => resolve(slackMsg));
	});

	return slackMsgPromise;
}

function getDeleteMsgPromise(userTextArr){
	let slackMsg = {
		text: `Hi @${userTextArr['user_name']}`,
		attachments: [
			{
				title: 'Delete order',
				title_link: 'https://tinker.press',
				fields: [
					{
						value: `I'm deleting your order`,
						short: true
					}
				],
				// color: '#3AA3E3',
				footer_icon: 'https://tinker.press/favicon-64x64.png',
				ts: Math.floor(new Date().getTime() / 1000)
			}
		]
	}

	return new Promise(resolve => resolve(slackMsg));
}

function deleteOrder(userTextArr){
	let getDateMenusPromise = require(`${__dirname}/lib/getMenu`)(false);

	let updatePromise = getDateMenusPromise.then(dateMenus => {
		let menu = whichMenu(userTextArr, dateMenus);

		if(!menu){
			return new Promise(r => r('No menu found'));
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

			let updatePromise = require(`${__dirname}/lib/updateOrderToSheet`)(cell);
			updatePromise
				.then(msg => console.log(msg))
				.catch(err => console.log(err));

			preOrderDishPromises.push(updatePromise);
		});

		// ONLY UPDATE NEW ONE after remove user from others
		return Promise.all(preOrderDishPromises).then(function (){
			console.log('Remove user from others book success');

			// update cache file
			writeCacheFile(dateMenus);

			return new Promise(resolve => resolve('Remove success'));
		});
	});

	return updatePromise;
}

function getNameMsgPromise(userTextArr){
	/**
	 * CASE YOUR JUST WANT TO REVIEW
	 */
	if(userTextArr['new_name'] == '' && userTextArr['sheet_name']){
		let slackMsg = {
			text: `Hi @${userTextArr['user_name']}`,
			attachments: [
				{
					title: 'Review name in google sheet',
					title_link: 'https://tinker.press',
					fields: [
						{
							value: `You've set to`,
							short: true
						},
						{
							value: `${userTextArr['sheet_name']}`,
							short: true
						}
					],
					color: '3AA3E3',
					footer: 'Chúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
					footer_icon: 'https://tinker.press/favicon-64x64.png',
					ts: Math.floor(new Date().getTime() / 1000)
				}
			]
		}

		return new Promise(resolve => resolve(slackMsg));
	}


	if(userTextArr['new_name'] == '' && !userTextArr['sheet_name']){
		let slackMsg = {
			text: `Hi @${userTextArr['user_name']}`,
			attachments: [
				{
					title: 'Set name',
					title_link: 'https://tinker.press',
					fields: [
						{
							title: `To set name for google sheet`,
							value: `Please type /lunch name <your name>`,
							short: true
						}
					],
					color: 'danger',
					footer: 'Chúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
					footer_icon: 'https://tinker.press/favicon-64x64.png',
					ts: Math.floor(new Date().getTime() / 1000)
				}
			]
		}

		return new Promise(resolve => resolve(slackMsg));
	}

	let slackMsg = {
		text: `Hi @${userTextArr['user_name']}`,
		attachments: [
			{
				title: 'Set name',
				title_link: 'https://tinker.press',
				fields: [
					{
						value: `Thank you, your name in google sheet`,
						short: true
					},
					{
						value: `${userTextArr['new_name']}`,
						short: true
					}
				],
				// color: '#3AA3E3',
				footer: 'Chúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
				footer_icon: 'https://tinker.press/favicon-64x64.png',
				ts: Math.floor(new Date().getTime() / 1000)
			}
		]
	}

	return new Promise(resolve => resolve(slackMsg));
}

function storeName(userTextArr){
	if(userTextArr['new_name'] != ''){
		let mapName = storage.getItemSync('mapName');
		console.log('mapname', userTextArr);
		mapName[userTextArr['user_name']] = userTextArr['new_name'];

		storage.setItemSync('mapName', mapName);

		return new Promise(res => res('Store name success'));
	}

	return new Promise(res => res('No new_name to storeName'));
}

function getHelpMsgPromise(userTextArr){
	let slackMsg = {
		text: `Hi @${userTextArr['user_name']}`,
		attachments: [
			{
				title: 'Lunch help',
				title_link: 'https://tinker.press',
				fields: [
					{
						title: `Menu today`,
						value: `Type /lunch menu`,
						short: true
					},
					{
						title: `Menu on [day]`,
						value: `Type /lunch menu [mon|tue|..]`,
						short: true
					},
					{
						title: `Order dish`,
						value: `Type /lunch order [dish num]\n[dish num]: dish's order in menu`,
						short: true
					},
					{
						title: `Order dish on [day]`,
						value: `Type /lunch order [mon|tue..] [dish num]`,
						short: true
					},
					{
						title: `Review order`,
						value: `Type /lunch view [mon|tue..]`,
						short: true
					},
					{
						title: `Delete order`,
						value: `Type /lunch delete|cancel`,
						short: true
					},
					{
						title: `Set name`,
						value: `Type /lunch name [name in google sheet]`,
						short: true
					},
					{
						title: `View name`,
						value: `Type /lunch name`,
						short: true
					},
					{
						title: `Build report`,
						value: `Type /lunch report`,
						short: true
					},
				],
				// color: '#3AA3E3',
				footer: 'Chúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
				footer_icon: 'https://tinker.press/favicon-64x64.png',
				ts: Math.floor(new Date().getTime() / 1000)
			}
		]
	};

	return new Promise(resolve => resolve(slackMsg));
}

function writeCacheFile(dateMenus){
	let fs = require('fs');
	let wstream = fs.createWriteStream(`${__dirname}/menus.json`);
	// wstream.write(JSON.stringify(dateMenus));
	// fs.writeFileSync(require(`${__dirname}/menus.json`), JSON.stringify(dateMenus));
	// console.log('\033[32mWrite cache file SYNC success\033[0m');
	wstream.once('open', function(fd) {
		wstream.write(JSON.stringify(dateMenus));
		wstream.end(function(){
			console.log('\033[32mWriteStream for cache file success\033[0m');
		});
	});
}

function slackMsgCmdNeedUserName(userTextArr){
	let slackMsg = {
		text: `Hi @${userTextArr['user_name']}\nYou've ask for: \`${userTextArr['text']}\``,
		attachments: [
			{
				title: 'Sorry for this inconvenience.\n Please set name first',
				title_link: 'https://tinker.press',
				fields: [
					{
						value: `Type /lunch name <name in google sheet>`,
						short: true
					}
				],
				// color: '#3AA3E3',
				footer: 'Chúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
				footer_icon: 'https://tinker.press/favicon-64x64.png',
				ts: Math.floor(new Date().getTime() / 1000)
			}
		]
	};
	
	return new Promise(r => r(slackMsg));
}

function slackMsgCmdNotFound(userTextArr){
	return {
		text: `Hi @${userTextArr['user_name']}`,
			attachments: [
		{
			title: `Command not supported`,
			title_link: `https://tinker.press`,
			fields: [
				{
					title: 'I hear you',
					value: `Please type /lunch help, to review commands`,
					short: true
				}
			],
			footer: 'Chúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
			footer_icon: 'https://tinker.press/favicon-64x64.png',
			ts: Math.floor(new Date().getTime() / 1000)
		}
	]
	};
}

function slackMsgBatchFixMenuRangeFail(){
	return {
		text: `Please resubmit\nMenu range includes heade`,
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
				footer: 'Chúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
				footer_icon: 'https://tinker.press/favicon-64x64.png',
				ts: Math.floor(new Date().getTime() / 1000)
			}
		]
	}
}

function slackMsgBatchFixMenuRangeAccepted(menu_range){
	let fs = require('fs');
	// Update menu range
	let nBUIConfig = require(`${__dirname}/lib/nuiBayUtItConfig`);
	nBUIConfig['menu_range'] = menu_range;
	fs.writeFileSync(`${__dirname}/lib/nuiBayUtItConfig.json`, JSON.stringify(nBUIConfig));
	
	return {text: 'Write nuiBayUtItConfig.json'};
}

function slackMsgReport(userTextArr){
	return {
		text: `Hi @${userTextArr['user_name']}`,
		attachments: [
			{
				title: 'Build report',
				title_link: 'https://tinker.press',
				fields: [
					{
						value: `${userTextArr['report_msg']}`,
						short: true
					}
				],
				color: '#3AA3E3',
				footer: 'Chúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
				footer_icon: 'https://tinker.press/favicon-64x64.png',
				ts: Math.floor(new Date().getTime() / 1000)
			}
		]
	};
}

function whichMenu(userTextArr, menus){
	let moment = require('moment');
	let menuDate = userTextArr['whichDate'];
	// console.log(menuDate.date());
	let menu = menus.filter(menuX => {
		// console.log(moment(menuX.date, 'D-MMM-YYYY').utcOffset(7*60).date());
		return moment(menuX.date, 'D-MMM-YYYY').utcOffset(7*60).date() == menuDate.date();
	})[0];

	userTextArr['menuDate'] = menuDate;

	return menu;
}

function slackMsgMenuNotFound(userTextArr){
	return {
		text: `Hi @${userTextArr['user_name']}`,
		attachments:[
			{
				title: `Menu error`,
				title_link: `https://tinker.press`,
				text: `Menu on ${userTextArr['menuDate'].toString().substr(0,10)} not exist`,
				color: 'danger',
				footer: 'Chúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
				footer_icon: 'https://tinker.press/favicon-64x64.png',
				ts: Math.floor(new Date().getTime() / 1000)
			}
		]
	}
}

function slackMsgMenuFound(userTextArr, menu){
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
	return {
		// text: `Hi, @${userTextArr['user_name']}, menu for ${userTextArr[1]}`,
		text: `Hi, @${userTextArr['user_name']}`,
		attachments: [
			{
				title: `Menu on ${menu.date}`,
				title_link: 'https://tinker.press/good-food-good-life.jpg',
				fields: dishesV2,
				color: '#3AA3E3',
				footer: 'Chúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
				footer_icon: 'https://tinker.press/favicon-64x64.png',
				ts: Math.floor(new Date().getTime() / 1000)
			}
		]
	};
}

function slackMsgNoDishIndex(userTextArr){
	let slackMsg = {
		text: `Hi @${userTextArr['user_name']}`,
		attachments:[
			{
				title: `Order error`,
				title_link: `https://tinker.press`,
				fields: [
					{
						title: `Please type /lunch order [mon|tue] [dish-num]`,
						value: `[dish-num]: required`,
						short: true
					}
				],
				color: 'danger',
				footer: 'Chúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
				footer_icon: 'https://tinker.press/favicon-64x64.png',
				ts: Math.floor(new Date().getTime() / 1000)
			}
		]
	}

	return slackMsg;
}

function slackMsgNoMenu(userTextArr){
	let slackMsg = {
		text: `Hi @${userTextArr['user_name']}`,
		attachments:[
			{
				title: `Menu error`,
				title_link: `https://tinker.press`,
				text: `Menu on ${day} not exist`,
				color: 'danger',
				footer: 'Chúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
				footer_icon: 'https://tinker.press/favicon-64x64.png',
				ts: Math.floor(new Date().getTime() / 1000)
			}
		]
	}

	return slackMsg;
}

function slackMsgOrder(userTextArr, menu){
	let otherUsersBookDish = 'No one';
	// Improve info by REMOVE him from his self
	let dish = menu.dishes[userTextArr['dishIndex']];
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
				footer: 'Chúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
				footer_icon: 'https://tinker.press/favicon-64x64.png',
				ts: Math.floor(new Date().getTime() / 1000)
			}
		]
	};

	return slackMsg;
}