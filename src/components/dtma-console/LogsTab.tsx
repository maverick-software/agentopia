import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export const LogsTab: React.FC<{ logs: string[]; onClear: () => void }> = ({ logs, onClear }) => (
  <Card>
    <CardHeader>
      <CardTitle className="flex items-center justify-between">
        <span>Console Logs</span>
        <Button onClick={onClear} size="sm" variant="outline">
          Clear
        </Button>
      </CardTitle>
      <CardDescription>Recent DTMA console activity</CardDescription>
    </CardHeader>
    <CardContent>
      <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm max-h-96 overflow-y-auto">
        {logs.length > 0 ? (
          logs.map((log, index) => (
            <div key={index} className="mb-1">
              {log}
            </div>
          ))
        ) : (
          <div className="text-gray-500">No logs available</div>
        )}
      </div>
    </CardContent>
  </Card>
);
