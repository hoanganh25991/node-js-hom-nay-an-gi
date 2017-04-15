/**
 * Resolve path
 * @type {string}
 */
const rootFolder = __dirname.replace(/lib$/, '');
function getPath(folderName){
	folderName = folderName || '';
	if(folderName == '' || folderName == 'root'){
		return rootFolder;
	}

	return `${rootFolder}/${folderName}`;
};

/**
 * Handle menu parse
 * @param d
 * @returns {number}
 */

function getWeekNumber(d){
    d.setHours(0,0,0,0);
    d.setDate(d.getDate()+4-(d.getDay()||7));
    return Math.ceil((((d-new Date(d.getFullYear(),0,1))/8.64e7)+1)/7);
};

/**
 * Anotation in worksheet
 * @param i
 * @returns {string}
 */
function convertA1Notation(i){
	return (i >= 26 ? convertA1Notation((i / 26 >> 0) - 1) : '') +
		'abcdefghijklmnopqrstuvwxyz'[i % 26 >> 0];
}

/**
 * Get set for state
 */
let fs = require('fs');

/**
 * State of whole app
 */
function getState(){
	let state_json = fs.readFileSync(getPath('cache/state.json'));
	let state      = JSON.parse(state_json);

	return state;
}

/**
 * Save state
 * @param state
 */
function saveState(state){
	let state_json = JSON.stringify(state);

	fs.writeFileSync(getPath('cache/state.json'), state_json);
}

let util = {
	getWeekNumber,
	convertA1Notation,
	getPath,
	getState,
	saveState
};

module.exports = util;