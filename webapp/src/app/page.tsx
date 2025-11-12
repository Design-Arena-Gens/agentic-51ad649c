"use client";

import { useEffect, useRef, useState } from "react";

type RecorderStatus = "idle" | "recording" | "processing" | "ready";

const CANVAS_HEIGHT = 540;
const CANVAS_WIDTH = 960;
const FRAME_RATE = 60;

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationRef = useRef<number>();
  const animationStartRef = useRef<number>();
  const [recorderStatus, setRecorderStatus] = useState<RecorderStatus>("idle");
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [displaySize, setDisplaySize] = useState(() => ({
    width: CANVAS_WIDTH,
    height: CANVAS_HEIGHT,
  }));

  useEffect(() => {
    const computeSize = () => {
      const scale = Math.min(window.innerWidth * 0.9, CANVAS_WIDTH);
      setDisplaySize({
        width: scale,
        height: (scale / CANVAS_WIDTH) * CANVAS_HEIGHT,
      });
    };
    computeSize();
    window.addEventListener("resize", computeSize);
    return () => {
      window.removeEventListener("resize", computeSize);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return;
    }

    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = CANVAS_WIDTH * dpr;
      canvas.height = CANVAS_HEIGHT * dpr;
      canvas.style.width = `${displaySize.width}px`;
      canvas.style.height = `${displaySize.height}px`;
      if (ctx.resetTransform) {
        ctx.resetTransform();
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const render = (timestamp: number) => {
      if (!animationStartRef.current) {
        animationStartRef.current = timestamp;
      }
      const elapsed = (timestamp - animationStartRef.current) / 1000;
      paintScene(ctx, elapsed);
      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [displaySize.height, displaySize.width]);

  useEffect(() => {
    return () => {
      if (downloadUrl) {
        URL.revokeObjectURL(downloadUrl);
      }
    };
  }, [downloadUrl]);

  const handleStartRecording = () => {
    if (!canvasRef.current || recorderStatus === "recording") {
      return;
    }

    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
      setDownloadUrl(null);
    }

    const stream = canvasRef.current.captureStream(FRAME_RATE);
    const mimeTypes = [
      "video/webm;codecs=vp9",
      "video/webm;codecs=vp8",
      "video/webm",
    ];
    const mimeType = mimeTypes.find((type) => MediaRecorder.isTypeSupported(type));
    if (!mimeType) {
      alert("MediaRecorder is not supported in this browser");
      return;
    }

    const recorder = new MediaRecorder(stream, {
      mimeType,
      videoBitsPerSecond: 6_000_000,
    });

    recordedChunksRef.current = [];

    recorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        recordedChunksRef.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }
      setRecorderStatus("processing");
      const blob = new Blob(recordedChunksRef.current, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setDownloadUrl(url);
      setRecorderStatus("ready");
    };

    recorder.start();
    mediaRecorderRef.current = recorder;
    setRecorderStatus("recording");
    stopTimeoutRef.current = setTimeout(() => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    }, 8000);
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && recorderStatus === "recording") {
      setRecorderStatus("processing");
      mediaRecorderRef.current.stop();
      if (stopTimeoutRef.current) {
        clearTimeout(stopTimeoutRef.current);
        stopTimeoutRef.current = null;
      }
    }
  };

  const resetRecordingState = () => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    if (downloadUrl) {
      URL.revokeObjectURL(downloadUrl);
    }
    setDownloadUrl(null);
    setRecorderStatus("idle");
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50">
      <header className="mx-auto flex w-full max-w-4xl flex-col gap-4 px-6 pb-10 pt-16 text-center">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Cat Run Video Generator
        </h1>
        <p className="text-base text-slate-300 sm:text-lg">
          Render a playful feline sprinting down a stylized midnight highway and
          capture it as a downloadable video with a single click.
        </p>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-col items-center gap-8 px-6 pb-20">
        <div className="w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-950/60 shadow-2xl">
          <canvas
            ref={canvasRef}
            className="h-full w-full bg-slate-900"
            aria-label="Canvas animation of a cat sprinting down a road"
          />
        </div>

        <section className="flex w-full flex-col items-center gap-4 text-center sm:flex-row sm:justify-center sm:gap-6">
          <button
            className="rounded-full bg-emerald-500 px-8 py-3 text-sm font-semibold tracking-wide text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-emerald-600/60"
            onClick={handleStartRecording}
            disabled={recorderStatus === "recording"}
          >
            {recorderStatus === "recording" ? "Recording…" : "Record 8s Clip"}
          </button>

          <button
            className="rounded-full border border-slate-600 px-6 py-3 text-sm font-semibold tracking-wide text-slate-200 transition hover:border-slate-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-60"
            onClick={handleStopRecording}
            disabled={recorderStatus !== "recording"}
          >
            Stop
          </button>

          {recorderStatus === "ready" && downloadUrl ? (
            <a
              className="rounded-full border border-emerald-500 px-6 py-3 text-sm font-semibold tracking-wide text-emerald-400 transition hover:bg-emerald-500/10"
              href={downloadUrl}
              download="cat-run.webm"
              onClick={resetRecordingState}
            >
              Download Video
            </a>
          ) : (
            <div className="text-sm text-slate-400">
              {recorderStatus === "processing"
                ? "Encoding clip…"
                : "Recording saves as a WebM clip."}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

function paintScene(ctx: CanvasRenderingContext2D, elapsed: number) {
  const width = CANVAS_WIDTH;
  const height = CANVAS_HEIGHT;

  ctx.clearRect(0, 0, width, height);
  drawSky(ctx, elapsed, width, height);
  drawStars(ctx, elapsed, width, height);
  drawMountains(ctx, width, height);
  drawRoad(ctx, elapsed, width, height);
  drawCat(ctx, elapsed, width, height);
}

function drawSky(
  ctx: CanvasRenderingContext2D,
  elapsed: number,
  width: number,
  height: number,
) {
  const gradient = ctx.createLinearGradient(0, 0, 0, height * 0.8);
  gradient.addColorStop(0, "#061a33");
  gradient.addColorStop(0.4, "#0d2c4d");
  gradient.addColorStop(1, "#112");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const moonRadius = 38;
  const moonX = width - 120;
  const moonY = 110 + Math.sin(elapsed * 0.4) * 6;
  ctx.fillStyle = "#f7f3df";
  ctx.beginPath();
  ctx.arc(moonX, moonY, moonRadius, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#061a33";
  ctx.beginPath();
  ctx.arc(moonX + 18, moonY - 10, moonRadius * 0.74, 0, Math.PI * 2);
  ctx.fill();
}

function drawStars(
  ctx: CanvasRenderingContext2D,
  elapsed: number,
  width: number,
  height: number,
) {
  ctx.fillStyle = "#ffffff";
  const starCount = 80;
  for (let i = 0; i < starCount; i += 1) {
    const twinkle = (Math.sin(elapsed * 2 + i) + 1) / 2;
    const radius = 1.2 + twinkle * 1.4;
    ctx.globalAlpha = 0.4 + twinkle * 0.6;
    ctx.beginPath();
    ctx.arc((i * 47) % width, ((i * 89) % height) * 0.35 + 20, radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawMountains(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  ctx.fillStyle = "#0b2238";
  ctx.beginPath();
  ctx.moveTo(0, height * 0.7);
  ctx.lineTo(width * 0.18, height * 0.45);
  ctx.lineTo(width * 0.36, height * 0.7);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#092035";
  ctx.beginPath();
  ctx.moveTo(width * 0.2, height * 0.7);
  ctx.lineTo(width * 0.46, height * 0.38);
  ctx.lineTo(width * 0.72, height * 0.7);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#07182a";
  ctx.beginPath();
  ctx.moveTo(width * 0.55, height * 0.7);
  ctx.lineTo(width * 0.86, height * 0.42);
  ctx.lineTo(width, height * 0.7);
  ctx.closePath();
  ctx.fill();
}

function drawRoad(
  ctx: CanvasRenderingContext2D,
  elapsed: number,
  width: number,
  height: number,
) {
  const roadTop = height * 0.52;
  ctx.fillStyle = "#1a1f2a";
  ctx.beginPath();
  ctx.moveTo(0, height);
  ctx.lineTo(width * 0.15, roadTop);
  ctx.lineTo(width * 0.85, roadTop);
  ctx.lineTo(width, height);
  ctx.closePath();
  ctx.fill();

  ctx.strokeStyle = "#2d3344";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(width * 0.15, roadTop);
  ctx.lineTo(0, height);
  ctx.moveTo(width * 0.85, roadTop);
  ctx.lineTo(width, height);
  ctx.stroke();

  const dashCount = 12;
  const dashLength = 90;
  const dashSpacing = 180;
  const offset = (elapsed * 320) % (dashLength + dashSpacing);
  ctx.fillStyle = "#d7e7ff";

  for (let i = -1; i < dashCount; i += 1) {
    const position = offset + i * (dashLength + dashSpacing);
    const topWidth = 14;
    const bottomWidth = 40;
    const topY = roadTop + ((height - roadTop) * (position / (width * 1.2)));
    if (topY > height) {
      continue;
    }
    const bottomY = topY + 90;
    ctx.beginPath();
    ctx.moveTo(width / 2 - topWidth, topY);
    ctx.lineTo(width / 2 + topWidth, topY);
    ctx.lineTo(width / 2 + bottomWidth, bottomY);
    ctx.lineTo(width / 2 - bottomWidth, bottomY);
    ctx.closePath();
    ctx.globalAlpha = 0.65;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawCat(
  ctx: CanvasRenderingContext2D,
  elapsed: number,
  width: number,
  height: number,
) {
  const baseY = height * 0.58;
  const bob = Math.sin(elapsed * 8) * 8;
  const catX = width * 0.32;
  const catY = baseY + bob;

  const tailSwing = Math.sin(elapsed * 6) * 0.6;
  const legPhase = elapsed * 12;

  // Shadow
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.beginPath();
  ctx.ellipse(catX + 40, baseY + 40, 90, 24, 0, 0, Math.PI * 2);
  ctx.fill();

  // Tail
  ctx.strokeStyle = "#f4b041";
  ctx.lineCap = "round";
  ctx.lineWidth = 16;
  ctx.beginPath();
  ctx.moveTo(catX - 36, catY - 32);
  ctx.quadraticCurveTo(
    catX - 80,
    catY - 50 + tailSwing * 20,
    catX - 68,
    catY - 92 + tailSwing * 40,
  );
  ctx.stroke();

  // Body
  ctx.fillStyle = "#fbc75d";
  ctx.beginPath();
  ctx.ellipse(catX, catY, 120, 60, -0.1, 0, Math.PI * 2);
  ctx.fill();

  // Spots
  ctx.fillStyle = "#f59e42";
  ctx.beginPath();
  ctx.ellipse(catX + 30, catY - 8, 46, 26, 0.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(catX - 48, catY + 4, 30, 20, -0.3, 0, Math.PI * 2);
  ctx.fill();

  // Head
  const headX = catX + 110;
  const headY = catY - 28;
  ctx.fillStyle = "#fbc75d";
  ctx.beginPath();
  ctx.ellipse(headX, headY, 55, 48, 0, 0, Math.PI * 2);
  ctx.fill();

  // Ears
  ctx.fillStyle = "#fbc75d";
  ctx.beginPath();
  ctx.moveTo(headX - 28, headY - 40);
  ctx.lineTo(headX - 12, headY - 86);
  ctx.lineTo(headX + 4, headY - 44);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(headX + 14, headY - 38);
  ctx.lineTo(headX + 28, headY - 84);
  ctx.lineTo(headX + 42, headY - 34);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "#f8d48a";
  ctx.beginPath();
  ctx.moveTo(headX - 20, headY - 42);
  ctx.lineTo(headX - 12, headY - 70);
  ctx.lineTo(headX, headY - 38);
  ctx.closePath();
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(headX + 16, headY - 40);
  ctx.lineTo(headX + 26, headY - 70);
  ctx.lineTo(headX + 36, headY - 36);
  ctx.closePath();
  ctx.fill();

  // Face
  ctx.fillStyle = "#1e1b4b";
  ctx.beginPath();
  ctx.arc(headX - 18, headY - 6, 6, 0, Math.PI * 2);
  ctx.arc(headX + 14, headY - 8, 6, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "#1e1b4b";
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(headX - 4, headY + 4);
  ctx.quadraticCurveTo(headX + 4, headY + 12, headX + 22, headY + 6);
  ctx.stroke();

  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(headX + 12, headY + 4);
  ctx.quadraticCurveTo(headX + 18, headY + 14, headX + 32, headY + 10);
  ctx.moveTo(headX + 8, headY + 10);
  ctx.quadraticCurveTo(headX + 16, headY + 22, headX + 30, headY + 18);
  ctx.stroke();

  // Collar
  ctx.fillStyle = "#ef4444";
  ctx.beginPath();
  ctx.ellipse(headX, headY + 22, 66, 18, 0, 0, Math.PI * 2);
  ctx.fill();

  // Bell
  ctx.fillStyle = "#facc15";
  ctx.beginPath();
  ctx.arc(headX + 2, headY + 34, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#0f172a";
  ctx.beginPath();
  ctx.arc(headX + 2, headY + 34, 3, 0, Math.PI * 2);
  ctx.fill();

  // Legs
  drawLeg(ctx, catX - 20, catY + 40, legPhase, 0);
  drawLeg(ctx, catX + 32, catY + 36, legPhase, Math.PI);
  drawLeg(ctx, catX + 68, catY + 40, legPhase, Math.PI / 2);
  drawLeg(ctx, catX + 4, catY + 36, legPhase, (Math.PI * 3) / 2);
}

function drawLeg(
  ctx: CanvasRenderingContext2D,
  baseX: number,
  baseY: number,
  phase: number,
  offset: number,
) {
  const swing = Math.sin(phase + offset);
  const kneeX = baseX + swing * 22;
  const kneeY = baseY + 24;
  const pawX = baseX + swing * 36;
  const pawY = baseY + 64 + Math.max(0, -swing) * 20;

  ctx.strokeStyle = "#f59e42";
  ctx.lineWidth = 16;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(baseX, baseY);
  ctx.quadraticCurveTo(kneeX, kneeY, pawX, pawY);
  ctx.stroke();

  ctx.fillStyle = "#f7a34d";
  ctx.beginPath();
  ctx.ellipse(pawX, pawY, 16, 10, 0.3, 0, Math.PI * 2);
  ctx.fill();
}
