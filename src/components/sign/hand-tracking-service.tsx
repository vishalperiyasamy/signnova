"use client";

import { useEffect, useRef } from "react";
import {
  FilesetResolver,
  GestureRecognizer,
  type GestureRecognizerResult,
} from "@mediapipe/tasks-vision";

// This component runs in the background without rendering any UI.
// It tracks hands using MediaPipe and dispatches window events with raw data
// for downstream models to consume. No skeleton/landmarks are drawn.
//
// Listen elsewhere with:
// window.addEventListener("hands:gesture", (e) => {
//   const data = (e as CustomEvent).detail;
//   // data: { ts, topGesture, gestures, handednesses, landmarks, worldLandmarks }
// });

export const HandTrackingService = () => {
  const recognizerRef = useRef<GestureRecognizer | null>(null);
  const rafRef = useRef<number | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const lastInferAtRef = useRef<number>(0);

  const INFER_INTERVAL_MS = 100; // ~10 fps

  useEffect(() => {
    // Only activate in the Interview room to avoid unexpected camera usage on other pages
    const isInterviewRoute =
      typeof window !== "undefined" && window.location?.pathname === "/interview";
    if (!isInterviewRoute) return;

    // Guard: only run in the browser, secure contexts, and when mediaDevices is available
    if (
      typeof window === "undefined" ||
      typeof document === "undefined" ||
      typeof navigator === "undefined" ||
      !("mediaDevices" in navigator) ||
      ("isSecureContext" in window && !window.isSecureContext)
    ) {
      return;
    }

    let disposed = false;

    const ensureVideoReady = async (v: HTMLVideoElement) => {
      if (v.readyState < 2 || v.videoWidth === 0 || v.videoHeight === 0) {
        await new Promise<void>((resolve) => {
          const onReady = () => {
            v.removeEventListener("loadedmetadata", onReady);
            v.removeEventListener("loadeddata", onReady);
            resolve();
          };
          v.addEventListener("loadedmetadata", onReady, { once: true });
          v.addEventListener("loadeddata", onReady, { once: true });
        });
      }
      try {
        await v.play();
      } catch {
        // autoplay might be blocked; we'll still guard on readyState/videoWidth
      }
    };

    const ensureVideo = async (): Promise<HTMLVideoElement | null> => {
      // Prefer reusing an existing local preview video if available
      const existing = document.getElementById("localVideoEl") as HTMLVideoElement | null;
      if (existing && existing.srcObject) {
        await ensureVideoReady(existing);
        return existing;
      }

      // Otherwise create a hidden, minimal video element
      if (!videoRef.current) {
        const v = document.createElement("video");
        v.autoplay = true;
        v.playsInline = true;
        v.muted = true;
        // Hide from UI and interactions
        v.style.position = "fixed";
        v.style.opacity = "0";
        v.style.pointerEvents = "none";
        v.style.width = "1px";
        v.style.height = "1px";
        v.setAttribute("aria-hidden", "true");
        document.body.appendChild(v);
        videoRef.current = v;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await ensureVideoReady(videoRef.current);
        }
        return videoRef.current;
      } catch (err) {
        // If camera permission denied or not available, gracefully stop
        return null;
      }
    };

    const init = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.22-rc.20250304/wasm"
        );
        const recognizer = await GestureRecognizer.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              "https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/latest/gesture_recognizer.task",
          },
          runningMode: "VIDEO",
          numHands: 2,
        });
        if (disposed) {
          recognizer.close();
          return;
        }
        recognizerRef.current = recognizer;

        const video = await ensureVideo();
        if (!video) return; // cannot start without camera

        const loop = () => {
          const r = recognizerRef.current;
          if (!r || !video) return;

          // Pause the loop if tab is hidden to avoid unnecessary work
          if (document.hidden) {
            rafRef.current = requestAnimationFrame(loop);
            return;
          }

          // Guard against zero-dimension frames or not-ready state
          if (
            video.readyState < 2 ||
            !Number.isFinite(video.videoWidth) ||
            !Number.isFinite(video.videoHeight) ||
            video.videoWidth <= 0 ||
            video.videoHeight <= 0
          ) {
            rafRef.current = requestAnimationFrame(loop);
            return;
          }

          const now = performance.now();
          if (now - lastInferAtRef.current < INFER_INTERVAL_MS) {
            rafRef.current = requestAnimationFrame(loop);
            return;
          }
          lastInferAtRef.current = now;

          try {
            const res = r.recognizeForVideo(video, now as unknown as number) as unknown as GestureRecognizerResult | undefined;
            if (res) {
              // Build a small payload for downstream usage
              const gestures = res.gestures ?? [];
              const topGesture = gestures[0]?.[0] || null;
              const handednesses = res.handednesses ?? [];
              const landmarks = res.landmarks ?? [];
              const worldLandmarks = res.worldLandmarks ?? [];

              // Dispatch as a window event so any consumer can subscribe
              window.dispatchEvent(
                new CustomEvent("hands:gesture", {
                  detail: {
                    ts: now,
                    topGesture,
                    gestures,
                    handednesses,
                    landmarks,
                    worldLandmarks,
                  },
                })
              );
            }
          } catch {
            // If recognizer throws due to transient state, skip this frame
          }

          rafRef.current = requestAnimationFrame(loop);
        };

        rafRef.current = requestAnimationFrame(loop);
      } catch (e) {
        // Fail silently; service stays inactive
      }
    };

    init();

    return () => {
      // Teardown
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      recognizerRef.current?.close();
      recognizerRef.current = null;
      // Clean up hidden video stream if we created one
      if (videoRef.current && videoRef.current.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
        videoRef.current.remove();
        videoRef.current = null;
      }
    };
  }, []);

  // Render nothing (no UI, no skeleton drawing)
  return null;
};

export default HandTrackingService;