interface DemoProps { def: () => void; }

export default function Demo ({ def }: DemoProps) {

  return (
    <menu className='howto'>
      <li><button onClick={def}>Back</button></li>

      <h3>Start a Lobby:</h3>
      <ol start={1} type="1">
        <li>From the home page, one player select 'Host' and enter in the room settings.
          At minimum, the host must enter a username for theirself, and create a name (aka key) for the room.
        </li>
        <li>Once the host creates the room, share the key among all intended players.
          Players besides the host will select to 'Join', and enter their own usernames and the matching room key.
          <i>The room key must match exactly, including spaces and capitalization.</i>
        </li>
        <li>
          Once players join the lobby they can send messages (assuming the host hasn't disabled messaging).
          The host has the authority to kick anybody who joins.
        </li>
        <li>
          Players are also able to ready up once joining the lobby, and once all players are ready the first round will begin.
        </li>
      </ol>

      <h3>How to Play:</h3>
      <ol start={1} type="1">
        <li>
          During the first round, players will privately create a sentence and enter it in the appropiate area.
          These sentences will be indirectly referenced throughout the game, so if your sentence is unhinged, please ensure sure your friends are too.
        </li>
        <li>
          Once all players submit their answer, the sentences will be redistributed in a clockwise fashion.
          This means that during round 2 you will see the sentence that the player before you wrote.
        </li>
        <li>
          Since you are being shown a sentence, you must illustrate it. Do your best to depict the sentence as an image.
        </li>
        <li>
          Once all players submit their images, the images are redistributed in the same direction.
          Your task again is to create a sentence, this time one that is representative of the image that you see.
        </li>
        <li>
          The game continues to rotate the pictures and sentences in the same direction until the round limit is reached.
          At that point, all original sentences are displayed to all players. Click on the sentence to reveal the entire sequence of pictures and captions!
        </li>
      </ol>

    </menu>
  )
}