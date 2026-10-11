import { createServerFn } from '@tanstack/react-start';
import { getRequest } from '@tanstack/react-start/server';
import { strategySchema } from './strategy-schema';

export const askStrategy = createServerFn({ method: 'POST' })
  .inputValidator((input: unknown) => strategySchema.parse(input))
  .handler(async ({ data }) => {
    const key = process.env['LOVABLE_API_KEY'];
    if (!key) return { tip: '', error: 'AI strategy tips are not configured yet.' };
    const { generateStrategyTip } = await import('./strategy-tip.server');
    return generateStrategyTip(data, key, getRequest());
  });