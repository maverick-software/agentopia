/**
 * ArtifactCard Component
 * Inline artifact preview in chat (ChatGPT-style)
 */

import React from 'react';
import {
  FileText,
  FileCode,
  Copy,
  Edit3,
  Download
} from 'lucide-react';
import { Artifact, ArtifactCardProps } from '@/types/artifacts';
import { toast } from 'react-hot-toast';

// Icon mapping
const getArtifactIcon = (fileType: string) => {
  const iconMap: Record<string, typeof FileText> = {
    txt: FileText,
    md: FileText,
    json: FileCode,
    html: FileCode,
    javascript: FileCode,
    typescript: FileCode,
    python: FileCode,
    java: FileCode,
    css: FileCode,
    csv: FileText,
    sql: FileCode,
    yaml: FileCode,
    xml: FileCode,
    bash: FileCode,
    shell: FileCode,
    dockerfile: FileCode
  };
  
  return iconMap[fileType] || FileText;
};

export const ArtifactCard: React.FC<ArtifactCardProps> = ({
  artifact,
  onOpenCanvas,
  onDownload
}) => {
  const Icon = getArtifactIcon(artifact.file_type);

  const handleCopy = () => {
    navigator.clipboard.writeText(artifact.content);
    toast.success('Copied to clipboard');
  };

  // Get preview (first 15 lines or 300 chars)
  const lines = artifact.content.split('\n');
  const previewLines = lines.slice(0, 15);
  const preview = previewLines.join('\n');
  const hasMore = lines.length > 15;

  return (
    <div className="my-3 rounded-xl bg-[#2f2f2f] border border-[#444] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#444]">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-gray-400" />
          <span className="text-sm font-medium text-white">
            {artifact.title}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-[#3f3f3f] rounded-md transition-colors"
            title="Copy"
          >
            Copy
          </button>
          <button
            onClick={() => onOpenCanvas(artifact)}
            className="px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-[#3f3f3f] rounded-md transition-colors"
            title="Edit in Canvas"
          >
            Edit
          </button>
          <button
            onClick={() => onDownload(artifact)}
            className="px-3 py-1.5 text-xs text-gray-300 hover:text-white hover:bg-[#3f3f3f] rounded-md transition-colors"
            title="Download"
          >
            Download
          </button>
        </div>
      </div>

      {/* Content Preview */}
      <div className="relative">
        <pre className="p-4 text-xs font-mono text-gray-300 overflow-x-auto max-h-[300px] overflow-y-auto">
          <code>{preview}</code>
        </pre>
        {hasMore && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-[#2f2f2f] to-transparent pointer-events-none" />
        )}
      </div>
    </div>
  );
};
