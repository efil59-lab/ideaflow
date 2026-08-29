// Carousel-style paging between the bottom tabs, with the feel of a phone
// home screen. The first version only *hinted* at a swipe (dragged the pane
// 90px at 0.4 damping, snapped it back, then hard-swapped the content), which
// is why it felt wrong.
//
// What a real home screen does, and what this does:
//   1. BOTH screens are on-screen during the drag — the outgoing one leaves
//      while the incoming one arrives, edge to edge.
//   2. The content tracks the finger 1:1. No damping, except past the ends.
//   3. On release the motion COMPLETES (the incoming screen slides fully in)
//      instead of snapping back and cutting.
//   4. A quick flick commits even when short — velocity counts, not only
//      distance.
//
// RTL geometry: the next tab sits physically to the LEFT of the current one
// (בית is the rightmost tab), so dragging the finger RIGHT pulls it into view.
// That keeps "finger right = next screen" while the content still moves WITH
// the finger — which is the half that makes it feel native.
//
// The rules below that look over-careful were all paid for on a real phone, in
// Engivo, which runs the same gesture. Each is a bug that reached a user, and
// almost every one arrived as the same sentence: "the first swipe does
// nothing, the second one works."

export const LOCK_SLOP = 12;         // px before the gesture commits to a direction
// ...and the distance after which it MUST commit to one, so that a drag held
// near the diagonal cannot sit undecided for its whole life. Deliberately well
// past a first sample: tried at 36px, it swallowed the very arc that the equal
// margins below exist to protect.
export const DECIDE_PX = 90;
export const COMMIT_RATIO = 0.28;    // fraction of the screen that pages over
export const FLICK_SPEED = 0.45;     // px/ms — a fast flick pages without a long drag
export const FLICK_MIN_PX = 48;      // ...but a twitch must never page a screen
export const SETTLE_MS = 280;

// Where a finished gesture lands, for a strip that is a RING: past אפשרויות
// comes בית again, and before בית comes אפשרויות. Four tabs is few enough that
// wrapping saves a real journey — from the last tab back to the first is one
// swipe instead of three — and the bottom bar is always on screen to say where
// you actually are, so the ring can never leave anyone lost.
//
// The answer can still be "nowhere", and that is why this is a function of its
// own: on a screen that is not in the strip at all (search, item, admin), a
// committed swipe has no destination, and the pane it moved has to be put back
// or the app sits there shifted sideways with the bar still marking the tab you
// were on.
export function tabAfterSettle(tabs, index, committed) {
  if (index < 0 || !committed || !tabs.length) return null;
  return tabs[(index + committed + tabs.length) % tabs.length] || null;
}

