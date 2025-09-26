import { NextResponse } from "next/server";
import { signalingStore } from "@/lib/signaling";

export async function POST(req: Request) {
  try {
    const { name, peerId } = await req.json();
    if (!name || !peerId) {
      return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
    }
    const room = signalingStore.getRoom(String(name));
    if (!room) return NextResponse.json({ ok: false, error: "ROOM_NOT_FOUND" }, { status: 404 });
    if (!room.peers.has(String(peerId))) {
      return NextResponse.json({ ok: false, error: "NOT_IN_ROOM" }, { status: 403 });
    }
    signalingStore.leaveRoom(String(name), String(peerId));
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }
}