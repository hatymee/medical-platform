import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MedLink | Plateforme médicale",
  description: "Plateforme médicale sécurisée.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="fr"><body>{children}</body></html>;
}
