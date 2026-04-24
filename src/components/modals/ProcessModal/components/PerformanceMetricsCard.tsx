import React from 'react';
import { AlertCircle, BarChart3 } from 'lucide-react';

interface PerformanceMetricsCardProps {
  performance: any;
}

function formatTime(ms: number) {
  return `${ms}ms`;
}

export const PerformanceMetricsCard: React.FC<PerformanceMetricsCardProps> = ({ performance }) => {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <BarChart3 className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">Performance Metrics</h3>
      </div>

      <div className="space-y-3">
        <div>
          <span className="font-medium text-sm mb-2 block text-foreground">Stage Timings:</span>
          <div className="space-y-1">
            {performance?.stage_timings &&
              Object.entries(performance.stage_timings).map(([stage, time]: [string, any]) => (
                <div key={stage} className="flex justify-between text-xs text-muted-foreground">
                  <span className="capitalize">{stage.replace('_', ' ')}:</span>
                  <span>{formatTime(time)}</span>
                </div>
              ))}
          </div>
        </div>

        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Cache Hits:</span>
          <span className="text-green-600">{performance?.cache_hits || 0}</span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Cache Misses:</span>
          <span className="text-red-600">{performance?.cache_misses || 0}</span>
        </div>

        {performance?.bottlenecks && performance.bottlenecks.length > 0 && (
          <div>
            <span className="font-medium text-sm mb-2 block text-foreground">Bottlenecks:</span>
            {performance.bottlenecks.map((bottleneck: string, idx: number) => (
              <div key={idx} className="flex items-center gap-1 text-xs text-muted-foreground">
                <AlertCircle className="h-3 w-3 text-muted-foreground" />
                <span>{bottleneck}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
