# PadelClash

A rating and competition tracker for private padel groups — from a circle of friends up to a club-sized community of ~100: log matches, climb the group's Elo leaderboard, run tournaments — without anyone maintaining a spreadsheet. Padel only, by deliberate decision.

## Language

### People & identity

**Player**:
A person who appears in matches, ratings and leaderboards. Exists independently of login credentials.
_Avoid_: user, athlete

**Account**:
Login credentials attached to exactly one Player.
_Avoid_: user, login

**Unclaimed Player**:
A Player created by a group member on behalf of someone without an Account; becomes a normal Player when claimed, keeping all history.
_Avoid_: guest, ghost player, placeholder

**Claiming**:
Attaching a freshly registered Account to an Unclaimed Player via a personal invite.

**Profile**:
The view of a Player visible to their co-group members: name, avatar, rating, record, badges.

### Groups

**Group**:
A private circle of Players sharing a leaderboard, feed and competitions; the scope inside which all Ratings live.
_Avoid_: club, league, circle, community

**Admin**:
A group role that manages members and settings and resolves Contests.

**Member**:
A Player belonging to a Group.

**Former Member**:
A Player who left or was removed; their matches and rating history remain part of the group's record.

### Matches

**Match**:
A completed contest between two Sides with exactly one winner. Never a draw.
_Avoid_: game (a game is a scoring unit inside a set)

**Side**:
One of the two parties in a Match — one Player (singles) or two Players (doubles).
_Avoid_: team

**Set Score**:
A result recorded as games per set (6-4, 3-6, 7-5).

**Points Score**:
A result recorded as one points total per Side (Americano rounds).

**Simple Result**:
A result recording only which Side won.

**Competitive Match**:
A match that affects Ratings. The default.
_Avoid_: ranked match

**Casual Match**:
A match logged for the record only; never affects Ratings or Streaks.
_Avoid_: friendly, unranked match

**Logger**:
The member who recorded a match.

**Pairing**:
A fixed duo of Players tracked across matches, for chemistry stats and pairing leaderboards.
_Avoid_: team, duo

### Ratings

**Rating**:
A Player's Elo number within one Group. Rises with wins, falls with losses, weighted by opposition strength.
_Avoid_: Elo points, score, MMR

**Global Rating**:
A Player's single app-wide Elo number, fed only by matches in which every participant has opted in.

**Opted In**:
A Player's standing consent for their matches to count toward the Global Rating and appear on the Global Leaderboard.

**Provisional**:
The accelerated early phase of a Rating — first matches in a group, or right after a season reset.

**Rank**:
A Player's position on a Leaderboard.
_Avoid_: place, rating (that's the number)

**Ranked / Unranked**:
Whether a Player has played enough competitive matches to hold a Rank.

**Win Probability**:
The expected chance of a Side winning, derived from Ratings, shown before a match and in the Balancer.

### Integrity

**Confirmation**:
Approval of a logged match by the opposing Side before the result is final.

**Pending**:
A logged match awaiting Confirmation. Already counted, still correctable.

**Contest**:
A participant's objection to a Pending match's result.
_Avoid_: dispute, report

**Trust Mode**:
A group setting that disables Confirmation entirely.

### Competitions

**Tournament**:
A structured event with sign-up, a format-driven schedule, and Standings.
_Avoid_: competition, event

**Knockout**:
Single-elimination bracket format.

**Round Robin**:
Everyone-plays-everyone league format with a points table.

**Americano**:
Rotating-partner social format where individuals collect points across rounds.

**Mexicano**:
Americano variant where each round's pairings are derived from the current Standings.

**Round**:
One wave of simultaneous matches inside a Tournament.

**Organizer**:
The member who runs a Tournament.

**Seeding**:
Ordering tournament entrants by Rating to shape a fair draw.

**Standings**:
The live table of a Tournament.
_Avoid_: leaderboard (that's the group-wide one)

### Time & places

**Season**:
A time-boxed competitive period in a Group, ending with a champion and a Rollover.

**Rollover**:
What happens to Ratings at season end: carry-over, soft reset, or full reset.

**Scheduled Match**:
A planned future match with RSVP slots; becomes a Match once played and logged.
_Avoid_: booking, planned game

**RSVP**:
A Player's response to a Scheduled Match: in, out, or maybe.

**Session**:
One real-world play meetup (typically an evening) grouping its participants, matches and venue.
_Avoid_: meetup, event

**Venue**:
A place the group plays at; may contain several courts.
_Avoid_: club, location

### Fun layer

**Leaderboard**:
The ranked table of a Group's Players.
_Avoid_: ranking, ladder, standings

**Global Leaderboard**:
The app-wide ranked table of Opted In Players, ordered by Global Rating.

**Badge**:
A collectible award for a milestone or feat, shown on the Profile.
_Avoid_: achievement, trophy

**Streak**:
Consecutive competitive wins (or losses) of a Player.

**Challenge**:
A declared, direct invitation to a grudge match between Players or Pairings.

**Rivalry**:
An automatically tracked narrative between two Players or Pairings who meet often.

**Balancer**:
The feature that proposes the fairest team split from the players present.
_Avoid_: matchmaker
