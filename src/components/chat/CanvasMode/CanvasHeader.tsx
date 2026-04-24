import { Download, FileText, X } from 'lucide-react';
import { CanvasModeProps } from '@/types/artifacts';

interface CanvasHeaderProps {
  title: string;
  draftSaving: boolean;
  hasUnsavedChanges: boolean;
  isSaving: boolean;
  saveSuccess: boolean;
  saveButtonText: string;
  artifact: CanvasModeProps['artifact'];
  onSave: () => void;
  onDownload: (artifact: CanvasModeProps['artifact']) => void;
  onClose: () => void;
}

export function CanvasHeader({
  title,
  draftSaving,
  hasUnsavedChanges,
  isSaving,
  saveSuccess,
  saveButtonText,
  artifact,
  onSave,
  onDownload,
  onClose,
}: CanvasHeaderProps) {
  return (
    <div className="h-12 bg-[#2f2f2f] flex items-center justify-between px-4">
      <div className="flex items-center gap-3 flex-1">
        <FileText className="h-4 w-4 text-gray-400" />
        <h2 className="font-medium text-sm text-white">{title}</h2>
        <span className="text-xs text-gray-400">{draftSaving ? '• Saving draft...' : '• Draft saved'}</span>
      </div>

      <div className="absolute left-1/2 transform -translate-x-1/2">
        <span className="text-xs font-medium text-white">Canvas Mode</span>
      </div>

      <div className="flex items-center gap-2 flex-1 justify-end">
        <button
          onClick={onSave}
          disabled={!hasUnsavedChanges || isSaving}
          className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${
            hasUnsavedChanges ? 'bg-primary text-primary-foreground hover:bg-primary/90' : 'bg-[#3f3f3f] text-gray-500 cursor-not-allowed'
          }`}
          title={hasUnsavedChanges ? `${saveButtonText} (Ctrl+S)` : 'No changes to save'}
        >
          {isSaving ? 'Saving...' : saveSuccess && !hasUnsavedChanges ? 'Saved' : saveButtonText}
        </button>
        <button onClick={() => onDownload(artifact)} className="p-2 text-gray-400 hover:text-white hover:bg-[#3f3f3f] rounded-lg transition-colors" title="Download file">
          <Download className="h-4 w-4" />
        </button>
        <button onClick={onClose} className="p-2 text-gray-400 hover:text-white hover:bg-[#3f3f3f] rounded-lg transition-colors" title="Close canvas">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
