"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  editMatchAction,
  logMatchAction,
  type PayoffDelta,
} from "@/app/actions/matches";
import { Button } from "@/components/ui/button";
import { DeltaBadge } from "@/components/delta-badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { uuidv7 } from "@/lib/uuidv7";

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
      const result = editing
        ? await editMatchAction(payload)
        : await logMatchAction(payload);
      if (result.ok) setPayoff(result.deltas);
      else setError(result.error);
    });
  }

  function reset() {
    setPayoff(null);
    setSlots({ a1: loggerId ?? "", a2: "", b1: "", b2: "" });
    setWinner(null);
    setRecordSets(false);
    setSets([{ a: "", b: "" }]);
    setPlayedAt(nowLocal());
  }

  // The payoff moment: every participant's rating change, front and center.
  if (payoff) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{editing ? "Match updated" : "Match logged"}</CardTitle>
          <CardDescription>Ratings have been updated.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ul className="space-y-2">
            {payoff.map((d) => (
              <li key={d.playerId} className="flex items-center gap-2 text-sm">
                <span className="flex-1 font-medium">{d.name}</span>
                <span className="text-muted-foreground">
                  {Math.round(d.ratingBefore)} → {Math.round(d.ratingAfter)}
                </span>
                <DeltaBadge delta={d.delta} />
              </li>
            ))}
          </ul>
          {editing ? (
            <Button asChild className="w-full">
              <Link href="/">Back to feed</Link>
            </Button>
          ) : (
            <Button onClick={reset} className="w-full">
              Log another match
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Label htmlFor="doubles">Doubles</Label>
        <Switch
          id="doubles"
          checked={doubles}
          onCheckedChange={(on) => {
            setDoubles(on);
            if (!on) setSlots((s) => ({ ...s, a2: "", b2: "" }));
          }}
        />
      </div>

      {(["A", "B"] as const).map((side) => (
        <fieldset key={side} className="space-y-2">
          <legend className="text-sm font-medium">Side {side}</legend>
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
        </fieldset>
      ))}

      <div className="space-y-2">
        <Label>Winner</Label>
        <div className="grid grid-cols-2 gap-2">
          {(["A", "B"] as const).map((side) => (
            <Button
              key={side}
              type="button"
              variant={winner === side ? "default" : "outline"}
              onClick={() => setWinner(side)}
              className="truncate"
            >
              {sideLabel(side)}
            </Button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="record-sets">Set scores</Label>
          <Switch
            id="record-sets"
            checked={recordSets}
            onCheckedChange={setRecordSets}
          />
        </div>
        {recordSets ? (
          <div className="space-y-2">
            {sets.map((set, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-10 text-sm text-muted-foreground">
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
                />
                <span className="text-muted-foreground">–</span>
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
                />
                {sets.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label={`Remove set ${i + 1}`}
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
                variant="outline"
                size="sm"
                onClick={() => setSets((rows) => [...rows, { a: "", b: "" }])}
              >
                Add set
              </Button>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            Off — just the winner is recorded.
          </p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="played-at">Played at</Label>
        <Input
          id="played-at"
          type="datetime-local"
          value={playedAt}
          onChange={(e) => setPlayedAt(e.target.value)}
          suppressHydrationWarning
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <Button onClick={submit} disabled={pending} className="w-full">
        {editing
          ? pending
            ? "Saving…"
            : "Save changes"
          : pending
            ? "Logging…"
            : "Log match"}
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
