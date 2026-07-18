import { redirect } from "next/navigation";
import { getAuthenticatedAdmin } from "@/lib/auth/session";
import { LoginForm } from "@/components/auth/LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await getAuthenticatedAdmin()) redirect("/dashboard");

  return (
    <main className="login-page">
      <section className="login-brand" aria-label="Painel Achadinhos Muito Top">
        <div className="brand-lockup"><span className="brand-mark">A</span><span>ACHADINHOS<br/><strong>MUITO TOP</strong></span></div>
        <div className="login-copy">
          <span className="eyebrow">ACESSO RESTRITO</span>
          <h1>Seus achadinhos.<br/><em>Sob controle.</em></h1>
          <p>Organize produtos, prepare publicações e acompanhe seus canais em um painel privado.</p>
        </div>
        <div className="login-security">● Ambiente protegido para o administrador</div>
      </section>
      <section className="login-panel">
        <LoginForm />
      </section>
    </main>
  );
}
