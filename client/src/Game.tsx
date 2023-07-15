import { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';
import Canvas from './Canvas';

interface Actor {
  id: number;
  user: string;
  ready: boolean;
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
  setActors: React.Dispatch<React.SetStateAction<Actor[]>>;
}

interface LobbyResponse { status: string; msg: string; author: string, code: number, actors: Actor[] }
interface GameResponse { ready: boolean; msg: Paper[]; code: number, actors: Actor[] }



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

function GameField ({ socket, room, id, round, setRound, setActors }: FieldProps) {

  const [allPapers, setAll] = useState<Paper[]>([]);

  const [prevAnswer, setPrevious] = useState(``);
  const [curAnswer, setCurrent] = useState(``);
  const [idle, setIdle] = useState(false);

  const updateImage = (b64: string) => { setCurrent(b64); }
  const updateAnswer = (e: any) => { setCurrent(e.target.value); }

  const enterSubmit = (e: any) => { if (e.key == `Enter`) submitAnswer(); }
  const submitAnswer = () => {
    if (curAnswer !== ``) {
      const payload = { room: room, id: id, msg: curAnswer, round: round };
      socket.emit("signal_game", payload, (res: GameResponse) => {
        if (res.msg?.length > 0) setPrevious(res.msg[id].answers[round - 1]);
        if (res.actors !== undefined) setActors(res.actors);
        if (res.ready !== undefined) setIdle(res.ready);
        setRound(res.code);
      });
      setCurrent(``);
    }
  }

  useEffect(() => {
    socket.on("game_poll", (inbound: any) => {
      setRound(inbound.code);
      if (inbound.ready !== undefined) setIdle(inbound.ready);
      if (inbound.actors !== undefined) setActors(inbound.actors);
      if (inbound.msg?.length > 0) setPrevious(inbound.msg[id].answers[round - 1]);
      if (inbound.code === -1) { setAll(inbound.msg); setPrevious(``); }
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
  const btmTxt = useRef<HTMLLIElement>(null);

  const [actors, setActors] = useState<Actor[]>([{ id: id, user: user, ready: false }]);
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
      btmTxt.current?.scrollIntoView({ behavior: "smooth" });
    }
  };
  

  useEffect(() => {

    socket.on("lobby_poll", (inbound: any) => {
      /* polls for player list, messages, and game start */
      switch (inbound.status) {
        case `err`: setErr(inbound.msg); break;
        case `ok`:
          setActors(inbound.actors);
          if (inbound.msg !== ``) {
            setChat((msgs) => [...msgs, `${inbound.msg} - ${inbound.author}`]);
            btmTxt.current?.scrollIntoView({ behavior: "smooth" }); 
          } break;
        case `start`: setPhase(1); setReady(false); break;
        default: break;
      }
    })
  }, [socket]);

  const regCol = {background: `#545652`};
  const altCol = {background: `#445652`};

  return (
    <>
      <div id='lobby'>
        <p>{ err }</p>
        <button onClick={disconnect}>Exit Room</button>
        <h3>Players</h3>
        <ul id='playerList'>
          { actors?.map((v, i) => { 
            return  <li key={i}> { v.user } 
                      { v.id === id && (gamePhase <= 0 && <button id='ready' onClick={readyUp}>{ ready ? 'Cancel' : 'Ready Up' }</button> )}
                      { v.id !== id && (gamePhase <= 0 && <label>{ v.ready ? '✓' : '✗' }</label> )}

                      { gamePhase > 0 && <label>{ v.ready !== false ? '✓' : '✗' }</label> }
                    </li> })
          }
        </ul>
        <h3>Chat</h3>
        <ul id='chat'>
          { chat.map((v, i) => { return <li key={i} style={ i % 2 == 0 ? regCol : altCol}> { ` ${v}` }</li> }) }
          <li ref={btmTxt}></li>
        </ul>
        <input type='text' onChange={updateOut} value={outbound} onKeyDown={enterSend}/><button onClick={sendMessage}>Send Message</button>
      </div>

      <div id='field'>
        { (gamePhase > 0 || gamePhase === -1) && <GameField socket={socket} room={room} id={id} round={gamePhase} setRound={setPhase} setActors={setActors} /> }
      </div>
    </>
  );
}