let oauth2Promise = require(`${__dirname}/oauth2Client`)();
let google = require('googleapis');

const nuiBayUtItId = '1osEF3thjxDgQiXk95N-xc9Ms9ZtgYI1CmZgKCLwIamY';
const lunchMoneyId = '1CM6BNJn4K24JZbn5zJLwkcES9BZ4o9wzr8t9W6kNb-8';

let sheets = google.sheets('v4');

// Open 'lunchMoneyId', get out users
// Open 'nuiBayUtItId', get menu on each day of week
// Append back into 'lunchMoneyId'

/**
 * Step 1: Open 'lunchMoneyId', get out users
 * @type {[type]}
 */
let globalAuth;
let globalUsers;

oauth2Promise
  .then(auth => {
    // console.log(auth);
    console.log('\033[32mAuth\033[0m: success');
    console.log(auth);
    globalAuth = auth;

    let getUsersPromise = new Promise((resolve, reject) => {
      sheets.spreadsheets.values.get({
        auth: globalAuth,
        spreadsheetId: lunchMoneyId,
        range: '2016!1:1'
      }, (err, res) => {
        if (err) {
          reject('The API returned an error: ' + err);
        }

        resolve(res);
      });
    });

    return getUsersPromise;
  })
  .then(res => {
    // console.log(res);
    console.log('\033[32mGot users\033[0m: success');
    console.log(res);

    let rows = res.values;
    if (!rows || rows.length == 0) {
      reject('Fail to users from getUsersPromise_res');
    }
    //["", "Hoan", "Loc", "Duy", "Hoang", "Vinh", "Toan web", "Nam", "D. Vu"]
    globalUsers = rows[0];
    // console.log(users);

    let getMenuInWeek = new Promise((resolve, reject) => {
      sheets.spreadsheets.values.get({
        auth: globalAuth,
        spreadsheetId: nuiBayUtItId,
        range: 'Gia chanh Cam Tuyet!A558:AD581',
        majorDimension: 'COLUMNS',
      }, (err, res) => {
        if (err) {
          reject('The API returned an error: ' + err);
        }

        resolve(res);
      });
    });

    return getMenuInWeek;
  })
  .then(res => {
    console.log('\033[32mGot menu\033[0m: success');
    // console.log(res);

    // console.log(res.values[0]);
    // console.log(globalUsers);
    let rows = res.values;
    if (!rows || rows.length == 0) {
      reject('Fail to menu from getMenuInWeek_res');
    }

    let chunkedRows = [];
    let currentChunkPos = -1;
    let i;
    for(i = 0; i < rows.length; i++){
    	if(i % 6 == 5){
    		chunkedRows.push(rows.slice(currentChunkPos + 1, i));
    		currentChunkPos = i;
    	}
    }

    console.log('\033[32mChunk rows\033[0m: success');
    console.log(chunkedRows[0]);

    let dateMenus = chunkedRows.map(dateMenu => {
    	// dateMenu[0] Menu: [menu, 'mon 1', 'mon 2', 'mon 3']
    	// dateMenu[1] Price: [price, '29000', '17000']
    	// dateMenu[2] Date: [mon 1st Oct, 'Tu, Anh, Quoi', 'Bao, Minh, Binh']
    	// dateMenu[3] Order: not important
    	// dateMenu[4] Total: not important
    	let menu = {
    		date: '',
    		dishes: []
    	};

    	dateMenu.forEach((val, index) => {
    		switch(index){
    			case 0:
    				//remove header 'menu'
    				val.splice(0, 1);
    				val.forEach(dishName => {
    					let dish = {name: '', price: '', users: []};
    					dish.name = dishName;
    					menu.dishes.push(dish);
    				});

    				break;
    			case 1:
    				val.splice(0, 1);
    				val.forEach((dishPrice, index) => {
    					let dish = menu.dishes[index];
    					dish.price = dishPrice;
    					// console.log(dishPrice);
    				});

    				break;
  				case 2:
  					//store menu-date
  					var date = val[0]; // 'mon (31 Oct)'
  					//parse menu-date
  					date = date.substr(5, date.length - 5 - 1);
  					date = new Date(`${date} ${new Date().getFullYear()}`);
  					console.log(date);
  					menu.date = date;
  					
  					val.splice(0, 1);
  					val.forEach((users, index) => {
  						// console.log(users);
  						users = users.split(',')
												.map(user => user.trim())
												.filter(notEmpty => notEmpty);
							let dish = menu.dishes[index];
							dish.users = users;
  					});

  					break;
    		}
    	});

    	return menu;
    });

    console.log('\033[32mdateMenus\033[0m: success', dateMenus[0]['dishes']);
  });