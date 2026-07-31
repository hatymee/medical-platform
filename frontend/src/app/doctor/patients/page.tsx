"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Patient = {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  national_id?: string;
  sex?: string;
};

export default function DoctorPatientsPage() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Pour l'instant on met des données fictives
    // Plus tard on branchera l'API réelle
    setTimeout(() => {
      setPatients([
        {
          id: "1",
          first_name: "Hatim",
          last_name: "Benali",
          date_of_birth: "1995-03-12",
          national_id: "AB123456",
          sex: "Homme",
        },
        {
          id: "2",
          first_name: "Sara",
          last_name: "El Amrani",
          date_of_birth: "1988-07-22",
          national_id: "CD789012",
          sex: "Femme",
        },
      ]);
      setLoading(false);
    }, 600);
  }, []);

  return (
    <div>
      <p className="eyebrow">ESPACE MÉDECIN</p>
      <h1>Mes patients</h1>
      <p style={{ marginBottom: "2rem", color: "#64748b" }}>
        Liste des patients qui vous ont autorisé l’accès à leur dossier.
      </p>

      {loading ? (
        <p>Chargement...</p>
      ) : patients.length === 0 ? (
        <div className="card">
          <p style={{ color: "#94a3b8" }}>
            Aucun patient ne vous a encore autorisé l’accès.
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", textAlign: "left" }}>
                <th style={{ padding: "1rem" }}>Patient</th>
                <th style={{ padding: "1rem" }}>CIN</th>
                <th style={{ padding: "1rem" }}>Date de naissance</th>
                <th style={{ padding: "1rem" }}>Sexe</th>
                <th style={{ padding: "1rem" }}></th>
              </tr>
            </thead>
            <tbody>
              {patients.map((patient) => (
                <tr key={patient.id} style={{ borderTop: "1px solid #e2e8f0" }}>
                  <td style={{ padding: "1rem", fontWeight: 500 }}>
                    {patient.first_name} {patient.last_name}
                  </td>
                  <td style={{ padding: "1rem" }}>{patient.national_id || "—"}</td>
                  <td style={{ padding: "1rem" }}>
                    {new Date(patient.date_of_birth).toLocaleDateString("fr-FR")}
                  </td>
                  <td style={{ padding: "1rem" }}>{patient.sex || "—"}</td>
                  <td style={{ padding: "1rem" }}>
                    <Link
                      href={`/doctor/patients/${patient.id}`}
                      className="button"
                      style={{ padding: "0.4rem 0.9rem", fontSize: "0.875rem" }}
                    >
                      Voir le dossier
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}