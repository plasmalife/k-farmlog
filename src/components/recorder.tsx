"use client";
import { useEffect, useRef, useState } from "react";
import { Mic, Square, RotateCcw } from "lucide-react";
import { runAI } from "@/lib/repository";
import { readableError } from "@/lib/domain";
export default function Recorder({
  context,
  onResult,
  disabled = false,
  onBusy,
}: {
  context: string;
  onResult: (result: Awaited<ReturnType<typeof runAI>>) => void;
  disabled?: boolean;
  onBusy?: (busy: boolean) => void;
}) {
  const recorder = useRef<MediaRecorder | null>(null),
    stream = useRef<MediaStream | null>(null),
    chunks = useRef<Blob[]>([]),
    last = useRef<Blob | null>(null);
  const [recording, setRecording] = useState(false),
    [starting, setStarting] = useState(false),
    [busy, setBusy] = useState(false),
    [seconds, setSeconds] = useState(0),
    [error, setError] = useState("");
  useEffect(
    () => () => {
      if (recorder.current?.state === "recording") {
        recorder.current.onstop = null;
        recorder.current.stop();
      }
      stream.current?.getTracks().forEach((t) => t.stop());
      last.current = null;
    },
    [],
  );
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);
  useEffect(() => {
    if (seconds >= 180 && recording) recorder.current?.stop();
  }, [seconds, recording]);
  async function transcribe(blob: Blob) {
    onBusy?.(true);
    setBusy(true);
    setError("");
    try {
      const form = new FormData();
      form.set("kind", "transcribe");
      form.set("context", context);
      form.set(
        "file",
        blob,
        blob.type.includes("mp4") ? "voice.mp4" : "voice.webm",
      );
      onResult(await runAI(form));
      last.current = null;
    } catch (e) {
      setError(readableError(e));
    } finally {
      setBusy(false);
      onBusy?.(false);
    }
  }
  async function start() {
    setStarting(true);
    onBusy?.(true);
    setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder)
        throw new Error(
          "이 브라우저는 녹음을 지원하지 않습니다. 글로 입력해 주세요.",
        );
      stream.current = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      const mime = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(
        (t) => MediaRecorder.isTypeSupported(t),
      );
      const r = new MediaRecorder(
        stream.current,
        mime ? { mimeType: mime, audioBitsPerSecond: 48000 } : undefined,
      );
      recorder.current = r;
      chunks.current = [];
      r.ondataavailable = (e) => {
        if (e.data.size) chunks.current.push(e.data);
      };
      r.onstop = () => {
        setRecording(false);
        stream.current?.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks.current, { type: r.mimeType });
        chunks.current = [];
        last.current = blob;
        void transcribe(blob);
      };
      r.start(1000);
      setSeconds(0);
      setRecording(true);
    } catch (e) {
      stream.current?.getTracks().forEach((t) => t.stop());
      onBusy?.(false);
      setError(
        e instanceof DOMException && e.name === "NotAllowedError"
          ? "마이크 사용이 허용되지 않았습니다. 브라우저 권한을 확인하거나 글로 입력해 주세요."
          : readableError(e),
      );
    } finally {
      setStarting(false);
    }
  }
  return (
    <div className="recorder">
      <button
        className={`record-button ${recording ? "recording" : ""}`}
        disabled={busy || starting || disabled}
        onClick={() => (recording ? recorder.current?.stop() : void start())}
      >
        {recording ? <Square size={30} /> : <Mic size={32} />}
        <span>
          {busy
            ? "말씀하신 내용을 정리하고 있어요"
            : recording
              ? `녹음 마치기 · ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`
              : "녹음 시작"}
        </span>
      </button>
      <p className="hint">한 번에 최대 3분 · 음성 파일은 보관하지 않습니다.</p>
      {error && (
        <div className="error" role="alert">
          {error}
          {last.current && (
            <button
              className="text-button"
              disabled={busy}
              onClick={() => void transcribe(last.current!)}
            >
              <RotateCcw size={16} /> 다시 변환하기
            </button>
          )}
        </div>
      )}
    </div>
  );
}
