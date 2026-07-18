import { TemplateEditor } from "@/components/templates/TemplateEditor";
import { listTemplates } from "@/lib/publications/application";
export const dynamic = "force-dynamic";
export default async function TemplatesPage() { const templates = await listTemplates(); return <TemplateEditor templates={templates.map(({ id, name, platform, content, isDefault, isActive }) => ({ id, name, platform, content, isDefault, isActive }))} />; }
