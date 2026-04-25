import { Button } from '@/components/ui/button';

interface UsageStats {
  sms_sent: number;
  mms_sent: number;
  balance_checks: number;
  history_queries: number;
  last_sms_sent?: string;
  last_mms_sent?: string;
  success_rate: number;
}

interface ClickSendUsageStatsProps {
  usageStats: UsageStats;
  showDetailedStats: boolean;
  onToggleDetails: () => void;
  formatRelativeTime: (dateString?: string) => string;
}

export function ClickSendUsageStats({
  usageStats,
  showDetailedStats,
  onToggleDetails,
  formatRelativeTime,
}: ClickSendUsageStatsProps) {
  return (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium text-blue-900">Recent Usage (Last 30 Days)</h4>
        <Button
          size="sm"
          variant="ghost"
          onClick={onToggleDetails}
          className="text-blue-700 hover:text-blue-900"
        >
          {showDetailedStats ? 'Hide' : 'Show'} Details
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-900">{usageStats.sms_sent}</div>
          <div className="text-sm text-blue-700">SMS Sent</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-900">{usageStats.mms_sent}</div>
          <div className="text-sm text-blue-700">MMS Sent</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-900">{usageStats.balance_checks}</div>
          <div className="text-sm text-blue-700">Balance Checks</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-blue-900">{usageStats.history_queries}</div>
          <div className="text-sm text-blue-700">History Queries</div>
        </div>
      </div>

      {showDetailedStats && (
        <div className="mt-4 pt-4 border-t border-blue-200">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-blue-700">Last SMS sent:</span>
              <span className="text-blue-900">{formatRelativeTime(usageStats.last_sms_sent)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Last MMS sent:</span>
              <span className="text-blue-900">{formatRelativeTime(usageStats.last_mms_sent)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-blue-700">Success rate:</span>
              <span className="text-blue-900">{usageStats.success_rate}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
