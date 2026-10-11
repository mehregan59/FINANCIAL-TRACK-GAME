import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { getOwnerData, saveQuestion, deleteQuestion, setBugStatus, MAX_QUESTIONS } from "@/lib/feedback/feedback.functions";

export const Route = createFileRoute("/owner")({
  head: () => ({
    meta: [
      { title: "Owner panel · Capital Crash Online" },
      { name: "description", content: "Owner panel for Capital Crash Online: feedback questions, answers, notes and bug reports." },
      { property: "og:title", content: "Owner panel · Capital Crash Online" },
      { property: "og:description", content: "Manage feedback questions and read player feedback and bug reports." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: OwnerPage,
});

type Q = { id?: string; position: number; section: "game" | "learning"; question: string; options: string[]; active: boolean };
type Data = Awaited<ReturnType<typeof getOwnerData>>;

function OwnerPage() {
  const [session, setSession] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);
  return (
    <main className="min-h-dvh bg-background text-foreground p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-extrabold">Capital Clash · Owner panel</h1>
          {session && <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => supabase.auth.signOut()}>Sign out</button>}
        </header>
        {session === null ? <p>Loading…</p> : session ? <Dashboard /> : <Login />}
      </div>
    </main>
  );
}

function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"in" | "up">("in");
  const [msg, setMsg] = useState("");
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setMsg("Please wait…");
    const res = mode === "in"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/owner` } });
    if (res.error) setMsg(res.error.message);
    else setMsg(mode === "up" ? "Check your email to confirm the account, then sign in." : "");
  };
  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-3 rounded-xl border bg-card p-6">
      <h2 className="text-lg font-bold">{mode === "in" ? "Sign in" : "Create the owner account"}</h2>
      <input className="w-full rounded-md border bg-background px-3 py-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      <input className="w-full rounded-md border bg-background px-3 py-2" type="password" placeholder="Password" minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} required />
      <button className="w-full rounded-md bg-primary px-3 py-2 font-bold text-primary-foreground">{mode === "in" ? "Sign in" : "Create account"}</button>
      <button type="button" className="w-full text-sm underline" onClick={() => setMode(mode === "in" ? "up" : "in")}>{mode === "in" ? "First time? Create the owner account" : "I already have an account"}</button>
      {msg && <p className="text-sm text-muted-foreground">{msg}</p>}
      <p className="text-xs text-muted-foreground">Only the first account created becomes the owner.</p>
    </form>
  );
}

function Dashboard() {
  const load = useServerFn(getOwnerData);
  const [data, setData] = useState<Data | null>(null);
  const [tab, setTab] = useState<"questions" | "analysis" | "notes" | "bugs">("analysis");
  const refresh = useCallback(() => { load().then(setData).catch(() => setData(null)); }, [load]);
  useEffect(() => { refresh(); }, [refresh]);
  if (!data) return <p>Loading…</p>;
  if (!data.isAdmin) return <p>This account is not the owner account.</p>;
  const tabs = [["analysis", "Answers"], ["notes", "Notes"], ["questions", "Questions"], ["bugs", `Bug reports (${data.bugs.filter((b) => b.status === "open").length})`]] as const;
  return (
    <>
      <nav className="mb-4 flex flex-wrap gap-2">
        {tabs.map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className={`rounded-full px-4 py-1.5 text-sm font-bold ${tab === k ? "bg-primary text-primary-foreground" : "border"}`}>{l}</button>
        ))}
      </nav>
      {tab === "analysis" && <Analysis data={data} />}
      {tab === "notes" && <Notes data={data} />}
      {tab === "questions" && <Questions data={data} onChange={refresh} />}
      {tab === "bugs" && <Bugs data={data} onChange={refresh} />}
    </>
  );
}

function Analysis({ data }: { data: Data }) {
  const answers = data.responses.map((r) => (r.answers ?? {}) as Record<string, string>);
  return (
    <section className="space-y-4">
      <p className="text-sm text-muted-foreground">{data.responses.length} feedback forms received.</p>
      {data.questions.map((q) => {
        const counts = q.options.map((o) => answers.filter((a) => a[q.id] === o).length);
        const total = counts.reduce((a, b) => a + b, 0);
        return (
          <div key={q.id} className="rounded-xl border bg-card p-4">
            <p className="font-bold">{q.position}. {q.question} <span className="text-xs text-muted-foreground">({q.section === "game" ? "The game" : "Learning"}{q.active ? "" : ", hidden"})</span></p>
            <p className="mb-2 text-xs text-muted-foreground">{total} answers</p>
            {q.options.map((o, i) => {
              const pct = total ? Math.round((100 * (counts[i] ?? 0)) / total) : 0;
              return (
                <div key={o} className="mb-1">
                  <div className="flex justify-between text-sm"><span>{o}</span><span>{counts[i]} · {pct}%</span></div>
                  <div className="h-2 rounded bg-muted"><div className="h-2 rounded bg-primary" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        );
      })}
    </section>
  );
}

function Notes({ data }: { data: Data }) {
  const notes = data.responses.filter((r) => r.notes);
  if (!notes.length) return <p>No notes yet.</p>;
  return (
    <ul className="space-y-3">
      {notes.map((r) => (
        <li key={r.id} className="rounded-xl border bg-card p-4">
          <p className="whitespace-pre-wrap">{r.notes}</p>
          <p className="mt-2 text-xs text-muted-foreground">{r.player_name || "Anonymous"} · {r.game_mode || "-"} · {new Date(r.created_at).toLocaleString()}</p>
        </li>
      ))}
    </ul>
  );
}

function Questions({ data, onChange }: { data: Data; onChange: () => void }) {
  const save = useServerFn(saveQuestion);
  const del = useServerFn(deleteQuestion);
  const [err, setErr] = useState("");
  const rows: Q[] = useMemo(() => data.questions.map((q) => ({ id: q.id, position: q.position, section: q.section as Q["section"], question: q.question, options: q.options, active: q.active })), [data]);
  const run = async (p: Promise<unknown>) => { setErr(""); try { await p; onChange(); } catch (e) { setErr(e instanceof Error ? e.message : "Failed"); } };
  return (
    <section className="space-y-3">
      <p className="text-sm text-muted-foreground">Up to {MAX_QUESTIONS} questions. Players only see the questions that are switched on.</p>
      {err && <p className="text-sm text-destructive">{err}</p>}
      {rows.map((q) => <QuestionEditor key={q.id} initial={q} onSave={(v) => run(save({ data: v }))} onDelete={() => run(del({ data: { id: q.id! } }))} />)}
      {rows.length < MAX_QUESTIONS && (
        <QuestionEditor key={`new-${rows.length}`} initial={{ position: rows.length + 1, section: "game", question: "", options: ["", ""], active: true }} onSave={(v) => run(save({ data: v }))} />
      )}
    </section>
  );
}

function QuestionEditor({ initial, onSave, onDelete }: { initial: Q; onSave: (q: Q) => void; onDelete?: () => void }) {
  const [q, setQ] = useState<Q>(initial);
  const set = (p: Partial<Q>) => setQ({ ...q, ...p });
  return (
    <div className="space-y-2 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold">{initial.id ? `Question ${q.position}` : "New question"}</span>
        <input type="number" min={1} max={MAX_QUESTIONS} className="w-16 rounded border bg-background px-2 py-1 text-sm" value={q.position} onChange={(e) => set({ position: Number(e.target.value) })} aria-label="Order" />
        <select className="rounded border bg-background px-2 py-1 text-sm" value={q.section} onChange={(e) => set({ section: e.target.value as Q["section"] })}>
          <option value="game">The game</option><option value="learning">What they learned</option>
        </select>
        <label className="flex items-center gap-1 text-sm"><input type="checkbox" checked={q.active} onChange={(e) => set({ active: e.target.checked })} /> Shown to players</label>
      </div>
      <input className="w-full rounded border bg-background px-3 py-2" placeholder="Question" value={q.question} onChange={(e) => set({ question: e.target.value })} />
      <div className="flex flex-wrap gap-2">
        {q.options.map((o, i) => (
          <div key={i} className="flex items-center gap-1">
            <input className="w-40 rounded border bg-background px-2 py-1 text-sm" placeholder={`Answer ${i + 1}`} value={o} onChange={(e) => set({ options: q.options.map((x, j) => (j === i ? e.target.value : x)) })} />
            {q.options.length > 2 && <button className="text-sm" onClick={() => set({ options: q.options.filter((_, j) => j !== i) })} aria-label="Remove answer">×</button>}
          </div>
        ))}
        {q.options.length < 6 && <button className="rounded border px-2 py-1 text-sm" onClick={() => set({ options: [...q.options, ""] })}>+ Answer</button>}
      </div>
      <div className="flex gap-2">
        <button className="rounded-md bg-primary px-3 py-1.5 text-sm font-bold text-primary-foreground" onClick={() => onSave(q)}>{initial.id ? "Save" : "Add question"}</button>
        {onDelete && <button className="rounded-md border px-3 py-1.5 text-sm" onClick={() => { if (confirm("Delete this question?")) onDelete(); }}>Delete</button>}
      </div>
    </div>
  );
}

function Bugs({ data, onChange }: { data: Data; onChange: () => void }) {
  const setStatus = useServerFn(setBugStatus);
  if (!data.bugs.length) return <p>No bug reports yet.</p>;
  return (
    <ul className="space-y-3">
      {data.bugs.map((b) => (
        <li key={b.id} className="rounded-xl border bg-card p-4">
          <div className="flex items-start justify-between gap-3">
            <p className="whitespace-pre-wrap">{b.description}</p>
            <button className="shrink-0 rounded-md border px-3 py-1 text-sm" onClick={() => setStatus({ data: { id: b.id, status: b.status === "open" ? "resolved" : "open" } }).then(onChange)}>
              {b.status === "open" ? "Mark resolved" : "Reopen"}
            </button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{b.status.toUpperCase()} · {b.player_name || "Anonymous"} · {b.game_mode || "-"} · {new Date(b.created_at).toLocaleString()}</p>
          {b.browser && <p className="text-xs text-muted-foreground">{b.browser}</p>}
        </li>
      ))}
    </ul>
  );
}
