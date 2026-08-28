// IdeaFlow v5 — capture-first idea manager. Firestore + Storage + woven AI.
import { useState, useEffect, useRef } from "react";
import { auth, googleProvider } from "./firebase";
import { signInWithPopup, signOut, onAuthStateChanged } from "firebase/auth";
import { getTheme, GRAD, GRAD_ELECTRIC, FONT } from "./theme";
import {
  useIdeas, useProjects, addIdea, updateIdea, deleteIdea, reorderIdeas,
  addProject, updateProject, deleteProject, reorderProjects, guideNotSeenYet,
  markVersionSeen, whatsNewNotSeenYet,
  useMyShares, useSharedWithMe, saveShare, removeShare, shareIdOf,
  addComment, addSharedIdea, queueNotification,
  useUserDoc, markCommentsSeen, recordPresence, addNote, autoTitle, saveColorNames,
} from "./data/store";
import { migrateIfNeeded } from "./data/migrate";
import { enrichIdea } from "./data/ai";
import { exportIdeas } from "./data/export";
import { enablePush } from "./push";
import { APP_VERSION, CHANGELOG } from "./changelog";
import { popBackLayer } from "./ui/backstack";
import { Icon, IconBtn } from "./ui/Icons";
import { Modal, ModalHeader, Toast } from "./ui/base";
import { ShareModal, MoveSheet, ReminderSheet, SnoozeSheet, CommentsSheet } from "./ui/sheets";
import Editor from "./ui/Editor";
import Inbox from "./screens/Inbox";
import Projects from "./screens/Projects";
import Notes from "./screens/Notes";
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
// Must match SW_VERSION in public/sw.js — used to detect a stale worker.
const EXPECTED_SW_VERSION = "5.12-silentok";

let lastUpdateCheck = 0;
let updateAnnounced = false;
// Offer the update in a bar rather than reloading underneath the user.
async function checkForUpdate() {
  if (updateAnnounced || Date.now() - lastUpdateCheck < 5 * 60e3) return;
  lastUpdateCheck = Date.now();
  try {
    const html = await (await fetch("/", { cache: "no-store" })).text();
    const tail = html.split("/assets/index-")[1];
    const served = tail ? tail.split(".js")[0] : null;
    const running = [...document.scripts].map(s => s.src).find(s => s.includes("/assets/index-"));
    if (served && running && !running.includes(served)) {
      updateAnnounced = true;
      window.dispatchEvent(new Event("if-update"));
    }
  } catch { /* offline — try again later */ }
}
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") checkForUpdate();
});
setTimeout(checkForUpdate, 6000);

// Taking the update: refresh the service worker too, then load the new bundle.
async function applyUpdate() {
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    await reg?.update();
  } catch { /* ignore */ }
  location.reload();
}

export default function App() {
  const [user, setUser] = useState(undefined);
  const [dark, setDark] = useState(() => localStorage.getItem("if_dark") === "1");
  // Electric is the default look. A value stored before it existed was a choice
  // against the *old* default, so it isn't carried over — from here on only an
  // explicit pick (which also sets if_look_set) follows the user to next time.
  const [look, setLook] = useState(() => {
    try {
      if (!localStorage.getItem("if_look_set")) return "electric";
      return localStorage.getItem("if_look") || "electric";
    } catch { return "electric"; }
  });
  const chooseLook = v => {
    setLook(v);
    try {
      localStorage.setItem("if_look", v);
      localStorage.setItem("if_look_set", "1");
    } catch { /* ignore */ }
  };
  const th = getTheme(dark, look);

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
      dark={dark} setDark={setDark} look={look} setLook={chooseLook} th={th} />;
  }

  if (user === undefined) return <Splash th={th} />;
  if (!user) return <><Login th={th} /><InstallBanner th={th} /></>;
  return <Shell user={user} dark={dark} setDark={setDark} look={look} setLook={chooseLook} th={th} />;
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
    <div className="if-install" style={{ position: "fixed", bottom: "calc(66px + env(safe-area-inset-bottom))",
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
      {/* The bulb "lights up": soft disc pops in, a ring ripples outward.
          Vivid look: the disc becomes the signature gradient with a white bulb. */}
      <div style={{ position: "relative", width: 88, height: 88,
        display: "flex", alignItems: "center", justifyContent: "center" }}>
        {!still && (
          <span style={{ position: "absolute", inset: 0, borderRadius: "50%",
            border: `2px solid ${th.vivid ? "#7C3AED" : th.accent}`,
            animation: "ringExpand 1.3s ease-out 0.35s both" }} />
        )}
        <span style={{ position: "absolute", inset: 0, borderRadius: "50%",
          background: th.vivid ? th.grad : th.accentSoft,
          animation: still ? "none" : "bulbPop 0.65s cubic-bezier(0.34,1.56,0.64,1) both" }} />
        <span style={{ position: "relative", display: "inline-flex",
          animation: still ? "none" : "bulbPop 0.65s cubic-bezier(0.34,1.56,0.64,1) 0.12s both" }}>
          <Icon name="bulb" size={40} color={th.vivid ? "#fff" : th.accent} />
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
          style={{ background: th.cta, color: "#fff", border: "none", borderRadius: 12,
            padding: "12px 30px", cursor: canSave ? "pointer" : "default",
            fontSize: 15.5, fontWeight: 700, fontFamily: FONT, opacity: canSave ? 1 : 0.45 }}>
          שמור
        </button>
      </div>
    </div>
  );
}

