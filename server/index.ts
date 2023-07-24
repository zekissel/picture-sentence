const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server, Socket } = require("socket.io");

/* --------------- SERVER STATICS */
const app = express(); app.use(cors());
const server = http.createServer(app);
const CLIENT_PORT = 5173;
const SOCKET_PORT = 5174;
const io = new Server(server, {
  cors: {
    origin: `http://localhost:${CLIENT_PORT}`,
    methods: ["GET", "POST"],
  },
});

/* --------------- TYPE ANNOTATIONS */
type Key = string;
interface Actor {
  socket: string;
  id: number;
  user: string;
  ready: boolean;
}
interface Paper {
  id: number;
  answers: string[];
}

interface GameResponse { ready: boolean; msg: Paper[]; code: number, actors: Actor[] }
interface LobbyResponse { status: string; msg: string; author: string; actors: Actor[], code: number }
interface MenuResponse { status: string; msg: string; code: number; }
type Callback = (r: MenuResponse | LobbyResponse | GameResponse) => void;

interface RoomSettings { max: number, pass: string, chat: boolean, rounds: number }
interface InboundMenu { room: string; user: string; settings: RoomSettings | undefined; pass: string | undefined }
interface InboundLobby { room: string; user: string; id: number; ready: boolean; msg: string; }
interface InboundGame { room: string; id: number; msg: string; round: number; }

/* --------------- GAME VARIABLES */

const SETTINGS = new Map<Key, RoomSettings>();
const LOBBY = new Map<Key, Actor[]>();
const GAME = new Map<Key, Paper[]>();


/* --------------- HELPER FUNCTIONS */
const isActive = (room: string) => {
  const active = GAME.get(room);
  return active !== undefined;
}

const createRoom = (room: string, settings: RoomSettings) => {
  SETTINGS.set(room, settings);
  LOBBY.set(room, []);
  GAME.delete(room);
}

interface msgNode { room: string, author: string, msg: string, code: number }
const notifyLobby = (socket: typeof Socket, node: msgNode) => {
  let stat = `ok`;
  if (node.code == -1) stat = `kick`;
  if (node.code == 2) stat = `start`;
  const lobbyLoad = {
    status: stat,
    msg: node.msg, 
    author: node.author, 
    actors: LOBBY.get(node.room)!,
    disabled: SETTINGS.get(node.room)?.chat ? undefined : true,
  };

  socket.to(node.room).emit('lobby_poll', lobbyLoad);
  if (node.code > 0) socket.emit('lobby_poll', lobbyLoad);
}

const playerJoin = (socket: typeof Socket, room: string, user: string, serverReply: Callback) => {

  const actors = LOBBY.get(room)!;
  const a = { socket: socket.id, id: actors.length, user: user, ready: false }
  actors.push(a); LOBBY.set(room, actors);

  socket.join(room);

  const ID = (actors ? actors.length - 1 : 0);
  console.log(`User with ID: ${socket.id} has joined room ${room}`);
  
  const payload = { status: `ok`, msg: `Joining room ${room}`, code: ID };
  serverReply(payload);

  /* refresh entire lobby after player joins */
  const node = { room: room, author: ``, msg: `${user} has joined the room`, code: 1 };
  notifyLobby(socket, node);

}

const playerExit = (socket: typeof Socket) => {

  const lobbies = LOBBY.entries();
  let found = false;
  let key: string = ``;
  let actors: Actor[] = [];
  let a: Actor;

  for (let room of lobbies) {
    if (found) break;

    room[1] = room[1].filter((actor) => {
      if (actor.socket === socket.id) {
        found = true;
        key = room[0];
        actors = room[1];
        a = actor;
        
        let papers = GAME.get(room[0]);
        papers = papers?.filter((p) => { return p.id !== actor.id; });
        if (papers) GAME.set(room[0], papers);
      }
      return actor.socket !== socket.id;
    });
    LOBBY.set(room[0], room[1]);
  }

  if (found && LOBBY.get(key)!.length > 0 && a!.id != 0) {

    const node = { room: key, msg: `${a!.user} has left the room`, author: ``, code: 0 };
    notifyLobby(socket, node);

  } else {
    
    SETTINGS.delete(key);
    GAME.delete(key);
    LOBBY.delete(key);
    
    const node = { room: key, msg: `Lobby closed by host`, author: `server`, code: -1 };
    notifyLobby(socket, node);
  }

  socket.leave(key);

}

const determineStart = (socket: typeof Socket, room: string, actors: Actor[] ) => {

  let ready = true;
  actors.forEach((a) => { if (!a.ready) ready = false; });
  if (ready) {
    actors.forEach((v) => { v.ready = false; });
    LOBBY.set(room, actors);
    GAME.set(room, []);

    const node = { room: room, msg: ``, author: `server`, code: 2 };
    notifyLobby(socket, node);
  }
}


