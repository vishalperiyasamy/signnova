import { NextResponse } from "next/server";
import { signalingStore, type PeerMessage } from "@/lib/signaling";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, to, message } = body as { name: string; to: string; message: PeerMessage };
    if (!name || !to || !message || !message.type || !message.from) {
      return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
    }
    const room = signalingStore.getRoom(String(name));
    if (!room) return NextResponse.json({ ok: false, error: "ROOM_NOT_FOUND" }, { status: 404 });
    if (!room.peers.has(message.from)) {
      return NextResponse.json({ ok: false, error: "SENDER_NOT_IN_ROOM" }, { status: 403 });
    }
    if (!room.peers.has(String(to))) {
      return NextResponse.json({ ok: false, error: "TARGET_NOT_IN_ROOM" }, { status: 404 });
    }
    signalingStore.enqueue(String(name), String(to), { ...message, to: String(to), ts: Date.now() });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }
}