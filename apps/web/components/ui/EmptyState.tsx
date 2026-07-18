import Link from "next/link";

export function EmptyState({ icon, title, description, action }: { icon: string; title: string; description: string; action?: { label: string; href: string } }) {
  return <div className="empty-state"><span>{icon}</span><h2>{title}</h2><p>{description}</p>{action && <Link className="primary action-link" href={action.href}>{action.label}</Link>}</div>;
}
