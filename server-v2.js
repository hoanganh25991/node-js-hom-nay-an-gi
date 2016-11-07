/**
 * Build report 10 minutes interval
 * @type {number}
 */
const buildReportCycle = 10 * 60000;
let buildReport = require(`${__dirname}/buildReportToLunchMoney.js`);
setInterval(function(){
	let buildReportPromise = buildReport();
	
	buildReportPromise.then(() => {
		console.log('Build report success');
		let content = `[${new Date().toString().substr(0,10)}] Report built\n`;
		let fs = require('fs');
		fs.writeFile(`${__dirname}/log/buildReport.log`, content, {flag: 'a'});
	});
}, buildReportCycle);

/**
 * Create server
 * @type {Parsers}
 */
let bodyParser = require('body-parser');
let app = require('express')();
/**
 * Detect mode
 */
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

/**
 * Listen to command
 */
app.get('/', function(req, res){
	let userName = req.query['user_name'];
	let userText = req.query['text'].replace(/\s+/g, ' ');
	// Build basic info from user slack command
	let userTextArr = userText.split(' ');
	let mapName = require(`${__dirname}/lib/mapName`);
	let userNameInSheet = mapName[userName];
	userTextArr['text'] = userText;
	userTextArr['cmd'] = userTextArr[0];
	userTextArr['user_name'] = userName;
	userTextArr['sheet_name'] = userNameInSheet;
	console.log(userTextArr);

	/**
	 * Some command NEED USERNAME
	 * check it here
	 * @type {string[]}
	 */
	let cmdsDependOnUsername = ['order', 'view', 'delete'];
	if(!userNameInSheet && cmdsDependOnUsername.includes(userTextArr[0])){
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
			resPromise = slackMsgMenu(userTextArr);
			break;
		case 'order':
			resPromise = slackMsgOrder(userTextArr);
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
			resPromise = slackMsgView(userTextArr);
			break;
		case 'cancel':
		case 'delete':
			resPromise = slackMsgDelete(userTextArr);
			// Now update delete order int sheet
			let deleteOrderPromise = deleteOrder(userTextArr);
			deleteOrderPromise.then(()=>{console.log('Delete order success')});
			break;
		case 'name':
			resPromise = slackMsgName(userTextArr);
			let storeNamePromise = storeName(userTextArr);
			storeNamePromise.then(msg => console.log(msg));
			break;
		case 'help':
			resPromise = slackMsgHelp(userTextArr);
			break;
		case 'report':
			const isAllowedRunReportUser = ['hoanganh25991'];
			let isAllowedRunReport = isAllowedRunReportUser.includes(userTextArr['user_name']);
			userTextArr['isAllowedRunReport'] = isAllowedRunReport;
			
			userTextArr['report_msg'] = isAllowedRunReport ? 'I\'m building report' : 'Sorry, you don\'t have permission to build report';

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

app.get('/menu', function(req, res){
	let getDateMenusPromise = require(`${__dirname}/getMenu`)();
	getDateMenusPromise.then(dateMenus =>{
		let menu = dateMenus.filter(dateMenu =>{
			let date = new Date().getUTCDate();
			console.log(date);
			let menuDate = new Date(dateMenu.date).getUTCDate();
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
		// let _ = require(`${__dirname}/lib/util`);
		// let thisWeek = _.getWeekNumber(new Date());
		// let menuJsonCreatedWeek = _.getWeekNumber(mtime);
		// console.log('Menus.json mtime (week): ', menuJsonCreatedWeek);
		// console.log('Request for menus (week): ', thisWeek);
		//
		// let isOutOfDate = (thisWeek > menuJsonCreatedWeek);
		return new Promise(resolve => resolve(false));
	})
    .catch(err => {
		// console.log(err);
		console.log('Menus.json not exist');
		return new Promise(resolve => resolve(true));
	});

	let getDateMenusPromise = checkOutdatedPromise.then(isOutOfDate => {
		console.log('Menus.json isOutOfDate: ', isOutOfDate);

		if(!isOutOfDate){
			console.log('read from file');
			return new Promise(resolve => {
				resolve(JSON.parse(fs.readFileSync(`${__dirname}/menus.json`).toString()));
			});
		}else{
			return require(`${__dirname}/getMenu`)();
		}
	});

	return getDateMenusPromise;
}

function slackMsgMenu(userTextArr){
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

function slackMsgOrder(userTextArr){
	let getDateMenusPromise = loadMenu();

	let slackMsgPromise = getDateMenusPromise.then(menus => {
		// let dayOfWeek = new Date().getDay() - 1;
		if(!userTextArr[1]){
			return new Promise(resolve => {
				let slackMsg = {
					text: `Hi @${userTextArr['user_name']}`,
					attachments:[
						{
							title: `Order error`,
							title_link: `https://tinker.press`,
							fields: [
								{
									title: `Order command need [dish-num]`,
									value: `Please type /lunch order [dish-num]`,
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

				resolve(slackMsg);
			});
		}
		let menu = whichMenuForOrder(userTextArr, menus);
		console.log('\033[32mSlackMsgOrder loadMenu, choose menu success\033[0m');
		console.log(menu);
		if(!menu){
			return new Promise(resolve => {
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

				resolve(slackMsg);
			});
		}

		// LOGIC ON CASE order mon 19
		let dishIndex = whichDish(userTextArr);

		let dish = menu.dishes[dishIndex];
		console.log(dish);
		userTextArr['dish'] = dish;
		if(!dish){
			return new Promise(resolve => {
				let slackMsg = {
					text: `Hi ${userTextArr['user_name']}`,
					attachments: [
						{
							title: `Order error`,
							title_link: `https://tinker.press`,
							fields: [
								{
									value: `You've order dish [${userTextArr['dishIndex']}], which not exist`,
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

function updateOrder(userTextArr){
	let getDateMenusPromise = require(`${__dirname}/getMenu`)(false);

	let updatePromise = getDateMenusPromise.then(dateMenus => {
		if(!userTextArr['dish']){
			return new Promise(resolve => resolve('User choose dishIndex, which not exist'));
		}

		// if(userTextArr['dish']){
		let menu = whichMenu(userTextArr, dateMenus);
		let selectedDishIndex = parseInt(userTextArr['dishIndex'], 10);
		let dish = menu.dishes[selectedDishIndex];
		// }

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
			// updatePromise
			// 	.then(msg => console.log(msg))
			// 	.catch(err => console.log(err));

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

				// console.log(`${__dirname}/updateOrderToSheet`);
				let updatePromise = require(`${__dirname}/updateOrderToSheet`)(cell);
				// updatePromise.then(msg => console.log(msg));

				// Update cache with what we have
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
	let nBUUConfig = require(`${__dirname}/lib/nuiBayUtItConfig`);
	// console.log(col, row, sheetNuiBayUtIt);
	// ONLY read out the first one A558:AD581
	// Build up row, col logic
	let startRow = nBUUConfig['menu_range'].match(/\d+/)[0];
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
		let  menu = whichMenu(userTextArr, menus);

		if(!menu){
			return new Promise(r => r({text: 'No menu found'}));
		}

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

function slackMsgDelete(userTextArr){
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
	let getDateMenusPromise = require(`${__dirname}/getMenu`)(false);
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

			let updatePromise = require(`${__dirname}/updateOrderToSheet`)(cell);
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

function slackMsgName(userTextArr){
	let userSheetNameInCache = userTextArr['sheet_name'];
	// Parse out which name he want to ask
	let userText = userTextArr['text'];
	userText = userText.replace(/\s+/g, ' ');
	let userTextArrTmp = userText.split(' ');
	userTextArrTmp.splice(0, 1);
	// let userSheetName = userText.replace('name ', '');
	let userSheetName = userTextArrTmp.join(' ');
	userTextArr['sheet_name'] = userSheetName;
	// userSheetName.includes(',')
	/**
	 * CASE YOUR JUST WANT TO REVIEW
	 */
	if(userSheetName == '' && userSheetNameInCache){
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
							value: `${userSheetNameInCache}`,
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


	if(userSheetName == '' && !userSheetNameInCache){
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
						},
						{
							value: `${userTextArr['sheet_name']}`,
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
						value: `${userTextArr['sheet_name']}`,
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
	let userSheetNameInCache = userTextArr['sheet_name'];
	// Parse out which name he want to ask
	let userText = userTextArr['text'];
	userText = userText.replace(/\s+/g, ' ');
	let userTextArrTmp = userText.split(' ');
	userTextArrTmp.splice(0, 1);
	// let userSheetName = userText.replace('name ', '');
	let userSheetName = userTextArrTmp.join(' ');
	userTextArr['sheet_name'] = userSheetName;

	if(userSheetName == '' && userSheetNameInCache){
		return new Promise(resolve => resolve('User want to review name, no need to update'));
	}

	if(userSheetName == '' && !userSheetNameInCache){
		return new Promise(resolve => resolve('User want to set name, but not submit name @@, no need to update'));
	}

	let mapName = require(`${__dirname}/lib/mapName`);
	mapName[userTextArr['user_name']] = userTextArr['sheet_name'];

	return new Promise(resolve => {
		let fs = require('fs');

		fs.writeFile(`${__dirname}/lib/mapSlacknameUsername.json`, JSON.stringify(mapName), function(err){
			if(err){
				resolve(err);
			}

			resolve('Write mapSlacknameUsername.json success');
		});
	});
}

function slackMsgHelp(userTextArr){
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
		text: `Hi @${userTextArr['user_name']}\nYou've ask for: \`${userText}\``,
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
	let today = new Date();
	// let nextDay = new Date(today.setDate(today.getUTCDate() + 1));

	let userText = userTextArr['text'];
	let userTextArrTmp = userText.split(' ');
	let menuOnWhichDay = userTextArrTmp[1]; // undefined mon|tue|wed|thu

	// Builde up menuDate
	let menuDate;
	// As normal
	menuDate = new Date(today.setUTCDate(today.getUTCDate() + 1));
	// FAIL when today is friday
	let isFridaynMore = today.getUTCDay() >= 5;
	if(isFridaynMore){
		// MenuDate should set to the Monday of nextweek
		let _ = require(`${__dirname}/lib/util`);
		menuDate = _.mondayOfNextWeek();
	}

	if(menuOnWhichDay){
		menuOnWhichDay = menuOnWhichDay.toLowerCase();
		let _ = require(`${__dirname}/lib/util`);
		menuDate = _.dayOfCurrentWeek(menuOnWhichDay);
	}

	let menu = menus.filter(menuX => {
		return menuDate.getUTCDate() == new Date(menuX.date).getUTCDate();
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

function whichDish(userTextArr){
	let dishIndex = parseInt(userTextArr[1], 10);
	userTextArr['dishIndex'] = userTextArr[1];

	if(isNaN(dishIndex)){
		dishIndex = parseInt(userTextArr[2], 10);
		userTextArr['dishIndex'] = userTextArr[2];
	}

	if(isNaN(dishIndex)){
		return undefined;
	}

	return dishIndex;
}

function whichMenuForOrder(userTextArr, menus){
	let today = new Date();
	// let nextDay = new Date(today.setDate(today.getUTCDate() + 1));

	let userText = userTextArr['text'];
	let userTextArrTmp = userText.split(' ');
	let menuOnWhichDay = userTextArrTmp[1]; // 1|2|3 mon|tue|wed|thu

	// Builde up menuDate
	let menuDate;
	// As normal
	menuDate = new Date(today.setUTCDate(today.getUTCDate() + 1));
	// FAIL when today is friday
	let isFridaynMore = today.getUTCDay() >= 5;
	if(isFridaynMore){
		// MenuDate should set to the Monday of nextweek
		let _ = require(`${__dirname}/lib/util`);
		menuDate = _.mondayOfNextWeek();
	}

	// Check menuOnWhichDay is truthly not dish-num
	if(isNaN(parseInt(menuOnWhichDay, 10))){
		menuOnWhichDay = menuOnWhichDay.toLowerCase();
		let _ = require(`${__dirname}/lib/util`);
		menuDate = _.dayOfCurrentWeek(menuOnWhichDay);
	}

	let menu = menus.filter(menuX => {
		return menuDate.getUTCDate() == new Date(menuX.date).getUTCDate();
	})[0];

	userTextArr['menuDate'] = menuDate;

	return menu;
}