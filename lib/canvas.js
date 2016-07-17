/**
 * Created by liuyibo on 16-3-13.
 */

var Canvas = require('canvas');
var fs = require('fs');
var db = require('./db.js');
var path = require('path');

function draw(points, filename, callback) {
    var canvas = new Canvas(800, 480);
    var context = canvas.getContext('2d');
    context.lineJoin = "round";
    context.clearRect(0, 0, 800, 500);
    context.fillStyle = "#fff";
    context.fillRect(0, 0, 800, 500);
    var lastPoint = {};

    for (var i = 0; i < points.length; i++) {
        context.beginPath();
        var point = points[i];
        if (point.restart) {
            context.strokeStyle = point.color;
            context.lineWidth = point.width;
            lastPoint.x = point.x;
            lastPoint.y = point.y;
        }
        context.moveTo(lastPoint.x, lastPoint.y);

        if (lastPoint.x == point.x && lastPoint.y == point.y) {
            context.lineTo(point.x + 0.01, point.y);
        } else {
            context.lineTo(point.x, point.y);
        }

        lastPoint.x = point.x;
        lastPoint.y = point.y;
        context.closePath();
        context.stroke();
    }

    var out = fs.createWriteStream(path.join(__dirname, '../imgdump/' + filename));
    var stream = canvas.createPNGStream();
    stream.on('data', function(chunk) {
        out.write(chunk);
    });
    stream.on('end', function() {
        if (callback) {
            callback();
        }
    });
}

function drawToFile(points, fileParams) {
    fileParams = fileParams || {};
    var name = fileParams.name || 'unknownName';
    var nickname = fileParams.nickname || 'unknownNickname';
    var date = new Date();
    var word = fileParams.word || 'unknownWord';
    var hint = fileParams.hint || 'unknownHint';
    var filename = date.getTime() + '.png';
    draw(points, filename, function() {
        db.addImg({ name: name, nickname: nickname, date: date, word: word, hint: hint, filename: filename });
    });
}

module.exports.drawToFile = drawToFile;
