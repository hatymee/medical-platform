"use client";

import { useEffect, useState } from "react";
import { api, RevenueSummary } from "@/lib/api";
import PatientShell, { DOCTOR_NAV } from "@/components/PatientShell";

const money = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(v);

type Month = { label: string; invoiced: number; collected: number; count: number };

function monthRanges(n: number) {
  const out: { start: string; end: string; label: string }[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const first = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const last = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
    const iso = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    out.push({
      start: iso(first),
      end: iso(last),
      label: first.toLocaleDateString("fr-FR", { month: "short" }),
    });
  }
  return out;
}

export default function ProfessionnelPage() {
  const [months, setMonths] = useState<Month[]>([]);
  const [me, setMe] = useState<{ first_name?: string; last_name?: string }>({});
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        setMe({
          first_name: localStorage.getItem("first_name") ?? "",
          last_name: localStorage.getItem("last_name") ?? "",
        });
        const ranges = monthRanges(6);
        const results = await Promise.all(
          ranges.map((r) =>
            api<RevenueSummary>(`/billing/revenue?start=${r.start}&end=${r.end}`)
              .catch(() => null)
          )
        );
        setMonths(
          ranges.map((r, i) => ({
            label: r.label,
            invoiced: results[i]?.invoiced_total ?? 0,
            collected: results[i]?.collected_total ?? 0,
            count: results[i]?.invoice_count ?? 0,
          }))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger le suivi financier.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const invoiced = months.reduce((s, m) => s + m.invoiced, 0);
  const collected = months.reduce((s, m) => s + m.collected, 0);
  const outstanding = Math.max(0, invoiced - collected);
  const count = months.reduce((s, m) => s + m.count, 0);
  const rate = invoiced > 0 ? (collected / invoiced) * 100 : 0;
  const average = count > 0 ? invoiced / count : 0;
  const peak = Math.max(1, ...months.map((m) => m.invoiced));

  const current = months[months.length - 1];
  const previous = months[months.length - 2];
  const trend =
    current && previous && previous.collected > 0
      ? ((current.collected - previous.collected) / previous.collected) * 100
      : null;

  const insights: { tone: string; mark: string; text: React.ReactNode }[] = [];

  if (invoiced === 0) {
    insights.push({
      tone: "",
      mark: "i",
      text: <>Aucune facture sur les six derniers mois. Créez une facture après chaque consultation, puis enregistrez les règlements : ce tableau se remplira automatiquement.</>,
    });
  } else {
    if (rate < 99.5) {
      insights.push({
        tone: "ml-warn",
        mark: "!",
        text: <>Votre taux de recouvrement est de <b>{rate.toFixed(0)} %</b>. Il reste <b>{money(outstanding)}</b> à encaisser. En dessous de 70 %, la trésorerie devient tendue même quand l&apos;activité est bonne.</>,
      });
    } else if (rate >= 99.5) {
      insights.push({
        tone: "ml-good",
        mark: "✓",
        text: <>Taux de recouvrement de <b>{rate.toFixed(0)} %</b> : les règlements suivent bien la facturation.</>,
      });
    }

    if (trend !== null && Math.abs(trend) >= 10) {
      insights.push({
        tone: trend > 0 ? "ml-good" : "ml-warn",
        mark: trend > 0 ? "↑" : "↓",
        text: <>Les encaissements du mois en cours sont <b>{trend > 0 ? "en hausse" : "en baisse"} de {Math.abs(trend).toFixed(0)} %</b> par rapport au mois précédent. Le mois n&apos;étant peut-être pas terminé, comparez à période équivalente.</>,
      });
    }

    if (average > 0) {
      insights.push({
        tone: "",
        mark: "i",
        text: <>Montant moyen par facture : <b>{money(average)}</b>, sur <b>{count}</b> facture{count > 1 ? "s" : ""} émise{count > 1 ? "s" : ""}.</>,
      });
    }
  }

  return (
    <PatientShell
      active="/professionnel"
      nav={DOCTOR_NAV}
      home="/doctor/dashboard"
      roleLabel="Médecin"
      status={error ? "error" : loading ? "loading" : "ready"}
      error={error}
      firstName={me.first_name}
      lastName={me.last_name}
      eyebrow="ESPACE PROFESSIONNEL"
      title="Suivi financier"
      subtitle="Six derniers mois · montants facturés et réellement encaissés"
    >
      <div className="ml-stats">
        <div className="ml-stat">
          <div className="ml-stat-k">Encaissé</div>
          <div className="ml-stat-v">{money(collected)}</div>
          <div className="ml-stat-s">règlements enregistrés</div>
        </div>
        <div className="ml-stat">
          <div className="ml-stat-k">Facturé</div>
          <div className="ml-stat-v">{money(invoiced)}</div>
          <div className="ml-stat-s">{count} facture{count > 1 ? "s" : ""}</div>
        </div>
        <div className="ml-stat">
          <div className="ml-stat-k">Reste à encaisser</div>
          <div className="ml-stat-v" style={{ color: outstanding > 0 ? "#a86a12" : undefined }}>
            {money(outstanding)}
          </div>
          <div className="ml-stat-s">taux de recouvrement {rate.toFixed(0)} %</div>
        </div>
      </div>

      <article className="ml-card" style={{ marginBottom: 16 }}>
        <div className="ml-card-top"><h2>Évolution mensuelle</h2></div>
        <div className="ml-chart">
          {months.map((m, i) => (
            <div className="ml-bar-group" key={m.label + i}>
              <div className="ml-bar-stack">
                <div
                  className="ml-bar ml-bar-invoiced"
                  style={{ height: `${(m.invoiced / peak) * 100}%`, animationDelay: `${i * 0.06}s` }}
                  title={`Facturé : ${money(m.invoiced)}`}
                />
                <div
                  className="ml-bar ml-bar-collected"
                  style={{ height: `${(m.collected / peak) * 100}%`, animationDelay: `${i * 0.06 + 0.05}s` }}
                  title={`Encaissé : ${money(m.collected)}`}
                />
              </div>
              <span className="ml-bar-label">{m.label}</span>
            </div>
          ))}
        </div>
        <div className="ml-legend">
          <span><i className="ml-key" style={{ background: "#c3d9f2" }} />Facturé</span>
          <span><i className="ml-key" style={{ background: "#1877e0" }} />Encaissé</span>
        </div>
      </article>

      <article className="ml-card">
        <div className="ml-card-top"><h2>Lecture des chiffres</h2></div>
        {insights.map((ins, i) => (
          <div className={`ml-insight ${ins.tone}`} key={i}>
            <span className="ml-insight-mark">{ins.mark}</span>
            <p>{ins.text}</p>
          </div>
        ))}
      </article>
    </PatientShell>
  );
}