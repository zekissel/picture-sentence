import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import Canvas from './Canvas';

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

interface PostProps {
  paper: Paper;
}

interface GameProps {
  socket: Socket<any, any>;
  room: string;
  id: number;
  round: number;
  setRound: React.Dispatch<React.SetStateAction<number>>;
  setActors: React.Dispatch<React.SetStateAction<Actor[]>>;
}

interface GameResponse { ready: boolean; msg: Paper[]; code: number, actors: Actor[] }


function PostGame ({ paper }: PostProps) {

  const [visible, setVisible] = useState(false);
  const toggleVisible = () => { setVisible(!visible); }

  const imgStyle = { background: `#FFF` }

  return (
    <ul className='paper' key={paper.id}>
      { paper.answers.map((val, ind) => { 
          return <li key={ind} onClick={ind == 0 ? toggleVisible : undefined}>
                  { ind != 0 && visible && (ind % 2 == 0 ? val : <img src={val} style={imgStyle}/>) }
                  { ind == 0 && val }
                 </li>
        }) }
    </ul>
  )
}

export default function Game ({ socket, room, id, round, setRound, setActors }: GameProps) {

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
          return <PostGame key={ind} paper={val} />
        })
      }
    </>
  )
}