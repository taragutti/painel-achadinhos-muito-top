"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

type ProductRow = {
  id: string;
  title: string;
  marketplace: string;
  status: string;
  storeName: string | null;
  currentPrice: string | null;
  oldPrice: string | null;
  thumbnailImageUrl: string | null;
  storedImageUrl: string | null;
  originalImageUrl: string | null;
  affiliateConfirmed: boolean;
  createdAt: string;
  lastPublishedAt: string | null;
};

export function ProductsView({
  initialProducts,
}: {
  initialProducts: ProductRow[];
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [confirm, setConfirm] = useState<{
    id: string;
    action: "archive" | "delete";
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function filter(name: string, value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value);
    else next.delete(name);
    router.push(`/produtos?${next}`);
  }
  async function action(id: string, actionName: string) {
    setBusy(`${id}:${actionName}`);
    setMessage(null);
    const response = await fetch(`/api/products/${id}`, {
      method: actionName === "delete" ? "DELETE" : "PATCH",
      headers: { "content-type": "application/json" },
      body:
        actionName === "delete"
          ? undefined
          : JSON.stringify({ action: actionName }),
    });
    const data = (await response.json()) as {
      error?: string;
      warning?: string;
    };
    setBusy(null);
    setConfirm(null);
    if (!response.ok)
      setMessage(data.error ?? "Não foi possível concluir a ação.");
    else {
      setMessage(data.warning ?? "Ação concluída.");
      router.refresh();
    }
  }

  return (
    <main className="page-content products-page">
      <header className="page-heading">
        <div>
          <span className="eyebrow">CATÁLOGO</span>
          <h1>Produtos</h1>
          <p>Revise, reutilize e organize seus achadinhos.</p>
        </div>
        <Link className="primary action-link" href="/publicacoes/nova">
          + Novo produto
        </Link>
      </header>
      <form
        className="product-filters"
        onSubmit={(event) => {
          event.preventDefault();
          filter("q", String(new FormData(event.currentTarget).get("q") ?? ""));
        }}
      >
        <input
          name="q"
          defaultValue={params.get("q") ?? ""}
          placeholder="Buscar produto, loja ou cupom..."
        />
        <select
          value={params.get("marketplace") ?? ""}
          onChange={(event) => filter("marketplace", event.target.value)}
        >
          <option value="">Todos os marketplaces</option>
          <option value="SHOPEE">Shopee</option>
          <option value="MERCADO_LIVRE">Mercado Livre</option>
          <option value="OTHER">Outros</option>
        </select>
        <select
          value={params.get("status") ?? ""}
          onChange={(event) => filter("status", event.target.value)}
        >
          <option value="">Status atuais</option>
          <option value="DRAFT">Rascunhos</option>
          <option value="ACTIVE">Ativos</option>
          <option value="ARCHIVED">Arquivados</option>
        </select>
        <button className="secondary">Buscar</button>
      </form>
      {message && <div className="form-message success">{message}</div>}
      {!initialProducts.length ? (
        <section className="content-card empty-state">
          <span>◇</span>
          <h2>Nenhum produto encontrado</h2>
          <p>Importe um produto por link ou ajuste os filtros.</p>
          <Link className="primary action-link" href="/publicacoes/nova">
            Importar produto
          </Link>
        </section>
      ) : (
        <section className="product-list">
          {initialProducts.map((product) => (
            <article className="product-row content-card" key={product.id}>
              <div className="product-row-image">
                {product.thumbnailImageUrl || product.storedImageUrl || product.originalImageUrl ? (
                  <Image
                    src={
                      product.thumbnailImageUrl || product.storedImageUrl || product.originalImageUrl || ""
                    }
                    alt=""
                    fill
                    sizes="72px"
                    unoptimized
                  />
                ) : (
                  "◇"
                )}
              </div>
              <div className="product-row-main">
                <div className="row-badges">
                  <span>{marketplaceLabel(product.marketplace)}</span>
                  <span className={product.status.toLowerCase()}>
                    {statusLabel(product.status)}
                  </span>
                  {product.affiliateConfirmed && (
                    <span className="confirmed">Afiliado ✓</span>
                  )}
                </div>
                <h2>{product.title}</h2>
                <p>
                  {product.storeName || "Loja não informada"} ·{" "}
                  {new Date(product.createdAt).toLocaleDateString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })}
                </p>
                <p>
                  Última publicação:{" "}
                  {product.lastPublishedAt
                    ? new Date(product.lastPublishedAt).toLocaleString(
                        "pt-BR",
                        { timeZone: "America/Sao_Paulo" },
                      )
                    : "Nunca"}
                </p>
              </div>
              <div className="product-row-price">
                {product.oldPrice && <del>R$ {product.oldPrice}</del>}
                <strong>
                  {product.currentPrice
                    ? `R$ ${product.currentPrice}`
                    : "Sem preço"}
                </strong>
              </div>
              <div className="row-actions">
                <button
                  onClick={() => void action(product.id, "publication")}
                  disabled={busy !== null}
                >
                  Criar publicação
                </button>
                <button
                  onClick={() => void action(product.id, "queue")}
                  disabled={busy !== null}
                >
                  Adicionar à fila
                </button>
                <button
                  onClick={() => void action(product.id, "duplicate")}
                  disabled={busy !== null}
                >
                  Duplicar
                </button>
                <button
                  onClick={() =>
                    router.push(`/publicacoes/nova?productId=${product.id}`)
                  }
                >
                  Editar
                </button>
                <button
                  onClick={() =>
                    setConfirm({ id: product.id, action: "archive" })
                  }
                >
                  Arquivar
                </button>
                <button
                  className="danger-text"
                  onClick={() =>
                    setConfirm({ id: product.id, action: "delete" })
                  }
                >
                  Remover
                </button>
              </div>
            </article>
          ))}
        </section>
      )}
      {confirm && (
        <ConfirmDialog
          open
          title={
            confirm.action === "delete"
              ? "Remover produto?"
              : "Arquivar produto?"
          }
          description={
            confirm.action === "delete"
              ? "O produto será removido com soft delete. O histórico de publicações será preservado."
              : "O produto deixará de aparecer entre os itens ativos."
          }
          confirmLabel={confirm.action === "delete" ? "Remover" : "Arquivar"}
          onCancel={() => setConfirm(null)}
          onConfirm={() => void action(confirm.id, confirm.action)}
        />
      )}
    </main>
  );
}

function marketplaceLabel(value: string) {
  return value === "MERCADO_LIVRE"
    ? "Mercado Livre"
    : value === "SHOPEE"
      ? "Shopee"
      : "Outro";
}
function statusLabel(value: string) {
  return value === "DRAFT"
    ? "Rascunho"
    : value === "ACTIVE"
      ? "Ativo"
      : "Arquivado";
}
