'use client'
import { useEffect, useRef, useState } from "react";

interface Point { x: number; y: number; }

export function useOnDraw(onDraw: (ctx: CanvasRenderingContext2D | null, point: Point | null, prevPoint: Point | null) => void) {

    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const isDrawingRef = useRef(false);
    const prevPointRef = useRef<Point | null>(null);

    const mouseMoveListenerRef = useRef<((e: MouseEvent) => void) | null>(null);
    const mouseUpListenerRef = useRef<(() => void) | null>(null);

    const touchMoveListenerRef = useRef<((e: TouchEvent) => void) | null>(null);
    const touchEndListenerRef = useRef<(() => void) | null>(null);

    const [lines, setLines] = useState<string[]>([]);

    function setCanvasRef(ref: HTMLCanvasElement) {
        canvasRef.current = ref;
    }

    function onCanvasMouseDown() {
        isDrawingRef.current = true;
    }

    function getImage () {
        if (canvasRef.current) return canvasRef.current.toDataURL();
        else return `Err`;
    }

    function setImage (img: CanvasImageSource) {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.drawImage(img, 0, 0);
        }
    }

    function writeLine () {
        if (canvasRef.current) setLines([...lines, canvasRef.current.toDataURL()]);
    }

    function undoLine () {
        clearCanvas();
        if (lines.length > 1) {
            lines.pop();
            const last = lines.pop()!;
            const pic = new Image(); pic.src = last;
            pic.onload = () => setImage(pic);
            setLines([...lines, last]);
            return last;
        }
    }

    function clearCanvas () {
        if (canvasRef.current) {
            const ctx = canvasRef.current.getContext('2d');
            ctx?.setTransform(1, 0, 0, 1, 0, 0);
            ctx?.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            setLines([]);
        }
    }


    useEffect(() => {
        function computePointInCanvas(clientX: number, clientY: number) {
            if (canvasRef.current) {
                const boundingRect = canvasRef.current.getBoundingClientRect();
                return {
                    x: clientX - boundingRect.left,
                    y: clientY - boundingRect.top
                }
            } else return null;
        }

        function initMouseMoveListener() {
            const mouseMoveListener = (e: MouseEvent) => {
                if (isDrawingRef.current && canvasRef.current) {
                    const point = computePointInCanvas(e.clientX, e.clientY);
                    const ctx = canvasRef.current.getContext('2d');
                    if (onDraw) onDraw(ctx, point, prevPointRef.current);
                    prevPointRef.current = point;
                }
            }
            mouseMoveListenerRef.current = mouseMoveListener;
            window.addEventListener("mousemove", mouseMoveListener, false);
        }

        function initTouchMoveListener() {
            const touchMoveListener = (e: TouchEvent) => {
                if (isDrawingRef.current && canvasRef.current) {
                    const point = computePointInCanvas(e.touches[0].clientX, e.touches[0].clientY);
                    const ctx = canvasRef.current.getContext('2d');
                    if (onDraw) onDraw(ctx, point, prevPointRef.current);
                    prevPointRef.current = point;
                }
            }
            touchMoveListenerRef.current = touchMoveListener;
            window.addEventListener("touchmove", touchMoveListener, false);
        }

        function initMouseUpListener() {
            const listener = () => {
                isDrawingRef.current = false;
                prevPointRef.current = null;
            }
            mouseUpListenerRef.current = listener;
            touchEndListenerRef.current = listener;
            window.addEventListener("mouseup", listener, false);
            window.addEventListener("touchend", listener, false);
        }

        function cleanup() {
            if (mouseMoveListenerRef.current) {
                window.removeEventListener("mousemove", mouseMoveListenerRef.current);
            }
            if (touchMoveListenerRef.current) {
                window.removeEventListener("touchmove", touchMoveListenerRef.current);
            }
            if (mouseUpListenerRef.current) {
                window.removeEventListener("mouseup", mouseUpListenerRef.current);
            }
            if (touchEndListenerRef.current) {
                window.removeEventListener("touchend", touchEndListenerRef.current);
            }
        }

        initMouseMoveListener();
        initTouchMoveListener();
        initMouseUpListener();
        return () => cleanup();

    }, [onDraw]);

    return { setCanvasRef, onCanvasMouseDown, getImage, clearCanvas, undoLine, writeLine }
};