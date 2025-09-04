// Test the cron parsing function
import { parseCronExpression, formatNextRunTime } from './src/utils/cronUtils.js';

// Test cases
const testCases = [
  { cron: '9 1 * * *', timezone: 'America/Los_Angeles', expected: 'Daily at 1:09 AM PST' },
  { cron: '0 9 * * 1', timezone: 'UTC', expected: 'Weekly on Monday at 9:00 AM UTC' },
  { cron: '30 14 15 * *', timezone: 'America/New_York', expected: 'Monthly on the 15th at 2:30 PM EST' },
  { cron: '0 8 1 1 *', timezone: undefined, expected: 'Jan 1 at 8:00 AM' },
  { cron: '15 22 * * 5', timezone: 'Europe/London', expected: 'Weekly on Friday at 10:15 PM GMT' }
];

console.log('Testing cron expression parsing:');
testCases.forEach((test, index) => {
  const result = parseCronExpression(test.cron, test.timezone);
  console.log(`${index + 1}. "${test.cron}" (${test.timezone || 'no timezone'}) -> "${result}"`);
  console.log(`   Expected: "${test.expected}"`);
  console.log(`   Match: ${result === test.expected ? '✅' : '❌'}`);
  console.log('');
});

// Test next run time formatting
const now = new Date();
const nextRun1 = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes from now
const nextRun2 = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
const nextRun3 = new Date(now.getTime() + 25 * 60 * 60 * 1000); // 25 hours from now

console.log('Testing next run time formatting:');
console.log(`30 minutes from now: "${formatNextRunTime(nextRun1)}"`);
console.log(`2 hours from now: "${formatNextRunTime(nextRun2)}"`);
console.log(`25 hours from now: "${formatNextRunTime(nextRun3)}"`);
