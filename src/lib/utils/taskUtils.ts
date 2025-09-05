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
    
    // Get the actual timezone offset in minutes
    const utcTime = new Date(now.toLocaleString('en-US', { timeZone: 'UTC' }));
    const localTime = new Date(now.toLocaleString('en-US', { timeZone: tz }));
    const offsetMinutes = (localTime.getTime() - utcTime.getTime()) / (1000 * 60);
    const offsetHours = Math.round(offsetMinutes / 60);
    
    // Format the offset correctly
    const sign = offsetHours >= 0 ? '+' : '-';
    const absOffset = Math.abs(offsetHours);
    
    return `${tz.replace('_', ' ')} (UTC${sign}${absOffset})`;
  } catch (error) {
    console.error('Error formatting timezone label for', tz, error);
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

export const generateOneTimeCronExpression = (date: string, time: string): string => {
  const [hours, minutes] = time.split(':').map(Number);
  
  // Parse date string more safely to avoid timezone issues
  // Input format: "2025-09-04" -> split and parse manually
  const [year, month, day] = date.split('-').map(Number);
  
  console.log(`Generating one-time cron for date: ${date}, parsed as day: ${day}, month: ${month}`);
  
  // Format: minute hour day month dayOfWeek
  // For one-time: specific minute, hour, day, month, any day of week (*)
  return `${minutes} ${hours} ${day} ${month} *`;
};

export const parseCronForRecurring = (cronExpression: string): { 
  time: string; 
  interval: number; 
  unit: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year' 
} | null => {
  try {
    const parts = cronExpression.trim().split(' ');
    if (parts.length !== 5) return null;

    const [minute, hour, day, month, dayOfWeek] = parts;

    // Parse minute-based intervals: */5 * * * *
    if (minute.startsWith('*/') && hour === '*' && day === '*' && month === '*' && dayOfWeek === '*') {
      const interval = parseInt(minute.substring(2));
      return { time: '00:00', interval, unit: 'minute' };
    }

    // Parse hour-based intervals: 30 */2 * * *
    if (!minute.includes('*') && hour.startsWith('*/') && day === '*' && month === '*' && dayOfWeek === '*') {
      const interval = parseInt(hour.substring(2));
      const time = `${hour === '*' ? '00' : '00'}:${minute.padStart(2, '0')}`;
      return { time, interval, unit: 'hour' };
    }

    // Parse day-based intervals: 30 14 */3 * *
    if (!minute.includes('*') && !hour.includes('*') && day.startsWith('*/') && month === '*' && dayOfWeek === '*') {
      const interval = parseInt(day.substring(2));
      const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
      return { time, interval, unit: 'day' };
    }

    // Parse daily: 30 14 * * *
    if (!minute.includes('*') && !hour.includes('*') && day === '*' && month === '*' && dayOfWeek === '*') {
      const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
      return { time, interval: 1, unit: 'day' };
    }

    // Parse weekly: 30 14 * * 0 (Sunday)
    if (!minute.includes('*') && !hour.includes('*') && day === '*' && month === '*' && dayOfWeek !== '*') {
      const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
      return { time, interval: 1, unit: 'week' };
    }

    // Parse monthly: 30 14 1 * *
    if (!minute.includes('*') && !hour.includes('*') && day !== '*' && month === '*' && dayOfWeek === '*') {
      const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
      return { time, interval: 1, unit: 'month' };
    }

    // Parse yearly: 30 14 1 1 *
    if (!minute.includes('*') && !hour.includes('*') && day !== '*' && month !== '*' && dayOfWeek === '*') {
      const time = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
      return { time, interval: 1, unit: 'year' };
    }

    return null;
  } catch (error) {
    console.error('Error parsing cron expression:', error);
    return null;
  }
};

export const getDefaultTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return 'UTC';
  }
};

export const formatTaskScheduleDisplay = (task: {
  cron_expression?: string;
  max_executions?: number;
  start_date?: string;
  end_date?: string;
  timezone?: string;
}): string => {
  if (!task.cron_expression) return 'No schedule';

  const timezone = task.timezone || 'UTC';
  const isOneTime = task.max_executions === 1;

  if (isOneTime) {
    // One-time task display
    const startDate = task.start_date ? new Date(task.start_date).toLocaleDateString('en-US', { 
      month: '2-digit', 
      day: '2-digit', 
      year: '2-digit' 
    }) : '';
    
    const parsed = parseCronForRecurring(task.cron_expression);
    const time = parsed?.time || '00:00';
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const formattedTime = `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
    
    return `One-time on ${startDate} at ${formattedTime}`;
  } else {
    // Recurring task display
    const parsed = parseCronForRecurring(task.cron_expression);
    if (!parsed) return 'Recurring task';

    const [hours, minutes] = parsed.time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    const formattedTime = `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;

    const startDate = task.start_date ? new Date(task.start_date).toLocaleDateString('en-US', { 
      month: '2-digit', 
      day: '2-digit', 
      year: '2-digit' 
    }) : '';
    
    const endDate = task.end_date ? new Date(task.end_date).toLocaleDateString('en-US', { 
      month: '2-digit', 
      day: '2-digit', 
      year: '2-digit' 
    }) : '';

    let intervalText = '';
    if (parsed.interval === 1) {
      intervalText = parsed.unit === 'day' ? 'Daily' : 
                    parsed.unit === 'week' ? 'Weekly' :
                    parsed.unit === 'month' ? 'Monthly' :
                    parsed.unit === 'year' ? 'Yearly' :
                    parsed.unit === 'hour' ? 'Hourly' :
                    parsed.unit === 'minute' ? 'Every minute' : 'Recurring';
    } else {
      const unitName = parsed.unit === 'minute' ? 'minute' :
                      parsed.unit === 'hour' ? 'hour' :
                      parsed.unit === 'day' ? 'day' :
                      parsed.unit === 'week' ? 'week' :
                      parsed.unit === 'month' ? 'month' : 'year';
      intervalText = `Every ${parsed.interval} ${unitName}${parsed.interval > 1 ? 's' : ''}`;
    }

    let display = `${intervalText} at ${formattedTime}`;
    if (startDate) display += `, starts ${startDate}`;
    if (endDate) display += `, ends ${endDate}`;
    
    return display;
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
