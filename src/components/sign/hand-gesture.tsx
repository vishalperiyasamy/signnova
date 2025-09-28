"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Play, StopCircle, Volume2 } from "lucide-react";
import {
  FilesetResolver,
  GestureRecognizer,
  type GestureRecognizerResult,
} from "@mediapipe/tasks-vision";

// Lightweight mapper from MediaPipe gesture labels to simple gloss words
const GLOSS_MAP: Record<string, string> = {
  Thumb_Up: "GOOD",
  Thumb_Down: "BAD",
  Open_Palm: "HELLO",
  Closed_Fist: "YES",
  Victory: "PEACE",
  ILoveYou: "I LOVE YOU",
};

export const HandGestureRecognizer = () => {
  const [isReady, setIsReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [label, setLabel] = useState<string>("");
  const [score, setScore] = useState<number>(0);
  const [phrase, setPhrase] = useState<string>("");

  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const rafRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastTsRef = useRef<number>(0);
  const stableRef = useRef<{ name: string; frames: number }>({ name: "", frames: 0 });
  // Throttle and one-shot speak helpers
  const lastInferAtRef = useRef<number>(0);
  const lastSpokenAtRef = useRef<number>(0);
  const lastCommittedRef = useRef<string | null>(null);
  const INFER_INTERVAL_MS = 100; // ~10 FPS
  const SPEAK_COOLDOWN_MS = 1500; // avoid repeated speech

  const ensureVideo = async (): Promise<HTMLVideoElement> => {
    // Try to reuse the existing local preview video from Interview page
    const existing = document.getElementById("localVideoEl") as HTMLVideoElement | null;
    if (existing && existing.srcObject) {
      return existing;
    }
    // Fallback: create our own minimal hidden video
    if (!videoRef.current) {
      const v = document.createElement("video");
      v.autoplay = true;
      v.playsInline = true;
      v.muted = true;
      v.style.position = "fixed";
      v.style.opacity = "0";
      v.style.pointerEvents = "none";
      v.style.width = "1px";
      v.style.height = "1px";
      document.body.appendChild(v);
      videoRef.current = v;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
    videoRef.current.srcObject = stream;
    return videoRef.current;
  };

  useEffect(() => {
    let disposed = false;
    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          // Use MediaPipe CDN for WASM files
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
        );
        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task",
          },
          runningMode: "VIDEO",
          numHands: 1,
        });
        if (!disposed) {
          recognizerRef.current = recognizer;
          setIsReady(true);
        } else {
          recognizer.close();
        }
      } catch (e) {
        // keep silent but disable UI
        setIsReady(false);
      }
    };
    init();
    return () => {
      disposed = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      recognizerRef.current?.close();
      recognizerRef.current = null;
      // Cleanup fallback video stream if created
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        videoRef.current.remove();
      }
    };
  }, []);

  const loop = useCallback(async () => {
    const r = recognizerRef.current;
    const video = (document.getElementById("localVideoEl") as HTMLVideoElement) || videoRef.current;
    if (!r || !video) return;

    const now = performance.now();
    // Throttle inference to ~10fps
    if (now - lastInferAtRef.current < INFER_INTERVAL_MS) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }
    lastInferAtRef.current = now;

    const res: GestureRecognizerResult | undefined = r.recognizeForVideo(video, now);

    // Dispatch event with landmarks for SPOTER to use
    if (res && res.landmarks) {
      const event = new CustomEvent("hands:gesture", {
        detail: {
          landmarks: res.landmarks,
          handednesses: res.handednesses,
          worldLandmarks: res.worldLandmarks || null,
          poseLandmarks: null // MediaPipe Gesture doesn't include pose
        }
      });
      window.dispatchEvent(event);
    }

    if (res && res.gestures && res.gestures[0] && res.gestures[0][0]) {
      const top = res.gestures[0][0];
      const name = top.categoryName;
      const score = top.score;
      setLabel(name);
      setScore(score);

      // Stabilize: only accept when same label for N frames and confidence high
      const stable = stableRef.current;
      if (stable.name === name) stable.frames += 1;
      else stableRef.current = { name, frames: 1 };

      const gloss = GLOSS_MAP[name]; // only mapped gestures are spoken
      if (stableRef.current.frames >= 8 && score >= 0.7 && gloss) {
        // Commit once per gesture change, then cooldown before next speech
        if (lastCommittedRef.current !== name) {
          lastCommittedRef.current = name;
          // Replace phrase with a single word (no accumulation)
          setPhrase(gloss);
          if (now - lastSpokenAtRef.current > SPEAK_COOLDOWN_MS) {
            const u = new SpeechSynthesisUtterance(gloss);
            window.speechSynthesis.speak(u);
            lastSpokenAtRef.current = now;
          }
        }
        stableRef.current.frames = 0; // reset stabilization counter
      }
    }

    lastTsRef.current = now;
    rafRef.current = requestAnimationFrame(loop);
  }, []);

  const start = async () => {
    if (!isReady || running) return;
    await ensureVideo();
    setRunning(true);
    rafRef.current = requestAnimationFrame(loop);
  };

  const stop = () => {
    if (!running) return;
    setRunning(false);
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    // reset one-shot state so next run can speak again
    lastCommittedRef.current = null;
    stableRef.current = { name: "", frames: 0 };
  };

  const speak = (text: string) => {
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(u);
  };

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex flex-wrap items-center gap-2">
          {!running ? (
            <Button size="sm" onClick={start} disabled={!isReady} aria-label="Start hand sign recognition">
              <Play className="mr-2 h-4 w-4" /> Start Hand Sign → Speech
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={stop} aria-label="Stop hand sign recognition">
              <StopCircle className="mr-2 h-4 w-4" /> Stop
            </Button>
          )}
          {!isReady && <span className="text-xs text-muted-foreground">Loading on-device model…</span>}
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className={`h-4 w-4 ${running ? "text-green-600" : "text-muted-foreground"}`} />
            {running ? "recognizing" : "idle"}
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-sm">
          <div className="flex items-center justify-between rounded-md border p-2">
            <div>
              <div className="text-xs text-muted-foreground">Top gesture</div>
              <div className="font-mono">{label || "—"}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Confidence</div>
              <div className="font-mono">{score ? score.toFixed(2) : "0.00"}</div>
            </div>
          </div>

          <div className="rounded-md border p-2">
            <div className="mb-1 text-xs text-muted-foreground">Recognized phrase</div>
            <div className="min-h-9 whitespace-pre-wrap break-words font-medium">{phrase || "Make a gesture (e.g., 👍, ✌️, open palm)…"}</div>
            <div className="mt-2 flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setPhrase("")}>Clear</Button>
              <Button size="sm" onClick={() => speak(phrase)} disabled={!phrase}>
                <Volume2 className="mr-2 h-4 w-4" /> Speak
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default HandGestureRecognizer;