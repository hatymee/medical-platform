"use client";

import { useEffect, useState } from "react";

export default function DoctorDashboardPage() {
  const [name, setName] = useState("Docteur");

  useEffect(() => {
    const firstName = localStorage.getItem("first_name");
    if (firstName) setName(firstName);
  }, []);

  return (
    <div>
      <p className="eyebrow">ESPACE MÉDECIN</p>
      <h1>Bonjour, Dr. {name}.</h1>
      <p style={{ marginBottom: "2rem", color: "#64748b" }}>
        Voici un résumé de votre activité.
      </p>

      <div className="statsGrid">
        <div className="statCard">
          <h3>Patients autorisés</h3>
          <p className="statNumber">0</p>
          <span>ayant donné leur accès</span>
        </div>

        <div className="statCard">
          <h3>Consultations du jour</h3>
          <p className="statNumber">0</p>
          <span>réalisées aujourd'hui</span>
        </div>

        <div className="statCard">
          <h3>Rendez-vous à venir</h3>
          <p className="statNumber">0</p>
          <span>programmés</span>
        </div>
      </div>

      <div style={{ marginTop: "2.5rem", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.5rem" }}>
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
            <h3>Prochains rendez-vous</h3>
            <a href="/doctor/patients">Voir tout</a>
          </div>
          <p style={{ color: "#94a3b8" }}>Aucun rendez-vous à venir.</p>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1rem" }}>
            <h3>Patients récents</h3>
            <a href="/doctor/patients">Voir la liste</a>
          </div>
          <p style={{ color: "#94a3b8" }}>Aucun patient autorisé pour le moment.</p>
        </div>
      </div>
    </div>
  );
}