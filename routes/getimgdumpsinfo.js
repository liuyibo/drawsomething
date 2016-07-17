var express = require('express');
var router = express.Router();

var db = require('../lib/db.js');

router.get('/', function(req, res, next) {
    db.getLatestImgs(10, function(err, imgs) {
        if (err) {
            res.send();
            return;
        }
        res.send(imgs);
    });
});

module.exports = router;