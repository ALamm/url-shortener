'use strict';

var express = require('express');
var routes = require('./app/routes/index.js');
var mongoose = require('mongoose');
var passport = require('passport');
var session = require('express-session');
var url = require('url');
var random = require('random-js')();


var app = express();
require('dotenv').load();
require('./app/config/passport')(passport);

//mongoose.connect(process.env.MONGO_URI);
mongoose.connect(process.env.MONGOLAB_URI);


app.use('/controllers', express.static(process.cwd() + '/app/controllers'));
app.use('/public', express.static(process.cwd() + '/public'));
app.use('/common', express.static(process.cwd() + '/app/common'));

app.use(session({
	secret: 'secretClementine',
	resave: false,
	saveUninitialized: true
}));

app.use(passport.initialize());
app.use(passport.session());

routes(app, passport);

app.all('*', function(req,res,next) {
    
    var db = mongoose.connection;
    db.on('error', console.error.bind(console, 'connection error:'));
    var collection = db.collection("shortened");
    var result = {};
    var hostname = "https://fcc-url-shorten.herokuapp.com/";	
    
    // use the node url module to get the req url
    var original = url.parse(req.url).pathname;         // get the pathname 
    var str = original.split('').slice(1).join('');  	// remove '/' from beginning of href
    console.log("str: " + str);

    // Test for valid URL
    var regex = new RegExp(/https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/);
    
    if(regex.test(str)) {
        
        console.log("valid url: " + str);
        
        // check if url string passed is already in DB.
        collection.find({original_url: str}).toArray(function (err,docs) {
            if (err) console.error('find error');
            
            // already in DB, so show the object which lists the original url and shortened url
            if (docs.length > 0) {
                console.log("This ORIGINAL url is already in database: " + "\noriginal_url: " + docs[0].original_url + "\nshort_url: " + docs[0].short_url);
                result = JSON.stringify({original_url: docs[0].original_url, short_url: docs[0].short_url});
                console.log("already in DB: \n"  + result);
                res.send(result);
            }
            
            // url string passed is not in DB, so create a record
            else {
                //create random 6 digit alphanumberic string
                var val = random.string(5);
    
                // to insert one document into the collection 
                collection.insertOne({original_url:str, short_url:hostname + val}, function (err,result) {   // callback function will return error or object if successful
                    if (err) console.error('insert err');
                    console.log("After Insert" + result);
                    collection.find({original_url: str}).toArray(function (err,docs) {
                        if (err) console.error('find error');
                        result = JSON.stringify({original_url: docs[0].original_url, short_url: docs[0].short_url});
                        console.log("New Record: \n" + result);
                        res.send(result);
                    });
                    
                });
            }
        });
    }
    
    else {
        console.log("invalid url OR shortened url was passed: " + str);
        
        // check if url string passed is already in DB.
        collection.find({short_url: hostname + str}).toArray(function (err,docs) {
            if (err) console.error('find error');
            
            // already in DB, so it must be a shortened URL - RE-DIRECT TO the site
            if (docs.length > 0) {
                console.log("this SHORT url is already in database: " + "\noriginal_url: " + docs[0].original_url + "\nshort_url: " + docs[0].short_url);
                res.redirect(docs[0].original_url);
            }
            
            // url string passed is not in DB, therefore invalid
            else {
                console.log("Definitely Invalid URL passed: " + str);
                res.send({"error":"url invalid"});   
            }
        });
    }
    
});

var port = process.env.PORT || 8080;
app.listen(port,  function () {
	console.log('Node.js listening on port ' + port + '...');
});
