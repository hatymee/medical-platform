"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, Appointment, Consultation, Patient, Prescription } from "@/lib/api";

type DashboardData = { patient: Patient; appointments: Appointment[]; consultations: Consultation[]; prescriptions: Prescription[] };
const displayDate = (value: string) => new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function DashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!localStorage.getItem("medical_token")) { router.replace("/connexion"); return; }
    (async () => {
      try {
        const patient = await api<Patient>("/patients/me");
        const [appointments, consultations] = await Promise.all([api<Appointment[]>("/appointments/mine"), api<Consultation[]>(`/consultations/patient/${patient.id}`)]);
        const prescriptions = (await Promise.all(consultations.map((item) => api<Prescription[]>(`/consultations/${item.id}/prescriptions`)))).flat();
        setData({ patient, appointments, consultations, prescriptions });
      } catch (err) { setError(err instanceof Error ? err.message : "Impossible de charger votre dossier."); }
    })();
  }, [router]);
  function logout() { localStorage.clear(); router.push("/connexion"); }
  if (error) return <main className="pageState"><h1>Connexion au dossier impossible</h1><p>{error}</p><a className="button" href="/connexion">Retour à la connexion</a></main>;
  if (!data) return <main className="pageState"><p>Chargement de votre dossier médical…</p></main>;
  const upcoming = data.appointments.filter((item) => item.status === "scheduled" && new Date(item.scheduled_at) >= new Date());
  return <div className="dashboard"><aside className="dashboardSidebar"><a className="brand" href="/dashboard">MedLink</a><nav className="dashboardMenu"><a className="active" href="/dashboard">Tableau de bord</a><a href="/dossier">Mon dossier médical</a><a href="/rendez-vous">Mes rendez-vous</a></nav><button className="logout" onClick={logout}>Déconnexion</button></aside><main className="dashboardMain"><header className="dashboardHeader"><div><p className="eyebrow">ESPACE PATIENT</p><h1>Bonjour, {data.patient.first_name}.</h1><p>Voici un résumé de votre suivi médical.</p></div><div className="patientAvatar">{data.patient.first_name[0]}{data.patient.last_name[0]}</div></header><section className="stats"><article><span>Prochains rendez-vous</span><strong>{upcoming.length}</strong><small>rendez-vous programmés</small></article><article><span>Ordonnances actives</span><strong>{data.prescriptions.length}</strong><small>issues de vos consultations</small></article><article><span>Documents médicaux</span><strong>{data.consultations.length}</strong><small>consultations dans votre dossier</small></article></section><section className="dashboardGrid"><article className="dashboardCard"><div className="cardTitle"><h2>Prochains rendez-vous</h2><a href="/rendez-vous">Voir tout</a></div>{upcoming.length ? upcoming.slice(0, 3).map((item) => <div className="appointment" key={item.id}><div className="dateBox"><strong>{new Date(item.scheduled_at).getDate()}</strong><span>{new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(new Date(item.scheduled_at))}</span></div><div><h3>Consultation</h3><p>{displayDate(item.scheduled_at)}{item.reason ? ` · ${item.reason}` : ""}</p></div></div>) : <p className="emptyText">Aucun rendez-vous à venir.</p>}</article><article className="dashboardCard"><div className="cardTitle"><h2>Ordonnances récentes</h2><a href="/dossier">Voir le dossier</a></div>{data.prescriptions.length ? data.prescriptions.slice(0, 3).map((item) => <div className="prescription" key={item.id}><div className="medicineIcon">Rx</div><div><h3>{item.medication_name}{item.dosage ? ` · ${item.dosage}` : ""}</h3><p>{item.instructions ?? item.duration ?? "Prescription médicale"}</p></div></div>) : <p className="emptyText">Aucune ordonnance enregistrée.</p>}</article></section></main></div>;
}
