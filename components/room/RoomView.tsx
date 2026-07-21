"use client";

import { Button, buttonVariants, Chip } from "@heroui/react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import usePartySocket from "partysocket/react";
import { BoardCore, BoardProvider } from "@/components/board/BoardCore";
import { FlagUA } from "@/components/FlagUA";
import { ThemeSwitcher } from "@/components/ThemeSwitcher";
import { shareOrCopy } from "@/lib/share";
import {
  ROOM_LIMITS,
  type RoomPlayer,
  type RoomSnapshot,
  type ServerMessage,
} from "@/lib/multiplayer";
import type { GameCard } from "@/lib/types";

const NICK_KEY = "ua-trivia:nick";
const TOKEN_KEY = "ua-trivia:mp-token";

export function getSavedNick(): string {
  try {
    return localStorage.getItem(NICK_KEY) ?? "";
  } catch {
    return "";
  }
}

function getToken(): string {
  let t = localStorage.getItem(TOKEN_KEY);
  if (!t) {
    t = crypto.randomUUID();
    localStorage.setItem(TOKEN_KEY, t);
  }
  return t;
}

/** Прихована картка з сервера -> об'єкт для GameCardView (без року). */
function toGameCard(hidden: RoomSnapshot["current"]): GameCard | null {
  if (!hidden) return null;
  return {
    ...hidden,
    subtitle: null,
    year: 0,
    fact: null,
    wikipediaSlug: "",
    pageViews: 0,
  };
}

function NickModal({
  initial,
  onSave,
  onDismiss,
}: {
  initial: string;
  onSave: (nick: string) => void;
  /** Закриття без збереження (клік поза модалкою). Якщо не задано —
   *  модалка обов'язкова (первинний вибір ніка). */
  onDismiss?: () => void;
}) {
  const [value, setValue] = useState(initial);
  const valid =
    value.trim().length >= ROOM_LIMITS.nickMin &&
    value.trim().length <= ROOM_LIMITS.nickMax;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={onDismiss}
    >
      <div
        className="card-slide-in relative w-full max-w-sm rounded-2xl border border-border bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Закрити"
            className="absolute right-3 top-3 cursor-pointer rounded-full p-2 text-muted transition-colors hover:bg-background-secondary hover:text-foreground"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        )}
        <h2 className="mb-1 text-xl font-bold">Твій нікнейм</h2>
        <p className="mb-4 text-sm text-muted">
          Його побачать інші гравці в кімнаті
        </p>
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && valid && onSave(value.trim())}
          maxLength={ROOM_LIMITS.nickMax}
          placeholder="Наприклад, Козак Мамай"
          className="mb-4 h-11 w-full rounded-lg border border-border bg-background-secondary px-3 outline-none focus:border-accent"
        />
        <Button
          variant="primary"
          fullWidth
          isDisabled={!valid}
          onClick={() => onSave(value.trim())}
        >
          Продовжити
        </Button>
      </div>
    </div>
  );
}

function PlayerRow({
  player,
  isHost,
  isTurn,
  isMe,
}: {
  player: RoomPlayer;
  isHost: boolean;
  isTurn: boolean;
  isMe: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2 ${
        isTurn ? "border-accent bg-accent-soft/50" : "border-border bg-background-secondary"
      } ${player.eliminatedAt !== null ? "opacity-45" : ""}`}
    >
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${
          player.connected ? "bg-green-500" : "bg-red-400"
        }`}
        title={player.connected ? "онлайн" : "офлайн"}
      />
      <span className="truncate text-sm font-semibold">
        {isHost && "👑 "}
        {player.nick}
        {isMe && <span className="text-muted"> (ти)</span>}
      </span>
      <span className="ml-auto flex shrink-0 gap-0.5">
        {player.eliminatedAt !== null ? (
          <span className="text-xs text-muted">вибув</span>
        ) : (
          Array.from({ length: ROOM_LIMITS.lives }, (_, i) => (
            <FlagUA
              key={i}
              width={16}
              className={i < player.lives ? "" : "opacity-25 grayscale"}
            />
          ))
        )}
      </span>
    </div>
  );
}

