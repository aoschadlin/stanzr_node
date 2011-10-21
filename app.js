/**
 * Module dependencies.
 */

var express = require('express'),
    redis = require('redis'),
    crypto = require('crypto'),
    redisSession = require('connect-redis')(express),
    http = require('http'),
    io = require('io');

/**
 * System wide services
 */
var app = module.exports = express.createServer();
var redisClient = redis.createClient();

/**
 * Configuration
 */
app.configure(function(){
  app.set('views', __dirname + '/views');
  app.set('view engine', 'jade');
  app.use(express.bodyParser());
  app.use(express.methodOverride());
  app.use(express.cookieParser());
  app.use(express.session({ secret: "stanzr key store", store: new redisSession }));
  app.use(app.router);
  app.use(express.static(__dirname + '/public'));
});

app.configure('development', function(){
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true })); 
});

app.configure('production', function(){
  app.use(express.errorHandler()); 
});

app.dynamicHelpers({
    session: function (req, res) {
        return req.session;
    }
});

/**
 * Global handlers
 */
redisClient.on("error", function (err) {
    console.log("Error " + err);
});

/**
 * Helper functions
 */

/*
  userSession - session associated with the user
  userId - id of the user
  nickname - name to display on random pages
*/
function loginUser(userSession, userId, nickname) {
  userSession.logged_in = true;
  userSession.user_id = userId;
  userSession.user_nickname = nickname;
  console.log('loginUser ' + JSON.stringify(userSession));
}

/*
  userSession - session associated with the user
*/
function logoutUser(userSession) {
  userSession.logged_in = false;
  userSession.user_id = null;
  userSession.user_nickname = null;
  console.log('logoutUser ' + JSON.stringify(userSession));
}

/*
  var company = {
    name: '',
    email: '',
    logo: '',
    description: ''
  };
  
  onComplete(id) - id is null on failure or the integer of the new company on success
*/
function saveCompany(companyData, onComplete) {
  var id = null;
  redisClient.incr('company:count', function(err, id) {  
    console.log('Saving company id ' + id);
    redisClient.set('company:' + id, JSON.stringify(companyData), redis.print);
    onComplete(id);
  });
};

/*
  companyId - integer id for the company
  onComplete(company) - company is null on failure or the object loaded on success
*/
function loadCompany(companyId, onComplete) {
  redisClient.get('company:' + companyId, function(err, data) {
    var company = null;
    if (! data) {
      console.log('loadCompany : Failed to load company ' + companyId);
    } else {
      company = JSON.parse(data.toString());
    }
    onComplete(company);
  });    
};

/*
   var userData = {
    email: '',
    password: '',
    companyId: ''
  }
  
  onComplete(id) - 0 if failure, id of newly created record if success
*/
function saveUser(userData, onComplete) {
  var id = null;
  redisClient.incr('user:count', function(err, id) {
    console.log('Saving user id ' + id);
    var encryptedEmail = crypto.createHash('sha256').update(userData.email).digest("hex");
    console.log('email is ' + encryptedEmail);
    
    redisClient.set('user_idx:' + encryptedEmail + ':id', id, redis.print);
    redisClient.set('user:' + id, JSON.stringify(userData), redis.print);   
    
    onComplete(id);
  });
};

/*
  email : email of the user
  onComplete(id) - id will be null on failure, an integer on success
*/
function loadUserId(email, onComplete) {
  var encryptedEmail = crypto.createHash('sha256').update(email).digest("hex");
  redisClient.get('user_idx:' + encryptedEmail + ':id', function(err, data) {
    var id = null;
    if (! data) {
      console.log('Failed to load id for email ' + email);
    } else {
      id = data.toString();
    }
    onComplete(id);
  });
};

/*
  userId : integer id of the user of interest
  onComplete(user) - user object
*/
function loadUser(userId, onComplete) {
  redisClient.get('user:' + userId, function(err, data) {
    var user = null;
    if (! data) {
      console.log('loadUser : Failed to load user ' + userId);
    } else {
      user = JSON.parse(data.toString());
    }
    onComplete(user);
  });    
};

/**
 * Routes
 */
app.get('/', function(req, res){
  res.render('index');
});

