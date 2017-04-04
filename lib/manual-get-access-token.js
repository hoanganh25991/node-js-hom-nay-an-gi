let fs = require('fs');
let readline = require('readline');
let google = require('googleapis');
let googleAuth = require('google-auth-library');

let _ = require(`${__dirname}/util`);
let SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];
let TOKEN_DIR = `${_.getPath('root')}/.credentials`;
let TOKEN_PATH = `${TOKEN_DIR}/sheets.googleapis.com-nodejs-quickstart.json`;
// Load client secrets from a local file.
let secretFile = `${_.getPath('cache')}/client_secret_sheet.json`;

fs.readFile(secretFile, function processClientSecrets(err, content) {
	if (err) {
		console.log('Error loading client secret file: ' + err);
		reject('Error loading client secret file: ' + err);
	}
	// Authorize a client with the loaded credentials, then call the
	// Google Sheets API.
	let credentials = JSON.parse(content);
	let clientSecret = credentials.installed.client_secret;
	let clientId = credentials.installed.client_id;
	let redirectUrl = credentials.installed.redirect_uris[0];
	let auth = new googleAuth();
	let oauth2Client = new auth.OAuth2(clientId, clientSecret, redirectUrl);
	// Check if we have previously stored a token.
	fs.readFile(TOKEN_PATH, function(err, token) {
		if (err) {
			console.log(err);
			getNewToken(oauth2Client);
		} else {
			oauth2Client.credentials = JSON.parse(token);
		}
	});
});

function getNewToken(oauth2Client) {
    let authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: SCOPES
    });
    console.log('Authorize this app by visiting this url: ', authUrl);
    let rl = readline.createInterface({
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

function storeToken(token) {
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