function TurnTimer({ endsAt }: { endsAt: number | null }) {
  const [left, setLeft] = useState<number | null>(null);
  useEffect(() => {
    if (!endsAt) {
      setLeft(null);
      return;
    }
    const tick = () => setLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [endsAt]);
  if (left === null) return null;
  return (
    <span
      className={`rounded-full px-3 py-1 text-sm font-bold tabular-nums ${
        left <= 10
          ? "bg-danger-soft text-danger-soft-foreground"
          : "bg-background-tertiary text-muted"
      }`}
    >
      ⏱ {left}с
    </span>
  );
}

function Lobby({
  snapshot,
  code,
  myId,
  onStart,
  onRename,
}: {
  snapshot: RoomSnapshot;
  code: string;
  myId: string;
  onStart: () => void;
  onRename: (nick: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const [editingNick, setEditingNick] = useState(false);
  const isHost = snapshot.hostId === myId;
  const canStart = snapshot.players.filter((p) => p.connected).length >= ROOM_LIMITS.minPlayers;

  async function shareLink() {
    const url = `${window.location.origin}/room/${code}`;
    if ((await shareOrCopy(`Зіграймо в «Історію в картках»! ${url}`)) === "copied") {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 px-4 pb-16">
      <div className="flex flex-col items-center gap-3 text-center">
        <p className="text-lg font-semibold text-foreground">Код кімнати</p>
        <p className="rounded-xl border-2 border-dashed border-warning bg-warning-soft/40 px-8 py-3 text-5xl font-extrabold tracking-[0.3em]">
          {code}
        </p>
      </div>
      <Button variant="secondary" onClick={shareLink}>
        {copied ? "Посилання скопійовано ✓" : "🔗 Запросити друзів"}
      </Button>

      <div className="flex w-full flex-col gap-2">
        {snapshot.players.map((p) => (
          <PlayerRow
            key={p.id}
            player={p}
            isHost={snapshot.hostId === p.id}
            isTurn={false}
            isMe={p.id === myId}
          />
        ))}
        {Array.from(
          { length: Math.max(0, ROOM_LIMITS.minPlayers - snapshot.players.length) },
          (_, i) => (
            <div
              key={i}
              className="rounded-xl border-2 border-dashed border-border px-3 py-2 text-sm text-muted"
            >
              Чекаємо на гравця…
            </div>
          ),
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        {isHost ? (
          <>
            <Button variant="primary" size="lg" isDisabled={!canStart} onClick={onStart}>
              Почати гру
            </Button>
            {!canStart && (
              <p className="text-xs text-muted">Потрібно щонайменше 2 гравці</p>
            )}
          </>
        ) : (
          <p className="text-sm text-muted">Чекаємо, поки хост почне гру…</p>
        )}
        <button
          type="button"
          className="cursor-pointer rounded-md px-2 py-1 text-xs text-muted underline underline-offset-2 transition-colors hover:bg-background-secondary hover:text-foreground"
          onClick={() => setEditingNick(true)}
        >
          Змінити нікнейм
        </button>
      </div>
      {editingNick && (
        <NickModal
          initial={getSavedNick()}
          onDismiss={() => setEditingNick(false)}
          onSave={(nick) => {
            localStorage.setItem(NICK_KEY, nick);
            onRename(nick);
            setEditingNick(false);
          }}
        />
      )}
    </main>
  );
}

function Podium({ standings, code }: { standings: RoomSnapshot["standings"]; code: string }) {
  const medals = ["🥇", "🥈", "🥉"];
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-16">
      <h2 className="text-3xl font-bold">Гру завершено!</h2>
      {standings && standings.length > 0 && (
        <>
          {/* п'єдестал: 2-1-3 */}
          <div className="flex items-end gap-2">
            {[1, 0, 2].map((idx) => {
              const s = standings[idx];
              if (!s) return <div key={idx} className="w-24" />;
              const heights = ["h-28", "h-20", "h-14"];
              return (
                <div key={s.id} className="flex w-24 flex-col items-center gap-1">
                  <span className="text-3xl">{medals[s.place - 1]}</span>
                  <span className="w-full truncate text-center text-sm font-bold">
                    {s.nick}
                  </span>
                  <div
                    className={`w-full rounded-t-xl bg-accent-soft ${heights[s.place - 1]} flex items-start justify-center pt-1 text-lg font-extrabold text-accent-soft-foreground`}
                  >
                    {s.place}
                  </div>
                </div>
              );
            })}
          </div>
          {standings.length > 3 && (
            <div className="text-center text-sm text-muted">
              {standings.slice(3).map((s) => (
                <p key={s.id}>
                  {s.place}. {s.nick}
                </p>
              ))}
            </div>
          )}
        </>
      )}
      <div className="flex gap-3">
        <Link href={`/room/${code}`} className={buttonVariants({ variant: "secondary" })} onClick={() => location.reload()}>
          До кімнати
        </Link>
        <Link href="/" className={buttonVariants({ variant: "primary" })}>
          На головну
        </Link>
      </div>
    </main>
  );
}

export function RoomView({ code }: { code: string }) {
  const [nick, setNick] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<RoomSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const tokenRef = useRef<string>("");

  useEffect(() => {
    tokenRef.current = getToken();
    setNick(getSavedNick() || null);
  }, []);

  const socket = usePartySocket({
    host: process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "127.0.0.1:1999",
    room: code.toUpperCase(),
    onMessage(e) {
      const msg = JSON.parse(e.data as string) as ServerMessage;
      if (msg.type === "snapshot") setSnapshot(msg);
      else if (msg.type === "error") {
        setError(msg.message);
        window.setTimeout(() => setError(null), 4000);
      }
    },
    onOpen() {
      if (nick) {
        socket.send(
          JSON.stringify({ type: "join", token: tokenRef.current, nick }),
        );
      }
    },
  });

  // нік з'явився після відкриття сокета — доєднуємось
  useEffect(() => {
    if (nick && socket.readyState === WebSocket.OPEN) {
      socket.send(
        JSON.stringify({ type: "join", token: tokenRef.current, nick }),
      );
    }
  }, [nick, socket]);

  const myId = tokenRef.current;
  const me = snapshot?.players.find((p) => p.id === myId);
  const isMyTurn =
    !!snapshot &&
    snapshot.phase === "playing" &&
    snapshot.turnPlayerId === myId &&
    !snapshot.relocating &&
    me?.eliminatedAt === null;

  const boardValue = useMemo(
    () => ({
      timeline: snapshot?.timeline ?? [],
      current: toGameCard(snapshot?.current ?? null),
      lastMove: snapshot?.lastMove ?? null,
      canAct: isMyTurn,
      place: (index: number) => {
        if (!snapshot?.current) return;
        socket.send(
          JSON.stringify({ type: "place", index, qid: snapshot.current.qid }),
        );
      },
    }),
    [snapshot, isMyTurn, socket],
  );

  if (nick === null) {
    return (
      <NickModal
        initial=""
        onSave={(n) => {
          localStorage.setItem(NICK_KEY, n);
          setNick(n);
        }}
      />
    );
  }

  const turnPlayer = snapshot?.players.find(
    (p) => p.id === snapshot?.turnPlayerId,
  );

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className={buttonVariants({ variant: "ghost", size: "sm" })}>
          ⬅️ Вийти
        </Link>
        <div className="flex items-center gap-3">
          <Chip color="accent">Кімната {code.toUpperCase()}</Chip>
          <ThemeSwitcher />
        </div>
      </header>

      {error && (
        <div className="fixed left-1/2 top-16 z-50 -translate-x-1/2 rounded-full bg-danger-soft px-5 py-2 text-sm font-semibold text-danger-soft-foreground shadow-lg">
          {error}
        </div>
      )}

      {!snapshot ? (
        <div className="flex flex-1 items-center justify-center text-muted">
          Підключення до кімнати…
        </div>
      ) : snapshot.phase === "lobby" ? (
        <Lobby
          snapshot={snapshot}
          code={code.toUpperCase()}
          myId={myId}
          onStart={() => socket.send(JSON.stringify({ type: "start" }))}
          onRename={(n) => socket.send(JSON.stringify({ type: "rename", nick: n }))}
        />
      ) : snapshot.phase === "finished" ? (
        <Podium standings={snapshot.standings} code={code.toUpperCase()} />
      ) : (
        <BoardProvider value={boardValue}>
          <BoardCore
            topSlot={
              <>
                <div className="flex max-w-2xl flex-wrap justify-center gap-2">
                  {snapshot.players.map((p) => (
                    <PlayerRow
                      key={p.id}
                      player={p}
                      isHost={snapshot.hostId === p.id}
                      isTurn={snapshot.turnPlayerId === p.id}
                      isMe={p.id === myId}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  {isMyTurn ? (
                    <span className="rounded-full bg-success-soft px-4 py-1 text-sm font-bold text-success-soft-foreground">
                      Твій хід!
                    </span>
                  ) : (
                    <span className="text-sm text-muted">
                      {me && me.eliminatedAt !== null
                        ? "Ти вибув — спостерігаєш за грою"
                        : `Ходить ${turnPlayer?.nick ?? "…"}`}
                    </span>
                  )}
                  <TurnTimer endsAt={snapshot.turnEndsAt} />
                </div>
              </>
            }
          />
        </BoardProvider>
      )}
    </div>
  );
}
