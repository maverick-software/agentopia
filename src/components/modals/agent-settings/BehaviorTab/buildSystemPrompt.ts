import type { CustomContext, Rule } from './types';

export function buildSystemPrompt({
  role,
  instructions,
  constraints,
  tools,
  customContexts,
  rules,
}: {
  role: string;
  instructions: string;
  constraints: string;
  tools: string;
  customContexts: CustomContext[];
  rules: Rule[];
}) {
  let systemPrompt = '';
  if (role.trim()) systemPrompt += `## Role ##\n\n${role.trim()}\n\n`;
  if (instructions.trim()) systemPrompt += `## Instructions ##\n\n${instructions.trim()}\n\n`;
  if (constraints.trim()) systemPrompt += `## Constraints ##\n\n${constraints.trim()}\n\n`;
  if (tools.trim()) systemPrompt += `## Tools ##\n\n${tools.trim()}\n\n`;

  customContexts.forEach((ctx) => {
    if (ctx.name.trim() && ctx.content.trim()) {
      systemPrompt += `## ${ctx.name.trim()} ##\n\n${ctx.content.trim()}\n\n`;
    }
  });

  const activeRules = rules.filter((rule) => rule.content.trim());
  if (activeRules.length > 0) {
    systemPrompt += '## Rules ##\n\n';
    activeRules.forEach((rule, index) => {
      systemPrompt += `${index + 1}. ${rule.content.trim()}\n`;
    });
  }
  return systemPrompt.trim();
}
