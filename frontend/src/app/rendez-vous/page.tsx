"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

const displayDate = (value: string) =>
  new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export default function RendezVousPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!localStorage.getItem("medical_token")) {
      router.replace("/connexion");
      return;
    }
    api<any[]>("/appointments/mine")
      .then((data) => setAppointments(data ?? []))
      .catch(() => setAppointments([]))
      .finally(() => setLoading(false));
  }, [router]);

  function logout() {
    localStorage.clear();
    router.push("/connexion");
  }

  if (loading) {
    return (
      <main className="pageState">
        <p>Chargement des rendez-vous…</p>
      </main>
    );
  }

  return (
    <div className="dashboard">
      <aside className="dashboardSidebar">
        <a className="brand" href="/dashboard">MedLink</a>
        <nav className="dashboardMenu">
          <a href="/dashboard">Tableau de bord</a>
          <a href="/dossier">Mon dossier médical</a>
          <a className="active" href="/rendez-vous">Mes rendez-vous</a>
          <button className="logout" onClick={logout}>Déconnexion</button>
        </nav>
      </aside>

      <main className="dashboardMain">
        <header className="dashboardHeader">
          <div>
            <p className="eyebrow">ESPACE PATIENT</p>
            <h1>Mes rendez-vous</h1>
            <p>Retrouvez l'ensemble de vos rendez-vous médicaux.</p>
          </div>
        </header>

        <section className="dashboardCard" style={{ marginTop: "35px" }}>
          <div className="cardTitle">
            <h2>Liste des rendez-vous</h2>
          </div>
          {appointments.length > 0 ? (
            appointments.map((item: any) => {
              const dateVal = item.scheduled_at ?? item.date ?? item.created_at;
              
              return (
                <div className="appointment" key={item.id ?? Math.random()}>
                  {dateVal && (
                    <div className="dateBox">
                      <strong>{new Date(dateVal).getDate()}</strong>
                      <span>
                        {new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(new Date(dateVal))}
                      </span>
                    </div>
                  )}
                  <div>
                    <h3>{item.title ?? "Consultation"}</h3>
                    <p>
                      {dateVal ? displayDate(dateVal) : "Date non spécifiée"}
                      {item.reason ? ` · ${item.reason}` : ""}
                    </p>
                  </div>
                </div>
              );
            })
          ) : (
            <p className="emptyText">Aucun rendez-vous enregistré.</p>
          )}
        </section>
      </main>
    </div>
  );
}