import { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';
import Game from './Game';

interface Actor {
  socket: string;
  id: number;
  user: string;
  ready: boolean;
  conn: boolean;
}

interface LobbyProps {
  socket: Socket<any, any>;
  room: string;
  user: string;
  id: number;
  def: () => void;
  setERR: React.Dispatch<React.SetStateAction<string>>
}

interface LobbyResponse { status: string; msg: string; author: string, code: number, actors: Actor[] }


export default function Lobby({ socket, id, user, room, def, setERR }: LobbyProps) {
  const [err, setErr] = useState(``);
  const [ready, setReady] = useState(false);
  
  const [outbound, setOutbound] = useState(``);
  const updateOut = (e: any) => { setOutbound(e.target.value); }
  const [chat, setChat] = useState<string[]>([]);
  const btmTxt = useRef<HTMLLIElement>(null);
  const [noChat, setNoChat] = useState(false);

  const [actors, setActors] = useState<Actor[]>([{ id: id, user: user, ready: false, socket: socket.id, conn: true }]);
  const [gamePhase, setPhase] = useState(0);

  const disconnect = () => {
    const payload = { room: room, user: user, id: id };
    socket.emit("exit_room", payload); def();
  }

  const readyUp = () => {
    const payload = { room: room, user: user, id: id, ready: !ready, msg: `` };
    socket.emit(`signal_lobby`, payload, (res: LobbyResponse) => {
      switch (res.status) {
        case `err`: setErr(res.msg); break;
        case `ok`: 
          setReady(res.code > 0 ? true : false);
          setActors(res.actors); break;
        default: break;
      }
    });
  };

  const enterSend = (e: any) => { if (e.key == `Enter`) sendMessage(); }
  const sendMessage = () => {
    if (outbound !== ``) {
      setChat((msgs) => [...msgs, outbound]);
      const payload = { room: room, user: user, id: id, ready: ready, msg: outbound };
      socket.emit("signal_lobby", payload, (res: LobbyResponse) => {
        switch (res.status) {
          case `err`: setErr(res.msg); break;
          case `ok`: setActors(res.actors); break;
          default: break;
        }
      });
      setOutbound('');
    }
  };

  const kick = (e: any) => {
    const payload = { room: room, id: id, kick: e.target.id, code: -1 }
    socket.emit('signal_adm', payload);
  }
  

  useEffect(() => {

    socket.on("lobby_poll", (inbound: any) => {
      /* polls for player list, messages, and game start */
      switch (inbound.status) {
        case `err`: setErr(inbound.msg); break;
        case `ok`:
          setActors(inbound.actors);
          if (inbound.msg !== ``) {
            const m = `${inbound.msg} ${inbound.author == `` ? `` : `- ${inbound.author}`}`;
            setChat((msgs) => [...msgs, m]);
          } 
          if (inbound.disabled) setNoChat(true);
          break;
        case `start`: setPhase(1); setReady(false); break;
        case `kick`: 
          disconnect(); setERR(inbound.msg); break;
        default: break;
      }
    })

    socket.on('disconnect', () => {
      
      const a = {...actors[id], conn: false}
      const lob = [...actors]; lob[id] = a;
      setActors(lob);
    });

    return () => { socket.off('lobby_poll'); socket.off('disconnect'); }

  }, [socket, actors]);


  useEffect(() => {
    if (btmTxt.current) {
      btmTxt.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [chat]);

  const regCol = { background: `#f9faf0` };
  const altCol = { background: `#edf0ce` };

  const green = { color: `green` };
  const red = { color: `red` };

  return (
    <>
      <div id='lobby'>
        <em>{ err }</em>

        <fieldset>
          <legend>{ room }</legend>
          <button onClick={disconnect}>Exit</button>
          { gamePhase < 1 && <button className='ready' onClick={readyUp}>{ ready ? 'Cancel' : 'Ready Up' }</button> }
        </fieldset>

        <fieldset>
          <legend>Players</legend>
          <ul id='playerList'>
            { actors?.map((v, i) => { 
                return <li key={i} style={ i % 2 == 0 ? regCol : altCol}> 
              
                  <span className='user'>{ v.user }</span>
                  { !v.conn && <img src='conn_err.png' height={20} width={20}/> }
                  
                  <label className='check' style={ v.ready ? green : red }>{ v.ready ? '✓' : '✗' }</label>

                  { v.id !== id && (id === 0 && <button className='kick' id={v.socket} onClick={kick}>Kick</button>) }
                </li> 
              })
            }
          </ul>
        </fieldset>

        <fieldset>
          <legend>Chat</legend>
          <ul id='chat'>
            { chat.map((v, i) => { 
              return i === chat.length - 1 ? 
                <li key={i} ref={btmTxt} style={ i % 2 == 0 ? regCol : altCol}> { ` ${v}` }</li>
                :
                <li key={i} style={ i % 2 == 0 ? regCol : altCol}> { ` ${v}` }</li>
              }) 
            }
          </ul>
          <input className="typemsg" type='text' onChange={updateOut} value={outbound} onKeyDown={enterSend} disabled={noChat} placeholder='Message'/>
          <button onClick={sendMessage} disabled={noChat}>Send</button>
        </fieldset>
      </div>

      <div id='field'>
        <Game socket={socket} room={room} id={id} round={gamePhase} setRound={setPhase} setActors={setActors} />
      </div>
    </>
  );
}