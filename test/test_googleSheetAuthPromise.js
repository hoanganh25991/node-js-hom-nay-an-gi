let assert = require('assert');
let _ = require('../lib/util');

describe('googleAuth', function() {
	describe('#getAuthSuccess', function() {
		let googleSheetAuthPromise = require(`${_.getPath('lib')}/googleSheetAuth`)();
		it('promise should resolve(googleAuth)', function cb(){
			googleSheetAuthPromise
				.then(auth => {
					// console.log(googleAuth);
					assert.equal(true, true, 'VKL the nhi');
				})
				.catch(()=>{
					assert.equal(false, true, 'Fail googleAuth');
				})
		});
	});
});