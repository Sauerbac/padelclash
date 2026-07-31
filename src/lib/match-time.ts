const CIRCLE_TIME_ZONE = "Europe/Berlin";

const playedAtFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: CIRCLE_TIME_ZONE,
});

/** Format a Match timestamp in the circle's local timezone. */
export function formatPlayedAt(at: Date): string {
  return playedAtFormat.format(at);
}
