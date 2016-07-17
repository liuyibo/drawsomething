var brushcolor = ["#000000", "#e51c23", "#e91e63", "#9c27b0", "#5677fc", "#03a9f4"
    , "#259b24", "#ffeb3b", "#ff9800", "#795548"];
var brushwidth = [2, 3, 5, 8, 12, 17, 23, 31, 40];
var isflip = false;
var logined = false;
var logining = false;
var firstTimeToggleAbout = true;
var playersInfo = {};
var lastPoint = { x : 0, y : 0 };

var rooms = [];
var selectedroom = -1;

// jquery dom cache
var $canvas;
var $skip;
var $reset;
var $readyboard;
var $inputwordboard;
var $inputwordword;
var $inputwordhint;
var $inputwordpre;
var $answerboard;
var $scoreboard;
var $answer;
var $correctCount;
var $ranklist;
var $status;
var $players;


// init login page
function stickmanposition(index) {
    if (index < 5) {
        return { x: 89 + index * 30, y: 227 };
    } else {
        return { x: 89 + (index - 5) * 30, y: 177 };
    }
}
function refreshrooms() {
    var $container = $("#housecontainer");
    $container.html("");
    for (var i = 0; i < rooms.length; i++) {
        var div = $("<div></div>");
        div.addClass("room");
        div.attr("id", i);
        var img = $("<img />");
        img.addClass("roombg");
        img.attr("src", "house.png");
        img.appendTo(div);
        div.appendTo($container);
        for (var j = 0; j < rooms[i].playercnt; j++) {
            var stickman = $("<img />");
            stickman.attr("src", "stickman.png");
            stickman.addClass("stickman");
            var position = stickmanposition(j);
            stickman.css({"left": position.x + "px", "top": position.y + "px"});
            stickman.appendTo(div);
        }
        if (selectedroom == i) {
            var stickman = $("<img />");
            stickman.attr("src", "stickman1.png");
            stickman.addClass("stickman");
            var position = stickmanposition(rooms[i].playercnt);
            stickman.css({"left": position.x + "px", "top": position.y + "px"});
            stickman.appendTo(div);
        }
        $("<div class='roomdesc'></div>").html(rooms[i].name).appendTo(div);
        div.click(function() {
            var id = $(this).attr("id");
            if (rooms[id].playercnt >= 10) {
                id = -1;
            }
            selectedroom = id;
            refreshrooms();
        });
    }
}



$(document).ready(function () {

    // jquery dom cache
    $canvas = $("#canvas");
    $skip = $("#skip");
    $reset = $("#reset");
    $readyboard = $("#readyboard");
    $inputwordboard = $("#inputwordboard");
    $inputwordword = $("#inputwordword");
    $inputwordhint = $("#inputwordhint");
    $inputwordpre = $("#inputwordpre");
    $answerboard = $("#answerboard");
    $scoreboard = $("#scoreboard");
    $answer = $("#answer");
    $correctCount = $("#correctCount");
    $ranklist = $("#ranklist");
    $status = $("#status");
    $players = $("#players");


    var tr = $(".colortable tr");
    for (var i = 0; i < brushcolor.length; i++) {
        var td = $('<td></td>');
        var div = $('<div class="radiocolor"></div>');
        var id = "radiocolor" + i;
        var color = brushcolor[i];

        var bg = $('<label></label>');
        bg.addClass("radiocolorbg");
        bg.attr("for", id);
        bg.appendTo(div);

        var input = $('<input/>');
        input.attr("type", "radio");
        if (i == 0) {
            input.attr("checked", "checked");
        }
        input.attr("value", color);
        input.attr("id", id);
        input.attr("name", "color");
        input.appendTo(div);

        var fg = $('<label></label>');
        fg.addClass("radiocolorfg");
        fg.css("background", color);
        fg.appendTo(div);

        div.appendTo(td);
        td.appendTo(tr);
    }

    tr = $(".widthtable tr");
    for (var i = 0; i < brushwidth.length; i++) {
        var td = $('<td></td>');
        var div = $('<div class="radiowidth"></div>');
        var id = "radiowidth" + i;
        var width = brushwidth[i];

        var bg = $('<label></label>');
        bg.addClass("radiowidthbg");
        bg.attr("for", id);
        bg.appendTo(div);

        var input = $('<input />');
        input.attr("type", "radio");
        if (i == 2) {
            input.attr("checked", "checked");
        }
        input.attr("value", width);
        input.attr("id", id);
        input.attr("name", "width");
        input.appendTo(div);

        var fg = $('<label></label>');
        fg.addClass("radiowidthfg");
        fg.css("width", width + "px");
        fg.css("height", width + "px");
        fg.appendTo(div);
        div.appendTo($("body"));
        div.appendTo(td);
        td.appendTo(tr);
    }


   refreshrooms();



    $("#loginpage").hide();
    $("#gamecontent").hide();
    $answerboard.hide();
    $scoreboard.hide();
    $("#aboutboard").hide();
    $readyboard.hide();
    $inputwordboard.hide();

});

