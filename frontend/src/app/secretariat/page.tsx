"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type TabType = "dashboard" | "patients" | "new_patient" | "rdv" | "doctors" | "dossiers" | "alerts";

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: string | null;
  blood_group: string;
  national_id: string | null;
  address: string | null;
}

interface DoctorSummary {
  id: string;
  first_name: string;
  last_name: string;
  specialty: string | null;
}

interface Appointment {
  id: string;
  doctor_id: string;
  patient_id: string;
  scheduled_at: string;
  status: string;
  reason: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Programmé",
  confirmed: "Confirmé",
  cancelled: "Annulé",
  completed: "Terminé",
  no_show: "Absence",
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  scheduled: { bg: "#fef3c7", text: "#92400e" },
  confirmed: { bg: "#dcfce7", text: "#166534" },
  cancelled: { bg: "#fee2e2", text: "#ef4444" },
  completed: { bg: "#e0f2fe", text: "#0284c7" },
  no_show: { bg: "#f1f5f9", text: "#64748b" },
};

export default function SecretariatDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [filterPendingOnly, setFilterPendingOnly] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string>("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<DoctorSummary[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState<string>("");
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);
  const [newRescheduleTime, setNewRescheduleTime] = useState<string>("");
  const [rescheduleChecking, setRescheduleChecking] = useState(false);
  const [isRdvModalOpen, setIsRdvModalOpen] = useState<boolean>(false);
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [isSlotsChecked, setIsSlotsChecked] = useState<boolean>(false);
  const [checkingSlots, setCheckingSlots] = useState(false);
  const [rdvFormData, setRdvFormData] = useState({
    patientId: "",
    doctorId: "",
    date: "",
    time: "",
    notes: "",
  });
  const [patientFormError, setPatientFormError] = useState<string>("");
  const [patientFormLoading, setPatientFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    lastName: "",
    firstName: "",
    email: "",
    password: "",
    nationalId: "",
    dateOfBirth: "",
    sex: "F",
    bloodGroup: "unknown",
    address: "",
  });
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchResult, setSearchResult] = useState<Patient | null>(null);
  const [hasSearched, setHasSearched] = useState<boolean>(false);
  const [selectedPatientForFolder, setSelectedPatientForFolder] = useState<Patient | null>(null);

  const patientName = (id: string) => {
    const p = patients.find((x) => x.id === id);
    return p ? `${p.first_name} ${p.last_name}` : "Patient inconnu";
  };

  const doctorName = (id: string) => {
    const d = doctors.find((x) => x.id === id);
    return d ? `Dr. ${d.first_name} ${d.last_name}` : "Médecin inconnu";
  };

  const loadAll = useCallback(async () => {
    setLoadError("");
    try {
      const [p, d, a] = await Promise.all([
        api<Patient[]>("/patients/"),
        api<DoctorSummary[]>("/doctors"),
        api<Appointment[]>("/appointments/"),
      ]);
      setPatients(p);
      setDoctors(d);
      setAppointments(a);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Impossible de charger les données.");
    }
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("medical_token")) {
      router.push("/connexion");
      return;
    }
    loadAll();
  }, [loadAll, router]);

  function logout() {
    localStorage.clear();
    router.push("/connexion");
  }

  async function checkNewRdvSlots() {
    if (!rdvFormData.doctorId || !rdvFormData.date) {
      alert("Choisis un médecin et une date d'abord.");
      return;
    }
    setCheckingSlots(true);
    try {
      const res = await api<{ date: string; available_slots: string[] }>(
        `/appointments/available-slots/?doctor_id=${rdvFormData.doctorId}&target_date=${rdvFormData.date}`
      );
      setAvailableSlots(res.available_slots);
      setIsSlotsChecked(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Impossible de vérifier les créneaux.");
    } finally {
      setCheckingSlots(false);
    }
  }

  async function handleRdvSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!rdvFormData.patientId || !rdvFormData.doctorId || !rdvFormData.time) {
      alert("Patient, médecin et créneau horaire sont requis.");
      return;
    }
    try {
      await api("/appointments/secretariat", {
        method: "POST",
        body: JSON.stringify({
          patient_id: rdvFormData.patientId,
          doctor_id: rdvFormData.doctorId,
          scheduled_at: `${rdvFormData.date}T${rdvFormData.time}:00`,
          reason: rdvFormData.notes || null,
        }),
      });
      closeRdvModal();
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Création du rendez-vous impossible.");
    }
  }

  function closeRdvModal() {
    setIsRdvModalOpen(false);
    setIsSlotsChecked(false);
    setAvailableSlots([]);
    setRdvFormData({ patientId: "", doctorId: "", date: "", time: "", notes: "" });
  }

  /* FIX 1: Ajout de l'ouverture du Modal après affectation de l'ID */
  function openRdvForPatient(patientId: string) {
    setRdvFormData((prev) => ({ ...prev, patientId }));
    setIsRdvModalOpen(true);
  }

  async function checkRescheduleSlots() {
    if (!editingAppointment || !rescheduleDate) return;
    setRescheduleChecking(true);
    try {
      const res = await api<{ date: string; available_slots: string[] }>(
        `/appointments/available-slots/?doctor_id=${editingAppointment.doctor_id}&target_date=${rescheduleDate}`
      );
      setRescheduleSlots(res.available_slots);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Impossible de vérifier les créneaux.");
    } finally {
      setRescheduleChecking(false);
    }
  }

  async function handleReschedule() {
    if (!editingAppointment || !rescheduleDate || !newRescheduleTime) {
      alert("Choisis une date et une heure.");
      return;
    }
    try {
      await api(`/appointments/${editingAppointment.id}`, {
        method: "PUT",
        body: JSON.stringify({
          scheduled_at: `${rescheduleDate}T${newRescheduleTime}:00`,
        }),
      });
      setEditingAppointment(null);
      setRescheduleDate("");
      setRescheduleSlots([]);
      setNewRescheduleTime("");
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Reprogrammation impossible.");
    }
  }

  async function deleteAppointment(id: string) {
    if (!confirm("Voulez-vous vraiment supprimer définitivement ce rendez-vous ?")) return;
    try {
      await api(`/appointments/${id}`, { method: "DELETE" });
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Suppression impossible.");
    }
  }

  async function handlePatientSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPatientFormError("");
    setPatientFormLoading(true);
    try {
      await api("/auth/register/patient", {
        method: "POST",
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          first_name: formData.firstName,
          last_name: formData.lastName,
          national_id: formData.nationalId || null,
          date_of_birth: formData.dateOfBirth,
          sex: formData.sex,
          blood_group: formData.bloodGroup,
          address: formData.address || null,
        }),
      });
      setFormData({
        lastName: "", firstName: "", email: "", password: "",
        nationalId: "", dateOfBirth: "", sex: "F", bloodGroup: "unknown", address: "",
      });
      setActiveTab("patients");
      await loadAll();
    } catch (err) {
      setPatientFormError(err instanceof Error ? err.message : "Création du patient impossible.");
    } finally {
      setPatientFormLoading(false);
    }
  }

  /* FIX 2: Nettoyage et cohérence de la requête de recherche */
  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setHasSearched(true);
    const query = searchQuery.toLowerCase().trim();
    if (!query) { setSearchResult(null); return; }
    const found = patients.find(
      (p) =>
        (p.national_id || "").toLowerCase().includes(query) ||
        p.last_name.toLowerCase().includes(query) ||
        p.first_name.toLowerCase().includes(query)
    );
    setSearchResult(found || null);
  }

  const displayedAppointments = filterPendingOnly
    ? appointments.filter((a) => a.status === "scheduled")
    : appointments;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f8fafc", fontFamily: "system-ui, sans-serif", color: "#0f172a", display: "flex", flexDirection: "column" }}>
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

      <main style={{ padding: "32px", flexGrow: 1, maxWidth: "1200px", width: "100%", margin: "0 auto" }}>
        {loadError && (
          <div style={{ backgroundColor: "#fee2e2", color: "#ef4444", padding: "12px 16px", borderRadius: "8px", marginBottom: "20px" }}>
            {loadError}
          </div>
        )}

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
                <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "8px" }}>Rendez-vous</div>
                <div style={{ fontSize: "28px", fontWeight: 700, color: "#0284c7" }}>{appointments.length}</div>
              </div>
              <div onClick={() => setActiveTab("patients")} style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "12px", border: "1px solid #e2e8f0", cursor: "pointer" }}>
                <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "8px" }}>Patients</div>
                <div style={{ fontSize: "28px", fontWeight: 700, color: "#0f172a" }}>{patients.length}</div>
              </div>
              <div onClick={() => setFilterPendingOnly(true)} style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "12px", border: filterPendingOnly ? "2px solid #d97706" : "1px solid #e2e8f0", cursor: "pointer" }}>
                <div style={{ fontSize: "14px", color: "#64748b", marginBottom: "8px" }}>Programmés</div>
                <div style={{ fontSize: "28px", fontWeight: 700, color: "#d97706" }}>{appointments.filter((a) => a.status === "scheduled").length}</div>
              </div>
            </div>
            <div style={{ backgroundColor: "#ffffff", borderRadius: "12px", padding: "24px", border: "1px solid #e2e8f0" }}>
              <h2 style={{ fontSize: "18px", fontWeight: 600, marginBottom: "16px" }}>
                {filterPendingOnly ? "Rendez-vous programmés" : "Tous les rendez-vous"}
              </h2>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {displayedAppointments.map((apt) => {
                  const dt = new Date(apt.scheduled_at);
                  const colors = STATUS_COLORS[apt.status] || STATUS_COLORS.scheduled;
                  return (
                    <div key={apt.id} onClick={() => setSelectedAppointment(apt)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderRadius: "8px", border: "1px solid #f1f5f9", cursor: "pointer" }}>
                      <span style={{ fontWeight: 600, width: "140px" }}>{dt.toLocaleString("fr-FR")}</span>
                      <span style={{ flexGrow: 1, fontWeight: 600 }}>{patientName(apt.patient_id)}</span>
                      <span style={{ color: "#64748b", width: "200px" }}>{doctorName(apt.doctor_id)}</span>
                      <span style={{ padding: "4px 12px", borderRadius: "12px", backgroundColor: colors.bg, color: colors.text, fontSize: "12px", fontWeight: 600 }}>
                        {STATUS_LABELS[apt.status] || apt.status}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {(activeTab === "patients" || activeTab === "new_patient") && (
          <div style={{ maxWidth: "900px", margin: "0 auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "24px", gap: "16px" }}>
              <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: "8px", flexGrow: 1 }}>
                <input type="text" placeholder="CIN, nom..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ flexGrow: 1, padding: "10px 16px", borderRadius: "8px", border: "1px solid #cbd5e1" }} />
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
                    <div style={{ fontSize: "16px", fontWeight: 700 }}>{searchResult.first_name} {searchResult.last_name}</div>
                    <div style={{ fontSize: "14px", color: "#475569" }}>CIN : {searchResult.national_id || "—"}</div>
                    <div style={{ marginTop: "12px", display: "flex", gap: "8px" }}>
                      <button onClick={() => { setSelectedPatientForFolder(searchResult); setActiveTab("dossiers"); }} style={{ padding: "8px 16px", backgroundColor: "#e2e8f0", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>Ouvrir Dossier</button>
                      <button onClick={() => openRdvForPatient(searchResult.id)} style={{ padding: "8px 16px", backgroundColor: "#0284c7", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>Nouveau RDV</button>
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
                        <div style={{ fontWeight: 700 }}>{p.last_name} {p.first_name}</div>
                        <div style={{ fontSize: "13px", color: "#64748b" }}>CIN: {p.national_id || "—"} • Groupe: {p.blood_group}</div>
                      </div>
                      <div style={{ display: "flex", gap: "8px" }}>
                        <button onClick={() => openRdvForPatient(p.id)} style={{ padding: "6px 12px", backgroundColor: "#0284c7", color: "#fff", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>+ RDV</button>
                        <button onClick={() => { setSelectedPatientForFolder(p); setActiveTab("dossiers"); }} style={{ padding: "6px 12px", backgroundColor: "#f1f5f9", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>Dossier</button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {activeTab === "new_patient" && (
              <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
                <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "8px" }}>Nouveau patient</h2>
                <p style={{ fontSize: "13px", color: "#64748b", marginBottom: "20px" }}>
                  Chaque patient a besoin d'un email et d'un mot de passe temporaire pour accéder à son espace ensuite.
                </p>
                <form onSubmit={handlePatientSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                    <div><label style={{ fontSize: "13px", fontWeight: 600 }}>Nom *</label><input required value={formData.lastName} onChange={(e) => setFormData((f) => ({ ...f, lastName: e.target.value }))} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} /></div>
                    <div><label style={{ fontSize: "13px", fontWeight: 600 }}>Prénom *</label><input required value={formData.firstName} onChange={(e) => setFormData((f) => ({ ...f, firstName: e.target.value }))} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} /></div>
                    <div><label style={{ fontSize: "13px", fontWeight: 600 }}>Email *</label><input type="email" required value={formData.email} onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} /></div>
                    <div><label style={{ fontSize: "13px", fontWeight: 600 }}>Mot de passe temporaire *</label><input type="text" required value={formData.password} onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} /></div>
                    <div><label style={{ fontSize: "13px", fontWeight: 600 }}>CIN</label><input value={formData.nationalId} onChange={(e) => setFormData((f) => ({ ...f, nationalId: e.target.value }))} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} /></div>
                    <div><label style={{ fontSize: "13px", fontWeight: 600 }}>Date de naissance *</label><input type="date" required value={formData.dateOfBirth} onChange={(e) => setFormData((f) => ({ ...f, dateOfBirth: e.target.value }))} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} /></div>
                    <div>
                      <label style={{ fontSize: "13px", fontWeight: 600 }}>Sexe</label>
                      <select value={formData.sex} onChange={(e) => setFormData((f) => ({ ...f, sex: e.target.value }))} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                        <option value="F">Femme</option><option value="M">Homme</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ fontSize: "13px", fontWeight: 600 }}>Groupe sanguin</label>
                      <select value={formData.bloodGroup} onChange={(e) => setFormData((f) => ({ ...f, bloodGroup: e.target.value }))} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                        {["unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => <option key={bg} value={bg}>{bg === "unknown" ? "Inconnu" : bg}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label style={{ fontSize: "13px", fontWeight: 600 }}>Adresse</label>
                    <input value={formData.address} onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
                  </div>
                  {patientFormError && <p style={{ color: "#ef4444", fontSize: "14px" }}>{patientFormError}</p>}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "12px" }}>
                    <button type="button" onClick={() => setActiveTab("patients")} style={{ padding: "10px 20px", backgroundColor: "#e2e8f0", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>Annuler</button>
                    <button type="submit" disabled={patientFormLoading} style={{ padding: "10px 24px", backgroundColor: "#0284c7", color: "#ffffff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>
                      {patientFormLoading ? "Création..." : "Créer le compte patient"}
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        )}

        {activeTab === "rdv" && (
          <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: 700, margin: 0 }}>Gestion des Rendez-vous</h2>
              <button onClick={() => setIsRdvModalOpen(true)} style={{ padding: "10px 20px", backgroundColor: "#0284c7", color: "#fff", border: "none", borderRadius: "8px", fontWeight: 600, cursor: "pointer" }}>
                + Prendre un RDV
              </button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
              {appointments.map((apt) => {
                const dt = new Date(apt.scheduled_at);
                const colors = STATUS_COLORS[apt.status] || STATUS_COLORS.scheduled;
                return (
                  <div key={apt.id} style={{ padding: "16px", borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "#ffffff" }}>
                    <div style={{ fontWeight: 700, fontSize: "16px" }}>{patientName(apt.patient_id)}</div>
                    <div style={{ color: "#64748b", fontSize: "13px", marginTop: "4px" }}>Médecin: {doctorName(apt.doctor_id)}</div>
                    <div style={{ fontWeight: 600, color: "#0284c7", marginTop: "4px" }}>{dt.toLocaleString("fr-FR")}</div>
                    <div style={{ marginTop: "6px" }}>
                      <span style={{ padding: "4px 10px", borderRadius: "12px", backgroundColor: colors.bg, color: colors.text, fontSize: "12px", fontWeight: 600 }}>
                        {STATUS_LABELS[apt.status] || apt.status}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                      <button onClick={() => { setEditingAppointment(apt); setRescheduleDate(""); setRescheduleSlots([]); setNewRescheduleTime(""); }} style={{ padding: "6px 12px", backgroundColor: "#e0f2fe", color: "#0284c7", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                        Modifier
                      </button>
                      <button onClick={() => deleteAppointment(apt.id)} style={{ padding: "6px 12px", backgroundColor: "#fee2e2", color: "#ef4444", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                        Supprimer
                      </button>
                      <button onClick={() => setSelectedAppointment(apt)} style={{ padding: "6px 12px", backgroundColor: "#f1f5f9", border: "none", borderRadius: "6px", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>
                        Détails
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {activeTab === "dossiers" && (
          <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "20px" }}>Dossiers Médicaux</h2>
            {selectedPatientForFolder ? (
              <div>
                <button onClick={() => setSelectedPatientForFolder(null)} style={{ padding: "6px 12px", backgroundColor: "#e2e8f0", border: "none", borderRadius: "6px", marginBottom: "16px", cursor: "pointer" }}>← Retour aux dossiers</button>
                <div style={{ border: "1px solid #0284c7", borderRadius: "8px", padding: "20px", backgroundColor: "#f0f9ff" }}>
                  <div style={{ fontSize: "18px", fontWeight: 700, marginTop: "8px" }}>{selectedPatientForFolder.last_name} {selectedPatientForFolder.first_name}</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginTop: "16px", fontSize: "14px" }}>
                    <div><strong>CIN :</strong> {selectedPatientForFolder.national_id || "Non renseigné"}</div>
                    <div><strong>Groupe sanguin :</strong> {selectedPatientForFolder.blood_group}</div>
                    <div><strong>Adresse :</strong> {selectedPatientForFolder.address || "Non renseignée"}</div>
                    <div><strong>Date de naissance :</strong> {selectedPatientForFolder.date_of_birth}</div>
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {patients.map((p) => (
                  <div key={p.id} style={{ padding: "16px", border: "1px solid #e2e8f0", borderRadius: "8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 700 }}>📁 {p.last_name} {p.first_name}</div>
                      <div style={{ fontSize: "13px", color: "#64748b" }}>CIN: {p.national_id || "N/A"}</div>
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

        {activeTab === "doctors" && (
          <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 700, marginBottom: "16px" }}>Médecins du Cabinet</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {doctors.map((doc) => (
                <div key={doc.id} style={{ padding: "16px", border: "1px solid #e2e8f0", borderRadius: "8px", fontWeight: 600 }}>
                  👨‍⚕️ Dr. {doc.first_name} {doc.last_name}{doc.specialty ? ` (${doc.specialty})` : ""}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === "alerts" && (
          <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", border: "1px solid #e2e8f0" }}>
            <h2 style={{ fontSize: "20px", fontWeight: 700 }}>Alertes</h2>
            <p style={{ color: "#64748b" }}>Aucune alerte pour le moment.</p>
          </div>
        )}
      </main>

      {/* Modal Nouveau RDV */}
      {isRdvModalOpen && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", width: "450px", border: "1px solid #e2e8f0" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px" }}>📅 Nouveau rendez-vous</h3>
            <form onSubmit={handleRdvSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>Patient *</label>
                <select required value={rdvFormData.patientId} onChange={(e) => setRdvFormData((f) => ({ ...f, patientId: e.target.value }))} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                  <option value="">Sélectionner un patient</option>
                  {patients.map((p) => <option key={p.id} value={p.id}>{p.last_name} {p.first_name}</option>)}
                </select>
              </div>
             
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>Date *</label>
                <input type="date" required value={rdvFormData.date} onChange={(e) => { setRdvFormData((f) => ({ ...f, date: e.target.value })); setIsSlotsChecked(false); }} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              </div>
              <button type="button" onClick={checkNewRdvSlots} disabled={checkingSlots} style={{ padding: "8px", backgroundColor: "#e2e8f0", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>
                {checkingSlots ? "Vérification..." : "Vérifier les créneaux disponibles"}
              </button>
              {isSlotsChecked && (
                <div>
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>Horaire *</label>
                  {availableSlots.length > 0 ? (
                    <select required value={rdvFormData.time} onChange={(e) => setRdvFormData((f) => ({ ...f, time: e.target.value }))} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                      <option value="">Sélectionner une heure</option>
                      {availableSlots.map((slot) => <option key={slot} value={slot}>{slot}</option>)}
                    </select>
                  ) : <p style={{ color: "#ef4444", fontSize: "13px", marginTop: "4px" }}>Aucun créneau disponible pour cette date.</p>}
                </div>
              )}

              {/* FIX 3: Harmonisation du champ notes/motif */}
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>Motif / Notes</label>
                <input value={rdvFormData.notes} onChange={(e) => setRdvFormData((f) => ({ ...f, notes: e.target.value }))} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
                <button type="button" onClick={closeRdvModal} style={{ padding: "8px 16px", backgroundColor: "#e2e8f0", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>Annuler</button>
                <button type="submit" style={{ padding: "8px 16px", backgroundColor: "#0284c7", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>Confirmer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Reprogrammation */}
      {editingAppointment && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", width: "400px", border: "1px solid #e2e8f0" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px" }}>Reprogrammer le rendez-vous</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "13px", fontWeight: 600 }}>Nouvelle date</label>
                <input type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }} />
              </div>
              <button type="button" onClick={checkRescheduleSlots} disabled={rescheduleChecking} style={{ padding: "8px", backgroundColor: "#e2e8f0", border: "none", borderRadius: "6px", cursor: "pointer", fontSize: "13px", fontWeight: 600 }}>
                {rescheduleChecking ? "Vérification..." : "Voir les créneaux libres"}
              </button>
              {rescheduleSlots.length > 0 && (
                <div>
                  {/* FIX 4: Correction de la syntaxe du style inline (fontWeight: 600) */}
                  <label style={{ fontSize: "13px", fontWeight: 600 }}>Nouvel horaire</label>
                  <select value={newRescheduleTime} onChange={(e) => setNewRescheduleTime(e.target.value)} style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid #cbd5e1" }}>
                    <option value="">Sélectionner une heure</option>
                    {rescheduleSlots.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              )}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px", marginTop: "12px" }}>
                <button onClick={() => setEditingAppointment(null)} style={{ padding: "8px 16px", backgroundColor: "#e2e8f0", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>Annuler</button>
                <button onClick={handleReschedule} style={{ padding: "8px 16px", backgroundColor: "#0284c7", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>Sauvegarder</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Détails RDV */}
      {selectedAppointment && (
        <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
          <div style={{ backgroundColor: "#ffffff", padding: "24px", borderRadius: "12px", width: "400px", border: "1px solid #e2e8f0" }}>
            <h3 style={{ fontSize: "18px", fontWeight: 700, marginBottom: "16px" }}>Détails du Rendez-vous</h3>
            <div style={{ fontSize: "14px", display: "flex", flexDirection: "column", gap: "8px" }}>
              <div><strong>Patient :</strong> {patientName(selectedAppointment.patient_id)}</div>
              <div><strong>Médecin :</strong> {doctorName(selectedAppointment.doctor_id)}</div>
              <div><strong>Date & Heure :</strong> {new Date(selectedAppointment.scheduled_at).toLocaleString("fr-FR")}</div>
              <div><strong>Statut :</strong> {STATUS_LABELS[selectedAppointment.status] || selectedAppointment.status}</div>
              <div><strong>Motif :</strong> {selectedAppointment.reason || "Aucun motif spécifié"}</div>
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "20px" }}>
              <button onClick={() => setSelectedAppointment(null)} style={{ padding: "8px 16px", backgroundColor: "#0284c7", color: "#fff", border: "none", borderRadius: "6px", fontWeight: 600, cursor: "pointer" }}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}