function Shell({ user, dark, setDark, look, setLook, th }) {
  const uid = user.uid;
  const [migrating, setMigrating] = useState(true);
  const [migMsg, setMigMsg] = useState("");
  // Where you were last — restored ONLY on a genuine reload (refresh / SW
  // update), so a mid-session refresh keeps your place. A fresh app launch
  // (tapping the icon) is a "navigate" and always opens on the Inbox.
  // (Deep links via ?idea/?share still override after mount.)
  const restoreNav = (() => {
    try {
      const nav = performance.getEntriesByType("navigation")[0];
      const type = nav?.type ?? (performance.navigation?.type === 1 ? "reload" : "navigate");
      return type === "reload";
    } catch { return false; }
  })();
  // Fresh opens land on the notes screen; a refresh still restores where you were.
  const [tab, setTab] = useState(() => {
    if (!restoreNav) return "notes";
    try { return localStorage.getItem("if_nav_tab") || "notes"; } catch { return "notes"; }
  });
  const [openProjectId, setOpenProjectId] = useState(() => {
    if (!restoreNav) return null;
    try { return localStorage.getItem("if_nav_project") || null; } catch { return null; }
  });
  const [editIdea, setEditIdea] = useState(null);
  const [shareIdea, setShareIdea] = useState(null);
  const [moveIdea, setMoveIdea] = useState(null);
  const [remindIdea, setRemindIdea] = useState(null);
  const [snoozeIdea, setSnoozeIdea] = useState(null);
  const [searchQ, setSearchQ] = useState(() => {
    if (!restoreNav) return "";
    try { return localStorage.getItem("if_nav_q") || ""; } catch { return ""; }
  });
  const [showAI, setShowAI] = useState(false);
  const [showUser, setShowUser] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [showWhatsNew, setShowWhatsNew] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [toast, setToast] = useState(null);
  const [bulbBeat, setBulbBeat] = useState(0); // header bulb pulses on capture
  const [fabOpen, setFabOpen] = useState(false);
  const [showAdmin, setShowAdmin] = useState(false);
  const [updateReady, setUpdateReady] = useState(false);
  useEffect(() => {
    const on = () => setUpdateReady(true);
    window.addEventListener("if-update", on);
    return () => window.removeEventListener("if-update", on);
  }, []);

  // The logo is two controls in one: a tap goes home, a long press (700ms)
  // opens the owner's admin panel.
  const longRef = useRef(null);
  const heldRef = useRef(false);
  const logoPress = {
    down: () => {
      heldRef.current = false;
      clearTimeout(longRef.current);
      longRef.current = setTimeout(() => { heldRef.current = true; setShowAdmin(true); }, 700);
    },
    up: () => {
      clearTimeout(longRef.current);
      if (heldRef.current) { heldRef.current = false; return; }
      setTab("inbox");
      setOpenProjectId(null);
    },
    cancel: () => { clearTimeout(longRef.current); heldRef.current = false; },
  };

  // The FAB's three ways in. Dispatching synchronously keeps the tap's user
  // activation alive so the camera/mic picker actually opens; when we have to
  // switch tabs first, CaptureBar picks the intent up from storage on mount.
  const fabAction = kind => {
    setFabOpen(false);
    if (kind === "note") {
      try { sessionStorage.setItem("if_new_note", "1"); } catch { /* ignore */ }
      window.dispatchEvent(new Event("if-new-note"));
      setTab("notes");
      return;
    }
    try { localStorage.setItem("if_focus_capture", "1"); } catch { /* ignore */ }
    if (tab === "inbox") {
      window.dispatchEvent(new CustomEvent("if-capture", { detail: { kind } }));
      return;
    }
    if (kind !== "text") { try { localStorage.setItem("if_capture_kind", kind); } catch { /* ignore */ } }
    setTab("inbox");
    setOpenProjectId(null);
  };

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

  // Remember the current location across a refresh (see the tab/openProjectId init).
  useEffect(() => {
    try {
      localStorage.setItem("if_nav_tab", tab);
      if (openProjectId) localStorage.setItem("if_nav_project", openProjectId);
      else localStorage.removeItem("if_nav_project");
      if (searchQ) localStorage.setItem("if_nav_q", searchQ);
      else localStorage.removeItem("if_nav_q");
    } catch { /* storage full/blocked */ }
  }, [tab, openProjectId, searchQ]);

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
    if (!migrating) recordPresence(uid, user).catch(() => {});
  }, [uid, user, migrating]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      // Notification buttons + click handling come from the SW, so a stale worker
      // keeps opening the app on the "15 דק׳" snooze button. Force convergence:
      // when a newly-activated worker takes control, reload once so the page and
      // its handlers match it (skip active typing; skip the very first install).
      if (navigator.serviceWorker.controller) {
        navigator.serviceWorker.addEventListener("controllerchange", () => {
          if (window.__ifSwReloaded) return;
          const el = document.activeElement;
          if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
          window.__ifSwReloaded = true;
          location.reload();
        });
      }
      // updateViaCache:"none" re-fetches sw.js from the network, not the HTTP
      // cache. Then verify the controlling worker's version; a stale one won't
      // answer with the current one, so we force another update to swap it in.
      navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" })
        .then(async reg => {
          await reg.update().catch(() => {});
          const ctrl = navigator.serviceWorker.controller;
          if (!ctrl) return;
          const version = await new Promise(res => {
            const ch = new MessageChannel();
            ch.port1.onmessage = e => res(e.data && e.data.version);
            try { ctrl.postMessage({ type: "sw-version" }, [ch.port2]); } catch { res(null); }
            setTimeout(() => res(null), 2500);
          });
          if (version !== EXPECTED_SW_VERSION) reg.update().catch(() => {});
        })
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
    uiRef.current = { showGuide, showWhatsNew, showLog, showUser, showAI, remindIdea, snoozeIdea, moveIdea, shareIdea, editIdea, commentsCtx, openProjectId, tab };
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
      // Registered overlays (modals, the note editor) close first, topmost out.
      if (popBackLayer()) { /* layer closed itself */ }
      else if (s.showGuide) setShowGuide(false);
      else if (s.showWhatsNew) setShowWhatsNew(false);
      else if (s.showLog) setShowLog(false);
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
    setBulbBeat(b => b + 1); // the header bulb "lights up" for a beat
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

  // Notes land in the reference lane, never in the Inbox funnel. Their title is
  // simply the first words of the text — predictable, instant, no AI involved.
  const captureNote = async (data) => {
    await addNote(uid, { ...data, title: data.title || autoTitle(data.text) });
    toast$("הפתק נשמר");
    setBulbBeat(b => b + 1);
  };

  const actions = {
    update: (id, patch, base) => updateIdea(uid, id, patch, base),
    // Soft delete → trash (recoverable, auto-purged after 30 days)
    remove: async (idea) => {
      await updateIdea(uid, idea.id, {
        status: "trash", prevStatus: idea.status, deletedAt: Date.now(),
        remindAt: null, aiProject: null, pinned: false,
      }, idea);
      toast$("הועבר לפח האשפה");
    },
    restore: async (idea) => {
      await updateIdea(uid, idea.id, {
        status: idea.prevStatus === "note" ? "note" : (idea.projectId ? "active" : "inbox"),
        prevStatus: null, deletedAt: null,
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
    ai: () => setShowAI(true),
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
  // Everything still open anywhere — the header's "ideas in motion" line.
  const inMotion = ideas.filter(i => !i.noCheck && i.status !== "done" && i.status !== "trash").length;

  const navItems = [
    { id: "inbox", icon: "inbox", label: "Inbox", badge: inboxCount },
    { id: "projects", icon: "folder", label: "פרויקטים" },
  ];

  return (
    // The --if-* custom properties hand the JS theme to the desktop side-rail
    // rules in index.css (this app styles everything with inline objects, so
    // the stylesheet has no tokens of its own to read).
    <div className="if-app" style={{ minHeight: "100vh", background: th.bg, fontFamily: FONT, direction: "rtl",
      "--if-card": th.surface, "--if-line": th.border, "--if-ink": th.text,
      "--if-muted": th.muted, "--if-accent": th.navActive }}>
      {/* Desktop side rail — display:none below 900px, so phones are untouched.
          First child + RTL row layout is what puts it on the right. */}
      <aside className="side">
        <button className="side-brand" onClick={() => setTab("inbox")}>
          <Icon name="bulb" size={26} color={th.accent} />
          <span>IdeaFlow</span>
        </button>
        {navItems.map(n => {
          const active = tab === n.id;
          return (
            <button key={n.id} className={"side-item" + (active ? " on" : "")}
              onClick={() => { setTab(n.id); if (n.id === "projects") setOpenProjectId(null); }}>
              <Icon name={n.icon} size={19} color={active ? th.navActive : th.muted} />
              <span>{n.label}</span>
              {n.badge > 0 && <span className="side-badge">{n.badge}</span>}
            </button>
          );
        })}
      </aside>

      <div className="if-main">
      {/* Header — vivid look paints it with the signature gradient */}
      <div style={{ position: "sticky", top: 0, zIndex: 100,
        background: th.electric
          ? "linear-gradient(180deg,#141A38,#0A0E1F)"
          : th.vivid ? th.grad : th.bg,
        borderBottom: th.electric ? "1px solid rgba(168,85,247,0.22)"
          : th.vivid ? "none" : `1px solid ${th.border}`,
        boxShadow: th.electric ? "0 6px 26px rgba(0,0,0,0.55)" : "none",
        animation: "fadeDown 0.55s ease-out both" }}>
        <div className="if-head-inner" style={{ maxWidth: 560, margin: "0 auto", padding: "10px 14px",
          display: "flex", alignItems: "center", gap: 8 }}>
          <span onPointerDown={logoPress.down} onPointerUp={logoPress.up}
            onPointerLeave={logoPress.cancel} onContextMenu={e => e.preventDefault()}
            style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer", userSelect: "none",
              WebkitTouchCallout: "none" }}>
            {/* The bulb is the brand mark: it glows, and beats on every capture */}
            <span key={bulbBeat} style={{ display: "inline-flex",
              filter: th.electric ? "drop-shadow(0 0 9px rgba(168,85,247,0.85))" : "none",
              animation: bulbBeat ? "bulbBeat .6s ease-out" : "none" }}>
              <Icon name="bulb" size={th.electric ? 25 : 22}
                color={th.electric ? "#C9A2FF" : th.vivid ? "#FFD866" : th.accent} />
            </span>
            <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.15 }}>
              <span style={{ fontSize: 17, fontWeight: 800,
                color: (th.vivid || th.electric) ? "#fff" : th.text }}>IdeaFlow</span>
              {inMotion > 0 && (
                <span style={{ fontSize: 10.5, fontWeight: 500,
                  color: th.electric ? th.accentText : th.vivid ? "rgba(255,255,255,0.85)" : th.muted }}>
                  {inMotion} רעיונות בתנועה
                </span>
              )}
            </span>
          </span>
          <div style={{ marginRight: "auto", display: "flex", gap: 5 }}>
            <IconBtn name="help" onClick={() => setShowGuide(true)}
              color={(th.vivid || th.electric) ? "#fff" : th.secondary}
              bg={(th.vivid || th.electric) ? "rgba(255,255,255,0.10)" : th.surface} size={17} pad="8px"
              style={{ border: (th.vivid || th.electric) ? "1px solid rgba(255,255,255,0.16)" : `1px solid ${th.border}` }} title="מדריך" />
            <IconBtn name="sparkle" onClick={() => setShowAI(true)}
              color={th.electric ? "#C9A2FF" : th.vivid ? "#FFD866" : th.accent}
              bg={(th.vivid || th.electric) ? "rgba(255,255,255,0.10)" : th.accentSoft} size={17} pad="8px" />
            <IconBtn name={dark ? "sun" : "moon"} onClick={() => setDark(d => !d)}
              color={(th.vivid || th.electric) ? "#fff" : th.secondary}
              bg={(th.vivid || th.electric) ? "rgba(255,255,255,0.10)" : th.surface} size={17} pad="8px"
              style={{ border: (th.vivid || th.electric) ? "1px solid rgba(255,255,255,0.16)" : `1px solid ${th.border}` }} />
            <button onClick={() => setShowUser(true)}
              style={{ width: 33, height: 33, borderRadius: "50%",
                border: (th.vivid || th.electric) ? "1px solid rgba(255,255,255,0.3)" : `1px solid ${th.border}`,
                background: (th.vivid || th.electric) ? "rgba(255,255,255,0.10)" : th.surface,
                cursor: "pointer", overflow: "hidden", padding: 0 }}>
              {user.photoURL
                ? <img src={user.photoURL} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <Icon name="logout" size={15} color={(th.vivid || th.electric) ? "#fff" : th.secondary} />}
            </button>
          </div>
        </div>

        {updateReady && (
          <button onClick={applyUpdate}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              width: "100%", border: "none", cursor: "pointer", fontFamily: FONT,
              padding: "10px 14px", background: th.cta || th.accent, color: "#fff",
              fontSize: 13.5, fontWeight: 700, animation: "fadeDown .3s ease-out both" }}>
            <Icon name="refresh" size={15} color="#fff" />
            גרסה חדשה זמינה — לחץ לעדכון
          </button>
        )}
      </div>

      {/* Body */}
      <div className="if-body" style={{ maxWidth: 560, margin: "0 auto", padding: "14px 14px 90px",
        animation: "fadeUp 0.6s ease-out 0.15s both" }}>
        {tab === "inbox" && (
          <Inbox uid={uid} ideas={ideas} projects={projects} th={th} actions={actions} onCapture={capture}
            myShares={myShares} userName={(user.displayName || "").split(" ")[0]} />
        )}
        {tab === "projects" && (
          <Projects uid={uid} ideas={ideas} projects={projects} th={th} actions={actions}
            projActions={projActions} onCapture={capture}
            myShares={myShares} sharedWithMe={sharedWithMe}
            shareActions={shareActions} onSharedCapture={sharedCapture}
            commentSeen={commentSeen}
            openProjectId={openProjectId} setOpenProjectId={setOpenProjectId} />
        )}
        {tab === "notes" && (
          <Notes uid={uid} ideas={ideas} th={th} actions={actions}
            onCapture={captureNote}
            onCreateNote={data => addNote(uid, data)}
            colorNames={userDoc.colorNames || []}
            onSaveNames={names => saveColorNames(uid, names).catch(() => {})} />
        )}
        {tab === "search" && (
          <Search ideas={ideas} projects={projects} th={th} actions={actions}
            q={searchQ} setQ={setSearchQ} />
        )}
      </div>
      </div>

      {/* Bottom nav */}
      <div className="if-nav" style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 100,
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
                  <Icon name={n.icon} size={21} color={active ? th.navActive : th.muted} />
                  {n.badge > 0 && (
                    <span style={{ position: "absolute", top: -4, left: -10, background: th.navActive,
                      color: "#fff", fontSize: 9.5, fontWeight: 700, borderRadius: 9,
                      minWidth: 15, height: 15, padding: "0 4px",
                      display: "flex", alignItems: "center", justifyContent: "center" }}>
                      {n.badge}
                    </span>
                  )}
                </span>
                <span style={{ fontSize: 10.5, fontWeight: active ? 600 : 400,
                  color: active ? th.navActive : th.muted }}>{n.label}</span>
              </button>
            );
          })}
          {/* Raised FAB — the app's primary action, mid-bar */}
          <span style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <button onClick={() => setFabOpen(true)} title="רעיון חדש"
              style={{ width: 52, height: 52, marginTop: -22, borderRadius: "50%",
                background: th.cta || th.accent,
                border: th.electric ? "2px solid rgba(168,85,247,0.55)" : `3px solid ${th.surface}`,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: th.electric
                  ? "0 0 22px rgba(168,85,247,0.75), 0 6px 18px rgba(0,0,0,0.6)"
                  : "0 6px 18px rgba(0,0,0,0.22)" }}>
              <Icon name="add" size={27} color="#fff" />
            </button>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: th.navActive, marginTop: -2 }}>
              רעיון חדש
            </span>
          </span>

          {/* favourites + search sit after the FAB, so it lands dead centre */}
          <button onClick={() => setTab("notes")}
            style={{ flex: 1, background: "transparent", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              padding: "5px 0", fontFamily: FONT }}>
            <Icon name="notes" size={21} color={tab === "notes" ? th.navActive : th.muted} />
            <span style={{ fontSize: 10.5, fontWeight: tab === "notes" ? 600 : 400,
              color: tab === "notes" ? th.navActive : th.muted }}>פתקים</span>
          </button>
          <button onClick={() => setTab("search")}
            style={{ flex: 1, background: "transparent", border: "none", cursor: "pointer",
              display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
              padding: "5px 0", fontFamily: FONT }}>
            <Icon name="search" size={21} color={tab === "search" ? th.navActive : th.muted} />
            <span style={{ fontSize: 10.5, fontWeight: tab === "search" ? 600 : 400,
              color: tab === "search" ? th.navActive : th.muted }}>חיפוש</span>
          </button>
        </div>
      </div>

      {fabOpen && (
        <Modal onClose={() => setFabOpen(false)} maxWidth={340} th={th}>
          <ModalHeader title="רעיון חדש" icon="bulb" onClose={() => setFabOpen(false)} th={th} />
          {[["text", "bulb", "רעיון", "כתוב אותו עכשיו"],
            ["note", "notes", "פתק", "מידע לשמור, לא משימה"],
            ["audio", "mic", "הקלטה", "תפוס אותו בקול"],
            ["image", "camera", "תמונה", "צלם או בחר מהגלריה"]].map(([kind, icon, label, sub]) => (
            <button key={kind} onClick={() => fabAction(kind)}
              style={{ display: "flex", alignItems: "center", gap: 12, width: "100%",
                background: th.surface2, color: th.text, border: `1px solid ${th.border}`,
                borderRadius: 13, padding: "13px 14px", marginBottom: 8, cursor: "pointer",
                fontFamily: FONT, direction: "rtl", textAlign: "right" }}>
              <span style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0,
                background: th.accentSoft, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icon name={icon} size={18} color={th.accentText} />
              </span>
              <span style={{ display: "flex", flexDirection: "column", lineHeight: 1.3 }}>
                <span style={{ fontSize: 14.5, fontWeight: 600 }}>{label}</span>
                <span style={{ fontSize: 12, color: th.muted }}>{sub}</span>
              </span>
            </button>
          ))}
        </Modal>
      )}

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

            {/* Look picker — calm (Tsalul) vs vivid (Zohar), saved per device */}
            <p style={{ fontSize: 12, fontWeight: 600, color: th.muted, textAlign: "right", margin: "0 0 6px" }}>מראה</p>
            <div style={{ display: "flex", gap: 8, marginBottom: 12, direction: "rtl" }}>
              {[["calm", "רגוע"], ["vivid", "זוהר"], ["electric", "אלקטריק ⚡"]].map(([v, label]) => (
                <button key={v} onClick={() => setLook(v)}
                  style={{ flex: 1, height: 40, borderRadius: 11, cursor: "pointer",
                    fontFamily: FONT, fontSize: 12.5, fontWeight: 600, padding: 0,
                    background: look === v
                      ? (v === "vivid" ? GRAD : v === "electric" ? GRAD_ELECTRIC : th.accent)
                      : th.surface2,
                    color: look === v ? "#fff" : th.text,
                    border: look === v ? "none" : `1px solid ${th.border}` }}>
                  {label}
                </button>
              ))}
            </div>

            <button onClick={() => { setShowUser(false); setShowLog(true); }}
              style={{ width: "100%", height: 42, marginBottom: 8, background: th.surface2, color: th.text,
                border: `1px solid ${th.border}`, borderRadius: 11, cursor: "pointer",
                fontSize: 14, fontWeight: 500, fontFamily: FONT,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 7 }}>
              <Icon name="time" size={16} color={th.secondary} /> יומן עדכונים
            </button>
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
      {showGuide && <Guide onClose={() => setShowGuide(false)} onLog={() => { setShowGuide(false); setShowLog(true); }} th={th} />}
      {showWhatsNew && !showGuide && <WhatsNew onClose={() => setShowWhatsNew(false)} th={th} />}
      {showLog && <UpdatesLog onClose={() => setShowLog(false)} th={th} />}
      {showAdmin && <AdminPanel onClose={() => setShowAdmin(false)} th={th} />}

      {/* Install banner waits politely while the guide (or any modal) is open */}
      <InstallBanner th={th} hidden={showGuide || showWhatsNew || showLog || showAI || showUser || !!editIdea || !!remindIdea || !!moveIdea || !!shareIdea || !!commentsCtx} />
    </div>
  );
}

