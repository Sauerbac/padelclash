"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  editMatchAction,
  logMatchAction,
  type EditMatchActionResult,
  type EditMatchPayload,
  type LogMatchActionResult,
  type LogMatchPayload,
  type PayoffDelta,
} from "@/app/actions/matches";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { RatingPayoff } from "@/components/rating-payoff";
import { SearchableSelect } from "@/components/ui/searchable-select";
import { enqueueMatch } from "@/services/offline/queue";
import { uuidv7 } from "@/lib/uuidv7";
import { cn } from "@/lib/utils";
import {
  addSharedMatchToCounts,
  removeSelectedPlayers,
  sortPlayersBySharedMatches,
  type SharedMatchCounts,
} from "@/lib/player-roster";
import {
  toMatchParticipantSides,
  validateMatchIntake,
} from "@/domain/match-intake";
import type { MatchParticipant } from "@/domain/match-participant";
import type { SetScore } from "@/domain/set-score";

interface RosterEntry {
  id: string;
  name: string;
}

const NO_SHARED_MATCHES: SharedMatchCounts = {};

type Side = "A" | "B";
type Slot = "a1" | "a2" | "b1" | "b2";
type DraftParticipant = MatchParticipant | null;
type Slots = Record<Slot, DraftParticipant>;

interface RepeatLineup {
  doubles: boolean;
  slots: Slots;
}

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

function repeatLineupFromSides(
  sides: Record<Side, MatchParticipant[]>,
): RepeatLineup {
  return {
    doubles: sides.A.length === 2,
    slots: {
      a1: sides.A[0] ?? null,
      a2: sides.A[1] ?? null,
      b1: sides.B[0] ?? null,
      b2: sides.B[1] ?? null,
    },
  };
}

/** An existing match being corrected — switches the form into edit mode. */
export interface EditableMatch {
  id: string;
  /** ISO string; converted to the device's local time on the client. */
  playedAtIso: string;
  sides: Record<Side, MatchParticipant[]>;
  winnerSide: Side;
  sets: SetScore[] | null;
}

export type MatchFormDraft = Pick<
  EditableMatch,
  "sides" | "winnerSide" | "sets"
>;

export interface MatchFormActions {
  logMatch?: (payload: LogMatchPayload) => Promise<LogMatchActionResult>;
  editMatch?: (payload: EditMatchPayload) => Promise<EditMatchActionResult>;
  enqueue?: typeof enqueueMatch;
}

