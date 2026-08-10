import type { Metadata } from "next";
import { getPublicAppUrl } from "@/lib/runtime/public-url";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: getPublicAppUrl(),
  title: "Painel Achadinhos Muito Top",
  description: "Gestão inteligente de produtos, publicações e canais em um só lugar.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
  openGraph: {
    title: "Painel Achadinhos Muito Top",
    description: "Produtos, publicações e resultados. Tudo no controle.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Painel Achadinhos Muito Top",
    description: "Produtos, publicações e resultados. Tudo no controle.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
