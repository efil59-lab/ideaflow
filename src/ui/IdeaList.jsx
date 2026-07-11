// Shared list renderer: sorts (pinned → manual order → newest) and wires
// card actions. sortMode turns the list into a drag-to-reorder surface.
import { DndContext, closestCenter, PointerSensor, TouchSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import IdeaCard from "./IdeaCard";
import { Icon } from "./Icons";
import { FONT } from "../theme";

// Manual order wins when set; otherwise newest-first (negative timestamps sort
// new items to the top, above any explicitly ordered block).
const eff = i => (typeof i.order === "number" ? i.order : -(i.createdAt || 0));

export default function IdeaList({ ideas, projects, showProject = false, th, actions,
  emptyText, sortMode = false, onReorder, shared = false, myShares = {} }) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } })
  );

  // "Note" ideas (noCheck) always sink to the bottom, below everything else;
  // among the rest, pinned first, then manual order / newest.
  const sorted = [...ideas].sort((a, b) =>
    (a.noCheck ? 1 : 0) - (b.noCheck ? 1 : 0)
    || (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0)
    || eff(a) - eff(b));

  if (!sorted.length) return (
    <div style={{ textAlign: "center", padding: "36px 0", color: th.muted }}>
      <Icon name="bulb" size={40} color={th.border} />
      <p style={{ fontSize: 14, marginTop: 8 }}>{emptyText || "אין רעיונות כאן"}</p>
    </div>
  );

  const card = (idea, extra = {}) => (
    <IdeaCard idea={idea} th={th} {...extra}
      projects={projects}
      project={projects.find(p => p.id === idea.projectId)}
      showProject={showProject}
      shared={shared}
      commentable={shared || !!myShares[idea.projectId]}
      onComments={() => actions.comments?.(idea)}
      onUpdate={patch => actions.update?.(idea.id, patch, idea)}
      onDelete={() => actions.remove?.(idea)}
      onEdit={() => actions.edit?.(idea)}
      onShare={() => actions.share?.(idea)}
      onMove={() => actions.move?.(idea)}
      onRemind={() => actions.remind?.(idea)}
      onTagClick={actions.tag}
      onOpenProject={actions.openProject}
      onAcceptAI={() => actions.update?.(idea.id, { projectId: idea.aiProject, aiProject: null, status: "active" }, idea)}
      onDismissAI={() => actions.update?.(idea.id, { aiProject: null }, idea)}
    />
  );

  if (!sortMode) return sorted.map(idea => <div key={idea.id}>{card(idea)}</div>);

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter}
      onDragEnd={e => {
        const { active, over } = e;
        if (!over || active.id === over.id) return;
        const oldI = sorted.findIndex(i => i.id === active.id);
        const newI = sorted.findIndex(i => i.id === over.id);
        onReorder?.(arrayMove(sorted, oldI, newI).map(i => i.id));
      }}>
      <SortableContext items={sorted.map(i => i.id)} strategy={verticalListSortingStrategy}>
        {sorted.map(idea => <SortableRow key={idea.id} idea={idea} render={card} />)}
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({ idea, render }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: idea.id });
  return (
    <div ref={setNodeRef} style={{
      transform: CSS.Transform.toString(transform), transition,
      opacity: isDragging ? 0.55 : 1, position: "relative", zIndex: isDragging ? 10 : 1 }}>
      {render(idea, { sortMode: true, dragHandleProps: { ...attributes, ...listeners } })}
    </div>
  );
}

// Small pill that toggles sort mode — shown above sortable lists.
export function SortToggle({ sortMode, setSortMode, th }) {
  return (
    <button onClick={() => setSortMode(s => !s)}
      style={{ display: "inline-flex", alignItems: "center", gap: 5,
        background: sortMode ? th.accent : th.surface,
        color: sortMode ? "#fff" : th.secondary,
        border: `1px solid ${sortMode ? th.accent : th.border}`,
        borderRadius: 18, padding: "4px 12px", cursor: "pointer",
        fontSize: 12, fontWeight: 600, fontFamily: FONT }}>
      {sortMode ? "✓ סיים" : "↕ סדר"}
    </button>
  );
}
