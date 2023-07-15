'use client'
import { useState } from 'react';
import { useOnDraw } from './_drawUtils';
import { SketchPicker } from 'react-color';

interface Point { x: number; y: number; }
type Color = `#${string}`;
interface CanvasProps {
    width: number;
    height: number;
    updateImage: (b64: string) => void;
}

const Canvas = ({ width, height, updateImage }: CanvasProps) => {

    const { setCanvasRef, onCanvasMouseDown, getImage } = useOnDraw(onDraw);

    const [visible, setVisible] = useState(false);
    const updateVisible = () => { setVisible(!visible); }

    const [color, setColor] = useState<Color>('#000000');
    const updateColor = (e: any) => { setColor(e.hex); }

    const undoLine = () => {  }


    function onDraw(ctx: CanvasRenderingContext2D | null, point: Point | null, prevPoint: Point | null) {
        drawLine(prevPoint, point, ctx, color, 4);
    }

    function exportImage () {
        updateImage(getImage());
    }

    function drawLine(start: Point | null, end: Point | null, ctx: CanvasRenderingContext2D | null, color: Color, width: number) {
        start = start ?? end;
        if (!ctx) throw new Error('CanvasRenderingContext not found!');
        if (!start || !end) throw new Error('Coordinates not found!');
        ctx.beginPath();
        ctx.lineWidth = width;
        ctx.strokeStyle = color;
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(start.x, start.y, 2, 0, 2 * Math.PI);
        ctx.fill();
    }

    return(
        <div>
            <button onClick={undoLine}>Undo</button>
            <canvas id='image'
                width={width}
                height={height}
                onMouseDown={onCanvasMouseDown}
                onMouseUp={exportImage}
                style={canvasStyle}
                ref={setCanvasRef}
            />
            <button onClick={updateVisible}>{ visible ? `Hide` : `Show` } Colors</button>
            
            { visible && <SketchPicker color={color} onChangeComplete={updateColor} /> }
            

        </div>
    );
}

export default Canvas;

const canvasStyle = {
    border: "1px solid black",
    background: `#FFF`,
}