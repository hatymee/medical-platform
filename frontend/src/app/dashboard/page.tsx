"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, Appointment, Consultation, Patient, Prescription } from "@/lib/api";
import PatientShell, { parseLocal, longDate, clock } from "@/components/PatientShell";

type DashboardData = {
  patient: Patient;
  appointments: Appointment[];
  consultations: Consultation[];
  prescriptions: Prescription[];
};

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("medical_token")) {
      router.replace("/connexion");
      return;
    }
    (async () => {
      try {
        const patient = await api<Patient>("/patients/me");
        const [appointments, consultations] = await Promise.all([
          api<Appointment[]>("/appointments/mine").catch(() => []),
          api<Consultation[]>(`/consultations/patient/${patient.id}`).catch(() => []),
        ]);
        const prescriptions = (
          await Promise.all(
            consultations.map((item) =>
              api<Prescription[]>(`/consultations/${item.id}/prescriptions`).catch(() => [])
            )
          )
        ).flat();
        setData({ patient, appointments, consultations, prescriptions });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger votre dossier.");
      }
    })();
  }, [router]);

  const now = new Date();
  const upcoming = (data?.appointments ?? [])
    .filter((a) => a.status === "scheduled" && parseLocal(a.scheduled_at) >= now)
    .sort((a, b) => parseLocal(a.scheduled_at).getTime() - parseLocal(b.scheduled_at).getTime());
  const next = upcoming[0];

  return (
    <PatientShell
      active="/dashboard"
      status={error ? "error" : !data ? "loading" : "ready"}
      error={error}
      firstName={data?.patient.first_name}
      lastName={data?.patient.last_name}
      eyebrow="ESPACE PATIENT"
      title={`Bonjour, ${data?.patient.first_name ?? ""}.`}
      subtitle={
        next
          ? `Prochain rendez-vous ${longDate(next.scheduled_at)} à ${clock(next.scheduled_at)}.`
          : "Aucun rendez-vous prévu pour le moment."
      }
      action={
        <Link className="ml-btn ml-btn-primary" href="/rendez-vous" style={{ marginBottom: 4 }}>
          Prendre un rendez-vous
        </Link>
      }
    >
      {data && (
        <>
          <div className="ml-stats">
            <div className="ml-stat">
              <div className="ml-stat-k">Prochains rendez-vous</div>
              <div className="ml-stat-v">{upcoming.length}</div>
              <div className="ml-stat-s">à venir dans votre agenda</div>
            </div>
            <div className="ml-stat">
              <div className="ml-stat-k">Ordonnances</div>
              <div className="ml-stat-v">{data.prescriptions.length}</div>
              <div className="ml-stat-s">issues de vos consultations</div>
            </div>
            <div className="ml-stat">
              <div className="ml-stat-k">Consultations</div>
              <div className="ml-stat-v">{data.consultations.length}</div>
              <div className="ml-stat-s">enregistrées dans votre dossier</div>
            </div>
          </div>

          <div className="ml-grid">
            <article className="ml-card">
              <div className="ml-card-top">
                <h2>Prochains rendez-vous</h2>
                {upcoming.length > 0 && <Link className="ml-more" href="/rendez-vous">Voir tout</Link>}
              </div>
              {upcoming.length > 0 ? (
                upcoming.slice(0, 3).map((item) => {
                  const d = parseLocal(item.scheduled_at);
                  return (
                    <div className="ml-item" key={item.id}>
                      <div className="ml-datebox">
                        <b>{d.getDate()}</b>
                        <span>{new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(d)}</span>
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <h3>{item.reason || "Consultation"}</h3>
                        <p>{longDate(item.scheduled_at)} à {clock(item.scheduled_at)}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="ml-empty">
                  <p>Vous n&apos;avez aucun rendez-vous prévu.</p>
                  <Link className="ml-btn ml-btn-primary" href="/rendez-vous">Prendre un rendez-vous</Link>
                </div>
              )}
            </article>

            <article className="ml-card">
              <div className="ml-card-top">
                <h2>Ordonnances récentes</h2>
                {data.prescriptions.length > 0 && <Link className="ml-more" href="/dossier">Voir le dossier</Link>}
              </div>
              {data.prescriptions.length > 0 ? (
                data.prescriptions.slice(0, 3).map((item) => (
                  <div className="ml-item" key={item.id}>
                    <div className="ml-rx">Rx</div>
                    <div style={{ minWidth: 0 }}>
                      <h3>{item.medication_name}{item.dosage ? ` · ${item.dosage}` : ""}</h3>
                      <p>{item.instructions ?? item.duration ?? "Prescription médicale"}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="ml-empty">
                  <p>Vos ordonnances apparaîtront ici après vos consultations.</p>
                  <Link className="ml-btn ml-btn-ghost" href="/dossier">Ouvrir mon dossier</Link>
                </div>
              )}
            </article>
          </div>
        </>
      )}
    </PatientShell>
  );
}
