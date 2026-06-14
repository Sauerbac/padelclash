import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  Button,
  LeaderboardRow,
  MatchResultBlock,
  PlayerChip,
  RatingDelta,
  TextInput,
} from "@/ui";

// The living visual catalog (binding §3) — the in-code twin of the frozen
// .dc.html cards, rendered with the real tokens, fonts, and primitives at a
// real mobile viewport. Resize the window to 360–375px to validate (binding §9).
// Dev-only / noindex (binding §3, §10).
export const metadata: Metadata = {
  title: "Styleguide · PadelClash",
  robots: { index: false, follow: false },
};

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="font-mono text-meta font-bold uppercase tracking-wide text-secondary">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function StyleguidePage() {
  // Dev tooling: never reachable in production (binding §3).
  if (process.env.NODE_ENV === "production") notFound();

  return (
    // px-6 reserves more than the 8px hero shadow offset, so right-edge shadows
    // never trigger horizontal scroll on a 360px viewport (binding §9).
    <main className="mx-auto flex w-full max-w-md flex-col gap-9 px-6 pt-8 pb-28">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-display text-ink">Styleguide</h1>
        <p className="font-body text-body text-secondary">
          Every src/ui primitive, real tokens, mobile viewport.
        </p>
      </header>

      <Section title="Buttons">
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="confirm">Confirm</Button>
          <Button disabled>Disabled</Button>
          <Button variant="icon" aria-label="Add match">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Button>
        </div>
      </Section>

      <Section title="Text input">
        <div className="flex flex-col gap-4">
          <TextInput label="Group name" placeholder="Monday Smashers" />
          <TextInput label="Display name" defaultValue="Alex Rivera" />
        </div>
      </Section>

      <Section title="Rating delta">
        <div className="flex flex-wrap items-center gap-3">
          <RatingDelta value={14} />
          <RatingDelta value={-13} />
          <RatingDelta value={0} />
        </div>
      </Section>

      <Section title="Player chip">
        <div className="flex flex-col gap-4">
          <PlayerChip name="Alex Rivera" rating={1124} rank={3} avatarColor="teal" you />
          <PlayerChip name="Jordan Kim" rating={1088} rank={4} avatarColor="violet" />
          <PlayerChip name="Sam Doe" variant="unclaimed" avatarColor="butter" />
          <PlayerChip name="Robin Vega" rating={1003} variant="provisional" avatarColor="butter" />
          <PlayerChip name="Casey Ng" rating={970} variant="former-member" avatarColor="primary" />
        </div>
      </Section>

      <Section title="Match result (compact)">
        <div className="flex flex-col gap-4">
          <MatchResultBlock
            sideA={{ players: ["Alex", "Jordan"], won: true }}
            sideB={{ players: ["Sam", "Robin"] }}
            score={["6-4", "7-5"]}
          />
          <MatchResultBlock
            sideA={{ players: ["Casey"] }}
            sideB={{ players: ["Robin"], won: true }}
            score={["3-6", "2-6"]}
            casual
          />
        </div>
      </Section>

      <Section title="Leaderboard rows">
        <div className="flex flex-col">
          <LeaderboardRow rank={1} name="Maria Soto" rating={1342} avatarColor="violet" trend="up" delta={12} matchesPlayed={24} />
          <LeaderboardRow rank={2} name="Jordan Kim" rating={1288} avatarColor="teal" trend="flat" delta={0} matchesPlayed={18} />
          <LeaderboardRow rank={3} name="Alex Rivera" rating={1124} avatarColor="primary" trend="down" delta={-8} matchesPlayed={11} you />
          <LeaderboardRow rank={4} name="Sam Doe" rating={1090} avatarColor="butter" trend="up" delta={5} matchesPlayed={9} />
          <LeaderboardRow rank={5} name="Robin Vega" rating={1003} avatarColor="teal" unranked unrankedLabel="1 of 3" />
        </div>
      </Section>

      <Section title="Reduced motion">
        <div className="flex items-center gap-4">
          <span className="wobble flex size-14 items-center justify-center rounded-pill border-heavy border-ink bg-primary shadow-raised">
            <span className="size-5 rotate-45 rounded-pill border-bold border-ink border-t-transparent border-r-transparent" />
          </span>
          <p className="font-body text-body text-secondary">
            Wobbles by default; still under{" "}
            <span className="font-mono font-bold">prefers-reduced-motion</span>.
          </p>
        </div>
      </Section>
    </main>
  );
}
