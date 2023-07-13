import e from "cors";

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
const GAME = new Map<Key, Paper[]>();
const active = new Map<Key, boolean>();
const waiting = new Map<Key, number>();

type Key = string;
interface Player {
  id: number;
  user: string;
  ready: boolean;
}
interface Paper {
  id: number;
  answers: string[];
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
      const p = { id: 0, user: client.user, ready: false }
      LOBBY.set(client.room, [p])
      active.set(client.room, false);

      socket.join(client.room);
      console.log(`User with ID: ${socket.id} is now hosting room: ${client.room}`);

      const payload = { err: false, msg: 'Hosting game...', code: `join`, id: 0 };
      socket.emit('receive_err', payload);
    }
  });

  /* JOIN PRE-EXISTING ROOM */
  socket.on('join_room', (client: any) => {
    const players = LOBBY.get(client.room);
    if (players !== undefined && !active.get(client.room)) {
      /* room exists, add user to list */
      const p = { id: players.length, user: client.user, ready: false }
      players.push(p); LOBBY.set(client.room, players);

      socket.join(client.room);
      console.log(`User with ID: ${socket.id} joined room: ${client.room}`);

      const payload = { err: false, msg: 'Joining game...', code: `join`, id: players.length - 1 };
      socket.emit('receive_err', payload);

      /* refresh entire lobby after player joins */
      const lobbyLoad = { err: false, msg: `${client.user} has joined the room`, author: `server`, code: `lobby`, players: players };
      socket.to(client.room).emit('lobby_poll', lobbyLoad);
      socket.emit('lobby_poll', lobbyLoad);
    } else {
      /* return error payload */
      const payload = { err: true, msg: 'Invalid game key!', code: `notfound` };
      if (active.get(client.room)) payload.msg = `Game has already started!`;
      socket.emit('receive_err', payload);
    }
  });

  /* EXIT ROOM */
  socket.on('leave_room', (client: any) => {
    /* remove user from player list, delete room if empty */
    let players = LOBBY.get(client.room);
    if (players !== undefined) {

      players = players.filter((p) => {
        return p.id !== client.id;
      });
      
      if (players.length > 0) {
        LOBBY.set(client.room, players);
        if (active.get(client.room)) {
          waiting.set(client.room, waiting.get(client.room)! - 1);
          /* resolve mistmatch of Paper[] with Player[] */
          // either delete paper entries or change client to accept prevAnswer[], then answer multiple in one round

        }

      } else {
        LOBBY.delete(client.room);
        GAME.delete(client.room);
        active.delete(client.room);
        waiting.delete(client.room);
        console.log(`Room ${client.room} returned to available keys.`);
      }
    }
    /* return payload for frontend */
    const payload = { err: false, msg: 'Exiting game', code: `exit` };
    socket.emit('lobby_err', payload);
  });

  /* PLAYER READY FOR GAME */
  socket.on('signal_lobby', (client: any) => {
    let players = LOBBY.get(client.room);
    if (players !== undefined) {
      players.map((v) => { 
        if (v.id === client.id) v.ready = client.ready;
        return v;
      });
      LOBBY.set(client.room, players);

      /* return payload for frontend */
      const payload = { err: false, msg: 'Ready\'d Up', code: `ready`, ready: client.ready };
      socket.emit('lobby_err', payload);
      
      const lobbyLoad = { err: false, msg: client.msg, author: client.user, code: `lobby`, players: players };
      socket.to(client.room).emit('lobby_poll', lobbyLoad);
      
      let ready = active.get(client.room);
      if (!ready) { 
        ready = true; 
        players.forEach((p) => { if (!p.ready) ready = false; }); 
        /* start game if everyone is ready */
        if (ready) {
          active.set(client.room, true);
          waiting.set(client.room, players.length)
          const lobbyLoad = { err: false, msg: ``, author: `server`, code: `start`, players: players };
          socket.to(client.room).emit(`lobby_poll`, lobbyLoad);
          socket.emit(`lobby_poll`, lobbyLoad);
        }
      }
    } else {
      /* return payload for frontend: error */
      const payload = { err: true, msg: `Room not found!`, code: `notfound` };
      socket.emit('lobby_err', payload);
    }
  });

  socket.on('signal_game', (client: any) => {
    const papers: Paper[] = GAME.get(client.room) ?? [];

    if (client.round === 1) {

      papers[client.id] = { id: client.id, answers: [client.msg] };
      
    } else {

      let append_ans = papers[client.id].answers;
      append_ans = [...append_ans, client.msg];
      papers[client.id] = { id: client.id, answers: append_ans };
      
    }
    /* save edit to paper */
    GAME.set(client.room, papers);

    /* waiting for one less player to answer */
    let waitnum: number = waiting.get(client.room)! - 1;
    waiting.set(client.room, waitnum);

    let gameLoad = { round: client.round, prevAns: ``, idle: true };
    socket.emit('game_poll', gameLoad);

    if (waitnum === 0 && client.round < 7) {
      papers.unshift(papers.pop()!);
      
      /* distribute previous answers and progress rounds */
      let gameLoad = { round: client.round + 1, prevAns: papers, idle: false };
      socket.to(client.room).emit('game_poll', gameLoad);
      socket.emit('game_poll', gameLoad);

      /* reset waiting number */
      const numP = LOBBY.get(client.room)!.length;
      waiting.set(client.room, numP)
    } else if (waitnum === 0) {
      /* last round end */

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