import React from 'react';
import { AlertTriangle, CheckCircle, Clock, XCircle } from 'lucide-react';

export const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatTimestamp = (timestamp: string): string => new Date(timestamp).toLocaleString();

export const getStatusColor = (status: string): string => {
  switch (status.toLowerCase()) {
    case 'healthy':
    case 'running':
      return 'bg-green-500';
    case 'stopped':
    case 'exited':
      return 'bg-red-500';
    case 'starting':
      return 'bg-yellow-500';
    default:
      return 'bg-gray-500';
  }
};

export const getStatusIcon = (status: string): React.ReactNode => {
  switch (status.toLowerCase()) {
    case 'healthy':
    case 'running':
      return <CheckCircle className="h-4 w-4" />;
    case 'stopped':
    case 'exited':
      return <XCircle className="h-4 w-4" />;
    case 'starting':
      return <Clock className="h-4 w-4" />;
    default:
      return <AlertTriangle className="h-4 w-4" />;
  }
};
