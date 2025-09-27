"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, Video, VideoOff, PhoneOff, RefreshCcw, Download, Activity, Play, StopCircle, Volume2 } from "lucide-react";
import HandGestureRecognizer from "@/components/sign/hand-gesture";

export default function InterviewRoom() {
  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const pc1Ref = useRef<RTCPeerConnection | null>(null);
  const pc2Ref = useRef<RTCPeerConnection | null>(null);
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

  // Mic activity meter
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micLevelRef = useRef<number>(0);
  const [micActive, setMicActive] = useState(false);
  const levelTimerRef = useRef<number | null>(null);

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
    pc.onicecandidate = async (e) => {
      if (e.candidate && otherPeerIdRef.current) {
        await fetch("/api/rooms/send", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
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
    pc1Ref.current = pc;
    return pc;
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
          headers: { "Content-Type": "application/json" },
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
        headers: { "Content-Type": "application/json" },
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
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: roomName, peerId: peerIdRef.current }),
        });
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
      const pid = (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
      peerIdRef.current = pid;

      if (mode === "create") {
        isHostRef.current = true;
        const createRes = await fetch("/api/rooms/create", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: roomName, password: roomPassword }),
        });
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: roomName, password: roomPassword, peerId: peerIdRef.current }),
      });
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
    rec.lang = "en-US";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (event: any) => {
      let txt = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        txt += event.results[i][0].transcript + " ";
      }
      setTranscript((prev) => (prev ? prev + " " : "") + txt.trim());
    };
    rec.onend = () => setRecognizing(false);
    recognitionRef.current = rec;
  }

  function toggleSpeechRecognition() {
    if (!speechSupported) return;
    if (!recognitionRef.current) initSpeechRecognition();
    const rec = recognitionRef.current;
    if (!recognizing) {
      try {
        setTranscript("");
        rec.start();
        setRecognizing(true);
      } catch {
        // ignored
      }
    } else {
      rec.stop();
      setRecognizing(false);
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
          headers: { "Content-Type": "application/json" },
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

  // Lobby UI before entering the room
  if (!hasJoined) {
    return (
      <div className="mx-auto max-w-xl p-4 sm:p-6">
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
    <div className="mx-auto max-w-6xl p-4 sm:p-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Interview Room{roomName ? `: ${roomName}` : ""}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {!connected ? (
            <Button onClick={startCall} aria-label="Start call">
              <RefreshCcw className="mr-2 h-4 w-4" /> Start call
            </Button>
          ) : (
            <Button variant="destructive" onClick={hangUp} aria-label="End call">
              <PhoneOff className="mr-2 h-4 w-4" /> End
            </Button>
          )}
          {!isRecording ? (
            <Button variant="outline" onClick={startRecording} aria-label="Start recording">
              <Play className="mr-2 h-4 w-4" /> Record
            </Button>
          ) : (
            <Button variant="outline" onClick={() => stopRecording()} aria-label="Stop recording">
              <StopCircle className="mr-2 h-4 w-4" /> Stop
            </Button>
          )}
          {downloadUrl && (
            <a href={downloadUrl} download={`aurasign-${roomName}.webm`} className="inline-flex items-center rounded-md border px-3 py-2 text-sm">
              <Download className="mr-2 h-4 w-4" /> Download
            </a>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Video</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                <video ref={localVideoRef} id="localVideoEl" autoPlay muted playsInline className="h-full w-full object-cover" />
                {!connected && (
                  <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Local preview</div>
                )}
              </div>
              <div className="relative aspect-video overflow-hidden rounded-lg bg-muted">
                <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-cover" />
                {!connected && (
                  <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">Remote participant</div>
                )}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Button variant={muted ? "secondary" : "default"} onClick={toggleMute} aria-pressed={muted} aria-label={muted ? "Unmute" : "Mute"}>
                {muted ? <MicOff className="mr-2 h-4 w-4" /> : <Mic className="mr-2 h-4 w-4" />} {muted ? "Unmute" : "Mute"}
              </Button>
              <Button variant={cameraOff ? "secondary" : "default"} onClick={toggleCamera} aria-pressed={cameraOff} aria-label={cameraOff ? "Turn camera on" : "Turn camera off"}>
                {cameraOff ? <VideoOff className="mr-2 h-4 w-4" /> : <Video className="mr-2 h-4 w-4" />} {cameraOff ? "Camera On" : "Camera Off"}
              </Button>
              <div className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                <Activity className={`h-4 w-4 ${micActive ? "text-green-600" : "text-muted-foreground"}`} />
                Mic {micActive ? "active" : "idle"}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Live Captions (Speech → Text)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={toggleSpeechRecognition} disabled={!speechSupported}>
                  {recognizing ? <StopCircle className="mr-2 h-4 w-4" /> : <Volume2 className="mr-2 h-4 w-4" />}
                  {recognizing ? "Stop" : "Check mic & Start"}
                </Button>
                {!speechSupported && <span className="text-xs text-muted-foreground">Speech recognition not supported in this browser</span>}
              </div>
              <div className="mt-3 h-28 overflow-auto rounded-md border p-3 text-sm">
                {transcript || "Your live transcript will appear here..."}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Speech → Hand Sign (Demo)</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="mb-2 text-xs text-muted-foreground">We render an A–Z fingerspelling demo from the transcript.</p>
              <div className="grid grid-cols-12 gap-1 rounded-md border p-2 text-center text-sm">
                {(transcript || "").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 60).split("").map((ch, i) => (
                  <div key={i} className="rounded bg-secondary py-1 font-mono">{ch}</div>
                ))}
                {!transcript && <div className="col-span-12 text-xs text-muted-foreground">Speak to see letters appear here</div>}
              </div>
            </CardContent>
          </Card>

          <HandGestureRecognizer />
        </div>
      </div>
    </div>
  );
}