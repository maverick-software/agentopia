import React from 'react';
import { Badge } from '@/components/ui/badge';

const getStatusColor = (status: string) => {
  switch (status) {
    case 'running':
    case 'connected':
    case 'healthy':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'deploying':
    case 'connecting':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'stopped':
    case 'disconnected':
      return 'bg-gray-100 text-gray-800 border-gray-200';
    case 'error':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const StatusBadge: React.FC<{ status: string; size?: 'sm' | 'md' }> = ({ status, size = 'md' }) => (
  <Badge variant="outline" className={`${getStatusColor(status)} ${size === 'sm' ? 'text-xs px-1 py-0' : ''}`}>
    {status}
  </Badge>
);
