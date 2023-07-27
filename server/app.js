var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var express = require("express");
var _a = require("socket.io"), Server = _a.Server, Socket = _a.Socket;
/* DEVELOPMENT /
const http = require('http');
const cors = require("cors");
/**/
/* PRODUCTION */
var path = require("path");
var fs = require("fs");
var https = require("https");
/**/
/* --------------- SERVER STATICS */
var CLIENT_PORT = 5173;
var SOCKET_PORT = 7000;
var app = express();
/* DEVELOPMENT /
app.use(cors());
const standardServer = http.createServer(app);
/**/
/* PRODUCTION */
var options = {
    key: fs.readFileSync(process.env.SSL_PDT_KEY || '/etc/nginx/ssl/privkey.pem'),
    cert: fs.readFileSync(process.env.SSL_PDT_CRT || '/etc/nginx/ssl/fullchain.pem'),
    ca: fs.readFileSync(process.env.SSL_PDT_CA || '/etc/nginx/ssl/chain.pem'),
    requestCert: true,
    rejectUnauthorized: false
};
var secureServer = https.createServer(options, app);
app.use(express.static(path.join(__dirname + '/dist')));
app.get("/*", function (req, res) {
    res.sendFile(path.join(__dirname + '/dist/index.html'), function (err) {
        if (err)
            res.status(500).send(err);
    });
});
/**/
var io = new Server(secureServer, {
    methods: ["GET", "POST"]
});
/* --------------- GAME VARIABLES */
var SETTINGS = new Map(); /* created by host, persistent until host leaves */
var LOBBY = new Map(); /* "              ,   ", tracks players */
var GAME = new Map(); /* created after pregame, destroyed before postgame, tracks answers */
var POST = new Map(); /* active for post game, tracks likes for answers */
/* --------------- HELPER FUNCTIONS */
var isActive = function (room) {
    var active = GAME.get(room);
    return active !== undefined;
};
var createRoom = function (room, settings) {
    SETTINGS.set(room, settings);
    LOBBY.set(room, []);
    GAME["delete"](room);
    POST["delete"](room);
};
var notifyLobby = function (socket, node) {
    var _a;
    var stat = "ok";
    if (node.code == -1)
        stat = "kick";
    if (node.code == 2)
        stat = "start";
    var lobbyLoad = {
        status: stat,
        msg: node.msg,
        author: node.author,
        actors: LOBBY.get(node.room),
        disabled: ((_a = SETTINGS.get(node.room)) === null || _a === void 0 ? void 0 : _a.chat) ? undefined : true
    };
    socket.to(node.room).emit('lobby_poll', lobbyLoad);
    if (node.code > 0)
        socket.emit('lobby_poll', lobbyLoad);
};
var playerJoin = function (socket, room, user, serverReply) {
    var actors = LOBBY.get(room);
    var a = { socket: socket.id, id: actors.length, user: user, ready: false };
    actors.push(a);
    LOBBY.set(room, actors);
    socket.join(room);
    var ID = (actors ? actors.length - 1 : 0);
    console.log("User with ID: ".concat(socket.id, " has joined room ").concat(room));
    var payload = { status: "ok", msg: "Joining room ".concat(room), code: ID };
    serverReply(payload);
    /* refresh entire lobby after player joins */
    var node = { room: room, author: "", msg: "".concat(user, " has joined the room"), code: 1 };
    notifyLobby(socket, node);
};
var playerLeave = function (socket, key, id, user) {
    if (id === 0) { // host left; close lobby
        SETTINGS["delete"](key);
        GAME["delete"](key);
        LOBBY["delete"](key);
        var node_1 = { room: key, msg: "Lobby closed by host", author: "server", code: -1 };
        notifyLobby(socket, node_1);
        socket.leave(key);
        return;
    }
    var actors = LOBBY.get(key);
    actors = actors === null || actors === void 0 ? void 0 : actors.filter(function (a) {
        return a.id !== id;
    });
    if (actors)
        LOBBY.set(key, actors);
    var papers = GAME.get(key);
    papers = papers === null || papers === void 0 ? void 0 : papers.filter(function (p) {
        return p.id !== id;
    });
    if (papers)
        GAME.set(key, papers);
    var node = { room: key, msg: "".concat(user, " has left the room"), author: "", code: 0 };
    notifyLobby(socket, node);
    socket.leave(key);
};
var playerExit = function (socket) {
    var lobbies = LOBBY.entries();
    Array.from(lobbies).forEach(function (lobby) {
        lobby[1].forEach(function (actor) {
            if (actor.socket == socket.id) {
                playerLeave(socket, lobby[0], actor.id, actor.user);
                return;
            }
        });
    });
};
var determineStart = function (socket, room, actors) {
    var ready = true;
    actors.forEach(function (a) { if (!a.ready)
        ready = false; });
    if (ready) {
        actors.forEach(function (v) { v.ready = false; });
        LOBBY.set(room, actors);
        GAME.set(room, []);
        var node = { room: room, msg: "", author: "server", code: 2 };
        notifyLobby(socket, node);
    }
};
/* --------------- WEBSOCKET ROUTES */
io.on('connection', function (socket) {
    console.log("User Connected: ".concat(socket.id));
    /* CREATE ROOM */
    socket.on('host', function (client, serverReply) {
        if (LOBBY.has(client.room)) {
            var payload = { status: "err", msg: "Game key is already in use!", code: -1 };
            serverReply(payload);
            return;
        }
        /*
        if (filter.isProfane(client.room)) {
          const payload = { status: `err`, msg: `You cannot use this as your room key`, code: -1  }
          serverReply(payload); return;
        }*/
        createRoom(client.room, client.settings);
        playerJoin(socket, client.room, client.user, serverReply);
    });
    /* JOIN PRE-EXISTING ROOM */
    socket.on('join', function (client, serverReply) {
        if (!LOBBY.has(client.room)) {
            var payload = { status: "err", msg: "Invalid game key!", code: -1 };
            serverReply(payload);
            return;
        }
        if (isActive(client.room)) {
            var payload = { status: "err", msg: "Game has already started!", code: -1 };
            serverReply(payload);
            return;
        }
        var max = SETTINGS.get(client.room).max;
        if (max > 0 && max <= LOBBY.get(client.room).length) {
            var payload = { status: "err", msg: "This lobby has reached full capacity!", code: -1 };
            serverReply(payload);
            return;
        }
        if (SETTINGS.get(client.room).pass !== "") {
            var payload = { status: "auth", msg: "Enter room passkey", code: -1 };
            serverReply(payload);
            return;
        }
        playerJoin(socket, client.room, client.user, serverReply);
    });
    socket.on("auth", function (client, serverReply) {
        if (!LOBBY.has(client.room)) {
            var payload = { status: "err", msg: "Invalid game key!", code: -1 };
            serverReply(payload);
            return;
        }
        if (SETTINGS.get(client.room).pass !== client.pass) {
            var payload = { status: "err", msg: "Wrong password!", code: -1 };
            serverReply(payload);
            return;
        }
        playerJoin(socket, client.room, client.user, serverReply);
    });
    socket.on("signal_adm", function (client) {
        if (client.code < 0) {
            var payload_1 = { status: "kick", msg: "Kicked from room by host", code: -1 };
            var lobby = LOBBY.get(client.room);
            lobby === null || lobby === void 0 ? void 0 : lobby.forEach(function (a) {
                if (a.socket == client.kick) {
                    socket.to(a.socket).emit("lobby_poll", payload_1);
                    return;
                }
            });
        }
    });
    /* EXIT ROOM */
    socket.on('exit_room', function (client) {
        playerLeave(socket, client.room, client.id, client.user);
        console.log("User ".concat(socket.id, " exited room ").concat(client.room));
    });
    /* ready up players and send messages */
    socket.on('signal_lobby', function (client, serverReply) {
        var actors = LOBBY.get(client.room);
        if (!actors) {
            var payload_2 = { status: "err", msg: "Room not found!", author: "server", actors: [], code: -1 };
            serverReply(payload_2);
            return;
        }
        actors.map(function (v) {
            if (v.socket === socket.id)
                v.ready = client.ready;
            return v;
        });
        LOBBY.set(client.room, actors);
        var payload = { status: "ok", msg: "", author: "server", actors: actors, code: client.ready ? 1 : -1 };
        serverReply(payload);
        var node = { room: client.room, msg: client.msg, author: client.user, code: 0 };
        notifyLobby(socket, node);
        /* determine when to start game */
        if (!isActive(client.room))
            determineStart(socket, client.room, actors);
    });
    /* game control logic: handle players submitting answers and round progression */
    socket.on('signal_game', function (client, serverReply) {
        var _a;
        var papers = (_a = GAME.get(client.room)) !== null && _a !== void 0 ? _a : [];
        if (client.round === 1)
            papers[client.id] = { id: client.id, answers: [client.msg] };
        else {
            var append_ans = papers[client.id].answers;
            append_ans = __spreadArray(__spreadArray([], append_ans, true), [client.msg], false);
            papers[client.id] = { id: client.id, answers: append_ans };
        }
        GAME.set(client.room, papers);
        var done = true;
        var actors = LOBBY.get(client.room);
        actors.map(function (a) {
            if (a.socket === socket.id)
                a.ready = true;
            if (!a.ready)
                done = false;
            return a;
        });
        LOBBY.set(client.room, actors);
        var payload = { ready: true, msg: [], code: client.round, actors: actors };
        serverReply(payload);
        var gameLoad = { ready: undefined, msg: [], code: client.round, actors: actors };
        socket.to(client.room).emit("game_poll", gameLoad);
        if (done && client.round < SETTINGS.get(client.room).rounds) {
            actors.map(function (a) { a.ready = false; return a; });
            LOBBY.set(client.room, actors);
            papers.unshift(papers.pop());
            var gameLoad_1 = { ready: false, msg: papers, code: client.round + 1, actors: actors };
            socket.to(client.room).emit('game_poll', gameLoad_1);
            socket.emit('game_poll', gameLoad_1);
        }
        else if (done) {
            /* end game */
            actors.map(function (a) { a.ready = false; return a; });
            LOBBY.set(client.room, actors);
            var gameLoad_2 = { ready: false, msg: papers, code: -1, actors: actors };
            socket.to(client.room).emit('game_poll', gameLoad_2);
            socket.emit('game_poll', gameLoad_2);
            var votes = new Array(papers.length).fill(new Array(papers[0].answers.length).fill(0));
            POST.set(client.room, votes);
            GAME["delete"](client.room);
        }
    });
    socket.on('signal_post', function (client) {
        var votes = POST.get(client.room);
        if (!votes)
            return;
        if (client.val) {
            votes[client.paper][client.ind] += 1;
        }
        else {
            votes[client.paper][client.ind] -= 1;
        }
        POST.set(client.room, votes);
        var postLoad = { paper: client.paper, votes: votes[client.paper] };
        socket.to(client.room).emit('post_poll', postLoad);
    });
    // CLOSE CONNECTION FROM CLIENT TO SERVER */
    socket.on('disconnect', function () {
        playerExit(socket);
        console.log("User disconnected: ".concat(socket.id));
    });
});
secureServer.listen(SOCKET_PORT, function () {
    console.log("SERVER RUNNING ON PORT: ".concat(SOCKET_PORT));
});
