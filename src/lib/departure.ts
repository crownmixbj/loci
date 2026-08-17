/**
 * Choosing an exact departure, without a native date picker.
 *
 * ⚠ Why this is a modal selector rather than a platform picker.
 *
 *   `@expo/ui` ships a `DatePicker` for both SwiftUI and Jetpack Compose and it
 *   is already a dependency — but it is an unstable API, it has separate
 *   per-platform imports, and it has no web implementation at all. The
 *   scheduling screen renders on web as well as native.
 *
 *   More to the point: I cannot run a build here, so I cannot check that it
 *   links, renders, or returns what its types claim. Shipping an unverifiable
 *   native component into a preview build that testers rely on is a worse trade
 *   than a selector built from `Field` and `BottomSheet`, both of which are
 *   already working on both platforms in this app.
 *
 *   Everything below is pure, so the parts that decide *what a driver can pick*
 *   are tested rather than eyeballed.
 */

/** How far ahead a route may be declared. */
export const MAX_DEPARTURE_DAYS = 14;

/** Granularity of the time list. Quarter hours: 96 options, not 1,440. */
export const MINUTE_STEP = 15;

export type DayOption = {
  /** Midnight local time on that day, as an ISO string. Used as the key. */
  value: string;
  label: string;
};

export type TimeOption = {
  /** Minutes past local midnight. */
  value: number;
  label: string;
};

const startOfDay = (date: Date): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate());

/**
 * The days a driver may choose, starting today.
 *
 * Local midnights, not UTC. A driver in Lagos picking "tomorrow" means their
 * tomorrow; building these from `toISOString().slice(0, 10)` would roll over an
 * hour early for anyone east of Greenwich and put the wrong date on the button.
 */
export function dayOptions(now: Date = new Date(), days = MAX_DEPARTURE_DAYS): DayOption[] {
  const today = startOfDay(now);

  return Array.from({ length: days }, (_, offset) => {
    const day = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);

    const label =
      offset === 0
        ? 'Today'
        : offset === 1
          ? 'Tomorrow'
          : day.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

    return { value: day.toISOString(), label };
  });
}

/** Quarter-hour slots across a day. */
export function timeOptions(step = MINUTE_STEP): TimeOption[] {
  const slots: TimeOption[] = [];

  for (let minutes = 0; minutes < 24 * 60; minutes += step) {
    const hour = Math.floor(minutes / 60);
    const minute = minutes % 60;
    const label = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    slots.push({ value: minutes, label });
  }

  return slots;
}

/** A day and a time of day, back into one moment. */
export function combineDeparture(dayIso: string, minutesOfDay: number): Date {
  const day = new Date(dayIso);
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    Math.floor(minutesOfDay / 60),
    minutesOfDay % 60,
    0,
    0,
  );
}

/**
 * The next selectable slot at least `leadMinutes` from now.
 *
 * The default the form opens on. Offering "today, 00:00" as the starting value
 * would put a departure in the past under the cursor, and the first thing a
 * driver does with a prefilled form is submit it.
 */
export function nextDepartureSlot(now: Date = new Date(), leadMinutes = 30): Date {
  const earliest = new Date(now.getTime() + leadMinutes * 60_000);
  const step = MINUTE_STEP;

  const rounded = new Date(earliest);
  rounded.setSeconds(0, 0);

  const remainder = rounded.getMinutes() % step;
  if (remainder !== 0) rounded.setMinutes(rounded.getMinutes() + (step - remainder));

  return rounded;
}

/** How a chosen departure reads on the closed field. */
export function departureLabel(when: Date | null, now: Date = new Date()): string {
  if (!when || Number.isNaN(when.getTime())) return 'Choose a departure';

  const sameDay = startOfDay(when).getTime() === startOfDay(now).getTime();
  const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const isTomorrow = startOfDay(when).getTime() === tomorrow.getTime();

  const time = when.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

  if (sameDay) return `Today, ${time}`;
  if (isTomorrow) return `Tomorrow, ${time}`;

  return `${when.toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })}, ${time}`;
}

/** Which day option a chosen moment belongs to, for reopening the selector. */
export function dayValueOf(when: Date): string {
  return startOfDay(when).toISOString();
}

/** Minutes past midnight, snapped to the slot grid. */
export function minutesOf(when: Date): number {
  const raw = when.getHours() * 60 + when.getMinutes();
  return raw - (raw % MINUTE_STEP);
}
