// IdeaFlow v5 — capture-first idea manager. Firestore + Storage + woven AI.
import { useState, useEffect, useRef } from "react";
import { auth, googleProvider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getTheme, FONT } from "./theme";
import { useIdeas, useProjects, addIdea, updateIdea, deleteIdea, reorderIdeas, addProject, updateProject, deleteProject } from "./data/store";
import { migrateIfNeeded } from "./data/migrate";
import { enrichIdea } from "./data/ai";
import { enablePush } from "./push";
import { Icon, IconBtn } from "./ui/Icons";
import { Modal, Toast } from "./ui/base";
import { ShareModal, MoveSheet, ReminderSheet } from "./ui/sheets";
import Editor from "./ui/Editor";
import Inbox from "./screens/Inbox";
import Projects from "./screens/Projects";
import Search from "./screens/Search";
import Assistant from "./screens/Assistant";

export default function App() {
  const [user, setUser] = useState(undefined);
  const [dark, setDark] = useState(() => localStorage.getItem("if_dark") === "1");
  const th = getTheme(dark);

  useEffect(() => onAuthStateChanged(auth, u => setUser(u || null)), []);
  useEffect(() => { localStorage.setItem("if_dark", dark ? "1" : "0"); }, [dark]);

  // Dev-only UI preview (no auth): npm run dev → /?uipreview
  // Statically stripped from production builds.
  if (import.meta.env.DEV && new URLSearchParams(location.search).has("uipreview")) {
    return <Shell user={{ uid: "demo", displayName: "תצוגה מקדימה", email: "demo@local", photoURL: null }}
      dark={dark} setDark={setDark} th={th} />;
  }

  if (user === undefined) return <Splash th={th} />;
  if (!user) return <Login th={th} />;
  return <Shell user={user} dark={dark} setDark={setDark} th={th} />;
}

function Splash({ th, text }) {
  return (
    <div style={{ minHeight: "100vh", background: th.bg, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 14, fontFamily: FONT }}>
      <Icon name="bulb" size={44} color={th.accent} />
      {text && <p style={{ color: th.secondary, fontSize: 14, margin: 0 }}>{text}</p>}
    </div>
  );
}

function Login({ th }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const login = async () => {
    setLoading(true); setError(null);
    try { await signInWithPopup(auth, googleProvider); }
    catch { setError("שגיאה בהתחברות. נסה שוב."); }
    setLoading(false);
  };
  return (
    <div style={{ minHeight: "100vh", background: th.bg, display: "flex",
      alignItems: "center", justifyContent: "center", padding: 24, fontFamily: FONT, direction: "rtl" }}>
      <div style={{ background: th.surface, borderRadius: 20, padding: 36, maxWidth: 350, width: "100%",
        textAlign: "center", border: `1px solid ${th.border}` }}>
        <Icon name="bulb" size={44} color={th.accent} />
        <h1 style={{ margin: "12px 0 6px", fontSize: 26, fontWeight: 800, color: th.text }}>IdeaFlow</h1>
        <p style={{ margin: "0 0 26px", fontSize: 14, color: th.secondary, lineHeight: 1.6 }}>
          תפוס כל רעיון ברגע שהוא עולה
        </p>
        <button onClick={login} disabled={loading}
          style={{ width: "100%", padding: "13px 0", borderRadius: 12,
            background: th.surface, border: `1px solid ${th.borderStrong}`,
            cursor: loading ? "default" : "pointer", fontSize: 15, fontWeight: 600, color: th.text,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 10, fontFamily: FONT }}>
          {loading ? <span style={{ color: th.muted }}>מתחבר...</span> : <>
            <svg width="19" height="19" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            התחבר עם Google
          </>}
        </button>
        {error && <p style={{ margin: "14px 0 0", fontSize: 13, color: th.red }}>{error}</p>}
      </div>
    </div>
  );
}

