'use client'
import { useState } from 'react';
import { useOnDraw } from '../lib/_drawUtils';
import { SketchPicker } from 'react-color';

interface Point { x: number; y: number; }
type Color = `#${string}`;
interface CanvasProps {
    width: number;
    height: number;
    updateImage: (b64: string) => void;
}

const Canvas = ({ width, height, updateImage }: CanvasProps) => {

    const { setCanvasRef, onCanvasMouseDown, getImage, clearCanvas, undoLine } = useOnDraw(onDraw);

    const [visible, setVisible] = useState(false);
    const updateVisible = () => { setVisible(!visible); }

    const [color, setColor] = useState<Color>('#000000');
    const updateColor = (e: any) => { setColor(e.hex); }

    const [size, setSize] = useState(4);
    const updateSize = (e: any) => { setSize(e.target.value) }


    function onDraw(ctx: CanvasRenderingContext2D | null, point: Point | null, prevPoint: Point | null) {
        drawLine(prevPoint, point, ctx, color, size);
    }

    function exportImage () {
        updateImage(getImage());
    }

    function undo () {
        const prev = undoLine();
        updateImage(prev ?? ``);
    }

    function clear () {
        clearCanvas();
        updateImage(``);
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
        ctx.arc(start.x, start.y, Math.sqrt(width), 0, 2 * Math.PI);
        ctx.fill();
    }

    return(
        <div>
            <button onClick={undo} style={buttonStyle}>Undo</button>
            <button onClick={clear} style={buttonStyle}>Clear</button>
            <button onClick={updateVisible} style={buttonStyle}>{ visible ? `Hide` : `Show` } Tools</button>

            { visible &&
            <div className='tools'>
                <label htmlFor='size'>Size: { size }<input id='size' type='range' onChange={updateSize} min={1} max={20} step={1} value={size}/></label>
                <SketchPicker color={color} onChangeComplete={updateColor} />
            </div>
            }

            <div className='canvaswrap'>
                <canvas id='image'
                    width={width}
                    height={height}
                    onMouseDown={onCanvasMouseDown}
                    onTouchStart={onCanvasMouseDown}
                    onMouseUp={exportImage}
                    onTouchEnd={exportImage}
                    style={canvasStyle}
                    ref={setCanvasRef}
                />
            </div>

        </div>
    );
}

export default Canvas;

const canvasStyle = {
    border: "1px solid black",
    background: `#FFF`,
}

const buttonStyle = { width: `fit-content`, height: `fit-content`, margin: `1%` }