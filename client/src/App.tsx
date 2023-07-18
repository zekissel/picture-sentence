import "./App.css";
import io from "socket.io-client";
import { useState } from "react";
import Lobby from "./Lobby";

const socket = io("http://localhost:5174");

interface Response { status: string; msg: string; code: number; }

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
  
  const joinGame = () => {
    if (user !== "" && room !== "") {
      setErr(``);
      const payload = { room: room, user: user };
      socket.emit("join", payload, (res: Response) => {
        switch (res.status) {
          case `err`: setErr(res.msg); break;
          case `auth`: setAuth(true); break;
          case `ok`: setID(res.code); game(); break;
          default: break;
        }
      });
    } else {
      /* highlight blank field in red */
    }
  };

  const enterPass = () => {
    if (pass !== ``) {
      const payload = { room: room, user: user, pass: pass };
      socket.emit("auth", payload, (res: Response) => {
        switch (res.status) {
          case `err`: setErr(res.msg); setAuth(false); break;
          case `ok`: setID(res.code); game(); break;
          default: break;
        }
      });
    }
  }

  return (
    <menu>
      <li><button onClick={def}>Back</button></li>

      <fieldset>
        <legend>Connect</legend>
        <li>
          <input type="text" placeholder="Nickname" value={user} onChange={(e) => { setUser(e.target.value); }} />
          </li>
        <li>
          <input type="text" placeholder="Room Key" onChange={(e) => { setRoom(e.target.value); }} />
          </li>
        { !auth && <li><button onClick={joinGame}>Join</button></li> }
        { auth && <li><button onClick={ () => setAuth(false) }>Cancel</button></li> }
      </fieldset>

      { auth &&
        <fieldset>
          <legend>Confirm</legend>
          <li><input type="text" placeholder="Enter room password" onChange={(e) => { setPass(e.target.value); }} /></li>
          <li><button onClick={enterPass}>Enter</button></li>
        </fieldset>
      }

      <li><em>{ err }</em></li>
    </menu>
  )
}


function Host ({ setID, user, setUser, room, setRoom, def, game }: ClientProps) {
  
  const [err, setErr] = useState("");

  const [playerMax, setPlayerMax] = useState(0);
  const [passKey, setPassKey] = useState(``);
  const [useChat, setUseChat] = useState(true);
  const [rounds, setRounds] = useState(7);

  const hostGame = () => {
    if (user !== "" && room !== "") {
      setErr(``);
      const roomOpt = { max: playerMax ?? 0, pass: passKey ?? ``, chat: useChat, rounds: rounds ?? 7 }
      const payload = { room: room, user: user, settings: roomOpt };
      socket.emit("host", payload, (res: Response) => {
        switch (res.status) {
          case `err`: setErr(res.msg); break;
          case `ok`: setID(res.code); game(); break;
          default: break;
        }
      });
    }
  };

  return (
    <menu>
      <li><button onClick={def}>Back</button></li>

      <fieldset>
        <legend>User</legend>
        <li>
          <input type="text" placeholder="Nickname" value={user} onChange={(e) => { setUser(e.target.value); }} />
        </li>
      </fieldset>

      <fieldset>
        <legend>Lobby</legend>
        <li>
          <input type="text" placeholder="Unique key (required)" onChange={(e) => { setRoom(e.target.value); }} />
        </li>
        <li>
          <input type="text" placeholder="Create password (optional)" onChange={(e) => { setPassKey(e.target.value); }} />
          </li>
        <li>
          <input type="number" placeholder="Player capacity (optional)" onChange={(e) => { setPlayerMax(Math.abs(Math.round(Number(e.target.value)))); }} />
        </li>
      </fieldset>
      
      <fieldset>
        <legend>Game</legend>
        <li>
          <input name="numround" type="number" placeholder="# Rounds (optional / default 7)" onChange={(e) => { setRounds(Math.abs(Math.round(Number(e.target.value)))); }} />
        </li>
        <li>
          <label htmlFor="usechat">Chat: </label>
          <select name="usechat" onChange={(e: any) => { setUseChat(e.target.value === 0) }}>
            <option value={0} >
              Enabled
            </option>
            <option value={1}>
              Disabled
            </option>
          </select>
        </li>
      </fieldset>

      <li><button onClick={hostGame}>Host</button></li>

      <li><em>{ err }</em></li>
    </menu>
  )
}

export default function App() {
  enum MenuMode { Default, Host, Join, Game }

  const [id, setID] = useState(-1);
  const [user, setUser] = useState(``);
  const [room, setRoom] = useState(``);

  const [toggleMenu, setMenuTog] = useState(MenuMode.Default);
  const host = () => { setMenuTog(MenuMode.Host); }
  const join = () => { setMenuTog(MenuMode.Join); }
  const def = () => { setMenuTog(MenuMode.Default); setRoom(``); }
  const game = () => { setMenuTog(MenuMode.Game); }

  return (
    <div className="App">
      <h1>Picture Sentence</h1>

        { toggleMenu === MenuMode.Default && 
          <menu>
            <li><button onClick={host}>Host Game</button></li>
            <li><button onClick={join}>Join Game</button></li>
          </menu>
        }
        { toggleMenu === MenuMode.Host &&

          <Host setID={setID} user={user} setUser={setUser} room={room} setRoom={setRoom} def={def} game={game} />
        }
        { toggleMenu === MenuMode.Join &&

          <Join setID={setID} user={user} setUser={setUser} room={room} setRoom={setRoom} def={def} game={game}/>
        }
        { toggleMenu === MenuMode.Game &&

          <div id="game"><Lobby socket={socket} id={id} user={user} room={room} def={def} /></div>
        }

    </div>
  );
}