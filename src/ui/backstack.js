// Global back-layer stack. Overlays (modals, the note editor) register a close
// function on mount; the Android back handler closes the topmost layer first,
// before falling back to tab navigation. Keeps hardware-back correct even for
// layers that live deep inside a screen, which Shell knows nothing about.
const stack = [];

export function pushBackLayer(fn) {
  stack.push(fn);
  return () => {
    const i = stack.indexOf(fn);
    if (i >= 0) stack.splice(i, 1);
  };
}

// Closes the topmost layer if there is one. Returns whether it did.
export function popBackLayer() {
  const fn = stack.pop();
  if (!fn) return false;
  try { fn(); } catch { /* a broken closer must not break back */ }
  return true;
}
