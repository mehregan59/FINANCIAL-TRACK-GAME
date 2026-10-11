import { createFileRoute } from "@tanstack/react-router";
import { gameDocument, STRATEGY_TIPS_ENABLED } from "@/lib/game-document";
import { useEffect, useRef } from 'react';
import { submitFeedback, submitBugReport, getFeedbackQuestions } from '@/lib/feedback/feedback.functions';
import { StrategyTip } from '@/components/strategy-tip';

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Capital Crash Online" },
      { name: "description", content: "Play Capital Crash Online: create a room, join friends, and compete on the financial board game." },
      { property: "og:title", content: "Capital Crash Online" },
      { property: "og:description", content: "Create a room and play the financial board game with friends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const frame = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    const reply = (msg: object) => frame.current?.contentWindow?.postMessage(msg, '*');
    const onMsg = async (e: MessageEvent) => {
      if (e.source !== frame.current?.contentWindow) return;
      const t = e.data?.type;
      if (t === 'capital-feedback') {
        let ok = false;
        try { await submitFeedback({ data: e.data.data }); ok = true; } catch { ok = false; }
        reply({ type: 'capital-feedback-result', ok });
      } else if (t === 'capital-bug') {
        let ok = false;
        try { await submitBugReport({ data: e.data.data }); ok = true; } catch { ok = false; }
        reply({ type: 'capital-bug-result', ok });
      } else if (t === 'capital-questions') {
        let questions: unknown[] = [];
        try { questions = await getFeedbackQuestions(); } catch { questions = []; }
        reply({ type: 'capital-questions-result', questions });
      }
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);
  return (
    <>
    <iframe
      ref={frame}
      title="Capital Crash Online game"
      srcDoc={gameDocument}
      className="block h-dvh w-full border-0 bg-background"
      allow="clipboard-write"
    />
    {STRATEGY_TIPS_ENABLED && <StrategyTip frame={frame} />}
    </>
  );
}
