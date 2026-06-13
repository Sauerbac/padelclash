# PadelClash — Screen Descriptions for UI Design

Functional descriptions of the ten main screens, written to be handed to a design tool.
They specify **what each screen must contain and do** — content, hierarchy, actions, states —
and deliberately say nothing about visual style, layout grids, components or frameworks.
The design tool owns the visual philosophy; these descriptions own the structure.

Domain terms (Player, Group, Rating, Pending, Session, …) are defined in [CONTEXT.md](../../CONTEXT.md).

---

## What is PadelClash?

PadelClash is a rating and competition tracker for **private padel groups** — a circle of
friends, a company crew, or a club community of up to ~100 people who play together
regularly. Today these groups track results in a spreadsheet or not at all; PadelClash
replaces that: someone logs each match in seconds, and the app turns the match log into
everything the group argues and brags about — an **Elo rating** per player, a **leaderboard**,
win streaks, head-to-head records, partner chemistry ("you and Max win 78% together"),
tournaments, and seasons with a champion.

The heart of the app is a loop: *play → log the match in under 10 seconds → watch your
rating jump → check the leaderboard → want to play again.* The rating delta ("+14!") is the
dopamine; the leaderboard is the social currency that gets screenshotted into the group chat.

Three things define its character:

- **Private, not public.** Everything lives inside a closed group. No strangers, no global
  noise — your numbers only mean something to the people you actually play with. (An opt-in
  global ranking exists as a late ambition, but the group is the world.)
- **Courtside, not deskside.** It's used on a phone between matches — sweaty hands, one
  thumb, twenty seconds. It must be fast and glanceable first, deep second.
- **Banter, not bureaucracy.** The tone is competitive fun among friends: trash-talk bio
  lines, upset highlights, a "Chaos Mode" team generator, badges for losing streaks. The
  numbers themselves stay honest and trustworthy — the drama is in what they reveal, never
  in fudging them.

Padel only, by deliberate decision — the app leans into the sport's quirks: doubles with
rotating partners (hence chemistry stats and the team Balancer), Americano evenings, and
the multi-match session as the normal way a night unfolds.

---

## 0. Cross-cutting foundations (read first)

These apply to every screen and should shape the overall design philosophy.

**Device & situation.** Mobile-first web app. The defining usage moment is *courtside*: sweaty
hands, one thumb, bright daylight, 20 seconds between matches. Desktop is a secondary,
roomier view of the same screens — never a different product. Anything that matters must be
reachable and legible in that courtside moment; depth and detail may live one tap deeper.

**Tone.** Competitive banter among friends, not corporate sports analytics. Ratings, streaks,
rivalries and badges are social currency — the app should feel like it enjoys the drama
(big rating deltas, upset highlights, trash-talk bio lines) while staying trustworthy about
the numbers themselves.

**The one sacred interaction.** Logging a match must take under 10 seconds. Every screen that
hosts a "log match" entry point must make it the most prominent action available. Nothing —
no feature, no navigation idea — may add a required step in front of quick-log.

**Group scope.** Almost every screen lives *inside one group*. A player can belong to several
groups; the current group is a persistent, always-visible context (name + avatar) with a
low-friction switcher. Ratings, leaderboards, stats and feeds never mix groups.

**Recurring shared elements** (design once, reuse everywhere):

- **Player chip** — avatar + name. Variants: with rating, with rank, greyed "Former Member",
  an "unclaimed" marker for players without accounts, and a "provisional" marker for
  fresh ratings. Used in lists, match results, pickers, feeds.
- **Match result block** — the canonical way a finished match appears anywhere: both sides
  (1–2 player chips each), winner clearly marked, the score in one of three formats
  (set score "6-4 3-6 7-5", points score "21–14", or simple "won"), and each participant's
  rating delta (e.g. "+14 / −14"). Compact list variant and full variant. May carry labels:
  **Pending** (awaiting confirmation), **Casual** (no rating impact), **Contested**.
- **Rating delta** — signed number that appears constantly (+14, −9). It is the product's
  dopamine; it deserves a consistent, instantly recognizable treatment, positive vs negative.
