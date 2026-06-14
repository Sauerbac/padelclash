"use client";

import { useActionState, useId, useState } from "react";
import { Button } from "@/ui";
import { logMatchAction, type LogMatchState } from "./actions";

const INITIAL: LogMatchState = {};

export interface LogMatchPlayerOption {
  playerId: string;
  name: string;
}

// The sacred interaction (screens.md §3): pick the two sides, tap the winner, log.
// The tracer-bullet cut is Simple Result + singles (tracer-bullet.md), so this is a
// player each side, a winner, and the competitive/casual switch — no score entry.
// On success the action redirects to the board, where the leaderboard has moved.
//
// Lives in `app`, so it composes ui primitives and tokens directly (binding §2).
// SegmentedToggle isn't built yet (binding §7, bucket 1), so the winner and
// classification switches are token-styled radio groups here for now.
export function LogMatchForm({
  groupId,
  players,
}: {
  groupId: string;
  players: LogMatchPlayerOption[];
}) {
  const [state, formAction, pending] = useActionState(logMatchAction, INITIAL);

  // Controlled so the winner switch can label the two chosen players by name and
  // a same-player pick is caught before submit.
  const [playerA, setPlayerA] = useState(players[0]?.playerId ?? "");
  const [playerB, setPlayerB] = useState(players[1]?.playerId ?? "");
  const [winner, setWinner] = useState<"A" | "B">("A");
  const [classification, setClassification] = useState<"competitive" | "casual">(
    "competitive",
  );

  const nameOf = (id: string) =>
    players.find((p) => p.playerId === id)?.name ?? "—";
  const sameForBothSides = playerA !== "" && playerA === playerB;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <input type="hidden" name="groupId" value={groupId} />
      <input type="hidden" name="winner" value={winner} />
      <input type="hidden" name="classification" value={classification} />

      <SideSelect
        label="Side A"
        name="playerA"
        value={playerA}
        onChange={setPlayerA}
        players={players}
      />
      <SideSelect
        label="Side B"
        name="playerB"
        value={playerB}
        onChange={setPlayerB}
        players={players}
      />

      {sameForBothSides && (
        <p role="alert" className="font-body text-body font-bold text-primary">
          A player can&apos;t be on both sides.
        </p>
      )}

      <Toggle
        legend="Winner"
        value={winner}
        onChange={(v) => setWinner(v as "A" | "B")}
        options={[
          { value: "A", label: nameOf(playerA) },
          { value: "B", label: nameOf(playerB) },
        ]}
      />

      <Toggle
        legend="Type"
        value={classification}
        onChange={(v) => setClassification(v as "competitive" | "casual")}
        options={[
          { value: "competitive", label: "Competitive" },
          { value: "casual", label: "Casual" },
        ]}
      />

      {classification === "casual" && (
        <p className="font-body text-body text-secondary">
          For the record only — casual matches never affect ratings.
        </p>
      )}

      {state.error && (
        <p role="alert" className="font-body text-body font-bold text-primary">
          {state.error}
        </p>
      )}

      <Button type="submit" variant="primary" disabled={pending || sameForBothSides}>
        {pending ? "Logging…" : "Log match"}
      </Button>
    </form>
  );
}

// A token-styled native select — matches TextInput's field treatment (binding §8:
// inputs are straight, bordered, never tilted). Native on purpose: a real picker is
// fast and accessible courtside, and a richer search picker is a later slice.
function SideSelect({
  label,
  name,
  value,
  onChange,
  players,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  players: LogMatchPlayerOption[];
}) {
  return (
    <label className="flex flex-col gap-2">
      <span className="font-mono text-meta font-bold uppercase tracking-wide text-secondary">
        {label}
      </span>
      <select
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-h-11 w-full rounded-button border-bold border-ink bg-surface px-3.5 py-3 font-body text-body font-bold text-ink focus:shadow-button focus:outline-none"
      >
        {players.map((p) => (
          <option key={p.playerId} value={p.playerId}>
            {p.name}
          </option>
        ))}
      </select>
    </label>
  );
}

// A radio group rendered as two equal segments (binding §8: straight, bordered, no
// tilt). The selected segment carries the one orange accent (binding §8 — orange is
// the live/active state). Keyboard- and screen-reader-navigable as a real fieldset.
function Toggle({
  legend,
  value,
  onChange,
  options,
}: {
  legend: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  const groupId = useId();
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-mono text-meta font-bold uppercase tracking-wide text-secondary">
        {legend}
      </legend>
      <div className="flex gap-3">
        {options.map((opt) => {
          const id = `${groupId}-${opt.value}`;
          const active = value === opt.value;
          return (
            <label
              key={opt.value}
              htmlFor={id}
              className={
                "flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-button border-bold border-ink px-4 py-3 text-center font-body text-body font-bold text-ink select-none " +
                (active ? "bg-primary shadow-button" : "bg-surface")
              }
            >
              <input
                id={id}
                type="radio"
                name={`${legend}-radio`}
                checked={active}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              <span className="truncate">{opt.label}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
