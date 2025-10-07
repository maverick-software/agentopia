/**
 * ArtifactCard Component
 * Displays an inline preview of an artifact in the chat
 */

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  FileText,
  FileCode,
  Braces,
  Code2,
  Palette,
  Table,
  Database,
  Terminal,
  Container,
  Download,
  Maximize2,
  Copy,
  Clock,
  Eye
} from 'lucide-react';
import { Artifact, ArtifactCardProps, ARTIFACT_TYPE_LABELS } from '@/types/artifacts';
import { toast } from 'react-hot-toast';

// Icon mapping
const ICON_COMPONENTS: Record<string, React.ComponentType<{ className?: string }>> = {
  FileText,
  FileCode,
  Braces,
  Code2,
  Palette,
  Table,
  Database,
  Terminal,
  Container
};

const getArtifactIcon = (fileType: string) => {
  const iconMap: Record<string, string> = {
    txt: 'FileText',
    md: 'FileText',
    json: 'Braces',
    html: 'Code2',
    javascript: 'FileCode',
    typescript: 'FileCode',
    python: 'FileCode',
    java: 'FileCode',
    css: 'Palette',
    csv: 'Table',
    sql: 'Database',
    yaml: 'FileCode',
    xml: 'Code2',
    bash: 'Terminal',
    shell: 'Terminal',
    dockerfile: 'Container'
  };
  
  const iconName = iconMap[fileType] || 'FileText';
  return ICON_COMPONENTS[iconName] || FileText;
};

const getFileTypeColor = (fileType: string): string => {
  const colorMap: Record<string, string> = {
    javascript: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
    typescript: 'bg-blue-500/10 text-blue-600 border-blue-500/20',
    python: 'bg-green-500/10 text-green-600 border-green-500/20',
    java: 'bg-orange-500/10 text-orange-600 border-orange-500/20',
    html: 'bg-red-500/10 text-red-600 border-red-500/20',
    css: 'bg-purple-500/10 text-purple-600 border-purple-500/20',
    json: 'bg-gray-500/10 text-gray-600 border-gray-500/20',
    sql: 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20',
    md: 'bg-slate-500/10 text-slate-600 border-slate-500/20',
    bash: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20',
    shell: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
  };
  
  return colorMap[fileType] || 'bg-gray-500/10 text-gray-600 border-gray-500/20';
};

export const ArtifactCard: React.FC<ArtifactCardProps> = ({
  artifact,
  onOpenCanvas,
  onDownload,
  onDelete
}) => {
  const Icon = getArtifactIcon(artifact.file_type);
  const fileTypeColor = getFileTypeColor(artifact.file_type);
  
  // Get preview (first 10 lines)
  const previewLines = artifact.content.split('\n').slice(0, 10);
  const hasMore = artifact.content.split('\n').length > 10;
  const preview = previewLines.join('\n');

  const handleCopyContent = () => {
    navigator.clipboard.writeText(artifact.content);
    toast.success('Content copied to clipboard');
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <Card className="mt-3 border-2 border-primary/20 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1">
            <div className={`p-2 rounded-lg ${fileTypeColor} border`}>
              <Icon className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                {artifact.title}
                <Badge variant="outline" className="text-xs font-normal">
                  v{artifact.version}
                </Badge>
              </CardTitle>
              {artifact.description && (
                <CardDescription className="mt-1 text-sm">
                  {artifact.description}
                </CardDescription>
              )}
              <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                <Badge variant="secondary" className={`text-xs ${fileTypeColor} border`}>
                  {ARTIFACT_TYPE_LABELS[artifact.file_type] || artifact.file_type}
                </Badge>
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {formatDate(artifact.created_at)}
                </span>
                {artifact.view_count > 0 && (
                  <span className="flex items-center gap-1">
                    <Eye className="h-3 w-3" />
                    {artifact.view_count} {artifact.view_count === 1 ? 'view' : 'views'}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {/* Code Preview */}
        <div className="relative">
          <pre className="bg-muted/50 rounded-lg p-3 text-xs font-mono overflow-x-auto border border-border/50">
            <code>{preview}</code>
          </pre>
          {hasMore && (
            <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-muted/50 to-transparent rounded-b-lg flex items-end justify-center pb-2">
              <span className="text-xs text-muted-foreground">
                +{artifact.content.split('\n').length - 10} more lines
              </span>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 pt-2">
          <Button
            onClick={() => onOpenCanvas(artifact)}
            className="flex-1"
            size="sm"
          >
            <Maximize2 className="h-4 w-4 mr-2" />
            Open Canvas
          </Button>
          
          <Button
            onClick={() => onDownload(artifact)}
            variant="outline"
            size="sm"
          >
            <Download className="h-4 w-4 mr-2" />
            Download
          </Button>
          
          <Button
            onClick={handleCopyContent}
            variant="outline"
            size="sm"
          >
            <Copy className="h-4 w-4" />
          </Button>
        </div>

        {/* Tags */}
        {artifact.tags && artifact.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 pt-2">
            {artifact.tags.map((tag, index) => (
              <Badge key={index} variant="secondary" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
