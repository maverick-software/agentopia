import React, { useState, useEffect, useRef } from 'react';
import {
  Terminal,
  Loader2,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Maximize2,
  Minimize2
} from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'success' | 'debug';
  message: string;
  details?: any;
  toolName?: string;
  phase?: 'init' | 'validation' | 'execution' | 'result' | 'error';
}

interface ToolExecutionLoggerProps {
  isExecuting: boolean;
  currentTool?: string;
  className?: string;
  maxHeight?: number;
  autoScroll?: boolean;
  showTimestamps?: boolean;
}

export const ToolExecutionLogger: React.FC<ToolExecutionLoggerProps> = ({
  isExecuting,
  currentTool,
  className,
  maxHeight = 300,
  autoScroll = true,
  showTimestamps = true
}) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, autoScroll]);

  // Subscribe to tool execution events
  useEffect(() => {
    const handleToolLog = (event: CustomEvent<LogEntry>) => {
      setLogs(prev => [...prev, {
        ...event.detail,
        id: `${Date.now()}-${Math.random()}`
      }]);
    };

    window.addEventListener('tool-execution-log' as any, handleToolLog);
    return () => {
      window.removeEventListener('tool-execution-log' as any, handleToolLog);
    };
  }, []);

  // Add initial log when execution starts
  useEffect(() => {
    if (isExecuting && currentTool) {
      setLogs([{
        id: `init-${Date.now()}`,
        timestamp: new Date(),
        level: 'info',
        message: `Starting ${currentTool} execution...`,
        toolName: currentTool,
        phase: 'init'
      }]);
    }
  }, [isExecuting, currentTool]);

  const getLogIcon = (level: LogEntry['level']) => {
    switch (level) {
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'warn':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Terminal className="w-4 h-4 text-blue-500" />;
    }
  };

  const getLogColor = (level: LogEntry['level']) => {
    switch (level) {
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      case 'warn':
        return 'text-yellow-600';
      case 'debug':
        return 'text-gray-500';
      default:
        return 'text-blue-600';
    }
  };

  const formatTimestamp = (date: Date) => {
    const time = date.toLocaleTimeString('en-US', {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    const ms = date.getMilliseconds().toString().padStart(3, '0');
    return `${time}.${ms}`;
  };

  const copyLogs = () => {
    const logText = logs.map(log => 
      `[${formatTimestamp(log.timestamp)}] ${log.level.toUpperCase()}: ${log.message}${
        log.details ? `\nDetails: ${JSON.stringify(log.details, null, 2)}` : ''
      }`
    ).join('\n');
    
    navigator.clipboard.writeText(logText);
  };

  const downloadLogs = () => {
    const logText = logs.map(log => ({
      timestamp: log.timestamp.toISOString(),
      level: log.level,
      message: log.message,
      details: log.details,
      toolName: log.toolName,
      phase: log.phase
    }));
    
    const blob = new Blob([JSON.stringify(logText, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tool-execution-log-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const clearLogs = () => {
    setLogs([]);
  };

  if (!isExecuting && logs.length === 0) {
    return null;
  }

  const content = (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex items-center justify-between p-3 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4" />
          <span className="font-medium text-sm">Tool Execution Console</span>
          {currentTool && (
            <Badge variant="outline" className="text-xs">
              {currentTool}
            </Badge>
          )}
          {isExecuting && (
            <Loader2 className="w-3 h-3 animate-spin ml-2" />
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={clearLogs}
            disabled={logs.length === 0}
          >
            <XCircle className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={copyLogs}
            disabled={logs.length === 0}
          >
            <Copy className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={downloadLogs}
            disabled={logs.length === 0}
          >
            <Download className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsCollapsed(!isCollapsed)}
          >
            {isCollapsed ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </Button>
        </div>
      </div>
      
      {!isCollapsed && (
        <CardContent 
          ref={containerRef}
          className="p-0 bg-gray-900 font-mono text-xs overflow-auto"
          style={{ maxHeight: isFullscreen ? 'calc(100vh - 200px)' : maxHeight }}
        >
          <div className="p-3 space-y-1">
            {logs.length === 0 ? (
              <div className="text-gray-500 text-center py-4">
                No logs yet...
              </div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-start gap-2 hover:bg-gray-800/50 p-1 rounded cursor-pointer"
                  onClick={() => setSelectedLog(log)}
                >
                  {getLogIcon(log.level)}
                  {showTimestamps && (
                    <span className="text-gray-500 shrink-0">
                      {formatTimestamp(log.timestamp)}
                    </span>
                  )}
                  <span className={cn("flex-1 break-all", getLogColor(log.level))}>
                    {log.message}
                  </span>
                </div>
              ))
            )}
            <div ref={logsEndRef} />
          </div>
        </CardContent>
      )}
    </Card>
  );

  return (
    <>
      {isFullscreen ? (
        <Dialog open={isFullscreen} onOpenChange={setIsFullscreen}>
          <DialogContent className="max-w-4xl h-[80vh] p-0">
            {content}
          </DialogContent>
        </Dialog>
      ) : (
        content
      )}

      {/* Log Details Dialog */}
      {selectedLog && (
        <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Log Details</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <span className="font-medium">Timestamp:</span>{' '}
                {selectedLog.timestamp.toISOString()}
              </div>
              <div>
                <span className="font-medium">Level:</span>{' '}
                <Badge variant={
                  selectedLog.level === 'error' ? 'destructive' :
                  selectedLog.level === 'success' ? 'default' :
                  selectedLog.level === 'warn' ? 'secondary' :
                  'outline'
                }>
                  {selectedLog.level.toUpperCase()}
                </Badge>
              </div>
              {selectedLog.toolName && (
                <div>
                  <span className="font-medium">Tool:</span> {selectedLog.toolName}
                </div>
              )}
              {selectedLog.phase && (
                <div>
                  <span className="font-medium">Phase:</span> {selectedLog.phase}
                </div>
              )}
              <div>
                <span className="font-medium">Message:</span>
                <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm whitespace-pre-wrap">
                  {selectedLog.message}
                </pre>
              </div>
              {selectedLog.details && (
                <div>
                  <span className="font-medium">Details:</span>
                  <pre className="mt-1 p-2 bg-gray-100 dark:bg-gray-800 rounded text-sm overflow-auto">
                    {JSON.stringify(selectedLog.details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};

export default ToolExecutionLogger; 