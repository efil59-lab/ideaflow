// "Tsalul" design language — crisp neutrals, one cobalt accent, Rubik.
// A second look, "Vivid" (זוהר), layers a signature gradient, saturated card
// colors and colored side-bars on top — user-switchable, per device.
export const GRAD = "linear-gradient(120deg,#2E5BE6,#7C3AED,#DB2777)";
// "Electric" — the dark/neon look: near-black navy ground, electric purple and
// blue accents, glow instead of borders. Always dark, whatever the sun/moon says.
export const GRAD_ELECTRIC = "linear-gradient(120deg,#3B82F6,#7C3AED,#EC4899)";

export function getTheme(dark, look = "calm") {
  if (look === "electric") return electricTheme();
  const t = dark ? {
    dark: true,
    bg: "#0F1218", surface: "#171B23", surface2: "#1E232E",
    border: "#262C37", borderStrong: "#333A48",
    text: "#EDEFF4", secondary: "#A5ADBB", muted: "#6E7787",
    accent: "#5B82F2", accentSoft: "#1D2740", accentText: "#9DB4F8",
    green: "#34D399", red: "#F87171", amber: "#FBBF24",
    inputBg: "#171B23",
    pastels: ["#252112", "#16223A", "#12291F", "#241C36", "#2A1E13", "#2A1622"],
  } : {
    dark: false,
    bg: "#F6F7F9", surface: "#FFFFFF", surface2: "#F0F2F5",
    border: "#E3E6EC", borderStrong: "#D5DAE2",
    text: "#14181F", secondary: "#5C6570", muted: "#9AA1AD",
    accent: "#2E5BE6", accentSoft: "#E8EDFC", accentText: "#1E43B8",
    green: "#16A34A", red: "#DC2626", amber: "#D97706",
    inputBg: "#FFFFFF",
    pastels: ["#FDF6DE", "#EAF2FB", "#E6F7F1", "#F3ECFA", "#FCEFE6", "#FBEAF0"],
  };
  // Tokens every look defines; vivid overrides them below.
  t.cta = t.accent;          // main save/CTA button background
  t.navActive = t.accent;    // active bottom-nav item
  if (look === "vivid") {
    t.vivid = true;
    t.grad = GRAD;
    t.cta = GRAD;
    t.navActive = dark ? "#A78BFA" : "#7C3AED";
    t.pastels = dark
      ? ["#3A3110", "#11304F", "#0D3A2A", "#2F2052", "#3E2712", "#3B1631"]
      : ["#FFE9A8", "#C2E0F8", "#BDEDDB", "#E3D3F9", "#FFD9BC", "#F9D2E2"];
    // Side-bar accent per pastel index (same order as pastels).
    t.pastelBars = ["#EF9F27", "#378ADD", "#1D9E75", "#7C3AED", "#D85A30", "#D4537E"];
  }
  return t;
}

function electricTheme() {
  return {
    dark: true, electric: true, glow: true,
    grad: GRAD_ELECTRIC,
    bg: "#080B18", surface: "#11152A", surface2: "#171D36",
    border: "#1F2745", borderStrong: "#2E3A63",
    text: "#EEF1FF", secondary: "#9BA7CA", muted: "#6C779C",
    accent: "#A855F7", accentSoft: "#241A46", accentText: "#C9A2FF",
    green: "#34D399", red: "#FB7185", amber: "#FBBF24",
    inputBg: "#0D1224",
    cta: GRAD_ELECTRIC,
    navActive: "#A855F7",
    // Colour-coded cards stay legible on the near-black ground.
    pastels: ["#2A2410", "#0F2445", "#0C2F27", "#241540", "#33200F", "#33132A"],
    pastelBars: ["#FBBF24", "#3B82F6", "#10B981", "#A855F7", "#F97316", "#EC4899"],
  };
}

// Note colours: one stable accent per card colour, in every look. Index matches
// pastels[] / pastelBars[], so a note's colour reads the same everywhere.
export const NOTE_COLORS = ["#EAB308", "#3B82F6", "#10B981", "#A855F7", "#F97316", "#EC4899"];
export const NOTE_COLOR_FALLBACK = ["צהוב", "כחול", "ירוק", "סגול", "כתום", "ורוד"];

export const FONT = "'Rubik', sans-serif";

export function fmt(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  return d.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }) + " · " +
         d.toLocaleDateString("he-IL", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

export function fmtDatetimeLocal(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// Recurring-reminder options. The value is stored on idea.repeat and mirrored
// into /reminders for the server cron, which reschedules instead of deleting.
export const REPEAT_OPTIONS = [
  ["", "ללא חזרה"],
  ["hourly", "חזור כל שעה"],
  ["daily", "חזור כל יום"],
  ["weekly", "חזור כל שבוע"],
  ["monthly", "חזור כל חודש — באותו תאריך"],
  ["monthly-weekday", "חזור כל חודש — באותו יום בשבוע"],
  ["yearly", "חזור כל שנה"],
];
