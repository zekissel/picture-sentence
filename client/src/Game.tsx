import { useEffect, useState } from 'react';

interface Player {
  user: string;
  ready: boolean;
}

interface ChatProps {
  socket: any;
  user: string;
  room: string;
  def: () => void;
}

export default function Game({ socket, user, room, def }: ChatProps) {
  const [err, setErr] = useState(``);
  const [ready, setReady] = useState(false);
  const [players, setPlayers] = useState<Player[]>([{ user: user, ready: false }]);
  const [outbound, setOutbound] = useState(``);
  const updateOut = (e: any) => { setOutbound(e.target.value); }
  const [chat, setChat] = useState<string[]>([]);

  const disconnect = async () => {
    const payload = { room: room, user: user };
    await socket.emit("leave_room", payload);
  }

  const readyUp = async () => {
    const payload = { room: room, user: user, ready: !ready, msg: '' };
    await socket.emit("signal_lobby", payload);
  };

  const sendMessage = async () => {
    if (outbound !== ``) {
      setChat((msgs) => [...msgs, outbound]);
      const payload = { room: room, user: user, ready: ready, msg: outbound };
      await socket.emit("signal_lobby", payload);
      setOutbound('');
    }
  };

  useEffect(() => {
    socket.on("lobby_poll", (inbound: any) => {
      setPlayers(inbound.players);
      if (inbound.msg !== ``) setChat((msgs) => [...msgs, `${inbound.msg} - ${inbound.author}`]);
    });

    socket.on("receive_err", (inbound: any) => {
      if (inbound.err === false) {
        switch (inbound.code) {
          case 'exit': def(); break;
          case 'ready': setReady(inbound.ready); break;
          default: break;
        }
      }
      else setErr(inbound.msg);
    });
  }, [socket]);

  return (
    <div>
      <p>{ err }</p>
      <button onClick={disconnect}>Exit</button>
      <h3>Players</h3>
      <ul>
        { players.map((v, i) => { 
          return  <li key={i}> { v.user } 
                    { v.user === user && <button onClick={readyUp}> { ready ? 'Cancel' : 'Ready' }</button> }
                    { v.user !== user && <label> { v.ready ? '✓' : '✗' }</label> }
                  </li> })
        }
      </ul>
      <h3>Chat</h3>
      <ul>
        { chat.map((v, i) => { return <li key={i}>{ v }</li> }) }
      </ul>
      <input type='text' onChange={updateOut} value={outbound}/><button onClick={sendMessage}>Send</button>
    </div>
  );
}