export function createPager({ paneRef, incomingRef, gestureRef, paintRef, canNext, canPrev, onDragStart, onSettle, now = () => Date.now() }) {
  // Two scales, and the swipe lives in both. Touch coordinates come in the
  // RECT scale; a transform written on an element is in the CLIENT scale, and
  // a CSS zoom on an ancestor multiplies it on the way to the screen. So
  // everything the finger did is measured against the rect, and everything
  // written as a transform is divided by rect ÷ client.
  //
  // Measured ONCE per gesture and carried on it: neither number can change
  // while a finger is down, and getBoundingClientRect() forces the browser to
  // lay the page out — calling it per touchmove costs a full layout on every
  // frame of every drag. (window.innerWidth, which this used to use, is the
  // wrong number twice over: it ignores the shell's max-width, and it ignores
  // zoom.)
  const paneRect = () => {
    const pane = paneRef.current;
    if (!pane || !pane.getBoundingClientRect) return 0;
    const r = pane.getBoundingClientRect();
    return (r && r.width) || 0;
  };
  const metrics = () => {
    const pane = paneRef.current;
    const rect = paneRect();
    const client = (pane && pane.clientWidth) || 0;
    return {
      w: rect || client || (typeof window !== 'undefined' && window.innerWidth) || 360,
      z: rect && client ? rect / client : 1,
    };
  };
  const live = () => (gestureRef.current && gestureRef.current.m)
    || (paintRef && paintRef.current && paintRef.current.m)
    || metrics();

  const ease = (animate) => (animate ? `transform ${SETTLE_MS}ms cubic-bezier(.22,.61,.36,1)` : 'none');
  const at = (px) => `translate3d(${px}px,0,0)`;

  // The preview is mounted by React, one render behind the finger. On a quick
  // flick the whole gesture can be over before that render lands, and then the
  // screen changed with no slide at all. So every placement of the preview goes
  // through here, and App calls it again the moment the element exists
  // (syncIncoming): whenever it arrives, it arrives in place.
  const paintIncoming = (dx, animate, dir, m) => {
    const incoming = incomingRef.current;
    if (!incoming) return;
    const local = dx / m.z;                 // finger scale -> transform scale
    const w = m.w / m.z;
    // the next tab waits off the left edge, the previous tab off the right
    const side = (dir || (dx >= 0 ? 1 : -1)) > 0 ? -w : w;
    if (animate && !incoming.style.transform) {
      // only just mounted: a transition needs somewhere to start from
      incoming.style.transition = 'none';
      incoming.style.transform = at(side);
      void incoming.offsetWidth;
    }
    incoming.style.transition = ease(animate);
    incoming.style.transform = at(local + side);
  };

  // Position both panes for a given finger delta.
  const paint = (dx, animate, dir) => {
    const pane = paneRef.current;
    const m = live();
    if (paintRef) paintRef.current = { dx, animate, dir: dir || (dx >= 0 ? 1 : -1), m };
    if (pane) {
      pane.style.transition = ease(animate);
      pane.style.transform = at(dx / m.z);
    }
    paintIncoming(dx, animate, dir, m);
  };

  const clear = () => {
    if (paintRef) paintRef.current = null;
    for (const el of [paneRef.current, incomingRef.current]) {
      if (el) { el.style.transition = ''; el.style.transform = ''; }
    }
  };

  // Exactly one settle per gesture, and it is cancellable: if a new touch
  // starts while the last one is still finishing, that settle runs NOW instead
  // of 280ms into the new gesture, so every gesture begins from a screen that
  // is where it says it is.
  const scheduleSettle = (committed) => {
    const run = () => {
      if (paintRef) { paintRef.timer = null; paintRef.settle = null; }
      if (!committed) clear();
      onSettle(committed);
    };
    const t = setTimeout(run, SETTLE_MS);
    if (paintRef) { paintRef.timer = t; paintRef.settle = run; }
  };

  const finishPending = () => {
    if (!paintRef || !paintRef.timer) return;
    clearTimeout(paintRef.timer);
    const run = paintRef.settle;
    paintRef.timer = null;
    paintRef.settle = null;
    if (run) run();
  };

  return {
    // A finished swipe that turned out to have nowhere to go. The panes are
    // mid-slide and no navigation is coming to clean up after them, so bring
    // them back — animated, because they are off-screen by now and a teleport
    // to centre is the ugliest frame in the app.
    snapBack: () => {
      const pane = paneRef.current;
      if (!pane || !pane.style.transform) return;
      const p = paintRef && paintRef.current;
      paint(0, true, p ? p.dir : 1);
      setTimeout(clear, SETTLE_MS);
    },

    // Called from App's layout effect in the render the preview mounts in.
    syncIncoming: () => {
      const p = paintRef && paintRef.current;
      if (p) paintIncoming(p.dx, p.animate, p.dir, p.m || metrics());
    },

    onTouchStart: (e) => {
      // Whatever the last gesture was still doing, it is over now.
      finishPending();
      // ...and if the panes are somehow not at rest with no gesture and no
      // settle to explain it — a touch the browser swallowed whole, a screen
      // that could not be navigated to — put them back before starting a new
      // one, rather than tracking the finger from a place the app is not in.
      if (!gestureRef.current && paneRef.current && paneRef.current.style.transform) clear();
      // Horizontally scrollable strips opt out — and so does anything inside a
      // sheet, which is a dialog over the page, not a page to turn.
      if (e.target?.closest && e.target.closest('[data-noswipe], .sheet-back')) { gestureRef.current = null; return; }
      const t = e.touches[0];
      gestureRef.current = {
        x: t.clientX, y: t.clientY,
        lastX: t.clientX, lastT: now(), speed: 0,
        horizontal: false, canceled: false, dir: 0,
        m: metrics(),
      };
    },

    onTouchMove: (e) => {
      const st = gestureRef.current;
      if (!st || st.canceled || !e.touches?.length) return;
      const t = e.touches[0];
      const dx = t.clientX - st.x;
      const dy = t.clientY - st.y;

      if (!st.horizontal) {
        // Decide once, and the verdict is final either way: a locked gesture
        // pages, a cancelled one belongs to the scroller until the finger
        // lifts. Two rules, and the second exists because of the first.
        //
        // 1. A CLEAR intent decides immediately — one axis beating the other
        //    by 1.2, in either direction. The margin has to be the same both
        //    ways: it used to be 1.2 to lock but a bare majority to cancel,
        //    and since a thumb swipes in an ARC (the opening of a real
        //    sideways swipe is often a shade more vertical than sideways),
        //    one such sample killed the swipe for good.
        // 2. But symmetry alone leaves a band where NOTHING is decided, and a
        //    drag held near 45° could sit in it for its whole life — the app
        //    doing nothing at all, which is how it gets reported: "it needs a
        //    second swipe". So once the finger has travelled far enough that
        //    it can no longer be a hesitation, the bigger axis simply wins.
        const ax = Math.abs(dx), ay = Math.abs(dy);
        const decisive = Math.max(ax, ay) > DECIDE_PX;
        const vertical = ay > LOCK_SLOP && (ay > ax * 1.2 || (decisive && ay >= ax));
        const horizontal = ax > LOCK_SLOP && (ax > ay * 1.2 || (decisive && ax > ay));
        if (vertical) { st.canceled = true; return; }
        if (horizontal) {
          st.horizontal = true;
          st.dir = dx > 0 ? 1 : -1;
          onDragStart(st.dir);            // mounts the neighbouring screen
        } else return;
      }

      // running speed, for the flick test on release
      const tNow = now();
      const dt = tNow - st.lastT;
      if (dt > 0) { st.speed = (t.clientX - st.lastX) / dt; st.lastX = t.clientX; st.lastT = tNow; }

      // the finger may have crossed back over the origin — swap the neighbour
      const dir = dx > 0 ? 1 : -1;
      if (dx !== 0 && dir !== st.dir) { st.dir = dir; onDragStart(dir); }

      // 1:1 with the finger, except at the ends where it rubber-bands
      const blocked = (dx > 0 && !canNext()) || (dx < 0 && !canPrev());
      const move = blocked ? Math.sign(dx) * Math.min(Math.abs(dx) * 0.22, 64) : dx;
      paint(move, false, st.dir);
      // No preventDefault here: React listens passively so the call is refused
      // anyway, and 'touch-action: pan-y' on the pager already tells the browser
      // that horizontal drags belong to us.
    },

    onTouchEnd: (e) => {
      const st = gestureRef.current;
      gestureRef.current = null;
      if (!st || st.canceled || !st.horizontal || !e.changedTouches?.length) { clear(); onSettle(0); return; }

      const dx = e.changedTouches[0].clientX - st.x;
      const w = st.m.w;
      const far = Math.abs(dx) > w * COMMIT_RATIO;
      const flick = Math.abs(dx) > FLICK_MIN_PX
        && Math.abs(st.speed) > FLICK_SPEED
        && Math.sign(st.speed) === Math.sign(dx);
      const allowed = dx > 0 ? canNext() : canPrev();
      const commit = allowed && (far || flick) && dx !== 0;

      if (commit) {
        // finish the motion: the current pane leaves, the incoming lands at 0
        paint(Math.sign(dx) * w, true, st.dir);
        // Hand over WITHOUT resetting the transform — App clears it in a layout
        // effect once the new screen is mounted, so no frame shows the old
        // screen back at centre.
        scheduleSettle(dx > 0 ? 1 : -1);
      } else {
        paint(0, true, st.dir);
        scheduleSettle(0);
      }
    },

    // The browser took the touch away (its own edge gesture, a scroll it
    // decided was vertical, a notification sliding in): no touchend will ever
    // come. Without this the panes froze wherever the finger had left them —
    // the next tab showing in full while the bar still marked the old one,
    // and the app not having moved at all. Snap back, as a too-short drag.
    onTouchCancel: () => {
      const st = gestureRef.current;
      gestureRef.current = null;
      if (!st || !st.horizontal) return;
      paint(0, true, st.dir);
      scheduleSettle(0);
    },
  };
}
