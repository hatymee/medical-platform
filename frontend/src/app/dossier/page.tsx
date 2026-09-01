"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type DossierData = {
  patient: any;
  consultations: any[];
  prescriptions: any[];
  documents: any[];
};

export default function DossierPage() {
  const router = useRouter();
  const [data, setData] = useState<DossierData | null>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    if (!localStorage.getItem("medical_token")) {
      router.replace("/connexion");
      return;
    }
    (async () => {
      try {
        const patient = await api<any>("/patients/me");
        const consultations = await api<any[]>(`/consultations/patient/${patient.id}`).catch(() => []);
        
        let prescriptions: any[] = [];
        try {
          const presResults = await Promise.all(
            consultations.map((item: any) => api<any[]>(`/consultations/${item.id}/prescriptions`))
          );
          prescriptions = presResults.flat();
        } catch {
          prescriptions = [];
        }

        let documents: any[] = [];
        try {
          documents = await api<any[]>(`/documents/patient/${patient.id}`);
        } catch {
          documents = [];
        }

        setData({ patient, consultations, prescriptions, documents });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger le dossier médical.");
      }
    })();
  }, [router]);

  function logout() {
    localStorage.clear();
    router.push("/connexion");
  }

  if (error) {
    return (
      <main className="pageState">
        <h1>Accès impossible</h1>
        <p>{error}</p>
        <a className="button" href="/connexion">Connexion</a>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="pageState">
        <p>Chargement du dossier médical…</p>
      </main>
    );
  }

  const firstName = data.patient?.first_name ?? data.patient?.user?.first_name ?? "Patient";
  const lastName = data.patient?.last_name ?? data.patient?.user?.last_name ?? "";
  const birthDateRaw = data.patient?.birth_date ?? data.patient?.date_of_birth;
  const birthDateStr = birthDateRaw
    ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "long" }).format(new Date(birthDateRaw))
    : "Non renseignée";

  return (
    <div className="dashboard">
      <aside className="dashboardSidebar">
        <a className="brand" href="/dashboard">MedLink</a>
        <nav className="dashboardMenu">
          <a href="/dashboard">Tableau de bord</a>
          <a className="active" href="/dossier">Mon dossier médical</a>
          <a href="/rendez-vous">Mes rendez-vous</a>
          <button className="logout" onClick={logout}>Déconnexion</button>
        </nav>
      </aside>

      <main className="dashboardMain">
        <header className="dashboardHeader">
          <div>
            <p className="eyebrow">DOSSIER PATIENT</p>
            <h1>{firstName} {lastName}</h1>
            <p>
              Né(e) le {birthDateStr}
              {data.patient?.blood_type ? ` · Groupe sanguin : ${data.patient.blood_type}` : ""}
            </p>
          </div>
          <div className="patientAvatar">
            {firstName[0]}{lastName[0] ?? ""}
          </div>
        </header>

        <section className="stats" style={{ marginTop: "35px" }}>
          <article>
            <span>Consultations</span>
            <strong>{data.consultations.length}</strong>
            <small>enregistrées</small>
          </article>
          <article>
            <span>Ordonnances</span>
            <strong>{data.prescriptions.length}</strong>
            <small>délivrées</small>
          </article>
          <article>
            <span>Documents</span>
            <strong>{data.documents.length}</strong>
            <small>dans votre dossier</small>
          </article>
        </section>

        <section className="dashboardGrid" style={{ marginTop: "20px" }}>
          <article className="dashboardCard">
            <div className="cardTitle">
              <h2>Historique des consultations</h2>
            </div>
            {data.consultations.length > 0 ? (
              data.consultations.map((item: any) => {
                const dateVal = item.date ?? item.created_at ?? item.scheduled_at;
                const formattedDate = dateVal 
                  ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium" }).format(new Date(dateVal))
                  : "Date non renseignée";
                
                return (
                  <div className="appointment" key={item.id ?? Math.random()}>
                    <div>
                      <h3>{item.diagnosis ?? item.notes ?? item.reason ?? "Consultation médicale"}</h3>
                      <p>{formattedDate}</p>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="emptyText">Aucune consultation enregistrée.</p>
            )}
          </article>

          <article className="dashboardCard">
            <div className="cardTitle">
              <h2>Ordonnances récentes</h2>
            </div>
            {data.prescriptions.length > 0 ? (
              data.prescriptions.map((item: any) => (
                <div className="prescription" key={item.id ?? Math.random()}>
                  <div className="medicineIcon">Rx</div>
                  <div>
                    <h3>{item.medication_name ?? item.medication}{item.dosage ? ` · ${item.dosage}` : ""}</h3>
                    <p>{item.instructions ?? item.duration ?? "Prescription médicale"}</p>
                  </div>
                </div>
              ))
            ) : (
              <p className="emptyText">Aucune ordonnance enregistrée.</p>
            )}
          </article>
        </section>
      </main>
    </div>
  );
}