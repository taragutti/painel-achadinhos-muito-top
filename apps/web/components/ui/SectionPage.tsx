import { EmptyState } from "./EmptyState";

export function SectionPage({ title, description, icon, emptyTitle, emptyDescription, action }: { title: string; description: string; icon: string; emptyTitle: string; emptyDescription: string; action?: { label: string; href: string } }) {
  return <><div className="page-heading"><div><span className="eyebrow">PAINEL ACHADINHOS</span><h1>{title}</h1><p>{description}</p></div></div><section className="content-card"><EmptyState icon={icon} title={emptyTitle} description={emptyDescription} action={action}/></section></>;
}