// One log row — icon tile + title + text. Shared by what's-new and the log.
function LogRow({ it, th, last }) {
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 11,
      padding: "10px 0", borderBottom: last ? "none" : `1px solid ${th.border}` }}>
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
}

// Shown once per user per APP_VERSION bump — the latest release's entries.
function WhatsNew({ onClose, th }) {
  const items = CHANGELOG[0]?.items || [];
  return (
    <Modal onClose={onClose} maxWidth={400} th={th}>
      <div style={{ textAlign: "center", marginBottom: 12 }}>
        <Icon name="sparkle" size={34} color={th.accent} />
        <h3 style={{ margin: "8px 0 2px", fontSize: 19, fontWeight: 800, color: th.text }}>מה חדש?</h3>
        <span style={{ fontSize: 11.5, fontWeight: 600, color: th.accentText, background: th.accentSoft,
          borderRadius: 20, padding: "3px 12px" }}>גרסה {APP_VERSION}</span>
      </div>
      {items.map((it, i) => <LogRow key={it.title} it={it} th={th} last={i === items.length - 1} />)}
      <button onClick={onClose}
        style={{ width: "100%", marginTop: 12, height: 44, background: th.accent, color: "#fff",
          border: "none", borderRadius: 12, cursor: "pointer",
          fontSize: 15, fontWeight: 700, fontFamily: FONT }}>
        מגניב, הבנתי
      </button>
    </Modal>
  );
}

