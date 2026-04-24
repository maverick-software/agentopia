import { AlertCircle, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import type { Rule } from './types';

interface RulesCardProps {
  rules: Rule[];
  editingRuleId: string | null;
  openMenuId: string | null;
  onSetEditingRuleId: (value: string | null) => void;
  onSetOpenMenuId: (value: string | null) => void;
  onAddRule: () => void;
  onUpdateRule: (id: string, content: string) => void;
  onRemoveRule: (id: string) => void;
}

export function RulesCard({
  rules,
  editingRuleId,
  openMenuId,
  onSetEditingRuleId,
  onSetOpenMenuId,
  onAddRule,
  onUpdateRule,
  onRemoveRule,
}: RulesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Rules</CardTitle>
        <CardDescription>Specific rules your agent must follow (max 50 rules, 50 words each)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <AlertCircle className="h-4 w-4" />
            <span>{rules.length} / 50 rules</span>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onAddRule} disabled={rules.length >= 50}>
            <Plus className="h-4 w-4 mr-1" />
            Add Rule
          </Button>
        </div>

        {rules.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            <p className="text-sm">No rules defined yet.</p>
            <p className="text-xs mt-1">Click "Add Rule" to create specific guidelines for your agent.</p>
          </div>
        )}

        <div className="space-y-1">
          {rules.map((rule, index) => {
            const isEditing = editingRuleId === rule.id;
            const showMenu = openMenuId === rule.id;
            const wordCount = rule.content.trim().split(/\s+/).filter((word) => word.length > 0).length;
            const isOverLimit = wordCount > 50;
            if (isEditing) {
              return (
                <div key={rule.id}>
                  {index > 0 && <div className="border-t border-border/30 my-1" />}
                  <div className="bg-muted/30 rounded p-3 space-y-2">
                    <Textarea
                      value={rule.content}
                      onChange={(e) => onUpdateRule(rule.id, e.target.value)}
                      placeholder="Enter a specific rule (max 50 words)..."
                      rows={2}
                      className={`w-full ${isOverLimit ? 'border-red-500' : ''}`}
                      autoFocus
                    />
                    <div className="flex items-center justify-between">
                      <span className={`text-xs ${isOverLimit ? 'text-red-500' : 'text-muted-foreground'}`}>{wordCount} / 50 words</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          if (rule.content.trim()) onSetEditingRuleId(null);
                          else onRemoveRule(rule.id);
                        }}
                      >
                        {rule.content.trim() ? 'Save' : 'Cancel'}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            }
            if (!rule.content.trim()) return null;
            return (
              <div key={rule.id}>
                {index > 0 && <div className="border-t border-border/30 my-1" />}
                <div className="group flex items-center justify-between py-2 px-1 hover:bg-muted/50 rounded relative" onMouseLeave={() => onSetOpenMenuId(null)}>
                  <p className="text-sm text-foreground flex-1 pr-8">{rule.content}</p>
                  <div className="relative">
                    <button type="button" onClick={() => onSetOpenMenuId(showMenu ? null : rule.id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded">
                      <span className="text-muted-foreground">⋯</span>
                    </button>
                    {showMenu && (
                      <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg z-10 py-1 min-w-[100px]">
                        <button
                          type="button"
                          onClick={() => {
                            onSetEditingRuleId(rule.id);
                            onSetOpenMenuId(null);
                          }}
                          className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onRemoveRule(rule.id);
                            onSetOpenMenuId(null);
                          }}
                          className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-muted transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
