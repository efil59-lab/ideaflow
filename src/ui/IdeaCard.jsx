// Idea card — title line, clamped body, context chips, quiet action row.
import { useState } from "react";
import { createPortal } from "react-dom";
import { Icon, IconBtn } from "./Icons";
import { Chip, Confirm } from "./base";
import { fmtSize } from "../data/media";
import { FONT, fmt } from "../theme";

// A tiny celebratory burst around the checkbox when an idea is marked done.
// Pure CSS particles — spawned for the 0.7s "completing" window, then gone.
function ConfettiBurst() {
  const colors = ["#2E5BE6", "#7C3AED", "#DB2777", "#EF9F27", "#1D9E75"];
  return (
    <span style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}>
      {Array.from({ length: 10 }).map((_, i) => {
        const ang = (i / 10) * Math.PI * 2;
        const dist = 24 + (i % 3) * 9;
        return (
          <span key={i} style={{ position: "absolute", top: "50%", left: "50%",
            width: 5, height: 5, borderRadius: i % 2 ? "50%" : 1,
            background: colors[i % colors.length],
            "--dx": `${Math.round(Math.cos(ang) * dist)}px`,
            "--dy": `${Math.round(Math.sin(ang) * dist)}px`,
            animation: "confetti .65s ease-out forwards" }} />
        );
      })}
    </span>
  );
}

