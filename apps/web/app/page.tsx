"use client";

import { useState } from "react";

const nav = [
  ["Visão geral", "⌂"],
  ["Produtos", "◇"],
  ["Publicações", "↗"],
  ["Templates", "▣"],
  ["Fila & agenda", "◷"],
  ["Histórico", "≡"],
];

const products = [
  { icon: "🎧", name: "Fone Bluetooth TWS Pro", store: "Amazon", price: "R$ 89,90", old: "R$ 149,90", off: "40% OFF", status: "Agendado", time: "Hoje, 14:30" },
  { icon: "⌚", name: "Smartwatch Ultra 9", store: "Shopee", price: "R$ 119,99", old: "R$ 219,90", off: "45% OFF", status: "Na fila", time: "Próximo da fila" },
  { icon: "☕", name: "Cafeteira Elétrica 15 Bar", store: "Mercado Livre", price: "R$ 299,00", old: "R$ 479,00", off: "38% OFF", status: "Rascunho", time: "Não agendado" },
  { icon: "💡", name: "Kit 4 Lâmpadas Smart RGB", store: "AliExpress", price: "R$ 72,50", old: "R$ 109,90", off: "34% OFF", status: "Publicado", time: "Hoje, 10:05" },
];

const scheduled = [
  { time: "14:30", title: "Fone Bluetooth TWS Pro", channels: "Telegram + WhatsApp", tone: "lime" },
  { time: "16:00", title: "Air Fryer Mondial 5L", channels: "Telegram", tone: "purple" },
  { time: "18:45", title: "Cupom relâmpago SHEIN", channels: "WhatsApp", tone: "orange" },
];

