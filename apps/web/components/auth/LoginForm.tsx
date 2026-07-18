"use client";

import { loginInputSchema } from "@achadinhos/shared";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const form = new FormData(event.currentTarget);
    const parsed = loginInputSchema.safeParse({ email: form.get("email"), password: form.get("password") });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Confira os dados informados.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = await response.json() as { error?: string };
      if (!response.ok) {
        setError(data.error ?? "Não foi possível entrar. Tente novamente.");
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Não foi possível conectar. Verifique sua internet e tente novamente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-card">
      <div className="login-card-header"><span className="mini-brand">A</span><div><strong>Bem-vindo de volta</strong><small>Entre para acessar seu painel</small></div></div>
      <form onSubmit={submit} noValidate>
        <label>E-mail<input name="email" type="email" autoComplete="username" placeholder="seu@email.com" disabled={loading} required /></label>
        <label>Senha<input name="password" type="password" autoComplete="current-password" placeholder="Sua senha" minLength={12} maxLength={128} disabled={loading} required /></label>
        {error && <div className="form-error" role="alert">! {error}</div>}
        <button className="primary large" disabled={loading} type="submit">{loading ? <><span className="spinner"/>Entrando...</> : "Entrar no painel →"}</button>
      </form>
      <p className="login-help">O acesso é exclusivo do administrador. Não há cadastro público.</p>
    </div>
  );
}
