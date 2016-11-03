const lunchMoneyId = '1CM6BNJn4K24JZbn5zJLwkcES9BZ4o9wzr8t9W6kNb-8';

function updateToLunchMoney(sheets, auth, record){
	record = ['hoang', 'anh', 'le'];
	sheets.spreadsheets.values.append({
	    auth: auth,
	    spreadsheetId: lunchMoneyId,
	    valueInputOption: 'USER_ENTERED',
	    range: '2016!A278:AT',
	    resource: {
	    	values: [record],
	    	range: '2016!A277:AT',
	    	majorDimension: 'ROWS'
	    }
	  }, function(err, response) {
	    if (err) {
	      console.log('The API returned an error: ' + err);
	      return;
	    }
	    console.log(response);
	  });
}

module.exports = updateToLunchMoney;