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

/** Calendar date ("YYYY-MM-DD") of an instant in an IANA timezone, as a UTC-midnight Date. */
export function localDay(date: Date, timeZone: string): Date {
  let ymd: string;
  try {
    ymd = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  } catch {
    ymd = date.toISOString().slice(0, 10);
  }
  return new Date(`${ymd}T00:00:00Z`);
}

/** `day` shifted by `n` calendar days (UTC-midnight Dates, as stored in DATE columns). */
export function addDays(day: Date, n: number): Date {
  return new Date(day.getTime() + n * 86_400_000);
}
