import React from 'react';
import { CheckCircle, XCircle, Zap } from 'lucide-react';

interface ToolOperationsCardProps {
  discoveredTools: any[];
  toolOperations: any[];
}

function formatTime(ms: number) {
  return `${ms}ms`;
}

export const ToolOperationsCard: React.FC<ToolOperationsCardProps> = ({
  discoveredTools,
  toolOperations,
}) => {
  return (
    <div className="bg-card border border-border rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="h-5 w-5 text-muted-foreground" />
        <h3 className="font-semibold text-foreground">Tool Operations</h3>
      </div>

      <div className="mb-3 text-sm">
        <div className="font-medium text-foreground">Discovered Tools</div>
        <div className="mt-1">
          {discoveredTools?.length > 0 ? (
            discoveredTools.map((tool: any, idx: number) => (
              <span key={idx} className="inline-block bg-muted text-muted-foreground px-2 py-1 rounded text-xs mr-2 mb-1">
                {tool.name}
              </span>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">No tools discovered for this request</span>
          )}
        </div>
      </div>

      {toolOperations?.length > 0 ? (
        <div className="space-y-3">
          {toolOperations.map((tool: any, idx: number) => (
            <div key={idx} className="border border-purple-200 rounded p-3">
              <div className="flex items-center gap-2 mb-2">
                {tool.success ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="font-medium text-sm">{tool.name}</span>
                <span className="text-xs text-gray-500">({formatTime(tool.execution_time_ms)})</span>
              </div>
              {tool.error && <div className="text-xs text-red-600 bg-red-50 p-2 rounded">{tool.error}</div>}
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-muted-foreground">Tools were not requested or inferred in this request</div>
      )}
    </div>
  );
};
