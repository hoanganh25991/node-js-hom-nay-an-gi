let fs = require('fs');
let config = JSON.parse(fs.readFileSync(`${__dirname}/lunchMoneyConfig.json`).toString());

module.exports = config;