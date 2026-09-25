"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Wallet, FileText, Clock, Percent, BarChart3, Lightbulb, CircleCheck, TriangleAlert, TrendingUp, TrendingDown, Info } from "lucide-react";
import { api, RevenueSummary } from "@/lib/api";
import PatientShell, { DOCTOR_NAV } from "@/components/PatientShell";

const money = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(v);

type Month = { label: string; invoiced: number; collected: number; count: number };

function monthRanges(n: number) {
  const out: { start: string; end: string; label: string }[] = [];
  const now = new Date();
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  for (let i = n - 1; i >= 0; i--) {
    const first = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const last = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    out.push({ start: iso(first), end: iso(last), label: first.toLocaleDateString("fr-FR", { month: "short" }) });
  }
  return out;
}

export default function ProfessionnelPage() {
  const router = useRouter();
  const [months, setMonths] = useState<Month[]>([]);
  const [me, setMe] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("medical_token")) {
      router.replace("/connexion");
      return;
    }
    (async () => {
      try {
        setMe(await api<any>("/doctors/me").catch(() => null));
        const ranges = monthRanges(6);
        const results = await Promise.all(ranges.map((r) => api<RevenueSummary>(`/billing/revenue?start=${r.start}&end=${r.end}`).catch(() => null)));
        setMonths(ranges.map((r, i) => ({
          label: r.label,
          invoiced: results[i]?.invoiced_total ?? 0,
          collected: results[i]?.collected_total ?? 0,
          count: results[i]?.invoice_count ?? 0,
        })));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger le suivi financier.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const invoiced = months.reduce((s, m) => s + m.invoiced, 0);
  const collected = months.reduce((s, m) => s + m.collected, 0);
  const outstanding = Math.max(0, invoiced - collected);
  const count = months.reduce((s, m) => s + m.count, 0);
  const rate = invoiced > 0 ? (collected / invoiced) * 100 : 0;
  const average = count > 0 ? invoiced / count : 0;
  const peak = Math.max(1, ...months.map((m) => m.invoiced));
  const current = months[months.length - 1];
  const previous = months[months.length - 2];
  const trend = current && previous && previous.collected > 0 ? ((current.collected - previous.collected) / previous.collected) * 100 : null;

  const insights: { tone: string; icon: typeof Info; text: React.ReactNode }[] = [];
  if (invoiced === 0) {
    insights.push({ tone: "blue", icon: Info, text: <>Aucune facture sur les six derniers mois. Les factures créées par le secrétariat et leurs règlements rempliront ce tableau automatiquement.</> });
  } else {
    insights.push(rate >= 99.5
      ? { tone: "green", icon: CircleCheck, text: <>Taux de recouvrement de <b>{rate.toFixed(0)} %</b> : les règlements suivent bien la facturation.</> }
      : { tone: "amber", icon: TriangleAlert, text: <>Taux de recouvrement de <b>{rate.toFixed(0)} %</b>, il reste <b>{money(outstanding)}</b> à encaisser. En dessous de 70 %, la trésorerie devient tendue même quand l&apos;activité est bonne.</> });
    if (trend !== null && Math.abs(trend) >= 10) {
      insights.push({ tone: trend > 0 ? "green" : "amber", icon: trend > 0 ? TrendingUp : TrendingDown, text: <>Les encaissements du mois sont <b>{trend > 0 ? "en hausse" : "en baisse"} de {Math.abs(trend).toFixed(0)} %</b> par rapport au mois précédent. Le mois n&apos;est peut-être pas terminé : comparez à période équivalente.</> });
    }
    if (average > 0) insights.push({ tone: "blue", icon: Info, text: <>Montant moyen par facture : <b>{money(average)}</b>, sur <b>{count}</b> facture{count > 1 ? "s" : ""}.</> });
  }

  return (
    <PatientShell
      active="/professionnel"
      nav={DOCTOR_NAV}
      home="/doctor/dashboard"
      roleLabel="Médecin généraliste"
      status={error ? "error" : loading ? "loading" : "ready"}
      error={error}
      firstName={me?.first_name}
      lastName={me?.last_name}
      onSearch={() => router.push("/doctor/patients")}
      searchPlaceholder="Rechercher un patient, un rendez-vous, un dossier…"
    >
      <div className="pd dd">
        <div className="dd-hello-row">
          <div>
            <h1 className="pd-name pd-hello">Facturation</h1>
            <p className="pd-sub" style={{ fontSize: 14 }}>Six derniers mois : montants facturés et réellement encaissés.</p>
          </div>
        </div>

        <div className="dd-stats" style={{ marginBottom: 18 }}>
          <div className="dd-stat"><span className="dd-stat-ic green"><Wallet size={20} /></span><span className="dd-stat-body"><span className="dd-stat-k">Encaissé</span><b>{money(collected)}</b><em>règlements enregistrés</em></span></div>
          <div className="dd-stat"><span className="dd-stat-ic blue"><FileText size={20} /></span><span className="dd-stat-body"><span className="dd-stat-k">Facturé</span><b>{money(invoiced)}</b><em>{count} facture{count > 1 ? "s" : ""}</em></span></div>
          <div className="dd-stat"><span className="dd-stat-ic orange"><Clock size={20} /></span><span className="dd-stat-body"><span className="dd-stat-k">Reste à encaisser</span><b>{money(outstanding)}</b><em className={outstanding > 0 ? "dd-warn" : ""}>{outstanding > 0 ? "à relancer" : "tout est réglé"}</em></span></div>
          <div className="dd-stat"><span className="dd-stat-ic violet"><Percent size={20} /></span><span className="dd-stat-body"><span className="dd-stat-k">Taux de recouvrement</span><b>{rate.toFixed(0)} %</b><em>sur 6 mois</em></span></div>
        </div>

        <div className="dd-grid">
          <section className="pd-card pd-sec">
            <div className="pd-sec-head">
              <h2><BarChart3 size={20} /> Évolution mensuelle</h2>
              <div className="fx-legend"><span><i style={{ background: "#c3d9f2" }} /> Facturé</span><span><i style={{ background: "#1877e0" }} /> Encaissé</span></div>
            </div>
            <div className="fx-chart">
              {months.map((m, i) => (
                <div className="fx-col" key={m.label + i}>
                  <div className="fx-bars">
                    <div className="fx-bar fx-inv" style={{ height: `${(m.invoiced / peak) * 100}%` }} title={`Facturé : ${money(m.invoiced)}`} />
                    <div className="fx-bar fx-col-bar" style={{ height: `${(m.collected / peak) * 100}%` }} title={`Encaissé : ${money(m.collected)}`} />
                  </div>
                  <span className="fx-label">{m.label}</span>
                  <span className="fx-val">{m.collected > 0 ? money(m.collected) : "—"}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="pd-card pd-sec">
            <div className="pd-sec-head"><h2><Lightbulb size={20} /> Lecture des chiffres</h2></div>
            <ul className="dd-alerts">
              {insights.map((ins, i) => (
                <li key={i} style={{ alignItems: "flex-start" }}>
                  <span className={`pd-ic ${ins.tone}`}><ins.icon size={17} /></span>
                  <span style={{ lineHeight: 1.55 }}>{ins.text}</span>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </PatientShell>
  );
}
