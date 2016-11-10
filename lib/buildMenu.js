let buildMenu = function (res){
	let rows = res.values;
	if (!rows || rows.length == 0) {
		console.log('Fail to menu from getMenuInWeek_res');
		return new Promise((res, rej) => {rej('Fail to menu from getMenuInWeek_res');});
	}

	let chunkedRows = [];
	let currentChunkPos = -1;
	let i;
	for (i = 0; i < rows.length + 1; i++) {
		if (i % 6 == 5) {
			chunkedRows.push(rows.slice(currentChunkPos + 1, i));
			currentChunkPos = i;
		}
	}
	console.log('Chunk row success, chunkedRows.length', chunkedRows.length);

	/**
	 * This logic fail, BCS some row without data in col of google-sheet
	 * google-sheet return ['torin', '', '', 'anh']
	 * Behind 'anh' is EMPTY
	 */
	// chunkedRows = chunkedRows.map(chunkedRow => {
	// 	/**
	// 	 * Read data from sheet-range, BUT EACH COLUMNS READED OUT
	// 	 * has different length, bcs google-sheet treat empty cell as NULL
	// 	 * [
	// 	 *  Array[24]
	// 	 *  Array[24]
	// 	 *  Array[26]
	// 	 *  Array[26]
	// 	 * ]
	// 	 *
	// 	 * IT IS dangerous to consider as same length on each one
	// 	 * @type {Array}
	// 	 */
	// 	let minColDataLength = chunkedRow.reduce((rowX, rowY) => {
	// 		return rowX.length > rowY.length ? rowY.length : rowX.length;
	// 	});
	//
	// 	chunkedRow = chunkedRow.map(row => {
	// 		let newRow = row.filter((cell, index) => {
	// 			return index < minColDataLength;
	// 		})
	//
	// 		return newRow;
	// 	})
	//
	// 	return chunkedRow;
	// });

	console.log(chunkedRows);
	
	let dateMenus = chunkedRows.map((dateMenu, col) => {
		// dateMenu[0] Menu: [menu, 'mon 1', 'mon 2', 'mon 3']
		// dateMenu[1] Price: [price, '29000', '17000']
		// dateMenu[2] Date: [mon 1st Oct, 'Tu, Anh, Quoi', 'Bao, Minh, Binh']
		// dateMenu[3] Order: not important
		// dateMenu[4] Total: not important
		let menu = {
			// col: col * 6 + 1,
			col: col * 6,
			date: '',
			dishes: []
		};

		dateMenu.forEach((val, index) => {
			switch (index) {
				case 0:
					//remove header 'menu'
					val.splice(0, 1);
					val.forEach((dishName, index) => {
						let dish = {
							row: index + 1,
							name: '',
							price: '',
							users: []
						};
						dish.name = dishName;
						menu.dishes.push(dish);
					});

					break;
				case 1:
					val.splice(0, 1);
					val.forEach((dishPrice, index) => {
						let dish = menu.dishes[index];
						dishPrice = dishPrice.replace(',000', '');
						dish.price = parseInt(dishPrice, 10);
						// console.log(dishPrice);
					});

					break;
				case 2:
					//store menu-date
					var date = val[0]; // 'mon (31 Oct)'
					// console.log(date);
					// console.log(date.match(/\d+ [a-zA-Z]+/));
					//parse menu-date
					// date = date.substr(5, date.length - 5 - 1).replace(/\s/g, '-');
					date = date.match(/\d+ [a-zA-Z]+/)[0].replace(/\s/g, '-');
					menu.date = `${date}-2016`;
					// console.log(menu.date);

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

		menu.dishes = menu.dishes.filter(dish => dish.name);

		return menu;
	});

	return dateMenus;
}

module.exports = buildMenu;