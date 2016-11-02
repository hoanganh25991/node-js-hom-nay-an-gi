let fs = require('fs');
let config = JSON.parse(fs.readFileSync(`${__dirname}/nuiBayUtItConfig.json`).toString());

module.exports = config;