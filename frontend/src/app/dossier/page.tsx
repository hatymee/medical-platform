"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import PatientShell, { parseLocal } from "@/components/PatientShell";

type DossierData = {
  patient: any;
  consultations: any[];
  prescriptions: any[];
  documents: any[];
};

export default function DossierPage() {
  const router = useRouter();
  const [data, setData] = useState<DossierData | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!localStorage.getItem("medical_token")) {
      router.replace("/connexion");
      return;
    }
    (async () => {
      try {
        const patient = await api<any>("/patients/me");
        const consultations = await api<any[]>(`/consultations/patient/${patient.id}`).catch(() => []);
        const prescriptions = (
          await Promise.all(
            consultations.map((item: any) =>
              api<any[]>(`/consultations/${item.id}/prescriptions`).catch(() => [])
            )
          )
        ).flat();
        const documents = await api<any[]>(`/documents/patient/${patient.id}`).catch(() => []);
        setData({ patient, consultations, prescriptions, documents });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger le dossier médical.");
      }
    })();
  }, [router]);

  const firstName = data?.patient?.first_name ?? data?.patient?.user?.first_name ?? "";
  const lastName = data?.patient?.last_name ?? data?.patient?.user?.last_name ?? "";
  const birthRaw = data?.patient?.birth_date ?? data?.patient?.date_of_birth;
  const bloodGroup = data?.patient?.blood_group ?? data?.patient?.blood_type;

  const birthLabel = birthRaw
    ? parseLocal(String(birthRaw)).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
    : "Date de naissance non renseignée";

  return (
    <PatientShell
      active="/dossier"
      status={error ? "error" : !data ? "loading" : "ready"}
      error={error}
      firstName={firstName}
      lastName={lastName}
      eyebrow="DOSSIER MÉDICAL"
      title={`${firstName} ${lastName}`}
      subtitle={
        <>
          Né(e) le {birthLabel}
          {bloodGroup && bloodGroup !== "unknown" ? ` · groupe sanguin ${bloodGroup}` : ""}
        </>
      }
    >
      {data && (
        <>
          <div className="ml-stats">
            <div className="ml-stat">
              <div className="ml-stat-k">Consultations</div>
              <div className="ml-stat-v">{data.consultations.length}</div>
              <div className="ml-stat-s">enregistrées</div>
            </div>
            <div className="ml-stat">
              <div className="ml-stat-k">Ordonnances</div>
              <div className="ml-stat-v">{data.prescriptions.length}</div>
              <div className="ml-stat-s">délivrées</div>
            </div>
            <div className="ml-stat">
              <div className="ml-stat-k">Documents</div>
              <div className="ml-stat-v">{data.documents.length}</div>
              <div className="ml-stat-s">dans votre dossier</div>
            </div>
          </div>

          <div className="ml-grid">
            <article className="ml-card">
              <div className="ml-card-top">
                <h2>Historique des consultations</h2>
              </div>
              {data.consultations.length > 0 ? (
                data.consultations.map((item: any, i: number) => {
                  const raw = item.date ?? item.created_at ?? item.scheduled_at;
                  const label = raw
                    ? parseLocal(String(raw)).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
                    : "Date non renseignée";
                  return (
                    <div className="ml-item" key={item.id ?? `consultation-${i}`}>
                      <div className="ml-rx">C</div>
                      <div style={{ minWidth: 0 }}>
                        <h3>{item.diagnosis ?? item.notes ?? item.reason ?? "Consultation médicale"}</h3>
                        <p>{label}</p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="ml-empty">
                  <p>Aucune consultation enregistrée pour l&apos;instant.</p>
                  <Link className="ml-btn ml-btn-primary" href="/rendez-vous">Prendre un rendez-vous</Link>
                </div>
              )}
            </article>

            <article className="ml-card">
              <div className="ml-card-top">
                <h2>Ordonnances</h2>
              </div>
              {data.prescriptions.length > 0 ? (
                data.prescriptions.map((item: any, i: number) => (
                  <div className="ml-item" key={item.id ?? `prescription-${i}`}>
                    <div className="ml-rx">Rx</div>
                    <div style={{ minWidth: 0 }}>
                      <h3>
                        {item.medication_name ?? item.medication ?? "Médicament"}
                        {item.dosage ? ` · ${item.dosage}` : ""}
                      </h3>
                      <p>{item.instructions ?? item.duration ?? "Prescription médicale"}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="ml-empty">
                  <p>Vos ordonnances apparaîtront ici après vos consultations.</p>
                </div>
              )}
            </article>
          </div>

          <article className="ml-card" style={{ marginTop: 16 }}>
            <div className="ml-card-top">
              <h2>Documents médicaux</h2>
            </div>
            {data.documents.length > 0 ? (
              data.documents.map((item: any, i: number) => (
                <div className="ml-item" key={item.id ?? `document-${i}`}>
                  <div className="ml-rx">Doc</div>
                  <div style={{ minWidth: 0 }}>
                    <h3>{item.title ?? item.filename ?? item.name ?? "Document"}</h3>
                    <p>
                      {item.document_type ?? item.type ?? "Document médical"}
                      {item.created_at
                        ? ` · ${parseLocal(String(item.created_at)).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}`
                        : ""}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <div className="ml-empty">
                <p>Aucun document dans votre dossier. Les comptes rendus et résultats d&apos;examens ajoutés par vos médecins apparaîtront ici.</p>
              </div>
            )}
          </article>
        </>
      )}
    </PatientShell>
  );
}