app.get('/register', function(req, res){
  // Load some default vars for editing
  var company = {
    name: '',
    email: '',
    logo: '',
    description: ''
  };
  var user = {
    email: '',
    password: '',
    confirm: ''
  };
  res.render('register', {company: company, user: user});
});

app.post('/register', function(req, res){
  // ZZZ Validate data
  
  var companyId = null;
  var userId = null;
  var localSession = req.session;
  var localEmail = req.body.user.email;
  var localPwd = req.body.user.password;

  var companyData = {
    name: req.body.company.name,
    email: req.body.company.email,
    logo: req.body.company.logo,
    description: req.body.company.description
  };
  saveCompany(companyData, function(companyId) {
    // Encrypt password
    var encryptedPwd = crypto.createHash('sha256').update(localPwd).digest("hex");
    var userData = {
      email: localEmail,
      password: encryptedPwd,
      companyId: companyId
    }
    saveUser(userData, function(userId) {
      console.log('register : localSession ' + localSession);
      console.log('register : userId ' + userId);
      console.log('register : localEmail ' + localEmail);
      loginUser(localSession, userId, localEmail);
      
      res.redirect('/dashboard');
    });
  });
});

app.get('/signin', function(req, res) {
  var user = {
    email: '',
    password: ''
  };
  res.render('signin', {user: user});
});

app.post('/signin', function(req, res) {  
  // Encrypt password
  var passedPwd = crypto.createHash('sha256').update(req.body.user.password).digest("hex");

  var userId = null;
  var user = null;
  var localSession = req.session;
  var localEmail = req.body.user.email;
  
  // Retrieve data for this user
  loadUserId(localEmail, function(userId) {
    console.log('signin : userId ' + userId);
    loadUser(userId, function(user) {
      console.log('signin : user ' + user);
      
      if ((user == null) || (user.password != passedPwd)) {
        var userData = {
          email: localEmail,
          password: ''
        };
        res.render('signin', {user: userData});
      } else {
        // Log the user in
        loginUser(localSession, userId, localEmail);
        
        res.redirect('/dashboard');
      }
    });
  });
});

app.get('/signup', function(req, res) {
  var user = {
    email: '',
    password: '',
    confirm: ''
  };
  res.render('signup', {user: user});
});

app.post('/signup', function(req, res) {
  // ZZZ Validate data
  
  // Encrypt password
  var encryptedPwd = crypto.createHash('sha256').update(req.body.user.password).digest("hex");
  
  
  var userData = {
    email: req.body.user.email,
    password: encryptedPwd,
    companyId: ''
  }
  var userId = null;
  var localSession = req.session;
  var localEmail = req.body.user.email;
  saveUser(userData, function(userId) {
    loginUser(localSession, userId, localEmail);

    // ZZZ change this to something real
   res.redirect('/dashboard')
  });
});

app.get('/signout', function(req, res) {
  logoutUser(req.session);

  res.redirect('/');
});

app.get('/dashboard', function(req, res){
  var channels = {
  '1.123' : { name: 'foo' },
  '1.345' : { name: 'bar' }
  };
  res.render('dashboard', {channels: channels});
});

app.get('/ch/:company.:channel', function(req, res) {
  var co = req.params.company;
  var ch = req.params.channel;
  var user = {
    email: req.session.user_nickname
  };
  res.render('ch', {user: user});
});

app.get('/ch', function(req, res) {
  var channel = {
    name: '',
    start_date: '',
    start_time: ''
  };
  res.render('ch_add', {channel: channel});
});

app.post('/ch', function(req, res) {
  res.render('ch_add', {channel: channel});
});

app.listen(4000);

/*
 * Real time chat functionality
 */
var io = io.listen(app)
  , buffer = [];

io.on('connection', function(client){
  client.send({ buffer: buffer });
  client.broadcast({ announcement: client.sessionId + ' connected' });  // Just for debug

  client.on('message', function(message){
    var msg = { message: [client.sessionId, message] };
    buffer.push(msg);
    if (buffer.length > 15) buffer.shift();
    client.broadcast(msg);
  });

  client.on('disconnect', function(){
    client.broadcast({ announcement: client.sessionId + ' disconnected' });  // Just for debug
  });
});

console.log("Express server listening on port %d in %s mode", app.address().port, app.settings.env);