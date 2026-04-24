import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CustomContext } from './types';

interface CoreBehaviorCardProps {
  role: string;
  instructions: string;
  constraints: string;
  tools: string;
  formattingTools: boolean;
  customContexts: CustomContext[];
  editingSection: string | null;
  openMenuId: string | null;
  onRoleChange: (value: string) => void;
  onInstructionsChange: (value: string) => void;
  onConstraintsChange: (value: string) => void;
  onToolsChange: (value: string) => void;
  onSetEditingSection: (value: string | null) => void;
  onSetOpenMenuId: (value: string | null) => void;
  onAddCustomContext: () => void;
  onUpdateCustomContext: (id: string, field: 'name' | 'content', value: string) => void;
  onRemoveCustomContext: (id: string) => void;
  onUpdateFromMcp: () => Promise<void>;
}

function EditableRow({
  id,
  title,
  value,
  placeholder,
  rows = 4,
  isEditing,
  openMenuId,
  onOpenMenuId,
  onEdit,
  onDone,
  onChange,
  extraHeaderAction,
}: {
  id: string;
  title: string;
  value: string;
  placeholder: string;
  rows?: number;
  isEditing: boolean;
  openMenuId: string | null;
  onOpenMenuId: (value: string | null) => void;
  onEdit: () => void;
  onDone: () => void;
  onChange: (value: string) => void;
  extraHeaderAction?: React.ReactNode;
}) {
  if (isEditing) {
    return (
      <div className="bg-muted/30 rounded p-3 space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor={id} className="text-sm font-medium">
            {title}
          </Label>
          {extraHeaderAction}
        </div>
        <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={rows} className="w-full" autoFocus />
        <div className="flex justify-end">
          <Button type="button" variant="ghost" size="sm" onClick={onDone}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-center justify-between py-2 px-1 hover:bg-muted/50 rounded relative" onMouseLeave={() => openMenuId === id && onOpenMenuId(null)}>
      <div className="flex-1 pr-8">
        <p className="text-sm font-medium text-foreground">{title}</p>
        {value ? <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{value}</p> : <p className="text-xs text-muted-foreground italic">Not set</p>}
      </div>
      <div className="relative">
        <button type="button" onClick={() => onOpenMenuId(openMenuId === id ? null : id)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded">
          <span className="text-muted-foreground">⋯</span>
        </button>
        {openMenuId === id && (
          <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg z-10 py-1 min-w-[100px]">
            <button type="button" onClick={onEdit} className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted transition-colors">
              Edit
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function CoreBehaviorCard(props: CoreBehaviorCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle>Core Behavior</CardTitle>
            <CardDescription>Define the fundamental aspects of how your agent operates and communicates</CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={props.onAddCustomContext}>
            <Plus className="h-4 w-4 mr-1" />
            Add Context
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <EditableRow
          id="role"
          title="Role"
          value={props.role}
          placeholder="Example: You are a professional customer support specialist focused on resolving technical issues."
          rows={3}
          isEditing={props.editingSection === 'role'}
          openMenuId={props.openMenuId}
          onOpenMenuId={props.onSetOpenMenuId}
          onEdit={() => {
            props.onSetEditingSection('role');
            props.onSetOpenMenuId(null);
          }}
          onDone={() => props.onSetEditingSection(null)}
          onChange={props.onRoleChange}
        />
        <div className="border-t border-border/30 my-1" />
        <EditableRow
          id="instructions"
          title="Instructions"
          value={props.instructions}
          placeholder="Example: Always be polite, helpful, and solution-focused."
          isEditing={props.editingSection === 'instructions'}
          openMenuId={props.openMenuId}
          onOpenMenuId={props.onSetOpenMenuId}
          onEdit={() => {
            props.onSetEditingSection('instructions');
            props.onSetOpenMenuId(null);
          }}
          onDone={() => props.onSetEditingSection(null)}
          onChange={props.onInstructionsChange}
        />
        <div className="border-t border-border/30 my-1" />
        <EditableRow
          id="constraints"
          title="Constraints"
          value={props.constraints}
          placeholder="Example: Never share confidential information."
          isEditing={props.editingSection === 'constraints'}
          openMenuId={props.openMenuId}
          onOpenMenuId={props.onSetOpenMenuId}
          onEdit={() => {
            props.onSetEditingSection('constraints');
            props.onSetOpenMenuId(null);
          }}
          onDone={() => props.onSetEditingSection(null)}
          onChange={props.onConstraintsChange}
        />
        <div className="border-t border-border/30 my-1" />
        <EditableRow
          id="tools"
          title="Tools"
          value={props.tools}
          placeholder="How should your agent use available tools and integrations?"
          rows={8}
          isEditing={props.editingSection === 'tools'}
          openMenuId={props.openMenuId}
          onOpenMenuId={props.onSetOpenMenuId}
          onEdit={() => {
            props.onSetEditingSection('tools');
            props.onSetOpenMenuId(null);
          }}
          onDone={() => props.onSetEditingSection(null)}
          onChange={props.onToolsChange}
          extraHeaderAction={
            <Button type="button" variant="outline" size="sm" disabled={props.formattingTools} onClick={() => void props.onUpdateFromMcp()}>
              {props.formattingTools ? 'Formatting...' : 'Update from MCP'}
            </Button>
          }
        />

        {props.customContexts.map((context, index) => {
          const key = `context-${context.id}`;
          const isEditing = props.editingSection === key;
          return (
            <div key={context.id}>
              {index > 0 && <div className="border-t border-border/30 my-1" />}
              {isEditing ? (
                <div className="bg-muted/30 rounded p-3 space-y-2">
                  <Input value={context.name} onChange={(e) => props.onUpdateCustomContext(context.id, 'name', e.target.value)} placeholder="Context name" className="w-full" />
                  <Textarea value={context.content} onChange={(e) => props.onUpdateCustomContext(context.id, 'content', e.target.value)} placeholder="Enter context content..." rows={3} className="w-full" />
                  <div className="flex justify-between">
                    <Button type="button" variant="ghost" size="sm" onClick={() => props.onRemoveCustomContext(context.id)} className="text-red-600">
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={() => props.onSetEditingSection(null)}>
                      Done
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="group flex items-center justify-between py-2 px-1 hover:bg-muted/50 rounded relative" onMouseLeave={() => props.openMenuId === key && props.onSetOpenMenuId(null)}>
                  <div className="flex-1 pr-8">
                    <p className="text-sm font-medium text-foreground">{context.name || 'New Context'}</p>
                    {context.content && <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">{context.content}</p>}
                  </div>
                  <div className="relative">
                    <button type="button" onClick={() => props.onSetOpenMenuId(props.openMenuId === key ? null : key)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-muted rounded">
                      <span className="text-muted-foreground">⋯</span>
                    </button>
                    {props.openMenuId === key && (
                      <div className="absolute right-0 top-full mt-1 bg-popover border border-border rounded-md shadow-lg z-10 py-1 min-w-[100px]">
                        <button
                          type="button"
                          onClick={() => {
                            props.onSetEditingSection(key);
                            props.onSetOpenMenuId(null);
                          }}
                          className="w-full px-3 py-1.5 text-left text-sm hover:bg-muted transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            props.onRemoveCustomContext(context.id);
                            props.onSetOpenMenuId(null);
                          }}
                          className="w-full px-3 py-1.5 text-left text-sm text-red-600 hover:bg-muted transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
