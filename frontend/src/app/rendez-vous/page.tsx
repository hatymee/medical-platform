"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import PatientShell, { parseLocal, longDate, clock } from "@/components/PatientShell";

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Programmé",
  confirmed: "Confirmé",
  cancelled: "Annulé",
  completed: "Terminé",
  no_show: "Absence",
};

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayChipLabel(d: Date, offset: number) {
  if (offset === 0) return { top: "Auj.", bottom: String(d.getDate()) };
  if (offset === 1) return { top: "Dem.", bottom: String(d.getDate()) };
  return { top: d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""), bottom: String(d.getDate()) };
}

export default function RendezVousPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patient, setPatient] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [slots, setSlots] = useState<string[]>([]);
  const [workingHours, setWorkingHours] = useState<string[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const list = await api<any[]>("/appointments/mine").catch(() => []);
    setAppointments(list ?? []);
  }, []);

  useEffect(() => {
    if (!localStorage.getItem("medical_token")) {
      router.replace("/connexion");
      return;
    }
    (async () => {
      try {
        const me = await api<any>("/patients/me");
        setPatient(me);
        await load();
        setDoctors((await api<any[]>("/doctors").catch(() => [])) ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger vos rendez-vous.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router, load]);

  const activeDoctorId = doctorId || (doctors.length > 0 ? doctors[0].id : "");

  useEffect(() => {
    if (!open || !activeDoctorId || !date) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    api<{ available_slots: string[]; working_hours?: string[] }>(
      `/appointments/available-slots/?doctor_id=${activeDoctorId}&target_date=${date}`
    )
      .then((r) => {
        if (cancelled) return;
        setSlots(r.available_slots || []);
        setWorkingHours(r.working_hours || []);
      })
      .catch(() => { if (!cancelled) { setSlots([]); setWorkingHours([]); } })
      .finally(() => { if (!cancelled) setSlotsLoading(false); });
    return () => { cancelled = true; };
  }, [open, activeDoctorId, date]);

  function close() {
    setOpen(false);
    setDoctorId(""); setDate(""); setTime(""); setReason("");
    setSlots([]); setFormError("");
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!activeDoctorId || !date || !time) {
      setFormError("Choisissez un médecin, une date et une heure.");
      return;
    }
    setSaving(true);
    try {
      await api("/appointments", {
        method: "POST",
        body: JSON.stringify({
          doctor_id: activeDoctorId,
          scheduled_at: `${date}T${time}:00`,
          reason: reason || null,
        }),
      });
      close();
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Impossible d'enregistrer le rendez-vous.");
    } finally {
      setSaving(false);
    }
  }

  const now = new Date();
  const when = (a: any) => parseLocal(String(a.scheduled_at ?? a.date ?? a.created_at));
  const withDate = appointments.filter((a) => a.scheduled_at ?? a.date ?? a.created_at);
  const upcoming = withDate.filter((a) => when(a) >= now && a.status !== "cancelled").sort((a, b) => when(a).getTime() - when(b).getTime());
  const past = withDate.filter((a) => when(a) < now || a.status === "cancelled").sort((a, b) => when(b).getTime() - when(a).getTime());

  const takenTimes = new Set(
    appointments
      .filter((a) => a.doctor_id === activeDoctorId && a.status !== "cancelled" && toISODate(when(a)) === date)
      .map((a) => clock(String(a.scheduled_at)))
  );
  const freeSet = new Set(slots.map((s) => s.slice(0, 5)));
  const grid = workingHours.length > 0
    ? workingHours.map((s) => s.slice(0, 5))
    : Array.from(new Set([...freeSet, ...takenTimes])).sort();

  function row(item: any, i: number) {
    const iso = String(item.scheduled_at ?? item.date ?? item.created_at);
    const d = parseLocal(iso);
    return (
      <div className="ml-item" key={item.id ?? `appointment-${i}`}>
        <div className="ml-datebox">
          <b>{d.getDate()}</b>
          <span>{new Intl.DateTimeFormat("fr-FR", { month: "short" }).format(d)}</span>
        </div>
        <div style={{ flexGrow: 1, minWidth: 0 }}>
          <h3>{item.reason || "Consultation"}</h3>
          <p>{longDate(iso)} à {clock(iso)}</p>
        </div>
        {item.status && <span className={`ml-pill ml-pill-${item.status}`}>{STATUS_LABELS[item.status] ?? item.status}</span>}
      </div>
    );
  }

  return (
    <>
      <PatientShell
        active="/rendez-vous"
        status={error ? "error" : loading ? "loading" : "ready"}
        error={error}
        firstName={patient?.first_name}
        lastName={patient?.last_name}
        eyebrow="ESPACE PATIENT"
        title="Mes rendez-vous"
        subtitle={
          upcoming.length > 0
            ? `${upcoming.length} rendez-vous à venir · ${past.length} dans l'historique`
            : "Aucun rendez-vous à venir."
        }
        action={
          <button className="ml-btn ml-btn-primary" style={{ marginBottom: 4 }} onClick={() => setOpen(true)}>
            Prendre un rendez-vous
          </button>
        }
      >
        <article className="ml-card" style={{ marginBottom: 16 }}>
          <div className="ml-card-top"><h2>À venir</h2></div>
          {upcoming.length > 0 ? upcoming.map(row) : (
            <div className="ml-empty">
              <p>Vous n&apos;avez aucun rendez-vous prévu.</p>
              <button className="ml-btn ml-btn-primary" onClick={() => setOpen(true)}>Prendre un rendez-vous</button>
            </div>
          )}
        </article>

        <article className="ml-card">
          <div className="ml-card-top"><h2>Historique</h2></div>
          {past.length > 0 ? past.map(row) : (
            <div className="ml-empty"><p>Vos rendez-vous passés apparaîtront ici.</p></div>
          )}
        </article>
      </PatientShell>

      {open && (
        <div className="ml-overlay" onClick={close}>
          <form className="ml-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <h3 className="ml-modal-title">Prendre un rendez-vous</h3>

            <div style={{ marginBottom: 18 }}>
              <label className="ml-lab">Médecin</label>
              <select className="ml-field" value={doctorId} onChange={(e) => { setDoctorId(e.target.value); setTime(""); }}>
                {doctors.length === 0 && <option value="">Aucun médecin disponible</option>}
                {doctors.map((d) => (
                  <option key={d.id} value={d.id}>
                    Dr. {d.first_name} {d.last_name}{d.specialty ? ` — ${d.specialty}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label className="ml-lab">Date</label>
              <div className="ml-days">
                {Array.from({ length: 7 }, (_, i) => {
                  const d = new Date();
                  d.setDate(d.getDate() + i);
                  const iso = toISODate(d);
                  const { top, bottom } = dayChipLabel(d, i);
                  return (
                    <button
                      key={iso}
                      type="button"
                      className={`ml-day ${date === iso ? "ml-on" : ""}`}
                      onClick={() => { setDate(iso); setTime(""); }}
                    >
                      <span className="ml-day-top">{top}</span>
                      <span className="ml-day-num">{bottom}</span>
                    </button>
                  );
                })}
              </div>
              {date && (
                <p className="ml-echo">
                  {parseLocal(`${date}T12:00`).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                </p>
              )}
            </div>

            <div style={{ marginBottom: 18 }}>
              <label className="ml-lab">Heure</label>
              {!date ? (
                <p className="ml-hint">Choisissez d&apos;abord une date.</p>
              ) : slotsLoading ? (
                <p className="ml-hint">Lecture de l&apos;agenda…</p>
              ) : grid.length === 0 ? (
                <p className="ml-hint">Aucun créneau n&apos;est ouvert ce jour-là.</p>
              ) : (
                <div className="ml-slots">
                  {grid.map((hhmm) => {
                    const isPast = parseLocal(`${date}T${hhmm}`) < new Date();
                    const taken = takenTimes.has(hhmm) || !freeSet.has(hhmm);
                    return (
                      <button
                        key={hhmm}
                        type="button"
                        disabled={taken || isPast}
                        className={`ml-slot ${time === hhmm ? "ml-on" : ""}`}
                        onClick={() => setTime(hhmm)}
                      >
                        {hhmm}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="ml-lab">Motif</label>
              <input
                className="ml-field"
                placeholder="Consultation de suivi"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>

            {formError && <p className="ml-err">{formError}</p>}

            <div className="ml-modal-actions">
              <button type="button" className="ml-btn ml-btn-ghost" onClick={close}>Annuler</button>
              <button type="submit" className="ml-btn ml-btn-primary" disabled={saving}>
                {saving ? "Enregistrement…" : "Confirmer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
