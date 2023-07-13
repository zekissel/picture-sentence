'use client'
import { useOnDraw } from './_drawUtils';

interface Point { x: number; y: number; }
type Color = `#${string}`;
interface CanvasProps {
    width: number;
    height: number;
    updateImage: (b64: string) => void;
}

const Canvas = ({ width, height, updateImage }: CanvasProps) => {

    const { setCanvasRef, onCanvasMouseDown, getImage } = useOnDraw(onDraw);

    function onDraw(ctx: CanvasRenderingContext2D | null, point: Point | null, prevPoint: Point | null) {
        drawLine(prevPoint, point, ctx, '#000000', 4);
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
            <canvas id='image'
                width={width}
                height={height}
                onMouseDown={onCanvasMouseDown}
                onMouseUp={exportImage}
                style={canvasStyle}
                ref={setCanvasRef}
            />
        </div>
    );
}

export default Canvas;

const canvasStyle = {
    border: "1px solid black"
}