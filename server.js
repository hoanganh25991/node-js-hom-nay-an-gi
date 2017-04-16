// Self loop check menu
require('./lib/checkMenuUpdate')();

// Create server
let app = require('express')();
app.use(require('body-parser').json());
app.listen(3000, function(){console.log('Server listening on port 3000!');});

// Listen to command
let _             = require('./lib/util');
let request       = require('request');
let parseUserText = require('./lib/parseUserText');

app.get('/', function(req, res){
	//console.log(req.query);
	let userTextInfo = parseUserText(req);
	// Should move on or break workflow
	// To ask user more info
	let move_on = true;

	switch(userTextInfo['cmd']){
		// General command
		// No need specify who is calling this cmd
		case 'menu':
		case 'name':
		case 'help': {
			break;
		}
		// Need to know who he is
		// His name in Google Sheet
		case 'order':
		case 'view':
		case 'delete':
		case 'cancel': {
			if(!userTextInfo['sheet_name']){
				let state      = _.getState();
				let resPromise = slackMsgCmdNeedUserName(userTextInfo);
				// Ask user name in Google Sheet
				resPromise.then(slackMsg => res.send(slackMsg));
				// Store user last cmd
				// For better experience
				// After ask user name
				// Can auto execute back this cmd
				let user_note         = state[userTextInfo['user_name']] || {[userTextInfo['user_name']]: {}};
				user_note['last_cmd'] = userTextInfo['text'];
				// Save state
				Object.assign(state, user_note);
				_.saveState(state);

				move_on = false;
			}
			break;
		}
		default: {
			break;
		}

	}

	if(!move_on)
		return;

	//Base on user cmd, build res
	let resPromise = handleCmd(userTextInfo);

	resPromise.then(slackMsg => {
		// Send slack msg
		res.send(slackMsg);
		// Check last cmd
		// If need execute, do it
		let state       = _.getState();
		let user_note   = state[userTextInfo['user_name']];
		let should_exec = user_note.last_cmd;

		if(should_exec){
			req.query['text']    = user_note.last_cmd;
			let lastUserTextInfo = parseUserText(req);
			let response_url     = lastUserTextInfo['response_url'];

			if(response_url){
				// Get response promise with slack msg
				let resPromise = handleCmd(lastUserTextInfo);

				resPromise.then(slackMsg => {
					var options = {
						method : 'POST',
						url    : response_url,
						body   : JSON.stringify(slackMsg)
					};
					// Push back msg to user base on reponse_url of slack
					request(options, function (err, response, body) {
						if (err) throw err;
						console.log(body);
					});
				});

				// Reset it
				user_note.last_cmd = null;
				Object.assign(state, user_note);
				// Save state
				_.saveState(state);
			}
		}
	});
});

