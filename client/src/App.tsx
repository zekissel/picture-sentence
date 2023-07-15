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
  
  const joinGame = () => {
    if (user !== "" && room !== "") {
      const payload = { room: room, user: user };
      socket.emit("join_room", payload, (res: Response) => {
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
      <li><input type="text" placeholder="Room Key" onChange={(e) => { setRoom(e.target.value); }} /></li>
      <li><button onClick={joinGame}>Join</button></li>
      <p>{ err }</p>
    </menu>
  )
}


function Host ({ setID, user, setUser, room, setRoom, def, game }: ClientProps) {
  
  const [err, setErr] = useState("");

  const hostGame = () => {
    if (user !== "" && room !== "") {
      const payload = { room: room, user: user };
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