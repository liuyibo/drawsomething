var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var models = require('./models.js');
if (global.debug) {
    mongoose.connect('mongodb://liuyibo.xyz:27017/drawsomething_test');
} else {
    mongoose.connect('mongodb://127.0.0.1:27017/drawsomething');
}
var db = mongoose;

for (var m in models) {
    db.model(m, new Schema(models[m]));
}

var getModel = function (type) {
    return db.model(type);
};

var User = getModel('user');
var Session = getModel('session');
var Img = getModel('img');

module.exports.addUser = function (user, callback) {
    var u = new User({ name: user.name, password: user.password });
    u.save(function (err) {
        if (!callback) {
            return;
        }
        callback(err, !err);
    });
};

module.exports.authUser = function (user, callback) {
    User.findOne({name: user.name, password: user.password}, function (err, user) {
        if (!callback) {
            return;
        }
        callback(err, !err && user);
    });
};

module.exports.setUserInfo = function (username, info, callback) {
    var i = {};
    if (info.nickname) {
        i.nickname = info.nickname;
    }
    User.update({ name: username }, i, function (err) {
        if (!callback) {
            return;
        }
        callback(err);
    });
};

module.exports.getUserInfo = function (username, callback) {
    User.findOne({ name: username }, function (err, user) {
        if (!callback) {
            return;
        }
        var info = {};
        if (user) {
            if (user.nickname) {
                info.nickname = user.nickname;
            } else {
                info.nickname = user.name;
            }
        }
        callback(err, info);
    });
};

module.exports.getUserWithSid = function(sid, callback) {
    if (!callback) {
        return;
    }
    if (!sid) {
        callback("no sid provided", null);
    } else {
        this.getSession(sid, function (err, session) {
            if (!err && session && session.user) {
                callback(err, session.user);
            } else {
                callback(err, null);
            }
        });
    }
};


module.exports.addSession = function (sid, data, callback) {
    Session.remove({ user: data.user }, function (err) {
        Session.update({sid: sid}, {user: data.user}, {upsert: true}, function (err) {
            if (!callback) {
                return;
            }
            callback(err);
        });
    });
};

module.exports.getSession = function (sid, callback) {
    Session.findOne({ sid: sid }, function (err, session) {
        if (!callback) {
            return;
        }
        if (err || !session) {
            callback(err, null);
            return;
        }
        var data = {};
        data.user = session.user;
        callback(err, data);
    });
};

module.exports.deleteSession = function (sid, callback) {
    Session.remove({ sid: sid }, function (err) {
        if (!callback) {
            return;
        }
        callback(err);
    });
};

module.exports.addImg = function (img, callback) {
    var i = new Img({ name: img.name, nickname: img.nickname, date: img.date,
        word: img.word, hint: img.hint, filename: img.filename });
    i.save(function (err) {
        if (!callback) {
            return;
        }
        callback(err, !err);
    });
};

module.exports.getLatestImgs = function(count, callback) {
    Img.find({}, { __v: 0, _id: 0})
        .sort({ date: -1 }).limit(count).exec(function(err, imgs) {
        if (!callback) {
            return;
        }
        callback(err, imgs);
    });
};
