"use client";

import React, { useRef, useEffect, useCallback } from"react";

export interface ClickSparkProps {
 sparkColor?: string;
 sparkSize?: number;
 sparkRadius?: number;
 sparkCount?: number;
 duration?: number;
 easing?:"linear"|"ease-in"|"ease-out"|"ease-in-out";
 extraScale?: number;
 children?: React.ReactNode;
 global?: boolean;
}

interface Spark {
 x: number;
 y: number;
 angle: number;
 startTime: number;
 color: string;
}

/**
 * ClickSpark — ReactBits particle spark burst effect.
 * Works both as a container wrapper and as a full-page global overlay.
 */
export function ClickSpark({
 sparkColor ="#000",
 sparkSize = 10,
 sparkRadius = 15,
 sparkCount = 8,
 duration = 400,
 easing ="ease-out",
 extraScale = 1.0,
 global = false,
 children,
}: ClickSparkProps) {
 const canvasRef = useRef<HTMLCanvasElement>(null);
 const sparksRef = useRef<Spark[]>([]);
 const animIdRef = useRef<number | null>(null);

 // Resize canvas to match screen/parent with Device Pixel Ratio for crispness
 const resizeCanvas = useCallback(() => {
 const canvas = canvasRef.current;
 if (!canvas) return;

 const dpr = typeof window !=="undefined"? window.devicePixelRatio || 1 : 1;
 let width = window.innerWidth;
 let height = window.innerHeight;

 if (!global && canvas.parentElement) {
 const rect = canvas.parentElement.getBoundingClientRect();
 width = rect.width;
 height = rect.height;
 }

 if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
 canvas.width = width * dpr;
 canvas.height = height * dpr;
 canvas.style.width = `${width}px`;
 canvas.style.height = `${height}px`;
 }
 }, [global]);

 useEffect(() => {
 resizeCanvas();
 const handleResize = () => resizeCanvas();
 window.addEventListener("resize", handleResize);
 return () => window.removeEventListener("resize", handleResize);
 }, [resizeCanvas]);

 const easeFunc = useCallback(
 (t: number) => {
 switch (easing) {
 case"linear":
 return t;
 case"ease-in":
 return t * t;
 case"ease-in-out":
 return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
 default:
 return t * (2 - t);
 }
 },
 [easing]
 );

 const startAnimation = useCallback(() => {
 if (animIdRef.current !== null) return;

 const canvas = canvasRef.current;
 if (!canvas) return;
 const ctx = canvas.getContext("2d");
 if (!ctx) return;

 const draw = (timestamp: number) => {
 const dpr = typeof window !=="undefined"? window.devicePixelRatio || 1 : 1;
 ctx.clearRect(0, 0, canvas.width, canvas.height);

 sparksRef.current = sparksRef.current.filter((spark: Spark) => {
 const elapsed = timestamp - spark.startTime;
 if (elapsed >= duration) return false;

 const progress = elapsed / duration;
 const eased = easeFunc(progress);

 const distance = eased * sparkRadius * extraScale * dpr;
 const lineLength = sparkSize * (1 - eased) * dpr;

 const x1 = spark.x * dpr + distance * Math.cos(spark.angle);
 const y1 = spark.y * dpr + distance * Math.sin(spark.angle);
 const x2 = spark.x * dpr + (distance + lineLength) * Math.cos(spark.angle);
 const y2 = spark.y * dpr + (distance + lineLength) * Math.sin(spark.angle);

 ctx.strokeStyle = spark.color;
 ctx.lineWidth = 2 * dpr;
 ctx.lineCap ="round";
 ctx.beginPath();
 ctx.moveTo(x1, y1);
 ctx.lineTo(x2, y2);
 ctx.stroke();

 return true;
 });

 if (sparksRef.current.length > 0) {
 animIdRef.current = requestAnimationFrame(draw);
 } else {
 ctx.clearRect(0, 0, canvas.width, canvas.height);
 animIdRef.current = null;
 }
 };

 animIdRef.current = requestAnimationFrame(draw);
 }, [duration, easeFunc, sparkRadius, sparkSize, extraScale]);

 const addSparksAt = useCallback(
 (clientX: number, clientY: number) => {
 const canvas = canvasRef.current;
 if (!canvas) return;

 const rect = canvas.getBoundingClientRect();
 const x = clientX - rect.left;
 const y = clientY - rect.top;

 const now = performance.now();

 const newSparks: Spark[] = Array.from({ length: sparkCount }, (_, i) => ({
 x,
 y,
 angle: (2 * Math.PI * i) / sparkCount,
 startTime: now,
 color: sparkColor,
 }));

 sparksRef.current.push(...newSparks);
 startAnimation();
 },
 [sparkColor, sparkCount, startAnimation]
 );

 // Global window click listener
 useEffect(() => {
 if (!global) return;

 const handlePointerDown = (e: PointerEvent) => {
 addSparksAt(e.clientX, e.clientY);
 };

 window.addEventListener("pointerdown", handlePointerDown, { passive: true });
 return () => {
 window.removeEventListener("pointerdown", handlePointerDown);
 };
 }, [global, addSparksAt]);

 if (global) {
 return (
 <canvas
 ref={canvasRef}
 className="pointer-events-none fixed inset-0 z-[999999] h-full w-full"
 aria-hidden="true"
 />
 );
 }

 return (
 <div
 className="relative h-full w-full"
 onClick={(e) => addSparksAt(e.clientX, e.clientY)}
 >
 <canvas
 ref={canvasRef}
 className="pointer-events-none absolute inset-0 z-50 h-full w-full"
 aria-hidden="true"
 />
 {children}
 </div>
 );
}

export default ClickSpark;
