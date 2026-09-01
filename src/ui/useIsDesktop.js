import { useState, useEffect } from "react";

// True on a wide screen — where the app swaps its phone shell for the desktop
// site (DesktopSite). Kept above the phone breakpoints so tablets still get the
// side-rail layout; only ≥1100px (and tall enough) becomes the full site.
const QUERY = "(min-width: 1100px) and (min-height: 600px)";

export function useIsDesktop() {
  const [on, setOn] = useState(() => {
    try { return window.matchMedia(QUERY).matches; } catch { return false; }
  });
  useEffect(() => {
    let m;
    try { m = window.matchMedia(QUERY); } catch { return; }
    const h = () => setOn(m.matches);
    m.addEventListener ? m.addEventListener("change", h) : m.addListener(h);
    return () => { m.removeEventListener ? m.removeEventListener("change", h) : m.removeListener(h); };
  }, []);
  return on;
}
