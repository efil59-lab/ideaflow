// IdeaFlow v5 — capture-first idea manager. Firestore + Storage + woven AI.
import { useState, useEffect, useRef } from "react";
import { auth, googleProvider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getTheme, FONT } from "./theme";
import {
  useIdeas, useProjects, addIdea, updateIdea, deleteIdea, reorderIdeas,
  addProject, updateProject, deleteProject, reorderProjects, guideNotSeenYet,
  markVersionSeen, whatsNewNotSeenYet,
  useMyShares, useSharedWithMe, saveShare, removeShare, shareIdOf,
  addComment, addSharedIdea, queueNotification,
  useUserDoc, markCommentsSeen,
} from "./data/store";
import { migrateIfNeeded } from "./data/migrate";
import { enrichIdea } from "./data/ai";
import { exportIdeas } from "./data/export";
import { enablePush } from "./push";
import { APP_VERSION, CHANGELOG } from "./changelog";
import { Icon, IconBtn } from "./ui/Icons";
import { Modal, Toast } from "./ui/base";
import { ShareModal, MoveSheet, ReminderSheet, SnoozeSheet, CommentsSheet } from "./ui/sheets";
import Editor from "./ui/Editor";
import Inbox from "./screens/Inbox";
import Projects from "./screens/Projects";
import Search from "./screens/Search";
import Assistant from "./screens/Assistant";

// Captured at module scope — Chrome fires beforeinstallprompt very early,
// often before React mounts. We stash the event and re-announce it.
let deferredInstall = null;
window.addEventListener("beforeinstallprompt", e => {
  e.preventDefault();
  deferredInstall = e;
  window.dispatchEvent(new Event("if-installable"));
});

// Self-update: Android resumes PWAs from memory without reloading, so phones
// can run stale builds for days. Compare the served bundle hash against the
// running one whenever the app becomes visible; reload if a new deploy landed.
let lastUpdateCheck = 0;
async function reloadIfNewVersion() {
  if (Date.now() - lastUpdateCheck < 10 * 60e3) return;
  lastUpdateCheck = Date.now();
  try {
    // Don't yank the page out from under active typing
    const el = document.activeElement;
    if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
    const html = await (await fetch("/", { cache: "no-store" })).text();
    const served = html.match(/assets\/index-([\w-]+)\.js/)?.[1];
    const running = [...document.scripts].map(s => s.src).find(s => s.includes("/assets/index-"));
    if (served && running && !running.includes(served)) location.reload();
  } catch { /* offline — try again later */ }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") reloadIfNewVersion();
});
setTimeout(reloadIfNewVersion, 8000);

export default function App() {
  const [user, setUser] = useState(undefined);
  const [dark, setDark] = useState(() => localStorage.getItem("if_dark") === "1");
  const th = getTheme(dark);

  // A shortcut / share launch wants the keyboard up immediately. Android only
  // raises it for a focus() that lands while the launch tap's activation is
  // still live — so on that path we skip the splash and mount the capture box
  // on the very first paint, before the activation window lapses.
  const shortcutLaunch = useState(() => {
    try {
      const p = new URLSearchParams(location.search);
      return p.has("capture") || !!(p.get("title") || p.get("text") || p.get("url"));
    } catch { return false; }
  })[0];
  // Read once up front — the intake below strips the query string.
  const isUipreview = useState(() => {
    try { return import.meta.env.DEV && new URLSearchParams(location.search).has("uipreview"); }
    catch { return false; }
  })[0];

  // Hold the splash for a minimum beat so the light-up animation is actually
  // seen — cached auth resolves in milliseconds and used to skip right past it.
  const [bootDone, setBootDone] = useState(shortcutLaunch);
  useEffect(() => {
    if (shortcutLaunch) return;
    const t = setTimeout(() => setBootDone(true), 1500);
    return () => clearTimeout(t);
  }, [shortcutLaunch]);

  // A shortcut/share launch opens straight into the dedicated quick-capture
  // screen (mounts on first paint → best chance the keyboard rises).
  const [captureMode, setCaptureMode] = useState(shortcutLaunch);

  // Intake from Android intents (runs once, before any screen mounts):
  // - share_target: /?title=..&text=..&url=..  → becomes the capture draft
  // - app shortcut: /?capture=1                → focus the capture box
  useState(() => {
    try {
      const p = new URLSearchParams(location.search);
      const shared = [p.get("title"), p.get("text"), p.get("url")].filter(Boolean).join("\n");
      if (shared) {
        const prev = localStorage.getItem("if_draft");
        localStorage.setItem("if_draft", prev ? prev + "\n" + shared : shared);
        localStorage.setItem("if_focus_capture", "1");
        history.replaceState(null, "", location.pathname);
      } else if (p.has("capture")) {
        localStorage.setItem("if_focus_capture", "1");
        history.replaceState(null, "", location.pathname);
      }
    } catch { /* ignore */ }
    return null;
  });

  useEffect(() => onAuthStateChanged(auth, u => setUser(u || null)), []);
  useEffect(() => { localStorage.setItem("if_dark", dark ? "1" : "0"); }, [dark]);

  // Quick-capture screen — rendered before every other gate so the text field
  // exists on the first paint of the shortcut launch. `user` may still be
  // resolving; the screen waits for it only at save time.
  if (captureMode) {
    const cu = (import.meta.env.DEV && isUipreview) ? { uid: "demo" } : user;
    return <QuickCapture user={cu} th={th} onDone={() => setCaptureMode(false)} />;
  }

  // Dev-only UI preview (no auth): npm run dev → /?uipreview
  // Statically stripped from production builds.
  if (!bootDone) return <Splash th={th} />;

  // The inline import.meta.env.DEV keeps the minifier proving this branch (and
  // its demo user literal) dead in production, so it's fully stripped.
  if (import.meta.env.DEV && isUipreview) {
    return <Shell user={{ uid: "demo", displayName: "תצוגה מקדימה", email: "demo@local", photoURL: null }}
      dark={dark} setDark={setDark} th={th} />;
  }

  if (user === undefined) return <Splash th={th} />;
  if (!user) return <><Login th={th} /><InstallBanner th={th} /></>;
  return <Shell user={user} dark={dark} setDark={setDark} th={th} />;
}

