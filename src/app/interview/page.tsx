"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, Video, VideoOff, PhoneOff, RefreshCcw, Download, Activity, Play, StopCircle, Volume2, Settings, Info as InfoIcon } from "lucide-react";
import HandGestureRecognizer from "@/components/sign/hand-gesture";
import SPOTERRecognition from "@/components/sign/spoter-recognition";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";

export default function InterviewRoom() {
  // Auth protection
  const { data: session, isPending } = useSession();
  const router = useRouter();
  useEffect(() => {
    if (!isPending && !session?.user) {
      router.push(`/login?redirect=${encodeURIComponent("/interview")}`);
    }
  }, [isPending, session, router]);

  // Attach bearer token to room API requests
  const authHeaders = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  // Redirect helper on 401
  const ensureAuthedOrRedirect = (res: Response) => {
    if (res.status === 401) {
      router.push(`/login?redirect=${encodeURIComponent("/interview")}`);
      return false;
    }
    return true;
  };

  // Quick Tour (one-time)
  const [showTour, setShowTour] = useState(false);
  useEffect(() => {
    try {
      const seen = typeof window !== "undefined" ? localStorage.getItem("aurasign_tour_seen_v1") : "1";
      if (!seen) setShowTour(true);
    } catch {}
  }, []);
  const dismissTour = () => {
    try {
      localStorage.setItem("aurasign_tour_seen_v1", "1");
    } catch {}
    setShowTour(false);
  };

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pc1Ref = useRef<RTCPeerConnection | null>(null);
  const pc2Ref = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lobby state
  const [mode, setMode] = useState<"create" | "join">("create");
  const [roomName, setRoomName] = useState("aurasign-demo");
  const [roomPassword, setRoomPassword] = useState("aura1234");
  const [hasJoined, setHasJoined] = useState(false);

  // Signaling state
  const peerIdRef = useRef<string>("");
  const otherPeerIdRef = useRef<string | null>(null);
  const pollTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isHostRef = useRef<boolean>(false);

  // Recording state
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  // Audio recognition state
  const [speechSupported, setSpeechSupported] = useState(false);
  const [recognizing, setRecognizing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<any>(null);
  const [interim, setInterim] = useState("");
  const shouldRestartRef = useRef(false);
  const finalCountRef = useRef(0);

  // Detect Speech API support early (pre-initialization)
  useEffect(() => {
    const SR = (typeof window !== "undefined" && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition)) as
      | (new () => SpeechRecognition)
      | undefined;
    setSpeechSupported(!!SR);
  }, []);

  // Mic activity meter
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micLevelRef = useRef<number>(0);
  const [micActive, setMicActive] = useState(false);
  const levelTimerRef = useRef<number | null>(null);

  // Meet-style UI state
  // ... keep role and feature toggles if needed in future
  // const [role, setRole] = useState<"interviewer" | "candidate">("candidate");
  // const [enableSpeechToSign, setEnableSpeechToSign] = useState(true);
  // const [enableSignToSpeech, setEnableSignToSpeech] = useState(true);

  // Sidebar translation preferences (per-user)
  const [receiveAs, setReceiveAs] = useState<"avatar" | "transcript" | "audio">("transcript");
  const [showAvatar, setShowAvatar] = useState(true);
  const [showTranscript, setShowTranscript] = useState(true);
  const [sendSignAsSpeech, setSendSignAsSpeech] = useState(true);
  
  // Subtitle display state
  interface Subtitle {
    id: string;
    speaker: string;
    text: string;
    timestamp: number;
  }
  const [subtitles, setSubtitles] = useState<Subtitle[]>([]);
  
  // Function to add a new subtitle entry
  const addSubtitle = (speaker: string, text: string) => {
    const newSubtitle: Subtitle = {
      id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
      speaker,
      text,
      timestamp: Date.now()
    };
    
    setSubtitles(prev => {
      // Keep only the last 50 subtitles to prevent memory issues
      const updated = [...prev, newSubtitle];
      if (updated.length > 50) {
        return updated.slice(-50);
      }
      return updated;
    });
  };

  // Draggable PiP state
  const pipRef = useRef<HTMLDivElement | null>(null);
  const [pipPos, setPipPos] = useState<{ x: number; y: number }>({ x: 24, y: 24 });
  const draggingRef = useRef<{ active: boolean; startX: number; startY: number; origX: number; origY: number }>({ active: false, startX: 0, startY: 0, origX: 0, origY: 0 });

  function onPipPointerDown(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault();
    const pt = "touches" in e ? e.touches[0] : (e as React.MouseEvent);
    draggingRef.current = { active: true, startX: pt.clientX, startY: pt.clientY, origX: pipPos.x, origY: pipPos.y };
    window.addEventListener("pointermove", onPipPointerMove as any);
    window.addEventListener("pointerup", onPipPointerUp as any);
    window.addEventListener("touchmove", onPipPointerMove as any, { passive: false });
    window.addEventListener("touchend", onPipPointerUp as any);
  }
  function onPipPointerMove(e: PointerEvent | TouchEvent) {
    e.preventDefault();
    const pt = (e as TouchEvent).touches ? (e as TouchEvent).touches[0] : (e as PointerEvent);
    const dx = pt.clientX - draggingRef.current.startX;
    const dy = pt.clientY - draggingRef.current.startY;
    const next = { x: draggingRef.current.origX + dx, y: draggingRef.current.origY + dy };
    setPipPos(next);
  }
  function onPipPointerUp() {
    draggingRef.current.active = false;
    window.removeEventListener("pointermove", onPipPointerMove as any);
    window.removeEventListener("pointerup", onPipPointerUp as any);
    window.removeEventListener("touchmove", onPipPointerMove as any);
    window.removeEventListener("touchend", onPipPointerUp as any);
  }

  async function ensureLocalMedia() {
    if (streamRef.current) return streamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    streamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
    // setup mic level analyser
    try {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtxRef.current.createMediaStreamSource(stream);
      analyserRef.current = audioCtxRef.current.createAnalyser();
      analyserRef.current.fftSize = 512;
      source.connect(analyserRef.current);
      const data = new Uint8Array(analyserRef.current.frequencyBinCount);
      const loop = () => {
        if (!analyserRef.current) return;
        analyserRef.current.getByteTimeDomainData(data);
        // Compute RMS
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        micLevelRef.current = Math.sqrt(sum / data.length);
        setMicActive(micLevelRef.current > 0.02); // simple threshold
        levelTimerRef.current = requestAnimationFrame(loop);
      };
      levelTimerRef.current = requestAnimationFrame(loop);
    } catch {
      // ignore analyser errors
    }
    return stream;
  }

  function createPeer() {
    if (pc1Ref.current) return pc1Ref.current;
    const pc = new RTCPeerConnection();
    pc.ondatachannel = (e) => {
      setupDataChannel(e.channel);
    };
    pc.onicecandidate = async (e) => {
      if (e.candidate && otherPeerIdRef.current) {
        await fetch("/api/rooms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            name: roomName,
            to: otherPeerIdRef.current,
            message: { type: "ice", from: peerIdRef.current, payload: e.candidate },
          }),
        }).catch(() => {});
      }
    };
    pc.ontrack = (e) => {
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = e.streams[0];
    };
    // If we're the host, proactively create a data channel
    if (isHostRef.current) {
      const dc = pc.createDataChannel("aurasign");
      setupDataChannel(dc);
    }
    pc1Ref.current = pc;
    return pc;
  }

  function setupDataChannel(dc: RTCDataChannel) {
    dataChannelRef.current = dc;
    dc.onopen = () => {
      // Channel ready - send current settings to sync
      sendSettingsSync();
    };
    dc.onclose = () => {
      if (dataChannelRef.current === dc) dataChannelRef.current = null;
    };
    dc.onerror = () => {};
    dc.onmessage = (evt) => {
      try {
        const msg = JSON.parse(evt.data);
        if (msg?.type === "tts" && typeof msg.text === "string" && msg.text) {
          const u = new SpeechSynthesisUtterance(msg.text);
          window.speechSynthesis.speak(u);
          
          // Add to subtitles with speaker info
          const speakerType = "Remote";
          addSubtitle(speakerType, msg.text);
        } else if (msg?.type === "settings" && typeof msg.settings === "object") {
          // Apply remote settings changes
          applyRemoteSettings(msg.settings);
        } else if (msg?.type === "transcript" && typeof msg.text === "string" && msg.text) {
          // Add remote transcript to subtitles
          const speakerType = "Remote";
          addSubtitle(speakerType, msg.text);
        }
      } catch {
        // ignore non-JSON
      }
    };
  }

  function sendRemoteTTS(text: string) {
    const dc = dataChannelRef.current;
    if (!text || !dc || dc.readyState !== "open") return;
    try {
      dc.send(JSON.stringify({ type: "tts", text }));
      
      // Add to local subtitles with speaker info
      const speakerType = "You";
      addSubtitle(speakerType, text);
    } catch {}
  }
  
  function sendTranscript(text: string) {
    const dc = dataChannelRef.current;
    if (!text || !dc || dc.readyState !== "open") return;
    try {
      dc.send(JSON.stringify({ type: "transcript", text }));
      
      // Add to local subtitles with speaker info
      const speakerType = "You";
      addSubtitle(speakerType, text);
    } catch {}
  }
  
  function sendSettingsSync() {
    const dc = dataChannelRef.current;
    if (!dc || dc.readyState !== "open") return;
    try {
      // Send current settings to remote peer
      dc.send(JSON.stringify({
        type: "settings",
        settings: {
          sendSignAsSpeech,
          showTranscript,
          showAvatar,
          receiveAs
        }
      }));
    } catch {}
  }
  
  function applyRemoteSettings(settings: any) {
    // Apply received settings from remote peer
    if (typeof settings.sendSignAsSpeech === 'boolean') setSendSignAsSpeech(settings.sendSignAsSpeech);
    if (typeof settings.showTranscript === 'boolean') setShowTranscript(settings.showTranscript);
    if (typeof settings.showAvatar === 'boolean') setShowAvatar(settings.showAvatar);
    if (settings.receiveAs) setReceiveAs(settings.receiveAs);
  }

  async function makeOffer() {
    try {
      const stream = await ensureLocalMedia();
      const pc = createPeer();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      if (otherPeerIdRef.current) {
        await fetch("/api/rooms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({
            name: roomName,
            to: otherPeerIdRef.current,
            message: { type: "offer", from: peerIdRef.current, payload: offer },
          }),
        });
      }
    } catch (e: any) {
      setError(e?.message || "Failed to create offer");
    }
  }

  async function handleOffer(from: string, offer: RTCSessionDescriptionInit) {
    try {
      otherPeerIdRef.current = from;
      const stream = await ensureLocalMedia();
      const pc = createPeer();
      stream.getTracks().forEach((t) => pc.addTrack(t, stream));
      await pc.setRemoteDescription(offer);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await fetch("/api/rooms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          name: roomName,
          to: from,
          message: { type: "answer", from: peerIdRef.current, payload: answer },
        }),
      });
      setConnected(true);
    } catch (e: any) {
      setError(e?.message || "Failed to handle offer");
    }
  }

  async function handleAnswer(answer: RTCSessionDescriptionInit) {
    try {
      if (!pc1Ref.current) return;
      await pc1Ref.current.setRemoteDescription(answer);
      setConnected(true);
    } catch (e: any) {
      setError(e?.message || "Failed to handle answer");
    }
  }

  async function handleIce(candidate: RTCIceCandidateInit) {
    try {
      if (!pc1Ref.current) return;
      await pc1Ref.current.addIceCandidate(candidate);
    } catch (e) {
      // ignore
    }
  }

  async function startPolling() {
    if (pollTimerRef.current) return;
    const tick = async () => {
      try {
        const res = await fetch("/api/rooms/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ name: roomName, peerId: peerIdRef.current }),
        });
        if (!ensureAuthedOrRedirect(res)) {
          return;
        }
        const data = await res.json();
        if (data?.ok && Array.isArray(data.messages)) {
          for (const m of data.messages as any[]) {
            if (!m || m.from === peerIdRef.current) continue;
            if (m.type === "join") {
              if (isHostRef.current && !otherPeerIdRef.current) {
                otherPeerIdRef.current = m.from;
                await makeOffer();
              }
            } else if (m.type === "offer") {
              await handleOffer(m.from, m.payload);
            } else if (m.type === "answer") {
              await handleAnswer(m.payload);
            } else if (m.type === "ice") {
              await handleIce(m.payload);
            } else if (m.type === "leave") {
              if (m.from === otherPeerIdRef.current) {
                hangUp();
              }
            }
          }
        }
      } catch (e) {
        // network errors ignored
      } finally {
        pollTimerRef.current = setTimeout(tick, 1000);
      }
    };
    tick();
  }

  async function secureEnterRoom() {
    setError(null);
    try {
      // Block if not logged in / missing bearer token
      const token = typeof window !== "undefined" ? localStorage.getItem("bearer_token") : null;
      if (!token) {
        router.push(`/login?redirect=${encodeURIComponent("/interview")}`);
        return;
      }

      const pid = (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
      peerIdRef.current = pid;

      if (mode === "create") {
        isHostRef.current = true;
        const createRes = await fetch("/api/rooms/create", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ name: roomName, password: roomPassword }),
        });
        if (!ensureAuthedOrRedirect(createRes)) return;
        const createData = await createRes.json();
        if (!createData?.ok && createData?.error !== "ROOM_ALREADY_EXISTS") {
          setError(createData?.error || "Failed to create room");
          return;
        }
      } else {
        isHostRef.current = false;
      }

      const joinRes = await fetch("/api/rooms/join", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name: roomName, password: roomPassword, peerId: peerIdRef.current }),
      });
      if (!ensureAuthedOrRedirect(joinRes)) return;
      const joinData = await joinRes.json();
      if (!joinData?.ok) {
        setError(joinData?.error || "Failed to join room");
        return;
      }

      setHasJoined(true);
      const qp = new URLSearchParams({ room: roomName });
      history.replaceState(null, "", `?${qp.toString()}`);
      startPolling();
      await ensureLocalMedia();
      initSpeechRecognition();
    } catch (e: any) {
      setError(e?.message ?? "Unable to enter room");
    }
  }

  async function startCall() {
    setError(null);
    try {
      if (isHostRef.current && otherPeerIdRef.current) {
        await makeOffer();
      }
    } catch (err: any) {
      setError(err?.message ?? "Failed to start call");
    }
  }

  function hangUp() {
    pc1Ref.current?.getSenders().forEach((s) => s.track?.stop());
    pc2Ref.current?.getSenders().forEach((s) => s.track?.stop());
    pc1Ref.current?.close();
    pc2Ref.current?.close();
    pc1Ref.current = null;
    pc2Ref.current = null;
    if (localVideoRef.current) localVideoRef.current.srcObject = null;
    if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    streamRef.current = null;
    setConnected(false);
    setMuted(false);
    setCameraOff(false);
    stopRecording(true);
  }

  function toggleMute() {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMuted((m) => !m);
  }

  function toggleCamera() {
    const stream = streamRef.current;
    if (!stream) return;
    stream.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setCameraOff((c) => !c);
  }

  // Recording helpers (MVP: merge available tracks and record)
  function buildRecordStream(): MediaStream | null {
    const mixed = new MediaStream();
    const local = streamRef.current;
    const remote = (remoteVideoRef.current?.srcObject as MediaStream) || null;
    // Prefer remote video if present, else local video
    const remoteVideo = remote?.getVideoTracks?.()[0];
    const localVideo = local?.getVideoTracks?.()[0];
    const videoTrack = remoteVideo || localVideo;
    if (videoTrack) mixed.addTrack(videoTrack);
    // Add both audio tracks if available
    const localAudio = local?.getAudioTracks?.()[0];
    const remoteAudio = remote?.getAudioTracks?.()[0];
    if (localAudio) mixed.addTrack(localAudio);
    if (remoteAudio) mixed.addTrack(remoteAudio);
    if (mixed.getTracks().length === 0) return null;
    return mixed;
  }

  function startRecording() {
    try {
      const recStream = buildRecordStream();
      if (!recStream) {
        setError("No media tracks available to record yet.");
        return;
      }
      recordedChunksRef.current = [];
      const mr = new MediaRecorder(recStream, { mimeType: "video/webm;codecs=vp9,opus" });
      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(recordedChunksRef.current, { type: "video/webm" });
        if (downloadUrl) URL.revokeObjectURL(downloadUrl);
        const url = URL.createObjectURL(blob);
        setDownloadUrl(url);
      };
      mr.start();
      recorderRef.current = mr;
      setIsRecording(true);
    } catch (e: any) {
      setError(e?.message || "Failed to start recording");
    }
  }

  function stopRecording(silent?: boolean) {
    try {
      if (recorderRef.current && recorderRef.current.state !== "inactive") {
        recorderRef.current.stop();
      }
    } finally {
      recorderRef.current = null;
      if (!silent) setIsRecording(false);
      else setIsRecording(false);
    }
  }

  // Speech recognition (Web Speech API)
  function initSpeechRecognition() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setSpeechSupported(false);
      return;
    }
    setSpeechSupported(true);
    const rec = new SR();
    const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (/(Mac).*CPU.*OS\sX/.test(ua) && "ontouchend" in window);
    rec.lang = "en-US";
    rec.continuous = !isIOS; // iOS Safari is more stable with non-continuous
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onstart = () => {
      setRecognizing(true);
    };
    rec.onresult = (event: any) => {
      // Build list of all final segments in this session and append only the new ones
      let finals: string[] = [];
      let interimText = "";
      for (let i = 0; i < event.results.length; i++) {
        const res = event.results[i];
        const text = (res[0]?.transcript || "").trim();
        if (!text) continue;
        if (res.isFinal) finals.push(text);
      }
      const currentFinalsCount = finals.length;
      if (currentFinalsCount > finalCountRef.current) {
        const newChunks = finals.slice(finalCountRef.current);
        if (newChunks.length) {
          setTranscript((prev) => (prev ? prev + " " : "") + newChunks.join(" "));
        }
        finalCountRef.current = currentFinalsCount;
      }
      // Interim is the last non-final hypothesis, if any
      const lastIdx = event.results.length - 1;
      if (lastIdx >= 0 && !event.results[lastIdx].isFinal) {
        interimText = (event.results[lastIdx][0]?.transcript || "").trim();
      }
      setInterim(interimText);
      
      // Send final transcripts to remote peer
      if (newChunks && newChunks.length) {
        sendTranscript(newChunks.join(" "));
      }
    };
    rec.onerror = (e: any) => {
      const code = e?.error;
      if (code === "not-allowed" || code === "service-not-allowed" || code === "audio-capture") {
        setError(
          code === "audio-capture"
            ? "No microphone detected. Please connect or enable a mic."
            : "Microphone access blocked. Please allow mic permissions."
        );
        shouldRestartRef.current = false;
        try {
          rec.stop();
        } catch {}
        setRecognizing(false);
        return;
      }
      // Auto-recover from transient errors
      if (code === "no-speech" || code === "network" || code === "aborted") {
        try {
          rec.stop();
        } catch {}
      }
    };
    rec.onend = () => {
      if (shouldRestartRef.current) {
        // Reset per-session counters
        finalCountRef.current = 0;
        // iOS needs a tiny delay before restart
        const restart = () => {
          try {
            rec.start();
            setRecognizing(true);
          } catch {
            // swallow
          }
        };
        if (isIOS) {
          setTimeout(restart, 150);
        } else {
          restart();
        }
      } else {
        setRecognizing(false);
        setInterim("");
      }
    };
    recognitionRef.current = rec;
  }

  function toggleSpeechRecognition() {
    if (!speechSupported) return;
    if (!recognitionRef.current) initSpeechRecognition();
    const rec = recognitionRef.current;
    if (!recognizing) {
      try {
        setTranscript("");
        setInterim("");
        finalCountRef.current = 0;
        shouldRestartRef.current = true;
        rec.start();
        setRecognizing(true);
      } catch {
        // ignored
      }
    } else {
      shouldRestartRef.current = false;
      try {
        if (typeof rec.abort === "function") rec.abort();
        else rec.stop();
      } finally {
        setRecognizing(false);
        setInterim("");
      }
    }
  }

  // Speech synthesis for Sign -> Speech demo
  function speak(text: string) {
    if (!text) return;
    const u = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(u);
  }

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current as any);
      if (peerIdRef.current && roomName) {
        fetch("/api/rooms/leave", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeaders() },
          body: JSON.stringify({ name: roomName, peerId: peerIdRef.current }),
        }).catch(() => {});
      }
      if (levelTimerRef.current) cancelAnimationFrame(levelTimerRef.current);
      audioCtxRef.current?.close().catch(() => {});
      hangUp();
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // While checking auth, avoid rendering the lobby/UI to prevent flicker
  if (isPending) {
    return (
      <div className="grid min-h-[60vh] place-items-center p-6 text-sm text-muted-foreground">
        Checking authentication...
      </div>
    );
  }

  // Lobby UI before entering the room
  if (!hasJoined) {
    return (
      <div className="mx-auto max-w-xl p-4 sm:p-6">
        {/* Quick Tour overlay */}
        {showTour && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-lg border bg-card text-card-foreground shadow-lg">
              <div className="border-b p-4">
                <h2 className="text-base font-semibold">Quick tour</h2>
              </div>
              <div className="space-y-3 p-4 text-sm text-muted-foreground">
                <p>Welcome to the interview room. Here's how to get started:</p>
                <ol className="list-decimal pl-5 space-y-1">
                  <li>Choose Create Room or Join Room.</li>
                  <li>Enter a room name and password.</li>
                  <li>After joining, press Start to begin the call.</li>
                </ol>
                <p className="text-xs">Note: You must be logged in to attend or create a room.</p>
              </div>
              <div className="flex items-center justify-end gap-2 border-t p-3">
                <Button variant="outline" onClick={dismissTour}>Got it</Button>
              </div>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Join an Interview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex gap-2">
              <Button variant={mode === "create" ? "default" : "outline"} onClick={() => setMode("create")} aria-pressed={mode === "create"}>
                Create Room
              </Button>
              <Button variant={mode === "join" ? "default" : "outline"} onClick={() => setMode("join")} aria-pressed={mode === "join"}>
                Join Room
              </Button>
            </div>

            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!roomName || !roomPassword) return;
                secureEnterRoom();
              }}
            >
              <div>
                <label htmlFor="room" className="mb-1 block text-sm font-medium">
                  Room name
                </label>
                <Input
                  id="room"
                  placeholder={mode === "create" ? "e.g. Engineering Panel" : "Enter room name"}
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  required
                />
                <p className="mt-1 text-xs text-muted-foreground">Default: aurasign-demo</p>
              </div>
              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium">
                  {mode === "create" ? "Set a password" : "Room password"}
                </label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="off"
                  placeholder={mode === "create" ? "Create a password" : "Enter password"}
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  required
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Default: aura1234 — Share the room name and password so others can join.
                </p>
              </div>
              <div className="pt-2">
                <Button type="submit" className="w-full">
                  {mode === "create" ? "Create & Continue" : "Join Room"}
                </Button>
              </div>
              {error && (
                <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-2 text-xs">
                  {error}
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-[100svh] w-full overflow-hidden bg-black">
      {/* 75/25 split layout */}
      <div className="grid h-full w-full grid-cols-[3fr_1fr]">
        {/* Main Video Area (75%) */}
        <div className="relative overflow-hidden">
          {/* Remote fills */}
          <video ref={remoteVideoRef} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover" />
          {!connected && (
            <div className="absolute inset-0 grid place-items-center text-sm text-white/70">Remote participant</div>
          )}

          {/* Draggable Local PiP */}
          <div
            ref={pipRef}
            onMouseDown={onPipPointerDown as any}
            onTouchStart={onPipPointerDown as any}
            className="pointer-events-auto absolute z-20"
            style={{ right: pipPos.x, bottom: pipPos.y }}
          >
            <div className="relative w-44 sm:w-56">
              <div className="aspect-video overflow-hidden rounded-md border border-white/20 bg-black/70 shadow-lg">
                <video ref={localVideoRef} id="localVideoEl" autoPlay muted playsInline className="h-full w-full object-cover" />
                {!connected && (
                  <div className="absolute inset-0 grid place-items-center text-[10px] text-white/70">Local preview</div>
                )}
              </div>
            </div>
          </div>

          {/* Subtitles Display (overlaid on video) */}
          <div className="pointer-events-none absolute inset-x-0 bottom-16 max-h-[40%] overflow-y-auto px-4 py-2">
            <div className="flex flex-col gap-2">
              {subtitles.slice(-8).map((subtitle) => (
                <div key={subtitle.id} className="rounded-md bg-black/70 p-2 backdrop-blur-sm">
                  <div className="flex items-start gap-2">
                    <span className="font-medium text-white">{subtitle.speaker}:</span>
                    <span className="text-white">{subtitle.text}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Bottom Control Bar (overlaid, non-obstructive) */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 border-t border-white/10 bg-black/40 px-4 py-3 backdrop-blur">
            {/* Wrap buttons in pointer-events-auto to make only them clickable */}
            <div className="pointer-events-auto flex items-center justify-center gap-2">
            {!connected ? (
              <Button onClick={startCall} aria-label="Start call" className="bg-white/10 text-white hover:bg-white/20">
                <RefreshCcw className="mr-2 h-4 w-4" /> Start
              </Button>
            ) : (
              <Button variant="destructive" onClick={hangUp} aria-label="End call">
                <PhoneOff className="mr-2 h-4 w-4" /> End
              </Button>
            )}
            <Button variant={muted ? "secondary" : "default"} onClick={toggleMute} aria-pressed={muted} aria-label={muted ? "Unmute" : "Mute"} className="bg-white/10 text-white hover:bg-white/20">
              {muted ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />} {muted ? "Unmute" : "Mute"}
            </Button>
            <Button variant={cameraOff ? "secondary" : "default"} onClick={toggleCamera} aria-pressed={cameraOff} aria-label={cameraOff ? "Turn camera on" : "Turn camera off"} className="bg-white/10 text-white hover:bg-white/20">
              {cameraOff ? <VideoOff className="mr-2 h-4 w-4" /> : <Video className="mr-2 h-4 w-4" />} {cameraOff ? "Cam On" : "Cam Off"}
            </Button>
            {!isRecording ? (
              <Button variant="outline" onClick={startRecording} aria-label="Start recording" className="bg-white/10 text-white hover:bg-white/20">
                <Play className="mr-2 h-4 w-4" /> Record
              </Button>
            ) : (
              <Button variant="outline" onClick={() => stopRecording()} aria-label="Stop recording" className="bg-white/10 text-white hover:bg-white/20">
                <StopCircle className="mr-2 h-4 w-4" /> Stop
              </Button>
            )}
            {downloadUrl && (
              <a href={downloadUrl} download={`aurasign-${roomName}.webm`} className="inline-flex items-center rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white hover:bg-white/20">
                <Download className="mr-2 h-4 w-4" /> Download
              </a>
            )}
            <div className="ml-2 hidden items-center gap-2 text-xs text-white/80 sm:flex">
              <Activity className={`h-4 w-4 ${micActive ? "text-green-400" : "text-white/60"}`} />
              Mic {micActive ? "active" : "idle"}
            </div>
            <div className="ml-auto hidden items-center gap-2 pr-2 text-white/80 sm:flex">
              <Settings className="h-4 w-4" />
              <span className="text-xs">Devices</span>
            </div>
            </div>
          </div>
        </div>

        {/* Tools & Translation Sidebar (25%) */}
        <aside className="flex h-full min-w-0 flex-col border-l border-white/10 bg-background/95 text-foreground">
          {/* Controls header (simplified) */}
          <div className="border-b p-4" />

          {/* Only two features */}
          <div className="flex-1 overflow-hidden p-4">
            {/* Handsign → Speech */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label htmlFor="toggle-send-remote" className="text-sm">Handsign → Speech</Label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">Send to opponent</span>
                  <Switch 
                    id="toggle-send-remote" 
                    checked={sendSignAsSpeech} 
                    onCheckedChange={(checked) => {
                      setSendSignAsSpeech(checked);
                      // Sync setting with remote peer
                      sendSettingsSync();
                    }} 
                  />
                </div>
              </div>
              <div className="text-xs text-blue-400 mb-2">
                <InfoIcon className="inline h-3 w-3 mr-1" /> Settings are shared with all participants
              </div>
              <div className="mb-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">SPOTER Sign Recognition</span>
                  <span className="inline-flex h-5 items-center rounded-full bg-green-500/10 px-2 text-xs font-medium text-green-500">Active</span>
                </div>
                <SPOTERRecognition 
                  onPhrase={(text) => {
                    if (sendSignAsSpeech) {
                      sendRemoteTTS(text);
                      // Add to transcript for local display
                      setTranscript(prev => prev ? `${prev}\n[Sign] ${text}` : `[Sign] ${text}`);
                    }
                  }}
                />
              </div>
              <div className="mb-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">MediaPipe Gesture Recognition</span>
                  <span className="inline-flex h-5 items-center rounded-full bg-blue-500/10 px-2 text-xs font-medium text-blue-500">Active</span>
                </div>
                <HandGestureRecognizer
                  onPhrase={(text) => {
                    if (sendSignAsSpeech) {
                      sendRemoteTTS(text);
                      // Add to transcript for local display
                      setTranscript(prev => prev ? `${prev}\n[Gesture] ${text}` : `[Gesture] ${text}`);
                    }
                  }}
                />
              </div>
            </div>

            {/* Divider */}
            <div className="my-4 h-px w-full bg-border" />

            {/* Speech → Text */}
            <div className="flex h-[45%] min-h-40 flex-col">
              <div className="mb-3 flex items-center justify-between">
                <Label className="text-sm">Speech → Text</Label>
                <Button size="sm" variant="outline" onClick={toggleSpeechRecognition} disabled={!speechSupported}>
                  {recognizing ? <StopCircle className="mr-2 h-4 w-4" /> : <Volume2 className="mr-2 h-4 w-4" />}
                  {recognizing ? "Stop" : "Start"}
                </Button>
              </div>
              <div className="text-xs text-blue-400 mb-2">
                <InfoIcon className="inline h-3 w-3 mr-1" /> Transcripts are shared with all participants
              </div>
              <div className="min-h-0 flex-1 overflow-auto rounded-md border p-3 text-sm">
                {speechSupported ? (
                  <>
                    <span className="whitespace-pre-wrap">{transcript}</span>
                    {interim && (
                      <span className="opacity-60 whitespace-pre-wrap"> {interim}</span>
                    )}
                  </>
                ) : (
                  "Speech recognition not supported"
                )}
              </div>
            </div>
          </div>
        </aside>
      </div>

      {/* Error notice */}
      {error && (
        <div role="alert" className="absolute left-4 top-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive-foreground">
          {error}
        </div>
      )}
    </div>
  );
}