"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import PatientShell, { DOCTOR_NAV, parseLocal, clock } from "@/components/PatientShell";

const money = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(v);

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Programmé",
  confirmed: "Confirmé",
  cancelled: "Annulé",
  completed: "Terminé",
  no_show: "Absence",
};

const timeBox: React.CSSProperties = {
  width: 62,
  flexShrink: 0,
  textAlign: "center",
  background: "#eaf3fd",
  color: "#0f5cbf",
  borderRadius: 10,
  padding: "9px 0",
  fontSize: 15,
  fontWeight: 800,
  fontVariantNumeric: "tabular-nums",
};

export default function DoctorDashboardPage() {
  const [appointments, setAppointments] = useState<any[]>([]);
  const [patients, setPatients] = useState<any[]>([]);
  const [revenue, setRevenue] = useState<any>(null);
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
        const [apts, pats, rev] = await Promise.all([
          api<any[]>("/appointments/mine").catch(() => []),
          api<any[]>("/access/my-patients").catch(() => []),
          api<any>("/billing/revenue").catch(() => null),
        ]);
        setAppointments(apts ?? []);
        setPatients(pats ?? []);
        setRevenue(rev);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger votre activité.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const now = new Date();
  const isToday = (iso: string) => parseLocal(iso).toDateString() === now.toDateString();

  const sorted = [...appointments]
    .filter((a) => a.scheduled_at)
    .sort((a, b) => parseLocal(a.scheduled_at).getTime() - parseLocal(b.scheduled_at).getTime());

  const today = sorted.filter((a) => isToday(a.scheduled_at) && a.status !== "cancelled");
  const upcoming = sorted.filter((a) => parseLocal(a.scheduled_at) >= now && a.status !== "cancelled");
  const nextOne = upcoming[0];
  const done = today.filter((a) => a.status === "completed").length;

  const patientName = (id: string) => {
    const p = patients.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "Patient";
  };

  return (
    <PatientShell
      active="/doctor/dashboard"
      nav={DOCTOR_NAV}
      home="/doctor/dashboard"
      roleLabel="Médecin"
      status={error ? "error" : loading ? "loading" : "ready"}
      error={error}
      firstName={me.first_name}
      lastName={me.last_name}
      eyebrow="ESPACE MÉDECIN"
      title={`Bonjour, Dr. ${me.first_name ?? ""}.`}
      subtitle={
        nextOne && isToday(nextOne.scheduled_at)
          ? `Prochaine consultation à ${clock(nextOne.scheduled_at)} · ${today.length} rendez-vous aujourd'hui.`
          : today.length > 0
          ? `${today.length} rendez-vous aujourd'hui.`
          : "Aucune consultation prévue aujourd'hui."
      }
      action={
        <Link className="ml-btn ml-btn-ghost" href="/professionnel" style={{ marginBottom: 4 }}>
          Voir le suivi financier
        </Link>
      }
    >
      <div className="ml-stats">
        <div className="ml-stat">
          <div className="ml-stat-k">Aujourd&apos;hui</div>
          <div className="ml-stat-v">{today.length}</div>
          <div className="ml-stat-s">{done} consultation{done > 1 ? "s" : ""} terminée{done > 1 ? "s" : ""}</div>
        </div>
        <div className="ml-stat">
          <div className="ml-stat-k">À venir</div>
          <div className="ml-stat-v">{upcoming.length}</div>
          <div className="ml-stat-s">rendez-vous programmés</div>
        </div>
        <div className="ml-stat">
          <div className="ml-stat-k">Patients autorisés</div>
          <div className="ml-stat-v">{patients.length}</div>
          <div className="ml-stat-s">dossiers accessibles</div>
        </div>
        <div className="ml-stat">
          <div className="ml-stat-k">Encaissé (30 j)</div>
          <div className="ml-stat-v">{revenue ? money(revenue.collected_total) : "—"}</div>
          <div className="ml-stat-s">
            {revenue && revenue.outstanding_total > 0
              ? `${money(revenue.outstanding_total)} en attente`
              : "règlements enregistrés"}
          </div>
        </div>
      </div>

      <article className="ml-card" style={{ marginBottom: 16 }}>
        <div className="ml-card-top">
          <h2>Votre journée</h2>
          <span className="ml-stat-s">
            {now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })}
          </span>
        </div>
        {today.length === 0 ? (
          <div className="ml-empty">
            <p>Aucune consultation prévue aujourd&apos;hui.</p>
          </div>
        ) : (
          today.map((a) => {
            const isNext = nextOne && a.id === nextOne.id;
            return (
              <div
                className="ml-item"
                key={a.id}
                style={isNext ? { background: "#eaf3fd", boxShadow: "inset 3px 0 0 #1877e0" } : undefined}
              >
                <div style={timeBox}>{clock(a.scheduled_at)}</div>
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <h3>{patientName(a.patient_id)}</h3>
                  <p>{a.reason || "Consultation"}</p>
                </div>
                {isNext && <span className="ml-pill ml-pill-confirmed">Prochain</span>}
                <span className={`ml-pill ml-pill-${a.status}`}>
                  {STATUS_LABELS[a.status] ?? a.status}
                </span>
              </div>
            );
          })
        )}
      </article>

      <div className="ml-grid">
        <article className="ml-card">
          <div className="ml-card-top">
            <h2>Prochains rendez-vous</h2>
            {upcoming.length > 0 && <span className="ml-stat-s">{upcoming.length} au total</span>}
          </div>
          {upcoming.length === 0 ? (
            <div className="ml-empty"><p>Aucun rendez-vous à venir.</p></div>
          ) : (
            upcoming.slice(0, 5).map((a) => {
              const d = parseLocal(a.scheduled_at);
              return (
                <div className="ml-item" key={a.id}>
                  <div className="ml-datebox">
                    <b>{d.getDate()}</b>
                    <span>{new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(d)}</span>
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <h3>{patientName(a.patient_id)}</h3>
                    <p>{d.toLocaleDateString("fr-FR", { weekday: "long" })} à {clock(a.scheduled_at)}</p>
                  </div>
                </div>
              );
            })
          )}
        </article>

        <article className="ml-card">
          <div className="ml-card-top">
            <h2>Patients autorisés</h2>
            <Link className="ml-more" href="/doctor/patients">Voir la liste</Link>
          </div>
          {patients.length === 0 ? (
            <div className="ml-empty">
              <p>Aucun patient ne vous a encore ouvert son dossier.</p>
            </div>
          ) : (
            patients.slice(0, 5).map((p) => (
              <div className="ml-item" key={p.id}>
                <div className="ml-rx">{(p.first_name?.[0] ?? "") + (p.last_name?.[0] ?? "")}</div>
                <div style={{ minWidth: 0 }}>
                  <h3>{p.last_name} {p.first_name}</h3>
                  <p>CIN {p.national_id || "—"}</p>
                </div>
              </div>
            ))
          )}
        </article>
      </div>
    </PatientShell>
  );
}