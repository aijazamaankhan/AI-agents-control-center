/** UTC instant of local midnight (start of `date`'s day) in an IANA timezone. */
export function startOfDayInTimeZone(date: Date, timeZone: string): Date {
  try {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat("en-US", {
        timeZone,
        hourCycle: "h23",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })
        .formatToParts(date)
        .map((p) => [p.type, p.value]),
    );
    // Offset of the zone at `date`: local wall time interpreted as UTC minus the real instant.
    const asUtc = Date.UTC(
      +parts.year!,
      +parts.month! - 1,
      +parts.day!,
      +parts.hour!,
      +parts.minute!,
      +parts.second!,
    );
    const offset = asUtc - Math.floor(date.getTime() / 1000) * 1000;
    const midnightLocalAsUtc = Date.UTC(+parts.year!, +parts.month! - 1, +parts.day!);
    return new Date(midnightLocalAsUtc - offset);
  } catch {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }
}
