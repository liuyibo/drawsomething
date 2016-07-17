/**
 * Created by liuyibo on 16-3-17.
 */

var fs = require('fs');
var utils = require('utility');
var path = require('path');

var session = require('./lib/session.js');
var db = require('./lib/db.js');
var config = require('./lib/config.js');

var io = require('socket.io')();


var MIN_PLAYERS_COUNT = 3;

var GAMEPHASE = {
    IDLE: 'idle',
    PRE_GAME: 'pre game',
    PRE_TURN: 'pre turn',
    IN_TURN: 'in turn',
    POST_TURN: 'post turn',
    POST_GAME: 'post game'
};


var canvas = require('./lib/canvas.js');
var wordlist = JSON.parse(fs.readFileSync(__dirname + "/words.json").toString()).wordlist;


function Room() {
    var gamePhase;
    var players = [];
    var time;
    var points;
    var hintMessage;
    var descMessage;
    var drawingPlayer;
    var inputWordPlayer;
    var wordToGuess;
    var updateTimeTimer;
    var turnResultTimer;
    var gameResultTimer;
    var noPlayerGotAnswer;
    var firstCorrectTime;
    var scoreSummary;

    var waitingInputWord;
    var useCustomWord;

    var changingGamePhase;
    var msgQueue = new (require('./lib/msgqueue.js').MsgQueue)();
    var handleMsgTimer;


    idle();

    function emit() {
        for (var i = 0; i < players.length; i++) {
            var sock = players[i].sock;
            sock.emit.apply(sock, arguments);
        }
    }

    function handleMsg() {
        if (changingGamePhase) {
            return;
        }
        var item = msgQueue.pop();
        if (!item) {
            return;
        }
        if (item.type == 'gamephase') {
            var phase = item.phase;
            if (phase == GAMEPHASE.IDLE) {
                idle();
            } else if (phase == GAMEPHASE.PRE_GAME) {
                preGame();
            } else if (phase == GAMEPHASE.PRE_TURN) {
                preTurn();
            } else if (phase == GAMEPHASE.IN_TURN) {
                inTurn();
            } else if (phase == GAMEPHASE.POST_TURN) {
                postTurn();
            } else if (phase == GAMEPHASE.POST_GAME) {
                postGame();
            }
        } else if (item.type == 'connect') {
            playerEnterGameImpl(item.user, item.socket);
        } else if (item.type == 'disconnect') {
            playerQuitGameImpl(item.socket);
        }
    }

    function startChangeGamePhase(newGamePhase) {
        //console.log("Game Phase : " + gamePhase + "  -->  " + newGamePhase);
        gamePhase = newGamePhase;
        if (changingGamePhase) {
            throw new Error('Unexpected game phase change');
        }
        changingGamePhase = newGamePhase;
    }

    function changeGamePhaseDone(newGamePhase) {
        if (changingGamePhase != newGamePhase) {
            throw new Error('Unexpected game phase change done');
        }
        changingGamePhase = null;
    }

    function changeGamePhase(newGamePhase) {
        if (players.length == 0) {
            newGamePhase = GAMEPHASE.IDLE;
        }
        msgQueue.push({type: 'gamephase', phase: newGamePhase});
    }

    function idle() {
        startChangeGamePhase(GAMEPHASE.IDLE);

        removeDisconnectedPlayers();

        if (updateTimeTimer) {
            clearInterval(updateTimeTimer);
            updateTimeTimer = null;
        }
        if (turnResultTimer) {
            clearTimeout(turnResultTimer);
            turnResultTimer = null;
        }
        if (gameResultTimer) {
            clearTimeout(gameResultTimer);
            gameResultTimer = null;
        }
        if (handleMsgTimer) {
            clearInterval(handleMsgTimer);
            handleMsgTimer = null;
        }
        msgQueue.clear();
        changeGamePhaseDone(GAMEPHASE.IDLE);
    }

    function preGame() {
        startChangeGamePhase(GAMEPHASE.PRE_GAME);

        removeDisconnectedPlayers();

        emit("reset");
        drawingPlayer = null;
        inputWordPlayer = null;
        for (var i = 0; i < players.length; i++) {
            players[i].score = 0;
            players[i].ready = false;
        }
        updateState();

        changeGamePhaseDone(GAMEPHASE.PRE_GAME);
    }

    function setNewDrawingPlayer() {
        var idx = indexOfPlayer(drawingPlayer);
        while (true) {
            idx = (idx + 1) % players.length;
            if (players[idx].connected) {
                players[idx].identity = "draw";
                drawingPlayer = players[idx];
                return;
            }
        }
    }

    function setNewInputWordPlayer() {
        var count = 0;
        var ar = [];
        for (var i = 0; i < players.length; i++) {
            if (players[i] != inputWordPlayer && players[i].connected && players[i].identity == "guess") {
                ar.push(players[i]);
            }
        }
        var index = Math.floor(Math.random() * ar.length);
        ar[index].identity = "input";
        inputWordPlayer = ar[index];
    }


// should be called when the game ends
    function removeDisconnectedPlayers() {
        var connplayers = [];
        for (var i = 0; i < players.length; i++) {
            if (players[i].connected) {
                connplayers.push(players[i]);
            }
        }
        players = connplayers;
    }

    function preTurn() {
        startChangeGamePhase(GAMEPHASE.PRE_TURN);

        points = [];
        emit("reset");

        var wordMode = config["word_mode"];
        if (wordMode == 0) {
            useCustomWord = false;
        } else {
            useCustomWord = true;
        }
        for (var i = 0; i < players.length; i++) {
            players[i].state = 0;
            players[i].baseScore = players[i].score;
            players[i].identity = "guess";
        }

        setNewDrawingPlayer();

        if (wordMode == 0) {
            inputWordPlayer = null;
        } else {
            setNewInputWordPlayer();
        }

        descMessage = hintMessage = wordToGuess = null;

        updatePlayers();

        noPlayerGotAnswer = true;

        if (wordMode == 0) {
            var wordCount = wordlist.length;
            var wordIndex = Math.floor(Math.random() * wordCount);
            descMessage = wordlist[wordIndex].word + 'hint : ' + wordlist[wordIndex].hint;
            hintMessage = wordlist[wordIndex].hint;
            wordToGuess = wordlist[wordIndex].word;
            changeGamePhase(GAMEPHASE.IN_TURN);
        } else {
            waitingInputWord = true;
            updateState();
        }
        changeGamePhaseDone(GAMEPHASE.PRE_TURN);
    }

    function inTurn() {
        startChangeGamePhase(GAMEPHASE.IN_TURN);

        shouldEndTurn = false;
        time = 75;
        updateTimeTimer = setInterval(function () {
            if (time > 0) {
                updateState();
                time--;
            } else {
                changeGamePhase(GAMEPHASE.POST_TURN);
            }
        }, 1000);
        var msg = {
            message: "<span style='color:green'>新的一轮开始了！" +
            (drawingPlayer ? ("由&nbsp" + drawingPlayer.name + "&nbsp画图！") : "") + "</span>"
        };
        for (var i = 0; i < players.length; i++) {
            if (players[i].identity == "draw") {
                msg['sound'] = 'drawalert.mp3';
            } else {
                msg['sound'] = 'start.wav';
            }
            players[i].sock.emit("chat", msg);
        }
        if (drawingPlayer) {
            drawingPlayer.sock.emit("chat", {effect: "drawalert"});
        }
        updateState();

        changeGamePhaseDone(GAMEPHASE.IN_TURN);
    }

    function postTurn() {
        startChangeGamePhase(GAMEPHASE.POST_TURN);

        if (points.length) {
            canvas.drawToFile(points, {
                name: drawingPlayer.user,
                nickname: drawingPlayer.name,
                word: wordToGuess,
                hint: hintMessage
            });
        }

        emit("chat", {message: "<span style='color:blue'>Answer:&nbsp</span><span style='color:blue; font-size:30px'>" + "<b>" + wordToGuess + "</b></span>"});
        emit("chat", {sound: "endturn.wav"});
        for (var i = 0; i < players.length; i++) {
            players[i].rated = null;
        }
        updatePlayers();
        updateState();
        if (updateTimeTimer) {
            clearInterval(updateTimeTimer);
            updateTimeTimer = 0;
        }
        turnResultTimer = setTimeout(function () {
            turnResultTimer = null;
            if (shouldEndGame()) {
                changeGamePhase(GAMEPHASE.POST_GAME);
            } else {
                changeGamePhase(GAMEPHASE.PRE_TURN);
            }
        }, 5000);

        changeGamePhaseDone(GAMEPHASE.POST_TURN);
    }

    function postGame() {
        startChangeGamePhase(GAMEPHASE.POST_GAME);

        removeDisconnectedPlayers();

        var scoreInfo = [];
        for (var i = 0; i < players.length; i++) {
            if (players[i].connected) {
                scoreInfo.push({name: players[i].name, score: players[i].score});
            }
        }
        for (var i = 0; i < scoreInfo.length; i++) {
            for (var j = i + 1; j < scoreInfo.length; j++) {
                if (scoreInfo[i].score < scoreInfo[j].score) {
                    var t = scoreInfo[i];
                    scoreInfo[i] = scoreInfo[j];
                    scoreInfo[j] = t;
                }
            }
        }
        scoreSummary = scoreInfo;
        emit("chat", {
            message: "<span style='color:green'>游戏结束！获胜者是：" + scoreInfo[0].name + "！</span>",
            sound: "endgame.wav"
        });

        updatePlayers();
        updateState();
        gameResultTimer = setTimeout(function () {
            gameResultTimer = null;
            changeGamePhase(GAMEPHASE.PRE_GAME);
        }, 10000);

        changeGamePhaseDone(GAMEPHASE.POST_GAME);
    }


    function indexOfPlayer(player) {
        if (!player) {
            return -1;
        }
        for (var i = 0; i < players.length; i++) {
            if (players[i] === player || players[i].sock === player || players[i].user === player) {
                return i;
            }
        }
        return -1;
    }


    function shouldEndGame() {
        var shouldEnd = false;
        if (getConnectedPlayersCount() < MIN_PLAYERS_COUNT) {
            shouldEnd = true;
        }
        for (var i = 0; i < players.length; i++) {
            if (players[i].score >= 20) {
                shouldEnd = true;
                break;
            }
        }
        return shouldEnd;
    }

    function _updatePlayers() {
        var playersInfo = [];
        for (var i = 0; i < players.length; i++) {
            var player = players[i];
            if (player.connected) {
                playersInfo.push({
                    name: player.name, user: player.user, state: player.state
                    , score: player.score, identity: player.identity
                });
            }
        }
        emit("update players", {players: playersInfo});
    }

    var updatePlayersTimer;

    function updatePlayers() {
        if (updatePlayersTimer) {
            return;
        }
        updatePlayersTimer = setTimeout(function () {
            _updatePlayers();
            updatePlayersTimer = null;
        }, 0);
    }

    function _updateState() {
        if (gamePhase == GAMEPHASE.POST_TURN) {
            emit("update state", {state: gamePhase, answer: wordToGuess, correctCount: getCorrectPlayersCount()});
            return;
        }
        if (gamePhase == GAMEPHASE.POST_GAME) {
            emit("update state", {state: gamePhase, scoreInfo: scoreSummary});
            return;
        }
        if (gamePhase == GAMEPHASE.PRE_GAME) {
            var readyPlayersCount = 0;
            for (var i = 0; i < players.length; i++) {
                if (players[i].ready) {
                    readyPlayersCount++;
                }
            }
            for (var i = 0; i < players.length; i++) {
                if (players[i].ready) {
                    players[i].sock.emit("update state", {
                        state: gamePhase,
                        message: "" + readyPlayersCount + "/" + players.length,
                        ready: true
                    });
                } else {
                    players[i].sock.emit("update state", {state: gamePhase, message: "准备"});
                }
            }
            return;
        }
        if (gamePhase == GAMEPHASE.PRE_TURN && waitingInputWord) {
            for (var i = 0; i < players.length; i++) {
                if (players[i].identity == "input") {
                    players[i].sock.emit("update state", {state: gamePhase, inputWord: 2});
                } else {
                    players[i].sock.emit("update state", {state: gamePhase, inputWord: 1});
                }
            }
            return;
        }
        if (gamePhase != GAMEPHASE.IN_TURN) {
            emit("update state", {state: gamePhase});
            return;
        }
        for (var i = 0; i < players.length; i++) {
            if (players[i].identity == "draw") {
                players[i].sock.emit("update state", {
                    state: gamePhase,
                    time: time,
                    message: descMessage,
                    turn: "draw"
                });
            } else {
                if (time > 40) {
                    players[i].sock.emit("update state", {state: gamePhase, time: time, message: "", turn: "guess"});
                } else {
                    players[i].sock.emit("update state", {
                        state: gamePhase,
                        time: time,
                        message: hintMessage,
                        turn: "guess"
                    });
                }
            }
        }
    }

    var updateStateTimer;

    function updateState() {
        if (updateStateTimer) {
            return;
        }
        updateStateTimer = setTimeout(function () {
            _updateState();
            updateStateTimer = null;
        }, 0);
    }

    function getGuessPlayersCount() {
        var count = 0;
        for (var i = 0; i < players.length; i++) {
            if (players[i].connected && players[i].identity == "guess") {
                count++;
            }
        }
        return count;
    }

    function getCorrectPlayersCount() {
        var count = 0;
        for (var i = 0; i < players.length; i++) {
            if (players[i].connected && players[i].identity == "guess" && players[i].state > 0) {
                count++;
            }
        }
        return count;
    }

    function getConnectedPlayersCount() {
        var count = 0;
        for (var i = 0; i < players.length; i++) {
            if (players[i].connected) {
                count++;
            }
        }
        return count;
    }

    this.playerEnterGame = function(user, socket) {
        msgQueue.push({type: 'connect', user: user, socket: socket});

        if (handleMsgTimer == null) {
            handleMsgTimer = setInterval(handleMsg, 20);
        }
    };

    function playerEnterGameImpl(user, socket) {
        var player;
        for (var i = 0; i < players.length; i++) {
            if (players[i].user == user) {
                player = players[i];
                player.sock = socket;
            }
        }

        if (!player) {
            player = {sock: socket, name: user, user: user, state: 0, score: 0, connected: true};
            players.push(player);
        }
        player.connected = true;
        if (gamePhase == GAMEPHASE.IN_TURN) {
            socket.emit("draw", {point: points, isarray: true})
        }

        updatePlayers();
        updateState();

        if (players.length == 1) {
            changeGamePhase(GAMEPHASE.PRE_GAME);
        }

        db.getUserInfo(user, function (err, info) {
            if (info.nickname) {
                player.name = info.nickname;
            }
            updatePlayers();
        });
    }

    this.playerQuitGame = function(socket) {
        msgQueue.push({type: "disconnect", socket: socket});
    };

    function playerQuitGameImpl(socket) {
        var index = indexOfPlayer(socket);
        if (index < 0) {
            return;
        }
        var player = players[index];
        if (gamePhase == GAMEPHASE.PRE_TURN || gamePhase == GAMEPHASE.IN_TURN || gamePhase == GAMEPHASE.POST_TURN) {
            player.connected = false;
        } else {
            players.splice(index, 1);
        }

        if (gamePhase == GAMEPHASE.PRE_GAME) {
            var already = true;
            for (var i = 0; i < players.length; i++) {
                if (!players[i].ready) {
                    already = false;
                    break;
                }
            }
            if (getConnectedPlayersCount() >= MIN_PLAYERS_COUNT && already) {
                changeGamePhase(GAMEPHASE.PRE_TURN);
            }
        } else if (gamePhase == GAMEPHASE.PRE_TURN) {
            if (getConnectedPlayersCount() < MIN_PLAYERS_COUNT) {
                changeGamePhase(GAMEPHASE.PRE_GAME);
            } else {
                if (drawingPlayer && drawingPlayer == player) {
                    setNewDrawingPlayer();
                    if (drawingPlayer == inputWordPlayer) {
                        setNewDrawingPlayer();
                    }
                } else if (inputWordPlayer && inputWordPlayer == player) {
                    useRandomWord();
                }
            }
        } else if (gamePhase == GAMEPHASE.IN_TURN) {
            if (drawingPlayer && drawingPlayer == player) {
                changeGamePhase(GAMEPHASE.POST_TURN);
            } else if (getGuessPlayersCount() == getCorrectPlayersCount()) {
                changeGamePhase(GAMEPHASE.POST_TURN);
            }
        }
        updatePlayers();
        updateState();
    }

    function handleWordInput(bundle) {
        var word = bundle.word;
        var hint = bundle.hint;
        descMessage = word + '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;hint:&nbsp;' + hint;
        hintMessage = hint;
        wordToGuess = word;
        waitingInputWord = false;
        changeGamePhase(GAMEPHASE.IN_TURN);
    }

    function useRandomWord() {
        var idx = Math.floor(Math.random() * wordlist.length);
        handleWordInput({word: wordlist[idx].word, hint: wordlist[idx].hint});
        if (inputWordPlayer) {
            inputWordPlayer.identity = "guess";
            inputWordPlayer = null;
            updatePlayers();
        }
    }

    this.onDraw = function(user, bundle) {
        if (gamePhase != GAMEPHASE.IN_TURN || !drawingPlayer || user != drawingPlayer.user) {
            return;
        }
        points[points.length] = bundle;
        emit("draw", { point: bundle });
    };

    this.onChat = function(user, bundle) {
        var message = bundle.message;
        var index = indexOfPlayer(user);
        if (index < 0) {
            return;
        }
        if (message.length > 100) {
            message = message.substr(0, 100);
        }
        message = utils.escape(message);

        if (gamePhase != GAMEPHASE.IN_TURN || message !== wordToGuess) {
            message = '<span style="color: blue">' + players[index].name + ": </span>" + message;
            emit("chat", { message: message });
        } else if (players[index].identity == "guess" && players[index].state == 0) {
            emit("chat", {message: '<span style="color: red">' + "Bingo!" + "&nbsp&nbsp" + players[index].name + "</span>"});

            if (noPlayerGotAnswer) {
                players[index].state = 2;
                players[index].score += 3;
                firstCorrectTime = new Date().getTime();
                if (time > 10) {
                    time = 10 + Math.floor((time - 10) / 2);
                    updateState();
                }
            } else {
                var nowtime = new Date().getTime();
                if (nowtime - firstCorrectTime < 5000) {
                    players[index].score += 2;
                } else {
                    players[index].score += 1;
                }
                players[index].state = 1;
            }
            noPlayerGotAnswer = false;

            var guessPlayersCount = getGuessPlayersCount();
            var correctPlayersCount = getCorrectPlayersCount();
            if (drawingPlayer) {
                var avg = 1.5;
                var cnt = Math.ceil(guessPlayersCount / 2);
                if (correctPlayersCount <= cnt) {
                    var rnd = Math.random();
                    if (rnd < avg / cnt) {
                        drawingPlayer.score += 1;
                    }
                }
            }
            if (inputWordPlayer) {
                var score = noPlayerGotAnswer ? 0 : (guessPlayersCount == correctPlayersCount ? 1 : 2);
                inputWordPlayer.score = inputWordPlayer.baseScore + score;
            }

            updatePlayers();

            if (correctPlayersCount == guessPlayersCount) {
                changeGamePhase(GAMEPHASE.POST_TURN);
            } else {
                emit("chat", {sound: "correct.wav"});
            }
        }
    };

    this.onRate = function(user, data) {
        if (gamePhase != GAMEPHASE.POST_TURN) {
            return;
        }
        var index = indexOfPlayer(user);
        if (index < 0 || players[index].rated) {
            return;
        }
        players[index].rated = true;
        var type = data.type;
        var posX = Math.round(Math.random() * 300 - 150);
        var posY = Math.round(Math.random() * 300 - 150);
        if (type == "like") {
            var num = Math.floor(Math.random() * 3);
            emit("rate", { posX: posX, posY: posY, type: "like", img: "flower" + num + ".png" });
            emit("chat", {message: '<span style="color: blue">' + players[index].name + '使用了</span>' + '<span style="color: red">鲜花</span>', sound: "flower.wav"});
        } else if (type == "dislike") {
            emit("rate", { posX: posX, posY: posY, type: "dislike", img: "slipper.png" });
            emit("chat", { message: '<span style="color: blue">' + players[index].name + '使用了</span>' + '<span style="color: red">拖鞋</span>', sound: "slipper.wav" });
        }
    };

    this.onSkip = function(user) {
        if (gamePhase != GAMEPHASE.IN_TURN || !drawingPlayer || drawingPlayer.user != user) {
            return;
        }
        changeGamePhase(GAMEPHASE.POST_TURN);
    };

    this.onReset = function(user) {
        if (gamePhase != GAMEPHASE.IN_TURN || !drawingPlayer || drawingPlayer.user != user) {
            return;
        }
        points = [];
        emit("reset");
    };

    this.onChangeName = function(user, bundle) {
        var name = bundle.name;
        var index = indexOfPlayer(user);
        if (index >= 0) {
            if (name.length > 100) {
                name = name.substr(0, 100);
            }
            name = utils.escape(name);
            players[index].name = name;
            updatePlayers();
            db.setUserInfo(players[index].user, { nickname: name });
        }
    };

    this.onReady = function(user) {
        if (gamePhase != GAMEPHASE.PRE_GAME) {
            return;
        }
        var index = indexOfPlayer(user);
        if (index < 0) {
            return;
        }
        if (!players[index].ready) {
            players[index].ready = true;
            updateState();

            var already = true;
            for (var i = 0; i < players.length; i++) {
                if (!players[i].ready) {
                    already = false;
                    break;
                }
            }
            if (getConnectedPlayersCount() >= MIN_PLAYERS_COUNT && already) {
                changeGamePhase(GAMEPHASE.PRE_TURN);
            }
        }
    };

    this.onInputWord = function(user, bundle) {
        if (!waitingInputWord) {
            return;
        }
        if (!inputWordPlayer || inputWordPlayer.user != user) {
            return;
        }
        if (!bundle) {
            useRandomWord();
            return;
        }
        handleWordInput(bundle);
    };

    this.getPlayersCount = function() {
        return players.length;
    };
    this.playerInRoom = function(user) {
        return indexOfPlayer(user) != -1;
    }
}

