// "Tsalul" design language — crisp neutrals, one cobalt accent, Rubik.
export function getTheme(dark) {
  if (dark) return {
    dark: true,
    bg: "#0F1218", surface: "#171B23", surface2: "#1E232E",
    border: "#262C37", borderStrong: "#333A48",
    text: "#EDEFF4", secondary: "#A5ADBB", muted: "#6E7787",
    accent: "#5B82F2", accentSoft: "#1D2740", accentText: "#9DB4F8",
    green: "#34D399", red: "#F87171", amber: "#FBBF24",
    inputBg: "#171B23",
  };
  return {
    dark: false,
    bg: "#F6F7F9", surface: "#FFFFFF", surface2: "#F0F2F5",
    border: "#E3E6EC", borderStrong: "#D5DAE2",
    text: "#14181F", secondary: "#5C6570", muted: "#9AA1AD",
    accent: "#2E5BE6", accentSoft: "#E8EDFC", accentText: "#1E43B8",
    green: "#16A34A", red: "#DC2626", amber: "#D97706",
    inputBg: "#FFFFFF",
  };
}

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
