import { generateRoomCode } from './codes';
import { Room, type RoomDeps } from './room';

export const EMPTY_ROOM_MS = 10 * 60_000;

export class RoomManager {
  private rooms = new Map<string, Room>();
  private emptyTimers = new Map<string, () => void>();

  constructor(private readonly deps: RoomDeps) {}

  get size(): number {
    return this.rooms.size;
  }

  get(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  create(): Room {
    const code = generateRoomCode((c) => this.rooms.has(c));
    const room = new Room(code, this.deps);
    this.rooms.set(code, room);
    this.touch(room);
    return room;
  }

  /** Re-evaluates whether a room is empty; empty rooms are deleted after 10 minutes. */
  touch(room: Room): void {
    const pending = this.emptyTimers.get(room.code);
    if (room.connectedCount() > 0) {
      pending?.();
      this.emptyTimers.delete(room.code);
      return;
    }
    if (pending) return;
    this.emptyTimers.set(
      room.code,
      this.deps.scheduler.after(EMPTY_ROOM_MS, () => {
        room.dispose();
        this.rooms.delete(room.code);
        this.emptyTimers.delete(room.code);
        this.deps.log.info({ code: room.code }, 'removed empty room');
      }),
    );
  }

  closeAll(): void {
    for (const cancel of this.emptyTimers.values()) cancel();
    this.emptyTimers.clear();
    for (const room of this.rooms.values()) room.dispose();
    this.rooms.clear();
  }
}
