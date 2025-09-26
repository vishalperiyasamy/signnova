import { NextResponse } from "next/server";
import { signalingStore } from "@/lib/signaling";

export async function POST(req: Request) {
  try {
    const { name, password, peerId } = await req.json();
    if (!name || !password || !peerId) {
      return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
    }
    const room = signalingStore.getRoom(String(name));
    if (!room) return NextResponse.json({ ok: false, error: "ROOM_NOT_FOUND" }, { status: 404 });
    const res = signalingStore.joinRoom(String(name), String(password), String(peerId));
    if (!res.ok) return NextResponse.json(res, { status: 403 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }
}