"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type TabType = "dashboard" | "rdv" | "patients" | "new_patient" | "doctors" | "alerts";

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

const NAV: { id: TabType; label: string }[] = [
  { id: "dashboard", label: "Journée" },
  { id: "rdv", label: "Rendez-vous" },
  { id: "patients", label: "Patients" },
  { id: "doctors", label: "Médecins" },
  { id: "alerts", label: "Alertes" },
];

function parseLocal(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(iso);
  if (!m) return new Date(iso);
  return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
}

function fmtTime(iso: string) {
  return parseLocal(iso).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDay(iso: string) {
  return parseLocal(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function isToday(iso: string) {
  return parseLocal(iso).toDateString() === new Date().toDateString();
}

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayChipLabel(d: Date, offset: number) {
  if (offset === 0) return { top: "Auj.", bottom: String(d.getDate()) };
  if (offset === 1) return { top: "Dem.", bottom: String(d.getDate()) };
  return {
    top: d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""),
    bottom: String(d.getDate()),
  };
}

const DAY_START_MIN = 8 * 60;
const DAY_END_MIN = 18 * 60 + 30;
const SLOT_MIN = 30;

const DAY_GRID: string[] = (() => {
  const out: string[] = [];
  for (let m = DAY_START_MIN; m <= DAY_END_MIN; m += SLOT_MIN) {
    out.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }
  return out;
})();

export default function SecretariatDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [dashFilter, setDashFilter] = useState<"all" | "today" | "scheduled">("all");
  const [loadError, setLoadError] = useState("");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<DoctorSummary[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);
  const [newRescheduleTime, setNewRescheduleTime] = useState("");
  const [rescheduleChecking, setRescheduleChecking] = useState(false);
  const [isRdvModalOpen, setIsRdvModalOpen] = useState(false);
  const [rdvFormError, setRdvFormError] = useState("");
  const [rdvFormData, setRdvFormData] = useState({ patientId: "", doctorId: "", date: "", time: "", notes: "" });
  const [rdvSlots, setRdvSlots] = useState<string[]>([]);
  const [rdvSlotsLoading, setRdvSlotsLoading] = useState(false);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [showCustomReDate, setShowCustomReDate] = useState(false);
  const [patientFormError, setPatientFormError] = useState("");
  const [patientFormLoading, setPatientFormLoading] = useState(false);
  const [formData, setFormData] = useState({
    lastName: "", firstName: "", email: "", password: "",
    nationalId: "", dateOfBirth: "", sex: "F", bloodGroup: "unknown", address: "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [openPatientId, setOpenPatientId] = useState<string | null>(null);

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

  const rdvDoctorId = rdvFormData.doctorId || (doctors.length > 0 ? doctors[0].id : "");

  useEffect(() => {
    if (!isRdvModalOpen || !rdvDoctorId || !rdvFormData.date) {
      setRdvSlots([]);
      return;
    }
    let cancelled = false;
    setRdvSlotsLoading(true);
    api<{ date: string; available_slots: string[] }>(
      `/appointments/available-slots/?doctor_id=${rdvDoctorId}&target_date=${rdvFormData.date}`
    )
      .then((res) => { if (!cancelled) setRdvSlots(res.available_slots || []); })
      .catch(() => { if (!cancelled) setRdvSlots([]); })
      .finally(() => { if (!cancelled) setRdvSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [isRdvModalOpen, rdvDoctorId, rdvFormData.date]);

  async function handleRdvSubmit(e: React.FormEvent) {
    e.preventDefault();
    setRdvFormError("");
    const autoDoctorId = rdvFormData.doctorId || (doctors.length > 0 ? doctors[0].id : "");
    if (!rdvFormData.patientId || !autoDoctorId || !rdvFormData.date || !rdvFormData.time) {
      setRdvFormError("Patient, médecin, date et heure sont requis.");
      return;
    }
    try {
      await api("/appointments/secretariat", {
        method: "POST",
        body: JSON.stringify({
          patient_id: rdvFormData.patientId,
          doctor_id: autoDoctorId,
          scheduled_at: `${rdvFormData.date}T${rdvFormData.time}:00`,
          reason: rdvFormData.notes || null,
        }),
      });
      closeRdvModal();
      await loadAll();
    } catch (err) {
      setRdvFormError(err instanceof Error ? err.message : "Création du rendez-vous impossible.");
    }
  }

  function closeRdvModal() {
    setIsRdvModalOpen(false);
    setRdvFormError("");
    setRdvFormData({ patientId: "", doctorId: "", date: "", time: "", notes: "" });
    setRdvSlots([]);
    setShowCustomDate(false);
  }

  function openRdvForPatient(patientId: string) {
    setRdvFormData((prev) => ({ ...prev, patientId }));
    setRdvFormError("");
    setIsRdvModalOpen(true);
  }

  useEffect(() => {
    if (!editingAppointment || !rescheduleDate) {
      setRescheduleSlots([]);
      return;
    }
    let cancelled = false;
    setRescheduleChecking(true);
    api<{ date: string; available_slots: string[] }>(
      `/appointments/available-slots/?doctor_id=${editingAppointment.doctor_id}&target_date=${rescheduleDate}`
    )
      .then((res) => { if (!cancelled) setRescheduleSlots(res.available_slots || []); })
      .catch(() => { if (!cancelled) setRescheduleSlots([]); })
      .finally(() => { if (!cancelled) setRescheduleChecking(false); });
    return () => { cancelled = true; };
  }, [editingAppointment, rescheduleDate]);

  async function handleReschedule() {
    if (!editingAppointment || !rescheduleDate || !newRescheduleTime) {
      alert("Choisis une date et une heure.");
      return;
    }
    try {
      await api(`/appointments/${editingAppointment.id}`, {
        method: "PUT",
        body: JSON.stringify({ scheduled_at: `${rescheduleDate}T${newRescheduleTime}:00` }),
      });
      closeReschedule();
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Reprogrammation impossible.");
    }
  }

  function closeReschedule() {
    setEditingAppointment(null);
    setRescheduleDate("");
    setRescheduleSlots([]);
    setNewRescheduleTime("");
    setShowCustomReDate(false);
  }

  async function deleteAppointment(id: string) {
    if (!confirm("Voulez-vous vraiment supprimer définitivement ce rendez-vous ?")) return;
    setSelectedAppointment(null);
    setEditingAppointment(null);
    setAppointments((prev) => prev.filter((a) => a.id !== id));
    try {
      await api(`/appointments/${id}`, { method: "DELETE" });
    } catch {
      // Un DELETE qui répond 204 n'a pas de corps JSON : le helper api() lève,
      // alors que la suppression a réussi. loadAll() ci-dessous tranche.
    }
    await loadAll();
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

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    setActiveTab("patients");
    setHasSearched(true);
    const q = searchQuery.toLowerCase().trim();
    if (!q) {
      setSearchResults([]);
      return;
    }
    setSearchResults(
      patients.filter(
        (p) =>
          (p.national_id || "").toLowerCase().includes(q) ||
          p.last_name.toLowerCase().includes(q) ||
          p.first_name.toLowerCase().includes(q) ||
          `${p.first_name} ${p.last_name}`.toLowerCase().includes(q)
      )
    );
  }

  const displayedAppointments = appointments
    .filter((a) => {
      if (dashFilter === "today") return isToday(a.scheduled_at);
      if (dashFilter === "scheduled") return a.status === "scheduled";
      return true;
    })
    .sort((a, b) => parseLocal(a.scheduled_at).getTime() - parseLocal(b.scheduled_at).getTime());

  const todayCount = appointments.filter((a) => isToday(a.scheduled_at)).length;
  const scheduledCount = appointments.filter((a) => a.status === "scheduled").length;
  const listedPatients = hasSearched && searchQuery.trim() ? searchResults : patients;

  function slotCells(doctorId: string, dateISO: string, apiSlots: string[], excludeId?: string) {
    const now = new Date();
    const freeSet = apiSlots.length > 0 ? new Set(apiSlots.map((x) => x.slice(0, 5))) : null;
    return DAY_GRID.map((hhmm) => {
      const booked = appointments.find(
        (a) =>
          a.doctor_id === doctorId &&
          a.status !== "cancelled" &&
          a.id !== excludeId &&
          toISODate(parseLocal(a.scheduled_at)) === dateISO &&
          fmtTime(a.scheduled_at) === hhmm
      );
      const past = new Date(`${dateISO}T${hhmm}:00`) < now;
      const blockedByApi = freeSet !== null && !freeSet.has(hhmm) && !booked;
      return { hhmm, booked, past, taken: Boolean(booked) || blockedByApi };
    });
  }

  const rdvCells = rdvDoctorId && rdvFormData.date ? slotCells(rdvDoctorId, rdvFormData.date, rdvSlots) : [];
  const rdvFree = rdvCells.filter((c) => !c.taken && !c.past).length;

  const reCells = editingAppointment && rescheduleDate
    ? slotCells(editingAppointment.doctor_id, rescheduleDate, rescheduleSlots, editingAppointment.id)
    : [];
  const reFree = reCells.filter((c) => !c.taken && !c.past).length;

  return (
    <div className="shell">
      <style jsx>{`
        .shell {
          --blue: #1877e0;
          --blue-dark: #0f5cbf;
          --blue-soft: #eaf3fd;
          --navy: #0a2540;
          --muted: #5a7590;
          --line: #e1eaf3;
          --paper: #f5f9fd;
          --green: #1a7f4b;
          --green-bg: #e6f4ec;
          --amber: #a86a12;
          --amber-bg: #fbf0de;
          --red: #cf3a3a;
          --red-bg: #fcebeb;
          min-height: 100vh;
          background: var(--paper);
          color: var(--navy);
        }

        .topbar {
          position: sticky;
          top: 0;
          z-index: 100;
          background: #fff;
          border-bottom: 1px solid var(--line);
          padding: 0 32px;
          display: flex;
          align-items: center;
          gap: 28px;
        }
        .brand {
          font-size: 21px;
          font-weight: 800;
          letter-spacing: -0.03em;
          color: var(--navy);
          padding: 16px 0;
        }
        .brand span { color: var(--blue); }

        .tabs { display: flex; gap: 4px; flex-grow: 1; }
        .tab {
          position: relative;
          border: none;
          background: none;
          font: inherit;
          font-size: 15px;
          font-weight: 600;
          color: var(--muted);
          padding: 20px 14px;
          cursor: pointer;
          transition: color 0.18s ease;
        }
        .tab:hover { color: var(--navy); }
        .tab::after {
          content: "";
          position: absolute;
          left: 12px;
          right: 12px;
          bottom: 0;
          height: 3px;
          border-radius: 3px 3px 0 0;
          background: var(--blue);
          transform: scaleX(0);
          transform-origin: center;
          transition: transform 0.28s cubic-bezier(0.34, 1.3, 0.64, 1);
        }
        .tab.on { color: var(--blue); }
        .tab.on::after { transform: scaleX(1); }

        .who { font-size: 14px; font-weight: 600; color: var(--muted); }
        .signout {
          border: none; background: none; font: inherit; font-size: 14px;
          color: var(--muted); cursor: pointer; padding: 6px 0;
          transition: color 0.18s ease;
        }
        .signout:hover { color: var(--red); }

        .band {
          background: linear-gradient(180deg, #e9f2fb 0%, var(--paper) 100%);
          padding: 32px 32px 0;
        }
        .wrap { max-width: 1180px; margin: 0 auto; width: 100%; }
        .main { padding: 28px 32px 56px; }

        .hero-row { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; }
        .kicker {
          font-size: 12px; font-weight: 700; letter-spacing: 0.09em;
          color: var(--blue); margin: 0 0 8px;
        }
        .hero-title {
          font-size: 32px; font-weight: 800; letter-spacing: -0.025em;
          margin: 0 0 6px; line-height: 1.15;
        }
        .hero-sub { font-size: 15px; color: var(--muted); margin: 0; }

        .btn {
          font: inherit; font-size: 14px; font-weight: 600;
          border-radius: 9px; cursor: pointer;
          padding: 11px 20px;
          border: 1px solid transparent;
          transition: transform 0.16s cubic-bezier(0.34, 1.4, 0.64, 1),
                      box-shadow 0.2s ease, background-color 0.18s ease, color 0.18s ease;
        }
        .btn:active { transform: translateY(1px) scale(0.985); }
        .btn:focus-visible { outline: 3px solid rgba(24, 119, 224, 0.35); outline-offset: 2px; }

        .btn-primary { background: var(--blue); color: #fff; box-shadow: 0 2px 6px rgba(24, 119, 224, 0.28); }
        .btn-primary:hover { background: var(--blue-dark); transform: translateY(-2px); box-shadow: 0 8px 18px rgba(24, 119, 224, 0.34); }
        .btn-primary:disabled { opacity: 0.55; transform: none; box-shadow: none; cursor: default; }

        .btn-ghost { background: #fff; color: var(--navy); border-color: var(--line); }
        .btn-ghost:hover { border-color: var(--blue); color: var(--blue); transform: translateY(-2px); box-shadow: 0 6px 14px rgba(10, 37, 64, 0.09); }

        .btn-danger { background: #fff; color: var(--red); border-color: var(--line); }
        .btn-danger:hover { background: var(--red-bg); border-color: var(--red); transform: translateY(-2px); }

        .btn-sm { padding: 7px 14px; font-size: 13px; }

        .field {
          width: 100%; box-sizing: border-box;
          padding: 11px 14px; font: inherit; font-size: 14px;
          color: var(--navy); background: #fff;
          border: 1px solid var(--line); border-radius: 9px;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .field:hover { border-color: #c9d9ea; }
        .field:focus { outline: none; border-color: var(--blue); box-shadow: 0 0 0 4px rgba(24, 119, 224, 0.14); }
        .lab { display: block; font-size: 13px; font-weight: 600; color: var(--muted); margin-bottom: 6px; }

        .card {
          background: #fff; border: 1px solid var(--line);
          border-radius: 14px; padding: 24px;
        }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 28px; }
        .stat {
          background: #fff; border: 1px solid var(--line); border-radius: 14px;
          padding: 20px; text-align: left; font: inherit; cursor: pointer;
          animation: rise 0.5s cubic-bezier(0.22, 1, 0.36, 1) backwards;
          transition: transform 0.18s ease, box-shadow 0.2s ease, border-color 0.18s ease;
        }
        .stat:nth-child(1) { animation-delay: 0.02s; }
        .stat:nth-child(2) { animation-delay: 0.08s; }
        .stat:nth-child(3) { animation-delay: 0.14s; }
        .stat:nth-child(4) { animation-delay: 0.2s; }
        .stat:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(10, 37, 64, 0.09); border-color: #cddef1; }
        .stat.on { border-color: var(--blue); box-shadow: 0 6px 18px rgba(24, 119, 224, 0.16); }
        .stat-k { font-size: 13px; font-weight: 600; color: var(--muted); margin-bottom: 10px; }
        .stat-v { font-size: 34px; font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }

        @keyframes rise { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: none; } }

        .panel { background: #fff; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
        .panel-head { padding: 18px 24px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .panel-title { font-size: 17px; font-weight: 700; letter-spacing: -0.01em; margin: 0; }

        .row {
          width: 100%; display: flex; align-items: center; gap: 18px;
          padding: 15px 24px; border: none; border-top: 1px solid var(--line);
          background: #fff; font: inherit; font-size: 14px; text-align: left; cursor: pointer;
          transition: background-color 0.16s ease, padding-left 0.2s ease;
        }
        .row:first-of-type { border-top: none; }
        .row:hover { background: var(--blue-soft); padding-left: 30px; }
        .row-when { width: 120px; flex-shrink: 0; color: var(--muted); font-variant-numeric: tabular-nums; }
        .row-who { flex-grow: 1; font-weight: 700; min-width: 0; }
        .row-doc { width: 200px; color: var(--muted); flex-shrink: 0; }

        .line-item { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 15px 24px; border-top: 1px solid var(--line); transition: background-color 0.16s ease; }
        .line-item:hover { background: #fafcfe; }
        .name { font-weight: 700; font-size: 15px; }
        .meta { font-size: 13px; color: var(--muted); margin-top: 2px; font-variant-numeric: tabular-nums; }

        .pill { padding: 4px 11px; border-radius: 7px; font-size: 12px; font-weight: 700; white-space: nowrap; }
        .p-scheduled { background: var(--amber-bg); color: var(--amber); }
        .p-confirmed { background: var(--green-bg); color: var(--green); }
        .p-completed { background: var(--blue-soft); color: var(--blue-dark); }
        .p-cancelled { background: var(--red-bg); color: var(--red); }
        .p-no_show { background: #eef2f6; color: var(--muted); }

        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
        .aptcard {
          background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 20px;
          transition: transform 0.18s ease, box-shadow 0.2s ease, border-color 0.18s ease;
        }
        .aptcard:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(10, 37, 64, 0.09); border-color: #cddef1; }
        .aptcard-when { font-size: 15px; font-weight: 700; color: var(--blue); margin-top: 10px; font-variant-numeric: tabular-nums; }

        .folder {
          border-top: 1px solid var(--line); padding: 20px 24px;
          background: linear-gradient(180deg, var(--blue-soft), #fff);
          animation: unfold 0.3s cubic-bezier(0.22, 1, 0.36, 1);
        }
        @keyframes unfold { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: none; } }
        .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 18px; margin-bottom: 18px; }
        .fact-k { font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 4px; }
        .fact-v { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }

        .days { display: flex; gap: 8px; flex-wrap: wrap; }
        .day {
          font: inherit; cursor: pointer;
          display: flex; flex-direction: column; align-items: center; gap: 2px;
          min-width: 52px; padding: 9px 6px;
          background: #fff; color: var(--navy);
          border: 1px solid var(--line); border-radius: 11px;
          transition: transform 0.16s cubic-bezier(0.34, 1.4, 0.64, 1),
                      background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease, box-shadow 0.2s ease;
        }
        .day:hover { border-color: var(--blue); color: var(--blue); transform: translateY(-3px); box-shadow: 0 6px 14px rgba(10, 37, 64, 0.1); }
        .day:active { transform: translateY(0) scale(0.97); }
        .day.on {
          background: var(--blue); border-color: var(--blue); color: #fff;
          box-shadow: 0 6px 16px rgba(24, 119, 224, 0.32);
        }
        .day-top { font-size: 11px; font-weight: 700; letter-spacing: 0.04em; opacity: 0.72; }
        .day-num { font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums; letter-spacing: -0.02em; }
        .day-more .day-num { font-size: 15px; }

        .date-echo { font-size: 13px; font-weight: 600; color: var(--blue); margin: 10px 0 0; }
        .hint { font-size: 13px; color: var(--muted); margin: 0; }

        select.field {
          appearance: none; -webkit-appearance: none;
          padding-right: 40px; cursor: pointer;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%235a7590' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
          background-repeat: no-repeat;
          background-position: right 14px center;
        }

        .slots { display: flex; flex-wrap: wrap; gap: 8px; }
        .slot.taken {
          background: #f2f5f8; color: #9aabbd; border-color: #e8edf3;
          cursor: not-allowed; text-decoration: line-through;
        }
        .slot.taken:hover { transform: none; border-color: #e8edf3; color: #9aabbd; }
        .slot.past { background: #fafbfc; color: #b8c4d0; border-color: #eef2f6; cursor: not-allowed; }
        .slot.past:hover { transform: none; border-color: #eef2f6; color: #b8c4d0; }

        .legend { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 12px; font-size: 12px; color: var(--muted); }
        .legend span { display: inline-flex; align-items: center; }
        .legend-none { color: var(--amber); font-weight: 600; }
        .dot { width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; display: inline-block; }
        .dot-free { background: var(--blue); }
        .dot-taken { background: #9aabbd; }
        .dot-past { background: #d5dee7; }
        .slot {
          font: inherit; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums;
          padding: 8px 14px; border-radius: 8px; cursor: pointer;
          background: #fff; color: var(--navy); border: 1px solid var(--line);
          transition: transform 0.15s ease, background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease;
        }
        .slot:hover { border-color: var(--blue); color: var(--blue); transform: translateY(-2px); }
        .slot.on { background: var(--blue); border-color: var(--blue); color: #fff; }

        .overlay {
          position: fixed; inset: 0; z-index: 1000; padding: 24px;
          background: rgba(10, 37, 64, 0.42);
          display: flex; align-items: center; justify-content: center;
          animation: fade 0.2s ease;
        }
        @keyframes fade { from { opacity: 0; } to { opacity: 1; } }
        .modal {
          background: #fff; border-radius: 18px; padding: 28px;
          width: 470px; max-width: 100%; max-height: 90vh; overflow-y: auto;
          box-shadow: 0 30px 70px rgba(10, 37, 64, 0.28);
          animation: pop 0.28s cubic-bezier(0.22, 1.2, 0.36, 1);
        }
        @keyframes pop { from { opacity: 0; transform: translateY(18px) scale(0.97); } to { opacity: 1; transform: none; } }
        .modal-title { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 20px; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }

        .alert { background: var(--red-bg); color: var(--red); padding: 13px 18px; border-radius: 10px; margin-bottom: 22px; font-size: 14px; font-weight: 600; }
        .empty { padding: 40px 24px; text-align: center; color: var(--muted); font-size: 14px; }
        .err { color: var(--red); font-size: 14px; font-weight: 600; margin: 0 0 16px; }

        @media (prefers-reduced-motion: reduce) {
          .shell *, .shell *::after { animation: none !important; transition: none !important; }
        }
      `}</style>

      <header className="topbar">
        <div className="brand">Med<span>Link</span></div>
        <nav className="tabs">
          {NAV.map((t) => (
            <button
              key={t.id}
              className={`tab ${activeTab === t.id || (t.id === "patients" && activeTab === "new_patient") ? "on" : ""}`}
              onClick={() => { setActiveTab(t.id); setDashFilter("all"); }}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <span className="who">Secrétariat</span>
        <button className="signout" onClick={logout}>Se déconnecter</button>
      </header>

      <div className="band">
        <div className="wrap hero-row">
          <div>
            <p className="kicker">PLATEFORME MÉDICALE SÉCURISÉE</p>
            <h1 className="hero-title">Bonjour, voici votre journée.</h1>
            <p className="hero-sub">
              {todayCount} rendez-vous aujourd&apos;hui · {patients.length} patients enregistrés
            </p>
          </div>
          <form onSubmit={handleSearchSubmit} style={{ display: "flex", gap: 10, paddingBottom: 4 }}>
            <input
              className="field"
              style={{ width: 250 }}
              placeholder="Nom du patient ou CIN"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button type="submit" className="btn btn-primary">Rechercher</button>
          </form>
        </div>
      </div>

      <main className="main">
        <div className="wrap">
          {loadError && <div className="alert">{loadError}</div>}

          {activeTab === "dashboard" && (
            <>
              <div className="stats">
                <button className={`stat ${dashFilter === "all" ? "on" : ""}`} onClick={() => setDashFilter("all")}>
                  <div className="stat-k">Rendez-vous</div>
                  <div className="stat-v">{appointments.length}</div>
                </button>
                <button className={`stat ${dashFilter === "today" ? "on" : ""}`} onClick={() => setDashFilter("today")}>
                  <div className="stat-k">Aujourd&apos;hui</div>
                  <div className="stat-v">{todayCount}</div>
                </button>
                <button className="stat" onClick={() => setActiveTab("patients")}>
                  <div className="stat-k">Patients</div>
                  <div className="stat-v">{patients.length}</div>
                </button>
                <button className={`stat ${dashFilter === "scheduled" ? "on" : ""}`} onClick={() => setDashFilter("scheduled")}>
                  <div className="stat-k">Programmés</div>
                  <div className="stat-v" style={{ color: "#a86a12" }}>{scheduledCount}</div>
                </button>
              </div>

              <div className="panel">
                <div className="panel-head">
                  <h2 className="panel-title">
                    {dashFilter === "today"
                      ? "Rendez-vous d'aujourd'hui"
                      : dashFilter === "scheduled"
                      ? "Rendez-vous programmés"
                      : "Tous les rendez-vous"}
                  </h2>
                  <button className="btn btn-primary btn-sm" onClick={() => setIsRdvModalOpen(true)}>
                    Prendre un rendez-vous
                  </button>
                </div>
                {displayedAppointments.length === 0 ? (
                  <div className="empty">
                    {dashFilter === "today"
                      ? "Aucun rendez-vous aujourd'hui."
                      : dashFilter === "scheduled"
                      ? "Aucun rendez-vous programmé."
                      : "Aucun rendez-vous à afficher."}
                  </div>
                ) : (
                  displayedAppointments.map((apt) => (
                    <button key={apt.id} className="row" onClick={() => setSelectedAppointment(apt)}>
                      <span className="row-when">{fmtDay(apt.scheduled_at)} · {fmtTime(apt.scheduled_at)}</span>
                      <span className="row-who">{patientName(apt.patient_id)}</span>
                      <span className="row-doc">{doctorName(apt.doctor_id)}</span>
                      <span className={`pill p-${apt.status}`}>{STATUS_LABELS[apt.status] || apt.status}</span>
                    </button>
                  ))
                )}
              </div>
            </>
          )}

          {activeTab === "rdv" && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                <h2 className="panel-title">Rendez-vous</h2>
                <button className="btn btn-primary" onClick={() => setIsRdvModalOpen(true)}>Prendre un rendez-vous</button>
              </div>
              {appointments.length === 0 ? (
                <div className="card empty">Aucun rendez-vous enregistré.</div>
              ) : (
                <div className="grid">
                  {appointments.map((apt) => (
                    <div key={apt.id} className="aptcard">
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                        <span className="name">{patientName(apt.patient_id)}</span>
                        <span className={`pill p-${apt.status}`}>{STATUS_LABELS[apt.status] || apt.status}</span>
                      </div>
                      <div className="aptcard-when">{fmtDay(apt.scheduled_at)} · {fmtTime(apt.scheduled_at)}</div>
                      <div className="meta">{doctorName(apt.doctor_id)}</div>
                      <div style={{ display: "flex", gap: 8, marginTop: 18, flexWrap: "wrap" }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => { setEditingAppointment(apt); setRescheduleDate(""); setRescheduleSlots([]); setNewRescheduleTime(""); }}>
                          Reprogrammer
                        </button>
                        <button className="btn btn-ghost btn-sm" onClick={() => setSelectedAppointment(apt)}>Détails</button>
                        <button className="btn btn-danger btn-sm" onClick={() => deleteAppointment(apt.id)}>Supprimer</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {activeTab === "patients" && (
            <div className="panel">
              <div className="panel-head">
                <h2 className="panel-title">
                  {hasSearched && searchQuery.trim()
                    ? `${searchResults.length} résultat${searchResults.length > 1 ? "s" : ""} pour « ${searchQuery.trim()} »`
                    : `${patients.length} patient${patients.length > 1 ? "s" : ""}`}
                </h2>
                <div style={{ display: "flex", gap: 8 }}>
                  {hasSearched && searchQuery.trim() && (
                    <button className="btn btn-ghost btn-sm" onClick={() => { setSearchQuery(""); setSearchResults([]); setHasSearched(false); }}>
                      Tout afficher
                    </button>
                  )}
                  <button className="btn btn-primary btn-sm" onClick={() => setActiveTab("new_patient")}>Créer un patient</button>
                </div>
              </div>

              {listedPatients.length === 0 ? (
                <div className="empty">Aucun patient ne correspond à cette recherche.</div>
              ) : (
                listedPatients.map((p) => (
                  <div key={p.id}>
                    <div className="line-item">
                      <div style={{ minWidth: 0 }}>
                        <div className="name">{p.last_name} {p.first_name}</div>
                        <div className="meta">CIN {p.national_id || "—"} · groupe {p.blood_group}</div>
                      </div>
                      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                        <button className="btn btn-ghost btn-sm" onClick={() => setOpenPatientId(openPatientId === p.id ? null : p.id)}>
                          {openPatientId === p.id ? "Replier" : "Dossier"}
                        </button>
                        <button className="btn btn-primary btn-sm" onClick={() => openRdvForPatient(p.id)}>Rendez-vous</button>
                      </div>
                    </div>
                    {openPatientId === p.id && (
                      <div className="folder">
                        <div className="facts">
                          <div><div className="fact-k">CIN</div><div className="fact-v">{p.national_id || "Non renseigné"}</div></div>
                          <div><div className="fact-k">Groupe sanguin</div><div className="fact-v">{p.blood_group}</div></div>
                          <div><div className="fact-k">Date de naissance</div><div className="fact-v">{p.date_of_birth}</div></div>
                          <div><div className="fact-k">Sexe</div><div className="fact-v">{p.sex === "M" ? "Homme" : p.sex === "F" ? "Femme" : "—"}</div></div>
                          <div style={{ gridColumn: "1 / -1" }}><div className="fact-k">Adresse</div><div className="fact-v">{p.address || "Non renseignée"}</div></div>
                        </div>
                        <div className="fact-k" style={{ marginBottom: 8 }}>Rendez-vous</div>
                        {appointments.filter((a) => a.patient_id === p.id).length === 0 ? (
                          <div className="meta">Aucun rendez-vous pour ce patient.</div>
                        ) : (
                          appointments.filter((a) => a.patient_id === p.id).map((a) => (
                            <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "6px 0" }}>
                              <span className="fact-v" style={{ width: 130 }}>{fmtDay(a.scheduled_at)} · {fmtTime(a.scheduled_at)}</span>
                              <span className="meta" style={{ flexGrow: 1, marginTop: 0 }}>{doctorName(a.doctor_id)}</span>
                              <span className={`pill p-${a.status}`}>{STATUS_LABELS[a.status] || a.status}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "new_patient" && (
            <div className="card" style={{ maxWidth: 820 }}>
              <h2 className="panel-title" style={{ marginBottom: 8 }}>Nouveau patient</h2>
              <p style={{ fontSize: 14, color: "#5a7590", marginTop: 0, marginBottom: 24, lineHeight: 1.6, maxWidth: "66ch" }}>
                Le patient utilisera ces identifiants pour accéder à son espace. Communiquez-lui le mot de passe
                de vive voix et demandez-lui de le changer à sa première connexion.
              </p>
              <form onSubmit={handlePatientSubmit}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: 18, marginBottom: 18 }}>
                  <div><label className="lab">Nom</label><input className="field" required value={formData.lastName} onChange={(e) => setFormData((f) => ({ ...f, lastName: e.target.value }))} /></div>
                  <div><label className="lab">Prénom</label><input className="field" required value={formData.firstName} onChange={(e) => setFormData((f) => ({ ...f, firstName: e.target.value }))} /></div>
                  <div><label className="lab">Email</label><input className="field" type="email" required value={formData.email} onChange={(e) => setFormData((f) => ({ ...f, email: e.target.value }))} /></div>
                  <div><label className="lab">Mot de passe temporaire</label><input className="field" type="text" required value={formData.password} onChange={(e) => setFormData((f) => ({ ...f, password: e.target.value }))} /></div>
                  <div><label className="lab">CIN</label><input className="field" value={formData.nationalId} onChange={(e) => setFormData((f) => ({ ...f, nationalId: e.target.value }))} /></div>
                  <div><label className="lab">Date de naissance</label><input className="field" type="date" required value={formData.dateOfBirth} onChange={(e) => setFormData((f) => ({ ...f, dateOfBirth: e.target.value }))} /></div>
                  <div>
                    <label className="lab">Sexe</label>
                    <select className="field" value={formData.sex} onChange={(e) => setFormData((f) => ({ ...f, sex: e.target.value }))}>
                      <option value="F">Femme</option><option value="M">Homme</option>
                    </select>
                  </div>
                  <div>
                    <label className="lab">Groupe sanguin</label>
                    <select className="field" value={formData.bloodGroup} onChange={(e) => setFormData((f) => ({ ...f, bloodGroup: e.target.value }))}>
                      {["unknown", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((bg) => (
                        <option key={bg} value={bg}>{bg === "unknown" ? "Inconnu" : bg}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label className="lab">Adresse</label>
                  <input className="field" value={formData.address} onChange={(e) => setFormData((f) => ({ ...f, address: e.target.value }))} />
                </div>
                {patientFormError && <p className="err">{patientFormError}</p>}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                  <button type="button" className="btn btn-ghost" onClick={() => setActiveTab("patients")}>Annuler</button>
                  <button type="submit" className="btn btn-primary" disabled={patientFormLoading}>
                    {patientFormLoading ? "Création…" : "Créer le compte"}
                  </button>
                </div>
              </form>
            </div>
          )}

          {activeTab === "doctors" && (
            <div className="panel" style={{ maxWidth: 720 }}>
              <div className="panel-head"><h2 className="panel-title">Médecins du cabinet</h2></div>
              {doctors.length === 0 ? (
                <div className="empty">Aucun médecin rattaché.</div>
              ) : (
                doctors.map((d) => (
                  <div key={d.id} className="line-item">
                    <div>
                      <div className="name">Dr. {d.first_name} {d.last_name}</div>
                      {d.specialty && <div className="meta">{d.specialty}</div>}
                    </div>
                    <span className="meta" style={{ marginTop: 0 }}>
                      {appointments.filter((a) => a.doctor_id === d.id).length} rendez-vous
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === "alerts" && (
            <div className="card" style={{ maxWidth: 720 }}>
              <h2 className="panel-title" style={{ marginBottom: 10 }}>Alertes</h2>
              <p style={{ fontSize: 14, color: "#5a7590", margin: 0, lineHeight: 1.6 }}>
                Rien à signaler. Les demandes d&apos;accès aux dossiers et les rendez-vous non confirmés apparaîtront ici.
              </p>
            </div>
          )}
        </div>
      </main>

      {isRdvModalOpen && (
        <div className="overlay" onClick={closeRdvModal}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleRdvSubmit}>
            <h3 className="modal-title">Nouveau rendez-vous</h3>

            <div style={{ marginBottom: 16 }}>
              <label className="lab">Patient</label>
              <select className="field" required value={rdvFormData.patientId} onChange={(e) => setRdvFormData((f) => ({ ...f, patientId: e.target.value }))}>
                <option value="">Choisir un patient</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.last_name} {p.first_name}{p.national_id ? ` — ${p.national_id}` : ""}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="lab">Médecin</label>
              <select className="field" value={rdvFormData.doctorId} onChange={(e) => setRdvFormData((f) => ({ ...f, doctorId: e.target.value }))}>
                <option value="">
                  {doctors.length > 0 ? `Par défaut : Dr. ${doctors[0].first_name} ${doctors[0].last_name}` : "Aucun médecin disponible"}
                </option>
                {doctors.map((d) => <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</option>)}
              </select>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label className="lab">Date</label>
              <div className="days">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() + i);
                  const iso = toISODate(d);
                  const { top, bottom } = dayChipLabel(d, i);
                  return (
                    <button
                      key={iso}
                      type="button"
                      className={`day ${rdvFormData.date === iso ? "on" : ""}`}
                      onClick={() => { setShowCustomDate(false); setRdvFormData((f) => ({ ...f, date: iso, time: "" })); }}
                    >
                      <span className="day-top">{top}</span>
                      <span className="day-num">{bottom}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={`day day-more ${showCustomDate ? "on" : ""}`}
                  onClick={() => setShowCustomDate((v) => !v)}
                >
                  <span className="day-top">Autre</span>
                  <span className="day-num">…</span>
                </button>
              </div>
              {showCustomDate && (
                <input
                  className="field"
                  style={{ marginTop: 10 }}
                  type="date"
                  value={rdvFormData.date}
                  onChange={(e) => setRdvFormData((f) => ({ ...f, date: e.target.value, time: "" }))}
                />
              )}
              {rdvFormData.date && (
                <p className="date-echo">
                  {new Date(`${rdvFormData.date}T12:00:00`).toLocaleDateString("fr-FR", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              )}
            </div>

            <div style={{ marginBottom: 18 }}>
              <label className="lab">Heure</label>
              {!rdvDoctorId ? (
                <p className="hint">Choisissez d&apos;abord un médecin.</p>
              ) : !rdvFormData.date ? (
                <p className="hint">Choisissez d&apos;abord une date.</p>
              ) : rdvSlotsLoading ? (
                <p className="hint">Lecture de l&apos;agenda…</p>
              ) : (
                <>
                  <div className="slots">
                    {rdvCells.map((c) => (
                      <button
                        key={c.hhmm}
                        type="button"
                        disabled={c.taken || c.past}
                        title={c.booked ? `Pris — ${patientName(c.booked.patient_id)}` : c.past ? "Heure passée" : "Libre"}
                        className={`slot ${rdvFormData.time === c.hhmm ? "on" : ""} ${c.taken ? "taken" : ""} ${c.past && !c.taken ? "past" : ""}`}
                        onClick={() => setRdvFormData((f) => ({ ...f, time: c.hhmm }))}
                      >
                        {c.hhmm}
                      </button>
                    ))}
                  </div>
                  <div className="legend">
                    {rdvFree === 0 ? (
                      <span className="legend-none">Journée complète. Essayez un autre jour ou un autre médecin.</span>
                    ) : (
                      <>
                        <span><i className="dot dot-free" />{rdvFree} libre{rdvFree > 1 ? "s" : ""}</span>
                        <span><i className="dot dot-taken" />pris</span>
                        <span><i className="dot dot-past" />passé</span>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            <div>
              <label className="lab">Motif</label>
              <input className="field" placeholder="Consultation de suivi" value={rdvFormData.notes} onChange={(e) => setRdvFormData((f) => ({ ...f, notes: e.target.value }))} />
            </div>

            {rdvFormError && <p className="err" style={{ marginTop: 16, marginBottom: 0 }}>{rdvFormError}</p>}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={closeRdvModal}>Annuler</button>
              <button type="submit" className="btn btn-primary">Créer le rendez-vous</button>
            </div>
          </form>
        </div>
      )}

      {selectedAppointment && (
        <div className="overlay" onClick={() => setSelectedAppointment(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">Détails du rendez-vous</h3>
            <div className="facts">
              <div><div className="fact-k">Patient</div><div className="fact-v">{patientName(selectedAppointment.patient_id)}</div></div>
              <div><div className="fact-k">Médecin</div><div className="fact-v">{doctorName(selectedAppointment.doctor_id)}</div></div>
              <div><div className="fact-k">Date et heure</div><div className="fact-v">{parseLocal(selectedAppointment.scheduled_at).toLocaleString("fr-FR")}</div></div>
              <div><div className="fact-k">Statut</div><div><span className={`pill p-${selectedAppointment.status}`}>{STATUS_LABELS[selectedAppointment.status] || selectedAppointment.status}</span></div></div>
              <div style={{ gridColumn: "1 / -1" }}><div className="fact-k">Motif</div><div className="fact-v">{selectedAppointment.reason || "Non renseigné"}</div></div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setSelectedAppointment(null)}>Fermer</button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const apt = selectedAppointment;
                  setSelectedAppointment(null);
                  setEditingAppointment(apt);
                  setRescheduleDate(""); setRescheduleSlots([]); setNewRescheduleTime("");
                }}
              >
                Reprogrammer
              </button>
            </div>
          </div>
        </div>
      )}

      {editingAppointment && (
        <div className="overlay" onClick={closeReschedule}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title" style={{ marginBottom: 6 }}>Reprogrammer</h3>
            <p style={{ fontSize: 14, color: "#5a7590", marginTop: 0, marginBottom: 22 }}>
              {patientName(editingAppointment.patient_id)} · actuellement le{" "}
              {parseLocal(editingAppointment.scheduled_at).toLocaleDateString("fr-FR", {
                weekday: "long", day: "numeric", month: "long",
              })}{" "}
              à {fmtTime(editingAppointment.scheduled_at)}
            </p>

            <div style={{ marginBottom: 18 }}>
              <label className="lab">Nouvelle date</label>
              <div className="days">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() + i);
                  const iso = toISODate(d);
                  const { top, bottom } = dayChipLabel(d, i);
                  return (
                    <button
                      key={iso}
                      type="button"
                      className={`day ${rescheduleDate === iso ? "on" : ""}`}
                      onClick={() => { setShowCustomReDate(false); setRescheduleDate(iso); setNewRescheduleTime(""); }}
                    >
                      <span className="day-top">{top}</span>
                      <span className="day-num">{bottom}</span>
                    </button>
                  );
                })}
                <button
                  type="button"
                  className={`day day-more ${showCustomReDate ? "on" : ""}`}
                  onClick={() => setShowCustomReDate((v) => !v)}
                >
                  <span className="day-top">Autre</span>
                  <span className="day-num">…</span>
                </button>
              </div>
              {showCustomReDate && (
                <input
                  className="field"
                  style={{ marginTop: 10 }}
                  type="date"
                  value={rescheduleDate}
                  onChange={(e) => { setRescheduleDate(e.target.value); setNewRescheduleTime(""); }}
                />
              )}
              {rescheduleDate && (
                <p className="date-echo">
                  {new Date(`${rescheduleDate}T12:00:00`).toLocaleDateString("fr-FR", {
                    weekday: "long", day: "numeric", month: "long", year: "numeric",
                  })}
                </p>
              )}
            </div>

            <div style={{ marginBottom: 18 }}>
              <label className="lab">Nouvelle heure</label>
              {!rescheduleDate ? (
                <p className="hint">Choisissez d&apos;abord une date.</p>
              ) : rescheduleChecking ? (
                <p className="hint">Lecture de l&apos;agenda…</p>
              ) : (
                <>
                  <div className="slots">
                    {reCells.map((c) => (
                      <button
                        key={c.hhmm}
                        type="button"
                        disabled={c.taken || c.past}
                        title={c.booked ? `Pris — ${patientName(c.booked.patient_id)}` : c.past ? "Heure passée" : "Libre"}
                        className={`slot ${newRescheduleTime === c.hhmm ? "on" : ""} ${c.taken ? "taken" : ""} ${c.past && !c.taken ? "past" : ""}`}
                        onClick={() => setNewRescheduleTime(c.hhmm)}
                      >
                        {c.hhmm}
                      </button>
                    ))}
                  </div>
                  <div className="legend">
                    {reFree === 0 ? (
                      <span className="legend-none">Journée complète. Essayez un autre jour.</span>
                    ) : (
                      <>
                        <span><i className="dot dot-free" />{reFree} libre{reFree > 1 ? "s" : ""}</span>
                        <span><i className="dot dot-taken" />pris</span>
                        <span><i className="dot dot-past" />passé</span>
                      </>
                    )}
                  </div>
                </>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={closeReschedule}>Annuler</button>
              <button type="button" className="btn btn-primary" onClick={handleReschedule}>Enregistrer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
