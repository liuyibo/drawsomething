var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');

var app = express();


app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
if (global.debug) {
    app.use(logger('dev'));
}
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public/audio')));
app.use(express.static(path.join(__dirname, 'public/css')));
app.use(express.static(path.join(__dirname, 'public/img')));
app.use(express.static(path.join(__dirname, 'public/js')));
app.use('/imgdump', express.static(path.join(__dirname, 'imgdump')));

app.use('/', require('./routes/index'));
app.use('/test', require('./routes/test'));
app.use('/admin', require('./routes/admin'));
app.use('/setconfig', require('./routes/setconfig'));
app.use('/getconfig', require('./routes/getconfig'));
app.use('/getloginstatus', require('./routes/getloginstatus'));
app.use('/imgdumps', require('./routes/imgdumps'));
app.use('/getimgdumpsinfo', require('./routes/getimgdumpsinfo'));
app.use('/feedbackerror', require('./routes/feedbackerror'));


module.exports = app;