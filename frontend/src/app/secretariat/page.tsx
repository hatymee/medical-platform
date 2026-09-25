"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import DocumentViewer from "@/components/DocumentViewer";
import { Home, CalendarDays, Users, Stethoscope, Archive, Receipt, Bell, LogOut, Plus, ChevronRight, Clock, Wallet, FileText, Trash2, Check, Eye, CalendarClock } from "lucide-react";
import PatientFile from "@/components/secretariat/PatientFile";
import SecretariatTopbar from "@/components/secretariat/SecretariatTopbar";

type TabType = "dashboard" | "rdv" | "patients" | "new_patient" | "doctors" | "archives" | "settings" | "alerts" | "billing";

interface Patient {
  id: string;
  first_name: string;
  last_name: string;
  date_of_birth: string;
  sex: string | null;
  blood_group: string;
  national_id: string | null;
  address: string | null;
  status: string;
  status_reason: string | null;
  phone?: string | null;
  email?: string | null;
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
  { id: "archives", label: "Dossiers" },
  { id: "billing", label: "Facturation" },
  { id: "alerts", label: "Alertes" },
];

const NAV_ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  dashboard: Home,
  rdv: CalendarDays,
  patients: Users,
  doctors: Stethoscope,
  archives: Archive,
  billing: Receipt,
  alerts: Bell,
};

function parseLocal(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso ?? "");
  if (!m) return new Date(iso);
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
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

function ageFrom(dob: string) {
  if (!dob) return null;
  const d = parseLocal(dob);
  const now = new Date();
  let a = now.getFullYear() - d.getFullYear();
  const m = now.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < d.getDate())) a--;
  return a;
}

function bloodLabel(b: string | null | undefined) {
  return !b || b === "unknown" ? "Non renseigné" : b;
}

function initials(p: Patient) {
  return `${(p.first_name || "?").charAt(0)}${(p.last_name || "").charAt(0)}`.toUpperCase();
}

function invoiceNumber(i: any) {
  const year = i.issued_at ? parseLocal(i.issued_at).getFullYear() : new Date().getFullYear();
  return `#${year}-${String(i.id ?? "").replace(/-/g, "").slice(0, 4).toUpperCase()}`;
}

