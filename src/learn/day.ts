/**
 * The learner's day. Like Anki, a study day runs from 4:00 to 4:00 local
 * time: a review at 00:30 still belongs to the evening before, and "due
 * today" means due before the next 4:00, not before midnight.
 */
export const ROLLOVER_HOUR = 4;

/** Local midnight of the calendar date `date`'s study day is named after. */
function dayDate(date: Date): Date {
  const back = date.getHours() < ROLLOVER_HOUR ? 1 : 0;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() - back);
}

/** The study day `date` falls in, as YYYY-MM-DD. */
export function studyDay(date: Date): string {
  const day = dayDate(date);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
}

/** When the study day after `date`'s begins: anything due before it is due "today". */
export function nextDayStart(date: Date): number {
  const day = dayDate(date);
  return new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1, ROLLOVER_HOUR).getTime();
}

/**
 * `date`'s study day as noon UTC of the same calendar date. FSRS counts
 * elapsed days by UTC date, which in Taiwan turns over at 08:00: a card
 * missed at 20:00 and answered at 07:30 the next morning looked like no time
 * had passed. Handing FSRS one fixed instant per study day makes its day
 * count the learner's.
 */
export function anchor(date: Date): Date {
  const day = dayDate(date);
  return new Date(Date.UTC(day.getFullYear(), day.getMonth(), day.getDate(), 12));
}

/** The start (4:00 local) of the study day an `anchor` stands for. */
export function fromAnchor(anchored: Date): number {
  return new Date(anchored.getUTCFullYear(), anchored.getUTCMonth(), anchored.getUTCDate(), ROLLOVER_HOUR).getTime();
}
