import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import Canvas from './Canvas';

interface Actor {
  socket: string;
  id: number;
  user: string;
  ready: boolean;
}

interface Paper {id: number; answers: string[]; }

interface PaperProps { socket: Socket, room: string; index: number; answers: string[]; }
interface PostProps { socket: Socket; room: string; papers: Paper[]; }

interface GameProps {
  socket: Socket<any, any>;
  room: string;
  id: number;
  round: number;
  setRound: React.Dispatch<React.SetStateAction<number>>;
  setActors: React.Dispatch<React.SetStateAction<Actor[]>>;
}

interface GameResponse { ready: boolean; msg: Paper[]; code: number, actors: Actor[] }

function Paper ({ socket, room, index, answers }: PaperProps) {

  const [visible, setVisible] = useState(false);
  const toggleVisible = () => { setVisible(!visible) }

  const [votes, setVotes] = useState<number[]>(new Array(answers.length).fill(0));
  const [myVotes, setMyVotes] = useState<boolean[]>(new Array(answers.length).fill(false));
  const castVote = (e: any) => {
    const ind = Number(e.target.id);
    const vote = !myVotes[ind];
    const myV = [...myVotes]; myV[ind] = vote;
    setMyVotes(myV);

    const v = [...votes];
    if (vote) v[ind] += 1;
    else v[ind] -= 1;
    setVotes(v);

    const postLoad = { room: room, paper: index, ind: ind, val: vote }
    socket.emit('signal_post', postLoad);
  }

  useEffect(() => {

    socket.on('post_poll', (inbound: any) => {
      if (inbound.paper === index) setVotes(inbound.votes);
    });
  }, [socket]);

  const imgStyle = { background: `#FFF` }
  const likeStyle = { background: `red` }
  const unlikeStyle = { background: `#777` }

  return (
    <li>
      <ul className='paper'>

        { answers.map((a, i) => {
          return <li key={i}>
            { i === 0 && <div onClick={toggleVisible}>{ a }</div> }
            { (i !== 0 && visible) && (i % 2 == 0 ? a : <img src={a} style={imgStyle} alt='Picture drawn by contestant to imitate the sentence above'></img>) }

            { visible && <button className='like' id={String(i)} style={myVotes[i] ? likeStyle : unlikeStyle} onClick={castVote} >{votes[i]} ❤</button> }
          </li>
        }) }

      </ul>
    </li>
  )
}

function PostGame ({ socket, room, papers }: PostProps) {

  return (
    <ul>
      { papers.map((paper, index) => {
        return <Paper key={index} socket={socket} room={room} index={index} answers={paper.answers} />
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
      if (inbound.code < 0) { setAll(inbound.msg); setPrevious(``); }
      else if (inbound.ready === false) setPrevious(inbound.msg[id].answers[round]);
      
      if (inbound.ready !== undefined) setIdle(inbound.ready);
      if (inbound.actors !== undefined) setActors(inbound.actors);
      setRound(inbound.code);
    });
  }, [socket]);

  const imgStyle = { background: `#FFF` }

  return (
    <>
      { round === 0 &&
        <>
          <h2>Pregame Lobby</h2>
          <p>Game will begin once all players are ready.</p>
        </>
      }
      { round > 0 &&
        <>
          <h2>Round { round }</h2>
          <h3>
            { !idle && (round === 1 ? 'Write down a sentence that is creative or interesting:' : 
                round % 2 === 1 ? 'Describe this picture with a sentence:' : 'Illustrate this sentence:')
            }
          </h3>
          <div id='prev'>
            { !idle && (round % 2 === 0 ? prevAnswer :
              <img src={prevAnswer} style={imgStyle}/>) 
            }
          </div>

          { !idle && (round % 2 === 1 ? 
            <input type='text' placeholder='Your sentence here' onChange={updateAnswer} value={curAnswer} onKeyDown={enterSubmit}/> :
            <Canvas width={400} height={267} updateImage={updateImage} />)
          }

          { !idle && <button onClick={submitAnswer}>Submit</button> }

          { idle && <p>Wait for next round</p> }
          
        </>
      }
      { round === -1 &&
      <>
        <h2>Postgame Lobby</h2>
        <p>What's your favorite story?</p>
        
        <PostGame socket={socket} room={room} papers={allPapers} />
        
      </>
      }
    </>
  )
}