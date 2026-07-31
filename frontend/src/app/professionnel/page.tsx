"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, clearSession, RevenueSummary } from "@/lib/api";

const money = (value: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MAD" }).format(value);

export default function ProfessionnelPage() {
  const router = useRouter();
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { if (!localStorage.getItem("medical_token")) { router.replace("/connexion"); return; } api<RevenueSummary>("/billing/revenue").then(setSummary).catch((err) => setError(err.message)); }, [router]);
  function logout() { clearSession(); router.push("/connexion"); }
  if (error) return <main className="pageState"><h1>Espace professionnel</h1><p>{error}</p><p>Connectez-vous avec un compte médecin ou administrateur de clinique.</p></main>;
  if (!summary) return <main className="pageState"><p>Chargement du chiffre d’affaires…</p></main>;
  return <main className="contentPage"><header className="simpleHeader"><a className="brand" href="/professionnel">MedLink</a><button className="secondaryButton" onClick={logout}>Déconnexion</button></header><section className="pageHeading"><p className="eyebrow">ESPACE PROFESSIONNEL</p><h1>Suivi financier</h1><p>Du {summary.period_start} au {summary.period_end}</p></section><section className="stats"><article><span>Chiffre d’affaires encaissé</span><strong>{money(summary.collected_total)}</strong><small>paiements réellement enregistrés</small></article><article><span>Factures émises</span><strong>{money(summary.invoiced_total)}</strong><small>{summary.invoice_count} facture(s) sur la période</small></article><article><span>Reste à encaisser</span><strong>{money(summary.outstanding_total)}</strong><small>impayés et paiements partiels</small></article></section><section className="listCard"><h2>Comment alimenter ce tableau</h2><p className="emptyText">Créez une facture après la consultation, puis enregistrez chaque règlement. Les paiements partiels sont pris en charge et le chiffre d’affaires affiche uniquement les montants réellement encaissés.</p></section></main>;
}