// Full accumulating history — every release, newest first.
function UpdatesLog({ onClose, th }) {
  return (
    <Modal onClose={onClose} maxWidth={430} th={th}>
      <div style={{ textAlign: "center", marginBottom: 14 }}>
        <Icon name="time" size={30} color={th.accent} />
        <h3 style={{ margin: "8px 0 2px", fontSize: 19, fontWeight: 800, color: th.text }}>יומן עדכונים</h3>
        <p style={{ margin: 0, fontSize: 12.5, color: th.muted }}>כל מה שהשתנה ב-IdeaFlow</p>
      </div>
      {CHANGELOG.map(rel => (
        <div key={rel.v} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, margin: "4px 0 2px" }}>
            <span style={{ fontSize: 11.5, fontWeight: 700, color: th.accentText, background: th.accentSoft,
              borderRadius: 20, padding: "3px 11px", flexShrink: 0 }}>גרסה {rel.v}</span>
            <span style={{ fontSize: 11.5, color: th.muted, flexShrink: 0 }}>{rel.date}</span>
            <div style={{ flex: 1, height: 1, background: th.border }} />
          </div>
          {rel.items.map((it, i) => <LogRow key={it.title} it={it} th={th} last={i === rel.items.length - 1} />)}
        </div>
      ))}
      <button onClick={onClose}
        style={{ width: "100%", marginTop: 8, height: 44, background: th.accent, color: "#fff",
          border: "none", borderRadius: 12, cursor: "pointer",
          fontSize: 15, fontWeight: 700, fontFamily: FONT }}>
        סגור
      </button>
    </Modal>
  );
}

