let storage = require('node-persist');
let repl = require('repl');

repl.start('>').context.storage = storage;