// Prompts browser visitors to install the PWA. Hidden when already installed,
// snoozed politely when dismissed. Android gets Chrome's real install prompt;
// iOS gets the manual add-to-home-screen hint.
function InstallBanner({ th, hidden = false }) {
  const [evt, setEvt] = useState(deferredInstall);
  const [visible, setVisible] = useState(() => {
    try {
      const standalone = window.matchMedia("(display-mode: standalone)").matches
        || navigator.standalone === true;
      if (standalone) return false;
      return Date.now() > Number(localStorage.getItem("if_install_snooze") || 0);
    } catch { return false; }
  });
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);

  useEffect(() => {
    const onInstallable = () => setEvt(deferredInstall);
    const onInstalled = () => { deferredInstall = null; setVisible(false); };
    window.addEventListener("if-installable", onInstallable);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("if-installable", onInstallable);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (hidden || !visible || (!evt && !isIOS)) return null;

  const snooze = days => {
    try { localStorage.setItem("if_install_snooze", String(Date.now() + days * 86400e3)); } catch { /* ignore */ }
    setVisible(false);
  };

  const install = async () => {
    if (!evt) return;
    evt.prompt();
    try {
      const { outcome } = await evt.userChoice;
      deferredInstall = null;
      setEvt(null);
      if (outcome === "accepted") setVisible(false);
      else snooze(3);
    } catch { snooze(3); }
  };

  return (
    <div style={{ position: "fixed", bottom: "calc(66px + env(safe-area-inset-bottom))",
      left: 12, right: 12, zIndex: 500, display: "flex", justifyContent: "center" }}>
      <div style={{ maxWidth: 536, width: "100%", background: th.surface,
        border: `1px solid ${th.border}`, borderRadius: 14, padding: "10px 12px",
        display: "flex", alignItems: "center", gap: 10, direction: "rtl",
        boxShadow: "0 4px 18px rgba(0,0,0,0.14)", animation: "fadeUp .25s ease-out" }}>
        <Icon name="bulb" size={20} color={th.accent} />
        <span style={{ flex: 1, fontSize: 12.5, color: th.text, lineHeight: 1.45, fontFamily: FONT }}>
          {(isIOS && !evt)
            ? <>להתקנה: כפתור השיתוף בספארי ← <b>הוסף למסך הבית</b></>
            : "התקן את IdeaFlow במסך הבית — התראות, קיצור מהיר ושיתוף מכל אפליקציה"}
        </span>
        {evt && (
          <button onClick={install}
            style={{ background: th.accent, color: "#fff", border: "none", borderRadius: 9,
              padding: "7px 14px", fontSize: 12.5, fontWeight: 600, fontFamily: FONT,
              cursor: "pointer", flexShrink: 0 }}>
            התקן
          </button>
        )}
        <IconBtn name="close" onClick={() => snooze(7)} color={th.muted} size={13} pad="5px" />
      </div>
    </div>
  );
}

// still=true renders the final frame with no animation — used by loading
// states that follow the animated boot splash, so the light-up never replays.
function Splash({ th, text, still = false }) {
  return (
    <div style={{ minHeight: "100vh", background: th.bg, display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center", gap: 18, fontFamily: FONT }}>
      {/* The bulb "lights up": soft disc pops in, a ring ripples outward */}
      <div style={{ position: "relative", width: 88, height: 88,
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        {!still && (
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%",
            border: `2px solid ${th.accent}`,
            animation: "ringExpand 1.3s ease-out 0.35s both" }} />
        )}
        <span style={{ position: "absolute", inset: 0, borderRadius: "50%",
          background: th.accentSoft,
          animation: still ? "none" : "bulbPop 0.65s cubic-bezier(0.34,1.56,0.64,1) both" }} />
        <span style={{ position: "relative", display: "inline-flex",
          animation: still ? "none" : "bulbPop 0.65s cubic-bezier(0.34,1.56,0.64,1) 0.12s both" }}>
          <Icon name="bulb" size={40} color={th.accent} />
        </span>
      </div>
      <div style={{ textAlign: "center",
        animation: still ? "none" : "fadeUp 0.5s ease-out 0.45s both" }}>
        <span style={{ fontSize: 22, fontWeight: 800, color: th.text, letterSpacing: 0.3 }}>IdeaFlow</span>
        {text && <p style={{ color: th.secondary, fontSize: 13.5, margin: "7px 0 0" }}>{text}</p>}
      </div>
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
        textAlign: "center", border: `1px solid ${th.border}`,
        animation: "fadeUp 0.5s ease-out both" }}>
        <span style={{ display: "inline-flex", animation: "bulbPop 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.15s both" }}>
          <Icon name="bulb" size={44} color={th.accent} />
        </span>
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

// Dedicated quick-capture screen for the "רעיון חדש" app shortcut. It mounts on
// the very first paint — before auth and data load — so an autofocused field
// exists while the launch tap's activation is still live, giving Android its one
// chance to raise the soft keyboard. Saves straight to the Inbox.
function QuickCapture({ user, th, onDone }) {
  const [text, setText] = useState(() => {
    try { return localStorage.getItem("if_draft") || ""; } catch { return ""; }
  });
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const taRef = useRef();

  // Best-effort auto-focus on first paint (works only where the platform still
  // honours it). Android generally refuses to raise the soft keyboard without a
  // real touch — that's handled by focusFromTap below.
  useEffect(() => {
    try { localStorage.removeItem("if_focus_capture"); } catch { /* ignore */ }
    const tryFocus = () => {
      const el = taRef.current;
      if (!el) return;
      el.focus();
      try { const n = el.value.length; el.setSelectionRange(n, n); } catch { /* ignore */ }
      try { navigator.virtualKeyboard?.show?.(); } catch { /* unsupported */ }
    };
    const timers = [0, 100, 250, 500, 900].map(ms => setTimeout(tryFocus, ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  // The reliable path: focus (→ keyboard) inside the user's first real tap
  // anywhere on the screen. Skips taps on the buttons and taps once already
  // editing, so it never fights the caret.
  const focusFromTap = e => {
    if (document.activeElement === taRef.current) return;
    if (e.target.closest("button")) return;
    taRef.current?.focus();
    try { navigator.virtualKeyboard?.show?.(); } catch { /* unsupported */ }
  };

  // Mirror to the shared draft so nothing is lost if they back out.
  useEffect(() => {
    const t = setTimeout(() => {
      try { text.trim() ? localStorage.setItem("if_draft", text) : localStorage.removeItem("if_draft"); }
      catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [text]);

  const canSave = !!text.trim() && !!user && !saving;
  const save = async () => {
    if (!canSave) return;
    const t = text.trim();
    setSaving(true);
    try {
      const idea = await addIdea(user.uid, { text: t, status: "inbox" });
      try { localStorage.removeItem("if_draft"); } catch { /* ignore */ }
      if (idea?.text) {
        enrichIdea(idea.text, [])
          .then(en => updateIdea(user.uid, idea.id, { title: en.title, tags: en.tags }).catch(() => {}))
          .catch(() => {});
      }
      setText("");
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 1500);
      taRef.current?.focus();
    } catch { /* offline still queues the write; ignore */ }
    setSaving(false);
  };

  return (
    <div onPointerDown={focusFromTap}
      style={{ position: "fixed", inset: 0, background: th.bg, direction: "rtl", zIndex: 100,
        display: "flex", flexDirection: "column",
        padding: "16px 16px calc(16px + env(safe-area-inset-bottom))" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
        <Icon name="bulb" size={22} color={th.accent} />
        <h2 style={{ margin: 0, flex: 1, fontSize: 18, fontWeight: 800, color: th.text, fontFamily: FONT }}>
          רעיון חדש
        </h2>
        <button onClick={onDone}
          style={{ display: "inline-flex", alignItems: "center", gap: 5, background: th.surface,
            color: th.secondary, border: `1px solid ${th.border}`, borderRadius: 18,
            padding: "7px 14px", cursor: "pointer", fontSize: 13.5, fontWeight: 600, fontFamily: FONT }}>
          לאינבוקס
        </button>
      </div>
      <textarea ref={taRef} value={text} onChange={e => setText(e.target.value)} autoFocus
        inputMode="text" enterKeyHint="done"
        onKeyDown={e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) save(); }}
        placeholder="הקש כאן והתחל לכתוב…"
        style={{ flex: 1, width: "100%", boxSizing: "border-box", border: `1px solid ${th.border}`,
          borderRadius: 14, padding: 14, fontSize: 17, fontFamily: FONT, direction: "rtl",
          color: th.text, background: th.surface, lineHeight: 1.6, resize: "none", outline: "none" }} />
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 600, fontFamily: FONT,
          color: savedFlash ? th.green : th.muted }}>
          {savedFlash ? "נשמר ✓ — אפשר להוסיף עוד" : user ? "יישמר לאינבוקס" : "מתחבר…"}
        </span>
        <button onClick={save} disabled={!canSave}
          style={{ background: th.accent, color: "#fff", border: "none", borderRadius: 12,
            padding: "12px 30px", cursor: canSave ? "pointer" : "default",
            fontSize: 15.5, fontWeight: 700, fontFamily: FONT, opacity: canSave ? 1 : 0.45 }}>
          שמור
        </button>
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
  const [snoozeIdea, setSnoozeIdea] = useState(null);
  const [searchQ, setSearchQ] = useState("");
  const [showAI, setShowAI] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [toast, setToast] = useState(null);

  const ideas = useIdeas(migrating ? null : uid);
  const projects = useProjects(migrating ? null : uid);

  // Sharing
  const myEmail = (user.email || "").toLowerCase();
  const myName = user.displayName || myEmail;
  const myShares = useMyShares(migrating ? null : uid);
  const sharedWithMe = useSharedWithMe(migrating ? null : myEmail);
  // Per-project unread-comment tracking: commentSeen[projectId] = last-read ms.
  const userDoc = useUserDoc(migrating ? null : uid);
  const commentSeen = userDoc.commentSeen || {};
  // Opening a project clears its unread-comment dot.
  useEffect(() => {
    if (typeof openProjectId === "string" && openProjectId !== "__trash__"
        && !openProjectId.startsWith("share:")) {
      markCommentsSeen(uid, openProjectId).catch(() => {});
    }
  }, [openProjectId, uid]);
  // Comments context: { idea, ownerUid, share? } — share present when viewing a guest project
  const [commentsCtx, setCommentsCtx] = useState(null);

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
    if ("serviceWorker" in navigator) {
      // Force an update check every open — notification buttons come from the SW,
      // which otherwise can lag a deploy by up to a day. skipWaiting (in sw.js)
      // then activates the new version immediately for future pushes.
      navigator.serviceWorker.register("/sw.js")
        .then(reg => reg.update().catch(() => {}))
        .catch(() => {});
    }
    if ("Notification" in window && Notification.permission === "granted") enablePush(uid);
  }, [uid]);

  // Welcome guide on the user's true first open — flag lives on the user's
  // Firestore doc, so reinstalling the app or switching devices won't skip it.
  // Returning users get the what's-new dialog instead, once per version bump.
  useEffect(() => {
    if (migrating) return;
    guideNotSeenYet(uid)
      .then(firstTime => {
        if (firstTime) { setShowGuide(true); return markVersionSeen(uid); }
        return whatsNewNotSeenYet(uid).then(show => { if (show) setShowWhatsNew(true); });
      })
      .catch(() => {});
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
  const [pendingShareId, setPendingShareId] = useState(
    () => new URLSearchParams(location.search).get("share"));
  const [pendingSnoozeId, setPendingSnoozeId] = useState(
    () => new URLSearchParams(location.search).get("snooze"));
  useEffect(() => {
    const onMsg = e => {
      if (e.data?.type !== "OPEN_URL") return;
      try {
        const params = new URL(e.data.url, location.origin).searchParams;
        if (params.get("idea")) setPendingIdeaId(params.get("idea"));
        if (params.get("share")) setPendingShareId(params.get("share"));
        if (params.get("snooze")) setPendingSnoozeId(params.get("snooze"));
      } catch { /* malformed url */ }
    };
    navigator.serviceWorker?.addEventListener("message", onMsg);
    return () => navigator.serviceWorker?.removeEventListener("message", onMsg);
  }, []);
  useEffect(() => {
    if (!pendingShareId || !sharedWithMe.length) return;
    const share = sharedWithMe.find(s => s.id === pendingShareId);
    if (!share) return;
    setPendingShareId(null);
    try { history.replaceState({ ifApp: true }, "", location.pathname); } catch { /* ignore */ }
    setOpenProjectId("share:" + share.id);
    setTab("projects");
  }, [pendingShareId, sharedWithMe]);
  useEffect(() => {
    if (!pendingIdeaId || !ideas) return;
    const idea = ideas.find(i => i.id === pendingIdeaId);
    setPendingIdeaId(null);
    try { history.replaceState({ ifApp: true }, "", location.pathname); } catch { /* ignore */ }
    if (idea) setEditIdea(idea);
  }, [pendingIdeaId, ideas]);
  useEffect(() => {
    if (!pendingSnoozeId || !ideas) return;
    const idea = ideas.find(i => i.id === pendingSnoozeId);
    setPendingSnoozeId(null);
    try { history.replaceState({ ifApp: true }, "", location.pathname); } catch { /* ignore */ }
    if (idea) setSnoozeIdea(idea);
  }, [pendingSnoozeId, ideas]);

  // Android back button: close the topmost layer instead of leaving the app;
  // at the root, require a double-press to actually exit.
  const uiRef = useRef({});
  useEffect(() => {
    uiRef.current = { showGuide, showWhatsNew, showUser, showAI, remindIdea, snoozeIdea, moveIdea, shareIdea, editIdea, commentsCtx, openProjectId, tab };
  });
  const rearmRef = useRef(null);
  useEffect(() => {
    // Re-arm the history sentinel whenever the app becomes visible again —
    // after an exit Android resumes the same page with the sentinel consumed.
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
      else if (s.showWhatsNew) setShowWhatsNew(false);
      else if (s.showUser) setShowUser(false);
      else if (s.showAI) setShowAI(false);
      else if (s.commentsCtx) setCommentsCtx(null);
      else if (s.remindIdea) setRemindIdea(null);
      else if (s.snoozeIdea) setSnoozeIdea(null);
      else if (s.moveIdea) setMoveIdea(null);
      else if (s.shareIdea) setShareIdea(null);
      else if (s.editIdea) setEditIdea(null);
      else if (s.openProjectId) setOpenProjectId(null);
      else if (s.tab !== "inbox") setTab("inbox");
      else handled = false;

      if (handled) {
        history.pushState({ ifApp: true }, "");
      } else {
        // Root: show the hint and stay DISARMED — a page cannot close itself,
        // so the real exit is simply letting the next system back-press find
        // no history to consume (Android then minimizes the app). If the user
        // doesn't leave within the window, quietly re-arm.
        setToast("לחץ שוב כדי לצאת");
        setTimeout(() => setToast(null), 1700);
        clearTimeout(rearmRef.current);
        rearmRef.current = setTimeout(() => {
          if (document.visibilityState === "visible") arm();
        }, 2200);
      }
    };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("pageshow", arm);
      document.removeEventListener("visibilitychange", onVis);
      clearTimeout(rearmRef.current);
    };
  }, []);

  if (migrating || !ideas || !projects) return <Splash th={th} still text={migMsg || "טוען..."} />;

  // Capture: save instantly, enrich in the background.
  const capture = async (data) => {
    const idea = await addIdea(uid, data);
    toast$("נשמר");
    // Owner captured straight into a shared project → let the guests know
    const share = data.projectId ? myShares[data.projectId] : null;
    if (share) {
      notifyShare(share, uid, {
        title: "💡 רעיון חדש בפרויקט משותף",
        body: `${myName} הוסיף ל"${share.projectName}": ${(data.text || "").slice(0, 80)}`,
        ideaId: idea.id,
      });
    }
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
    emptyTrash: async (list) => {
      await Promise.all((list || []).map(i => deleteIdea(uid, i).catch(() => {})));
      toast$("הפח רוקן");
    },
    edit: idea => setEditIdea(idea),
    share: idea => setShareIdea(idea),
    move: idea => setMoveIdea(idea),
    remind: idea => setRemindIdea(idea),
    reorder: ids => reorderIdeas(uid, ids).catch(e => console.warn("reorder:", e)),
    tag: t => { setSearchQ(t); setTab("search"); },
    openProject: pid => { setOpenProjectId(pid); setTab("projects"); },
    exportList: async (name, list) => {
      if (!list.length) { toast$("אין רעיונות לייצוא"); return; }
      const copied = await exportIdeas(name, list);
      toast$(copied ? "הועתק ללוח והורד כקובץ — הדבק בקלוד" : "הקובץ הורד");
    },
    // Comments — on my own idea (owner side) / on an idea in a project shared with me
    comments: idea => setCommentsCtx({ idea, ownerUid: uid, share: myShares[idea.projectId] || null }),
    shareComments: (share, idea) => setCommentsCtx({ idea, ownerUid: share.ownerUid, share }),
  };

  // Notify everyone in a share except the author (owner by uid, guests by email).
  const notifyShare = (share, ownerUid, { title, body, ideaId }) => {
    if (!share) return;
    if (ownerUid !== uid) {
      queueNotification(uid, { toUid: ownerUid }, { title, body, ideaId, url: `/?idea=${ideaId}` });
    }
    for (const email of share.sharedWith || []) {
      if (email === myEmail) continue;
      queueNotification(uid, { toEmail: email }, { title, body, ideaId, url: `/?share=${share.id}` });
    }
  };

  const postComment = async (text) => {
    const { idea, ownerUid, share } = commentsCtx;
    await addComment(ownerUid, idea.id, {
      text, authorUid: uid, authorName: myName, authorEmail: myEmail,
    });
    notifyShare(share, ownerUid, {
      title: "💬 תגובה חדשה — IdeaFlow",
      body: `${myName}: ${text.slice(0, 100)}`,
      ideaId: idea.id,
    });
  };

  // Guest capture into a shared project
  const sharedCapture = async (share, data) => {
    await addSharedIdea(share.ownerUid, { ...data, projectId: share.projectId },
      { uid, name: myName, email: myEmail });
    toast$("נשמר");
    notifyShare(share, share.ownerUid, {
      title: "💡 רעיון חדש בפרויקט משותף",
      body: `${myName} הוסיף ל"${share.projectName}": ${(data.text || "").slice(0, 80)}`,
      ideaId: "shared",
    });
  };

  const shareActions = {
    save: async (project, emails) => {
      if (emails.length) {
        const prev = myShares[project.id]?.sharedWith || [];
        await saveShare(uid, project, emails, { name: myName, email: myEmail });
        // Newly invited people get a push: "X shared a project with you"
        for (const email of emails) {
          if (prev.includes(email) || email === myEmail) continue;
          queueNotification(uid, { toEmail: email }, {
            title: "📁 פרויקט שותף איתך — IdeaFlow",
            body: `${myName} שיתף איתך את "${project.name}"`,
            ideaId: "share-invite",
            url: `/?share=${shareIdOf(uid, project.id)}`,
          });
        }
        toast$("השיתוף נשמר");
      } else {
        await removeShare(uid, project.id);
        toast$("השיתוף בוטל");
      }
    },
  };

  const projActions = {
    add: async name => { const id = await addProject(uid, name, projects.length); setOpenProjectId(id); },
    update: async (id, patch) => {
      await updateProject(uid, id, patch);
      // Keep the share certificate's denormalized name/color fresh
      const share = myShares[id];
      if (share && ("name" in patch || "color" in patch)) {
        const p = projects.find(x => x.id === id);
        if (p) saveShare(uid, { ...p, ...patch }, share.sharedWith,
          { name: myName, email: myEmail }).catch(() => {});
      }
    },
    remove: id => deleteProject(uid, id, ideas),
    reorder: ids => reorderProjects(uid, ids).catch(e => console.warn("reorder projects:", e)),
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
        borderBottom: `1px solid ${th.border}`,
        animation: "fadeDown 0.55s ease-out both" }}>
        <div style={{ maxWidth: 560, margin: "0 auto", padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 8 }}>
          <span onClick={() => setShowGuide(true)}
            style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", userSelect: "none" }}>
            <Icon name="bulb" size={22} color={th.accent} />
            <span style={{ fontSize: 17, fontWeight: 800, color: th.text }}>IdeaFlow</span>
          </span>
          <div style={{ marginRight: "auto", display: "flex", gap: 5 }}>
            <IconBtn name="help" onClick={() => setShowGuide(true)} color={th.secondary} bg={th.surface} size={17} pad="8px"
              style={{ border: `1px solid ${th.border}` }} title="מדריך" />
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
      <div style={{ maxWidth: 560, margin: "0 auto", padding: "14px 14px 90px",
        animation: "fadeUp 0.6s ease-out 0.15s both" }}>
        {tab === "inbox" && (
          <Inbox uid={uid} ideas={ideas} projects={projects} th={th} actions={actions} onCapture={capture} myShares={myShares} />
        )}
        {tab === "projects" && (
          <Projects uid={uid} ideas={ideas} projects={projects} th={th} actions={actions}
            projActions={projActions} onCapture={capture}
            myShares={myShares} sharedWithMe={sharedWithMe}
            shareActions={shareActions} onSharedCapture={sharedCapture}
            commentSeen={commentSeen}
            openProjectId={openProjectId} setOpenProjectId={setOpenProjectId} />
        )}
        {tab === "search" && (
          <Search ideas={ideas} projects={projects} th={th} actions={actions}
            q={searchQ} setQ={setSearchQ} />
        )}
      </div>

      {/* Bottom nav */}
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
        background: th.surface, borderTop: `1px solid ${th.border}`,
        animation: "navUp 0.55s ease-out 0.25s both" }}>
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
      {commentsCtx && (
        <CommentsSheet idea={commentsCtx.idea} th={th}
          liveComments={
            commentsCtx.ownerUid === uid
              ? (ideas.find(i => i.id === commentsCtx.idea.id)?.comments || commentsCtx.idea.comments)
              : null /* guest view: optimistic local append inside the sheet */
          }
          onAdd={postComment}
          onClose={() => setCommentsCtx(null)} />
      )}
      {remindIdea && (
        <ReminderSheet idea={remindIdea} th={th}
          onSave={async (ts, repeat) => {
            await updateIdea(uid, remindIdea.id, {
              remindAt: ts, repeat: ts ? repeat : null,
              repeatAnchor: ts && repeat ? ts : null,
            }, remindIdea);
            if (ts) enablePush(uid);
            setRemindIdea(null);
            toast$(!ts ? "התזכורת הוסרה" : repeat ? "תזכורת חוזרת נקבעה" : "תזכורת נקבעה");
          }}
          onClose={() => setRemindIdea(null)} />
      )}
      {snoozeIdea && (
        <SnoozeSheet idea={snoozeIdea} th={th}
          onSave={async ts => {
            await updateIdea(uid, snoozeIdea.id, { remindAt: ts }, snoozeIdea);
            enablePush(uid);
            setSnoozeIdea(null);
            toast$(`נדחה ל-${new Date(ts).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`);
          }}
          onClose={() => setSnoozeIdea(null)} />
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
      {showWhatsNew && !showGuide && <WhatsNew onClose={() => setShowWhatsNew(false)} th={th} />}

      {/* Install banner waits politely while the guide (or any modal) is open */}
      <InstallBanner th={th} hidden={showGuide || showWhatsNew || showAI || showUser || !!editIdea || !!remindIdea || !!moveIdea || !!shareIdea || !!commentsCtx} />
    </div>
  );
}

// Shown once per user per APP_VERSION bump — the release's CHANGELOG entries.
function WhatsNew({ onClose, th }) {
  return (
    <Modal onClose={onClose} maxWidth={400} th={th}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <Icon name="sparkle" size={34} color={th.accent} />
        <h3 style={{ margin: "8px 0 2px", fontSize: 19, fontWeight: 800, color: th.text }}>מה חדש?</h3>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: th.accentText, background: th.accentSoft,
          borderRadius: 20, padding: "3px 12px" }}>גרסה {APP_VERSION}</span>
      </div>
      {CHANGELOG.map((it, i) => (
        <div key={it.title} style={{ display: "flex", alignItems: "flex-start", gap: 11,
          padding: "10px 0", borderBottom: i === CHANGELOG.length - 1 ? "none" : `1px solid ${th.border}` }}>
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
        style={{ width: "100%", marginTop: 12, height: 44, background: th.accent, color: "#fff",
          border: "none", borderRadius: 12, cursor: "pointer",
          fontSize: 15, fontWeight: 700, fontFamily: FONT }}>
        מגניב, הבנתי
      </button>
    </Modal>
  );
}

function Guide({ onClose, th }) {
  const steps = [
    { icon: "inbox", title: "שלב 1 — זרוק ל-Inbox", text: "עלה לך רעיון? כתוב אותו, צלם או הקלט — וזהו. בלי לבחור תיקייה, בלי החלטות. הוא נשמר לבד 9 שניות אחרי שהפסקת להקליד (או בלחיצה על שמור), עובד גם בלי אינטרנט, וגם טיוטה שלא סיימת מחכה לך בפעם הבאה." },
    { icon: "sparkle", title: "שלב 2 — ה-AI מסדר איתך", text: "כמה שניות אחרי השמירה הרעיון מקבל כותרת ותגיות אוטומטיות, ואם הוא מתאים לאחד הפרויקטים שלך — תופיע הצעה \"להעביר אל...?\" שמסתדרת בלחיצה אחת. מיון ידני: אייקון התיקייה על הכרטיס." },
    { icon: "folder", title: "שלב 3 — עבוד מתוך הפרויקטים", text: "כל פרויקט הוא מרחב משלו: תפיסת רעיונות ישירות אליו, הערות, סימון בוצע, וסידור ידני בגרירה. בכל ערב ב-20:00 תקבל תזכורת אם נשארו רעיונות ב-Inbox שמחכים לשיבוץ." },
  ];
  const features = [
    { icon: "edit", title: "עריכה", text: "לחץ על הטקסט של כל רעיון. סרגל העיצוב (מודגש, קו תחתון, צבעים) נמצא מתחת לשדה, וכפתורי חזרה (↶) וקדימה (↷) בקצהו מבטלים או משחזרים כל שינוי. הכל נשמר אוטומטית תוך כדי כתיבה." },
    { icon: "bell", title: "תזכורות", text: "פעמון על כל כרטיס: בעוד שעה / הערב / מחר או זמן מדויק — כולל חזרה קבועה (כל שעה, יום, שבוע, חודש או שנה). ההתראה מגיעה גם כשהאפליקציה סגורה; לחיצה פותחת את הרעיון, כפתור \"15 דק׳\" דוחה ברקע, ו\"אחר\" פותח את חלון הדחייה לכל זמן שתרצה." },
    { icon: "edit", title: "קיצור \"רעיון חדש\"", text: "לחיצה ארוכה על אייקון האפליקציה → \"רעיון\" פותחת מסך כתיבה נקי ומיידי. נגיעה אחת בכל מקום מעלה מקלדת, ובשמירה הרעיון נכנס ישר לאינבוקס." },
    { icon: "clip", title: "צירוף קבצים ומדיה", text: "לכל רעיון אפשר לצרף תמונות, הקלטות וקבצים (PDF, מסמכים, גיליונות ועוד) — דרך כפתור המהדק בתיבת התפיסה או מקש \"קובץ\" בעורך. הקובץ מופיע על הכרטיס ונפתח או יורד בלחיצה. עד 10MB לקובץ." },
    { icon: "share", title: "שיתוף מכל אפליקציה", text: "ראית משהו בוואטסאפ או בדפדפן? שתף → IdeaFlow והוא יחכה בתיבת התפיסה, מוכן לעריכה ושמירה." },
    { icon: "export", title: "ייצוא לקלוד", text: "בתפריט של כל פרויקט (וב-Inbox): \"ייצוא לקלוד\" מעתיק את כל הרעיונות הפתוחים כטקסט מוכן להדבקה בצ'אט." },
    { icon: "chat", title: "שיתוף פרויקט", text: "בתפריט פרויקט → שיתוף → הוסף כתובות Gmail. המוזמנים רואים את הרעיונות, מגיבים ומוסיפים משלהם — ואתה מקבל התראה על כל תגובה, ונקודה אדומה מהבהבת ליד הפרויקט מסמנת תגובה שלא נקראה." },
    { icon: "search", title: "חיפוש ותגיות", text: "חיפוש בכל הפרויקטים, כולל כותרות ותגיות. כל תגית היא כפתור — לחיצה מציגה את כל הרעיונות הדומים." },
    { icon: "delete", title: "פח אשפה", text: "מחיקה היא הפיכה: הרעיון עובר לפח (אייקון הפח במסך הפרויקטים) ונשאר שם 30 יום לפני שנמחק לצמיתות." },
  ];
  const Row = ({ it, last }) => (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 11,
      padding: "9px 0", borderBottom: last ? "none" : `1px solid ${th.border}` }}>
      <div style={{ width: 32, height: 32, borderRadius: 10, background: th.accentSoft,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon name={it.icon} size={16} color={th.accentText} />
      </div>
      <div style={{ flex: 1, fontSize: 13, color: th.text, lineHeight: 1.6, textAlign: "right" }}>
        <strong style={{ fontWeight: 600 }}>{it.title}: </strong>
        <span style={{ color: th.secondary }}>{it.text}</span>
      </div>
    </div>
  );
  return (
    <Modal onClose={onClose} th={th}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <Icon name="bulb" size={36} color={th.accent} />
        <h3 style={{ margin: "8px 0 2px", fontSize: 19, fontWeight: 800, color: th.text }}>איך IdeaFlow עובד</h3>
      </div>

      <div style={{ background: th.accentSoft, borderRadius: 12, padding: "12px 14px", marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 13.5, color: th.accentText, lineHeight: 1.7, textAlign: "right", fontWeight: 500 }}>
          הרעיון פשוט: <strong>אל תסדר — תזרוק.</strong> כל מחשבה נזרקת ל-Inbox ברגע שהיא עולה,
          בלי שום החלטה. המיון קורה אחר-כך, כשנוח לך — וה-AI עוזר בדרך.
        </p>
      </div>

      {steps.map((it, i) => <Row key={it.title} it={it} last={i === steps.length - 1} />)}

      <p style={{ fontSize: 11.5, fontWeight: 600, color: th.muted, letterSpacing: 0.5, margin: "16px 2px 4px" }}>
        עוד כלים
      </p>
      {features.map((it, i) => <Row key={it.title} it={it} last={i === features.length - 1} />)}

      <p style={{ fontSize: 11.5, color: th.muted, margin: "12px 2px 0", textAlign: "center" }}>
        המדריך זמין תמיד בכפתור ? למעלה · גרסה {APP_VERSION}
      </p>
      <button onClick={onClose}
        style={{ width: "100%", marginTop: 10, height: 44, background: th.accent, color: "#fff",
          border: "none", borderRadius: 12, cursor: "pointer",
          fontSize: 15, fontWeight: 700, fontFamily: FONT }}>
        בוא נתחיל
      </button>
    </Modal>
  );
}
