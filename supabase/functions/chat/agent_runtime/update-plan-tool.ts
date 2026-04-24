import type { UpdatePlanArgs } from './types.ts';

export const UPDATE_PLAN_TOOL = {
  name: 'update_plan',
  description: 'Update the visible task plan. Use this for multi-step work so progress can be rendered live.',
  parameters: {
    type: 'object',
    properties: {
      explanation: {
        type: 'string',
        description: 'Short explanation of what changed in the plan.',
      },
      plan: {
        type: 'array',
        description: 'Ordered plan steps with status. At most one step may be in_progress.',
        items: {
          type: 'object',
          properties: {
            step: { type: 'string' },
            status: {
              type: 'string',
              enum: ['pending', 'in_progress', 'completed'],
            },
          },
          required: ['step', 'status'],
        },
      },
    },
    required: ['plan'],
  },
};

export function validateUpdatePlanArgs(args: any): UpdatePlanArgs {
  const plan = Array.isArray(args?.plan) ? args.plan : [];
  const inProgress = plan.filter((step: any) => step?.status === 'in_progress').length;
  if (inProgress > 1) {
    throw new Error('Only one plan step may be in_progress.');
  }

  return {
    explanation: typeof args?.explanation === 'string' ? args.explanation : undefined,
    plan: plan.map((step: any) => ({
      step: String(step.step || '').trim(),
      status: step.status,
    })).filter((step: any) => step.step && ['pending', 'in_progress', 'completed'].includes(step.status)),
  };
}

export function formatPlanBlock(args: UpdatePlanArgs): string {
  return `\n:::plan\n${JSON.stringify(args, null, 2)}\n:::\n`;
}
