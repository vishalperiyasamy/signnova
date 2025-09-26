import { NextResponse } from "next/server";
import { signalingStore } from "@/lib/signaling";

export async function POST(req: Request) {
  try {
    const { name, password } = await req.json();
    if (!name || !password) {
      return NextResponse.json({ ok: false, error: "MISSING_FIELDS" }, { status: 400 });
    }
    const res = signalingStore.createRoom(String(name), String(password));
    if (!res.ok) {
      return NextResponse.json(res, { status: 409 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json({ ok: false, error: "INVALID_JSON" }, { status: 400 });
  }
}