// Owner-only panel — who is using IdeaFlow. Long-press the logo to open it.
// The server checks the caller's ID token, so a non-owner just sees a refusal.
function AdminPanel({ onClose, th }) {
  const [state, setState] = useState({ loading: true });

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error("no-auth");
        const r = await fetch("/api/admin-users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ idToken }),
        });
        const d = await r.json();
        if (!alive) return;
        if (!r.ok) throw new Error(d.error || "failed");
        setState({ loading: false, users: d.users });
      } catch (e) {
        if (alive) setState({ loading: false, error: e.message === "forbidden"
          ? "הפאנל זמין לבעלים בלבד" : "לא הצלחתי לטעון — נסה שוב" });
      }
    })();
    return () => { alive = false; };
  }, []);

  const when = ts => {
    if (!ts) return "—";
    const d = Math.floor((Date.now() - ts) / 86400e3);
    if (d === 0) return "היום";
    if (d === 1) return "אתמול";
    if (d < 30) return `לפני ${d} ימים`;
    return new Date(ts).toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" });
  };

  const users = state.users || [];
  const totalIdeas = users.reduce((n, u) => n + (u.ideas || 0), 0);
  const active7 = users.filter(u => u.lastSeen && Date.now() - u.lastSeen < 7 * 86400e3).length;

  return (
    <Modal onClose={onClose} maxWidth={460} th={th}>
      <ModalHeader title="פאנל ניהול" icon="logout" onClose={onClose} th={th} />

      {state.loading && <p style={{ textAlign: "center", color: th.muted, fontSize: 13.5, padding: "18px 0" }}>טוען…</p>}
      {state.error && <p style={{ textAlign: "center", color: th.red, fontSize: 13.5, padding: "18px 0" }}>{state.error}</p>}

      {!state.loading && !state.error && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 14, direction: "rtl" }}>
            {[[users.length, "משתמשים"], [active7, "פעילים השבוע"], [totalIdeas, "רעיונות"]].map(([n, label]) => (
              <div key={label} style={{ flex: 1, background: th.surface2, borderRadius: 12,
                border: `1px solid ${th.border}`, padding: "10px 8px", textAlign: "center" }}>
                <div style={{ fontSize: 19, fontWeight: 800, color: th.text }}>{n}</div>
                <div style={{ fontSize: 11, color: th.muted, marginTop: 1 }}>{label}</div>
              </div>
            ))}
          </div>

          {users.map(u => (
            <div key={u.uid} style={{ display: "flex", alignItems: "center", gap: 10, direction: "rtl",
              background: th.surface, border: `1px solid ${th.border}`, borderRadius: 13,
              padding: "10px 12px", marginBottom: 8 }}>
              {u.photo
                ? <img src={u.photo} alt="" style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0 }} />
                : <span style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
                    background: th.accentSoft, display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 700, color: th.accentText }}>
                    {(u.name || u.email || "?").trim().charAt(0).toUpperCase()}
                  </span>}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: th.text,
                  display: "flex", alignItems: "center", gap: 6 }}>
                  {u.name || "(ללא שם)"}
                  {u.push && <Icon name="bell" size={11} color={th.green} />}
                </p>
                <p style={{ margin: "1px 0 0", fontSize: 11.5, color: th.muted,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{u.email}</p>
              </div>
              <div style={{ textAlign: "left", flexShrink: 0 }}>
                <p style={{ margin: 0, fontSize: 12.5, fontWeight: 600, color: th.secondary }}>
                  {u.ideas} רעיונות
                </p>
                <p style={{ margin: "1px 0 0", fontSize: 11, color: th.muted }}>
                  {when(u.lastSeen)}{u.version ? ` · v${u.version}` : ""}
                </p>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <p style={{ textAlign: "center", color: th.muted, fontSize: 13.5, padding: "14px 0" }}>
              אין עדיין משתמשים רשומים
            </p>
          )}
        </>
      )}

      <button onClick={onClose}
        style={{ width: "100%", marginTop: 10, height: 44, background: th.cta || th.accent, color: "#fff",
          border: "none", borderRadius: 12, cursor: "pointer",
          fontSize: 15, fontWeight: 700, fontFamily: FONT }}>
        סגור
      </button>
    </Modal>
  );
}

