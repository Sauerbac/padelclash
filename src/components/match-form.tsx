"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  editMatchAction,
  logMatchAction,
  type PayoffDelta,
} from "@/app/actions/matches";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RatingPayoff } from "@/components/rating-payoff";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { enqueueMatch } from "@/lib/offline-queue";
import { uuidv7 } from "@/lib/uuidv7";
import { cn } from "@/lib/utils";

interface RosterEntry {
  id: string;
  name: string;
}

type Side = "A" | "B";
type Slot = "a1" | "a2" | "b1" | "b2";
type Slots = Record<Slot, string>;

interface SetRow {
  a: string;
  b: string;
}

/** A moment in datetime-local input format (YYYY-MM-DDTHH:mm), device-local. */
function toLocalInput(date: Date): string {
  const d = new Date(date);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

function nowLocal(): string {
  return toLocalInput(new Date());
}

/** An existing match being corrected — switches the form into edit mode. */
export interface EditableMatch {
  id: string;
  /** ISO string; converted to the device's local time on the client. */
  playedAtIso: string;
  sides: Record<Side, string[]>;
  winnerSide: Side;
  sets: { a: number; b: number }[] | null;
}

export function MatchForm({
  roster,
  loggerId,
  editing,
}: {
  roster: RosterEntry[];
  /** The bound player, pre-filled as side A's first slot when logging. */
  loggerId?: string;
  /** When set: pre-fill from this match and save corrections to it. */
  editing?: EditableMatch;
}) {
  const [doubles, setDoubles] = useState(
    editing ? editing.sides.A.length === 2 : false,
  );
  // The Logger pre-fills the first slot of side A (spec "Screens").
  const [slots, setSlots] = useState<Slots>(() =>
    editing
      ? {
          a1: editing.sides.A[0] ?? "",
          a2: editing.sides.A[1] ?? "",
          b1: editing.sides.B[0] ?? "",
          b2: editing.sides.B[1] ?? "",
        }
      : { a1: loggerId ?? "", a2: "", b1: "", b2: "" },
  );
  const [winner, setWinner] = useState<Side | null>(
    editing ? editing.winnerSide : null,
  );
  const [recordSets, setRecordSets] = useState(
    Boolean(editing?.sets?.length),
  );
  const [sets, setSets] = useState<SetRow[]>(() =>
    editing?.sets?.length
      ? editing.sets.map((s) => ({ a: String(s.a), b: String(s.b) }))
      : [{ a: "", b: "" }],
  );
  // Defaults to "now" (spec "Match"). The server render can't know the
  // device's local time; hydration replaces it with the client's value and
  // the input carries suppressHydrationWarning for the transient mismatch.
  const [playedAt, setPlayedAt] = useState(() =>
    editing ? toLocalInput(new Date(editing.playedAtIso)) : nowLocal(),
  );

  const [error, setError] = useState<string | null>(null);
  const [payoff, setPayoff] = useState<PayoffDelta[] | null>(null);
  const [queued, setQueued] = useState(false);
  const [pending, startTransition] = useTransition();

  // The side→slots mapping, in one place: which slot keys a side uses (and
  // how many of them are live under the current singles/doubles setting).
  function slotsFor(side: Side): Slot[] {
    const keys: Slot[] = side === "A" ? ["a1", "a2"] : ["b1", "b2"];
    return keys.slice(0, doubles ? 2 : 1);
  }
  const activeSlots = [...slotsFor("A"), ...slotsFor("B")];
  const sideIds = (side: Side) => slotsFor(side).map((slot) => slots[slot]);
  const nameOf = (id: string) => roster.find((p) => p.id === id)?.name;

  function sideLabel(side: Side): string {
    const names = sideIds(side)
      .map((id) => nameOf(id))
      .filter(Boolean);
    return names.length > 0 ? names.join(" & ") : `Side ${side}`;
  }

  function submit() {
    const filled = activeSlots.every((s) => slots[s] !== "");
    if (!filled) return setError("Pick a player for every slot.");
    if (!winner) return setError("Pick the winning side.");
    // Every Match needs a Player Logger (spec decision 49). The Log Match page
    // doesn't render this form unbound, so this is a backstop, not a flow.
    if (!editing && !loggerId) {
      return setError("Join as a player on this device before logging.");
    }
    const parsedSets = recordSets
      ? sets.map((s) => ({ a: Number(s.a), b: Number(s.b) }))
      : null;
    if (
      parsedSets &&
      (parsedSets.length === 0 ||
        sets.some((s) => s.a.trim() === "" || s.b.trim() === ""))
    ) {
      return setError("Fill in every set score, or switch set scores off.");
    }
    setError(null);

    startTransition(async () => {
      const payload = {
        id: editing ? editing.id : uuidv7(),
        playedAt: new Date(playedAt).toISOString(),
        sides: { A: sideIds("A"), B: sideIds("B") },
        winnerSide: winner,
        sets: parsedSets,
      };
      // Offline log queue (spec "PWA & offline"): a log that can't reach the
      // server is queued locally and synced later. Edits stay online-only.
      // The queued item records who logged it, so a device later rebound to
      // another player can't sync it under that identity (decision 52).
      const queueLocally = async () => {
        await enqueueMatch({
          ...payload,
          ownerPlayerId: loggerId ?? "",
          names: {
            A: sideIds("A").map((id) => nameOf(id) ?? "Unknown"),
            B: sideIds("B").map((id) => nameOf(id) ?? "Unknown"),
          },
          queuedAt: new Date().toISOString(),
        });
        setQueued(true);
      };
      if (!editing && !navigator.onLine) return queueLocally();
      try {
        const result = editing
          ? await editMatchAction(payload)
          : await logMatchAction({ ...payload, ownerPlayerId: loggerId ?? "" });
        if (result.ok) setPayoff(result.deltas);
        else setError(result.error);
      } catch {
        // The action call itself failed — no connection.
        if (editing) setError("You're offline — edits need a connection.");
        else await queueLocally();
      }
    });
  }

  function reset() {
    setPayoff(null);
    setQueued(false);
    setSlots({ a1: loggerId ?? "", a2: "", b1: "", b2: "" });
    setWinner(null);
    setRecordSets(false);
    setSets([{ a: "", b: "" }]);
    setPlayedAt(nowLocal());
  }

  // No connection: the match is safe on the device, ratings come later.
  if (queued) {
    return (
      <div className="space-y-4">
        <section className="border border-accent p-4">
          <h2 className="font-display text-[26px] leading-none text-accent uppercase">
            Match queued
          </h2>
          <p className="mt-2 text-[15px] font-semibold text-muted-foreground">
            You&apos;re offline right now. The match is saved on this device
            and syncs automatically the next time you&apos;re online — until
            then it shows as{" "}
            <span className="text-foreground">pending sync</span> in your
            feed.
          </p>
        </section>
        <Button onClick={reset} className="w-full">
          Log another match
        </Button>
      </div>
    );
  }

  // The payoff moment: every participant's rating change, front and center.
  if (payoff) {
    return (
      <div className="space-y-4">
        <RatingPayoff
          title={editing ? "Match updated" : "Match logged"}
          deltas={payoff}
        />
        {editing ? (
          <Button asChild variant="outline" className="h-11 w-full">
            <Link href="/">Back to feed</Link>
          </Button>
        ) : (
          <Button onClick={reset} className="w-full">
            Log another match
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Singles/doubles segmented toggle: wrapper carries the border. */}
      <div className="flex border" role="group" aria-label="Match mode">
        {([false, true] as const).map((mode) => (
          <Button
            key={String(mode)}
            type="button"
            variant={doubles === mode ? "default" : "ghost"}
            aria-pressed={doubles === mode}
            onClick={() => {
              setDoubles(mode);
              if (!mode) setSlots((s) => ({ ...s, a2: "", b2: "" }));
            }}
            className={cn(
              "h-auto flex-1 py-2.5 font-sans text-sm tracking-[2px]",
              doubles === mode ? "font-bold" : "font-semibold",
            )}
          >
            {mode ? "Doubles" : "Singles"}
          </Button>
        ))}
      </div>

      {(["A", "B"] as const).map((side) => (
        <fieldset key={side} className="border px-3.5 pt-3.5 pb-4">
          <legend className="sr-only">Side {side}</legend>
          <div
            aria-hidden
            className={cn(
              "section-label",
              side === "A" ? "text-primary" : "text-accent",
            )}
          >
            Side {side}
          </div>
          <div className="mt-2.5 flex flex-col gap-2">
            {slotsFor(side).map((slot) => (
              <PlayerSelect
                key={slot}
                value={slots[slot]}
                onChange={(id) => setSlots((s) => ({ ...s, [slot]: id }))}
                options={roster.filter(
                  (p) =>
                    p.id === slots[slot] ||
                    !Object.values(slots).includes(p.id),
                )}
              />
            ))}
          </div>
        </fieldset>
      ))}

      {/* Winner picker: two Anton plates around a gold VS. */}
      <div>
        <div className="section-label mb-2.5">Who took the W?</div>
        <div
          className="flex items-stretch gap-2.5"
          role="group"
          aria-label="Winner"
        >
          {(["A", "B"] as const).map((side, i) => (
            <span key={side} className="contents">
              {i > 0 && (
                <span
                  aria-hidden
                  className="self-center font-display text-base text-accent"
                >
                  VS
                </span>
              )}
              <Button
                type="button"
                variant={winner === side ? "default" : "outline"}
                aria-pressed={winner === side}
                onClick={() => setWinner(side)}
                className={cn(
                  "h-auto min-w-0 flex-1 px-1.5 py-4 font-display text-xl leading-[1.1] font-normal tracking-normal whitespace-normal",
                  winner !== side && "text-muted-foreground hover:text-foreground",
                )}
              >
                {sideLabel(side)}
              </Button>
            </span>
          ))}
        </div>
      </div>

      {/* Set scores: optional detail, centred flat score cells. */}
      <div className="border p-3.5">
        <div className="flex items-center justify-between">
          <label htmlFor="record-sets" className="section-label">
            Set scores
          </label>
          <Switch
            id="record-sets"
            checked={recordSets}
            onCheckedChange={setRecordSets}
          />
        </div>
        {recordSets ? (
          <div className="mt-3 flex flex-col gap-2">
            {sets.map((set, i) => (
              <div key={i} className="flex items-center gap-2.5">
                <span className="w-13 text-sm font-semibold tracking-[2px] text-muted-foreground uppercase">
                  Set {i + 1}
                </span>
                <Input
                  type="number"
                  min={0}
                  max={99}
                  inputMode="numeric"
                  aria-label={`Set ${i + 1}, side A games`}
                  value={set.a}
                  onChange={(e) =>
                    setSets((rows) =>
                      rows.map((r, j) =>
                        j === i ? { ...r, a: e.target.value } : r,
                      ),
                    )
                  }
                  className="h-10 w-14 shrink-0 px-0 text-center text-lg [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                <span className="text-muted-foreground">—</span>
                <Input
                  type="number"
                  min={0}
                  max={99}
                  inputMode="numeric"
                  aria-label={`Set ${i + 1}, side B games`}
                  value={set.b}
                  onChange={(e) =>
                    setSets((rows) =>
                      rows.map((r, j) =>
                        j === i ? { ...r, b: e.target.value } : r,
                      ),
                    )
                  }
                  className="h-10 w-14 shrink-0 px-0 text-center text-lg [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                />
                {sets.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    aria-label={`Remove set ${i + 1}`}
                    className="ml-auto"
                    onClick={() =>
                      setSets((rows) => rows.filter((_, j) => j !== i))
                    }
                  >
                    ✕
                  </Button>
                )}
              </div>
            ))}
            {sets.length < 5 && (
              <Button
                type="button"
                variant="ghost"
                size="xs"
                onClick={() => setSets((rows) => [...rows, { a: "", b: "" }])}
                className="mt-0.5 w-fit px-0 text-sm text-accent hover:text-foreground"
              >
                + Add set
              </Button>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm font-semibold text-muted-foreground">
            Off — just the winner is recorded.
          </p>
        )}
      </div>

      {/* Played at: native datetime-local styled as a bordered row. */}
      <div className="flex items-center justify-between gap-3 border py-1.5 pr-2 pl-3.5">
        <label htmlFor="played-at" className="section-label shrink-0">
          Played at
        </label>
        <Input
          id="played-at"
          type="datetime-local"
          value={playedAt}
          onChange={(e) => setPlayedAt(e.target.value)}
          suppressHydrationWarning
          className="h-9 w-fit bg-transparent px-1 text-right font-mono text-sm font-medium [color-scheme:dark]"
        />
      </div>

      {error && <Alert variant="destructive">{error}</Alert>}

      <Button
        onClick={submit}
        disabled={pending}
        size="lg"
        className="w-full text-[22px]"
      >
        {editing
          ? pending
            ? "Saving…"
            : "Save changes"
          : pending
            ? "Logging…"
            : "Log it. Own it."}
      </Button>
    </div>
  );
}

function PlayerSelect({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (id: string) => void;
  options: RosterEntry[];
}) {
  // SelectValue can't derive the label from an item it has never mounted
  // (the pre-filled logger renders before the dropdown first opens), so the
  // selected name is passed as children explicitly.
  const selectedName = options.find((p) => p.id === value)?.name;
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Pick a player">{selectedName}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((p) => (
          <SelectItem key={p.id} value={p.id}>
            {p.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