type RdvFilter = "upcoming" | "today" | "past" | "cancelled" | "all";
type BillFilter = "all" | "unpaid" | "partial" | "paid";

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
  const [statusTarget, setStatusTarget] = useState<{ patient: Patient; action: "archived" | "removed" } | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [pwdForm, setPwdForm] = useState({ current: "", next: "" });
  const [emailForm, setEmailForm] = useState({ current: "", next: "" });
  const [settingsMsg, setSettingsMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [payTarget, setPayTarget] = useState<any>(null);
  const [payForm, setPayForm] = useState({ amount: "", method: "cash", reference: "" });
  const [paySaving, setPaySaving] = useState(false);
  const [payError, setPayError] = useState("");
  const [procedures, setProcedures] = useState<any[]>([]);
  const [billOpen, setBillOpen] = useState(false);
  const [billForm, setBillForm] = useState({ patientId: "", doctorId: "", procedureId: "", description: "", amount: "" });
  const [billError, setBillError] = useState("");
  const [billSaving, setBillSaving] = useState(false);
  const [docs, setDocs] = useState<any[]>([]);
  const [viewDoc, setViewDoc] = useState<any>(null);
  const [rdvFilter, setRdvFilter] = useState<RdvFilter>("upcoming");
  const [billFilter, setBillFilter] = useState<BillFilter>("all");

  async function loadDocs(patientId: string) {
    setDocs((await api<any[]>(`/documents/patient/${patientId}`).catch(() => [])) ?? []);
  }

  async function openDoc(docId: string) {
    try {
      const { url } = await api<{ url: string }>(`/documents/${docId}/view`);
      window.open(url, "_blank", "noopener");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Ouverture impossible.");
    }
  }

  function openFile(patientId: string) {
    window.history.pushState({ patient: patientId }, "");
    setActiveTab("patients");
    setOpenPatientId(patientId);
  }

  async function submitInvoice(e: React.FormEvent) {
    e.preventDefault();
    setBillError("");
    const amount = parseFloat(billForm.amount.replace(",", "."));
    if (!billForm.patientId || !billForm.description.trim() || !amount || amount <= 0) {
      setBillError("Patient, prestation et montant sont requis.");
      return;
    }
    setBillSaving(true);
    try {
      await api("/billing/invoices", {
        method: "POST",
        body: JSON.stringify({
          patient_id: billForm.patientId,
          doctor_id: billForm.doctorId || null,
          description: billForm.description.trim(),
          amount_due: amount,
        }),
      });
      setBillOpen(false);
      setBillForm({ patientId: "", doctorId: "", procedureId: "", description: "", amount: "" });
      await loadAll();
    } catch (err) {
      setBillError(err instanceof Error ? err.message : "Facturation impossible.");
    } finally {
      setBillSaving(false);
    }
  }

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    setPayError("");
    const amount = parseFloat(payForm.amount.replace(",", "."));
    if (!amount || amount <= 0) {
      setPayError("Le montant doit être positif.");
      return;
    }
    if (amount > payTarget.balance_due + 0.01) {
      setPayError(`Le montant dépasse le reste à payer (${payTarget.balance_due} MAD).`);
      return;
    }
    setPaySaving(true);
    try {
      await api(`/billing/invoices/${payTarget.id}/payments`, {
        method: "POST",
        body: JSON.stringify({
          amount,
          method: payForm.method,
          reference: payForm.reference.trim() || null,
        }),
      });
      setPayTarget(null);
      setPayForm({ amount: "", method: "cash", reference: "" });
      await loadAll();
    } catch (err) {
      setPayError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setPaySaving(false);
    }
  }

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    setSettingsMsg(null);
    try {
      await api("/auth/change-password", {
        method: "POST",
        body: JSON.stringify({ current_password: pwdForm.current, new_password: pwdForm.next }),
      });
      setPwdForm({ current: "", next: "" });
      setSettingsMsg({ ok: true, text: "Mot de passe mis à jour." });
    } catch (err) {
      setSettingsMsg({ ok: false, text: err instanceof Error ? err.message : "Modification impossible." });
    }
  }

  async function submitEmail(e: React.FormEvent) {
    e.preventDefault();
    setSettingsMsg(null);
    try {
      await api("/auth/change-email", {
        method: "POST",
        body: JSON.stringify({ current_password: emailForm.current, new_email: emailForm.next }),
      });
      setEmailForm({ current: "", next: "" });
      setSettingsMsg({ ok: true, text: "Email mis à jour." });
    } catch (err) {
      setSettingsMsg({ ok: false, text: err instanceof Error ? err.message : "Modification impossible." });
    }
  }

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
      const [p, d, a, inv] = await Promise.all([
        api<Patient[]>("/patients/?status=all"),
        api<DoctorSummary[]>("/doctors"),
        api<Appointment[]>("/appointments/"),
        api<any[]>("/billing/invoices").catch(() => []),
      ]);
      setPatients(p);
      setDoctors(d);
      setAppointments(a);
      setInvoices(inv ?? []);
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

  useEffect(() => {
    if (openPatientId) {
      setDocs([]);
      loadDocs(openPatientId);
    }
  }, [openPatientId]);

  useEffect(() => {
    const onPop = () => setOpenPatientId(null);
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

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

  async function changeStatus(patientId: string, status: string, reason?: string) {
    const params = new URLSearchParams({ status });
    if (reason) params.set("reason", reason);
    await api(`/patients/${patientId}/status?${params.toString()}`, { method: "PATCH" });
    await loadAll();
  }

  useEffect(() => {
    if (!billOpen || !billForm.doctorId) {
      setProcedures([]);
      return;
    }
    let cancelled = false;
    api<any[]>(`/procedures?doctor_id=${billForm.doctorId}`)
      .then((list) => { if (!cancelled) setProcedures(list ?? []); })
      .catch(() => { if (!cancelled) setProcedures([]); });
    return () => { cancelled = true; };
  }, [billOpen, billForm.doctorId]);

  async function confirmStatusChange() {
    if (!statusTarget) return;
    if (statusTarget.action === "removed" && !statusReason.trim()) return;
    setStatusSaving(true);
    try {
      await changeStatus(statusTarget.patient.id, statusTarget.action, statusReason.trim() || undefined);
      setStatusTarget(null);
      setStatusReason("");
      setOpenPatientId(null);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Opération impossible.");
    } finally {
      setStatusSaving(false);
    }
  }

  const activePatients = patients.filter((p) => (p.status ?? "active") === "active");
  const inactivePatients = patients.filter((p) => (p.status ?? "active") !== "active");

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

  async function confirmAppointment(id: string) {
    try {
      await api(`/appointments/${id}`, { method: "PUT", body: JSON.stringify({ status: "confirmed" }) });
      await loadAll();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Confirmation impossible.");
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

  function runSearch(q: string, pool: Patient[]) {
    const s = q.toLowerCase().trim();
    setSearchQuery(q);
    setHasSearched(true);
    setSearchResults(
      pool.filter((p) =>
        (p.national_id || "").toLowerCase().includes(s) ||
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(s) ||
        `${p.last_name} ${p.first_name}`.toLowerCase().includes(s)
      )
    );
  }

  function clearSearch() {
    setSearchQuery("");
    setSearchResults([]);
    setHasSearched(false);
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
  const searching = hasSearched && searchQuery.trim() !== "";
  const listedPatients = searching ? searchResults : activePatients;
  const listedArchives = searching ? searchResults : inactivePatients;
  const invoicedTotal = invoices.reduce((s, i) => s + (i.amount_due ?? 0), 0);
  const collectedTotal = invoices.reduce((s, i) => s + (i.paid_amount ?? 0), 0);
  const unpaidCount = invoices.filter((i) => i.status !== "paid").length;
  const money = (v: number) =>
    new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(v);

  const nextApptOf = (patientId: string) =>
    appointments
      .filter((a) => a.patient_id === patientId && a.status !== "cancelled" && parseLocal(a.scheduled_at).getTime() >= Date.now())
      .sort((a, b) => parseLocal(a.scheduled_at).getTime() - parseLocal(b.scheduled_at).getTime())[0];

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
  const alertCount = appointments.filter((a) => a.status === "scheduled" && parseLocal(a.scheduled_at).getTime() >= Date.now()).length;
  const openPatient = openPatientId ? patients.find((p) => p.id === openPatientId) ?? null : null;

  const ts = (iso: string) => parseLocal(iso).getTime();
  const nowMs = Date.now();
  const todayAppts = appointments
    .filter((a) => isToday(a.scheduled_at) && a.status !== "cancelled")
    .sort((a, b) => ts(a.scheduled_at) - ts(b.scheduled_at));
  const upcomingAppts = appointments
    .filter((a) => ts(a.scheduled_at) >= nowMs && a.status !== "cancelled")
    .sort((a, b) => ts(a.scheduled_at) - ts(b.scheduled_at));
  const pastAppts = appointments
    .filter((a) => ts(a.scheduled_at) < nowMs && a.status !== "cancelled")
    .sort((a, b) => ts(b.scheduled_at) - ts(a.scheduled_at));
  const cancelledAppts = appointments
    .filter((a) => a.status === "cancelled")
    .sort((a, b) => ts(b.scheduled_at) - ts(a.scheduled_at));
  const allAppts = [...appointments].sort((a, b) => ts(b.scheduled_at) - ts(a.scheduled_at));
  const RDV_FILTERS: { id: RdvFilter; label: string; list: Appointment[] }[] = [
    { id: "upcoming", label: "À venir", list: upcomingAppts },
    { id: "today", label: "Aujourd'hui", list: todayAppts },
    { id: "past", label: "Passés", list: pastAppts },
    { id: "cancelled", label: "Annulés", list: cancelledAppts },
    { id: "all", label: "Tous", list: allAppts },
  ];
  const rdvList = RDV_FILTERS.find((f) => f.id === rdvFilter)?.list ?? allAppts;

  const sortedInvoices = [...invoices].sort((a, b) => ts(b.issued_at) - ts(a.issued_at));
  const unpaidInvoices = sortedInvoices.filter((i) => i.status !== "paid" && i.status !== "cancelled");
  const BILL_FILTERS: { id: BillFilter; label: string; list: any[] }[] = [
    { id: "all", label: "Toutes", list: sortedInvoices },
    { id: "unpaid", label: "Impayées", list: sortedInvoices.filter((i) => i.status === "unpaid") },
    { id: "partial", label: "Partielles", list: sortedInvoices.filter((i) => i.status === "partial") },
    { id: "paid", label: "Payées", list: sortedInvoices.filter((i) => i.status === "paid") },
  ];
  const billList = BILL_FILTERS.find((f) => f.id === billFilter)?.list ?? sortedInvoices;
  const outstanding = Math.max(0, invoicedTotal - collectedTotal);

  const patientInitials = (id: string) => {
    const p = patients.find((x) => x.id === id);
    return p ? initials(p) : "?";
  };

  const statusPill = (status: string) => (
    <span className={`pill p-${status}`}>{STATUS_LABELS[status] || status}</span>
  );

  const invoicePill = (status: string) => (
    <span className={`pill p-${status === "paid" ? "paid" : status === "partial" ? "partial" : "unpaid"}`}>
      {status === "paid" ? "Payée" : status === "partial" ? "Partielle" : "Impayée"}
    </span>
  );

  const openPay = (inv: any) => {
    setPayTarget(inv);
    setPayForm({ amount: String(inv.balance_due), method: "cash", reference: "" });
    setPayError("");
  };

  const openBill = () => {
    setBillForm({ patientId: "", doctorId: doctors.length > 0 ? doctors[0].id : "", procedureId: "", description: "", amount: "" });
    setBillError("");
    setBillOpen(true);
  };

  const pageTitle =
    activeTab === "patients" || activeTab === "new_patient" ? "Patients"
    : activeTab === "rdv" ? "Rendez-vous"
    : activeTab === "doctors" ? "Médecins du cabinet"
    : activeTab === "archives" ? "Dossiers archivés"
    : activeTab === "settings" ? "Paramètres"
    : activeTab === "billing" ? "Facturation"
    : activeTab === "alerts" ? "Alertes"
    : "Bonjour, voici votre journée";

  const pageSub =
    activeTab === "patients" || activeTab === "new_patient" ? `${activePatients.length} patients actifs`
    : activeTab === "rdv" ? `${appointments.length} rendez-vous au total`
    : activeTab === "doctors" ? `${doctors.length} médecins rattachés`
    : activeTab === "archives" ? `${inactivePatients.length} dossiers archivés ou retirés`
    : activeTab === "settings" ? "Votre compte et vos identifiants"
    : activeTab === "billing" ? `${money(collectedTotal)} encaissés, ${unpaidCount} facture(s) impayée(s)`
    : activeTab === "alerts" ? "Demandes et rappels en attente"
    : `${todayCount} rendez-vous aujourd'hui, ${activePatients.length} patients actifs`;

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
          --paper: #f4f8fc;
          --green: #1a7f4b;
          --green-bg: #e3f5ea;
          --amber: #a86a12;
          --amber-bg: #fbf0de;
          --red: #cf3a3a;
          --red-bg: #fcebeb;
          min-height: 100vh;
          background: var(--paper);
          color: var(--navy);
          display: grid;
          grid-template-columns: 248px 1fr;
        }
        .main-area { min-width: 0; }

        .side {
          position: sticky; top: 0; height: 100vh;
          display: flex; flex-direction: column;
          padding: 24px 16px;
          background:
            radial-gradient(120% 60% at 0% 78%, rgba(90, 166, 245, 0.18) 0%, rgba(90, 166, 245, 0) 60%),
            linear-gradient(180deg, #0d3a6e 0%, #0a2540 100%);
          color: #fff;
          box-sizing: border-box;
        }
        .side-brand { display: flex; align-items: center; gap: 12px; padding: 0 8px 28px; }
        .side-logo {
          width: 40px; height: 40px; border-radius: 11px;
          display: flex; align-items: center; justify-content: center;
          background: var(--blue); font-size: 26px; font-weight: 800;
          box-shadow: 0 6px 16px rgba(24, 119, 224, 0.45);
        }
        .side-name { font-size: 24px; font-weight: 800; letter-spacing: -0.03em; }
        .side-name span { color: #5aa6f5; }
        .side-tag { font-size: 12px; color: #7fb6f0; margin-top: 1px; }

        .side-nav { display: flex; flex-direction: column; gap: 6px; flex-grow: 1; }
        .side-link {
          display: flex; align-items: center; gap: 14px;
          width: 100%; padding: 12px 14px; border: none; border-radius: 10px;
          background: none; color: #dce8f5; font: inherit; font-size: 15px; font-weight: 500;
          text-align: left; cursor: pointer;
          transition: background-color 0.16s ease, color 0.16s ease;
        }
        .side-link:hover { background: rgba(255, 255, 255, 0.07); color: #fff; }
        .side-link.on { background: var(--blue); color: #fff; font-weight: 600; box-shadow: 0 6px 16px rgba(24, 119, 224, 0.35); }
        .side-count {
          margin-left: auto; font-style: normal; font-size: 12px; font-weight: 700;
          background: rgba(255, 255, 255, 0.16); padding: 2px 8px; border-radius: 20px;
        }
        .side-alert { background: #e5484d; color: #fff; min-width: 22px; text-align: center; box-sizing: border-box; }

        .side-promo {
          margin: 16px 0; padding: 16px; border-radius: 14px;
          background: rgba(24, 119, 224, 0.22); border: 1px solid rgba(255, 255, 255, 0.1);
        }
        .side-promo-head { display: flex; align-items: center; gap: 10px; font-size: 18px; font-weight: 800; }
        .side-promo-logo {
          width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
          background: var(--blue); font-size: 18px;
        }
        .side-promo p { margin: 10px 0 0; font-size: 14px; line-height: 1.5; color: #e4eefa; }

        .side-foot { border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 16px; display: flex; flex-direction: column; gap: 6px; }
        .side-me {
          display: flex; align-items: center; gap: 12px; width: 100%;
          padding: 10px; border: none; border-radius: 10px; background: none;
          color: #fff; font: inherit; cursor: pointer; transition: background-color 0.16s ease;
        }
        .side-me:hover { background: rgba(255, 255, 255, 0.08); }
        .side-avatar {
          width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: #fff; color: var(--blue); font-weight: 800;
        }
        .side-me-name { font-size: 14px; font-weight: 700; }
        .side-me-role { font-size: 12px; color: #9db4cc; }
        .side-out {
          display: flex; align-items: center; gap: 12px; width: 100%;
          padding: 11px 14px; border: none; border-radius: 10px; background: none;
          color: #dce8f5; font: inherit; font-size: 14px; cursor: pointer;
          transition: color 0.16s ease, background-color 0.16s ease;
        }
        .side-out:hover { color: #ff9b9b; background: rgba(255, 100, 100, 0.1); }

        .ok { background: var(--green-bg); color: var(--green); padding: 13px 18px; border-radius: 10px; margin-bottom: 22px; font-size: 14px; font-weight: 600; }

        .band { padding: 26px 32px 0; }
        .wrap { max-width: 1320px; margin: 0 auto; width: 100%; }
        .main { padding: 22px 32px 56px; }
        .hero-title { font-size: 26px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 4px; line-height: 1.2; }
        .hero-sub { font-size: 14px; color: var(--muted); margin: 0; }

        .btn {
          display: inline-flex; align-items: center; justify-content: center; gap: 8px;
          font: inherit; font-size: 14px; font-weight: 600;
          border-radius: 9px; cursor: pointer; padding: 10px 18px;
          border: 1px solid transparent; white-space: nowrap;
          transition: background-color 0.16s ease, border-color 0.16s ease, color 0.16s ease;
        }
        .btn:focus-visible { outline: 3px solid rgba(24, 119, 224, 0.35); outline-offset: 2px; }
        .btn-primary { background: var(--blue); color: #fff; box-shadow: 0 4px 12px rgba(24, 119, 224, 0.25); }
        .btn-primary:hover { background: var(--blue-dark); }
        .btn-primary:disabled { opacity: 0.55; box-shadow: none; cursor: default; }
        .btn-ghost { background: #fff; color: var(--navy); border-color: var(--line); }
        .btn-ghost:hover { border-color: var(--blue); color: var(--blue); }
        .btn-danger { background: #fff; color: var(--red); border-color: var(--line); }
        .btn-danger:hover { background: var(--red-bg); border-color: var(--red); }
        .btn-sm { padding: 7px 14px; font-size: 13px; }
        .btn-link { background: none; border: none; padding: 0; color: var(--blue); font: inherit; font-size: 13px; font-weight: 500; cursor: pointer; }
        .btn-link:hover { text-decoration: underline; }

        .field {
          width: 100%; box-sizing: border-box; padding: 11px 14px; font: inherit; font-size: 14px;
          color: var(--navy); background: #fff; border: 1px solid var(--line); border-radius: 9px;
          transition: border-color 0.18s ease, box-shadow 0.18s ease;
        }
        .field:hover { border-color: #c9d9ea; }
        .field:focus { outline: none; border-color: var(--blue); box-shadow: 0 0 0 4px rgba(24, 119, 224, 0.14); }
        .lab { display: block; font-size: 13px; font-weight: 500; color: var(--muted); margin-bottom: 6px; }
        select.field {
          appearance: none; -webkit-appearance: none; padding-right: 40px; cursor: pointer;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%235a7590' stroke-width='3' stroke-linecap='round' stroke-linejoin='round'><polyline points='6 9 12 15 18 9'/></svg>");
          background-repeat: no-repeat; background-position: right 14px center;
        }

        .card { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 24px; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px; margin-bottom: 22px; }
        .stat {
          background: #fff; border: 1px solid var(--line); border-radius: 14px;
          padding: 18px 20px; text-align: left; font: inherit; cursor: pointer;
          transition: box-shadow 0.2s ease, border-color 0.18s ease;
        }
        .stat:hover { box-shadow: 0 10px 24px rgba(10, 37, 64, 0.08); border-color: #cddef1; }
        .stat.on { border-color: var(--blue); box-shadow: 0 6px 18px rgba(24, 119, 224, 0.14); }
        .stat-k { font-size: 13px; font-weight: 500; color: var(--muted); margin-bottom: 8px; }
        .stat-v { font-size: 30px; font-weight: 800; letter-spacing: -0.03em; font-variant-numeric: tabular-nums; }

        .panel { background: #fff; border: 1px solid var(--line); border-radius: 14px; overflow: hidden; }
        .panel-head { padding: 16px 22px; border-bottom: 1px solid var(--line); display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        .panel-title { font-size: 16px; font-weight: 700; margin: 0; }

        .row {
          width: 100%; display: flex; align-items: center; gap: 18px; padding: 14px 22px;
          border: none; border-top: 1px solid var(--line); background: #fff; font: inherit; font-size: 14px;
          text-align: left; cursor: pointer; transition: background-color 0.16s ease;
        }
        .row:first-of-type { border-top: none; }
        .row:hover { background: #f7fafd; }
        .row-when { width: 130px; flex-shrink: 0; color: var(--muted); font-variant-numeric: tabular-nums; }
        .row-who { flex-grow: 1; font-weight: 600; min-width: 0; }
        .row-doc { width: 200px; color: var(--muted); flex-shrink: 0; }

        .line-item { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 14px 22px; border-top: 1px solid var(--line); }
        .line-item:hover { background: #fafcfe; }
        .name { font-weight: 600; font-size: 15px; }
        .meta { font-size: 13px; color: var(--muted); margin-top: 2px; font-variant-numeric: tabular-nums; }

        .pill { display: inline-block; padding: 3px 11px; border-radius: 20px; font-size: 12px; font-weight: 600; white-space: nowrap; }
        .p-scheduled { background: var(--blue-soft); color: var(--blue-dark); }
        .p-confirmed { background: var(--green-bg); color: var(--green); }
        .p-completed { background: var(--green-bg); color: var(--green); }
        .p-cancelled { background: #eef2f6; color: var(--muted); }
        .p-no_show { background: var(--red-bg); color: var(--red); }
        .p-unpaid { background: var(--red-bg); color: var(--red); }
        .p-partial { background: var(--amber-bg); color: var(--amber); }
        .p-paid { background: var(--green-bg); color: var(--green); }

        .kpis { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 16px; margin-bottom: 20px; }
        .kpi {
          display: flex; align-items: center; gap: 16px; padding: 18px 20px; text-align: left;
          background: #fff; border: 1px solid var(--line); border-radius: 14px; font: inherit; color: inherit; cursor: pointer;
          transition: border-color 0.16s ease, box-shadow 0.16s ease;
        }
        .kpi:hover { border-color: #cddef1; box-shadow: 0 8px 20px rgba(10, 37, 64, 0.07); }
        .kpi.static { cursor: default; }
        .kpi.static:hover { box-shadow: none; border-color: var(--line); }
        .kpi > span:last-child { display: flex; flex-direction: column; min-width: 0; }
        .kpi-k { font-size: 13px; color: var(--muted); }
        .kpi-v { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; margin-top: 2px; font-variant-numeric: tabular-nums; white-space: nowrap; }
        .kpi-ic { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .kpi-ic.sm { width: 38px; height: 38px; border-radius: 10px; }
        .kpi-ic.blue { background: var(--blue-soft); color: var(--blue); }
        .kpi-ic.green { background: var(--green-bg); color: var(--green); }
        .kpi-ic.amber { background: var(--amber-bg); color: var(--amber); }
        .kpi-ic.red { background: var(--red-bg); color: var(--red); }

        .cols { display: grid; grid-template-columns: minmax(0, 1fr) 400px; gap: 18px; align-items: start; }
        .stack { display: flex; flex-direction: column; gap: 18px; min-width: 0; }
        .with-ic { display: flex; align-items: center; gap: 10px; }
        .with-ic :global(svg) { color: var(--blue); }

        .agenda-row { display: flex; align-items: center; gap: 14px; padding: 12px 22px; border-top: 1px solid var(--line); cursor: pointer; }
        .agenda-row:first-of-type { border-top: none; }
        .agenda-row:hover { background: #f7fafd; }
        .agenda-time { width: 52px; font-weight: 700; font-variant-numeric: tabular-nums; }
        .agenda-bar { width: 4px; align-self: stretch; border-radius: 4px; background: var(--blue); }
        .agenda-bar.b-confirmed, .agenda-bar.b-completed { background: var(--green); }
        .agenda-bar.b-no_show { background: var(--red); }

        .mini-row { display: flex; align-items: center; gap: 12px; padding: 12px 22px; border-top: 1px solid var(--line); cursor: pointer; }
        .mini-row:first-of-type { border-top: none; }
        .mini-row:hover { background: #f7fafd; }
        .date-box { width: 46px; flex-shrink: 0; text-align: center; padding: 6px 0; border-radius: 10px; background: var(--blue-soft); color: var(--blue-dark); }
        .date-box b { display: block; font-size: 18px; line-height: 1.1; }
        .date-box span { font-size: 11px; }

        .toolbar { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
        .chips { display: flex; gap: 8px; flex-wrap: wrap; }
        .chip {
          display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px; border-radius: 20px;
          border: 1px solid var(--line); background: #fff; font: inherit; font-size: 13px; font-weight: 500; color: var(--navy); cursor: pointer;
        }
        .chip em { font-style: normal; font-size: 12px; font-weight: 700; padding: 1px 7px; border-radius: 20px; background: #eef2f6; color: var(--muted); }
        .chip:hover { border-color: var(--blue); }
        .chip.on { background: var(--blue); border-color: var(--blue); color: #fff; }
        .chip.on em { background: rgba(255, 255, 255, 0.22); color: #fff; }

        .icon-btn {
          width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center;
          border: 1px solid var(--line); border-radius: 8px; background: #fff; color: var(--muted); cursor: pointer;
        }
        .icon-btn:hover { color: var(--blue); border-color: var(--blue); background: var(--blue-soft); }
        .icon-btn.icon-ok { color: var(--green); }
        .icon-btn.icon-ok:hover { border-color: var(--green); background: var(--green-bg); color: var(--green); }
        .icon-btn.danger:hover { color: var(--red); border-color: var(--red); background: var(--red-bg); }
        .ok-btn { color: var(--green); }
        .ok-btn:hover { border-color: var(--green); color: var(--green); background: var(--green-bg); }

        @media (max-width: 1200px) {
          .kpis { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .cols { grid-template-columns: 1fr; }
        }

        .tbl-wrap { overflow-x: auto; }
        .tbl { width: 100%; border-collapse: collapse; font-size: 14px; }
        .tbl th {
          text-align: left; padding: 12px 16px; font-size: 13px; font-weight: 500; color: var(--muted);
          background: #f7fafd; border-bottom: 1px solid var(--line); white-space: nowrap;
        }
        .tbl td { padding: 12px 16px; border-bottom: 1px solid var(--line); vertical-align: middle; white-space: nowrap; }
        .tbl tr:last-child td { border-bottom: none; }
        .tbl-row { cursor: pointer; transition: background-color 0.14s ease; }
        .tbl-row:hover td { background: #f7fafd; }
        .tbl-actions { text-align: right; }
        .tbl-actions-inner { display: inline-flex; gap: 8px; align-items: center; }
        .who { display: flex; align-items: center; gap: 12px; }
        .avatar {
          width: 40px; height: 40px; border-radius: 50%; flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          background: var(--blue-soft); color: var(--blue); font-weight: 700; font-size: 14px;
        }
        .muted { color: var(--muted); }

        .search-note {
          display: flex; align-items: center; justify-content: space-between; gap: 12px;
          margin-bottom: 16px; padding: 12px 16px; border-radius: 10px;
          background: var(--blue-soft); color: var(--blue-dark); font-size: 14px; border: 1px solid #d5e6f8;
        }

        .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
        .aptcard { background: #fff; border: 1px solid var(--line); border-radius: 14px; padding: 20px; transition: box-shadow 0.2s ease; }
        .aptcard:hover { box-shadow: 0 10px 24px rgba(10, 37, 64, 0.08); }
        .aptcard-when { font-size: 15px; font-weight: 700; color: var(--blue); margin-top: 10px; font-variant-numeric: tabular-nums; }

        .facts { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 18px; margin-bottom: 18px; }
        .fact-k { font-size: 12px; font-weight: 500; color: var(--muted); margin-bottom: 4px; }
        .fact-v { font-size: 15px; font-weight: 600; font-variant-numeric: tabular-nums; }

        .days { display: flex; gap: 8px; flex-wrap: wrap; }
        .day {
          font: inherit; cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 2px;
          min-width: 52px; padding: 9px 6px; background: #fff; color: var(--navy);
          border: 1px solid var(--line); border-radius: 11px; transition: background-color 0.16s ease, border-color 0.16s ease;
        }
        .day:hover { border-color: var(--blue); color: var(--blue); }
        .day.on { background: var(--blue); border-color: var(--blue); color: #fff; }
        .day-top { font-size: 11px; font-weight: 700; opacity: 0.72; }
        .day-num { font-size: 17px; font-weight: 800; font-variant-numeric: tabular-nums; }
        .date-echo { font-size: 13px; font-weight: 600; color: var(--blue); margin: 10px 0 0; }
        .hint { font-size: 13px; color: var(--muted); margin: 0; }

        .slots { display: flex; flex-wrap: wrap; gap: 8px; }
        .slot {
          font: inherit; font-size: 13px; font-weight: 600; font-variant-numeric: tabular-nums;
          padding: 8px 14px; border-radius: 8px; cursor: pointer;
          background: #fff; color: var(--navy); border: 1px solid var(--line);
        }
        .slot:hover { border-color: var(--blue); color: var(--blue); }
        .slot.on { background: var(--blue); border-color: var(--blue); color: #fff; }
        .slot.taken { background: #f2f5f8; color: #9aabbd; border-color: #e8edf3; cursor: not-allowed; text-decoration: line-through; }
        .slot.past { background: #fafbfc; color: #b8c4d0; border-color: #eef2f6; cursor: not-allowed; }
        .legend { display: flex; flex-wrap: wrap; gap: 16px; margin-top: 12px; font-size: 12px; color: var(--muted); }
        .legend span { display: inline-flex; align-items: center; }
        .legend-none { color: var(--amber); font-weight: 600; }
        .dot { width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; display: inline-block; }
        .dot-free { background: var(--blue); }
        .dot-taken { background: #9aabbd; }
        .dot-past { background: #d5dee7; }

        .overlay {
          position: fixed; inset: 0; z-index: 1000; padding: 24px; background: rgba(10, 37, 64, 0.42);
          display: flex; align-items: center; justify-content: center;
        }
        .modal {
          background: #fff; border-radius: 18px; padding: 28px; width: 470px; max-width: 100%;
          max-height: 90vh; overflow-y: auto; box-shadow: 0 30px 70px rgba(10, 37, 64, 0.28);
        }
        .modal-title { font-size: 20px; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 20px; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }

        .alert { background: var(--red-bg); color: var(--red); padding: 13px 18px; border-radius: 10px; margin-bottom: 22px; font-size: 14px; font-weight: 600; }
        .empty { padding: 40px 24px; text-align: center; color: var(--muted); font-size: 14px; }
        .err { color: var(--red); font-size: 14px; font-weight: 600; margin: 0 0 16px; }
      `}</style>

      <aside className="side">
        <div className="side-brand">
          <div className="side-logo">+</div>
          <div>
            <div className="side-name">Med<span>Link</span></div>
            <div className="side-tag">Votre santé, notre priorité</div>
          </div>
        </div>

        <div className="side-nav">
          {NAV.map((t) => {
            const Icon = NAV_ICONS[t.id];
            const on = activeTab === t.id || (t.id === "patients" && activeTab === "new_patient");
            return (
              <button
                key={t.id}
                className={`side-link ${on ? "on" : ""}`}
                onClick={() => { setActiveTab(t.id); setDashFilter("all"); setOpenPatientId(null); clearSearch(); }}
              >
                <Icon size={20} />
                <span>{t.label}</span>
                {t.id === "archives" && inactivePatients.length > 0 && <em className="side-count">{inactivePatients.length}</em>}
                {t.id === "alerts" && alertCount > 0 && <em className="side-count side-alert">{alertCount}</em>}
              </button>
            );
          })}
        </div>

        <div className="side-promo">
          <div className="side-promo-head"><span className="side-promo-logo">+</span> MedLink</div>
          <p>Une gestion médicale plus simple, plus rapide, plus humaine.</p>
        </div>

        <div className="side-foot">
          <button className="side-me" onClick={() => { setActiveTab("settings"); setOpenPatientId(null); setSettingsMsg(null); }}>
            <div className="side-avatar">S</div>
            <div style={{ textAlign: "left", flexGrow: 1 }}>
              <div className="side-me-name">Secrétaire</div>
              <div className="side-me-role">Secrétaire du cabinet</div>
            </div>
            <ChevronRight size={16} />
          </button>
          <button className="side-out" onClick={logout}>
            <LogOut size={18} />
            <span>Déconnexion</span>
          </button>
        </div>
      </aside>

      <div className="main-area">
        <SecretariatTopbar
          alertCount={alertCount}
          onSearch={(q) => {
            setActiveTab("patients");
            setOpenPatientId(null);
            runSearch(q, activePatients);
          }}
          onAlerts={() => { setActiveTab("alerts"); setOpenPatientId(null); }}
          onProfile={() => { setActiveTab("settings"); setOpenPatientId(null); setSettingsMsg(null); }}
        />

        {!(activeTab === "patients" && openPatient) && (
          <div className="band">
            <div className="wrap">
              <h1 className="hero-title">{pageTitle}</h1>
              <p className="hero-sub">{pageSub}</p>
            </div>
          </div>
        )}

        <main className="main">
          <div className="wrap">
            {loadError && <div className="alert">{loadError}</div>}

            {activeTab === "dashboard" && (
              <>
                <div className="kpis">
                  <button className="kpi" onClick={() => { setActiveTab("rdv"); setRdvFilter("today"); }}>
                    <span className="kpi-ic blue"><CalendarDays size={22} /></span>
                    <span>
                      <span className="kpi-k">Rendez-vous aujourd&apos;hui</span>
                      <span className="kpi-v">{todayAppts.length}</span>
                    </span>
                  </button>
                  <button className="kpi" onClick={() => setActiveTab("alerts")}>
                    <span className="kpi-ic amber"><Clock size={22} /></span>
                    <span>
                      <span className="kpi-k">À confirmer</span>
                      <span className="kpi-v">{alertCount}</span>
                    </span>
                  </button>
                  <button className="kpi" onClick={() => setActiveTab("patients")}>
                    <span className="kpi-ic green"><Users size={22} /></span>
                    <span>
                      <span className="kpi-k">Patients actifs</span>
                      <span className="kpi-v">{activePatients.length}</span>
                    </span>
                  </button>
                  <button className="kpi" onClick={() => { setActiveTab("billing"); setBillFilter("unpaid"); }}>
                    <span className="kpi-ic red"><Wallet size={22} /></span>
                    <span>
                      <span className="kpi-k">Reste à encaisser</span>
                      <span className="kpi-v">{money(outstanding)}</span>
                    </span>
                  </button>
                </div>

                <div className="cols">
                  <section className="panel">
                    <div className="panel-head">
                      <h2 className="panel-title with-ic"><CalendarDays size={20} /> Agenda du jour</h2>
                      <button className="btn btn-primary btn-sm" onClick={() => setIsRdvModalOpen(true)}>
                        <Plus size={16} /> Nouveau rendez-vous
                      </button>
                    </div>
                    {todayAppts.length === 0 ? (
                      <div className="empty">
                        Aucun rendez-vous aujourd&apos;hui.
                        <div style={{ marginTop: 10 }}>
                          <button className="btn-link" onClick={() => setIsRdvModalOpen(true)}>Planifier un rendez-vous</button>
                        </div>
                      </div>
                    ) : (
                      todayAppts.map((a) => (
                        <div key={a.id} className="agenda-row" onClick={() => setSelectedAppointment(a)}>
                          <div className="agenda-time">{fmtTime(a.scheduled_at)}</div>
                          <div className={`agenda-bar b-${a.status}`} />
                          <div className="who" style={{ flexGrow: 1, minWidth: 0 }}>
                            <span className="avatar">{patientInitials(a.patient_id)}</span>
                            <div style={{ minWidth: 0 }}>
                              <div className="name">{patientName(a.patient_id)}</div>
                              <div className="meta">{a.reason || "Consultation"}, {doctorName(a.doctor_id)}</div>
                            </div>
                          </div>
                          {statusPill(a.status)}
                          <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setSelectedAppointment(a); }}>Voir</button>
                        </div>
                      ))
                    )}
                  </section>

                  <div className="stack">
                    <section className="panel">
                      <div className="panel-head">
                        <h2 className="panel-title with-ic"><Clock size={20} /> Prochains rendez-vous</h2>
                        <button className="btn-link" onClick={() => { setActiveTab("rdv"); setRdvFilter("upcoming"); }}>Voir tout</button>
                      </div>
                      {upcomingAppts.length === 0 ? (
                        <div className="empty">Aucun rendez-vous à venir.</div>
                      ) : (
                        upcomingAppts.slice(0, 5).map((a) => (
                          <div key={a.id} className="mini-row" onClick={() => setSelectedAppointment(a)}>
                            <div className="date-box">
                              <b>{parseLocal(a.scheduled_at).getDate()}</b>
                              <span>{parseLocal(a.scheduled_at).toLocaleDateString("fr-FR", { month: "short" })}</span>
                            </div>
                            <div style={{ flexGrow: 1, minWidth: 0 }}>
                              <div className="name">{patientName(a.patient_id)}</div>
                              <div className="meta">{fmtTime(a.scheduled_at)}, {doctorName(a.doctor_id)}</div>
                            </div>
                            {statusPill(a.status)}
                          </div>
                        ))
                      )}
                    </section>

                    <section className="panel">
                      <div className="panel-head">
                        <h2 className="panel-title with-ic"><Receipt size={20} /> Factures impayées</h2>
                        <button className="btn-link" onClick={() => { setActiveTab("billing"); setBillFilter("unpaid"); }}>Voir tout</button>
                      </div>
                      {unpaidInvoices.length === 0 ? (
                        <div className="empty">Toutes les factures sont réglées.</div>
                      ) : (
                        unpaidInvoices.slice(0, 4).map((inv) => (
                          <div key={inv.id} className="mini-row">
                            <span className="kpi-ic red sm"><FileText size={17} /></span>
                            <div style={{ flexGrow: 1, minWidth: 0 }}>
                              <div className="name">{patientName(inv.patient_id)}</div>
                              <div className="meta">Facture {invoiceNumber(inv)}, reste {money(inv.balance_due ?? inv.amount_due)}</div>
                            </div>
                            <button className="btn btn-primary btn-sm" onClick={() => openPay(inv)}>Encaisser</button>
                          </div>
                        ))
                      )}
                    </section>
                  </div>
                </div>
              </>
            )}

            {activeTab === "rdv" && (
              <>
                <div className="toolbar">
                  <div className="chips">
                    {RDV_FILTERS.map((f) => (
                      <button key={f.id} className={`chip ${rdvFilter === f.id ? "on" : ""}`} onClick={() => setRdvFilter(f.id)}>
                        {f.label} <em>{f.list.length}</em>
                      </button>
                    ))}
                  </div>
                  <button className="btn btn-primary" onClick={() => setIsRdvModalOpen(true)}><Plus size={16} /> Nouveau rendez-vous</button>
                </div>
                <div className="panel">
                  {rdvList.length === 0 ? (
                    <div className="empty">Aucun rendez-vous dans cette catégorie.</div>
                  ) : (
                    <div className="tbl-wrap">
                      <table className="tbl">
                        <thead>
                          <tr><th>Date &amp; Heure</th><th>Patient</th><th>Motif</th><th>Médecin</th><th>Statut</th><th style={{ textAlign: "right" }}>Actions</th></tr>
                        </thead>
                        <tbody>
                          {rdvList.map((a) => {
                            const future = ts(a.scheduled_at) >= nowMs;
                            return (
                              <tr key={a.id} className="tbl-row" onClick={() => setSelectedAppointment(a)}>
                                <td>
                                  <div className="name">{parseLocal(a.scheduled_at).toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short" })}</div>
                                  <div className="meta">{fmtTime(a.scheduled_at)}</div>
                                </td>
                                <td>
                                  <div className="who">
                                    <span className="avatar">{patientInitials(a.patient_id)}</span>
                                    <span className="name">{patientName(a.patient_id)}</span>
                                  </div>
                                </td>
                                <td className="muted">{a.reason || "Consultation"}</td>
                                <td>{doctorName(a.doctor_id)}</td>
                                <td>{statusPill(a.status)}</td>
                                <td className="tbl-actions" onClick={(e) => e.stopPropagation()}>
                                  <span className="tbl-actions-inner">
                                    {future && a.status === "scheduled" && (
                                      <button className="icon-btn icon-ok" title="Confirmer" aria-label="Confirmer" onClick={() => confirmAppointment(a.id)}><Check size={16} /></button>
                                    )}
                                    {future && a.status !== "cancelled" && (
                                      <button className="icon-btn" title="Reprogrammer" aria-label="Reprogrammer" onClick={() => { setEditingAppointment(a); setRescheduleDate(""); setRescheduleSlots([]); setNewRescheduleTime(""); }}><CalendarClock size={16} /></button>
                                    )}
                                    <button className="icon-btn" title="Voir" aria-label="Voir" onClick={() => setSelectedAppointment(a)}><Eye size={16} /></button>
                                    <button className="icon-btn danger" title="Supprimer" aria-label="Supprimer" onClick={() => deleteAppointment(a.id)}><Trash2 size={16} /></button>
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === "patients" && openPatient && (
              <PatientFile
                patient={openPatient}
                appointments={appointments}
                invoices={invoices}
                docs={docs}
                doctorName={doctorName}
                onBack={() => window.history.back()}
                onNewAppointment={() => openRdvForPatient(openPatient.id)}
                onViewAppointment={(a) => setSelectedAppointment(a)}
                onArchive={() => { setStatusTarget({ patient: openPatient, action: "archived" }); setStatusReason(""); }}
                onRemove={() => { setStatusTarget({ patient: openPatient, action: "removed" }); setStatusReason(""); }}
                onViewDoc={(d) => setViewDoc(d)}
                onDownloadDoc={openDoc}
                onDocsChanged={() => loadDocs(openPatient.id)}
                onPatientUpdated={loadAll}
              />
            )}

            {activeTab === "patients" && !openPatient && (
              <>
                {searching && (
                  <div className="search-note">
                    <span>{searchResults.length} résultat{searchResults.length > 1 ? "s" : ""} pour « {searchQuery.trim()} »</span>
                    <button className="btn-link" onClick={clearSearch}>Afficher tous les patients</button>
                  </div>
                )}
                <div className="panel">
                  <div className="panel-head">
                    <h2 className="panel-title">Liste des patients</h2>
                    <button className="btn btn-primary btn-sm" onClick={() => setActiveTab("new_patient")}>
                      <Plus size={16} /> Nouveau patient
                    </button>
                  </div>

                  {listedPatients.length === 0 ? (
                    <div className="empty">Aucun patient ne correspond à cette recherche.</div>
                  ) : (
                    <div className="tbl-wrap">
                      <table className="tbl">
                        <thead>
                          <tr><th>Patient</th><th>CIN</th><th>Âge</th><th>Sexe</th><th>Groupe sanguin</th><th>Prochain RDV</th><th></th></tr>
                        </thead>
                        <tbody>
                          {listedPatients.map((p) => {
                            const age = ageFrom(p.date_of_birth);
                            const next = nextApptOf(p.id);
                            return (
                              <tr key={p.id} className="tbl-row" onClick={() => openFile(p.id)}>
                                <td>
                                  <div className="who">
                                    <span className="avatar">{initials(p)}</span>
                                    <div>
                                      <div className="name">{p.first_name} {p.last_name}</div>
                                      <div className="meta">{p.email || p.phone || "Contact non renseigné"}</div>
                                    </div>
                                  </div>
                                </td>
                                <td>{p.national_id || <span className="muted">Non renseigné</span>}</td>
                                <td>{age !== null ? `${age} ans` : <span className="muted">—</span>}</td>
                                <td>{p.sex === "M" ? "Homme" : p.sex === "F" ? "Femme" : <span className="muted">—</span>}</td>
                                <td>{p.blood_group && p.blood_group !== "unknown" ? p.blood_group : <span className="muted">{bloodLabel(p.blood_group)}</span>}</td>
                                <td>{next ? `${fmtDay(next.scheduled_at)} - ${fmtTime(next.scheduled_at)}` : <span className="muted">Aucun</span>}</td>
                                <td className="tbl-actions">
                                  <span className="tbl-actions-inner">
                                    <button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); openFile(p.id); }}>Dossier</button>
                                    <button className="btn btn-primary btn-sm" onClick={(e) => { e.stopPropagation(); openRdvForPatient(p.id); }}>Rendez-vous</button>
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
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
                    <div><label className="lab">Date de naissance</label><input className="field" type="date" required max={new Date().toISOString().slice(0, 10)} value={formData.dateOfBirth} onChange={(e) => setFormData((f) => ({ ...f, dateOfBirth: e.target.value }))} /></div>
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
                          <option key={bg} value={bg}>{bg === "unknown" ? "Non renseigné" : bg}</option>
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
              <div className="panel" style={{ maxWidth: 760 }}>
                <div className="panel-head"><h2 className="panel-title">Médecins du cabinet</h2></div>
                {doctors.length === 0 ? (
                  <div className="empty">Aucun médecin rattaché.</div>
                ) : (
                  doctors.map((d) => (
                    <div key={d.id} className="line-item">
                      <div className="who">
                        <span className="avatar"><Stethoscope size={18} /></span>
                        <div>
                          <div className="name">Dr. {d.first_name} {d.last_name}</div>
                          <div className="meta">{d.specialty || "Médecine générale"}</div>
                        </div>
                      </div>
                      <span className="meta" style={{ marginTop: 0 }}>
                        {appointments.filter((a) => a.doctor_id === d.id).length} rendez-vous
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "archives" && (
              <div className="panel">
                <div className="panel-head">
                  <h2 className="panel-title">Dossiers archivés ou retirés</h2>
                </div>
                {listedArchives.length === 0 ? (
                  <div className="empty">
                    Aucun dossier archivé. Les patients archivés ou retirés du cabinet apparaîtront ici,
                    avec l&apos;intégralité de leur historique.
                  </div>
                ) : (
                  listedArchives.map((p) => (
                    <div key={p.id} className="line-item">
                      <div className="who">
                        <span className="avatar">{initials(p)}</span>
                        <div style={{ minWidth: 0 }}>
                          <div className="name">{p.first_name} {p.last_name}</div>
                          <div className="meta">
                            CIN {p.national_id || "non renseigné"}
                            {p.status_reason ? `, ${p.status_reason}` : ""}
                          </div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 8, alignItems: "center", flexShrink: 0 }}>
                        <span className={`pill ${p.status === "removed" ? "p-no_show" : "p-cancelled"}`}>
                          {p.status === "removed" ? "Retiré" : "Archivé"}
                        </span>
                        <button className="btn btn-ghost btn-sm" onClick={() => openFile(p.id)}>Dossier</button>
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={async () => {
                            try { await changeStatus(p.id, "active"); }
                            catch (err) { alert(err instanceof Error ? err.message : "Réactivation impossible."); }
                          }}
                        >
                          Réactiver
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === "billing" && (
              <>
                <div className="kpis">
                  <div className="kpi static">
                    <span className="kpi-ic green"><Wallet size={22} /></span>
                    <span><span className="kpi-k">Encaissé</span><span className="kpi-v">{money(collectedTotal)}</span></span>
                  </div>
                  <div className="kpi static">
                    <span className="kpi-ic blue"><FileText size={22} /></span>
                    <span><span className="kpi-k">Facturé</span><span className="kpi-v">{money(invoicedTotal)}</span></span>
                  </div>
                  <div className="kpi static">
                    <span className="kpi-ic amber"><Clock size={22} /></span>
                    <span><span className="kpi-k">Reste à encaisser</span><span className="kpi-v">{money(outstanding)}</span></span>
                  </div>
                  <div className="kpi static">
                    <span className="kpi-ic red"><Receipt size={22} /></span>
                    <span><span className="kpi-k">Factures impayées</span><span className="kpi-v">{unpaidInvoices.length}</span></span>
                  </div>
                </div>

                <div className="toolbar">
                  <div className="chips">
                    {BILL_FILTERS.map((f) => (
                      <button key={f.id} className={`chip ${billFilter === f.id ? "on" : ""}`} onClick={() => setBillFilter(f.id)}>
                        {f.label} <em>{f.list.length}</em>
                      </button>
                    ))}
                  </div>
                  <button className="btn btn-primary" onClick={openBill}><Plus size={16} /> Nouvelle facture</button>
                </div>

                <div className="panel">
                  {billList.length === 0 ? (
                    <div className="empty">Aucune facture dans cette catégorie.</div>
                  ) : (
                    <div className="tbl-wrap">
                      <table className="tbl">
                        <thead>
                          <tr><th>Facture</th><th>Patient</th><th>Prestation</th><th>Date</th><th>Médecin</th><th>Montant</th><th>Reste</th><th>Statut</th><th></th></tr>
                        </thead>
                        <tbody>
                          {billList.map((inv) => (
                            <tr key={inv.id}>
                              <td className="name">{invoiceNumber(inv)}</td>
                              <td>
                                <div className="who">
                                  <span className="avatar">{patientInitials(inv.patient_id)}</span>
                                  <span className="name">{patientName(inv.patient_id)}</span>
                                </div>
                              </td>
                              <td className="muted">{inv.description}</td>
                              <td>{fmtDay(inv.issued_at)}</td>
                              <td>{inv.doctor_id ? doctorName(inv.doctor_id) : <span className="muted">—</span>}</td>
                              <td className="name">{money(inv.amount_due)}</td>
                              <td style={{ color: inv.balance_due > 0 ? "#a86a12" : "#5a7590", fontWeight: 600 }}>{money(inv.balance_due ?? 0)}</td>
                              <td>{invoicePill(inv.status)}</td>
                              <td className="tbl-actions">
                                {inv.balance_due > 0 && (
                                  <button className="btn btn-primary btn-sm" onClick={() => openPay(inv)}>Encaisser</button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}

            {activeTab === "settings" && (
              <div style={{ maxWidth: 620 }}>
                {settingsMsg && (
                  <div className={settingsMsg.ok ? "ok" : "alert"}>{settingsMsg.text}</div>
                )}

                <div className="card" style={{ marginBottom: 16 }}>
                  <h2 className="panel-title" style={{ marginBottom: 18 }}>Changer le mot de passe</h2>
                  <form onSubmit={submitPassword}>
                    <div style={{ marginBottom: 14 }}>
                      <label className="lab">Mot de passe actuel</label>
                      <input className="field" type="password" required value={pwdForm.current} onChange={(e) => setPwdForm((f) => ({ ...f, current: e.target.value }))} />
                    </div>
                    <div style={{ marginBottom: 18 }}>
                      <label className="lab">Nouveau mot de passe</label>
                      <input className="field" type="password" required minLength={8} value={pwdForm.next} onChange={(e) => setPwdForm((f) => ({ ...f, next: e.target.value }))} />
                      <p className="hint" style={{ marginTop: 6 }}>Huit caractères minimum.</p>
                    </div>
                    <button type="submit" className="btn btn-primary">Enregistrer</button>
                  </form>
                </div>

                <div className="card">
                  <h2 className="panel-title" style={{ marginBottom: 18 }}>Changer l&apos;adresse email</h2>
                  <form onSubmit={submitEmail}>
                    <div style={{ marginBottom: 14 }}>
                      <label className="lab">Nouvel email</label>
                      <input className="field" type="email" required value={emailForm.next} onChange={(e) => setEmailForm((f) => ({ ...f, next: e.target.value }))} />
                    </div>
                    <div style={{ marginBottom: 18 }}>
                      <label className="lab">Mot de passe actuel</label>
                      <input className="field" type="password" required value={emailForm.current} onChange={(e) => setEmailForm((f) => ({ ...f, current: e.target.value }))} />
                    </div>
                    <button type="submit" className="btn btn-primary">Enregistrer</button>
                  </form>
                </div>
              </div>
            )}

            {activeTab === "alerts" && (
              <div className="panel" style={{ maxWidth: 820 }}>
                <div className="panel-head"><h2 className="panel-title">Rendez-vous à confirmer</h2></div>
                {alertCount === 0 ? (
                  <div className="empty">Rien à signaler. Les rendez-vous non confirmés apparaîtront ici.</div>
                ) : (
                  appointments
                    .filter((a) => a.status === "scheduled" && parseLocal(a.scheduled_at).getTime() >= Date.now())
                    .sort((a, b) => parseLocal(a.scheduled_at).getTime() - parseLocal(b.scheduled_at).getTime())
                    .map((a) => (
                      <div key={a.id} className="line-item">
                        <div>
                          <div className="name">{patientName(a.patient_id)}</div>
                          <div className="meta">{fmtDay(a.scheduled_at)} - {fmtTime(a.scheduled_at)}, {doctorName(a.doctor_id)}</div>
                        </div>
                        <button className="btn btn-ghost btn-sm" onClick={() => setSelectedAppointment(a)}>Voir</button>
                      </div>
                    ))
                )}
              </div>
            )}
          </div>
        </main>
      </div>

      {isRdvModalOpen && (
        <div className="overlay" onClick={closeRdvModal}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={handleRdvSubmit}>
            <h3 className="modal-title">Nouveau rendez-vous</h3>

            <div style={{ marginBottom: 16 }}>
              <label className="lab">Patient</label>
              <select className="field" required value={rdvFormData.patientId} onChange={(e) => setRdvFormData((f) => ({ ...f, patientId: e.target.value }))}>
                <option value="">Choisir un patient</option>
                {activePatients.map((p) => (
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
                  className={`day ${showCustomDate ? "on" : ""}`}
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
              {patientName(editingAppointment.patient_id)}, actuellement le{" "}
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
                  className={`day ${showCustomReDate ? "on" : ""}`}
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

      {billOpen && (
        <div className="overlay" onClick={() => setBillOpen(false)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submitInvoice}>
            <h3 className="modal-title">Nouvelle facture</h3>

            <div style={{ marginBottom: 16 }}>
              <label className="lab">Patient</label>
              <select
                className="field"
                required
                value={billForm.patientId}
                onChange={(e) => setBillForm((f) => ({ ...f, patientId: e.target.value }))}
              >
                <option value="">Choisir un patient</option>
                {activePatients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.last_name} {p.first_name}{p.national_id ? ` — ${p.national_id}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="lab">Médecin</label>
              <select
                className="field"
                value={billForm.doctorId}
                onChange={(e) => setBillForm((f) => ({ ...f, doctorId: e.target.value, procedureId: "", description: "", amount: "" }))}
              >
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>Dr. {d.first_name} {d.last_name}</option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="lab">Prestation</label>
              {procedures.length === 0 ? (
                <p className="hint">
                  Ce médecin n&apos;a pas encore défini ses tarifs. Saisissez la prestation et le montant à la main.
                </p>
              ) : (
                <select
                  className="field"
                  value={billForm.procedureId}
                  onChange={(e) => {
                    const proc = procedures.find((p) => p.id === e.target.value);
                    setBillForm((f) => ({
                      ...f,
                      procedureId: e.target.value,
                      description: proc ? proc.label : f.description,
                      amount: proc ? String(proc.price) : f.amount,
                    }));
                  }}
                >
                  <option value="">Saisie libre</option>
                  {procedures.map((p) => (
                    <option key={p.id} value={p.id}>{p.label} — {money(p.price)}</option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="lab">Description</label>
              <input
                className="field"
                placeholder="Consultation, pose de couronne…"
                value={billForm.description}
                onChange={(e) => setBillForm((f) => ({ ...f, description: e.target.value, procedureId: "" }))}
              />
            </div>

            <div>
              <label className="lab">Montant (MAD)</label>
              <input
                className="field"
                inputMode="decimal"
                placeholder="300"
                value={billForm.amount}
                onChange={(e) => setBillForm((f) => ({ ...f, amount: e.target.value }))}
              />
              <p className="hint" style={{ marginTop: 6 }}>
                Le tarif se remplit automatiquement, mais reste modifiable.
              </p>
            </div>

            {billError && <p className="err" style={{ marginTop: 16, marginBottom: 0 }}>{billError}</p>}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setBillOpen(false)}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={billSaving}>
                {billSaving ? "Enregistrement…" : "Créer la facture"}
              </button>
            </div>
          </form>
        </div>
      )}

      {payTarget && (
        <div className="overlay" onClick={() => setPayTarget(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submitPayment}>
            <h3 className="modal-title">Enregistrer un règlement</h3>
            <p style={{ fontSize: 14, color: "#5a7590", marginTop: 0, marginBottom: 20 }}>
              {patientName(payTarget.patient_id)}, {payTarget.description}
            </p>

            <div className="facts" style={{ marginBottom: 20 }}>
              <div>
                <div className="fact-k">Montant de la facture</div>
                <div className="fact-v">{money(payTarget.amount_due)}</div>
              </div>
              <div>
                <div className="fact-k">Déjà réglé</div>
                <div className="fact-v">{money(payTarget.paid_amount)}</div>
              </div>
              <div>
                <div className="fact-k">Reste à payer</div>
                <div className="fact-v" style={{ color: "#a86a12" }}>{money(payTarget.balance_due)}</div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="lab">Montant encaissé (MAD)</label>
              <input
                className="field"
                autoFocus
                inputMode="decimal"
                value={payForm.amount}
                onChange={(e) => setPayForm((f) => ({ ...f, amount: e.target.value }))}
              />
              <p className="hint" style={{ marginTop: 6 }}>
                Un montant inférieur au reste dû enregistre un règlement partiel.
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="lab">Moyen de paiement</label>
              <select
                className="field"
                value={payForm.method}
                onChange={(e) => setPayForm((f) => ({ ...f, method: e.target.value }))}
              >
                <option value="cash">Espèces</option>
                <option value="card">Carte bancaire</option>
                <option value="transfer">Virement</option>
                <option value="check">Chèque</option>
                <option value="insurance">Prise en charge</option>
              </select>
            </div>

            <div>
              <label className="lab">Référence</label>
              <input
                className="field"
                placeholder="Numéro de chèque, transaction…"
                value={payForm.reference}
                onChange={(e) => setPayForm((f) => ({ ...f, reference: e.target.value }))}
              />
            </div>

            {payError && <p className="err" style={{ marginTop: 16, marginBottom: 0 }}>{payError}</p>}

            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setPayTarget(null)}>Annuler</button>
              <button type="submit" className="btn btn-primary" disabled={paySaving}>
                {paySaving ? "Enregistrement…" : "Encaisser"}
              </button>
            </div>
          </form>
        </div>
      )}

      {statusTarget && (
        <div className="overlay" onClick={() => setStatusTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">
              {statusTarget.action === "archived" ? "Archiver ce dossier ?" : "Retirer ce patient du cabinet ?"}
            </h3>
            <p style={{ fontSize: 15, fontWeight: 600, margin: "0 0 6px" }}>
              {statusTarget.patient.first_name} {statusTarget.patient.last_name}
            </p>
            <p style={{ fontSize: 14, color: "#5a7590", lineHeight: 1.6, marginTop: 0 }}>
              {statusTarget.action === "archived"
                ? "Le dossier sort des listes courantes mais reste consultable dans les dossiers archivés. Rien n'est supprimé, et vous pouvez le réactiver à tout moment."
                : "Le dossier est retiré des listes courantes. Ses consultations, ordonnances et factures restent conservées. Aucune donnée n'est effacée."}
            </p>

            <div style={{ marginTop: 18 }}>
              <label className="lab">
                Motif {statusTarget.action === "removed" ? "(obligatoire)" : "(facultatif)"}
              </label>
              <input
                className="field"
                autoFocus
                placeholder={statusTarget.action === "removed" ? "A changé de médecin" : "Sans consultation depuis deux ans"}
                value={statusReason}
                onChange={(e) => setStatusReason(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-ghost" onClick={() => setStatusTarget(null)}>Annuler</button>
              <button
                className="btn btn-primary"
                disabled={statusSaving || (statusTarget.action === "removed" && !statusReason.trim())}
                onClick={confirmStatusChange}
              >
                {statusSaving ? "En cours…" : "Confirmer"}
              </button>
            </div>
          </div>
        </div>
      )}

      {viewDoc && <DocumentViewer doc={viewDoc} onClose={() => setViewDoc(null)} />}
    </div>
  );
}
