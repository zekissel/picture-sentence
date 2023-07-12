const express = require("express");
const app = express();
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
app.use(cors());

const server = http.createServer(app);
const SOCKETPORT = 5174;

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const LOBBY = new Map<Key, Player[]>();
type Key = string;
interface Player {
  user: string;
  ready: boolean;
}


io.on('connection', (socket: any) => {
  console.log(`User Connected: ${socket.id}`);

  /* CREATE ROOM */
  socket.on('host_room', (client: any) => {
    /* return err: already in use */
    if (LOBBY.has(client.room)) {
      const payload = { err: true, msg: 'Game key is already in use!', code: `inuse`};
      socket.emit('receive_err', payload);
    }
    else {
      /* servers keeps track of players in room */
      const p = { user: client.user, ready: false }
      LOBBY.set(client.room, [p])

      socket.join(client.room);
      console.log(`User with ID: ${socket.id} is now hosting room: ${client.room}`);

      const payload = { err: false, msg: 'Hosting game...', code: `join` };
      socket.emit('receive_err', payload);
    }
  });

  /* JOIN PRE-EXISTING ROOM */
  socket.on('join_room', (client: any) => {
    const players = LOBBY.get(client.room);
    if (players !== undefined) {
      /* room exists, add user to list */
      const p = { user: client.user, ready: false }
      players.push(p); LOBBY.set(client.room, players);

      socket.join(client.room);
      console.log(`User with ID: ${socket.id} joined room: ${client.room}`);

      const payload = { err: false, msg: 'Joining game...', code: `join` };
      socket.emit('receive_err', payload);

      /* refresh entire lobby after player joins */
      const lobbyLoad = { err: false, msg: `${client.user} has joined the room`, author: `server`, code: `lobby`, players: players };
      socket.to(client.room).emit('lobby_poll', lobbyLoad);
      socket.emit('lobby_poll', lobbyLoad);
    } else {
      /* return error payload */
      const payload = { err: true, msg: 'Invalid game key!', code: `notfound` };
      socket.emit('receive_err', payload);
    }
  });

  /* EXIT ROOM */
  socket.on('leave_room', (client: any) => {
    /* remove user from player list, delete room if empty */
    let players = LOBBY.get(client.room);
    if (players !== undefined) {

      players = players.filter((p) => {
        return p.user !== client.user;
      });
      
      if (players.length > 0) LOBBY.set(client.room, players);
      else {
        LOBBY.delete(client.room);
        console.log(`Room ${client.room} returned to available keys.`);
      }
    }
    /* return payload for frontend */
    const payload = { err: false, msg: 'Exiting game', code: `exit` };
    socket.emit('receive_err', payload);
  });

  /* PLAYER READY FOR GAME */
  socket.on('signal_lobby', (client: any) => {
    let players = LOBBY.get(client.room);
    if (players !== undefined) {
      players.map((v) => { 
        if (v.user === client.user) v.ready = client.ready;
        return v;
      });
      LOBBY.set(client.room, players);
      
      /* return payload for frontend */
      const lobbyLoad = { err: false, msg: client.msg, author: client.user, code: `lobby`, players: players };
      socket.to(client.room).emit('lobby_poll', lobbyLoad);
      const payload = { err: false, msg: 'Ready\'d Up', code: `ready`, ready: client.ready };
      socket.emit('receive_err', payload);
    } else {
      /* return payload for frontend: error */
      const payload = { err: true, msg: `Room not found!`, code: `notfound` };
      socket.emit('receive_err', payload);
    }
  });


  /* CLOSE CONNECTION FROM CLIENT TO SERVER */
  socket.on('disconnect', () => {
    console.log(`User Disconnected`, socket.id);
  });
});

server.listen(SOCKETPORT, () => {
  console.log(`SERVER RUNNING ON PORT: ${SOCKETPORT}`);
});