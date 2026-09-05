"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import PatientShell, { DOCTOR_NAV, parseLocal } from "@/components/PatientShell";

type Granted = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string | null;
  national_id: string | null;
  sex: string | null;
  blood_group: string | null;
  granted_at: string | null;
  expires_at: string | null;
};

export default function DoctorPatientsPage() {
  const [patients, setPatients] = useState<Granted[]>([]);
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
        setPatients((await api<Granted[]>("/access/my-patients")) ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger vos patients.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <PatientShell
      active="/doctor/patients"
      nav={DOCTOR_NAV}
      home="/doctor/dashboard"
      roleLabel="Médecin"
      status={error ? "error" : loading ? "loading" : "ready"}
      error={error}
      firstName={me.first_name}
      lastName={me.last_name}
      eyebrow="ESPACE MÉDECIN"
      title="Patients autorisés"
      subtitle={
        patients.length > 0
          ? `${patients.length} patient${patients.length > 1 ? "s" : ""} vous ont ouvert leur dossier`
          : "Aucun patient ne vous a encore autorisé l'accès."
      }
    >
      <article className="ml-card">
        <div className="ml-card-top"><h2>Accès en cours</h2></div>
        {patients.length === 0 ? (
          <div className="ml-empty">
            <p>
              Aucun accès actif. Un patient doit approuver votre demande depuis son espace
              pour que son dossier apparaisse ici.
            </p>
          </div>
        ) : (
          patients.map((p) => (
            <div className="ml-item" key={p.id}>
              <div className="ml-rx">
                {(p.first_name?.[0] ?? "") + (p.last_name?.[0] ?? "")}
              </div>
              <div style={{ flexGrow: 1, minWidth: 0 }}>
                <h3>{p.last_name} {p.first_name}</h3>
                <p>
                  CIN {p.national_id || "—"}
                  {p.date_of_birth ? ` · né(e) le ${parseLocal(p.date_of_birth).toLocaleDateString("fr-FR")}` : ""}
                  {p.blood_group && p.blood_group !== "unknown" ? ` · groupe ${p.blood_group}` : ""}
                </p>
              </div>
              {p.expires_at && (
                <span className="ml-pill ml-pill-scheduled">
                  jusqu&apos;au {parseLocal(p.expires_at).toLocaleDateString("fr-FR")}
                </span>
              )}
            </div>
          ))
        )}
      </article>
    </PatientShell>
  );
}