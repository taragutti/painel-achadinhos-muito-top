import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
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
  return <html lang="pt-BR"><body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body></html>;
}