var rooms = [];
var roomname = ['zyf的摔跤教室','光哥的图书馆', 'yb的画猜小屋'];
for (var i = 0; i < 3; i++) {
    rooms.push(new Room());
}
var maxplayercntperroom = 10;

function roomIsFull(roomidx) {
    return rooms[roomidx].getPlayersCount() >= maxplayercntperroom;
}

function playerInRoomIndex(user) {
    for (var i = 0; i < rooms.length; i++) {
        var room = rooms[i];
        if (room.playerInRoom(user)) {
            return i;
        }
    }
    return -1;
}

function enterRoom(roomidx, user, socket) {
    for (var i = 0; i < rooms.length; i++) {
        var room = rooms[i];
        if (i != roomidx && room.playerInRoom(user)) {
            room.playerQuitGame(user);
        }
    }

    var room = rooms[roomidx];
    room.playerEnterGame(user, socket);

    var onGameCommand = function(func) {
        return function(data) {
            func(user, data);
        }
    };

    socket.on("draw", onGameCommand(room.onDraw));
    socket.on("chat", onGameCommand(room.onChat));
    socket.on("rate", onGameCommand(room.onRate));
    socket.on("skip", onGameCommand(room.onSkip));
    socket.on("reset", onGameCommand(room.onReset));
    socket.on("change name", onGameCommand(room.onChangeName));
    socket.on("ready", onGameCommand(room.onReady));
    socket.on("input word", onGameCommand(room.onInputWord));
}

