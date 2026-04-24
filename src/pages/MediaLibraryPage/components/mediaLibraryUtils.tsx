import { BookMarked, BookOpen, FileText, GraduationCap, Image, Music, Shield, Video } from 'lucide-react';

export function getFileTypeIcon(fileType: string) {
  if (fileType.startsWith('image/')) return <Image className="h-4 w-4" />;
  if (fileType.startsWith('video/')) return <Video className="h-4 w-4" />;
  if (fileType.startsWith('audio/')) return <Music className="h-4 w-4" />;
  return <FileText className="h-4 w-4" />;
}

export function getCategoryIcon(iconName?: string) {
  switch (iconName) {
    case 'BookOpen':
      return <BookOpen className="h-4 w-4" />;
    case 'GraduationCap':
      return <GraduationCap className="h-4 w-4" />;
    case 'BookMarked':
      return <BookMarked className="h-4 w-4" />;
    case 'Shield':
      return <Shield className="h-4 w-4" />;
    default:
      return <FileText className="h-4 w-4" />;
  }
}

export function formatFileSize(bytes: number) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

export function getStatusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'completed':
      return 'default';
    case 'processing':
      return 'secondary';
    case 'failed':
      return 'destructive';
    case 'uploaded':
      return 'outline';
    default:
      return 'secondary';
  }
}
