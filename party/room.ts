import { Server, type Connection, type ConnectionContext } from "partyserver";
import {
  hideCard,
  ROOM_LIMITS,
  type ClientMessage,
  type RoomPhase,
  type RoomPlayer,
  type RoomSnapshot,
  type Standing,
} from "../lib/multiplayer";
import {
  buildDeck,
  correctIndex,
  DIFFICULTY_BANDS,
  isValidPlacement,
  type Difficulty,
} from "../lib/game";
import type { GameCard, PlacedCard } from "../lib/types";

export interface Env {
  SITE_URL: string;
  Main: DurableObjectNamespace;
}

/**
 * Кімната мультиплеєра (Durable Object через partyserver). Авторитарний
 * сервер: колода з роками живе тут, клієнти отримують активну картку без
 * року. Гравці ходять по черзі, на хід — таймер (таймаут = промах).
 * Вибув при 0 життів -> глядач.
 */
export class Room extends Server<Env> {
  phase: RoomPhase = "lobby";
  players: RoomPlayer[] = [];
  hostId: string | null = null;
  /** token гравця -> connection ids (може бути кілька вкладок). */
  deck: GameCard[] = [];
  timeline: PlacedCard[] = [];
  current: GameCard | null = null;
  turnOrder: string[] = [];
  turnIdx = 0;
  turnEndsAt: number | null = null;
  relocating: string | null = null;
  lastMove: RoomSnapshot["lastMove"] = null;
  standings: Standing[] | null = null;
  eliminatedCount = 0;
  difficulty: Difficulty = "normal";

  turnTimer: ReturnType<typeof setTimeout> | null = null;
  relocationTimer: ReturnType<typeof setTimeout> | null = null;

  // ------------------------------------------------------------ lifecycle

  onConnect(conn: Connection, _ctx: ConnectionContext) {
    // стан прилетить після join (клієнт шле його одразу після підключення)
    conn.send(JSON.stringify(this.snapshot()));
  }

  onClose(conn: Connection) {
    const player = this.players.find((p) => p.id === conn.state);
    if (!player) return;
    const stillConnected = [...this.getConnections()].some(
      (c) => c.id !== conn.id && c.state === player.id,
    );
    if (stillConnected) return;
    player.connected = false;
    if (this.phase === "lobby") {
      // у лобі відключені зникають; хост передається наступному
      this.players = this.players.filter((p) => p.id !== player.id);
      if (this.hostId === player.id) {
        this.hostId = this.players[0]?.id ?? null;
      }
    }
    // під час гри гравець лишається: таймер ходу сам зарахує промах,
    // а повернення з тим самим token відновить сесію
    this.sync();
  }