function exitRoom(socket) {
    for (var i = 0; i < rooms.length; i++) {
        var room = rooms[i];
        if (room.playerInRoom(socket)) {
            room.playerQuitGame(socket);
        }
    }

    socket.removeAllListeners("draw");
    socket.removeAllListeners("chat");
    socket.removeAllListeners("rate");
    socket.removeAllListeners("skip");
    socket.removeAllListeners("reset");
    socket.removeAllListeners("change name");
    socket.removeAllListeners("ready");
    socket.removeAllListeners("input word");
}

io.on("connection", function (socket) {

    socket.emit("connected");

    function onLogin(bundle) {
        var name = bundle.name;
        var password = bundle.password;
        var roomidx = bundle.room;
        if (!(roomidx >= 0 && roomidx < rooms.length)) {
            roomidx = 0;
        }
        if (roomIsFull(roomidx)) {
            socket.emit("login result", { result: 0, reason: "room is full"});
            return;
        }
        if (name && password) {
            var user = { name: bundle.name, password: utils.md5(bundle.password) };
            db.authUser(user, function (err, suc) {
                if (suc) {
                    var sid = session.generateSessionId();
                    db.addSession(sid, {user: user.name}, function () {
                        socket.emit("login result", { result: 1, user: user.name, sid: sid });
                        enterRoom(roomidx, user.name, socket);
                    });
                } else {
                    socket.emit("login result", { result: 0, reason: "wrong username or password" });
                }
            });
        } else {
            socket.emit("login result", { result: 0, reason: "invalid username or password" });
        }
    }

    function onAutoLogin(bundle) {
        if (roomIsFull(0)) {
            socket.emit("auto login result", { result: 0 });
        }
        if (config['sidAsUser']) {
            var sid = session.generateSessionId();
            db.addUser({ name: sid, password: sid, nickname: sid });
            socket.emit("auto login result", { result: 1, user: sid });
            enterRoom(0, sid, socket);
            return;
        }

        if (!bundle.sid) {
            socket.emit("auto login result", { result: 0 });
            return;
        }
        var sid = bundle.sid;
        db.getUserWithSid(sid, function (err, user) {
            if (!user) {
                socket.emit("auto login result", { result: 0 });
            } else {
                socket.emit("auto login result", { result: 1, user: user });
                var roomidx = playerInRoomIndex(user);
                if (roomidx == -1) {
                    roomidx = 0;
                }
                enterRoom(roomidx, user, socket);
            }
        });
    }

    function onLogout(bundle) {
        db.deleteSession(bundle.sid, function(err) {
            exitRoom(socket);
            onRoomInfo();
        });
    }

    function onRegister(bundle) {
        var name = bundle.name;
        var password = bundle.password;
        if (!name || !password || !name.length || !password.length) {
            socket.emit("register result", { result: 0, reason: "invalid name or password"});
            return;
        }
        if (!/[a-zA-Z0-9]{2,30}$/.test(name) || !/[a-zA-Z0-9]{2,30}$/.test(password)) {
            socket.emit("register result", { result: 0, reason: "invalid format" });
        }
        var user = { name: name, password: utils.md5(password) };
        db.addUser(user, function (err, suc) {
            if (suc) {
                socket.emit("register result", { result: 1 });
            } else {
                socket.emit("register result", { result: 0 });
            }
        });
    }

    function onDisconnect() {
        exitRoom(socket);
    }

    function onRoomInfo() {
        var roomInfo = [];
        for (var i = 0; i < rooms.length; i++) {
            roomInfo.push({ playercnt: rooms[i].getPlayersCount(), name: roomname[i] });
        }
        socket.emit("room info", { rooms: roomInfo });
    }

    socket.on("login", onLogin);
    socket.on("auto login", onAutoLogin);
    socket.on("logout", onLogout);
    socket.on("register", onRegister);
    socket.on("disconnect", onDisconnect);
    socket.on("room info", onRoomInfo);
});


module.exports = io;
