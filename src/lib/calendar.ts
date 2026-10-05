export function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const d = new Date(value + "T00:00:00Z");
  return Number.isFinite(d.getTime()) && d.toISOString().slice(0, 10) === value;
}
export function monthDays(month: string) {
  if (!/^\d{4}-\d{2}$/.test(month) || !validDate(month + "-01"))
    throw new RangeError("Invalid month");
  const [year, m] = month.split("-").map(Number);
  return {
    offset: new Date(month + "-01T00:00:00Z").getUTCDay(),
    dates: Array.from(
      { length: new Date(Date.UTC(year, m, 0)).getUTCDate() },
      (_, i) => month + "-" + String(i + 1).padStart(2, "0"),
    ),
  };
}
export function shiftMonth(month: string, step: number) {
  monthDays(month);
  const d = new Date(month + "-01T00:00:00Z");
  d.setUTCMonth(d.getUTCMonth() + step);
  return d.toISOString().slice(0, 7);
}
export function includesDate(
  log: { startDate: string; endDate?: string },
  date: string,
) {
  return (
    log.startDate === date ||
    (!!log.endDate && log.startDate <= date && date <= log.endDate)
  );
}
