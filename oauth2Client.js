let relativePath = '.';
let getOauth2Client = function() {
    var fs = require('fs');
    var readline = require('readline');
    var google = require('googleapis');
    var googleAuth = require('google-auth-library');

    var SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
    // var TOKEN_DIR = (process.env.HOME || process.env.HOMEPATH ||
    //     process.env.USERPROFILE) + '/.credentials/';
    var TOKEN_DIR = `${relativePath}/.credentials/`;
    var TOKEN_PATH = TOKEN_DIR + 'sheets.googleapis.com-nodejs-quickstart.json';

    // Load client secrets from a local file.
    var secretFile = 'client_secret_sheet.json';

    let getNewToken = function (oauth2Client) {
        var authUrl = oauth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES
        });
        console.log('Authorize this app by visiting this url: ', authUrl);
        var rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
        rl.question('Enter the code from that page here: ', function(code) {
            rl.close();
            oauth2Client.getToken(code, function(err, token) {
                if (err) {
                    console.log('Error while trying to retrieve access token', err);
                    return;
                }
                oauth2Client.credentials = token;
                storeToken(token);
                return oauth2Client;
            });
        });
    }

    let storeToken = function (token) {
        try {
            fs.mkdirSync(TOKEN_DIR);
        } catch (err) {
            if (err.code != 'EEXIST') {
                throw err;
            }
        }
        fs.writeFile(TOKEN_PATH, JSON.stringify(token));
        console.log('Token stored to ' + TOKEN_PATH);
    }

    let promise = new Promise((resolve, reject) => {
        fs.readFile(secretFile, function processClientSecrets(err, content) {
            if (err) {
                console.log('Error loading client secret file: ' + err);
                reject('Error loading client secret file: ' + err);
            }
            // Authorize a client with the loaded credentials, then call the
            // Google Sheets API.
            var credentials = JSON.parse(content);
            var clientSecret = credentials.installed.client_secret;
            var clientId = credentials.installed.client_id;
            var redirectUrl = credentials.installed.redirect_uris[0];
            var auth = new googleAuth();
            var oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);

            // Check if we have previously stored a token.
            fs.readFile(TOKEN_PATH, function(err, token) {
                if (err) {
                    resolve(getNewToken(oauth2Client));
                } else {
                    oauth2Client.credentials = JSON.parse(token);
                    resolve(oauth2Client);
                }
            });
        });
    });

    return promise;
};

module.exports = getOauth2Client;