const lunchMoneyId = '1CM6BNJn4K24JZbn5zJLwkcES9BZ4o9wzr8t9W6kNb-8';

function updateToLunchMoney(sheets, auth, record){
	sheets.spreadsheets.values.get({
	    auth: auth,
	    spreadsheetId: lunchMoneyId,
	    range: '2016!A276:AT',
	  }, function(err, response) {
	    if (err) {
	      console.log('The API returned an error: ' + err);
	      return;
	    }
	    // console.log(response);
	    let rows = response.values;
	    // console.log(rows, rows.length);
	    if(!rows || rows.length == 0) {
	    	console.log('No data found.');
	    }else{
	    	// console.log(rows[0]);
	    	console.log('read first 10:');
	    	let firstTen = rows[0]
		    	.filter((val, index) => {
		    		return index < 10;
		    	})
	    		.join(',');
    		
    		console.log(firstTen);
	    }
	  });
}

module.exports = updateToLunchMoney;