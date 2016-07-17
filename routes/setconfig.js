var express = require('express');
var router = express.Router();

var config = require('../lib/config.js');

router.post('/', function(req, res, next) {
    var data = req.body.query;
    if (data) {
        config["word_mode"] = data["word_mode"];
    }
    res.send();
});

module.exports = router;