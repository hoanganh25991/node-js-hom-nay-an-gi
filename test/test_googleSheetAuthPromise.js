let assert = require('assert');
let _ = require('../lib/util');

describe('googleSheetAuthPromise', function() {
	describe('#getAuthSuccess', function() {
		let googleSheetAuthPromise = require(`${_.getPath('lib')}/googleSheetAuth`)();
		it('promise should resolve(auth)', function cb(){
			googleSheetAuthPromise
				.then(auth => {
					// console.log(auth);
					assert.equal(true, true, 'VKL the nhi');
				})
				.catch(()=>{
					assert.equal(false, true, 'Fail auth');
				})
		});
	});
});