- **Win probability** — a percentage pair for two sides ("64% : 36%"), shown before matches
  and in the Balancer. Needs one consistent visual idiom.
- **Empty states** — every list screen needs a designed empty state that tells a brand-new
  group what to do next (usually: log a match or invite someone). The app's first-week
  experience is mostly empty states.

**Navigation.** Assume 4–5 ever-present top-level destinations inside a group (e.g. Home,
Leaderboard, Log — center stage —, Stats, Play/Events) plus overflow for settings and the
notification inbox (bell with unread count). Exact split is the designer's call; the
constraint is: Home, Leaderboard and Log are never more than one tap away.

---

## 1. Welcome & Onboarding

**Purpose.** Get a person from a link or a blank app into a living group with minimal
ceremony. Three very different people arrive here: the *founder* (creates everything),
the *invited friend* (clicks a claim/invite link from WhatsApp), and the *returning user*
(just logs in).

**Entry points.** Direct visit (logged out), group invite link, personal claim link,
join code typed manually.

**Content & flows.**

1. **Logged-out landing**: app name + one-sentence promise ("Track matches, climb your
   group's ranking"), then two equal paths: *Sign in* and *Create account*.
   Auth methods: email + password (with email verification) and Google sign-in — both
   present from the start, neither buried.
2. **Claim flow** (arrived via personal claim link): the emotional high point of onboarding.
   Before creating an account, the person sees *who they already are*: "You are **Jonas** in
   **Monday Night Smashers** — 12 matches, rating 1043, rank #4." Then one step: create
   account (or sign in) → identity attaches, full history inherited. This must feel like
   claiming an existing trophy shelf, not filling a form.
3. **Join flow** (group invite link or short join code): shows the group's name, avatar,
   motto and member count, then a single *Join* action. A join-code entry field must exist
   for "just type X into the app" across the court.
4. **Create-group flow** (founder path): name, optional avatar and motto — nothing else.
   Immediately afterwards the founder lands on an empty Group Home whose empty state pushes
   the two bootstrap actions: *add players* (as unclaimed players, just a name each) and
   *log your first match* (backdating allowed). The founder must be able to build a living,
   populated group entirely alone.
5. **First-login profile nudge** (skippable, never blocking): display name, avatar,
   preferred court side (left/right), handedness, one-line bio (~80 chars).

**States.** Account exists already (route to sign-in), expired/rotated invite link
(friendly dead-end with "ask your admin"), claim link already used.

**Multi-group users** land on a simple group picker (or straight into their only group).

---

## 2. Group Home

**Purpose.** The screen the app opens to: "what happened in my group, what needs my
attention, and the fastest path to logging a match." It is the group's living room —
checked between sessions for banter, glanced at courtside for action.

**Entry points.** App open (default screen), group switcher, back-navigation hub.

**Content & hierarchy** (top to bottom by urgency):

1. **Group identity header**: group avatar + name (+ motto), entry point to the group
   switcher and to group settings. If a season is active: season name and time remaining,
   compact.
2. **Attention strip** (only when non-empty): items that want action from *me* —
   "Confirm the result vs. Max & Jonas" (one tap to confirm right here, or open detail),
   a contested match I'm involved in, a tournament round waiting on my score, an RSVP
   request. At most a handful; this is a to-do strip, not a feed.
3. **Primary action: Log a match** — the most prominent interactive element on the screen,
   always visible without scrolling.
4. **My standing, at a glance**: my current rating, rank (e.g. "#3 of 11"), trend over the
   last 7 days (↑/↓ with amount), current streak. One compact block linking to my profile.
5. **Activity feed** (the body of the screen): chronological entries —
   match results (full match result block with rating deltas), milestones ("Anna hits a
   5-win streak"), auto-highlights ("UPSET: Tom & Lisa beat the #1 pairing at 22%"),
   tournament completions, season events, new members joining. Casual matches appear
   compact and labelled. Each entry supports **reactions** from a fixed set of five
   (🔥 😂 💀 👑 🥲) with per-emoji counts. **No comments** — by design.
6. Secondary entry points (can live in the feed's rhythm or as a light shelf):
   upcoming scheduled matches / active tournament shortcut when they exist.

**States.**
- **Brand-new group**: the empty state is the founder's onboarding (see screen 1) —
  add players, log first match, share invite link. This state must look inviting, not broken.
- **Quiet week**: feed with older entries; never artificially filled.

---

## 3. Log a Match

**Purpose.** Record who played whom and how it ended — in under 10 seconds for the standard
case. This is the heartbeat interaction; the entire flow is optimized for "match 3 of a
Tuesday evening, entered courtside while the next four warm up."

**Entry points.** Primary action on Group Home and navigation; "rematch" from a match
detail (pre-filled players); result prompt after a scheduled match (pre-filled); inside a
Session (pre-filled with present players); inside a tournament round (its own slimmer
context, see screen 9).

**The fast path (must be possible with ~6 taps total):**

1. **Pick players**: select 4 players for doubles (or 2 for singles — the 2v2/1v1 switch
   must be obvious but default to doubles). The picker shows *recent players first*, then
   the full member list, searchable. Unclaimed players appear like anyone else; a
   **"new player" inline-create** (just a name) must exist right inside the picker —
   someone's cousin shows up unannounced all the time.
2. **Assign sides**: the four picks split into Side A / Side B with a one-tap way to shuffle
   who partners whom.
3. **Pick the winner**: tap the winning side. This alone is a valid result (Simple Result).
4. **Done** — show the payoff immediately: rating deltas for all four players ("you +14"),
   new ranks if changed, and whether the match is Pending confirmation. This moment is the
   product's dopamine hit; design it as a small celebration, not a toast.

**Progressive disclosure (never gates the fast path):**

- **Set score entry**: add per-set games (6-4, 3-6, 7-5…), 1–5 sets. Winner is derived,
  mismatches flagged. Points score (one points total per side) for Americano-style play.
- **Date/time**: defaults to now; freely backdatable (founders import history this way —
  make backdating pleasant, not a hidden hack).
- **Casual toggle**: default *competitive*; flipping to casual means "for the record only,
  no rating impact" and must say so.
- **Pre-match win probability** can be shown once four players are picked ("64% : 36%") —
  a delightful detail, never a required step.

**Rules to respect.** Any group member can log, including non-participants. A logged match
applies to ratings immediately but enters **Pending** (48h confirmation window) unless the
group runs Trust Mode, the match is casual, or the whole opposing side is unclaimed.

**States.** Editing an existing match reuses this flow pre-filled (edits put a confirmed
match back to Pending — warn inline). Validation: same player on both sides, missing winner.

---

## 4. Match Detail & Confirmation

**Purpose.** One match, fully told: the result, what it did to ratings, and the integrity
controls (confirm / contest / edit / audit). Also the landing target of confirmation
notifications and feed taps.

**Entry points.** Feed entry, match history lists, confirmation notification, head-to-head
lists, tournament standings.

**Content & hierarchy:**

1. **The result**, large: both sides with player chips, winner unmistakable, score in its
   format. Date/time, logger ("logged by Max"), labels: Competitive/Casual,
   **Pending** (with time remaining until auto-confirm), Contested, part of Tournament X /
   Session Y when applicable.
2. **Rating impact**: per-player rating deltas and resulting new ratings; rank changes if
   any ("Anna climbs to #2"). Pre-match win probability shown retrospectively ("Side A was
   expected to win at 64%") — this is what makes upsets legible.
3. **Confirmation panel** (only while Pending, only for the opposing side):
   *Confirm* (one tap, any one opposing player suffices) and *Contest* (requires a short
   note: "was 6-4 not 6-3"). Show who already confirmed/contested.
4. **Contest state** (when contested): the contest note, the logger's option to correct
   (which restarts confirmation), and — for admins — a *resolve* action that sets the
   final result.
5. **Context block**: head-to-head standing between these sides after this match
   ("Max & Jonas lead this pairing 7–3"), link to the rivalry page if one exists.
6. **Actions**: *Rematch* (pre-fills the log flow with the same players), edit (logger,
   while Pending; anyone's edit after confirmation re-triggers confirmation), delete
   (logger while Pending; admin afterwards).
7. **Audit trail**, collapsed by default: who logged, edited, contested, confirmed,
   resolved — with timestamps and what changed.

**States.** Pending vs confirmed vs contested are the big three and must be visually
unambiguous at a glance. Casual matches show no rating impact section (say why, gently).

---

## 5. Leaderboard

**Purpose.** The ranked table of the group — where the bragging rights live. The screen
people screenshot into the group chat. It must be instantly legible and feel *alive*
(movement, trends), not like a database table.

**Entry points.** Top-level navigation; rank links from profiles and feed entries.

**Content & hierarchy:**

1. **Scope control**: current season (default when seasons are on) vs all-time. The rating
   number is the same in both (one continuous rating); the season lens shows season W/L and
   rating gained this season.
2. **Top 3** treated specially — a podium moment worth screenshotting.
3. **The ranked table**: one row per Ranked player — rank, player chip, rating,
   W/L record, 7-day rating trend (↑/↓ with amount), rank change vs one week ago
   ("+2 places"), current streak if notable. Provisional players carry their marker.
   **My own row is visually anchored** — when I'm rank #14, I shouldn't have to hunt for
   myself.
4. **Unranked section** below the table, visually subdued: players with fewer than
   3 competitive confirmed matches, each with progress ("1 of 3 matches"). This doubles as
   a nudge for new members.
5. **Former members** are absent (their history remains elsewhere).
6. **Secondary boards** (a switcher or shelf, v1.2 — design the affordance now):
   most matches this month, best win rate this month (min. 5 matches), longest active
   streak, and the **Pairings board** (fixed duos with ≥3 matches together, ranked by win
   rate and combined rating). These exist so the bottom half has something to top.

**Row tap** → player profile. **Pairing tap** → pairing/chemistry detail.

**States.** Fewer than 2 ranked players: empty-ish state explaining the 3-match threshold
and pointing at quick-log. Season just rolled over: everyone provisional, fresh-start mood.

---

## 6. Player Profile

**Purpose.** A player's identity and record within the current group: who they are, how good
they are, how they got there, and their trophy shelf. Visible only to co-group members.
Same screen for myself and others; "my view" adds edit and settings entry points.

**Entry points.** Any player chip anywhere, my standing block on Home, leaderboard rows.

**Content & hierarchy:**

1. **Identity header**: avatar, display name, one-line trash-talk bio, preferred court side
   (left/right) and handedness, unclaimed/provisional/Former-Member markers when applicable.
   For unclaimed players, an admin/inviter-facing action: *send claim link*.
2. **The number**: current rating, rank ("#3 of 11"), 7-day trend, current streak.
3. **Rating-over-time graph** — the single most important visualization in the app. Time on
   the x-axis, rating on the y-axis, season rollovers marked as visible breaks/markers,
   tappable points revealing the match that caused each swing. It ships in the MVP and is
   the centerpiece of the profile.
4. **Record block**: matches played, W/L and win rate, sets won/lost when known, longest
   streak, form (last 10 results as compact win/loss sequence).
5. **Badge showcase**: earned badges as a collectible shelf (grid), with earn dates; a
   locked/secret affordance for not-yet-earned ones. (Arrives M4 — reserve the space in the
   design.)
6. **Relationship blocks** (viewing someone else): head-to-head vs me ("You lead Jonas
   12–8", link to full breakdown), chemistry with me as partners if ≥3 matches together.
   Link to rivalry page if one exists.
7. **Recent matches**: compact match result blocks, link to full filtered history.
8. **My-view extras**: edit profile, account settings, notification preferences,
   my groups, opt-in toggle for the Global Rating (when it exists).

**States.** Unclaimed player (no account yet — show it plainly plus the claim action),
provisional rating (explain the faster movement in one sentence), Former Member (read-only,
clearly marked).

---

## 7. Statistics & Match History

**Purpose.** The group's collective memory and argument-settling engine: browse every match
ever, and explore the aggregate truths — who beats whom, which partnerships work, what
records stand. The longer the group plays, the better this screen gets.

**Entry points.** Top-level navigation; "see all" from profiles; head-to-head links.

**Content — three faces of one area:**

1. **Match history**: reverse-chronological list of all group matches as compact match
   result blocks. Filters: by player, by partner, by opponent, by date range,
   competitive/casual, by tournament/session. Fast and scannable — this list will reach
   thousands of entries.
2. **Head-to-head** (any two players): pick two players → full record ("12–8"),
   match list between them, win rate, last meeting, current bragging-rights holder.
   Casual matches counted but labelled. This view is also a rivalry page in embryo —
   at ≥5 competitive meetings it carries the rivalry framing (all-time tally, narrative).
3. **Partner chemistry** (the padel-special): for one player, their win rate with each
   partner they've played ≥3 matches with — "with Max 78%, with Tom 35%" — sortable,
   with match counts for honesty about sample size. Designed to start arguments.
4. **Records page** (group-wide, v1.2): longest streak ever, biggest upset (lowest
   pre-match win probability that won), most matches in a month, nemesis & favorite victim
   per player. A trophy cabinet of stories.

**States.** Sparse data dominates the first weeks: below thresholds (e.g. <3 matches
together) show progress toward meaningfulness rather than noisy numbers. Empty: point to
logging.

---

## 8. Balancer — "Who plays with whom?"

**Purpose.** Solve the eternal pre-match debate: given the players present, propose the
fairest 2v2 split. Pure courtside utility — used standing on the court, decides the next
10 minutes. The app's standout differentiator; it should feel like a little magic trick.

**Entry points.** Top-level/quick action ("Who plays with whom?"); later embedded in
Sessions and scheduled-match conversion.

**Flow & content:**

1. **Pick who's present**: same player picker as quick-log (recent first, search,
   inline-create). Exactly 4 for v1.
2. **Proposals**: the **fairest split** front and center — both pairings shown with player
   chips and the predicted win probability ("52% : 48%"), framed as a recommendation.
   Below it the **second-fairest** alternative. Each proposal: one tap to accept.
3. **Chaos Mode**, one deliberate tap away: the most lopsided split, clearly labelled and
   played for laughs ("87% : 13% — good luck"). It's a feature, not an error state.
4. **Low-confidence marker** when a provisional player is involved: the suggestion stands,
   with a light "rating still settling" honesty note.
5. **Accept** → hands off into the log-match flow with sides pre-filled (the match gets
   played, then logged with one tap of the winner), and/or pins the chosen split on the
   active Session.
6. **Reshuffle** affordance to re-pick players quickly when the group on court changes.

**States.** Fewer than 4 selectable players: explain and link to adding players. All-new
players (everyone provisional): still works, with the honesty note prominent.

---

## 9. Tournament

**Purpose.** Run a structured event — Americano first and foremost (the rotating-partner
points format friend groups actually play), plus knockout brackets and round robin — from
sign-up through live rounds to a shareable final summary. Used heavily in two situations:
the organizer's phone running the evening, and everyone else's phones checking standings
between rounds.

**Entry points.** Play/Events area listing upcoming, running and past tournaments; feed
entries; "round ready" notifications.

**This is several connected views sharing one identity:**

1. **Tournament list**: running tournaments (with live status), upcoming (in sign-up),
   past (with champions). *Create tournament* action — any member can organize.
2. **Create/setup** (organizer): name, format (Americano / Mexicano / Knockout /
   Round Robin), format-specific options (Americano: points per round — 16/21/24/32,
   default 32; Knockout: seeding-by-rating toggle, default on), date. Lifecycle:
   Draft → Sign-up → In progress → Completed.
3. **Sign-up view**: who's in (player chips), capacity (Americano 4–16), join/leave for
   members, organizer can add anyone including unclaimed players (a tournament evening is a
   recruitment event), share text + link for the group chat. Organizer's *start* action
   generates the draw/rotation.
4. **Live view — the heart**. For **Americano**: current round number, this round's
   courts/matchups (who partners whom, who sits out — sit-outs rotated fairly and shown
   without shame), a fat score-entry affordance per match (points per side, e.g. 21–11;
   sums validated against the round total), and the **live individual standings table**
   (cumulative points, sortable, my row anchored) updating the moment scores land.
   For **Knockout**: the bracket, tappable matches, advancing winners visible.
   For **Round Robin**: fixtures by round + points table.
   No confirmation flow inside tournaments — everyone is present; scores are final on entry
   (organizer can correct).
5. **Completed view / summary**: champion celebrated properly, final standings/bracket,
   notable stats of the day, every round's matches — and a **share card** (image: champion,
   results) for the group chat. Past tournaments remain browsable as memories.

**Rating note** (display honesty): tournament matches affect ratings as normal competitive
matches; Americano/Mexicano rounds at half weight — the standings table is the star here,
rating deltas are quiet.

**States.** Sign-up underfilled at start time (organizer adds people on the spot);
player count not divisible by 4 (sit-out rotation is normal, not an error); mid-tournament
abandonment (organizer can complete or delete).

---

## 10. Schedule & Sessions

**Purpose.** The forward-looking and "tonight" surface: plan future matches with RSVPs, and
wrap a real-world evening (multiple matches, same people) in a lightweight Session. The app
coexists with WhatsApp: the chat is where conversation happens; this screen is the source
of truth for *who's in* and *what happened tonight*.

**Entry points.** Play/Events area; RSVP notifications; share links from the group chat;
"start session" courtside.

**Content — two related layers:**

1. **Upcoming list**: scheduled matches ahead — each with date/time, venue, capacity
   (default 4), confirmed players (chips), open slots ("2 spots left"), my RSVP state.
   Past-due scheduled matches that were never logged surface here with a "what happened?"
   result prompt.
2. **Scheduled match detail**: time/venue/capacity, the RSVP roster — **in / out / maybe**
   plus an automatic waitlist that promotes when someone drops; one-tap RSVP for me;
   invite specific players or open-to-group visibility; **share text + link** crafted for
   pasting into the chat ("2 spots left, Thursday 19:00 — tap to join"). Organizer can edit
   or cancel. After the scheduled end time: a result-entry prompt pre-filled with the
   players (and the Balancer's suggested teams if it was used).
3. **Session (tonight) view**: started ad hoc courtside or from a scheduled match.
   Shows who's here (editable as people arrive/leave), the venue, and the evening's running
   tally: matches played so far (compact result blocks), quick stats of the night.
   **Quick-log inside a session is pre-filled with present players — match 3 of the evening
   takes two taps.** For 5+ players: rotation suggestions (who sits out next, fair court
   time) powered by the Balancer. An optional cost note ("courts 48€ — 8€ each") attaches
   to the session, never to matches.
4. **Session summary** (when ended): the evening's matches, biggest rating swing,
   "king of the evening" — built to be a share card for the group chat.

**Hard rule.** Sessions are an optional wrapper. Logging a lone match without any session
must remain exactly as cheap as ever; this screen must never become a gate.

**States.** Nothing scheduled (empty state pushes "schedule a match" + share-to-chat
framing); a scheduled match nobody RSVP'd to; session with an odd player count
(sit-out rotation is the normal case, not an edge case).

---

## Secondary surfaces (not among the ten, but they exist)

The design language should account for these without full descriptions:

- **Group settings** (admin): group identity (name, avatar, motto), invite link + join code
  (rotate/disable), member management (roles, remove → Former Member, send claim links),
  Trust Mode toggle (confirmation on/off, default on), season configuration (on/off,
  length — default quarterly, rollover mode — default soft reset), opt-in toggles
  (anti-achievement badges, title-belt mode). Plus group page flavor: season hall of fame,
  belt history.
- **Notification inbox**: bell with unread count → chronological list of in-app
  notifications (confirm prompts, invites, overtaken-on-leaderboard, round ready,
  season ended), each deep-linking to its screen. Per-category toggles in settings.
- **Account settings**: email/password, connected Google account, notification
  preferences, my groups (leave group), data export.
- **Season summary** (appears at rollover): champion, most improved, most active —
  the screenshot moment of the quarter; doubles as a share card.
- **Global Leaderboard** (M4, opt-in): app-wide ranked table of opted-in players by
  Global Rating; same leaderboard idiom, different scope, explicit consent framing.
- **Share cards**: auto-generated result/summary images (players, score, rating changes;
  tournament champions; session summaries; season champions) designed for WhatsApp — these
  are the app's public face and deserve first-class visual design.
