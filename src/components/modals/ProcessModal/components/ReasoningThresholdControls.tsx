import React from 'react';
import { RotateCcw, Settings } from 'lucide-react';

interface ReasoningThresholdControlsProps {
  currentScore: number;
  isEnabled: boolean;
  onThresholdChange: (threshold: number) => void;
  agentId?: string;
}

export const ReasoningThresholdControls: React.FC<ReasoningThresholdControlsProps> = ({
  currentScore,
  isEnabled,
  onThresholdChange,
  agentId,
}) => {
  const [showAdvanced, setShowAdvanced] = React.useState(false);
  const [threshold, setThreshold] = React.useState(() => {
    const stored = localStorage.getItem(`reasoning-threshold-${agentId || 'global'}`);
    return stored ? parseFloat(stored) : 0.3;
  });
  const [autoAdjust, setAutoAdjust] = React.useState(() => {
    const stored = localStorage.getItem(`reasoning-auto-adjust-${agentId || 'global'}`);
    return stored ? JSON.parse(stored) : true;
  });

  const updateThreshold = (newThreshold: number) => {
    setThreshold(newThreshold);
    localStorage.setItem(`reasoning-threshold-${agentId || 'global'}`, newThreshold.toString());
    onThresholdChange(newThreshold);
  };

  const updateAutoAdjust = (enabled: boolean) => {
    setAutoAdjust(enabled);
    localStorage.setItem(`reasoning-auto-adjust-${agentId || 'global'}`, JSON.stringify(enabled));
  };

  const getScoreColor = (score: number, targetThreshold: number) => {
    if (score >= targetThreshold) return 'text-green-600';
    if (score >= targetThreshold * 0.8) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="border-t border-border pt-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Reasoning Controls</span>
        </div>
        <button onClick={() => setShowAdvanced(!showAdvanced)} className="text-xs text-muted-foreground hover:text-foreground underline">
          {showAdvanced ? 'Hide' : 'Show'} Advanced
        </button>
      </div>

      <div className="flex items-center justify-between mb-3 text-xs">
        <span className="text-muted-foreground">
          Current Score: <span className={`font-medium ${getScoreColor(currentScore, threshold)}`}>{(currentScore * 100).toFixed(1)}%</span>
        </span>
        <span className="text-muted-foreground">
          Status: <span className={`font-medium ${isEnabled ? 'text-green-600' : 'text-red-600'}`}>{isEnabled ? 'ACTIVE' : 'INACTIVE'}</span>
        </span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-medium text-foreground">Activation Threshold</label>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{(threshold * 100).toFixed(0)}%</span>
            <button onClick={() => updateThreshold(0.3)} className="p-1 hover:bg-warning/20 rounded">
              <RotateCcw className="h-3 w-3 text-warning-foreground" />
            </button>
          </div>
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={threshold}
          onChange={(e) => updateThreshold(parseFloat(e.target.value))}
          className="w-full h-2 rounded-lg appearance-none cursor-pointer"
          style={{ background: 'linear-gradient(to right, #ef4444 0%, #f59e0b 50%, #22c55e 100%)' }}
        />
      </div>

      {showAdvanced && (
        <div className="mt-3 pt-3 border-t border-border space-y-3">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-foreground">Auto-Adjust Threshold</label>
            <input type="checkbox" checked={autoAdjust} onChange={(e) => updateAutoAdjust(e.target.checked)} />
          </div>
        </div>
      )}
    </div>
  );
};
