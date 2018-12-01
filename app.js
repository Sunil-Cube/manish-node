/*global.rootRequire = function(name) {
    return require(__dirname + '/' + name);
}*/

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var config = require('./config/global.js');
var verifyToken = require('./middleware/verifyToken.js');
var mysql = require('mysql');
var expressValidator = require('express-validator');
var http = require('http');
var fs = require('fs');
var util = require('util');
var app = express();
var mobile = require('./mobile/routes/route');

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


app.use(expressValidator({
 customValidators: {
   	gte: function(param, num) {
        return param >= num;
    }  
 }
}));

app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', mobile);

// catch 404 and forward to error handler
app.use(function(req, res, next) 
{
	var err = new Error('Not Found');
	err.status = 404;
	next(err);
});

// DB configuration
if(config.database.use === 'mysql'){

	var pool = mysql.createPool(config.database.mySQLConfig);
	console.log("Successfully connected with mysql");

	execQuery = function(sqlQuery, params, callback) {

		// get a connection from a pool request
		pool.getConnection(function(err, connection) {
			if (err) {
				console.log(err);
				callback(true);
				return;
			}
			// execute a query
			connection.query(sqlQuery, params, function(err, results) {
				connection.release();
				if (err) {
					console.log(err);
					callback(true);
					return;
				}
				callback(false, results);
			});
		});
	};

}else {

	throw new Error('Failed to connect with db');
	console.log(dbErr.message);

}


// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
	app.use(function(err, req, res, next) {
		res.status(err.status || 500);
		res.render('error', {
			message: err.message,
			error: err
		});
	});
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
	res.status(err.status || 500);
	res.render('error', {
		message: err.message,
		error: {}
	});
});


module.exports = app;
