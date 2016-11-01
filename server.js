var app = require('express')();
var bodyParser = require('body-parser');
var multer = require('multer'); // v1.0.5
var upload = multer(); // for parsing multipart/form-data

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing application/x-www-form-urlencoded

app.get('/', function (req, res) {
	let userName = req.param('user_name', 'Hoang Anh');
	// let acceptedUserCommand
  	res.send(userName);
});

app.post('/', function (req, res) {
	let userName = req.param('user_name', 'Hoang Anh');
  	res.send(userName);
});

app.get('/menu', function (req, res) {
  let getDateMenusPromise = require(`${__dirname}/getMenu`);
  getDateMenusPromise.then(dateMenus => {
  	let menu = dateMenus.filter(dateMenu => {
  		let date = new Date().getDate();console.log(date);
  		let menuDate = new Date(dateMenu.date).getDate();console.log(menuDate);

  		return date == menuDate;
  	});
  	if(menu.length == 0)
  		menu[0] = dateMenus[0];

  	res.send(JSON.stringify(menu[0]));
  });
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});