/* --------------- WEBSOCKET ROUTES */
io.on('connection', (socket: typeof Socket) => {
  console.log(`User Connected: ${socket.id}`);

  /* CREATE ROOM */
  socket.on('host', (client: InboundMenu, serverReply: Callback) => {

    if (LOBBY.has(client.room)) {
      const payload = { status: `err`, msg: `Game key is already in use!`, code: -1  }
      serverReply(payload); return;
    }
    /*
    if (filter.isProfane(client.room)) {
      const payload = { status: `err`, msg: `You cannot use this as your room key`, code: -1  }
      serverReply(payload); return;
    }*/

    createRoom(client.room, client.settings!);
    
    playerJoin(socket, client.room, client.user, serverReply);

  });

  /* JOIN PRE-EXISTING ROOM */
  socket.on('join', (client: InboundMenu, serverReply: Callback) => {

    if (!LOBBY.has(client.room)) {
      const payload = { status: `err`, msg: `Invalid game key!`, code: -1  }
      serverReply(payload); return;
    }
    if (isActive(client.room)) {
      const payload = { status: `err`, msg: `Game has already started!`, code: -1  }
      serverReply(payload); return;
    }
    const max = SETTINGS.get(client.room)!.max;
    if (max > 0 && max <= LOBBY.get(client.room)!.length) {
      const payload = { status: `err`, msg: `This lobby has reached full capacity!`, code: -1  }
      serverReply(payload); return;
    }
    if (SETTINGS.get(client.room)!.pass !== ``) {
      const payload = { status: `auth`, msg: `Enter room passkey`, code: -1  }
      serverReply(payload); return;
    }

    playerJoin(socket, client.room, client.user, serverReply);

  });

  socket.on(`auth`, (client: InboundMenu, serverReply: Callback) => {

    if (!LOBBY.has(client.room)) {
      const payload = { status: `err`, msg: `Invalid game key!`, code: -1  }
      serverReply(payload); return;
    }
    if (SETTINGS.get(client.room)!.pass !== client.pass) {
      const payload = { status: `err`, msg: `Wrong password!`, code: -1  }
      serverReply(payload); return;
    }

    playerJoin(socket, client.room, client.user, serverReply);

  });

  interface InboundHost { room: string; id: number; kick: number; code: number; }
  socket.on(`signal_adm`, (client: InboundHost) => {

    if (client.code < 0) {
    
      const payload = { status: `kick`, msg: `Kicked from room by host`, code: -1 };
      const lobby = LOBBY.get(client.room);
      lobby?.forEach((a) => {
        if (a.id == client.kick) {
          socket.to(a.socket).emit(`lobby_poll`, payload);
          return;
        }
      });
    }

  })

  /* EXIT ROOM */
  socket.on('exit_room', (client: InboundMenu) => {
    
    playerExit(socket);
    console.log(`User ${socket.id} exited room ${client.room}`);

  });

  /* ready up players and send messages */
  socket.on('signal_lobby', (client: InboundLobby, serverReply: Callback) => {
    
    const actors = LOBBY.get(client.room);
    if (!actors) {
      const payload = { status: `err`, msg: `Room not found!`, author: `server`, actors: [], code: -1 }
      serverReply(payload); return;
    }

    actors.map((v) => {
      if (v.socket === socket.id) v.ready = client.ready;
      return v;
    });
    LOBBY.set(client.room, actors);

    const payload = { status: `ok`, msg: ``, author: `server`, actors: actors, code: client.ready ? 1 : -1 };
    serverReply(payload);

    const node = { room: client.room, msg: client.msg, author: client.user, code: 0 };
    notifyLobby(socket, node);

    /* determine when to start game */
    if (!isActive(client.room)) determineStart(socket, client.room, actors);

  });


  /* game control logic: handle players submitting answers and round progression */
  socket.on('signal_game', (client: InboundGame, serverReply: Callback) => {

    const papers: Paper[] = GAME.get(client.room) ?? [];
    if (client.round === 1) {

      papers[client.id] = { id: client.id, answers: [client.msg] };
      
    } else {

      let append_ans = papers[client.id].answers;
      append_ans = [...append_ans, client.msg];
      papers[client.id] = { id: client.id, answers: append_ans };
      
    }
    GAME.set(client.room, papers);

    let done = true;
    const actors = LOBBY.get(client.room)!;
    actors.map((a) => { 
      if (a.socket === socket.id) a.ready = true; 
      if (!a.ready) done = false;
      return a; 
    });
    LOBBY.set(client.room, actors);

    const payload = { ready: true, msg: [], code: client.round, actors: actors }
    serverReply(payload);
    const gameLoad = { ready: undefined, msg: [], code: client.round, actors: actors }
    socket.to(client.room).emit(`game_poll`, gameLoad);

    if (done && client.round < SETTINGS.get(client.room)!.rounds) {

      actors.map((a) => { a.ready = false; return a; });
      LOBBY.set(client.room, actors);

      papers.unshift(papers.pop()!);

      const gameLoad = { ready: false, msg: papers, code: client.round + 1, actors: actors };
      socket.to(client.room).emit('game_poll', gameLoad);
      socket.emit('game_poll', gameLoad);

    } else if (done) {
      /* end game */

      actors.map((a) => { a.ready = false; return a; });
      LOBBY.set(client.room, actors);

      const gameLoad = { ready: false, msg: papers, code: -1, actors: actors};
      socket.to(client.room).emit('game_poll', gameLoad);
      socket.emit('game_poll', gameLoad);

      GAME.delete(client.room);
    }

  });


  // CLOSE CONNECTION FROM CLIENT TO SERVER */
  socket.on('disconnect', () => {

    playerExit(socket);
    console.log(`User disconnected: ${socket.id}`);
    
  });

});

server.listen(SOCKET_PORT, () => {
  console.log(`SERVER RUNNING ON PORT: ${SOCKET_PORT}`);
});