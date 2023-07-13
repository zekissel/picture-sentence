import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import Canvas from './Canvas';

interface Player {
  id: number;
  user: string;
  ready: boolean;
}

interface GameProps {
  socket: Socket<any, any>;
  room: string;
  user: string;
  id: number;
  def: () => void;
}

interface FieldProps {
  socket: Socket<any, any>;
  room: string;
  id: number;
  round: number;
  setRound: React.Dispatch<React.SetStateAction<number>>;
}

function GameField ({ socket, room, id, round, setRound }: FieldProps) {

  const [prevAnswer, setPrevious] = useState(``);
  const [curAnswer, setCurrent] = useState(``);
  const [idle, setIdle] = useState(false);
  const updateImage = (b64: string) => { setCurrent(b64); }
  const updateAnswer = (e: any) => { setCurrent(e.target.value); }
  const enterSubmit = async (e: any) => { if (e.key == `Enter`) await submitAnswer(); }
  const submitAnswer = async () => {
    if (curAnswer !== ``) {
      const payload = { room: room, id: id, msg: curAnswer, round: round };
      setIdle(true);
      await socket.emit("signal_game", payload);
      setCurrent(``);
    }
  }

  useEffect(() => {
    socket.on("game_poll", (inbound: any) => {
      setRound(inbound.round);
      if (!inbound.idle && inbound.prevAns[id].answers[round - 1] !== ``) setPrevious(inbound.prevAns[id].answers[round - 1]);
      setIdle(inbound.idle);
    });
  });

  const imgStyle = { background: `#FFF` }

  return (
    <div>
      <h2>Round { round }</h2>
      <h3>
        { !idle && (round === 1 ? 'Formulate a sentence that is creative or interesting' : 
          round % 2 === 1 ? 'Describe this picture with a sentence' : 'Illustrate this sentence with a picture' )
        }
      </h3>
      <div>
        { round !== 1 && !idle && (round % 2 === 0 ? prevAnswer :
          <img src={prevAnswer} style={imgStyle}/>) 
        }
      </div>

        { !idle && (round % 2 === 1 ? 
          <input type='text' placeholder='Your sentence here'onChange={updateAnswer} value={curAnswer} onKeyDown={enterSubmit}/> :
          <Canvas width={300} height={250} updateImage={updateImage} />)
        }
        {
          idle && <p>Wait for next round</p>
        }
      { !idle && <button onClick={submitAnswer}>Submit</button> }
    </div>
  )
}

export default function Game({ socket, id, user, room, def }: GameProps) {
  const [err, setErr] = useState(``);
  const [ready, setReady] = useState(false);
  
  const [outbound, setOutbound] = useState(``);
  const updateOut = (e: any) => { setOutbound(e.target.value); }
  const [chat, setChat] = useState<string[]>([]);
  const [btmTxt, setBtm] = useState<HTMLDivElement | null>(null);

  const [players, setPlayers] = useState<Player[]>([{ id: id, user: user, ready: false }]);
  const [gamePhase, setPhase] = useState(0);

  const disconnect = async () => {
    const payload = { room: room, user: user, id: id };
    await socket.emit("leave_room", payload);
  }

  const readyUp = async () => {
    const payload = { room: room, id: id, ready: !ready, msg: '' };
    await socket.emit("signal_lobby", payload);
  };

  const enterSend = async (e: any) => { if (e.key == `Enter`) await sendMessage(); }
  const sendMessage = async () => {
    if (outbound !== ``) {
      setChat((msgs) => [...msgs, outbound]);
      const payload = { room: room, user: user, id: id, ready: ready, msg: outbound };
      console.log(outbound);
      await socket.emit("signal_lobby", payload);
      setOutbound('');
      btmTxt?.scrollIntoView({ behavior: "smooth" });
    }
  };
  

  useEffect(() => {

    socket.on("lobby_poll", (inbound: any) => {
      if (inbound.players !== undefined) setPlayers(inbound.players);
      if (inbound.msg !== ``) {
        setChat((msgs) => [...msgs, `${inbound.msg} - ${inbound.author}`]);
        btmTxt?.scrollIntoView({ behavior: "smooth" });
      }
      if (inbound.code === `start`) setPhase(1);
    });
    
    socket.on("lobby_err", (inbound: any) => {
      if (inbound.err === false) {
        switch (inbound.code) {
          case 'exit': def(); break;
          case 'ready': setReady(inbound.ready); break;
          default: break;
        }
      }
      else setErr(inbound.msg);
    });

  }, [socket, id]);

  return (
    <div>
      <p>{ err }</p>
      <button onClick={disconnect}>Exit</button> {id}
      <h3>Players</h3>
      <ul id='playerList'>
        { players.map((v, i) => { 
          return  <li key={i}> { v.user } 
                    { v.id === id && (gamePhase === 0 && <button id='ready' onClick={readyUp}>{ ready ? 'Cancel' : 'Ready Up' }</button> )}
                    { v.id !== id && (gamePhase === 0 && <label>{ v.ready ? '✓' : '✗' }</label> )}
                  </li> })
        }
      </ul>
      <h3>Chat</h3>
      <ul id='chat'>
        { chat.map((v, i) => { return <li key={i}>{ ` ${v}` }</li> }) }
        <div ref={(e) => (setBtm(e))}></div>
      </ul>
      <input type='text' onChange={updateOut} value={outbound} onKeyDown={enterSend}/><button onClick={sendMessage}>Send</button>

      { gamePhase > 0 && <GameField socket={socket} room={room} id={id} round={gamePhase} setRound={setPhase}/> }
    </div>
  );
}