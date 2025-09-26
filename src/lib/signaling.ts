// Simple in-memory room + signaling hub (demo only)
// Note: In-memory state resets on server restart and doesn't scale across instances.

export type PeerMessage = {
  type: "offer" | "answer" | "ice" | "join" | "leave";
  from: string; // peerId
  to?: string; // optional target peerId
  payload?: any;
  ts: number;
};

export type Room = {
  name: string;
  password: string;
  peers: Set<string>;
  // Each peer has an event queue for SSE delivery
  queues: Map<string, PeerMessage[]>;
};

class SignalingStore {
  rooms: Map<string, Room> = new Map();

  getOrCreateRoom(name: string, password: string): Room {
    const existing = this.rooms.get(name);
    if (existing) return existing;
    const room: Room = { name, password, peers: new Set(), queues: new Map() };
    this.rooms.set(name, room);
    return room;
  }

  getRoom(name: string): Room | undefined {
    return this.rooms.get(name);
  }

  joinRoom(name: string, password: string, peerId: string): { ok: boolean; error?: string } {
    const room = this.rooms.get(name);
    if (!room) return { ok: false, error: "ROOM_NOT_FOUND" };
    if (room.password !== password) return { ok: false, error: "INVALID_PASSWORD" };
    room.peers.add(peerId);
    if (!room.queues.has(peerId)) room.queues.set(peerId, []);
    // Broadcast join
    this.broadcast(name, { type: "join", from: peerId, ts: Date.now() });
    return { ok: true };
  }

  createRoom(name: string, password: string): { ok: boolean; error?: string } {
    if (this.rooms.has(name)) return { ok: false, error: "ROOM_ALREADY_EXISTS" };
    this.getOrCreateRoom(name, password);
    return { ok: true };
  }

  leaveRoom(name: string, peerId: string) {
    const room = this.rooms.get(name);
    if (!room) return;
    room.peers.delete(peerId);
    room.queues.delete(peerId);
    this.broadcast(name, { type: "leave", from: peerId, ts: Date.now() });
    if (room.peers.size === 0) {
      this.rooms.delete(name);
    }
  }

  enqueue(name: string, toPeerId: string, message: PeerMessage) {
    const room = this.rooms.get(name);
    if (!room) return;
    const q = room.queues.get(toPeerId);
    if (!q) return;
    q.push(message);
  }

  dequeueAll(name: string, peerId: string): PeerMessage[] {
    const room = this.rooms.get(name);
    if (!room) return [];
    const q = room.queues.get(peerId) || [];
    room.queues.set(peerId, []);
    return q;
  }

  broadcast(name: string, message: PeerMessage) {
    const room = this.rooms.get(name);
    if (!room) return;
    for (const pid of room.peers) {
      const q = room.queues.get(pid);
      if (!q) continue;
      q.push(message);
    }
  }
}

// Singleton store across hot reloads
// @ts-ignore
export const signalingStore: SignalingStore = global.__SIGNALING_STORE__ || new SignalingStore();
// @ts-ignore
if (!(global as any).__SIGNALING_STORE__) {
  // @ts-ignore
  (global as any).__SIGNALING_STORE__ = signalingStore;
}