export default function IdeaCard({ idea, project, projects, showProject, th,
  onUpdate, onDelete, onEdit, onShare, onMove, onAcceptAI, onDismissAI,
  onRemind, onTagClick, onOpenProject, onComments,
  shared = false, commentable = false,
  sortMode = false, dragHandleProps = {} }) {
  const [more, setMore] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bigImg, setBigImg] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);
  const [completing, setCompleting] = useState(false);

  const done = idea.status === "done";
  const showDone = done || completing; // reflect the checked state during the exit animation
  const isLong = (idea.text || "").length > 130;
  const aiProj = idea.aiProject ? projects.find(p => p.id === idea.aiProject) : null;
  const cardBg = (idea.colorIdx != null && th.pastels[idea.colorIdx]) || th.surface;

  // Marking done: show the ✓ + strike-through first, then let the card slide out
  // before the status flips (which is what removes it from the list). Undo is instant.
  const onCheck = () => {
    if (done) { onUpdate({ status: idea.projectId ? "active" : "inbox" }); return; }
    if (completing) return;
    setCompleting(true);
    setTimeout(() => { onUpdate({ status: "done" }); setCompleting(false); }, 700);
  };

  // A "note" idea has no done-checkbox. Turning one on un-dones the idea so it
  // isn't stuck marked-complete with no way to reopen it.
  const toggleNoCheck = () => {
    setMore(false);
    if (idea.noCheck) { onUpdate({ noCheck: false }); return; }
    const patch = { noCheck: true };
    if (idea.status === "done") patch.status = idea.projectId ? "active" : "inbox";
    onUpdate(patch);
  };

  const onCopy = () => {
    navigator.clipboard?.writeText(idea.text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1300);
  };

  return (
    <>
      {/* Modal portals itself to document.body — no wrapper needed here. */}
      {confirmDel && (
        <Confirm title="העברה לפח האשפה" icon="delete"
          message="הרעיון יעבור לפח — אפשר לשחזר משם תוך 30 יום."
          confirmLabel="העבר לפח"
          onConfirm={() => { setConfirmDel(false); onDelete(); }}
          onCancel={() => setConfirmDel(false)} th={th} />
      )}
      {bigImg && createPortal(
        <div onClick={() => setBigImg(null)} style={{ position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.95)", zIndex: 9000,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src={bigImg} alt="" style={{ maxWidth: "92vw", maxHeight: "85vh", borderRadius: 14 }} />
        </div>, document.body)}

      <div style={{ background: cardBg, borderRadius: 14, marginBottom: 10,
        border: `1px solid ${th.border}`,
        // Vivid look: colored cards get a bold side-bar in their accent hue
        borderRight: th.vivid && idea.colorIdx != null
          ? `4px solid ${th.pastelBars[idea.colorIdx]}` : undefined,
        opacity: (done && !completing) ? 0.55 : 1,
        direction: "rtl",
        animation: completing ? "completeOut .7s ease-in forwards" : "fadeUp .18s ease-out" }}>

        <div style={{ display: "flex", alignItems: "flex-start", padding: sortMode ? "12px 13px" : "12px 13px 6px" }}>
          {sortMode ? (
            <div {...dragHandleProps}
              style={{ flexShrink: 0, width: 26, height: 26, marginLeft: 9,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "grab", color: th.muted, fontSize: 17, touchAction: "none", userSelect: "none" }}>
              ⠿
            </div>
          ) : idea.noCheck ? (
            <div title="רעיון ללא סימון ביצוע" style={{
              flexShrink: 0, width: 21, height: 21, marginLeft: 11, marginTop: 2,
              display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Icon name="notes" size={15} color={th.muted} />
            </div>
          ) : (
          <div onClick={shared ? undefined : onCheck} style={{
            flexShrink: 0, width: 21, height: 21, borderRadius: 7, marginLeft: 11, marginTop: 2,
            border: showDone ? "none" : `1.5px solid ${th.borderStrong}`,
            background: showDone ? th.green : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: shared ? "default" : "pointer", transition: "all .15s",
            position: "relative",
            opacity: shared ? 0.55 : 1 }}>
            {showDone && <span style={{ display: "inline-flex",
              animation: completing ? "checkPop .3s ease-out" : "none" }}>
              <Icon name="check" size={13} color="#fff" />
            </span>}
            {completing && <ConfettiBurst />}
          </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            {idea.title && (
              <p onClick={sortMode ? undefined : (shared ? () => setExpanded(p => !p) : onEdit)}
                style={{ margin: "0 0 3px", fontSize: 14.5, fontWeight: 600, color: th.text,
                  textDecoration: showDone ? "line-through" : "none", lineHeight: 1.4,
                  cursor: sortMode ? "default" : "pointer" }}>
                {idea.pinned && <span style={{ display: "inline-flex", verticalAlign: "middle", marginLeft: 4 }}>
                  <Icon name="pin" size={12} color={th.accent} /></span>}
                {idea.title}
              </p>
            )}
            <div onClick={sortMode ? undefined : (shared ? () => setExpanded(p => !p) : onEdit)}
              style={{ fontSize: idea.title ? 13.5 : 14.5, lineHeight: 1.55,
                color: idea.title ? th.secondary : th.text,
                fontWeight: idea.title ? 400 : (showDone ? 400 : 450),
                textDecoration: showDone ? "line-through" : "none",
                cursor: sortMode ? "default" : "pointer",
                whiteSpace: idea.html ? "normal" : "pre-wrap", wordBreak: "break-word",
                overflow: "hidden", display: "-webkit-box",
                WebkitLineClamp: expanded ? "unset" : 3, WebkitBoxOrient: "vertical" }}>
              {!idea.title && idea.pinned && (
                <span style={{ display: "inline-flex", verticalAlign: "middle", marginLeft: 4 }}>
                  <Icon name="pin" size={12} color={th.accent} /></span>
              )}
              {idea.html
                ? <span className="rich-content" dangerouslySetInnerHTML={{ __html: idea.html }} />
                : idea.text}
            </div>
            {isLong && !sortMode && (
              <span onClick={e => { e.stopPropagation(); setExpanded(p => !p); }}
                style={{ display: "inline-block", marginTop: 4, fontSize: 12, fontWeight: 600,
                  color: th.accentText, cursor: "pointer" }}>
                {expanded ? "הצג פחות" : "המשך..."}
              </span>
            )}

            {/* Context chips */}
            {(showProject && project) || idea.tags?.length > 0 || (idea.remindAt && idea.remindAt > Date.now())
              || idea.comments?.length > 0 || idea.createdBy ? (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7 }}>
                {showProject && project && (
                  <Chip th={th} border={th.border} onClick={onOpenProject ? () => onOpenProject(project.id) : undefined}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: project.color }} />
                    {project.name}
                  </Chip>
                )}
                {(idea.tags || []).map(t => (
                  <Chip key={t} th={th}
                    color={th.vivid ? "#fff" : th.accentText}
                    bg={th.vivid ? th.navActive : undefined}
                    onClick={onTagClick ? () => onTagClick(t) : undefined}>#{t}</Chip>
                ))}
                {idea.remindAt && idea.remindAt > Date.now() && (
                  <Chip th={th} color={th.accentText} bg={th.accentSoft}>
                    <Icon name="bell" size={11} color={th.accentText} />
                    {new Date(idea.remindAt).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    {idea.repeat ? " ↻" : ""}
                  </Chip>
                )}
                {idea.comments?.length > 0 && (
                  <Chip th={th} color={th.accentText} bg={th.accentSoft}
                    onClick={onComments}>
                    <Icon name="chat" size={11} color={th.accentText} />
                    {idea.comments.length}
                  </Chip>
                )}
                {idea.createdBy && (
                  <Chip th={th}>
                    <Icon name="edit" size={10} color={th.muted} />
                    {idea.createdBy.name || idea.createdBy.email}
                  </Chip>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* AI project suggestion */}
        {aiProj && !idea.projectId && !done && !sortMode && (
          <div style={{ margin: "2px 13px 8px 13px", display: "flex", alignItems: "center", gap: 7,
            background: th.accentSoft, borderRadius: 10, padding: "7px 11px" }}>
            <Icon name="sparkle" size={14} color={th.accentText} />
            <span style={{ flex: 1, fontSize: 12.5, color: th.accentText, fontWeight: 500 }}>
              להעביר אל "{aiProj.name}"?
            </span>
            <button onClick={onAcceptAI}
              style={{ background: th.accent, color: "#fff", border: "none", borderRadius: 8,
                padding: "4px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: FONT }}>כן</button>
            <button onClick={onDismissAI}
              style={{ background: "transparent", color: th.accentText, border: "none",
                padding: "4px 6px", fontSize: 12, cursor: "pointer", fontFamily: FONT }}>לא</button>
          </div>
        )}

        {!sortMode && idea.images?.length > 0 && (
          <div style={{ display: "flex", gap: 6, padding: "0 13px 8px", flexWrap: "wrap" }}>
            {idea.images.map((src, i) => (
              <img key={i} src={src} alt="" onClick={() => setBigImg(src)}
                style={{ width: 62, height: 62, objectFit: "cover", borderRadius: 10, cursor: "pointer" }} />
            ))}
          </div>
        )}
        {!sortMode && idea.audios?.length > 0 && (
          <div style={{ padding: "0 13px 8px", display: "flex", flexDirection: "column", gap: 5 }}>
            {idea.audios.map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7,
                background: th.surface2, borderRadius: 9, padding: "5px 10px", border: `1px solid ${th.border}` }}>
                <Icon name="music" size={13} color={th.secondary} />
                <audio src={a.url || a.src} controls style={{ flex: 1, height: 28 }} />
              </div>
            ))}
          </div>
        )}
        {!sortMode && idea.files?.length > 0 && (
          <div style={{ padding: "0 13px 8px", display: "flex", flexDirection: "column", gap: 5 }}>
            {idea.files.map((f, i) => (
              <a key={i} href={f.url} target="_blank" rel="noopener noreferrer" download={f.name}
                onClick={e => e.stopPropagation()}
                style={{ display: "flex", alignItems: "center", gap: 8, textDecoration: "none",
                  background: th.surface2, borderRadius: 9, padding: "8px 10px", border: `1px solid ${th.border}` }}>
                <Icon name="clip" size={14} color={th.secondary} />
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: th.text,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {f.name}
                  {f.size ? <span style={{ color: th.muted, fontSize: 11 }}>{"  "}· {fmtSize(f.size)}</span> : null}
                </span>
                <Icon name="download" size={14} color={th.muted} />
              </a>
            ))}
          </div>
        )}

        {/* Action row — guests get a slim read-only strip */}
        {!sortMode && shared && (
        <div style={{ borderTop: `1px solid ${th.border}`, padding: "3px 8px",
          display: "flex", alignItems: "center", minHeight: 38 }}>
          <IconBtn name="chat" onClick={onComments} color={th.accent} size={18} pad="6px 8px" title="תגובות" />
          <IconBtn name={copied ? "check" : "copy"} onClick={onCopy}
            color={copied ? th.green : th.muted} size={18} pad="6px 8px" />
          <span style={{ marginRight: "auto", fontSize: 10.5, color: th.muted,
            display: "flex", alignItems: "center", gap: 4, paddingLeft: 4 }}>
            {fmt(idea.createdAt)}
          </span>
        </div>
        )}

        {/* Action row */}
        {!sortMode && !shared && (
        <div style={{ borderTop: `1px solid ${th.border}`, padding: "3px 8px",
          display: "flex", alignItems: "center", flexWrap: "wrap", minHeight: 38 }}>
          {!more ? (
            <>
              <IconBtn name={copied ? "check" : "copy"} onClick={onCopy}
                color={copied ? th.green : th.muted} size={18} pad="6px 8px" />
              <IconBtn name="pin" onClick={() => onUpdate({ pinned: !idea.pinned })}
                color={idea.pinned ? th.accent : th.muted} size={18} pad="6px 8px" />
              <IconBtn name="bell" onClick={onRemind}
                color={idea.remindAt && idea.remindAt > Date.now() ? th.accent : th.muted}
                size={18} pad="6px 8px" title="תזכורת" />
              {commentable && (
                <IconBtn name="chat" onClick={onComments} color={th.muted} size={18} pad="6px 8px" title="תגובות" />
              )}
              <IconBtn name="folder" onClick={onMove} color={th.muted} size={18} pad="6px 8px" title="העבר לפרויקט" />
              <IconBtn name="more" onClick={() => setMore(true)} color={th.muted} size={18} pad="6px 8px" style={{ opacity: 0.6 }} />
              <span style={{ marginRight: "auto", fontSize: 10.5, color: th.muted,
                display: "flex", alignItems: "center", gap: 4, paddingLeft: 4 }}>
                {fmt(idea.createdAt)}
              </span>
            </>
          ) : (
            <>
              <IconBtn name="back" onClick={() => setMore(false)} color={th.accent} size={17} pad="6px 8px" />
              <div style={{ width: 1, height: 15, background: th.border, margin: "0 4px" }} />
              <IconBtn name="delete" onClick={() => { setMore(false); setConfirmDel(true); }}
                color={th.red} size={18} pad="6px 8px" title="העבר לפח האשפה" />
              <IconBtn name="share" onClick={onShare} color={th.muted} size={18} pad="6px 8px" />
              <IconBtn name="notes" onClick={toggleNoCheck}
                color={idea.noCheck ? th.accent : th.muted} size={18} pad="6px 8px"
                title={idea.noCheck ? "החזר סימון ביצוע" : "רעיון ללא סימון ביצוע"} />
              <div style={{ display: "flex", gap: 5, marginRight: 6, alignItems: "center" }}>
                <div onClick={() => onUpdate({ colorIdx: null })} title="ללא צבע"
                  style={{ width: 17, height: 17, borderRadius: "50%", background: th.surface,
                    border: `1.5px solid ${idea.colorIdx == null ? th.accent : th.borderStrong}`,
                    cursor: "pointer", flexShrink: 0, display: "flex",
                    alignItems: "center", justifyContent: "center" }}>
                  <Icon name="close" size={8} color={th.muted} />
                </div>
                {th.pastels.map((c, i) => (
                  <div key={i} onClick={() => onUpdate({ colorIdx: i })}
                    style={{ width: 17, height: 17, borderRadius: "50%", background: c,
                      border: `1.5px solid ${idea.colorIdx === i ? th.accent : th.border}`,
                      cursor: "pointer", flexShrink: 0 }} />
                ))}
              </div>
            </>
          )}
        </div>
        )}
      </div>
    </>
  );
}