function Guide({ onClose, onLog, th }) {
  const steps = [
    { icon: "inbox", title: "שלב 1 — זרוק ל-Inbox", text: "עלה לך רעיון? כתוב אותו, צלם או הקלט — וזהו. בלי לבחור תיקייה, בלי החלטות. הוא נשמר לבד 9 שניות אחרי שהפסקת להקליד (או בלחיצה על שמור), עובד גם בלי אינטרנט, וגם טיוטה שלא סיימת מחכה לך בפעם הבאה." },
    { icon: "sparkle", title: "שלב 2 — ה-AI מסדר איתך", text: "כמה שניות אחרי השמירה הרעיון מקבל כותרת ותגיות אוטומטיות, ואם הוא מתאים לאחד הפרויקטים שלך — תופיע הצעה \"להעביר אל...?\" שמסתדרת בלחיצה אחת. מיון ידני: אייקון התיקייה על הכרטיס." },
    { icon: "folder", title: "שלב 3 — עבוד מתוך הפרויקטים", text: "כל פרויקט הוא מרחב משלו: תפיסת רעיונות ישירות אליו, הערות, סימון בוצע, וסידור ידני בגרירה. בכל ערב ב-20:00 תקבל תזכורת אם נשארו רעיונות ב-Inbox שמחכים לשיבוץ." },
  ];
  const features = [
    { icon: "edit", title: "עריכה", text: "לחץ על הטקסט של כל רעיון. סרגל העיצוב (מודגש, קו תחתון, צבעים) נמצא מתחת לשדה, וכפתורי חזרה (↶) וקדימה (↷) בקצהו מבטלים או משחזרים כל שינוי. הכל נשמר אוטומטית תוך כדי כתיבה." },
    { icon: "bell", title: "תזכורות", text: "פעמון על כל כרטיס: בעוד שעה / הערב / מחר או זמן מדויק — כולל חזרה קבועה (כל שעה, יום, שבוע, חודש או שנה). ההתראה מגיעה גם כשהאפליקציה סגורה; כפתור \"דחה 15 דק׳\" דוחה ברקע בלי לפתוח את האפליקציה, ולחיצה על גוף ההתראה פותחת בורר לדחייה לזמן אחר (5/15/30 דק׳, שעה, יום או מותאם)." },
    { icon: "notes", title: "רעיון ללא ביצוע", text: "לא כל רעיון הוא משימה. בתפריט הכרטיס (⋯) אפשר לסמן רעיון כ\"הערה\" — ריבוע הסימון נעלם והוא לא ניתן לסימון כבוצע. שימושי למידע, קישורים או תזכורות-רקע. לחיצה נוספת על אותו אייקון מחזירה אותו למשימה רגילה." },
    { icon: "edit", title: "קיצור \"רעיון חדש\"", text: "לחיצה ארוכה על אייקון האפליקציה → \"רעיון\" פותחת מסך כתיבה נקי ומיידי. נגיעה אחת בכל מקום מעלה מקלדת, ובשמירה הרעיון נכנס ישר לאינבוקס." },
    { icon: "clip", title: "צירוף קבצים ומדיה", text: "לכל רעיון אפשר לצרף תמונות, הקלטות וקבצים (PDF, מסמכים, גיליונות ועוד) — דרך כפתור המהדק בתיבת התפיסה או מקש \"קובץ\" בעורך. הקובץ מופיע על הכרטיס ונפתח או יורד בלחיצה. עד 10MB לקובץ." },
    { icon: "share", title: "שיתוף מכל אפליקציה", text: "ראית משהו בוואטסאפ או בדפדפן? שתף → IdeaFlow והוא יחכה בתיבת התפיסה, מוכן לעריכה ושמירה." },
    { icon: "export", title: "ייצוא לקלוד", text: "בתפריט של כל פרויקט (וב-Inbox): \"ייצוא לקלוד\" מעתיק את כל הרעיונות הפתוחים כטקסט מוכן להדבקה בצ'אט." },
    { icon: "chat", title: "שיתוף פרויקט", text: "בתפריט פרויקט → שיתוף → הוסף כתובות Gmail. המוזמנים רואים את הרעיונות, מגיבים ומוסיפים משלהם — ואתה מקבל התראה על כל תגובה, ונקודה אדומה מהבהבת ליד הפרויקט מסמנת תגובה שלא נקראה." },
    { icon: "search", title: "חיפוש ותגיות", text: "חיפוש בכל הפרויקטים, כולל כותרות ותגיות. כל תגית היא כפתור — לחיצה מציגה את כל הרעיונות הדומים." },
    { icon: "delete", title: "פח אשפה", text: "מחיקה היא הפיכה: הרעיון עובר לפח (אייקון הפח במסך הפרויקטים) ונשאר שם 30 יום לפני שנמחק לצמיתות." },
    { icon: "sparkle", title: "מראה", text: "בתפריט המשתמש (התמונה למעלה) בוחרים מראה: \"אלקטריק\" הכהה והזוהר (ברירת המחדל), \"זוהר\" הצבעוני או \"רגוע\" המינימלי. בכפתור הירח/שמש עוברים למצב כהה. הבחירה נשמרת במכשיר." },
    { icon: "add", title: "כפתור רעיון חדש", text: "הכפתור העגול במרכז סרגל הניווט פותח שלוש דרכים לתפוס רעיון: כתיבה, הקלטה קולית או תמונה." },
    { icon: "star", title: "מועדפים", text: "כוכב ⭐ על כרטיס פרויקט מעלה אותו לראש מסך הפרויקטים — מה שאתה חוזר אליו, ראשון." },
    { icon: "notes", title: "פתקים", text: "לשונית \"פתקים\" היא לדברים שרוצים לשמור ולא לבצע. + פותח דף כתיבה שנשמר אוטומטית; לחיצה ארוכה מסמנת פתקים לבחירה מרובה — צביעה, ארכיון או מחיקה לכולם יחד. שורת המיון למעלה, שמות לצבעים, ושורות שמתחילות ב-\"- \" הופכות לרשימת סימון. פתקים לא מגיעים ל-Inbox ולא נספרים כרעיונות פעילים." },
    { icon: "bulb", title: "AI על הרעיון", text: "בעורך של כל רעיון: שפר ניסוח, הרחב, הפוך למשימות או קבל זוויות נוספות. התוצאה מוצעת — אתה בוחר אם להחליף, להוסיף או לבטל." },
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
        {onLog && <> · <span onClick={onLog}
          style={{ color: th.accentText, fontWeight: 600, cursor: "pointer" }}>יומן עדכונים</span></>}
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
