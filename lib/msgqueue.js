/**
 * Created by liuyibo on 16-3-13.
 */

module.exports.MsgQueue = function() {

};

module.exports.MsgQueue.prototype = {
    a: [],
    peek: function() {
        var a = this.a;
        return a[0];
    },
    push: function(item) {
        var a = this.a;
        a[a.length] = item;
    },
    pop: function() {
        var a = this.a;
        var item = a[0];
        a.splice(0, 1);
        return item;
    },
    clear: function() {
        this.a = [];
    }
};
