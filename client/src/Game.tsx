import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import Canvas from './Canvas';

interface Player {
  id: number;
  user: string;
  ready: boolean;
  wait: boolean;
}

interface Paper {
  id: number;
  answers: string[];
}

interface PaperProps {
  paper: Paper;
  index: number;
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
  setPlayers: React.Dispatch<React.SetStateAction<Player[]>>;
}

function FoldPaper ({ paper, index }: PaperProps) {

  const [visible, setVisible] = useState(false);
  const toggleVisible = () => { setVisible(!visible); }

  const imgStyle = { background: `#FFF` }

  return (
    <ul className='paper' key={index}>
      { paper.answers.map((val, ind) => { 
          return <li key={ind} onClick={ind == 0 ? toggleVisible : undefined}>
                  { ind != 0 && visible && (ind % 2 == 0 ? val : <img src={val} style={imgStyle}/>) }
                  { ind == 0 && val }
                 </li>
        }) }
    </ul>
  )
}

function GameField ({ socket, room, id, round, setRound, setPlayers }: FieldProps) {

  const [allPapers, setAll] = useState<Paper[]>([]);

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
      if (inbound.idle !== undefined) setIdle(inbound.idle);
      if (inbound.players !== undefined) setPlayers(inbound.players);
      if (inbound.prevAns && inbound.prevAns[id].answers && inbound.prevAns[id].answers[round - 1] !== ``) setPrevious(inbound.prevAns[id].answers[round - 1]);
      if (inbound.code === `end`) { setAll(inbound.prevAns); setPrevious(``); }
    });
  });

  const imgStyle = { background: `#FFF` }

  return (
    <>
      <h2>Round { round >= 0 ? round : `End` }</h2>
      <h3>
        { (!idle && round > -1) && (round === 1 ? 'Formulate a sentence that is creative or interesting:' : 
          round % 2 === 1 ? 'Describe this picture with a sentence:' : 'Illustrate this sentence:' )
        }
      </h3>
      <div id='prev'>
        { (round > -1 && !idle) && (round % 2 === 0 ? prevAnswer :
          <img src={prevAnswer} style={imgStyle}/>) 
        }
      </div>

        { (!idle && round > -1) && (round % 2 === 1 ? 
          <input type='text' placeholder='Your sentence here' onChange={updateAnswer} value={curAnswer} onKeyDown={enterSubmit}/> :
          <Canvas width={400} height={267} updateImage={updateImage} />)
        }
        {
          (idle && round >= 0) && <p>Wait for next round</p>
        }
      { (!idle && round > -1) && <button onClick={submitAnswer}>Submit</button> }

      { round === -1 &&
        allPapers.map((val, ind) => {
          return <FoldPaper paper={val} index={ind} />
        })
      }
    </>
  )
}



export default function Game({ socket, id, user, room, def }: GameProps) {
  const [err, setErr] = useState(``);
  const [ready, setReady] = useState(false);
  
  const [outbound, setOutbound] = useState(``);
  const updateOut = (e: any) => { setOutbound(e.target.value); }
  const [chat, setChat] = useState<string[]>([]);
  const [btmTxt, setBtm] = useState<HTMLDivElement | null>(null);

  const [players, setPlayers] = useState<Player[]>([{ id: id, user: user, ready: false, wait: true }]);
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
      if (inbound.code === `start`) { setPhase(1); setReady(false); }
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

  const regCol = {background: `#545652`};
  const altCol = {background: `#445652`};

  return (
    <>
      <div id='lobby'>
        <p>{ err }</p>
        <button onClick={disconnect}>Exit Room</button>
        <h3>Players</h3>
        <ul id='playerList'>
          { players.map((v, i) => { 
            return  <li key={i}> { v.user } 
                      { v.id === id && (gamePhase <= 0 && <button id='ready' onClick={readyUp}>{ ready ? 'Cancel' : 'Ready Up' }</button> )}
                      { v.id !== id && (gamePhase <= 0 && <label>{ v.ready ? '✓' : '✗' }</label> )}

                      { gamePhase > 0 && <label>{ v.wait === false ? '✓' : '✗' }</label> }
                    </li> })
          }
        </ul>
        <h3>Chat</h3>
        <ul id='chat'>
          { chat.map((v, i) => { return <li key={i} style={ i % 2 == 0 ? regCol : altCol}> { ` ${v}` }</li> }) }
          <div ref={(e) => (setBtm(e))}></div>
        </ul>
        <input type='text' onChange={updateOut} value={outbound} onKeyDown={enterSend}/><button onClick={sendMessage}>Send Message</button>
      </div>

      <div id='field'>
        { (gamePhase > 0 || gamePhase === -1) && <GameField socket={socket} room={room} id={id} round={gamePhase} setRound={setPhase} setPlayers={setPlayers} /> }
      </div>
    </>
  );
}