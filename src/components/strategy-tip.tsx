import { useEffect, useState } from 'react';
import { useServerFn } from '@tanstack/react-start';
import ReactMarkdown from 'react-markdown';
import { Send, LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { askStrategy } from '@/lib/ai/strategy-tip.functions';
import { strategySchema, type StrategyInput } from '@/lib/ai/strategy-schema';

export function StrategyTip({ frame }: { frame: React.RefObject<HTMLIFrameElement | null> }) {
  const [state, setState] = useState<Omit<StrategyInput, 'question'> | null>(null);
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState('Should I buy, sell, or hold?');
  const [tip, setTip] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const ask = useServerFn(askStrategy);
  useEffect(() => {
    function receive(event: MessageEvent) {
      if (event.source !== frame.current?.contentWindow || event.data?.type !== 'capital-strategy') return;
      const parsed = strategySchema.safeParse({ ...event.data.state, question: 'snapshot' });
      if (!parsed.success) return;
      setState(parsed.data); setTip(''); setError(''); setOpen(true);
    }
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [frame]);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const parsed = strategySchema.safeParse({ ...state, question });
    if (!parsed.success) { setError('Enter a question of up to 500 characters.'); return; }
    setBusy(true); setError(''); setTip('');
    try { const result = await ask({ data: parsed.data }); setTip(result.tip); setError(result.error); }
    catch { setError('Could not reach strategy tips. Please try again later.'); }
    finally { setBusy(false); }
  }
  return <Dialog open={open} onOpenChange={(value) => { if (!busy) setOpen(value); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto">
      <DialogTitle>Strategy tip</DialogTitle>
      <DialogDescription>{state?.player.name} · Tile {state?.player.position} · {state?.player.shares} shares · {state?.currency} {state?.player.money.toLocaleString()} cash</DialogDescription>
      <form onSubmit={submit} className="grid gap-3">
        <label htmlFor="strategy-question" className="text-sm font-medium">Your question</label>
        <textarea id="strategy-question" value={question} onChange={(e) => setQuestion(e.target.value)} maxLength={500} rows={2} disabled={busy} className="w-full rounded-md border border-input bg-background p-3 text-foreground" />
        <Button type="submit" disabled={busy || !question.trim()}>{busy ? <LoaderCircle className="animate-spin" /> : <Send />} {busy ? 'Considering your position…' : 'Ask for a tip'}</Button>
      </form>
      {tip && <div aria-live="polite" className="space-y-2 text-sm leading-relaxed"><ReactMarkdown>{tip}</ReactMarkdown></div>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <p className="text-xs text-muted-foreground">Game strategy only · Snapshot at question opening · Lovable AI usage uses workspace credits</p>
    </DialogContent>
  </Dialog>;
}