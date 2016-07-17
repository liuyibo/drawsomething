/**
 * Created by liuyibo on 16-3-14.
 */

var db = require('./db.js');
//db.addImg({name: 'name2', nickname: 'nickname2', word: 'word2', hint: 'hint2', filename: '2.png', date: new Date() });

db.getLatestImgs(2, function(err, data) {
    console.log(data);
});
