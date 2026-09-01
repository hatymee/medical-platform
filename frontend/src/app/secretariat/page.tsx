"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type TabType = "dashboard" | "patients" | "new_patient" | "rdv" | "doctors" | "dossiers" | "alerts";

interface PatientDoc {
  type: string;
  fileName: string;
}

interface Patient {
  id: string;
  lastName: string;
  firstName: string;
  cin: string;
  dateOfBirth: string;
  sex: string;
  phone: string;
  email: string;
  familyStatus: string;
  patientType: string;
  reason: string;
  desiredDoctor: string;
  insurance: string;
  membershipNumber: string;
  documents: PatientDoc[];
}

interface Appointment {
  id: string;
  time: string;
  date: string;
  patientName: string;
  doctorName: string;
  status: "Confirmé" | "En attente" | "Annulé";
  notes?: string;
  type?: string;
  createdByPatient?: boolean; // Indicateur si le RDV a été pris par le patient
}

export default function SecretariatDashboard() {
  const router = useRouter();

  // Navigation
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [filterPendingOnly, setFilterPendingOnly] = useState<boolean>(false);

  // Données initiales sécurisées
  const [patients, setPatients] = useState<Patient[]>([
    {
      id: "PAT-000245",
      firstName: "Ahmed",
      lastName: "BENALI",
      cin: "AB123456",
      phone: "0661234567",
      dateOfBirth: "1998-03-15",
      sex: "M",
      email: "ahmed@gmail.com",
      familyStatus: "Célibataire",
      patientType: "Nouveau patient",
      reason: "Consultation générale",
      desiredDoctor: "Dr. Alaoui",
      insurance: "CNSS",
      membershipNumber: "123456789",
      documents: [
        { type: "CIN", fileName: "CIN_Ahmed_Benali.pdf" },
        { type: "Assurance", fileName: "CNSS_Ahmed.jpg" },
      ],
    },
    {
      id: "PAT-000246",
      firstName: "Sara",
      lastName: "AMRANI",
      cin: "CD789012",
      phone: "0669876543",
      dateOfBirth: "1992-07-22",
      sex: "F",
      email: "sara@gmail.com",
      familyStatus: "Marié(e)",
      patientType: "Ancien patient",
      reason: "Suivi médical",
      desiredDoctor: "Dr. Karim",
      insurance: "CNOPS",
      membershipNumber: "987654321",
      documents: [{ type: "CIN", fileName: "CIN_Sara_Amrani.pdf" }],
    },
  ]);

  const [doctors] = useState<string[]>([
    "Dr. Alaoui (Généraliste)",
    "Dr. Karim (Cardiologue)",
    "Dr. Benjelloun (Dentiste)",
  ]);

  const [appointments, setAppointments] = useState<Appointment[]>([
    {
      id: "RDV-101",
      time: "10:30",
      date: "2026-09-02",
      patientName: "Ahmed BENALI",
      doctorName: "Dr. Alaoui",
      status: "Confirmé",
      type: "Consultation",
      notes: "Suivi médical",
      createdByPatient: false,
    },
    {
      id: "RDV-102",
      time: "09:30",
      date: "2026-08-31",
      patientName: "Sara AMRANI",
      doctorName: "Dr. Karim",
      status: "En attente",
      type: "Contrôle",
      createdByPatient: true, // Rendez-vous pris en ligne par le patient
    },
  ]);

  const [selectedPatientForFolder, setSelectedPatientForFolder] = useState<Patient | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [newRescheduleTime, setNewRescheduleTime] = useState<string>("");

  // Modal RDV & Créneaux
  const [isRdvModalOpen, setIsRdvModalOpen] = useState<boolean>(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isSlotsChecked, setIsSlotsChecked] = useState<boolean>(false);

  const [rdvFormData, setRdvFormData] = useState({
    patientName: "",
    doctorName: "Dr. Alaoui (Généraliste)",
    date: "2026-09-02",
    time: "",
    type: "Consultation",
    notes: "",
  });

  // Formulaire Patient
  const [formData, setFormData] = useState<Omit<Patient, "id">>({
    lastName: "",
    firstName: "",
    cin: "",
    dateOfBirth: "",
    sex: "M",
    phone: "",
    email: "",
    familyStatus: "Célibataire",
    patientType: "Nouveau patient",
    reason: "Consultation générale",
    desiredDoctor: "Dr. Alaoui (Généraliste)",
    insurance: "CNSS",
    membershipNumber: "",
    documents: [],
  });

  // Recherche Patient
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResult, setSearchResult] = useState<Patient | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleRdvInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setRdvFormData((prev) => ({ ...prev, [name]: value }));
    if (name === "date" || name === "doctorName") {
      setIsSlotsChecked(false);
      setRdvFormData((prev) => ({ ...prev, time: "" }));
    }
  };

  // Simulation BDD pour vérifier la disponibilité des créneaux
  const handleCheckDisponibility = () => {
    setAvailableSlots(["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "15:00"]);
    setIsSlotsChecked(true);
  };

  // Enregistrement Patient & Création automatique du dossier
  const handlePatientSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const generatedId = `PAT-${Math.floor(100000 + Math.random() * 900000)}`;
    const newPatient: Patient = {
      ...formData,
      id: generatedId,
      documents: [
        { type: "CIN", fileName: `CIN_${formData.lastName || "Patient"}.pdf` },
        { type: "Assurance", fileName: `${formData.insurance}_${formData.lastName || "Patient"}.pdf` },
      ],
    };

    setPatients((prev) => [newPatient, ...prev]);
    setActiveTab("patients");
    
    setFormData({
      lastName: "",
      firstName: "",
      cin: "",
      dateOfBirth: "",
      sex: "M",
      phone: "",
      email: "",
      familyStatus: "Célibataire",
      patientType: "Nouveau patient",
      reason: "Consultation générale",
      desiredDoctor: "Dr. Alaoui (Généraliste)",
      insurance: "CNSS",
      membershipNumber: "",
      documents: [],
    });
  };

  // Soumission du RDV
  const handleRdvSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rdvFormData.patientName) {
      alert("Veuillez choisir un patient.");
      return;
    }
    if (!rdvFormData.time) {
      alert("Veuillez cliquer sur 'Vérifier disponibilité' et choisir une heure.");
      return;
    }

    const newRdv: Appointment = {
      id: `RDV-${Date.now()}`,
      time: rdvFormData.time,
      date: rdvFormData.date,
      patientName: rdvFormData.patientName,
      doctorName: rdvFormData.doctorName,
      status: "Confirmé",
      type: rdvFormData.type,
      notes: rdvFormData.notes,
      createdByPatient: false,
    };

    setAppointments((prev) => [newRdv, ...prev]);
    closeRdvModal();
  };

  const closeRdvModal = () => {
    setIsRdvModalOpen(false);
    setIsSlotsChecked(false);
    setRdvFormData({
      patientName: "",
      doctorName: "Dr. Alaoui (Généraliste)",
      date: "2026-09-02",
      time: "",
      type: "Consultation",
      notes: "",
    });
  };

  const openRdvForPatient = (patientName: string) => {
    setRdvFormData((prev) => ({ ...prev, patientName }));
    setIsRdvModalOpen(true);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setHasSearched(true);
    const query = searchQuery.toLowerCase().trim();
    if (!query) {
      setSearchResult(null);
      return;
    }
    const found = patients.find(
      (p) =>
        p.cin.toLowerCase().includes(query) ||
        p.lastName.toLowerCase().includes(query) ||
        p.firstName.toLowerCase().includes(query) ||
        p.phone.includes(query)
    );
    setSearchResult(found || null);
  };

  // CORRECTION 1: Suppression définitive avec .filter()
  const deleteAppointment = (id: string) => {
    if (confirm("Voulez-vous vraiment supprimer définitivement ce rendez-vous ?")) {
      setAppointments((prev) => prev.filter((a) => a.id !== id));
    }
  };

  // CORRECTION 2: Reprogrammation réservée au Secrétariat (Patient ne peut pas modifier lui-même)
  const handleReschedule = (id: string) => {
    if (!newRescheduleTime) {
      alert("Veuillez choisir une nouvelle heure.");
      return;
    }
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, time: newRescheduleTime, status: "Confirmé" } : a))
    );
    setEditingAppointment(null);
    setNewRescheduleTime("");
  };

  function logout() {
    localStorage.clear();
    router.push("/connexion");
  }

  const displayedAppointments = filterPendingOnly
    ? appointments.filter((a) => a.status === "En attente")
    : appointments;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "system-ui, sans-serif", color: "#0f172a", display: "flex", flexDirection: "column" }}>
      
      {/* HEADER NAVBAR */}
      <header style={{ backgroundColor: "#ffffff", borderBottom: "1px solid #e2e8f0", padding: "12px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ fontSize: "22px", fontWeight: "bold", color: "#0284c7" }}>MedLink</div>

        <nav style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {[
            { id: "dashboard", label: "Accueil" },
            { id: "patients", label: "Patients" },
            { id: "rdv", label: "Rendez-vous" },
            { id: "doctors", label: "Médecins" },
            { id: "dossiers", label: "Dossiers" },
            { id: "alerts", label: "Alertes" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as TabType); setFilterPendingOnly(false); }}
              style={{
                padding: "8px 16px", borderRadius: "8px", border: "none",
                backgroundColor: activeTab === tab.id || (tab.id === "patients" && activeTab === "new_patient") ? "#e0f2fe" : "transparent",
                color: activeTab === tab.id || (tab.id === "patients" && activeTab === "new_patient") ? "#0284c7" : "#475569",
                fontWeight: activeTab === tab.id ? 600 : 500, cursor: "pointer", fontSize: "14px",
              }}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
          <span style={{ fontWeight: 600, color: "#334155", fontSize: "14px" }}>Secrétaire</span>
          <button onClick={logout} style={{ backgroundColor: "transparent", border: "none", color: "#ef4444", fontWeight: 600, cursor: "pointer", fontSize: "14px" }}>
            Déconnexion
          </button>
        </div>
      </header>

      {/* CONTENU PRINCIPAL */}
      <main style={{ padding: "32px", flexGrow: 1, maxWidth: "1200px", width: "100%", margin: "0 auto" }}>
        
        {/* VUE ACCUEIL */}
        {activeTab === "dashboard" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
              <h1 style={{ fontSize: "24px", fontWeight: 700, margin: 0 }}>Bonjour, Secrétaire 👋</h1>
              <button onClick={() => setIsRdvModalOpen(true)} style={{ padding: "10px 20px", backgroundColor: "#0284c7", color: "#ffffff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>
                + Prendre un RDV
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px", marginBottom: "32px" }}>
              <div onClick={() => setFilterPendingOnly(false)} style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "12px", border: filterPendingOnly ? "1px solid #e2e8f0" : "2px solid #0284c7", cursor: "pointer" }}>
                <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "8px" }}>RDV aujourd'hui</div>
                <div style={{ fontSize: "28px", fontWeight: 700, color: "#0284c7" }}>{appointments.length}</div>
              </div>
              <div onClick={() => setActiveTab("patients")} style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", cursor: "pointer" }}>
                <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "8px" }}>Patients</div>
                <div style={{ fontSize: "28px", fontWeight: 700, color: "#0f172a" }}>{patients.length}</div>
              </div>
              <div onClick={() => setFilterPendingOnly(true)} style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "12px", border: filterPendingOnly ? "2px solid #d97706" : "1px solid #e2e8f0", cursor: "pointer" }}>
                <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "8px" }}>En attente</div>
                <div style={{ fontSize: "28px", fontWeight: 700, color: "#d97706" }}>{appointments.filter((a) => a.status === "En attente").length}</div>
              </div>
            </div>

            <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "24px", border: "1px solid #e2e8f0" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>
                {filterPendingOnly ? "Patients en attente" : "Rendez-vous d'aujourd'hui"}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {displayedAppointments.map((apt) => (
                  <div key={apt.id} onClick={() => setSelectedAppointment(apt)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: "8px", border: "1px solid #f1f5f9", cursor: "pointer" }}>
                    <span style={{ fontWeight: 600, width: "80px" }}>{apt.time}</span>
                    <span style={{ flexGrow: 1, fontWeight: 600 }}>{apt.patientName}</span>
                    <span style={{ color: "#64748b", width: "200px" }}>{apt.doctorName}</span>
                    <span style={{ padding: "4px 12px", borderRadius: "12px", backgroundColor: apt.status === "Confirmé" ? "#dcfce7" : apt.status === "Annulé" ? "#fee2e2" : "#fef3c7", color: apt.status === "Confirmé" ? "#166534" : apt.status === "Annulé" ? "#ef4444" : "#92400e", fontSize: "12px", fontWeight: 600 }}>
                      {apt.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VUE PATIENTS & ENREGISTREMENT DOSSIER */}
        {(activeTab === "patients" || activeTab === "new_patient") && (
          <div style={{ maxWidth: "900px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px", gap: "16px" }}>
              <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "8px", flexGrow: 1 }}>
                <input type="text" placeholder="CIN, nom ou téléphone..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flexGrow: 1, padding: "10px 16px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
                <button type="submit" style={{ padding: "10px 20px", backgroundColor: "#0284c7", color: "#ffffff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>Rechercher</button>
              </form>
              <button onClick={() => setActiveTab("new_patient")} style={{ padding: "10px 20px", backgroundColor: "#0284c7", color: "#ffffff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>
                + Nouveau patient
              </button>
            </div>

            {hasSearched && (
              <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", marginBottom: "24px" }}>
                {searchResult ? (
                  <div>
                    <h3 style={{ fontSize: "16px", fontWeight: 600, color: "#166534" }}>Patient trouvé</h3>
                    <div style={{ fontSize: "16px", fontWeight: 700 }}>{searchResult.firstName} {searchResult.lastName}</div>
                    <div style={{ fontSize: "14px", color: "#475569" }}>CIN : {searchResult.cin} | Tél : {searchResult.phone}</div>
                    <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                      <button onClick={() => { setSelectedPatientForFolder(searchResult); setActiveTab("dossiers"); }} style={{ padding: "8px 16px", backgroundColor: "#e2e8f0", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>Ouvrir Dossier</button>
                      <button onClick={() => openRdvForPatient(`${searchResult.firstName} ${searchResult.lastName}`)} style={{ padding: "8px 16px", backgroundColor: "#0284c7", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>Nouveau RDV</button>
                    </div>
                  </div>
                ) : <div style={{ color: "#ef4444" }}>Aucun patient trouvé.</div>}
              </div>
            )}

            {activeTab === "patients" && (
              <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <h2 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px" }}>Liste des patients ({patients.length})</h2>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {patients.map((p) => (
                    <div key={p.id} style={{ padding: "12px 16px", border: "1px solid #e2e8f0", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{p.lastName} {p.firstName}</div>
                        <div style={{ fontSize: "13px", color: "#64748b" }}>CIN: {p.cin} • Tél: {p.phone}</div>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => openRdvForPatient(`${p.firstName} ${p.lastName}`)} style={{ padding: "6px 12px", backgroundColor: "#0284c7", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>+ RDV</button>
                        <button onClick={() => { setSelectedPatientForFolder(p); setActiveTab("dossiers"); }} style={{ padding: "6px 12px", backgroundColor: "#f1f5f9", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>Dossier</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "new_patient" && (
              <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "20px" }}>Nouveau patient / Préinscription</h2>
                <form onSubmit={handlePatientSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div><label style={{ fontSize: "13px", fontWeight: 600 }}>Nom *</label><input name="lastName" required value={formData.lastName} onChange={handleInputChange} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} /></div>
                    <div><label style={{ fontSize: "13px", fontWeight: 600 }}>Prénom *</label><input name="firstName" required value={formData.firstName} onChange={handleInputChange} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} /></div>
                    <div><label style={{ fontSize: "13px", fontWeight: 600 }}>CIN</label><input name="cin" value={formData.cin} onChange={handleInputChange} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} /></div>
                    <div><label style={{ fontSize: "13px", fontWeight: 600 }}>Téléphone</label><input name="phone" value={formData.phone} onChange={handleInputChange} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} /></div>
                    <div>
                      <label style={{ fontSize: "13px", fontWeight: 600 }}>Assurance / Mutuelle</label>
                      <select name="insurance" value={formData.insurance} onChange={handleInputChange} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                        <option value="CNSS">CNSS</option>
                        <option value="CNOPS">CNOPS</option>
                        <option value="AXA">AXA</option>
                        <option value="Aucune">Aucune</option>
                      </select>
                    </div>
                    <div><label style={{ fontSize: "13px", fontWeight: 600 }}>N° d'adhérent</label><input name="membershipNumber" value={formData.membershipNumber} onChange={handleInputChange} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} /></div>
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}>
                    <button type="button" onClick={() => setActiveTab("patients")} style={{ padding: "10px 20px", backgroundColor: "#e2e8f0", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>Annuler</button>
                    <button type="submit" style={{ padding: "10px 24px", backgroundColor: "#0284c7", color: "#ffffff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>Enregistrer et créer dossier</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {/* VUE RENDEZ-VOUS */}
        {activeTab === "rdv" && (
          <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>Gestion des Rendez-vous</h2>
              <button onClick={() => setIsRdvModalOpen(true)} style={{ padding: "10px 20px", backgroundColor: "#0284c7", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>
                + Prendre un RDV
              </button>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {appointments.map((apt) => (
                <div key={apt.id} style={{ padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff" }}>
                  <div style={{ fontWeight: 700, fontSize: "16px" }}>{apt.patientName}</div>
                  <div style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>Médecin: {apt.doctorName}</div>
                  <div style={{ fontWeight: 600, color: "#0284c7", marginTop: "4px" }}>{apt.date} — {apt.time}</div>
                  
                  <div style={{ marginTop: "6px", display: "flex", gap: "8px", alignItems: "center" }}>
                    <span style={{ padding: "4px 10px", borderRadius: "12px", backgroundColor: apt.status === "Confirmé" ? "#dcfce7" : apt.status === "Annulé" ? "#fee2e2" : "#fef3c7", color: apt.status === "Confirmé" ? "#166534" : apt.status === "Annulé" ? "#ef4444" : "#92400e", fontSize: "12px", fontWeight: 600 }}>
                      {apt.status}
                    </span>
                    {apt.createdByPatient && (
                      <span style={{ fontSize: "11px", backgroundColor: "#fef3c7", color: "#b45309", padding: "2px 8px", borderRadius: "4px", fontWeight: 600 }}>
                        Pris par le patient (Non modifiable par lui)
                      </span>
                    )}
                  </div>

                  {/* BOUTONS D'ACTION (Secrétariat uniquement pour modifier la date) */}
                  <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                    <button onClick={() => setEditingAppointment(apt)} style={{ padding: "6px 12px", backgroundColor: "#e0f2fe", color: "#0284c7", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                      Modifier (Secrétariat)
                    </button>
                    <button onClick={() => deleteAppointment(apt.id)} style={{ padding: "6px 12px", backgroundColor: "#fee2e2", color: "#ef4444", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                      Supprimer
                    </button>
                    <button onClick={() => setSelectedAppointment(apt)} style={{ padding: "6px 12px", backgroundColor: "#f1f5f9", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                      Détails
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* VUE DOSSIERS */}
        {activeTab === "dossiers" && (
          <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "20px" }}>Dossiers Médicaux</h2>

            {selectedPatientForFolder ? (
              <div>
                <button onClick={() => setSelectedPatientForFolder(null)} style={{ padding: "6px 12px", backgroundColor: "#e2e8f0", border: "none", borderRadius: "6px", marginBottom: "16px", cursor: "pointer" }}>← Retour aux dossiers</button>
                <div style={{ border: "1px solid #0284c7", borderRadius: "8px", padding: "20px", backgroundColor: "#f0f9ff" }}>
                  <h3 style={{ margin: 0, color: "#0284c7" }}>📂 Dossier N° {selectedPatientForFolder.id}</h3>
                  <div style={{ fontSize: "18px", fontWeight: 700, marginTop: "8px" }}>{selectedPatientForFolder.lastName} {selectedPatientForFolder.firstName}</div>
                  
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "16px", fontSize: "14px" }}>
                    <div><strong>CIN :</strong> {selectedPatientForFolder.cin || "Non renseigné"}</div>
                    <div><strong>Téléphone :</strong> {selectedPatientForFolder.phone || "Non renseigné"}</div>
                    <div><strong>Assurance :</strong> {selectedPatientForFolder.insurance || "CNSS"} (N° {selectedPatientForFolder.membershipNumber || "N/A"})</div>
                    <div><strong>Médecin traitant :</strong> {selectedPatientForFolder.desiredDoctor || "Dr. Alaoui"}</div>
                  </div>

                  <h4 style={{ marginTop: "20px", marginBottom: "8px" }}>📄 Documents déposés</h4>
                  {selectedPatientForFolder.documents && selectedPatientForFolder.documents.length > 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {selectedPatientForFolder.documents.map((doc, i) => (
                        <div key={i} style={{ padding: "8px 12px", backgroundColor: "#fff", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "13px" }}>
                          ✓ <strong>{doc.type} :</strong> {doc.fileName}
                        </div>
                      ))}
                    </div>
                  ) : <div style={{ fontSize: "13px", color: "#64748b" }}>Aucun document déposé.</div>}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {patients.map((p) => (
                  <div key={p.id} style={{ padding: "16px", border: "1px solid #e2e8f0", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>📁 {p.lastName} {p.firstName}</div>
                      <div style={{ fontSize: "13px", color: "#64748b" }}>CIN: {p.cin || "N/A"} • Dossier: {p.id}</div>
                    </div>
                    <button onClick={() => setSelectedPatientForFolder(p)} style={{ padding: "8px 16px", backgroundColor: "#0284c7", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>
                      Ouvrir dossier
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VUE MÉDECINS */}
        {activeTab === "doctors" && (
          <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "16px" }}>Médecins du Cabinet</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {doctors.map((doc, i) => (
                <div key={i} style={{ padding: "16px", border: "1px solid #e2e8f0", borderRadius: "8px", fontWeight: 600 }}>👨‍⚕️ {doc}</div>
              ))}
            </div>
          </div>
        )}

        {/* VUE ALERTES */}
        {activeTab === "alerts" && (
          <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 700 }}>Alertes</h2>
            <p style={{ color: "#64748b" }}>Aucune alerte pour le moment.</p>
          </div>
        )}
      </main>

      {/* MODAL PRENDRE UN RENDEZ-VOUS */}
      {isRdvModalOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", width: "450px", border: "1px solid #e2e8f0" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px" }}>📅 Nouveau rendez-vous</h3>

            <form onSubmit={handleRdvSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>Patient *</label>
                <select name="patientName" required value={rdvFormData.patientName} onChange={handleRdvInputChange} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                  <option value="">Sélectionner un patient</option>
                  {patients.map((p) => (
                    <option key={p.id} value={`${p.firstName} ${p.lastName}`}>{p.lastName} {p.firstName}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>Médecin *</label>
                <select name="doctorName" required value={rdvFormData.doctorName} onChange={handleRdvInputChange} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                  {doctors.map((doc, idx) => (<option key={idx} value={doc}>{doc}</option>))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>Date *</label>
                <input type="date" name="date" required value={rdvFormData.date} onChange={handleRdvInputChange} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              </div>

              <button type="button" onClick={handleCheckDisponibility} style={{ padding: "10px", backgroundColor: "#e0f2fe", color: "#0284c7", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>
                Vérifier disponibilité
              </button>

              {isSlotsChecked && (
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600, display: "block", marginBottom: "6px" }}>Créneaux disponibles :</label>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    {availableSlots.map((slot) => (
                      <button
                        key={slot}
                        type="button"
                        onClick={() => setRdvFormData((prev) => ({ ...prev, time: slot }))}
                        style={{
                          padding: "6px 12px", borderRadius: "6px",
                          border: rdvFormData.time === slot ? "2px solid #0284c7" : "1px solid #cbd5e1",
                          backgroundColor: rdvFormData.time === slot ? "#e0f2fe" : "#ffffff",
                          color: rdvFormData.time === slot ? "#0284c7" : "#0f172a",
                          fontWeight: 600, cursor: "pointer",
                        }}
                      >
                        {slot}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>Motif</label>
                <input name="notes" value={rdvFormData.notes} onChange={handleRdvInputChange} placeholder="Motif du rendez-vous..." style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              </div>

              <div style={{ display: "flex", gap: "12px", marginTop: "12px" }}>
                <button type="button" onClick={closeRdvModal} style={{ flex: 1, padding: "10px", backgroundColor: "#e2e8f0", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>
                  Annuler
                </button>
                <button type="submit" style={{ flex: 1, padding: "10px", backgroundColor: "#0284c7", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>
                  Programmer le rendez-vous
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL REPROGRAMMATION RDV (Secrétariat uniquement) */}
      {editingAppointment && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", width: "400px", border: "1px solid #e2e8f0" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "12px" }}>Reprogrammer le RDV (Secrétariat)</h3>
            
            <div style={{ backgroundColor: "#f8fafc", padding: "12px", borderRadius: "6px", marginBottom: "16px", fontSize: "14px" }}>
              <div><strong>Ancien RDV :</strong></div>
              <div>{editingAppointment.doctorName}</div>
              <div>{editingAppointment.date} à {editingAppointment.time}</div>
            </div>

            <div style={{ marginBottom: "16px" }}>
              <label style={{ fontSize: "13px", fontWeight: 600 }}>Nouveau créneau horaire</label>
              <select value={newRescheduleTime} onChange={(e) => setNewRescheduleTime(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1", marginTop: "4px" }}>
                <option value="">Sélectionner une nouvelle heure...</option>
                <option value="11:30">11:30</option>
                <option value="12:00">12:00</option>
                <option value="15:30">15:30</option>
              </select>
            </div>

            <div style={{ display: "flex", gap: "8px" }}>
              <button onClick={() => handleReschedule(editingAppointment.id)} style={{ flex: 1, padding: "10px", backgroundColor: "#0284c7", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>
                Confirmer
              </button>
              <button onClick={() => setEditingAppointment(null)} style={{ flex: 1, padding: "10px", backgroundColor: "#e2e8f0", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DÉTAILS RDV */}
      {selectedAppointment && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", width: "400px", border: "1px solid #e2e8f0" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px" }}>Détails du Rendez-vous</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "20px" }}>
              <div><strong>Date & Heure :</strong> {selectedAppointment.date} à {selectedAppointment.time}</div>
              <div><strong>Patient :</strong> {selectedAppointment.patientName}</div>
              <div><strong>Médecin :</strong> {selectedAppointment.doctorName}</div>
              <div><strong>Statut :</strong> {selectedAppointment.status}</div>
              {selectedAppointment.notes && <div><strong>Motif :</strong> {selectedAppointment.notes}</div>}
            </div>
            <button onClick={() => setSelectedAppointment(null)} style={{ width: "100%", padding: "10px", backgroundColor: "#0284c7", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>
              Fermer
            </button>
          </div>
        </div>
      )}

    </div>
  );
}