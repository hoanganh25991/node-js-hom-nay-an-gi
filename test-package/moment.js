let moment = require('moment');
let repl = require('repl');
let todayInVietnamTimezone = moment().utcOffset(7 * 60).format();
console.log('todayInVietnamTimezone', todayInVietnamTimezone);
repl.start('>').context.moment = moment;