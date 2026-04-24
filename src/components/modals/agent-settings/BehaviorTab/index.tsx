import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useAuth } from '@/contexts/AuthContext';
import { useSupabaseClient } from '@/hooks/useSupabaseClient';
import { buildSystemPrompt } from './buildSystemPrompt';
import { CoreBehaviorCard } from './CoreBehaviorCard';
import { RulesCard } from './RulesCard';
import type { BehaviorTabProps, CustomContext, Rule } from './types';
import type { TabRef } from '../types';

export const BehaviorTab = forwardRef<TabRef, BehaviorTabProps>(({ agentId, onAgentUpdated }, ref) => {
  const supabase = useSupabaseClient();
  const { user } = useAuth();

  const [role, setRole] = useState('');
  const [instructions, setInstructions] = useState('');
  const [constraints, setConstraints] = useState('');
  const [tools, setTools] = useState('');
  const [customContexts, setCustomContexts] = useState<CustomContext[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [formattingTools, setFormattingTools] = useState(false);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  const [originalRole, setOriginalRole] = useState('');
  const [originalInstructions, setOriginalInstructions] = useState('');
  const [originalConstraints, setOriginalConstraints] = useState('');
  const [originalTools, setOriginalTools] = useState('');
  const [originalCustomContexts, setOriginalCustomContexts] = useState<CustomContext[]>([]);
  const [originalRules, setOriginalRules] = useState<Rule[]>([]);

  useEffect(() => {
    const loadAgentSettings = async () => {
      if (!agentId) return;
      setLoadingSettings(true);
      try {
        const { data, error } = await supabase.from('agents').select('metadata').eq('id', agentId).single();
        if (error) throw error;
        const behavior = data?.metadata?.behavior || {};
        const loadedRole = behavior.role || '';
        const loadedInstructions = behavior.instructions || '';
        const loadedConstraints = behavior.constraints || '';
        const loadedTools = behavior.tools || '';
        const loadedContexts = behavior.custom_contexts || [];
        const loadedRules = behavior.rules || [];
        setRole(loadedRole);
        setInstructions(loadedInstructions);
        setConstraints(loadedConstraints);
        setTools(loadedTools);
        setCustomContexts(loadedContexts);
        setRules(loadedRules);
        setOriginalRole(loadedRole);
        setOriginalInstructions(loadedInstructions);
        setOriginalConstraints(loadedConstraints);
        setOriginalTools(loadedTools);
        setOriginalCustomContexts(loadedContexts);
        setOriginalRules(loadedRules);
      } catch (error) {
        console.error('Error loading agent settings:', error);
      } finally {
        setLoadingSettings(false);
      }
    };
    void loadAgentSettings();
  }, [agentId, supabase]);

  const addCustomContext = () => setCustomContexts((prev) => [...prev, { id: Date.now().toString(), name: '', content: '' }]);
  const updateCustomContext = (id: string, field: 'name' | 'content', value: string) => {
    setCustomContexts((prev) => prev.map((ctx) => (ctx.id === id ? { ...ctx, [field]: value } : ctx)));
  };
  const removeCustomContext = (id: string) => setCustomContexts((prev) => prev.filter((ctx) => ctx.id !== id));

  const addRule = () => {
    if (rules.length >= 50) return toast.error('Maximum 50 rules allowed');
    const newRule = { id: Date.now().toString(), content: '' };
    setRules((prev) => [...prev, newRule]);
    setEditingRuleId(newRule.id);
  };

  const updateRule = (id: string, content: string) => {
    const wordCount = content.trim().split(/\s+/).filter((word) => word.length > 0).length;
    if (wordCount > 50) return toast.error('Rule must be 50 words or less');
    setRules((prev) => prev.map((rule) => (rule.id === id ? { ...rule, content } : rule)));
  };
  const removeRule = (id: string) => setRules((prev) => prev.filter((rule) => rule.id !== id));

  const handleUpdateToolsFromMcp = async () => {
    setFormattingTools(true);
    try {
      const { data, error } = await supabase.functions.invoke('format-mcp-tools', { body: { agentId } });
      if (error) throw error;
      if (data?.success && data?.formattedTools) {
        setTools(data.formattedTools);
        toast.success('MCP tools formatted successfully!');
      } else {
        throw new Error(data?.error || 'Failed to format tools');
      }
    } catch (err: any) {
      console.error('Error formatting MCP tools:', err);
      toast.error(err.message || 'Failed to format MCP tools');
    } finally {
      setFormattingTools(false);
    }
  };

  const handleSave = useCallback(async () => {
    if (!agentId || !user) return;
    const startTime = Date.now();
    setLoading(true);
    setSaveSuccess(false);
    try {
      const { data: currentData } = await supabase.from('agents').select('metadata').eq('id', agentId).single();
      const currentMetadata = currentData?.metadata || {};
      const updatedMetadata = {
        ...currentMetadata,
        behavior: { role, instructions, constraints, tools, custom_contexts: customContexts, rules },
        settings: {
          ...currentMetadata.settings,
          custom_instructions: buildSystemPrompt({ role, instructions, constraints, tools, customContexts, rules }),
        },
      };
      const { data, error } = await supabase.from('agents').update({ metadata: updatedMetadata }).eq('id', agentId).eq('user_id', user.id).select().single();
      if (error) throw error;
      toast.success('Behavior settings updated successfully! 🎯');
      onAgentUpdated?.(data);
      setOriginalRole(role);
      setOriginalInstructions(instructions);
      setOriginalConstraints(constraints);
      setOriginalTools(tools);
      setOriginalCustomContexts(customContexts);
      setOriginalRules(rules);
    } catch (error) {
      console.error('Error updating agent behavior:', error);
      toast.error('Failed to update behavior settings');
    } finally {
      const elapsedTime = Date.now() - startTime;
      const remainingTime = Math.max(0, 1000 - elapsedTime);
      await new Promise((resolve) => setTimeout(resolve, remainingTime));
      setLoading(false);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  }, [agentId, user, role, instructions, constraints, tools, customContexts, rules, supabase, onAgentUpdated]);

  const hasChanges =
    role !== originalRole ||
    instructions !== originalInstructions ||
    constraints !== originalConstraints ||
    tools !== originalTools ||
    JSON.stringify(customContexts) !== JSON.stringify(originalCustomContexts) ||
    JSON.stringify(rules) !== JSON.stringify(originalRules);

  useImperativeHandle(ref, () => ({ save: handleSave, hasChanges, saving: loading, saveSuccess }));

  if (loadingSettings) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto pr-2 space-y-6 pb-20">
        <div>
          <h3 className="text-lg font-medium">Agent Behavior</h3>
          <p className="text-sm text-muted-foreground">Define your agent&apos;s role, instructions, constraints, and operational rules.</p>
        </div>

        <CoreBehaviorCard
          role={role}
          instructions={instructions}
          constraints={constraints}
          tools={tools}
          formattingTools={formattingTools}
          customContexts={customContexts}
          editingSection={editingSection}
          openMenuId={openMenuId}
          onRoleChange={setRole}
          onInstructionsChange={setInstructions}
          onConstraintsChange={setConstraints}
          onToolsChange={setTools}
          onSetEditingSection={setEditingSection}
          onSetOpenMenuId={setOpenMenuId}
          onAddCustomContext={addCustomContext}
          onUpdateCustomContext={updateCustomContext}
          onRemoveCustomContext={removeCustomContext}
          onUpdateFromMcp={handleUpdateToolsFromMcp}
        />

        <RulesCard
          rules={rules}
          editingRuleId={editingRuleId}
          openMenuId={openMenuId}
          onSetEditingRuleId={setEditingRuleId}
          onSetOpenMenuId={setOpenMenuId}
          onAddRule={addRule}
          onUpdateRule={updateRule}
          onRemoveRule={removeRule}
        />
      </div>
    </div>
  );
});
