import { RecurringCadence } from './types';

export function buildCronExpression(
  cadence: RecurringCadence,
  hour: number,
  minute: number,
  anchorDate: Date,
): string {
  const m = `${minute}`;
  const h = `${hour}`;
  if (cadence === 'daily') return `${m} ${h} * * *`;
  if (cadence === 'weekly') {
    const dow = anchorDate.getDay();
    return `${m} ${h} * * ${dow}`;
  }

  const dom = anchorDate.getDate();
  return `${m} ${h} ${dom} * *`;
}

export function parseCronToLabel(
  cron: string,
  startDateIso?: string | null,
): { label: string; cadence: RecurringCadence; time: string } | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;

  const [m, h, dom, _mon, dow] = parts;
  const minute = Number(m);
  const hour = Number(h);
  const time = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;

  if (dom === '*' && dow === '*') {
    return { label: `Daily at ${time}`, cadence: 'daily', time };
  }

  if (dow !== '*') {
    const anchor = startDateIso ? new Date(startDateIso) : new Date();
    const weekday = anchor.toLocaleDateString(undefined, { weekday: 'long' });
    return { label: `Weekly on ${weekday} at ${time}`, cadence: 'weekly', time };
  }

  if (dom !== '*') {
    const anchor = startDateIso ? new Date(startDateIso) : new Date();
    const day = anchor.getDate();
    return { label: `Monthly on day ${day} at ${time}`, cadence: 'monthly', time };
  }

  return null;
}

export function toUtcIsoForTimezone(dateStr: string, timeStr: string, timezone: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const asUtc = new Date(Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0));
  const timezoneDate = new Date(asUtc.toLocaleString('en-US', { timeZone: timezone }));
  const offsetMs = asUtc.getTime() - timezoneDate.getTime();
  return new Date(asUtc.getTime() + offsetMs).toISOString();
}
