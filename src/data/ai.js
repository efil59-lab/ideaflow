// AI helpers — both go through /api/ai (server-side key).
// Enrichment uses Haiku (fast+cheap, runs on every capture); chat uses Sonnet.

async function callAI({ model, system, messages, max_tokens }) {
  const res = await fetch("/api/ai", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ model, system, messages, max_tokens }),
  });
  if (!res.ok) throw new Error(`ai ${res.status}`);
  const d = await res.json();
  if (d.error) throw new Error(d.error.message || "ai error");
  return (d.content || []).map(b => b.text || "").join("");
}

// Auto title + tags + project suggestion for a newly captured idea.
export async function enrichIdea(text, projectNames) {
  const raw = await callAI({
    model: "claude-haiku-4-5",
    max_tokens: 250,
    system: 'אתה מסווג רעיונות. החזר JSON בלבד, בלי טקסט נוסף: {"title": "כותרת קצרה עד 5 מילים בעברית", "tags": ["עד 2 תגיות קצרות"], "project": "השם המדויק של הפרויקט המתאים ביותר מהרשימה, או null אם אף אחד לא מתאים בבירור"}',
    messages: [{
      role: "user",
      content: `פרויקטים קיימים: ${projectNames.length ? projectNames.join(", ") : "(אין)"}\n\nרעיון: ${text.slice(0, 600)}`,
    }],
  });
  const parsed = JSON.parse(raw.replace(/```json|```/g, "").trim());
  return {
    title: typeof parsed.title === "string" ? parsed.title.slice(0, 60) : "",
    tags: Array.isArray(parsed.tags) ? parsed.tags.filter(t => typeof t === "string").slice(0, 2) : [],
    project: typeof parsed.project === "string" ? parsed.project : null,
  };
}

// Free-form assistant grounded on the user's ideas.
export async function askAI(question, ideas, projects) {
  const byProject = {};
  for (const i of ideas) {
    if (i.status === "done" || i.status === "trash") continue;
    const p = projects.find(x => x.id === i.projectId);
    const key = p ? p.name : "Inbox";
    (byProject[key] = byProject[key] || []).push(i.title || i.text.slice(0, 100));
  }
  const ctx = Object.entries(byProject)
    .map(([k, arr]) => `${k}:\n${arr.map(t => "- " + t).join("\n")}`).join("\n\n");
  return callAI({
    model: "claude-sonnet-4-6",
    max_tokens: 600,
    system: "אתה עוזר אישי לניהול רעיונות. ענה בעברית, קצר וישיר, מבוסס על הרעיונות של המשתמש.",
    messages: [{ role: "user", content: `הרעיונות שלי:\n${ctx.slice(0, 6000)}\n\nשאלה: ${question}` }],
  });
}

export async function weeklyOverview(ideas, projects) {
  return askAI(
    "תן לי תמונת מצב: מה מצטבר ב-Inbox, אילו רעיונות נראים הכי שווים לקדם השבוע (עד 3), והאם יש רעיונות דומים ששווה לאחד. קצר וממוקד.",
    ideas, projects,
  );
}

// Per-idea AI actions — the editor's "turn this idea into something" toolbar.
// Text-only by design: the proxy has no image generation and no web access, so
// there is deliberately no "generate a design" or "search the web" action here.
const IDEA_ACTIONS = {
  improve: {
    label: "שפר ניסוח",
    system: "אתה עורך שמחדד רעיונות. שכתב את הרעיון בעברית, ברור וממוקד, באותו אורך בערך. שמור על הכוונה המקורית. החזר רק את הטקסט המשוכתב, בלי הקדמה.",
  },
  expand: {
    label: "הרחב",
    system: "אתה מפתח רעיונות. הרחב את הרעיון בעברית לפסקה קצרה ועוד 3-5 נקודות מפתח מעשיות. החזר רק את התוכן, בלי הקדמה.",
  },
  tasks: {
    label: "הפוך למשימות",
    system: "אתה מפרק רעיונות לביצוע. החזר בעברית רשימת משימות קצרה (3-6 פריטים), כל שורה מתחילה ב-'• '. בלי הקדמה ובלי סיכום.",
  },
  angles: {
    label: "זוויות נוספות",
    system: "אתה שותף לחשיבה. הצע בעברית 3 כיוונים או וריאציות מעניינות לרעיון, כל אחד בשורה שמתחילה ב-'• ', משפט אחד כל אחד. בלי הקדמה.",
  },
};

export const IDEA_ACTION_LIST = Object.entries(IDEA_ACTIONS).map(([id, a]) => ({ id, label: a.label }));

export async function ideaAction(kind, text) {
  const a = IDEA_ACTIONS[kind];
  if (!a) throw new Error("unknown action");
  return callAI({
    model: "claude-sonnet-4-6",
    max_tokens: 700,
    system: a.system,
    messages: [{ role: "user", content: text.slice(0, 4000) }],
  });
}