function Shell({ user, dark, setDark, th }) {
  const uid = user.uid;
  const [migrating, setMigrating] = useState(true);
  const [migMsg, setMigMsg] = useState("");
  const [tab, setTab] = useState("inbox");
  const [openProjectId, setOpenProjectId] = useState(null);
  const [editIdea, setEditIdea] = useState(null);
  const [shareIdea, setShareIdea] = useState(null);
  const [moveIdea, setMoveIdea] = useState(null);
  const [remindIdea, setRemindIdea] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [showAI, setShowAI] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [toast, setToast] = useState(null);

  const ideas = useIdeas(migrating ? null : uid);
  const projects = useProjects(migrating ? null : uid);

  const toast$ = m => { setToast(m); setTimeout(() => setToast(null), 1700); };

  // One-time migration gate, then SW + push
  useEffect(() => {
    if (import.meta.env.DEV && uid === "demo") { setMigrating(false); return; }
    let done = false;
    const finish = () => { if (!done) { done = true; setMigrating(false); } };
    // Safety valve: never keep the user staring at a splash — if migration is
    // slow (many images), let the UI open and the writes finish in background.
    const t = setTimeout(finish, 12000);
    migrateIfNeeded(uid, setMigMsg)
      .then(did => { if (did) toast$("הנתונים שלך עברו בהצלחה"); })
      .catch(e => console.warn("migration:", e))
      .finally(() => { clearTimeout(t); finish(); });
    return () => clearTimeout(t);
  }, [uid]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
    if ("Notification" in window && Notification.permission === "granted") enablePush(uid);
  }, [uid]);

  useEffect(() => {
    const key = `if_guide_${uid}`;
    if (!migrating && !localStorage.getItem(key)) { setShowGuide(true); localStorage.setItem(key, "1"); }
  }, [uid, migrating]);

  // Purge trash older than 30 days — once per session, best-effort.
  const purgedRef = useRef(false);
  useEffect(() => {
    if (!ideas || purgedRef.current) return;
    purgedRef.current = true;
    const cutoff = Date.now() - 30 * 86400e3;
    ideas.filter(i => i.status === "trash" && (i.deletedAt || 0) < cutoff)
      .forEach(i => deleteIdea(uid, i).catch(() => {}));
  }, [ideas, uid]);

  // Deep link from a notification: /?idea=<id> (cold start) or an SW message
  // (app already open) opens that idea's editor.
  const [pendingIdeaId, setPendingIdeaId] = useState(
    () => new URLSearchParams(location.search).get("idea"));
  useEffect(() => {
    const onMsg = e => {
      if (e.data?.type !== "OPEN_URL") return;
      try {
        const id = new URL(e.data.url, location.origin).searchParams.get("idea");
        if (id) setPendingIdeaId(id);
      } catch { /* malformed url */ }
    };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => navigator.serviceWorker?.removeEventListener("message", onMsg);
  }, []);
  useEffect(() => {
    if (!pendingIdeaId || !ideas) return;
    const idea = ideas.find(i => i.id === pendingIdeaId);
    setPendingIdeaId(null);
    try { history.replaceState({ ifApp: true }, "", location.pathname); } catch { /* ignore */ }
    if (idea) setEditIdea(idea);
  }, [pendingIdeaId, ideas]);

  // Android back button: close the topmost layer instead of leaving the app;
  // at the root, require a double-press to actually exit.
  const uiRef = useRef({});
  useEffect(() => {
    uiRef.current = { showGuide, showUser, showAI, remindIdea, moveIdea, shareIdea, editIdea, openProjectId, tab };
  });
  const lastBackRef = useRef(0);
  useEffect(() => {
    // Re-arm the history sentinel whenever the app becomes visible again —
    // after a double-back exit Android resumes the same page with the
    // sentinel already consumed, which used to kill the exit-confirm feature.
    const arm = () => {
      try { if (!history.state?.ifApp) history.pushState({ ifApp: true }, ""); } catch { /* ignore */ }
    };
    arm();
    const onVis = () => { if (document.visibilityState === "visible") arm(); };
    window.addEventListener("pageshow", arm);
    document.addEventListener("visibilitychange", onVis);
    const onPop = () => {
      const s = uiRef.current;
      let handled = true;
      if (s.showGuide) setShowGuide(false);
      else if (s.showUser) setShowUser(false);
      else if (s.showAI) setShowAI(false);
      else if (s.remindIdea) setRemindIdea(null);
      else if (s.moveIdea) setMoveIdea(null);
      else if (s.shareIdea) setShareIdea(null);
      else if (s.editIdea) setEditIdea(null);
      else if (s.openProjectId) setOpenProjectId(null);
      else if (s.tab !== "inbox") setTab("inbox");
      else handled = false;

      if (handled) {
        history.pushState({ ifApp: true }, "");
      } else if (Date.now() - lastBackRef.current < 2000) {
        history.back(); // second press within 2s — really leave
      } else {
        lastBackRef.current = Date.now();
        setToast("לחץ שוב כדי לצאת");
        setTimeout(() => setToast(null), 1700);
        history.pushState({ ifApp: true }, "");
      }
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("pageshow", arm);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  if (migrating || !ideas || !projects) return <Splash th={th} text={migMsg || "טוען..."} />;

  // Capture: save instantly, enrich in the background.
  const capture = async (data) => {
    const idea = await addIdea(uid, data);
    toast$("נשמר");
    if (idea.text) {
      enrichIdea(idea.text, projects.map(p => p.name)).then(en => {
        const match = en.project ? projects.find(p => p.name === en.project) : null;
        updateIdea(uid, idea.id, {
          title: en.title, tags: en.tags,
          aiProject: (!data.projectId && match) ? match.id : null,
        }).catch(() => {});
      }).catch(() => {});
    }
    if (data.remindAt && data.remindAt > Date.now()) enablePush(uid);
  };

  const actions = {
    update: (id, patch, base) => updateIdea(uid, id, patch, base),
    // Soft delete → trash (recoverable, auto-purged after 30 days)
    remove: async (idea) => {
      await updateIdea(uid, idea.id, {
        status: "trash", deletedAt: Date.now(), remindAt: null, aiProject: null, pinned: false,
      }, idea);
      toast$("הועבר לפח האשפה");
    },
    restore: async (idea) => {
      await updateIdea(uid, idea.id, {
        status: idea.projectId ? "active" : "inbox", deletedAt: null,
      }, idea);
      toast$("שוחזר");
    },
    destroy: async (idea) => { await deleteIdea(uid, idea); toast$("נמחק לצמיתות"); },
    edit: idea => setEditIdea(idea),
    share: idea => setShareIdea(idea),
    move: idea => setMoveIdea(idea),
    remind: idea => setRemindIdea(idea),
    reorder: ids => reorderIdeas(uid, ids).catch(e => console.warn("reorder:", e)),
    tag: t => { setSearchQ(t); setTab("search"); },
    openProject: pid => { setOpenProjectId(pid); setTab("projects"); },
  };

  const projActions = {
    add: async name => { const id = await addProject(uid, name, projects.length); setOpenProjectId(id); },
    update: (id, patch) => updateProject(uid, id, patch),
    remove: id => deleteProject(uid, id, ideas),
  };

  const saveEdit = async (data) => {
    await updateIdea(uid, editIdea.id, data, editIdea);
    if (data.remindAt && data.remindAt > Date.now()) enablePush(uid);
    setEditIdea(null);
    toast$("נשמר");
  };

  const inboxCount = ideas.filter(i => i.status === "inbox" && !i.projectId).length;

  const navItems = [
    { id: "inbox", icon: "inbox", label: "Inbox", badge: inboxCount },
    { id: "projects", icon: "folder", label: "פרויקטים" },
    { id: "search", icon: "search", label: "חיפוש" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: th.bg, fontFamily: FONT, direction: "rtl" }}>
      {/* Header */}
      <div style={{ position: "sticky", top: 0, zIndex: 100, background: th.bg,
        borderBottom: `1px solid ${th.border}` }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 8 }}>
          <span onClick={() => setShowGuide(true)}
            style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", userSelect: "none" }}>
            <Icon name="bulb" size={22} color={th.accent} />
            <span style={{ fontSize: 17, fontWeight: 800, color: th.text }}>IdeaFlow</span>
          </span>
          <div style={{ marginRight: "auto", display: "flex", gap: 5 }}>
            <IconBtn name="sparkle" onClick={() => setShowAI(true)} color={th.accent} bg={th.accentSoft} size={17} pad="8px" />
            <IconBtn name={dark ? "sun" : "moon"} onClick={() => setDark(d => !d)} color={th.secondary} bg={th.surface} size={17} pad="8px"
              style={{ border: `1px solid ${th.border}` }} />
            <button onClick={() => setShowUser(true)}
              style={{ width: 33, height: 33, borderRadius: "50%", border: `1px solid ${th.border}`,
                background: th.surface, cursor: "pointer", overflow: "hidden", padding: 0 }}>
              {user.photoURL
                ? <img src={user.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <Icon name="logout" size={15} color={th.secondary} />}
            </button>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "14px 14px 90px" }}>
        {tab === "inbox" && (
          <Inbox uid={uid} ideas={ideas} projects={projects} th={th} actions={actions} onCapture={capture} />
        )}
        {tab === "projects" && (
          <Projects uid={uid} ideas={ideas} projects={projects} th={th} actions={actions}
            projActions={projActions} onCapture={capture}
            openProjectId={openProjectId} setOpenProjectId={setOpenProjectId} />
        )}
        {tab === "search" && (
          <Search ideas={ideas} projects={projects} th={th} actions={actions}
            q={searchQ} setQ={setSearchQ} />
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: th.surface, borderTop: `1px solid ${th.border}` }}>
        <div style={{ maxWidth: 560, margin: "0 auto", display: "flex",
          padding: "6px 8px calc(6px + env(safe-area-inset-bottom))" }}>
          {navItems.map(n => {
            const active = tab === n.id;
            return (
              <button key={n.id} onClick={() => { setTab(n.id); if (n.id === "projects") setOpenProjectId(null); }}
                style={{ flex: 1, background: "transparent", border: "none", cursor: "pointer",
                  display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
                  padding: "5px 0", position: "relative", fontFamily: FONT }}>
                <span style={{ position: "relative" }}>
                  <Icon name={n.icon} size={21} color={active ? th.accent : th.muted} />
                  {n.badge > 0 && (
                    <span style={{ position: "absolute", top: -4, left: -10, background: th.accent,
                      color: "#fff", fontSize: 9.5, fontWeight: 700, borderRadius: 9,
                      minWidth: 15, height: 15, padding: "0 4px",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {n.badge}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 10.5, fontWeight: active ? 600 : 400,
                  color: active ? th.accent : th.muted }}>{n.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {toast && <Toast msg={toast} th={th} />}
      {editIdea && (
        <Editor uid={uid} title="עריכה" initial={editIdea} projects={projects}
          onSave={saveEdit}
          onAutosave={data => updateIdea(uid, editIdea.id, data).catch(() => {})}
          onClose={() => setEditIdea(null)} th={th} />
      )}
      {shareIdea && <ShareModal idea={shareIdea} onClose={() => setShareIdea(null)} th={th} />}
      {remindIdea && (
        <ReminderSheet idea={remindIdea} th={th}
          onSave={async ts => {
            await updateIdea(uid, remindIdea.id, { remindAt: ts }, remindIdea);
            if (ts) enablePush(uid);
            setRemindIdea(null);
            toast$(ts ? "תזכורת נקבעה" : "התזכורת הוסרה");
          }}
          onClose={() => setRemindIdea(null)} />
      )}
      {moveIdea && (
        <MoveSheet idea={moveIdea} projects={projects} th={th}
          onMove={async pid => {
            await updateIdea(uid, moveIdea.id, {
              projectId: pid, aiProject: null,
              status: moveIdea.status === "done" ? "done" : (pid ? "active" : "inbox"),
            });
            setMoveIdea(null); toast$(pid ? "הועבר" : "הוחזר ל-Inbox");
          }}
          onNewProject={async () => {
            const name = prompt("שם הפרויקט החדש:");
            if (!name?.trim()) return;
            const pid = await addProject(uid, name.trim(), projects.length);
            await updateIdea(uid, moveIdea.id, { projectId: pid, aiProject: null, status: "active" }, moveIdea);
            setMoveIdea(null); toast$("הועבר");
          }}
          onClose={() => setMoveIdea(null)} />
      )}
      {showAI && <Assistant ideas={ideas} projects={projects} onClose={() => setShowAI(false)} th={th} />}
      {showUser && (
        <Modal onClose={() => setShowUser(false)} maxWidth={300} th={th}>
          <div style={{ textAlign: "center" }}>
            {user.photoURL && <img src={user.photoURL} alt="" style={{ width: 54, height: 54, borderRadius: "50%", marginBottom: 10 }} />}
            <div style={{ fontSize: 15, fontWeight: 600, color: th.text }}>{user.displayName}</div>
            <div style={{ fontSize: 13, color: th.muted, marginBottom: 18 }}>{user.email}</div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => setShowUser(false)}
                style={{ flex: 1, height: 42, background: th.surface2, color: th.text,
                  border: `1px solid ${th.border}`, borderRadius: 11, cursor: "pointer",
                  fontSize: 14, fontWeight: 500, fontFamily: FONT }}>סגור</button>
              <button onClick={() => { signOut(auth); setShowUser(false); }}
                style={{ flex: 1, height: 42, background: th.red, color: "#fff",
                  border: "none", borderRadius: 11, cursor: "pointer",
                  fontSize: 14, fontWeight: 600, fontFamily: FONT }}>התנתק</button>
            </div>
          </div>
        </Modal>
      )}
      {showGuide && <Guide onClose={() => setShowGuide(false)} th={th} />}
    </div>
  );
}

function Guide({ onClose, th }) {
  const items = [
    { icon: "bulb", title: "תפוס רעיון", text: "מסך הבית נפתח על שדה כתיבה. כתוב, צלם או הקלט — והפסק להקליד: אחרי 5 שניות הרעיון נשמר לבד (או לחץ שמור). עובד גם בלי אינטרנט." },
    { icon: "sparkle", title: "ה-AI עובד בשבילך", text: "כל רעיון מקבל אוטומטית כותרת ותגיות, וכשמתאים — הצעה לאיזה פרויקט להעביר. לחיצה אחת ומוין." },
    { icon: "inbox", title: "Inbox → פרויקטים", text: "רעיון חדש לא דורש החלטות. מיינו אחר-כך: אייקון התיקייה 📁 בשורת הכרטיס פותח את רשימת הפרויקטים — בחר ומוין." },
    { icon: "folder", title: "פרויקטים", text: "בתוך פרויקט אפשר לתפוס רעיון ישירות אליו, לנהל הערות, ולראות מה בוצע." },
    { icon: "bell", title: "תזכורות אמיתיות", text: "לחץ על הפעמון בשורת הכרטיס — בחירה מהירה (בעוד שעה / הערב / מחר) או זמן מדויק. ההתראה תגיע גם כשהאפליקציה סגורה." },
    { icon: "edit", title: "עריכה בלחיצה", text: "פשוט לחץ על הטקסט של רעיון — נפתח עורך מלא עם עיצוב (מודגש, צבעים), פרויקט ותזכורת. טקסט ארוך? \"המשך...\" פורש אותו." },
    { icon: "tag", title: "תגיות", text: "ה-AI מתייג כל רעיון אוטומטית. לחיצה על תגית מציגה את כל הרעיונות עם אותה תגית." },
    { icon: "delete", title: "פח אשפה", text: "מחיקה מעבירה לפח (בתחתית מסך הפרויקטים) — אפשר לשחזר עד 30 יום, ואז הוא מתרוקן לבד." },
    { icon: "search", title: "חיפוש גלובלי", text: "חיפוש בכל הפרויקטים, כולל כותרות ותגיות." },
    { icon: "sparkle", title: "עוזר AI", text: "כפתור הניצוץ למעלה: תמונת מצב שבועית, מה דחוף, ואיחוד רעיונות דומים." },
  ];
  return (
    <Modal onClose={onClose} th={th}>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <Icon name="bulb" size={36} color={th.accent} />
        <h3 style={{ margin: "8px 0 2px", fontSize: 19, fontWeight: 800, color: th.text }}>ברוך הבא ל-IdeaFlow 5</h3>
        <p style={{ margin: 0, fontSize: 13, color: th.muted }}>נבנה מחדש סביב דבר אחד: לתפוס רעיונות בלי חיכוך</p>
      </div>
      {items.map((it, i) => (
        <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 11,
          padding: "10px 0", borderBottom: i < items.length - 1 ? `1px solid ${th.border}` : "none" }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: th.accentSoft,
            display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
            <Icon name={it.icon} size={16} color={th.accentText} />
          </div>
          <div style={{ flex: 1, fontSize: 13, color: th.text, lineHeight: 1.6, textAlign: "right" }}>
            <strong style={{ fontWeight: 600 }}>{it.title}: </strong>
            <span style={{ color: th.secondary }}>{it.text}</span>
          </div>
        </div>
      ))}
      <button onClick={onClose}
        style={{ width: "100%", marginTop: 14, height: 44, background: th.accent, color: "#fff",
          border: "none", borderRadius: 12, cursor: "pointer",
          fontSize: 15, fontWeight: 700, fontFamily: FONT }}>
        בוא נתחיל
      </button>
    </Modal>
  );
}
