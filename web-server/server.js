/*******************************************
File name: server.js
Author: Maverick Peppers
Date: 12/16/2019
Description:
  The main script acts as a RESTful API
  server. Handles HTTP requests. Uses
  Passport for user registration and
  authentication. This script is
  a Web API on top of the Open NetBattle Web API.
********************************************/

/*******************************************
LOAD REQUIRED PACKAGES
*******************************************/
// Require the logger module
var logger = require('morgan');

// Require the express module
var express = require('express');

// Requires express-sessions
var session = require('express-session')

// Require the cookie parser module
var cookieParser = require('cookie-parser');

// Mongoose database & ORM
var mongoose = require('mongoose');
mongoose.Promise = Promise;

// Connect middleware for mongoose-passport sessions
var MongoStore = require('connect-mongo')(session);

// Require the passport module for authentication
var passport = require('passport');

// Require the body-parser module
var bodyParser = require('body-parser');

// Require the url module
var url = require('url');

// Require Cross Origin Resource Sharing
var cors = require('cors')

var settings = require('./server-settings');

// Create the express application
var app = express();

// Configure app with CORS
app.use(cors({
  'allowedHeaders': ['sessionId', 'Origin', 'X-Requested-With', 'Content-Type', 'Authorization', 'Accept'],
  'exposedHeaders': ['sessionId'],
  'origin': '*',
  'methods': 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
  'preflightContinue': false,
  'credentials': true,
  'origin': true
}));

/*******************************************
CONFIGURE THE DATABASE
*******************************************/

// Create a mongoose connection
var mongooseConnection = mongoose.createConnection();

// Connect to mongo
var url = settings.database.url,
    port = settings.database.port,
    collection = settings.database.collection,
    user = settings.database.user,
    pass = settings.database.password;

var connectString = 'mongodb://'+user+":"+pass+"@"+url+':'+port+'/'+collection+"?authSource=admin";
mongoose.set('useCreateIndex', true);
mongoose.connect(connectString, { useNewUrlParser: true, useUnifiedTopology: true} );

// Check the state of the pending transactions
var db = mongoose.connection;

db.on('error', function(err) {
  // Print the error let the system know it's not good
  console.log(err.stack);
});

db.once('open', function() {
  console.log("Connected to database on " + connectString);
});

// Use the json parser in our application
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended: true}));
app.use(cookieParser(settings.server.name + " SessionSecret"));

// Create an express session cookie to use with passport
app.use(session({  
  store: new MongoStore({ url: connectString } ),
  name: settings.server.name + ' Cookie',
  secret: settings.server.name + ' SessionSecret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge : settings.server.sessionDurationSeconds * 1000}
}));

// Use the Passport middleware in our routes
app.use(passport.initialize());
app.use(passport.session());

// Use the logger module in our development application
var env = process.env.NODE_ENV || 'dev';

if(env === 'dev') {
  app.use(logger('dev'));
}

app.use(function(req, res, next) {
  var session = req.session;

  if(!session) {
    session = req.session = {};
  }

  next();
});

// Now that the client has connected to the database,
// add it as middleware giving the request object
// a variable named 'database' that all routes
// can use to execute queries.

app.use(function(req, res, next) {
  req.database = db;

  next(); // Move onto the next middleware
});

/******************************************
CONFIG SERVER
*******************************************/
// Use environment defined port or 3000
var port = process.env.PORT || settings.server.port || 3000;

var cleanup = function() {
    db.close();
    process.exit();
};

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

/******************************************
CREATE ROUTES
*******************************************/

app.get('/heartbeat', (req, res) => res.sendStatus(200));

// Create our express router
var v1Router = require('./v1/router')(db, settings);

// Register ALL routes with /v1
app.use('/v1', v1Router);

// Catch 404 routing error
app.use(function(req, res, next) {
  var err = new Error('Not Found');
  err.status = 404;

  res.json(err);

  next(err);
});

// Dev error handler -- to print stack trace
if(app.get('env') == 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
	  res.json({message: err.message, error:err});
  });
}

// Production error handler -- no stack traces
// leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 404);
  res.send();
});

/*****************************************
START THE SERVER
******************************************/
app.listen(port);

console.log(settings.server.name + ' is listening on'
+ ' port ' + port + '...');

module.exports = app;