function setCookie(c_name,value,expiredays)
{
    var exdate=new Date()
    exdate.setDate(exdate.getDate()+expiredays)
    document.cookie=c_name+ "=" +escape(value)+
        ((expiredays==null) ? "" : ";expires="+exdate.toGMTString())
}

function getCookie(c_name)
{
    if (document.cookie.length>0)
    {
        c_start=document.cookie.indexOf(c_name + "=")
        if (c_start!=-1)
        {
            c_start=c_start + c_name.length+1
            c_end=document.cookie.indexOf(";",c_start)
            if (c_end==-1) c_end=document.cookie.length
            return unescape(document.cookie.substring(c_start,c_end))
        }
    }
    return "";
}

var context = null;
var socket = null;
var pathPoints = [];
var isPainting = false;
var isDrawing = false;

$(window).load(function () {
    convertTouchToMouse("canvas");
    context = document.getElementById("canvas").getContext("2d");
    context.lineJoin = "round";

    //
    // Socket fun
    //

    $status.html("Connecting...");

    socket = io();

    socket.on("connected", function () {
        socket.emit("auto login", { sid: getCookie('sid') });
        socket.emit("room info");
    });

    socket.on("update state", function (data) {
        if (data.state == "in turn" && data.turn == "draw") {
            $skip.attr("disabled", false);
            $reset.attr("disabled", false);
            isDrawing = true;
        } else {
            $skip.attr("disabled", true);
            $reset.attr("disabled", true);
            isDrawing = false;
        }
        if (data.state == "pre game") {
            $readyboard.show();
            $readyboard.html(data.message);
            if (data.ready) {
                $readyboard.addClass("readyboard-checked");
            } else {
                $readyboard.removeClass("readyboard-checked");
            }
        } else {
            $readyboard.hide();
        }
        if (data.inputWord) {
            if (data.inputWord == 2) {
                $inputwordboard.show();
                $inputwordpre.hide();
                if ($inputwordword.val() == "" && $inputwordpre.val() != "") {
                    $inputwordword.val($inputwordpre.val());
                    $inputwordpre.val("");
                }
            } else if (data.inputWord == 1) {
                $inputwordboard.hide();
                $inputwordpre.show();
            }
        } else {
            $inputwordboard.hide();
            $inputwordpre.hide();
        }
        if (data.state == "post turn") {
            $answerboard.show();
            $scoreboard.hide();
            $answer.html(data.answer);
            $correctCount.html(data.correctCount);
        } else if (data.state == "post game") {
            $answerboard.hide();
            $scoreboard.show();
            var info = data.scoreInfo;
            var html = "";
            var cnt = info.length;
            if (cnt > 6) {
                cnt = 6;
            }
            for (var i = 0; i < cnt; i++) {
                html += '<div><div>第&nbsp' + (i + 1) + '&nbsp名：</div><div>'
                    + info[i].name + '</div><div>' + info[i].score + '分</div></div>';
            }
            $ranklist.html(html);
        } else {
            $answerboard.hide();
            $scoreboard.hide();
        }
        if (data.state == "in turn") {
            $status.html(data.time + "&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp" + data.turn + "&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp&nbsp" + data.message);
        } else if (data.state == "idle") {
            pathPoints = [];
            resetCanvas();
            $status.html("Game is not started!");
        } else if (data.state == "pre turn") {
            $status.html("Waiting for the word~");
        } else if (data.state == "post turn") {
            $status.html("Waiting for the next turn~");
        } else if (data.state == "post game") {
            $status.html("Waiting for the next game~");
        }
    });

    socket.on("update players", function (data) {
        playersInfo = data.players;
        var txt = "";
        for (var i = 0; i < playersInfo.length; i++) {
            txt += '<div class="playerinfo">' + playersInfo[i].name + "<br>" + playersInfo[i].score + "分";
            if (playersInfo[i].identity == "draw") {
                txt += "<img src='brush.png' class='playericon' />";
            } else if (playersInfo[i].identity == "input") {
                txt += "<img src='document.png' class='playericon' />";
            } else if (playersInfo[i].identity == "guess") {
                if (playersInfo[i].state == 1) {
                    txt += "<img src='correct.png' class='playericon' />";
                } else if (playersInfo[i].state == 2) {
                    txt += "<img src='correct1.png' class='playericon' />";
                }
            }
            txt += "</div>";
        }
        $players.html(txt);
    });

    socket.on("room info", function (data) {
        rooms = data.rooms;
        refreshrooms();
    });

    socket.on("draw", function (data) {
        if (isDrawing) return; //when we're drawing, we should disregard "enemy" input
        var point = data.point;
        if (data.isarray) {
            for (var i = 0; i < point.length; i++) {
                drawPointOnCanvas(point[i]);
            }
        }
        drawPointOnCanvas(point);
    });

    socket.on("reset", function () {
        pathPoints = [];
        resetCanvas();
    });

    var chatlen = 20;
    var chats = [];
    socket.on("chat", function (data) {
        if (data.message) {
            var message = data.message;
            chats[chats.length] = message;
            if (chats.length > chatlen) {
                chats.splice(0, chats.length - chatlen);
            }
            var chat = "";
            for (var i = 0; i < chats.length; i++) {
                chat = chat + chats[i] + "<br>";
            }
            $("#chat").html(chat);
            $("#chat").scrollTop($("#chat").prop("scrollHeight"));
        }
        if (data.sound) {
            $('<audio autoplay="autoplay"><source src="' + data.sound + '"></audio>')[0].volume = 0.5;
        }
        if (data.effect) {
            var e = data.effect;
            if (e == 'drawalert') {
                var div = $("<div />")
                    .appendTo($("#gamecontent"))
                    .addClass("center");
                var img = $("<img />")
                    .appendTo(div)
                    .attr("src", "drawalert.png")
                    .addClass("drawalert");
                setTimeout(function () {
                    div.remove();
                }, 1000);
            }
        }
    });

    socket.on("rate", function (data) {
        var img = $("<img />")
            .appendTo($answerboard)
            .attr("src", data.img)
            .css("margin-left", (data.posX - 50) + "px")
            .css("margin-top", (data.posY - 50) + "px");
        if (data.type == "like") {
            img.addClass("flower");
            setTimeout(function () {
                img.remove();
            }, 1990);
        } else if (data.type == "dislike") {
            img.addClass("slipper");
            setTimeout(function () {
                img.remove();
            }, 2990);
        }
    });


    // init readyboard
    $readyboard.click(function () {
        socket.emit("ready");
    });

    //
    // Mouse events
    //

    $canvas.mousedown(function (e) {
        if (!isDrawing || isPainting === true) return;
        isPainting = true;
        var point = getPointOnCanvas(e);
        sendDrawPoint(point.x, point.y, true);
    });

    $canvas.mousemove(function (e) {
        if (!isDrawing) return;
        if (isPainting) {
            var point = getPointOnCanvas(e);
            sendDrawPoint(point.x, point.y, false);
        }
    });

    $(document).mouseup(function () {
        isPainting = false;
    });

    $skip.click(function () {
        if (!isDrawing) return;
        socket.emit("skip");
    });

    $reset.click(function () {
        if (!isDrawing) return;
        socket.emit("reset");
        pathPoints = [];
        resetCanvas();
    });

    $("#flowerbtn").click(function () {
        socket.emit("rate", { type: "like" });
    });
    
    $("#slipperbtn").click(function () {
        socket.emit("rate", { type: "dislike" });
    });

    // input word board
    $("#inputwordform").submit(function() {
        var word = $inputwordword.val();
        var hint = $inputwordhint.val();
        if (!word || !word.length || !hint || !hint.length) {
            alert("Please input 什么东西!");
            return;
        }
        socket.emit("input word", {word: word, hint: hint});
        $inputwordword.val("");
        $inputwordhint.val("");
        $inputwordpre.val("");
        $inputwordboard.hide();
    });

    $("#inputwordgiveup").click(function () {
        socket.emit("input word");
    });

    //
    // Keyboard event
    //

    $("#nameform").submit(function () {
        var name = $("#nameinput").val();
        if (name && name.length) {
            socket.emit("change name", {name: name});
        }
    });

    $("#speakform").submit(function () {
        var message = $("#speakinput").val();
        if (message && message.length) {
            socket.emit("chat", {message: message});
        }
        $("#speakinput").val("");
    });


    $("#loginform").submit(function () {
        var name = $("#username").val();
        var password = $("#password").val();
        if (!name || !password || !name.length || !password.length) {
            alert("please input username && password");
            return;
        }
        if (logined || logining) {
            return;
        }
        logining = true;
        socket.emit("login", {name: name, password: password, room: selectedroom});
    });

    socket.on("login result", function (data) {
        if (data.result) {
            $("#loginpage").hide();
            $("#gamecontent").show();
            logined = true;
            setCookie('sid', data.sid, 365);
        } else {
            if (data.reason) {
                alert("error! " + data.reason);
            }
        }
        logining = false;
    });

    socket.on("auto login result", function (data) {
        if (data.result) {
            $("#gamecontent").show();
        } else {
            $("#loginpage").show();
        }
    });

    $("#register").click(function () {
        var name = $("#username").val();
        var password = $("#password").val();
        if (!name || !password || !name.length || !password.length) {
            alert("please input username && password");
            return;
        }
        socket.emit("register", { name: name, password: password });
    });

    socket.on("register result", function (data) {
        if (data.result) {
            alert("ok!");
        } else {
            alert("error!");
        }
    });

    $("#logout").click(function () {
        socket.emit("logout", { sid: getCookie('sid') });
        $("#loginpage").show();
        $("#gamecontent").hide();
        logined = false;
    });

    socket.on("logout", function () {
        $("#loginpage").show();
        $("#gamecontent").hide();
        logined = false;
        alert("Another client logined!");
        socket.emit("room info");
    });

    function getPointOnCanvas(e) {
        var canvas = $canvas;
        var parentOffset = canvas.parent().offset();
        var x = e.pageX - parentOffset.left - parseInt(canvas.css("border-left-width"), 10);
        var y = e.pageY - parentOffset.top - parseInt(canvas.css("border-top-width"), 10);

        return {
            x: x,
            y: y
        };
    }

    function sendDrawPoint(x, y, restart) {
        var point = {
            "x": x,
            "y": y,
        }
        if (restart) {
            point.restart = 1;

            if ($("#radiocolornull").is(":checked")) {
                point.width = 50;
                point.color = "#ffffff";
            } else {
                var width = $(".radiowidth input:checked").val() || 10;
                var color = $(".radiocolor input:checked").val() || "#000000";
                point.width = width;
                point.color = color;
            }
        }

        drawPointOnCanvas(point);
        socket.emit("draw", point);
    }

    function drawPointOnCanvas(point) {
        context.beginPath();
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

        lastPoint = point;
    }

    function resetCanvas() {
        context.clearRect(0, 0, 800, 500);
        context.fillStyle = "#fff";
        context.fillRect(0, 0, 800, 500);
    }

    function toggleAbout() {
        isflip = !isflip;
        if (isflip) {
            $("#icon").css("transform", "scaleX(-1)");
            if (firstTimeToggleAbout) {
                $("#audioplayer").html('<source src="bgm.mp3" />');
                firstTimeToggleAbout = false;
            }
            $("#audioplayer")[0].play();
            $("#aboutboard").show();
        } else {
            $("#icon").css("transform", "none");
            $("#audioplayer")[0].pause();
            $("#aboutboard").hide();
        }
    }

    $("#icon").click(function () {
        toggleAbout();
    });

    $("#aboutboard").click(function () {
        toggleAbout();
    });

});
