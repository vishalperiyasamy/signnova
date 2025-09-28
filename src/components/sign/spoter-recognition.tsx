"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Activity, Play, StopCircle, Volume2 } from "lucide-react";
import * as tf from '@tensorflow/tfjs';
import { SPOTER } from "@/lib/spoter/spoter-model";
import { processLandmarksSequence } from "@/lib/spoter/landmark-converter";

// Interview-focused vocabulary mapping - dynamically loaded from model
// This will be populated when the model is loaded
const VOCAB_MAPPING: Record<number, string> = {};

// Extended vocabulary for interview context
const INTERVIEW_CONTEXT_MAPPING: Record<string, string> = {
  "hello": "hello",
  "thank": "thank you",
  "yes": "yes",
  "no": "no",
  "experience": "experience",
  "skills": "skills",
  "education": "education",
  "understand": "understand",
  "question": "question",
  "job": "job",
  "work": "work",
  "team": "team",
  "learn": "learn",
  "help": "help",
  "good": "good",
  "bad": "bad",
  "maybe": "maybe",
  "time": "time",
  "salary": "salary",
  "project": "project"
};

interface SPOTERRecognitionProps {
  onPhrase?: (text: string) => void;
}

export const SPOTERRecognition = ({ onPhrase }: SPOTERRecognitionProps = {}) => {
  const [isReady, setIsReady] = useState(false);
  const [running, setRunning] = useState(false);
  const [label, setLabel] = useState<string>("");
  const [score, setScore] = useState<number>(0);
  const [phrase, setPhrase] = useState<string>("");

  const spoterRef = useRef<SPOTER | null>(null);
  const landmarksBufferRef = useRef<Array<any>>([]);
  const lastRecognizedRef = useRef<string | null>(null);
  const lastSpokenAtRef = useRef<number>(0);
  const SPEAK_COOLDOWN_MS = 1500; // avoid repeated speech
  const SEQUENCE_LENGTH = 30; // Number of frames to collect before recognition

  // Initialize SPOTER model
  useEffect(() => {
    let disposed = false;
    const init = async () => {
      try {
        // Load TensorFlow.js
        await tf.ready();
        console.log('TensorFlow.js initialized for SPOTER recognition');
        
        // Fetch model metadata to get vocabulary size
        // For now, we'll use a reasonable default size
        const vocabSize = 30; // This should match the actual model's output size
        
        // Create SPOTER model with dynamic vocabulary mapping
        const spoter = new SPOTER(
          vocabSize,
          '/models/spoter/model.json'
        );
        
        // Load the pre-trained model
        await spoter.load();
        
        // After loading, map the model's vocabulary to our interview context
        // This would ideally come from the model metadata
        for (let i = 0; i < vocabSize; i++) {
          // Default to index as string if no mapping exists
          const baseLabel = `sign_${i}`;
          // Map to interview context if possible
          VOCAB_MAPPING[i] = INTERVIEW_CONTEXT_MAPPING[baseLabel] || baseLabel;
        }
        
        if (!disposed) {
          spoterRef.current = spoter;
          setIsReady(true);
          console.log('SPOTER model ready for inference');
        } else {
          spoter.dispose();
        }
      } catch (e) {
        console.error("Failed to initialize SPOTER:", e);
        setIsReady(false);
      }
    };
    
    init();
    
    return () => {
      disposed = true;
      spoterRef.current?.dispose();
      spoterRef.current = null;
    };
  }, []);

  // Listen for hand tracking events
  useEffect(() => {
    if (!running) return;
    
    const handleHandGesture = (event: Event) => {
      const data = (event as CustomEvent).detail;
      
      // Skip if no landmarks are detected
      if (!data.landmarks || data.landmarks.length === 0) return;
      
      // Add frame to buffer with MediaPipe GestureRecognizer format
      landmarksBufferRef.current.push({
        landmarks: data.landmarks,
        handednesses: data.handednesses,
        // Also include worldLandmarks if available
        worldLandmarks: data.worldLandmarks || null,
        // Include pose landmarks if available
        poseLandmarks: data.poseLandmarks || null
      });
      
      // Keep buffer at fixed size
      if (landmarksBufferRef.current.length > SEQUENCE_LENGTH) {
        landmarksBufferRef.current.shift();
      }
      
      // Process sequence when we have enough frames
      if (landmarksBufferRef.current.length === SEQUENCE_LENGTH) {
        recognizeSign();
      }
    };
    
    window.addEventListener("hands:gesture", handleHandGesture);
    
    return () => {
      window.removeEventListener("hands:gesture", handleHandGesture);
    };
  }, [running]);

  const recognizeSign = useCallback(async () => {
    if (!spoterRef.current || landmarksBufferRef.current.length < SEQUENCE_LENGTH) return;
    
    try {
      // Process landmarks sequence
      const inputTensor = processLandmarksSequence(landmarksBufferRef.current);
      
      // Run inference with the SPOTER model
      const result = await spoterRef.current.predict(inputTensor);
      
      // Update UI with recognition result
      setLabel(result.text);
      setScore(result.confidence);
      
      // Add to phrase if it's a new sign and confidence is high enough
      if (result.confidence > 0.7 && result.text !== lastRecognizedRef.current) {
        lastRecognizedRef.current = result.text;
        setPhrase(prev => prev ? `${prev} ${result.text}` : result.text);
        
        // Call onPhrase callback if provided
        if (onPhrase) {
          onPhrase(result.text);
        }
        
        // Speak the recognized sign if enough time has passed
        const now = Date.now();
        if (now - lastSpokenAtRef.current > SPEAK_COOLDOWN_MS) {
          speak(result.text);
          lastSpokenAtRef.current = now;
        }
      }
      
      // Clean up tensor
      inputTensor.dispose();
    } catch (error) {
      console.error("Error during sign recognition:", error);
    }
  }, [onPhrase]);

  const start = useCallback(() => {
    landmarksBufferRef.current = [];
    lastRecognizedRef.current = null;
    setRunning(true);
  }, []);

  const stop = useCallback(() => {
    setRunning(false);
  }, []);

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
            <Button size="sm" onClick={start} disabled={!isReady} aria-label="Start sign language recognition">
              <Play className="mr-2 h-4 w-4" /> Start Sign → Speech
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={stop} aria-label="Stop sign language recognition">
              <StopCircle className="mr-2 h-4 w-4" /> Stop
            </Button>
          )}
          {!isReady && <span className="text-xs text-muted-foreground">Loading model…</span>}
          <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
            <Activity className={`h-4 w-4 ${running ? "text-green-600" : "text-muted-foreground"}`} />
            {running ? "recognizing" : "idle"}
          </div>
        </div>

        <div className="mt-4 grid gap-2 text-sm">
          <div className="flex items-center justify-between rounded-md border p-2">
            <div>
              <div className="text-xs text-muted-foreground">Recognized sign</div>
              <div className="font-mono">{label || "—"}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Confidence</div>
              <div className="font-mono">{score ? score.toFixed(2) : "0.00"}</div>
            </div>
          </div>

          <div className="rounded-md border p-2">
            <div className="mb-1 text-xs text-muted-foreground">Recognized phrase</div>
            <div className="min-h-9 whitespace-pre-wrap break-words font-medium">{phrase || "Make signs to see recognition…"}</div>
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

export default SPOTERRecognition;