export function MatchForm({
  roster,
  reservedPlayerNames,
  loggerId,
  sharedMatchCounts = NO_SHARED_MATCHES,
  editing,
  initialDraft,
  actions,
}: {
  roster: RosterEntry[];
  /** Full roster, including Retired Players whose names Guests may not use. */
  reservedPlayerNames: string[];
  /** The bound player, pre-filled as side A's first slot when logging. */
  loggerId?: string;
  /** Match frequency between the bound viewer and each roster Player. */
  sharedMatchCounts?: SharedMatchCounts;
  /** When set: pre-fill from this match and save corrections to it. */
  editing?: EditableMatch;
  /** Only the gallery passes this to start a new form with a valid draft. */
  initialDraft?: MatchFormDraft;
  /** Gallery stubs; production uses the imported server actions. */
  actions?: MatchFormActions;
}) {
  const logMatch = actions?.logMatch ?? logMatchAction;
  const editMatch = actions?.editMatch ?? editMatchAction;
  const enqueue = actions?.enqueue ?? enqueueMatch;
  const startingDraft = editing ?? initialDraft;
  const [currentSharedMatchCounts, setCurrentSharedMatchCounts] = useState(
    () => sharedMatchCounts,
  );
  const orderedRoster = useMemo(
    () => sortPlayersBySharedMatches(roster, currentSharedMatchCounts),
    [roster, currentSharedMatchCounts],
  );
  const [doubles, setDoubles] = useState(
    startingDraft ? startingDraft.sides.A.length === 2 : true,
  );
  // The Logger pre-fills the first slot of side A (spec "Screens").
  const [slots, setSlots] = useState<Slots>(() =>
    startingDraft
      ? {
          a1: startingDraft.sides.A[0] ?? null,
          a2: startingDraft.sides.A[1] ?? null,
          b1: startingDraft.sides.B[0] ?? null,
          b2: startingDraft.sides.B[1] ?? null,
        }
      : {
          a1: loggerId ? { kind: "player", playerId: loggerId } : null,
          a2: null,
          b1: null,
          b2: null,
        },
  );
  const [winner, setWinner] = useState<Side | null>(
    startingDraft ? startingDraft.winnerSide : null,
  );
  const [recordSets, setRecordSets] = useState(
    Boolean(startingDraft?.sets?.length),
  );
  const [sets, setSets] = useState<SetRow[]>(() =>
    startingDraft?.sets?.length
      ? startingDraft.sets.map((s) => ({ a: String(s.a), b: String(s.b) }))
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
  const [repeatLineup, setRepeatLineup] = useState<RepeatLineup | null>(null);
  const [pending, startTransition] = useTransition();

  // The side→slots mapping, in one place: which slot keys a side uses (and
  // how many of them are live under the current singles/doubles setting).
  function slotsFor(side: Side): Slot[] {
    const keys: Slot[] = side === "A" ? ["a1", "a2"] : ["b1", "b2"];
    return keys.slice(0, doubles ? 2 : 1);
  }
  const activeSlots = [...slotsFor("A"), ...slotsFor("B")];
  const sideValues = (side: Side) =>
    slotsFor(side).map((slot) => slots[slot]);
  const sideParticipants = (side: Side): MatchParticipant[] =>
    sideValues(side).filter(
      (participant): participant is MatchParticipant => participant !== null,
    );
  const nameOf = (participant: DraftParticipant) => {
    if (!participant) return null;
    return participant.kind === "guest"
      ? participant.name.trim() || "Guest"
      : roster.find((player) => player.id === participant.playerId)?.name ??
          "Unknown";
  };

  function sideRows(side: Side) {
    return sideValues(side).map((participant, index) => ({
      participant,
      name: nameOf(participant) ?? `Player ${index + 1}`,
    }));
  }

  function sideLabel(side: Side): React.ReactNode {
    return (
      <span className="flex w-full min-w-0 flex-col items-center gap-1">
        {sideRows(side).map(({ participant, name }, index) => (
          <span
            key={
              participant?.kind === "player"
                ? participant.playerId
                : participant
                  ? `guest-${index}`
                  : `empty-${index}`
            }
            title={participant ? name : undefined}
            className={cn(
              "flex w-full min-w-0 items-center justify-center",
              !participant && "text-muted-foreground",
            )}
          >
            <span className="min-w-0 truncate">{name}</span>
            {participant?.kind === "guest" && (
              <span className="ml-1 shrink-0 font-mono text-[8px] tracking-[1px] text-accent">
                GUEST
              </span>
            )}
          </span>
        ))}
      </span>
    );
  }

  function winnerLabel(side: Side): string {
    const names = sideRows(side)
      .filter(({ participant }) => participant !== null)
      .map(({ name }) => name);
    return names.length === slotsFor(side).length
      ? `${names.join(" and ")} wins`
      : `Side ${side} wins`;
  }

  function submit() {
    const filled = activeSlots.every((slot) => slots[slot] !== null);
    if (!filled) return setError("Pick a participant for every slot.");
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
    const playedAtDate = new Date(playedAt);
    if (Number.isNaN(playedAtDate.getTime())) {
      return setError("Pick when the match was played.");
    }
    const validation = validateMatchIntake(
      {
        sides: {
          A: sideParticipants("A"),
          B: sideParticipants("B"),
        },
        winnerSide: winner,
        sets: parsedSets,
      },
      {
        playerIds: roster.map(({ id }) => id),
        reservedPlayerNames,
      },
    );
    if (!validation.ok) return setError(validation.error.message);
    setError(null);

    startTransition(async () => {
      const payload = {
        id: editing ? editing.id : uuidv7(),
        playedAt: playedAtDate.toISOString(),
        sides: toMatchParticipantSides(validation.sides),
        winnerSide: winner,
        sets: validation.sets,
      };
      // Offline log queue (spec "PWA & offline"): a log that can't reach the
      // server is queued locally and synced later. Edits stay online-only.
      // The queued item records who logged it, so a device later rebound to
      // another player can't sync it under that identity (decision 52).
      const queueLocally = async () => {
        await enqueue({
          ...payload,
          ownerPlayerId: loggerId ?? "",
          // Captured now: if this device is later rebound to someone else,
          // the stuck card still has to name whose match it is.
          ownerPlayerName:
            (loggerId
              ? nameOf({ kind: "player", playerId: loggerId })
              : null) ?? "You",
          names: {
            A: payload.sides.A.map(
              (participant) => nameOf(participant) ?? "Unknown",
            ),
            B: payload.sides.B.map(
              (participant) => nameOf(participant) ?? "Unknown",
            ),
          },
          queuedAt: new Date().toISOString(),
        });
        setRepeatLineup(repeatLineupFromSides(payload.sides));
        setQueued(true);
      };
      if (!editing && !navigator.onLine) return queueLocally();
      try {
        const result = editing
          ? await editMatch(payload)
          : await logMatch({ ...payload, ownerPlayerId: loggerId ?? "" });
        if (result.ok) {
          if (!editing && loggerId) {
            setCurrentSharedMatchCounts((counts) =>
              addSharedMatchToCounts(
                counts,
                loggerId,
                Object.values(payload.sides).flatMap((side) =>
                  side.flatMap((participant) =>
                    participant.kind === "player"
                      ? [participant.playerId]
                      : [],
                  ),
                ),
              ),
            );
          }
          setRepeatLineup(repeatLineupFromSides(payload.sides));
          setPayoff(result.deltas);
        }
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
    // Keep the submitted format and lineup for an immediate rematch. Guests
    // remain new match-scoped entries with the copied name, never identities.
    if (repeatLineup) {
      setDoubles(repeatLineup.doubles);
      setSlots(repeatLineup.slots);
    }
    setRepeatLineup(null);
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
        {([true, false] as const).map((mode) => (
          <Button
            key={String(mode)}
            type="button"
            variant={doubles === mode ? "default" : "ghost"}
            aria-pressed={doubles === mode}
            onClick={() => {
              setDoubles(mode);
              if (!mode) {
                setSlots((current) => ({
                  a1:
                    current.a1?.kind === "guest" ? null : current.a1,
                  a2: null,
                  b1:
                    current.b1?.kind === "guest" ? null : current.b1,
                  b2: null,
                }));
              }
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
        <fieldset
          key={side}
          className="min-w-0 border px-3.5 pt-3.5 pb-4"
        >
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
          <div className="mt-2.5 flex min-w-0 flex-col gap-2">
            {slotsFor(side).map((slot, index) => {
              const selected = slots[slot];
              const selectedPlayerIds = new Set(
                Object.entries(slots).flatMap(([key, participant]) =>
                  key !== slot && participant?.kind === "player"
                    ? [participant.playerId]
                    : [],
                ),
              );
              const otherSideSlotHasGuest = slotsFor(side).some(
                (candidate) =>
                  candidate !== slot && slots[candidate]?.kind === "guest",
              );
              return (
                <ParticipantSelect
                  key={slot}
                  label={`Side ${side}, participant ${index + 1}`}
                  value={selected}
                  onChange={(participant) =>
                    setSlots((current) => ({
                      ...current,
                      [slot]: participant,
                    }))
                  }
                  options={removeSelectedPlayers(
                    orderedRoster,
                    selectedPlayerIds,
                    selected?.kind === "player" ? selected.playerId : undefined,
                  )}
                  allowGuest={
                    doubles &&
                    (selected?.kind === "guest" || !otherSideSlotHasGuest)
                  }
                />
              );
            })}
          </div>
        </fieldset>
      ))}

      {/* Winner picker: two Anton plates around a gold VS. */}
      <div>
        <div className="section-label mb-2.5">Who took the W?</div>
        <div
          className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-stretch gap-2.5"
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
                aria-label={winnerLabel(side)}
                onClick={() => setWinner(side)}
                className={cn(
                  "h-auto min-w-0 w-full overflow-hidden px-2 py-4 font-display text-lg leading-[1.1] font-normal tracking-normal",
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
        {/* Always visible: the common case is logging courtside right after
            the match, and a conditional shortcut is one you have to hunt for. */}
        <Button
          type="button"
          variant="ghost"
          size="xs"
          onClick={() => setPlayedAt(nowLocal())}
          className="ml-auto w-fit px-0 text-sm text-accent hover:text-foreground"
        >
          Now
        </Button>
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
        data-match-submit
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

function ParticipantSelect({
  label,
  value,
  onChange,
  options,
  allowGuest,
}: {
  label: string;
  value: DraftParticipant;
  onChange: (participant: DraftParticipant) => void;
  options: RosterEntry[];
  allowGuest: boolean;
}) {
  const selectValue =
    value?.kind === "player" ? `player:${value.playerId}` : value ? "guest" : "";

  return (
    <div className="min-w-0 space-y-2">
      <SearchableSelect
        value={selectValue}
        onValueChange={(next) => {
          if (next === "guest") {
            onChange({
              kind: "guest",
              name: value?.kind === "guest" ? value.name : "",
            });
            return;
          }
          onChange({ kind: "player", playerId: next.slice("player:".length) });
        }}
        options={[
          ...options.map((player) => ({
            value: `player:${player.id}`,
            label: player.name,
          })),
          ...(allowGuest
            ? [
                {
                  value: "guest",
                  label: "Guest",
                  suffix: (
                    <span className="shrink-0 font-mono text-[9px] tracking-[1px] text-accent">
                      MATCH ONLY
                    </span>
                  ),
                },
              ]
            : []),
        ]}
        label={label}
        placeholder="Pick a participant"
        searchPlaceholder="Search players…"
        emptyText="No players found."
      />
      {value?.kind === "guest" && (
        <Input
          value={value.name}
          maxLength={40}
          autoComplete="off"
          aria-label={`${label}, Guest Name`}
          placeholder="Guest name"
          onChange={(event) =>
            onChange({ kind: "guest", name: event.target.value })
          }
        />
      )}
    </div>
  );
}