function handleCmd(userTextInfo){
	let resPromise;

	switch(userTextInfo['cmd']){
		case 'menu': {
			resPromise = getMenuMsgPromise(userTextInfo);
			break;
		}
		case 'order': {

			// Quick reponse with cache data
			resPromise = getOrderMsgPromise(userTextInfo);
			// Open Google SHeet, update data
			let updatePromise = updateOrder(userTextInfo);
			// When success, notify user
			let response_url = userTextInfo['response_url'];
			if(response_url){
				updatePromise.then(()=>{
					let slackMsg = {
						attachments: [
							{
								title: `Saved to Goolge Sheet`,
								title_link: `https://tinker.press`,
								fields: [],
								color: '#3AA3E3',
								ts: Math.floor(new Date().getTime() / 1000)
							}
						]
					};

					var options = {
						method : 'POST',
						url    : response_url,
						body   : JSON.stringify(slackMsg)
					};
					// Push back msg to user base on reponse_url of slack
					request(options, function (err, response, body) {
						if (err) throw err;
						console.log(body);
					});
				});
			}
			break;
		}
		case 'view': {
			// Looking to Google Sheet
			let slackMsg = {
				attachments: [
					{
						title: 'Looking to Google Sheet...',
						title_link: `https://tinker.press`,
						fields: [],
						color: '#3AA3E3',
						ts: Math.floor(new Date().getTime() / 1000)
					}
				]
			};

			resPromise = Promise.resolve(slackMsg);
			// Open Google Sheet, to check which dish booked
			let response_url = userTextInfo['response_url'];

			if(response_url){
				// Build msg
				let latestViewMsgPromise = getLastestViewMsgPromise(userTextInfo);

				latestViewMsgPromise.then(slackMsg => {
					var options = {
						method : 'POST',
						url    : response_url,
						body   : JSON.stringify(slackMsg)
					};
					// Push back msg to user
					request(options, function (err, response, body) {
						if (err) throw err;
						console.log(body);
					});
				});
			}
			break;
		}
		case 'cancel':
		case 'delete': {
			// Quick reply to user that
			// We are calling Google Sheet API
			let slackMsg = {
				attachments: [
					{
						title: 'Canceling order...',
						title_link: 'https://tinker.press',
						color: '#3AA3E3',
						ts: Math.floor(new Date().getTime() / 1000)
					}
				]
			};
			resPromise = Promise.resolve(slackMsg);
			// Open Google Sheet, update data
			let deleteOrderPromise = cancelOrder(userTextInfo);
			let response_url       = userTextInfo['response_url'];
			if(response_url){
				deleteOrderPromise.then(() => {
					let slackMsg =  {
						text: `Hi @${userTextInfo['user_name']}`,
						attachments: [
							{
								title: `Cancel order success`,
								title_link: `https://tinker.press`,
								fields: [],
								color: '#3AA3E3',
								footer: 'Chúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
								footer_icon: 'https://tinker.press/favicon-64x64.png',
								ts: Math.floor(new Date().getTime() / 1000)
							}
						]
					};

					var options = {
						method : 'POST',
						url    : response_url,
						body   : JSON.stringify(slackMsg)
					};
					// Push back msg to user
					request(options, function (err, response, body) {
						if (err) throw err;
						console.log(body);
					});
				});
			}
			break;
		}
		case 'name': {
			resPromise = getNameMsgPromise(userTextInfo);
			break;
		}
		case 'help': {
			resPromise = getHelpMsgPromise(userTextInfo);
			break;
		}
		default: {
			let slackMsg = {
				text: `Hi @${userTextInfo['user_name']}`,
				attachments: [
					{
						title: `Command not supported`,
						title_link: `https://tinker.press`,
						fields: [
							{
								title: 'I hear you, but command not support',
								value: `Please type /lunch help`,
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

			resPromise = Promise.resolve(slackMsg);
			break;
		}
	}
	
	return resPromise;
}

function loadMenu(userTextInfo){
	let fs = require('fs');
	let file_path = _.getPath('menus.json');
	let has_file  = fs.existsSync(file_path);
	// Only read if has file
	if(has_file){
		let menus_json = fs.readFileSync( _.getPath('menus.json'));
		try{
			let menus = JSON.parse(menus_json);
			// Return promise with menus data
			return Promise.resolve(menus);
		}catch(e){}
	}

	// When no menu found in cache
	// Rebuild as first time
	let getMenu = require('./lib/getMenu')(true);

	// When getMenu in this way
	// Realy take time for rebuild menu
	let response_url     = userTextInfo['response_url'];
	// Notify user about this case
	// Ask him for waiting
	if(response_url){
		// Get response promise with slack msg
		let slackMsg = {
			attachments: [
				{
					title: `Rebuilding menu...`,
					title_link: `https://tinker.press`,
					fields: [
						{
							value: 'Please wait for few seconds',
							short: true
						}
					],
					color: '#3AA3E3',
					ts: Math.floor(new Date().getTime() / 1000)
				}
			]
		};

		var options = {
			method : 'POST',
			url    : response_url,
			body   : JSON.stringify(slackMsg)
		};
		// Push back msg to user base on reponse_url of slack
		request(options, function (err, response, body) {
			if (err) throw err;
			console.log(body);
		});
	}

	return getMenu;
}


function getMenuMsgPromise(userTextInfo){
	let getDateMenusPromise = loadMenu(userTextInfo);

	let slackMsgPromise =
		getDateMenusPromise
			.then(menus => {
				let menu = whichMenu(userTextInfo, menus);

				if(!menu){
					return Promise.resolve(slackMsgMenuNotFound(userTextInfo));
				}

				return Promise.resolve(slackMsgMenuFound(userTextInfo, menu));
			})

	return slackMsgPromise;
}

function getOrderMsgPromise(userTextInfo){
	let getDateMenusPromise = loadMenu();

	let slackMsgPromise =
		getDateMenusPromise
			.then(menus => {
				// User doesn't specify which [dish index] used
				if(userTextInfo['dishIndex'] == undefined){
					return Promise.resolve(slackMsgNoDishIndex(userTextInfo));
				}

				let menu = whichMenu(userTextInfo, menus);

				// Can't find out menu, base on user pick day
				if(!menu){
					return Promise.resolve(slackMsgMenuNotFound(userTextInfo));
				}

				let dish = menu.dishes[userTextInfo['dishIndex']];

				// Once again, event submit [dish index]
				// But it not found in menu
				if(!dish){
					return Promise.resolve(slackMsgNoDishIndex(userTextInfo));
				}

				// Best case
				return Promise.resolve(slackMsgOrder(userTextInfo, menu));
			});

	return slackMsgPromise;
}

function updateOrder(userTextInfo){
	let getDateMenusPromise = require('./lib/getMenu')(false);

	//noinspection JSUnresolvedFunction
	let updatePromise =
		getDateMenusPromise
			.then(dateMenus => {

				let menu = whichMenu(userTextInfo, dateMenus);

				if(!menu || !menu.dishes[userTextInfo['dishIndex']]){
					return Promise.resolve('No menu or no dish found to update');
				}

				//IN CASE USER UPDATE HIS ORDER, detect from previous, then update
				let previousOrderDishIndexs = [];
				// Only check ONE TIME
				// If he append in mutilple row?
				menu.dishes.forEach((dish, index) => {
					let removingUserIndexs = [];
					dish.users.forEach((userName, userIndex) => {
						if(userName == userTextInfo['sheet_name']){
							// store which dish need UPDATE
							if(!previousOrderDishIndexs.includes(index) && userTextInfo['dishIndex'] != index)
								previousOrderDishIndexs.push(index);
							// store which user need REMOVED
							removingUserIndexs.push(userIndex);
						}
					});

					dish.users = dish.users.filter((val, index) => {
						return !removingUserIndexs.includes(index);
					});
				});

				let preOrderDishPromises = [];
				// Open Google Sheet, update where his name has put on
				// One user only allow pick up 1 dish a day
				previousOrderDishIndexs.forEach(dishIndex => {
					// Build cellAddress, cellVal
					// Run update in to sheet
					// NEED PROMISE ALL
					let previousOrderDish = menu.dishes[dishIndex];
					let cell              = buildCell(menu, previousOrderDish);
					let updatePromise     = require('./lib/updateOrderToSheet')(cell);
					// Store all these promise
					preOrderDishPromises.push(updatePromise);
				});

				// ONLY UPDATE NEW ONE after remove user from others
				return Promise.all(preOrderDishPromises)
						.then(() => {
							let dish = menu.dishes[userTextInfo['dishIndex']];

							if(dish.users.includes(userTextInfo['sheet_name'])){
								// He just re-submit, no thing NEW
								return Promise.resolve('Your order saved. No need to resubmit');
							}else{
								dish.users.push(userTextInfo['sheet_name']);
								let cell          = buildCell(menu, dish);
								let updatePromise = require(`${__dirname}/lib/updateOrderToSheet`)(cell);
								// Update cache file
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
	let state = _.getState();
	// console.log(col, row, sheetNuiBayUtIt);
	// ONLY read out the first one A558:AD581
	// Build up row, col logic
	let startRow = state['range'].match(/\d+/)[0];
	startRow = parseInt(startRow, 10);
	// Base on start row, decide row, col
	row += startRow;
	col += 2; //col for menu, +2 for userList
	// Parse to A1 notation
	let cellAddress = `${_.convertA1Notation(col).toUpperCase()}${row}`;
	// Build up cellVal, update dish.users
	let cellVal = dish.users.join(',');
	//console.log('build Cell', cellAddress, cellVal);
	return {cellAddress, cellVal};
}

function getLastestViewMsgPromise(userTextInfo){
	// Review order need open Google Sheet to get the lastest info
	// So... update the cache too
	let getDateMenusPromise = require('./lib/getMenu')(true);

	//noinspection JSUnresolvedFunction
	let slackMsgPromise =
		getDateMenusPromise
			.then(menus => {
				let  menu = whichMenu(userTextInfo, menus);

				if(!menu){
					return Promise.resolve(slackMsgMenuNotFound(userTextInfo));
				}

				let orderedDish = 'You haven\'t order dish';
				// Loop to find out where your booked dish
				menu.dishes.forEach(dish => {
					dish.users.forEach(userName => {
						// See him, should better loop with while
						if(userName == userTextInfo['sheet_name'])
							orderedDish = `${dish['name']} - ${dish['price']}k`;
					});
				});

				let day = userTextInfo['menuDate'].format('dddd, MMM-DD');

				let slackMsg = {
					text: `Hi @${userTextInfo['user_name']}`,
					attachments: [
						{
							title: `Review order on ${day}`,
							title_link: `https://tinker.press`,
							fields: [
								{
									value: `${orderedDish}`,
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

				return Promise.resolve(slackMsg);
			});

	return slackMsgPromise;
}

function cancelOrder(userTextInfo){
	// Load menu from Google Sheet API, but not save it
	// Only after data updated, save cache
	let getDateMenusPromise = require('./lib/getMenu')(false);

	//noinspection JSUnresolvedFunction
	let updatePromise =
		getDateMenusPromise
			.then(dateMenus => {
				let menu = whichMenu(userTextInfo, dateMenus);

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
						if(userName == userTextInfo['sheet_name']){
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

				let previousOrderDishPromises = [];
				// Loop throush each one
				// Open Google Sheet, update at exactly cell
				preOrderDishIndexs.forEach(preOrderDishIndex => {
					// Build cellAddress, cellVal
					// Run update in to sheet
					// NEED PROMISE ALL
					let preOrderDish = menu.dishes[preOrderDishIndex];
					let cell = buildCell(menu, preOrderDish);

					let updatePromise = require('./lib/updateOrderToSheet')(cell);
					//noinspection JSUnresolvedFunction
					updatePromise
						.then(msg => console.log(msg))
						.catch(err => console.log(err));

					previousOrderDishPromises.push(updatePromise);
				});

				// ONLY UPDATE NEW ONE after remove user from others
				return Promise.all(previousOrderDishPromises)
						.then(() => {
							// update cache file
							writeCacheFile(dateMenus);

							return Promise.resolve('Remove success');
						});
			});

	return updatePromise;
}

function getNameMsgPromise(userTextInfo){
	// Actually save user name
	storeName(userTextInfo);
	let no_new_name    = userTextInfo['new_name'] == '';
	let has_sheet_name = userTextInfo['sheet_name'];
	// Default msg
	let slackMsg = {
		text: `Hi @${userTextInfo['user_name']}`,
		attachments: [
			{
				title: 'Set name success',
				title_link: 'https://tinker.press',
				fields: [
					{
						value: `Thank you, your name in google sheet`,
						short: true
					},
					{
						value: `${userTextInfo['new_name']}`,
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

	// User just want to review his name
	if(no_new_name && has_sheet_name){
		slackMsg = {
			text: `Hi @${userTextInfo['user_name']}`,
			attachments: [
				{
					title: 'Review name in Google Sheet',
					title_link: 'https://tinker.press',
					fields: [
						{
							value: `You've set to`,
							short: true
						},
						{
							value: `${userTextInfo['sheet_name']}`,
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

	// User submit sheet_name wrong
	if(no_new_name && !has_sheet_name){
		slackMsg = {
			text: `Hi @${userTextInfo['user_name']}`,
			attachments: [
				{
					title: 'Please give us your name in Google Sheet',
					title_link: 'https://tinker.press',
					fields: [
						{
							title: `command to run`,
							value: `/lunch name <your name>`,
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

	return Promise.resolve(slackMsg);
}

function storeName(userTextInfo){
	if(userTextInfo['new_name'] != ''){
		let state = _.getState()
		let users = state.users;
		// Update user name in Google Sheet
		Object.assign(users, {
			[userTextInfo['user_name']]: userTextInfo['new_name']
		})
		// Save it
		_.saveState(state);

		return Promise.resolve('Store name success');
	}

	return Promise.resolve('No new_name to storeName');
}

function getHelpMsgPromise(userTextInfo){
	let cmd = userTextInfo['command'];
	let slackMsg = {
		text: `Hi @${userTextInfo['user_name']}`,
		attachments: [
			{
				title: 'List command',
				title_link: 'https://tinker.press',
				fields: [
					{
						title: `Xem menu`,
						value: `${cmd} menu`,
						short: true
					},
					{
						title: `Xem lại`,
						value: `${cmd} view`,
						short: true
					},
					{
						title: `Đặt món`,
						value: `${cmd} order [dish num]`,
						short: true,
					},
					{
						title: `Hủy đặt`,
						value: `${cmd} cancel`,
						short: true
					},
				],
				color: '#3AA3E3',
				footer: 'Chúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
				footer_icon: 'https://tinker.press/favicon-64x64.png',
				ts: Math.floor(new Date().getTime() / 1000)
			}
		]
	};

	return Promise.resolve(slackMsg);
}

function writeCacheFile(dateMenus){
	let fs         = require('fs');
	let file_path  = _.getPath('menus.json');
	let wstream    = fs.createWriteStream(file_path);
	let menus_json = JSON.stringify(dateMenus);

	wstream.once('open', () => {
		wstream.write(menus_json);
		wstream.end(() => {console.log('\033[32mWriteStream for cache file success\033[0m');});
	});
}

function slackMsgCmdNeedUserName(userTextArr){
	let slackMsg = {
		text: `Hi @${userTextArr['user_name']}`,
		attachments: [
			{
				title: 'Sorry for this inconvenience. \nPlease set your name in Google Sheet first',
				title_link: 'https://tinker.press',
				fields: [
					{
						title: 'Run command',
						value: `/lunch name <name in Google Sheet>`,
						short: false,
					}
				],
				color: '#3AA3E3',
				footer: 'Chúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
				footer_icon: 'https://tinker.press/favicon-64x64.png',
				ts: Math.floor(new Date().getTime() / 1000)
			}
		]
	};
	
	return Promise.resolve(slackMsg);
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

function slackMsgMenuNotFound(userTextInfo){
	let day = userTextInfo['menuDate'].format('dddd, MMM-DD');

	return {
		text: `Hi @${userTextInfo['user_name']}`,
		attachments:[
			{
				title: `Menu not found`,
				title_link: `https://tinker.press`,
				fields: [
					{
						value: `Menu on ${day} not exist`,
						short: false,
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

function slackMsgMenuFound(userTextInfo, menu){
	let day = userTextInfo['menuDate'].format('dddd, MMM-DD');

	return {
		text: `Hi, @${userTextInfo['user_name']}`,
		attachments: [
			{
				title: `Menu on ${day}`,
				title_link: 'https://tinker.press/good-food-good-life.jpg',
				fields: dishNamePriceFields(menu),
				color: '#3AA3E3',
				footer: 'Chúc bạn ngon miệng ᕕ( ᐛ )ᕗ',
				footer_icon: 'https://tinker.press/favicon-64x64.png',
				ts: Math.floor(new Date().getTime() / 1000)
			}
		]
	};
}

function dishNamePriceFields(menu){
	// Build out slack msg field for dish name => price
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

	return dishesV2;
}

function slackMsgNoDishIndex(userTextArr){
	let slackMsg = {
		text: `Hi @${userTextArr['user_name']}`,
		attachments:[
			{
				title: `No dish at your submited index`,
				title_link: `https://tinker.press`,
				fields: [
					{
						title: `Run command`,
						value: `/lunch order [dish-num]\n[dish-num]: required`,
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

	return slackMsg;
}

function slackMsgOrder(userTextInfo, menu){
	let otherUsersBookDish = 'No one';
	// Improve info by REMOVE him from his self
	let dish = menu.dishes[userTextInfo['dishIndex']];
	// Info about other uses also book this dish
	let otherUsersBookDishArr = dish.users.filter(userName => userName != userTextInfo['sheet_name']);
	// Build back to string of other users
	if(otherUsersBookDishArr.length > 0)
		otherUsersBookDish = otherUsersBookDishArr.join(', ');

	let day = userTextInfo['menuDate'].format('dddd, MMM-DD');

	let slackMsg = {
		text: `Hi @${userTextInfo['user_name']}`,
		attachments: [
			{
				title: `You've ordered on ${day}`,
				title_link: 'https://tinker.press/good-food-good-life.jpg',
				fields: [
					{
						value: `${dish['name']}`,
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