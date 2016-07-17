var express = require('express');
var router = express.Router();

var config = require('../lib/config.js');

router.get('/', function(req, res, next) {
    res.send(config);
});

module.exports = router;