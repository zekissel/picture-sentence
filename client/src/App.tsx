import "./App.css";
import io from "socket.io-client";
import { useState } from "react";
import Game from "./Game";

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

  const [err, setErr] = useState("");
  const [auth, setAuth] = useState(false);
  const [pass, setPass] = useState(``);
  
  const joinGame = () => {
    if (user !== "" && room !== "") {
      const payload = { room: room, user: user };
      socket.emit("join_room", payload, (res: Response) => {
        switch (res.status) {
          case `err`: setErr(res.msg); break;
          case `auth`: setAuth(true); break;
          case `ok`: setID(res.code); game(); break;
          default: break;
        }
      });
    }
  };

  const enterPass = () => {
    if (pass !== ``) {
      const payload = { room: room, user: user, pass: pass };
      socket.emit("room_auth", payload, (res: Response) => {
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
      <li><button onClick={def}>Go back</button></li>
      <li><input type="text" placeholder="Nickname" onChange={(e) => { setUser(e.target.value); }} /></li>
      <li><input type="text" placeholder="Room Key" onChange={(e) => { setRoom(e.target.value); }} /></li>
      { auth && <li><input type="text" placeholder="Enter room password" onChange={(e) => { setPass(e.target.value); }} /></li> }
      { !auth && <li><button onClick={joinGame}>Join</button></li> }
      { auth && <li><button onClick={enterPass}>Enter</button></li> }
      <p>{ err }</p>
    </menu>
  )
}


function Host ({ setID, user, setUser, room, setRoom, def, game }: ClientProps) {
  
  const [err, setErr] = useState("");

  const [playerMax, setPlayerMax] = useState(0);
  const [passKey, setPassKey] = useState(``);
  const [useReady, setUseReady] = useState(true);

  const hostGame = () => {
    if (user !== "" && room !== "") {
      const roomOpt = { max: playerMax, pass: passKey, ready: useReady }
      const payload = { room: room, user: user, opt: roomOpt };
      socket.emit("host_room", payload, (res: Response) => {
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
      <li><button onClick={def}>Go back</button></li>
      <li><input type="text" placeholder="Nickname" onChange={(e) => { setUser(e.target.value); }} /></li>
      <li><input type="text" placeholder="Create key" onChange={(e) => { setRoom(e.target.value); }} /></li>
      <li><input type="number" placeholder="Limit # players (Optional)" onChange={(e) => { setPlayerMax(Math.abs(Math.round(Number(e.target.value)))); }} /></li>
      <li><input type="text" placeholder="Create password (Optional)" onChange={(e) => { setPassKey(e.target.value); }} /></li>
      <li><button onClick={hostGame}>Host</button></li>
      <p>{ err }</p>
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
  const def = () => { setMenuTog(MenuMode.Default); }
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

          <div id="game"><Game socket={socket} id={id} user={user} room={room} def={def} /></div>
        }

    </div>
  );
}