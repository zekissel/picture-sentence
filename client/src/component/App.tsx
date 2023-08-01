import "../App.css";
import io from "socket.io-client";
import { useState } from "react";
import Lobby from "./Lobby";

const socket = io('https://localhost:7000', { autoConnect: false, timeout: 2500 });
//const socket = io('https://picturesentence.com/', { autoConnect: false, timeout: 2500 });

/*
window.addEventListener('touchmove', ev => {
  if (
    (ev.target as HTMLElement)!.nodeName !== 'CANVAS'
  ) {
    ev.preventDefault();
    ev.stopImmediatePropagation();
  };
}, { passive: false });

window.addEventListener('touchstart', ev => {
  if (
    (ev.target as HTMLElement)!.nodeName !== 'CANVAS' &&
    (ev.target as HTMLElement)!.nodeName !== 'INPUT' &&
    (ev.target as HTMLElement)!.nodeName !== 'BUTTON'
  ) {
    ev.preventDefault();
    ev.stopImmediatePropagation();
  };
}, { passive: false });
*/

interface MenuResponse { status: string; msg: string; code: number; }

interface ClientProps {
  setID: React.Dispatch<React.SetStateAction<number>>;
  user: string;
  setUser: React.Dispatch<React.SetStateAction<string>>;
  room: string;
  setRoom: React.Dispatch<React.SetStateAction<string>>;
  def: () => void;
  game: () => void;
}

function Join ({ setID, user, setUser, room, setRoom, def, game }: ClientProps) {

  const [err, setErr] = useState(``);
  const [auth, setAuth] = useState(false);
  const [pass, setPass] = useState(``);
  
  const enterGo = (e: any) => { if (e.key == `Enter`) joinGame(); }
  const joinGame = () => {
    if (user !== `` && room !== ``) {
      setErr(``);
      const payload = { room: room, user: user };
      socket.emit("join", payload, (res: MenuResponse) => {
        switch (res.status) {
          case `err`: setErr(res.msg); break;
          case `auth`: setAuth(true); break;
          case `ok`: setID(res.code); game(); break;
          default: break;
        }
      });
    }

    if (room === ``) {  setErr(`Enter the room key provided by your host`); }
    if (user === ``) {  setErr(`Enter a nickname that will be visible to other players`); }
  };

  const keyPass = (e: any) => { if (e.key == `Enter`) enterPass(); }
  const enterPass = () => {
    if (pass !== ``) {
      const payload = { room: room, user: user, pass: pass };
      socket.emit("auth", payload, (res: MenuResponse) => {
        switch (res.status) {
          case `err`: setErr(res.msg); setAuth(false); break;
          case `ok`: setID(res.code); game(); break;
          default: break;
        }
      });
    }
  }

  return (
    <menu className="join">
      <li><button onClick={def}>Back</button></li><br/>

      <fieldset>
        <legend>Connect</legend>
        <li>
          <input name="nickname" type="text" placeholder="Nickname" value={user} 
            onChange={(e) => { setUser(e.target.value); localStorage.setItem(`user`, e.target.value); }} />
        </li>
        <li>
          <input name="room" type="text" placeholder="Room Key" onKeyDown={enterGo} onChange={(e) => { setRoom(e.target.value); }} />
        </li>
        { !auth && <li><button onClick={joinGame}>Join</button></li> }
        { auth && <li><button onClick={ () => setAuth(false) }>Cancel</button></li> }
      </fieldset>

      { auth &&
        <fieldset>
          <legend>Confirm</legend>
          <li><input name="password" type="password" placeholder="Enter room password" onKeyDown={keyPass} onChange={(e) => { setPass(e.target.value); }} /></li>
          <li><button onClick={enterPass}>Enter</button></li>
        </fieldset>
      }

      <li><em>{ err }</em></li>
    </menu>
  )
}