export default function Home() {
  const [active, setActive] = useState("Visão geral");
  const [toast, setToast] = useState("");
  const [search, setSearch] = useState("");

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2400);
  }

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark">A</span><span>ACHADINHOS<br/><b>MUITO TOP</b></span></div>
        <div className="workspace"><span className="avatar small">MT</span><div><strong>Muito Top</strong><small>Workspace principal</small></div><span>⌄</span></div>
        <nav>
          <p>MENU</p>
          {nav.map(([label, icon]) => <button key={label} onClick={() => setActive(label)} className={active === label ? "active" : ""}><i>{icon}</i>{label}{label === "Fila & agenda" && <em>3</em>}</button>)}
          <p>GESTÃO</p>
          <button onClick={() => setActive("Configurações")} className={active === "Configurações" ? "active" : ""}><i>⚙</i>Configurações</button>
          <button onClick={() => setActive("Ajuda")} className={active === "Ajuda" ? "active" : ""}><i>?</i>Ajuda & suporte</button>
        </nav>
        <div className="plan-card"><span>PLANO PRO</span><strong>8.420 / 10.000</strong><small>publicações este mês</small><div><b /></div><button onClick={() => notify("Planos abertos")}>Gerenciar plano →</button></div>
        <div className="profile"><span className="avatar">TA</span><div><strong>Thiago Aragutti</strong><small>Administrador</small></div><button>•••</button></div>
      </aside>

      <section className="content">
        <header>
          <div><button className="mobile-menu">☰</button><h1>{active}</h1><p>Olá, Thiago! Aqui está o resumo dos seus achadinhos.</p></div>
          <div className="header-actions"><label className="search">⌕<input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto..."/><kbd>⌘ K</kbd></label><button className="icon-button">♧<span /></button><button className="primary" onClick={() => notify("Novo produto iniciado")}>＋ Novo produto</button></div>
        </header>

        <div className="metrics">
          <article><div className="metric-icon green">↗</div><span>PUBLICAÇÕES HOJE</span><strong>24</strong><small className="positive">↗ 12% <b>vs. ontem</b></small><div className="spark green-spark">▁▂▃▂▄▅▄▆▅▇</div></article>
          <article><div className="metric-icon purple">◉</div><span>CLIQUES NOS LINKS</span><strong>1.842</strong><small className="positive">↗ 18,4% <b>esta semana</b></small><div className="spark purple-spark">▂▃▂▄▃▅▄▆▇▆</div></article>
          <article><div className="metric-icon orange">%</div><span>CONVERSÃO MÉDIA</span><strong>8,7%</strong><small className="negative">↘ 1,2% <b>esta semana</b></small><div className="spark orange-spark">▇▆▅▆▄▅▃▄▂▃</div></article>
          <article><div className="metric-icon blue">◷</div><span>NA FILA</span><strong>12</strong><small>Próxima em <b className="white">8 min</b></small><div className="mini-avatars"><i>🎧</i><i>⌚</i><i>☕</i><i>+9</i></div></article>
        </div>

        <div className="grid-main">
          <article className="panel performance">
            <div className="panel-title"><div><h2>Performance das publicações</h2><p>Cliques nos últimos 7 dias</p></div><button>Últimos 7 dias⌄</button></div>
            <div className="legend"><span><i className="dot tg"/>Telegram <b>7.420</b></span><span><i className="dot wa"/>WhatsApp <b>4.180</b></span></div>
            <div className="chart"><div className="ylabels"><span>2k</span><span>1,5k</span><span>1k</span><span>500</span><span>0</span></div><div className="chart-area"><div className="gridlines"/><svg viewBox="0 0 700 205" preserveAspectRatio="none" aria-label="Gráfico de desempenho"><defs><linearGradient id="area" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#b9f227" stopOpacity=".28"/><stop offset="1" stopColor="#b9f227" stopOpacity="0"/></linearGradient></defs><path className="area" d="M0,160 C70,145 85,90 150,110 S235,165 300,115 S385,60 450,85 S530,120 590,55 S655,35 700,20 L700,205 L0,205Z"/><path className="line telegram" d="M0,160 C70,145 85,90 150,110 S235,165 300,115 S385,60 450,85 S530,120 590,55 S655,35 700,20"/><path className="line whatsapp" d="M0,178 C80,160 105,145 160,150 S250,118 310,145 S390,110 450,125 S530,90 590,112 S650,72 700,82"/></svg><div className="xlabels"><span>Seg</span><span>Ter</span><span>Qua</span><span>Qui</span><span>Sex</span><span>Sáb</span><span>Dom</span></div></div></div>
          </article>

          <article className="panel agenda"><div className="panel-title"><div><h2>Próximas publicações</h2><p>Hoje, 18 de julho</p></div><button className="link" onClick={() => setActive("Fila & agenda")}>Ver agenda →</button></div>
            <div className="timeline">{scheduled.map((item, i) => <div className="event" key={item.time}><time>{item.time}</time><i className={item.tone}/><div><strong>{item.title}</strong><small>{item.channels}</small></div><button>•••</button>{i < scheduled.length - 1 && <span className="rail"/>}</div>)}</div>
            <button className="outline" onClick={() => notify("Agendamento iniciado")}>＋ Agendar publicação</button>
          </article>
        </div>

        <article className="panel table-panel">
          <div className="panel-title"><div><h2>Produtos recentes</h2><p>Seus últimos produtos cadastrados</p></div><button className="link" onClick={() => setActive("Produtos")}>Ver todos →</button></div>
          <div className="table"><div className="tr th"><span>PRODUTO</span><span>PREÇO</span><span>DESCONTO</span><span>STATUS</span><span>PUBLICAÇÃO</span><span/></div>
            {products.filter(p => p.name.toLowerCase().includes(search.toLowerCase())).map(p => <div className="tr" key={p.name}><span className="product"><i>{p.icon}</i><span><strong>{p.name}</strong><small>{p.store}</small></span></span><span className="price"><strong>{p.price}</strong><s>{p.old}</s></span><span><b className="discount">{p.off}</b></span><span><b className={`status ${p.status.toLowerCase().replace(" ", "-")}`}>● {p.status}</b></span><span className="publish"><strong>{p.time}</strong><small>{p.status === "Publicado" ? "2 canais" : p.status === "Agendado" ? "Telegram + WhatsApp" : ""}</small></span><button>•••</button></div>)}
          </div>
        </article>
        <footer><span><i className="online"/>Todos os sistemas operacionais</span><span>Telegram conectado · WhatsApp conectado</span></footer>
      </section>
      {toast && <div className="toast">✓ {toast}</div>}
    </main>
  );
}
