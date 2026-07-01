// Shared list renderer: sorts (pinned → newest) and wires card actions.
import IdeaCard from "./IdeaCard";
import { Icon } from "./Icons";

export default function IdeaList({ ideas, projects, showProject = false, th, actions, emptyText }) {
  const sorted = [...ideas].sort((a, b) =>
    (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || (b.createdAt || 0) - (a.createdAt || 0));

  if (!sorted.length) return (
    <div style={{ textAlign: "center", padding: "36px 0", color: th.muted }}>
      <Icon name="bulb" size={40} color={th.border} />
      <p style={{ fontSize: 14, marginTop: 8 }}>{emptyText || "אין רעיונות כאן"}</p>
    </div>
  );

  return sorted.map(idea => (
    <IdeaCard key={idea.id} idea={idea} th={th}
      projects={projects}
      project={projects.find(p => p.id === idea.projectId)}
      showProject={showProject}
      onUpdate={patch => actions.update(idea.id, patch)}
      onDelete={() => actions.remove(idea.id)}
      onEdit={() => actions.edit(idea)}
      onShare={() => actions.share(idea)}
      onMove={() => actions.move(idea)}
      onAcceptAI={() => actions.update(idea.id, { projectId: idea.aiProject, aiProject: null, status: "active" })}
      onDismissAI={() => actions.update(idea.id, { aiProject: null })}
    />
  ));
}