function Host ({ setID, user, setUser, room, setRoom, def, game }: ClientProps) {
  
  const [err, setErr] = useState(``);

  const [playerMax, setPlayerMax] = useState(0);
  const [passKey, setPassKey] = useState(``);
  const [useChat, setUseChat] = useState(true);
  const [rounds, setRounds] = useState(7);

  const enterGo = (e: any) => { if (e.key == `Enter`) hostGame(); }
  const hostGame = () => {
    if (user !== `` && room !== ``) {
      setErr(``);
      const roomOpt = { max: playerMax ?? 0, pass: passKey ?? ``, chat: useChat, rounds: rounds ?? 7 }
      const payload = { room: room, user: user, settings: roomOpt };
      socket.emit("host", payload, (res: MenuResponse) => {
        switch (res.status) {
          case `err`: setErr(res.msg); break;
          case `ok`: setID(res.code); game(); break;
          default: break;
        }
      });
    }

    if (room === ``) {  setErr(`Create a unique room key to share with other players`); }
    if (user === ``) {  setErr(`Enter a nickname that will be visible to other players`); }
  };

  return (
    <menu className="host">
      <li><button onClick={def}>Back</button></li><br/>

      <fieldset>
        <legend>User</legend>
        <li>
          <input name="nickname" type="text" placeholder="Nickname" value={user} 
            onChange={(e) => { setUser(e.target.value); localStorage.setItem(`user`, e.target.value); }} />
        </li>
      </fieldset>

      <fieldset>
        <legend>Lobby</legend>
        <li>
          <input name="room" type="text" placeholder="Unique key (required)" onKeyDown={enterGo} onChange={(e) => { setRoom(e.target.value); }} />
        </li>
        <li>
          <input name="password" type="text" placeholder="Password (optional)" onChange={(e) => { setPassKey(e.target.value); }} />
        </li>
        <li>
          <input name="capacity" type="number" placeholder="Player capacity (optional)" onChange={(e) => { setPlayerMax(Math.abs(Math.round(Number(e.target.value)))); }} />
        </li>
      </fieldset>
      
      <fieldset>
        <legend>Game</legend>
        <li>
          <input name="rounds" type="number" placeholder="# Rounds (default 7)" onChange={(e) => { setRounds(Math.abs(Math.round(Number(e.target.value)))); }} />
        </li>
        <li>
          <label htmlFor="usechat">Chat: </label>
          <select id="usechat" onChange={(e: any) => { setUseChat(e.target.value === 0) }}>
            <option value={0} >Enabled</option>
            <option value={1}>Disabled</option>
          </select>
        </li>
      </fieldset><br/>

      <li><button onClick={hostGame}>Host</button></li>

      <li><em>{ err }</em></li>
    </menu>
  )
}

export default function App() {
  enum MenuMode { Default, Host, Join, Game }

  const [err, setErr] = useState(``);
  const [id, setID] = useState(-1);
  const [user, setUser] = useState(localStorage.getItem(`user`) || ``);
  const [room, setRoom] = useState(``);

  const connectSocket = () => { if (!socket.connected) socket.connect(); }
  const disconnectSocket = () => { if (socket.connected) socket.disconnect(); }

  const [toggleMenu, setMenuTog] = useState(MenuMode.Default);
  const host = () => { setMenuTog(MenuMode.Host); connectSocket(); setErr(``); }
  const join = () => { setMenuTog(MenuMode.Join); connectSocket(); setErr(``); }
  const def = () => { setMenuTog(MenuMode.Default); setRoom(``); setID(-1); disconnectSocket(); }
  const game = () => { setMenuTog(MenuMode.Game); }

  /* /
  socket.on("connect", () => {
    setTimeout(() => {
      if (socket.io.engine) socket.io.engine.close();
    }, 4000);
  });/**/

  return (
    <div className="App">
      <h1>Picture Sentence</h1>

        { toggleMenu === MenuMode.Default && 
          <menu>
            <li><button className='menu' onClick={host}>Host Game</button></li>
            <li><button className='menu' onClick={join}>Join Game</button></li>
          </menu>
        }
        { toggleMenu === MenuMode.Host &&

          <Host setID={setID} user={user} setUser={setUser} room={room} setRoom={setRoom} def={def} game={game} />
        }
        { toggleMenu === MenuMode.Join &&

          <Join setID={setID} user={user} setUser={setUser} room={room} setRoom={setRoom} def={def} game={game}/>
        }
        { toggleMenu === MenuMode.Game &&

          <div id="game"><Lobby socket={socket} id={id} user={user} room={room} def={def} setERR={setErr} /></div>
        }
        { err !== `` &&
          <div className="err">{ err }</div>
        }

    </div>
  );
}