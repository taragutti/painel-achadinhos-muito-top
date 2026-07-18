"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { navigation } from "./navigation";

export function AppShell({ adminName, children }: { adminName: string; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  async function logout() {
    setLoggingOut(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    finally { router.replace("/login"); router.refresh(); }
  }

  return (
    <div className="shell">
      {open && <button className="menu-backdrop" aria-label="Fechar menu" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="brand-lockup sidebar-brand"><span className="brand-mark">A</span><span>ACHADINHOS<br/><strong>MUITO TOP</strong></span></div>
        <nav aria-label="Menu principal">
          <span className="nav-label">MENU PRINCIPAL</span>
          {navigation.map(item => {
            const active = item.href === "/dashboard" ? pathname === item.href : pathname.startsWith(item.href);
            return <Link key={item.href} href={item.href} className={active ? "active" : ""} onClick={() => setOpen(false)}><i>{item.icon}</i><span>{item.label}</span>{"badge" in item && <b>{item.badge}</b>}</Link>;
          })}
        </nav>
        <div className="sidebar-status"><span className="status-dot"/><div><strong>Modo seguro</strong><small>Envios externos desativados</small></div></div>
        <button className="sidebar-logout" onClick={logout} disabled={loggingOut}>↪ <span>{loggingOut ? "Saindo..." : "Sair do painel"}</span></button>
      </aside>
      <div className="workspace-content">
        <header className="topbar">
          <button className="mobile-menu" aria-label="Abrir menu" onClick={() => setOpen(true)}>☰</button>
          <div className="topbar-spacer" />
          <div className="admin-profile"><span>{initials(adminName)}</span><div><strong>{adminName}</strong><small>Administrador</small></div></div>
        </header>
        <main className="page-content">{children}</main>
      </div>
    </div>
  );
}

function initials(name: string) {
  return name.split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
}
