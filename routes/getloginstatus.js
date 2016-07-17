var express = require('express');
var router = express.Router();

var db = require('../lib/db.js')

router.get('/', function(req, res, next) {
    db.getUserWithSid(req.cookies.sid, function (err, user) {
        if (user) {
            res.send({ login: true, user: user });
        } else {
            res.send({ login: false });
        }
    });
});




module.exports = router;