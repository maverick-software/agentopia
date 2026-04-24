export function buildCronExpression(cadence: 'daily' | 'weekly' | 'monthly', hour: number, minute: number, anchorDate: Date): string {
  const m = `${minute}`;
  const h = `${hour}`;
  if (cadence === 'daily') return `${m} ${h} * * *`;
  if (cadence === 'weekly') return `${m} ${h} * * ${anchorDate.getDay()}`;
  return `${m} ${h} ${anchorDate.getDate()} * *`;
}

export function parseCronToLabel(cron: string, startDateIso?: string | null): { label: string; cadence: 'daily' | 'weekly' | 'monthly'; time: string } | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const [m, h, dom, _mon, dow] = parts;
  const time = `${String(Number(h)).padStart(2, '0')}:${String(Number(m)).padStart(2, '0')}`;
  if (dom === '*' && dow === '*') return { label: `Daily at ${time}`, cadence: 'daily', time };
  if (dow !== '*') {
    const anchor = startDateIso ? new Date(startDateIso) : new Date();
    return { label: `Weekly on ${anchor.toLocaleDateString(undefined, { weekday: 'long' })} at ${time}`, cadence: 'weekly', time };
  }
  if (dom !== '*') {
    const anchor = startDateIso ? new Date(startDateIso) : new Date();
    return { label: `Monthly on day ${anchor.getDate()} at ${time}`, cadence: 'monthly', time };
  }
  return null;
}

export const getSupportedTimezones = (): string[] => {
  const fallback = ['UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'Asia/Kolkata', 'Australia/Sydney'];
  // @ts-ignore
  if (typeof (Intl as any).supportedValuesOf === 'function') {
    try {
      // @ts-ignore
      return (Intl as any).supportedValuesOf('timeZone') as string[];
    } catch {
      return fallback;
    }
  }
  return fallback;
};

export const toUtcIsoForTimezone = (dateStr: string, timeStr: string, tz: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = timeStr.split(':').map(Number);
  const asUtc = new Date(Date.UTC(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0));
  const tzDate = new Date(asUtc.toLocaleString('en-US', { timeZone: tz }));
  const offsetMs = asUtc.getTime() - tzDate.getTime();
  return new Date(asUtc.getTime() + offsetMs).toISOString();
};