  onMessage(conn: Connection, raw: string | ArrayBuffer | ArrayBufferView) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(String(raw)) as ClientMessage;
    } catch {
      return;
    }
    switch (msg.type) {
      case "join":
        return this.handleJoin(conn, msg.token, msg.nick);
      case "rename":
        return this.handleRename(conn, msg.nick);
      case "start":
        return void this.handleStart(conn);
      case "restart":
        return this.handleRestart(conn);
      case "difficulty":
        return this.handleDifficulty(conn, msg.difficulty);
      case "place":
        return this.handlePlace(conn, msg.index, msg.qid);
    }
  }

  // ------------------------------------------------------------ handlers

  handleJoin(conn: Connection, token: string, rawNick: string) {
    const nick = sanitizeNick(rawNick);
    if (!token || !nick) return this.error(conn, "Некоректний нікнейм");
    // reconnect: той самий token = той самий гравець
    let player = this.players.find((p) => p.id === token);
    if (player) {
      player.connected = true;
    } else {
      if (this.phase !== "lobby") {
        // гра вже йде — приєднуємось глядачем (без запису в players)
        conn.setState(null);
        conn.send(JSON.stringify(this.snapshot()));
        return;
      }
      if (this.players.length >= ROOM_LIMITS.maxPlayers) {
        return this.error(conn, "Кімната заповнена (максимум 8 гравців)");
      }
      player = {
        id: token,
        nick: this.uniqueNick(nick),
        lives: ROOM_LIMITS.lives,
        correctMoves: 0,
        connected: true,
        eliminatedAt: null,
      };
      this.players.push(player);
      if (!this.hostId) this.hostId = player.id;
    }
    conn.setState(player.id);
    this.sync();
  }

  handleRename(conn: Connection, rawNick: string) {
    if (this.phase !== "lobby") return; // під час гри нік не міняється
    const player = this.players.find((p) => p.id === conn.state);
    const nick = sanitizeNick(rawNick);
    if (!player || !nick) return;
    player.nick = this.uniqueNick(nick, player.id);
    this.sync();
  }

  handleDifficulty(conn: Connection, difficulty: Difficulty) {
    if (this.phase !== "lobby") return; // під час гри рівень не міняється
    if (conn.state !== this.hostId) {
      return this.error(conn, "Складність обирає лише хост");
    }
    if (!(difficulty in DIFFICULTY_BANDS)) return;
    this.difficulty = difficulty;
    this.sync();
  }

  async handleStart(conn: Connection) {
    if (this.phase !== "lobby") return;
    if (conn.state !== this.hostId) {
      return this.error(conn, "Гру запускає лише хост");
    }
    const connected = this.players.filter((p) => p.connected);
    if (connected.length < ROOM_LIMITS.minPlayers) {
      return this.error(conn, "Потрібно щонайменше 2 гравці");
    }
    try {
      const site = this.env.SITE_URL;
      const res = await fetch(`${site}/data/all.json`);
      if (!res.ok) throw new Error(String(res.status));
      const pool = (await res.json()) as GameCard[];
      this.deck = buildDeck(pool, 200, undefined, this.difficulty);
    } catch {
      return this.error(conn, "Не вдалося завантажити картки, спробуй ще раз");
    }
    this.players = connected;
    this.phase = "playing";
    this.turnOrder = shuffle(this.players.map((p) => p.id));
    this.turnIdx = 0;
    const [first, second, ...rest] = this.deck;
    this.timeline = [{ ...first, correct: true }];
    this.current = second;
    this.deck = rest;
    this.startTurn();
    this.sync();
  }

  /** Рематч: хост повертає завершену кімнату в лобі з тими ж гравцями. */
  handleRestart(conn: Connection) {
    if (this.phase !== "finished") return;
    if (conn.state !== this.hostId) {
      return this.error(conn, "Нову гру запускає лише хост");
    }
    this.phase = "lobby";
    this.players = this.players
      .filter((p) => p.connected)
      .map((p) => ({
        ...p,
        lives: ROOM_LIMITS.lives,
        correctMoves: 0,
        eliminatedAt: null,
      }));
    if (!this.players.some((p) => p.id === this.hostId)) {
      this.hostId = this.players[0]?.id ?? null;
    }
    this.deck = [];
    this.timeline = [];
    this.current = null;
    this.turnOrder = [];
    this.turnIdx = 0;
    this.turnEndsAt = null;
    this.relocating = null;
    this.lastMove = null;
    this.standings = null;
    this.eliminatedCount = 0;
    this.clearTurnTimer();
    this.sync();
  }

  handlePlace(conn: Connection, index: number, qid: string) {
    if (this.phase !== "playing" || this.relocating || !this.current) return;
    const playerId = this.turnOrder[this.turnIdx];
    if (conn.state !== playerId) return this.error(conn, "Зараз не твій хід");
    // ідемпотентність: хід приймається лише для актуальної картки
    if (qid !== this.current.qid) return;
    if (!Number.isInteger(index) || index < 0 || index > this.timeline.length)
      return;
    this.resolveMove(index);
  }

  // ------------------------------------------------------------ game flow

  startTurn() {
    this.clearTurnTimer();
    this.turnEndsAt = Date.now() + ROOM_LIMITS.turnSeconds * 1000;
    this.turnTimer = setTimeout(() => {
      // час вийшов — автоматичний промах у правильне місце (без фази 1)
      if (this.phase === "playing" && this.current && !this.relocating) {
        this.resolveMove(null);
      }
    }, ROOM_LIMITS.turnSeconds * 1000);
  }

  /** index = null -> таймаут (рахуємо як промах без вибору позиції). */
  resolveMove(index: number | null) {
    const card = this.current!;
    const player = this.players.find((p) => p.id === this.turnOrder[this.turnIdx])!;
    this.clearTurnTimer();
    this.turnEndsAt = null;

    const correct =
      index !== null && isValidPlacement(this.timeline, index, card.year);
    this.lastMove = {
      qid: card.qid,
      correct,
      title: card.title,
      year: card.year,
    };

    if (correct) {
      this.timeline.splice(index!, 0, { ...card, correct: true });
      player.correctMoves += 1;
      this.advance();
      return;
    }

    // промах: фаза 1 — картка там, куди її поклали (або одразу на місці
    // при таймауті), фаза 2 за 1.3с — переїзд і наступний хід
    player.lives -= 1;
    const at = index ?? correctIndex(this.timeline, card.year);
    this.timeline.splice(at, 0, { ...card, correct: false });
    this.relocating = card.qid;
    this.sync();
    this.relocationTimer = setTimeout(() => {
      const idx = this.timeline.findIndex(
        (c) => c.qid === card.qid && !c.correct,
      );
      if (idx !== -1) {
        const [moved] = this.timeline.splice(idx, 1);
        this.timeline.splice(correctIndex(this.timeline, moved.year), 0, moved);
      }
      this.relocating = null;
      if (player.lives <= 0 && player.eliminatedAt === null) {
        player.eliminatedAt = ++this.eliminatedCount;
      }
      this.advance();
    }, 1300);
  }

  /** Наступна картка + наступний живий гравець, або кінець гри. */
  advance() {
    const alive = this.players.filter((p) => p.eliminatedAt === null);
    if (alive.length <= 1 || this.deck.length === 0) {
      this.finish(alive);
      return;
    }
    this.current = this.deck[0];
    this.deck = this.deck.slice(1);
    // наступний живий у черзі
    for (let i = 0; i < this.turnOrder.length; i++) {
      this.turnIdx = (this.turnIdx + 1) % this.turnOrder.length;
      const p = this.players.find((x) => x.id === this.turnOrder[this.turnIdx]);
      if (p && p.eliminatedAt === null) break;
    }
    this.startTurn();
    this.sync();
  }

  finish(alive: RoomPlayer[]) {
    this.phase = "finished";
    this.current = null;
    this.turnEndsAt = null;
    this.clearTurnTimer();
    // місця: живі — за життями, потім за правильними ходами;
    // вибулі — у зворотному порядку вибуття
    const ranked = [
      ...alive.sort(
        (a, b) => b.lives - a.lives || b.correctMoves - a.correctMoves,
      ),
      ...this.players
        .filter((p) => p.eliminatedAt !== null)
        .sort((a, b) => b.eliminatedAt! - a.eliminatedAt!),
    ];
    this.standings = ranked.map((p, i) => ({
      place: i + 1,
      nick: p.nick,
      id: p.id,
    }));
    this.sync();
  }

  // ------------------------------------------------------------ helpers

  uniqueNick(nick: string, selfId?: string): string {
    let result = nick;
    let n = 2;
    while (this.players.some((p) => p.nick === result && p.id !== selfId)) {
      result = `${nick} ${n++}`;
    }
    return result;
  }

  clearTurnTimer() {
    if (this.turnTimer) clearTimeout(this.turnTimer);
    this.turnTimer = null;
  }

  snapshot(): RoomSnapshot {
    return {
      type: "snapshot",
      phase: this.phase,
      players: this.players,
      hostId: this.hostId,
      timeline: this.timeline,
      current: this.current ? hideCard(this.current) : null,
      turnPlayerId:
        this.phase === "playing" ? this.turnOrder[this.turnIdx] : null,
      turnEndsAt: this.turnEndsAt,
      relocating: this.relocating,
      lastMove: this.lastMove,
      deckLeft: this.deck.length,
      standings: this.standings,
      difficulty: this.difficulty,
    };
  }

  /** Розіслати актуальний снапшот усім у кімнаті. */
  sync() {
    this.broadcast(JSON.stringify(this.snapshot()));
  }

  error(conn: Connection, message: string) {
    conn.send(JSON.stringify({ type: "error", message }));
  }
}

function sanitizeNick(raw: string): string | null {
  const nick = String(raw ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, ROOM_LIMITS.nickMax);
  return nick.length >= ROOM_LIMITS.nickMin ? nick : null;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
