import { TaskFormData } from '@/types/tasks';

export const getSupportedTimezones = (): string[] => {
  const timezones = [
    'UTC',
    'America/New_York',
    'America/Chicago', 
    'America/Denver',
    'America/Los_Angeles',
    'America/Toronto',
    'America/Vancouver',
    'Europe/London',
    'Europe/Paris',
    'Europe/Berlin',
    'Europe/Rome',
    'Europe/Madrid',
    'Asia/Tokyo',
    'Asia/Shanghai',
    'Asia/Kolkata',
    'Asia/Dubai',
    'Australia/Sydney',
    'Australia/Melbourne'
  ];

  try {
    const userTz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timezones.includes(userTz)) {
      timezones.unshift(userTz);
    }
  } catch (e) {
    // Ignore if browser doesn't support timezone detection
  }

  return timezones;
};

export const formatTimezoneLabel = (tz: string): string => {
  try {
    const now = new Date();
    const offset = new Intl.DateTimeFormat('en', {
      timeZone: tz,
      timeZoneName: 'short'
    }).formatToParts(now).find(part => part.type === 'timeZoneName')?.value || '';
    
    const offsetHours = Math.round((now.getTime() - new Date(now.toLocaleString('en-US', { timeZone: tz })).getTime()) / (1000 * 60 * 60));
    const sign = offsetHours <= 0 ? '+' : '-';
    const absOffset = Math.abs(offsetHours);
    
    return `${tz.replace('_', ' ')} (UTC${sign}${absOffset})`;
  } catch {
    return tz;
  }
};

export const toUtcIsoForTimezone = (dateStr: string, timeStr: string, tz: string): string => {
  try {
    const localDateTime = new Date(`${dateStr}T${timeStr}`);
    const utcTime = new Date(localDateTime.toLocaleString('en-US', { timeZone: 'UTC' }));
    const targetTime = new Date(localDateTime.toLocaleString('en-US', { timeZone: tz }));
    const offset = utcTime.getTime() - targetTime.getTime();
    const adjustedTime = new Date(localDateTime.getTime() + offset);
    return adjustedTime.toISOString();
  } catch (error) {
    console.error('Error converting timezone:', error);
    return new Date(`${dateStr}T${timeStr}`).toISOString();
  }
};

export const generateCronExpression = (unit: string, interval: number, time: string): string => {
  const [hours, minutes] = time.split(':').map(Number);
  
  switch (unit) {
    case 'minute':
      return interval === 1 ? '* * * * *' : `*/${interval} * * * *`;
    case 'hour':
      return interval === 1 ? `${minutes} * * * *` : `${minutes} */${interval} * * *`;
    case 'day':
      return interval === 1 ? `${minutes} ${hours} * * *` : `${minutes} ${hours} */${interval} * *`;
    case 'week':
      return `${minutes} ${hours} * * 0`;
    case 'month':
      return `${minutes} ${hours} 1 * *`;
    case 'year':
      return `${minutes} ${hours} 1 1 *`;
    default:
      return `${minutes} ${hours} * * *`;
  }
};

export const getDefaultTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

export const createDefaultFormData = (): TaskFormData => ({
  scheduleMode: 'one_time',
  oneTimeDate: '',
  oneTimeTime: '',
  recurringStartDate: '',
  recurringEndDate: '',
  recurringTime: '',
  everyInterval: 1,
  everyUnit: 'day',
  newTaskDescription: '',
  newTaskTitle: '',
  targetConversationId: '',
  selectedTimezone: getDefaultTimezone()
});
