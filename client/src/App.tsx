import "./App.css";
import io from "socket.io-client";
import { useEffect, useState } from "react";
import Game from "./Game";

const socket = io("http://localhost:5174");

interface ClientProps {
  user: string;
  setUser: React.Dispatch<React.SetStateAction<string>>;
  room: string;
  setRoom: React.Dispatch<React.SetStateAction<string>>;
  def: () => void;
  game: () => void;
}

function Join ({ user, setUser, room, setRoom, def, game }: ClientProps) {

  const [err, setErr] = useState("");
  useEffect(() => {
    socket.on("receive_err", (inbound: any) => {
      if (inbound.err) setErr(inbound.msg);
      else game();
    });
  }, [socket]);

  const joinGame = () => {
    if (user !== "" && room !== "") {
      const payload = { room: room, user: user };
      socket.emit("join_room", payload);
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

function Host ({ user, setUser, room, setRoom, def, game }: ClientProps) {

  const [err, setErr] = useState("");
  useEffect(() => {
    socket.on("receive_err", (inbound: any) => {
      if (inbound.err) setErr(inbound.msg);
      else game();
    });
  }, [socket]);

  const hostGame = () => {
    if (user !== "" && room !== "") {
      const payload = { room: room, user: user };
      socket.emit("host_room", payload);
    }
  }

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

  const [user, setUser] = useState("");
  const [room, setRoom] = useState("");

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

          <Host user={user} setUser={setUser} room={room} setRoom={setRoom} def={def} game={game} />
        }
        { toggleMenu === MenuMode.Join &&

          <Join user={user} setUser={setUser} room={room} setRoom={setRoom} def={def} game={game}/>
        }
        { toggleMenu === MenuMode.Game &&

          <Game socket={socket} user={user} room={room} def={def} />
        }

    </div>
  );
}