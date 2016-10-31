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

oauth2Promise.then(auth => {
  console.log(auth);
  sheets.spreadsheets.values.get({
    auth: auth,
    spreadsheetId: lunchMoneyId,
    range: '2016!1:1'
  }, (err, res) => {
    if (err) {
      console.log('The API returned an error: ' + err);
      return;
    }

    console.log(res)
  });
})