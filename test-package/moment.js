let moment = require('moment');
let repl = require('repl');
repl.start('>').context.moment = moment;