var express = require('express');
var router = express.Router();

router.post('/', function(req, res, next) {
    console.warn("Error: " + req.body['msg']);
});

module.exports = router;