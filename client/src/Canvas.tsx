'use client'
import { useOnDraw } from './_drawUtils';

interface Point { x: number; y: number; }
type Color = `#${string}`;
interface CanvasProps {
    width: number;
    height: number;
}

const Canvas = ({ width, height }: CanvasProps) => {

    const { setCanvasRef, onCanvasMouseDown } = useOnDraw(onDraw);

    function onDraw(ctx: CanvasRenderingContext2D | null, point: Point | null, prevPoint: Point | null) {
        drawLine(prevPoint, point, ctx, '#000000', 4);
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
        <canvas
            width={width}
            height={height}
            onMouseDown={onCanvasMouseDown}
            style={canvasStyle}
            ref={setCanvasRef}
        />
    );
}

export default Canvas;

const canvasStyle = {
    border: "1px solid black"
}