let fs = require('fs');
let config = JSON.parse(fs.readFileSync(`${__dirname}/mapSlacknameUsername.json`).toString());

module.exports = config;