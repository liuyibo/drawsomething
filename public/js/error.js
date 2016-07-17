var errors = {};
var errorcount = 0;

window.onerror = function(msg, url, line) {
    if (errorcount > 10) {
        return false;
    }
    errorcount++;
    var str = url + ":" + line + " <" + msg + ">";
    if (errors[str]) {
        return false;
    }
    $.post('/feedbackerror', { msg: str });
    return false;
};