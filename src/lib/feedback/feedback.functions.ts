import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const MAX_QUESTIONS = 10;

/* ---------- Public: used by the game ---------- */

export const getFeedbackQuestions = createServerFn({ method: "GET" }).handler(async () => {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("feedback_questions")
    .select("id, section, question, options")
    .eq("active", true)
    .order("position")
    .limit(MAX_QUESTIONS);
  if (error) throw new Error("Could not load questions");
  return data ?? [];
});

const ResponseSchema = z.object({
  answers: z.record(z.string().min(1).max(300), z.string().max(200)),
  notes: z.string().max(2000),
  playerName: z.string().max(40),
  gameMode: z.string().max(40),
});

export const submitFeedback = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => ResponseSchema.parse(d))
  .handler(async ({ data }) => {
    if (!Object.keys(data.answers).length && !data.notes.trim()) throw new Error("Empty feedback");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("feedback_responses").insert({
      answers: data.answers,
      notes: data.notes.trim() || null,
      player_name: data.playerName || null,
      game_mode: data.gameMode || null,
    });
    if (error) throw new Error("Could not save feedback");
    return { ok: true };
  });

const BugSchema = z.object({
  description: z.string().min(5).max(2000),
  playerName: z.string().max(40),
  gameMode: z.string().max(40),
  browser: z.string().max(300),
});

export const submitBugReport = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => BugSchema.parse(d))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("bug_reports").insert({
      description: data.description,
      player_name: data.playerName || null,
      game_mode: data.gameMode || null,
      browser: data.browser || null,
    });
    if (error) throw new Error("Could not save bug report");
    return { ok: true };
  });

/* ---------- Owner panel (signed-in admin only; RLS enforces admin) ---------- */

export const getOwnerData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const sb = context.supabase;
    const { data: isAdmin } = await sb.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    if (!isAdmin) return { isAdmin: false as const, questions: [], responses: [], bugs: [] };
    const [q, r, b] = await Promise.all([
      sb.from("feedback_questions").select("*").order("position"),
      sb.from("feedback_responses").select("*").order("created_at", { ascending: false }).limit(1000),
      sb.from("bug_reports").select("*").order("created_at", { ascending: false }).limit(500),
    ]);
    return { isAdmin: true as const, questions: q.data ?? [], responses: r.data ?? [], bugs: b.data ?? [] };
  });

const QuestionSchema = z.object({
  id: z.string().uuid().optional(),
  position: z.number().int().min(1).max(MAX_QUESTIONS),
  section: z.enum(["game", "learning"]),
  question: z.string().trim().min(3).max(300),
  options: z.array(z.string().trim().min(1).max(100)).min(2).max(6),
  active: z.boolean(),
});

export const saveQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => QuestionSchema.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    if (!data.id) {
      const { count } = await sb.from("feedback_questions").select("id", { count: "exact", head: true });
      if ((count ?? 0) >= MAX_QUESTIONS) throw new Error(`At most ${MAX_QUESTIONS} questions`);
    }
    const row = { position: data.position, section: data.section, question: data.question, options: data.options, active: data.active };
    const { error } = data.id
      ? await sb.from("feedback_questions").update(row).eq("id", data.id)
      : await sb.from("feedback_questions").insert(row);
    if (error) throw new Error("Could not save question");
    return { ok: true };
  });

export const deleteQuestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("feedback_questions").delete().eq("id", data.id);
    if (error) throw new Error("Could not delete question");
    return { ok: true };
  });

export const setBugStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => z.object({ id: z.string().uuid(), status: z.enum(["open", "resolved"]) }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("bug_reports").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error("Could not update bug");
    return { ok: true };
  });
