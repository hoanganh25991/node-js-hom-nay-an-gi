// const buildReportCycle = 10*60000;
const buildReportCycle = 10*60000;
let buildReport = require(`${__dirname}/updateToLunchMoney.js`);
// function cb(){
// 	buildReport();
// 	let today = new Date();
// 	let content = `${today.toString().substr(0,10)} - report built\n`;
// 	let fs = require('fs');
// 	fs.writeFile('buildReport.log', content, {flag: 'a'}, function(err){
// 		if(err){
// 			console.log(err);
// 		}else{
// 			console.log(`Build report success`);
// 		}
// 	});
// }

// cb();
setInterval(function(){
	buildReport();
	let today = new Date();
	let content = `${today.toString().substr(0,10)} - reported built\n`;
	let fs = require('fs');
	fs.writeFile('buildReport.log', content, {flag: 'a'}, function(err){
		if(err){
			console.log(err);
		}else{
			console.log(`build report success`);
		}
	});
}, buildReportCycle);

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
	// const acceptedUserCommand = ['menu', 'order', 'batchFix', 'view', 'delete'];
	// let userText = req.param('text').replace(/\s+/g, ' ');
	let userText = req.query['text'].replace(/\s+/g, ' ');
	// let responseUrl = req.param('response_url');
	// read user text
	let userTextArr = userText.split(' ');
	userTextArr['text'] = userText;
	// if(!acceptedUserCommand.includes(userTextArr[0])){
	// 	userTextArr = ['menu', 'today'];
	// }
	// store user name
	userTextArr['user_name'] = userName;
	let mapName = require(`${__dirname}/lib/mapName`);
	let userNameInSheet = mapName[userTextArr['user_name']];
	// Unaccepted command to move on without userNameInSheet
	let cmdNotAllowWithoutUserNameInSheet = ['order', 'view', 'delete'];
	if(!userNameInSheet && cmdNotAllowWithoutUserNameInSheet.includes(userTextArr[0])){
		// userNameInSheet = userTextArr['user_name'];
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

		res.send(slackMsg);
		return;
	}

	// ReAdd back to userTextArr
	userTextArr['sheet_name'] = userNameInSheet;
	// userTextArr['response_url'] = responseUrl;
	console.log(userTextArr);
	// Build up default response
	let response = {
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
	let resPromise;
	// Switch case on user command
	switch(userTextArr[0]){
		case 'menu':
			// if(!(userTextArr[1])){
			// 	userTextArr[1] = 'today';
			// }
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
			updatePromise.then(()=>{console.log('Update order success')});

			// let writeMenuCachePromise = require(`${__dirname}/getMenu`)();
			// writeMenuCachePromise.then(()=>{console.log('update menus.json for view')});

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

					fs.writeFile(`${__dirname}/lib/nuiBayUtItConfig.json`, JSON.stringify(nBUIConfig), function(err){
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

					resolve(slackMsg);
				});
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
			deleteOrderPromise
				.then(msg => console.log(msg))
				.catch(err => console.log(err));

			// let writeMenuCachePromiseX = require(`${__dirname}/getMenu`)();
			// writeMenuCachePromiseX.then(()=>{console.log('update menus.json for view')});


			break;
		case 'name':
			resPromise = slackMsgName(userTextArr);
			let storeNamePromise = storeName(userTextArr);
			storeNamePromise
				.then(msg => console.log(msg));

			break;
		case 'help':
			resPromise = slackMsgHelp(userTextArr);

			break;
		case 'report':
			let fieldVal = 'Sorry, you don\'t have permission to build report';
			const allowedRunReportUser = ['hoanganh25991'];

			let isAllowedRunReport = allowedRunReportUser.includes(userTextArr['user_name']);

			if(isAllowedRunReport){
				fieldVal = 'I\'m building report';
			}

			resPromise = new Promise(resolve => {
				let slackMsg = {
					text: `Hi @${userTextArr['user_name']}`,
						attachments: [
							{
								title: 'Build report',
								title_link: 'https://tinker.press',
								fields: [
									{
										value: `${fieldVal}`,
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

				resolve(slackMsg);
			});

			if(isAllowedRunReport){
				buildReport();
			}
			break;
		case 'email':
			let buildEmailLink = require(`${__dirname}/sheetToEmail`);
			let link = buildEmailLink(userTextArr);
			let slackMsg = {
				text: `Hi @${userTextArr['user_name']}`,
				attachments:[
					{
						title: `Confirm send mail`,
						// title_link: `https://tinker.press`,
						fields: [
							{
								value: `Please <${link}|click> to confirm`,
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
			resPromise = new Promise(resolve => resolve(response));

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
			return require(`${__dirname}/getMenu`)();
		}
	});

	return getDateMenusPromise;
}

function slackMsgMenu(userTextArr){
	let getDateMenusPromise = loadMenu();

	let userText = userTextArr['text'].replace(/\s+/g, ' ');
	// let responseUrl = req.param('response_url');
	// read user text
	let userTextArrTmp = userText.split(' ');

	let slackMsgPromise = getDateMenusPromise.then(menus => {
		// let selectedDishIndex = userTextArr[1];
		let isUserInputDay = false;
		let userInputDay = '';
		if(userTextArrTmp[1]){
			userInputDay = userTextArrTmp[1].toLocaleLowerCase();
			isUserInputDay = dayOfWeekConvert.indexOf(userInputDay) != -1;
			// console.log('isUserInputDay', isUserInputDay);
		}

		let day = new Date().getUTCDate();
		if(isUserInputDay){
			let dayOfWeek = dayOfWeekConvert.indexOf(userInputDay);
			// let dayOfWeek = 5;
			let dd = new Date();
			let dayx = dd.getDay();
			let	diff = dd.getUTCDate() - dayx + (dayx == 0 ? -6 : 1) + dayOfWeek;

			day = new Date(dd.setDate(diff)).getUTCDate();
		}

		// let menu = menus[dayOfWeek];
		// Better check menu by reading out
		let menu = menus.filter(menu =>{
			let menuDate = new Date(menu.date);
			console.log(day, menuDate.getUTCDate());
			return (day == menuDate.getUTCDate());
		})[0];
		// console.log(userTextArr);

		// let dayOfWeek = new Date().getDay() - 1;
		// let menu = dateMenus[dayOfWeek];
		// let dayOfWeek = new Date().getDay() - 1;
		// let day = new Date().getUTCDate();
		// // let menu = menus[dayOfWeek];
		// // Better check menu by reading out
		// let menu = dateMenus.filter(menu =>{
		// 	let menuDate = new Date(menu.date);
		// 	return (day == menuDate.getUTCDate());
		// })[0];
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

	let userText = userTextArr['text'].replace(/\s+/g, ' ');
	// let responseUrl = req.param('response_url');
	// read user text
	let userTextArrTmp = userText.split(' ');
	
	let slackMsgPromise = getDateMenusPromise.then(menus => {
		// let dayOfWeek = new Date().getDay() - 1;
		if(!userTextArrTmp[1]){
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


		let userInputDay = userTextArrTmp[1].toLocaleLowerCase();
		let isUserInputDay = dayOfWeekConvert.indexOf(userInputDay) != -1;

		let day = new Date().getUTCDate();
		if(isUserInputDay){
			let dayOfWeek = dayOfWeekConvert.indexOf(userInputDay);
			// let dayOfWeek = 5;
			let dd = new Date();
			let dayx = dd.getDay();
			let	diff = dd.getUTCDate() - dayx + (dayx == 0 ? -6 : 1) + dayOfWeek;

			day = new Date(dd.setDate(diff)).getUTCDate();
		}

		// let menu = menus[dayOfWeek];
		// Better check menu by reading out
		let menu = menus.filter(menu =>{
			let menuDate = new Date(menu.date);
			return (day == menuDate.getUTCDate());
		})[0];
		// console.log(userTextArr);

		// let dayOfWeek = new Date().getDay() - 1;
		// let menu = dateMenus[dayOfWeek];
		// let dayOfWeek = new Date().getDay() - 1;
		// let day = new Date().getUTCDate();
		// // let menu = menus[dayOfWeek];
		// // Better check menu by reading out
		// let menu = dateMenus.filter(menu =>{
		// 	let menuDate = new Date(menu.date);
		// 	return (day == menuDate.getUTCDate());
		// })[0];
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
		let dishIndex = parseInt(userTextArr[1], 10);
		// store userDishOrder to inform what happen
		let userDishOrder = userTextArr[1];
		if(isUserInputDay){
			dishIndex = parseInt(userTextArr[2], 10);
			userDishOrder = userTextArr[2];
		}

		let dishIndexParseFail = false;
		if(isNaN(dishIndex)){
			dishIndex = 0;
			dishIndexParseFail = true;
			// userDishOrder = userTextArr[2];
		}
		// Update back into userTextArr
		userTextArr[1] = dishIndex;

		let dish = menu.dishes[dishIndex];
		if(!dish || dishIndexParseFail){
			return new Promise(resolve => {
				let slackMsg = {
					text: `Hi ${userTextArr['user_name']}`,
					attachments: [
						{
							title: `Order error`,
							title_link: `https://tinker.press`,
							fields: [
								{
									value: `You've order dish [${userDishOrder}], which not exist`,
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
	console.log('\033[32mStart updateOrder by getMenu\033[0m');
	let getDateMenusPromise = require(`${__dirname}/getMenu`)(false);

	let userText = userTextArr['text'].replace(/\s+/g, ' ');
	// let responseUrl = req.param('response_url');
	// read user text
	let userTextArrTmp = userText.split(' ');
	// store user name
	// userTextArr['user_name'] = userName;
	let updatePromise = getDateMenusPromise.then(dateMenus => {
		console.log('\033[32mgetMenu success!!!\033[0m');
		// let selectedDishIndex = userTextArr[1];
		let userInputDay = userTextArrTmp[1].toLocaleLowerCase();
		let isUserInputDay = dayOfWeekConvert.indexOf(userInputDay) != -1;

		let day = new Date().getUTCDate();
		if(isUserInputDay){
			let dayOfWeek = dayOfWeekConvert.indexOf(userInputDay);
			// let dayOfWeek = 5;
			let dd = new Date();
			let dayx = dd.getDay();
			let	diff = dd.getUTCDate() - dayx + (dayx == 0 ? -6 : 1) + dayOfWeek;

			day = new Date(dd.setDate(diff)).getUTCDate();
		}

		// let menu = menus[dayOfWeek];
		// Better check menu by reading out
		let menu = dateMenus.filter(menu =>{
			let menuDate = new Date(menu.date);
			return (day == menuDate.getUTCDate());
		})[0];
		// console.log(userTextArr);

		// let dayOfWeek = new Date().getDay() - 1;
		// let menu = dateMenus[dayOfWeek];
		// let dayOfWeek = new Date().getDay() - 1;
		// let day = new Date().getUTCDate();
		// // let menu = menus[dayOfWeek];
		// // Better check menu by reading out
		// let menu = dateMenus.filter(menu =>{
		// 	let menuDate = new Date(menu.date);
		// 	return (day == menuDate.getUTCDate());
		// })[0];
		if(!menu){
			return new Promise(resolve => resolve('No menu'));
		}

		// LOGIC ON CASE order mon 19
		let dishIndex = parseInt(userTextArrTmp[1], 10);
		if(isUserInputDay){
			dishIndex = parseInt(userTextArrTmp[2], 10);
		}

		if(isNaN(dishIndex)){
			dishIndex = 0;
		}
		// Update back into userTextArr
		let selectedDishIndex = dishIndex;

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
	// console.log(col, row, nBUUConfig);
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
	// let getDateMenusPromise = require(`${__dirname}/getMenu`)();
	let userText = userTextArr['text'].replace(/\s+/g, ' ');
	// let responseUrl = req.param('response_url');
	// read user text
	let userTextArrTmp = userText.split(' ');

	let slackMsgPromise = getDateMenusPromise.then(menus => {
		let isUserInputDay = false;
		let userInputDay = '';
		if(userTextArrTmp[1]){
			userInputDay = userTextArrTmp[1].toLocaleLowerCase();
			isUserInputDay = dayOfWeekConvert.indexOf(userInputDay) != -1;
		}

		let day = new Date().getUTCDate();
		if(isUserInputDay){
			let dayOfWeek = dayOfWeekConvert.indexOf(userInputDay);
			// let dayOfWeek = 5;
			let dd = new Date();
			let dayx = dd.getDay();
			let	diff = dd.getUTCDate() - dayx + (dayx == 0 ? -6 : 1) + dayOfWeek;

			day = new Date(dd.setDate(diff)).getUTCDate();
		}

		// let menu = menus[dayOfWeek];
		// Better check menu by reading out
		let menu = menus.filter(menu =>{
			let menuDate = new Date(menu.date);
			return (day == menuDate.getUTCDate());
		})[0];
		// console.log(menu.date);
		// console.log(userTextArr['sheet_name']);
		// console.log(userTextArr['sheet_name']);
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
		// console.log(userTextArr);

		// let dayOfWeek = new Date().getDay() - 1;
		// let menu = dateMenus[dayOfWeek];
		// let dayOfWeek = new Date().getDay() - 1;
		let day = new Date().getUTCDate();
		// let menu = menus[dayOfWeek];
		// Better check menu by reading out
		let menu = dateMenus.filter(menu =>{
			let menuDate = new Date(menu.date);
			return (day == menuDate.getUTCDate());
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