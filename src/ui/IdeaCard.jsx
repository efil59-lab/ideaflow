// Idea card — title line, clamped body, context chips, quiet action row.
import { useState } from "react";
import { createPortal } from "react-dom";
import { Icon, IconBtn } from "./Icons";
import { Chip, Confirm } from "./base";
import { FONT, fmt } from "../theme";

export default function IdeaCard({ idea, project, projects, showProject, th,
  onUpdate, onDelete, onEdit, onShare, onMove, onAcceptAI, onDismissAI,
  onRemind, onTagClick, onOpenProject,
  sortMode = false, dragHandleProps = {} }) {
  const [more, setMore] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bigImg, setBigImg] = useState(null);
  const [expanded, setExpanded] = useState(false);
  const [confirmDel, setConfirmDel] = useState(false);

  const done = idea.status === "done";
  const isLong = (idea.text || "").length > 130;
  const aiProj = idea.aiProject ? projects.find(p => p.id === idea.aiProject) : null;
  const cardBg = (idea.colorIdx != null && th.pastels[idea.colorIdx]) || th.surface;

  const onCheck = () => onUpdate({ status: done ? (idea.projectId ? "active" : "inbox") : "done" });

  const onCopy = () => {
    navigator.clipboard?.writeText(idea.text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1300);
  };

  return (
    <>
      {confirmDel && createPortal(
        <div style={{ position: "fixed", inset: 0, zIndex: 9000 }}>
          <Confirm title="העברה לפח האשפה" icon="delete"
            message="הרעיון יעבור לפח — אפשר לשחזר משם תוך 30 יום."
            confirmLabel="העבר לפח"
            onConfirm={() => { setConfirmDel(false); onDelete(); }}
            onCancel={() => setConfirmDel(false)} th={th} />
        </div>, document.body)}
      {bigImg && createPortal(
        <div onClick={() => setBigImg(null)} style={{ position: "fixed", inset: 0,
          background: "rgba(0,0,0,0.95)", zIndex: 9000,
          display: "flex", alignItems: "center", justifyContent: "center" }}>
          <img src={bigImg} alt="" style={{ maxWidth: "92vw", maxHeight: "85vh", borderRadius: 14 }} />
        </div>, document.body)}

      <div style={{ background: cardBg, borderRadius: 14, marginBottom: 10,
        border: `1px solid ${th.border}`, opacity: done ? 0.55 : 1,
        direction: "rtl", animation: "fadeUp .18s ease-out" }}>

        <div style={{ display: "flex", alignItems: "flex-start", padding: sortMode ? "12px 13px" : "12px 13px 6px" }}>
          {sortMode ? (
            <div {...dragHandleProps}
              style={{ flexShrink: 0, width: 26, height: 26, marginLeft: 9,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "grab", color: th.muted, fontSize: 17, touchAction: "none", userSelect: "none" }}>
              ⠿
            </div>
          ) : (
          <div onClick={onCheck} style={{
            flexShrink: 0, width: 21, height: 21, borderRadius: 7, marginLeft: 11, marginTop: 2,
            border: done ? "none" : `1.5px solid ${th.borderStrong}`,
            background: done ? th.green : "transparent",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", transition: "all .15s" }}>
            {done && <Icon name="check" size={13} color="#fff" />}
          </div>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            {idea.title && (
              <p onClick={sortMode ? undefined : onEdit}
                style={{ margin: "0 0 3px", fontSize: 14.5, fontWeight: 600, color: th.text,
                  textDecoration: done ? "line-through" : "none", lineHeight: 1.4,
                  cursor: sortMode ? "default" : "pointer" }}>
                {idea.pinned && <span style={{ display: "inline-flex", verticalAlign: "middle", marginLeft: 4 }}>
                  <Icon name="pin" size={12} color={th.accent} /></span>}
                {idea.title}
              </p>
            )}
            <div onClick={sortMode ? undefined : onEdit}
              style={{ fontSize: idea.title ? 13.5 : 14.5, lineHeight: 1.55,
                color: idea.title ? th.secondary : th.text,
                fontWeight: idea.title ? 400 : (done ? 400 : 450),
                textDecoration: done ? "line-through" : "none",
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
            {(showProject && project) || idea.tags?.length > 0 || (idea.remindAt && idea.remindAt > Date.now()) ? (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 7 }}>
                {showProject && project && (
                  <Chip th={th} border={th.border} onClick={onOpenProject ? () => onOpenProject(project.id) : undefined}>
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: project.color }} />
                    {project.name}
                  </Chip>
                )}
                {(idea.tags || []).map(t => (
                  <Chip key={t} th={th} color={th.accentText}
                    onClick={onTagClick ? () => onTagClick(t) : undefined}>#{t}</Chip>
                ))}
                {idea.remindAt && idea.remindAt > Date.now() && (
                  <Chip th={th} color={th.accentText} bg={th.accentSoft}>
                    <Icon name="bell" size={11} color={th.accentText} />
                    {new Date(idea.remindAt).toLocaleString("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
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

        {/* Action row */}
        {!sortMode && (
        <div style={{ borderTop: `1px solid ${th.border}`, padding: "3px 8px",
          display: "flex", alignItems: "center", minHeight: 38 }}>
          {!more ? (
            <>
              <IconBtn name={copied ? "check" : "copy"} onClick={onCopy}
                color={copied ? th.green : th.muted} size={18} pad="6px 8px" />
              <IconBtn name="pin" onClick={() => onUpdate({ pinned: !idea.pinned })}
                color={idea.pinned ? th.accent : th.muted} size={18} pad="6px 8px" />
              <IconBtn name="bell" onClick={onRemind}
                color={idea.remindAt && idea.remindAt > Date.now() ? th.accent : th.muted}
                size={18} pad="6px 8px" title="תזכורת" />
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
