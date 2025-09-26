"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Mic, MicOff, Video, VideoOff, PhoneOff, RefreshCcw } from "lucide-react";

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

  async function ensureLocalMedia() {
    if (streamRef.current) return streamRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    streamRef.current = stream;
    if (localVideoRef.current) localVideoRef.current.srcObject = stream;
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
              // If I'm host and someone else joined, call them
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
      // Peer identity
      const pid = (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`);
      peerIdRef.current = pid;

      if (mode === "create") {
        isHostRef.current = true;
        // Create then join
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
      // start polling for signaling
      startPolling();
      // prepare local media early
      await ensureLocalMedia();
    } catch (e: any) {
      setError(e?.message ?? "Unable to enter room");
    }
  }

  async function startCall() {
    setError(null);
    try {
      // For manual start in case both peers are ready
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

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearTimeout(pollTimerRef.current);
      if (peerIdRef.current && roomName) {
        fetch("/api/rooms/leave", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: roomName, peerId: peerIdRef.current }),
        }).catch(() => {});
      }
      hangUp();
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
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tight">Interview Room{roomName ? `: ${roomName}` : ""}</h1>
        <div className="flex items-center gap-2">
          {!connected ? (
            <Button onClick={startCall} aria-label="Start call">
              <RefreshCcw className="mr-2 h-4 w-4" /> Start call
            </Button>
          ) : (
            <Button variant="destructive" onClick={hangUp} aria-label="End call">
              <PhoneOff className="mr-2 h-4 w-4" /> End
            </Button>
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
                <video ref={localVideoRef} autoPlay muted playsInline className="h-full w-full object-cover" />
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
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Live Captions (AI)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-28 overflow-auto rounded-md border p-3 text-sm text-muted-foreground">
                Placeholder for real-time AI captions...
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Sign Language Translation (AI)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 text-sm text-muted-foreground">
                <div className="aspect-video w-full overflow-hidden rounded-md border bg-muted" aria-label="AI sign output placeholder" />
                <p>Realtime avatar/overlay will appear here.</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}