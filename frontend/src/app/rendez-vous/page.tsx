"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarDays, CalendarPlus, Clock, Stethoscope, Info, X, ChevronRight, CircleCheck, History, CircleX, ShieldCheck,
} from "lucide-react";
import { api } from "@/lib/api";
import PatientShell, { parseLocal, clock } from "@/components/PatientShell";

type Filter = "upcoming" | "past" | "cancelled" | "all";

const APT: Record<string, { label: string; tone: string }> = {
  scheduled: { label: "Programmé", tone: "blue" },
  confirmed: { label: "Confirmé", tone: "green" },
  completed: { label: "Terminé", tone: "green" },
  cancelled: { label: "Annulé", tone: "grey" },
  no_show: { label: "Absence", tone: "red" },
};

function toISODate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function dayChipLabel(d: Date, offset: number) {
  if (offset === 0) return { top: "Auj.", bottom: String(d.getDate()) };
  if (offset === 1) return { top: "Dem.", bottom: String(d.getDate()) };
  return { top: d.toLocaleDateString("fr-FR", { weekday: "short" }).replace(".", ""), bottom: String(d.getDate()) };
}

const fLong = (iso: string) => parseLocal(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });

export default function RendezVousPage() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<any[]>([]);
  const [doctors, setDoctors] = useState<any[]>([]);
  const [patient, setPatient] = useState<any>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("upcoming");
  const [detail, setDetail] = useState<any>(null);
  const [booked, setBooked] = useState("");

  const [open, setOpen] = useState(false);
  const [doctorId, setDoctorId] = useState("");
  const [date, setDate] = useState("");
  const [customDate, setCustomDate] = useState(false);
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

  function openBooking(presetDoctor?: string) {
    setDoctorId(presetDoctor ?? "");
    setDate(""); setTime(""); setReason(""); setCustomDate(false);
    setFormError(""); setBooked("");
    setOpen(true);
  }

  function close() {
    setOpen(false);
    setDoctorId(""); setDate(""); setTime(""); setReason(""); setCustomDate(false);
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
        body: JSON.stringify({ doctor_id: activeDoctorId, scheduled_at: `${date}T${time}:00`, reason: reason || null }),
      });
      const summary = `${fLong(`${date}T${time}`)} à ${time}`;
      close();
      await load();
      setFilter("upcoming");
      setBooked(summary);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Impossible d'enregistrer le rendez-vous.");
    } finally {
      setSaving(false);
    }
  }

  const doctorName = (id?: string) => {
    const d = doctors.find((x) => x.id === id);
    return d ? `Dr. ${d.first_name} ${d.last_name}` : "Votre médecin";
  };
  const doctorSpec = (id?: string) => doctors.find((x) => x.id === id)?.specialty || "Médecine générale";

  const now = new Date();
  const when = (a: any) => parseLocal(String(a.scheduled_at));
  const dated = appointments.filter((a) => a.scheduled_at);
  const upcoming = dated.filter((a) => when(a) >= now && a.status !== "cancelled").sort((a, b) => when(a).getTime() - when(b).getTime());
  const past = dated.filter((a) => when(a) < now && a.status !== "cancelled").sort((a, b) => when(b).getTime() - when(a).getTime());
  const cancelled = dated.filter((a) => a.status === "cancelled").sort((a, b) => when(b).getTime() - when(a).getTime());
  const all = [...dated].sort((a, b) => when(b).getTime() - when(a).getTime());
  const FILTERS: { id: Filter; label: string; list: any[] }[] = [
    { id: "upcoming", label: "À venir", list: upcoming },
    { id: "past", label: "Historique", list: past },
    { id: "cancelled", label: "Annulés", list: cancelled },
    { id: "all", label: "Tous", list: all },
  ];
  const list = FILTERS.find((f) => f.id === filter)?.list ?? all;
  const next = upcoming[0];

  const takenTimes = new Set(
    appointments
      .filter((a) => a.doctor_id === activeDoctorId && a.status !== "cancelled" && toISODate(when(a)) === date)
      .map((a) => clock(String(a.scheduled_at)))
  );
  const freeSet = new Set(slots.map((s) => s.slice(0, 5)));
  const grid = workingHours.length > 0 ? workingHours.map((s) => s.slice(0, 5)) : Array.from(new Set([...freeSet, ...takenTimes])).sort();
  const freeCount = grid.filter((h) => !(takenTimes.has(h) || !freeSet.has(h)) && parseLocal(`${date}T${h}`) >= new Date()).length;

  const pill = (status: string) => {
    const s = APT[status] ?? { label: status, tone: "grey" };
    return <span className={`pd-pill ${s.tone}`}>{s.label}</span>;
  };

  return (
    <>
      <PatientShell
        active="/rendez-vous"
        status={error ? "error" : loading ? "loading" : "ready"}
        error={error}
        firstName={patient?.first_name}
        lastName={patient?.last_name}
        onSearch={() => setFilter("all")}
        searchPlaceholder="Rechercher un médecin, un rendez-vous, un document…"
        notifCount={upcoming.length}
      >
        <div className="pd">
          <div className="pd-grid">
            <div className="pd-col">
              <section className="pd-card pd-headcard">
                <div className="pd-head">
                  <div className="pd-id">
                    <h1 className="pd-name pd-hello">Mes rendez-vous</h1>
                    <p className="pd-lead">
                      {upcoming.length > 0
                        ? <>Vous avez <b>{upcoming.length} rendez-vous à venir</b> et {past.length} dans votre historique.</>
                        : "Vous n'avez aucun rendez-vous prévu. Réservez un créneau en quelques secondes."}
                    </p>
                    <div className="pd-head-btns pd-head-btns-left">
                      <button className="pd-btn pd-btn-primary" onClick={() => openBooking()}><CalendarPlus size={16} /> Prendre un rendez-vous</button>
                    </div>
                  </div>
                  <div className="pd-side">
                    {next ? (
                      <div className="pd-nextbig">
                        <span className="pd-nextbig-k">Prochain rendez-vous</span>
                        <div className="pd-nextbig-row">
                          <div className="pd-datebox">
                            <b>{when(next).getDate()}</b>
                            <span>{when(next).toLocaleDateString("fr-FR", { month: "short" })}</span>
                            <small>{when(next).getFullYear()}</small>
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div className="pd-strong">{next.reason || "Consultation"}</div>
                            <div className="pd-sub"><Clock size={13} /> {clock(String(next.scheduled_at))}, {doctorName(next.doctor_id)}</div>
                            <div style={{ marginTop: 6 }}>{pill(next.status)}</div>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="pd-care">
                        <span className="pd-care-ic"><CalendarDays size={20} /></span>
                        <div>
                          <b>Aucun rendez-vous prévu</b>
                          <p>Choisissez un médecin, un jour et un créneau libre.</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </section>

              {booked && (
                <div className="pd-success">
                  <CircleCheck size={20} />
                  <span>Votre rendez-vous du <b>{booked}</b> est enregistré. Le secrétariat le confirmera prochainement.</span>
                  <button className="pd-icon-btn" aria-label="Fermer" onClick={() => setBooked("")}><X size={15} /></button>
                </div>
              )}

              <div className="pd-stats pd-stats-3">
                <button className={`pd-stat blue ${filter === "upcoming" ? "sel" : ""}`} onClick={() => setFilter("upcoming")}>
                  <span className="pd-stat-ic"><CalendarDays size={20} /></span>
                  <b>{upcoming.length}</b>
                  <span>Rendez-vous à venir</span>
                </button>
                <button className={`pd-stat green ${filter === "past" ? "sel" : ""}`} onClick={() => setFilter("past")}>
                  <span className="pd-stat-ic"><History size={20} /></span>
                  <b>{past.length}</b>
                  <span>Rendez-vous passés</span>
                </button>
                <button className={`pd-stat orange ${filter === "cancelled" ? "sel" : ""}`} onClick={() => setFilter("cancelled")}>
                  <span className="pd-stat-ic"><CircleX size={20} /></span>
                  <b>{cancelled.length}</b>
                  <span>Rendez-vous annulés</span>
                </button>
              </div>

              <section className="pd-card pd-sec">
                <div className="pd-sec-head">
                  <h2><CalendarDays size={22} /> Liste de mes rendez-vous</h2>
                </div>
                <div className="pd-toolbar">
                  <div className="pd-chips">
                    {FILTERS.map((f) => (
                      <button key={f.id} className={`pd-chip ${filter === f.id ? "on" : ""}`} onClick={() => setFilter(f.id)}>
                        {f.label} <em>{f.list.length}</em>
                      </button>
                    ))}
                  </div>
                </div>
                {list.length === 0 ? (
                  <div className="pd-empty">
                    {filter === "upcoming" ? (
                      <>Aucun rendez-vous à venir. <button className="pd-link" onClick={() => openBooking()}>Prendre un rendez-vous</button></>
                    ) : "Aucun rendez-vous dans cette catégorie."}
                  </div>
                ) : (
                  <div className="pd-scroll">
                    <table className="pd-table">
                      <thead><tr><th>Date &amp; Heure</th><th>Motif</th><th>Médecin</th><th>Statut</th><th className="pd-right">Actions</th></tr></thead>
                      <tbody>
                        {list.map((a) => (
                          <tr key={a.id} className="pd-click" onClick={() => setDetail(a)}>
                            <td>
                              <div className="pd-docname">
                                <div className="pd-datebox pd-datebox-sm">
                                  <b>{when(a).getDate()}</b>
                                  <span>{when(a).toLocaleDateString("fr-FR", { month: "short" })}</span>
                                </div>
                                <div>
                                  <div className="pd-strong">{when(a).toLocaleDateString("fr-FR", { weekday: "long" })}</div>
                                  <div className="pd-sub">{clock(String(a.scheduled_at))}</div>
                                </div>
                              </div>
                            </td>
                            <td>{a.reason || "Consultation"}</td>
                            <td>
                              <div className="pd-strong">{doctorName(a.doctor_id)}</div>
                              <div className="pd-sub">{doctorSpec(a.doctor_id)}</div>
                            </td>
                            <td>{pill(a.status)}</td>
                            <td className="pd-right">
                              <button className="pd-btn pd-btn-ghost pd-btn-sm" onClick={(e) => { e.stopPropagation(); setDetail(a); }}>Voir le détail</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            </div>

            <div className="pd-col">
              <section className="pd-card pd-sec">
                <div className="pd-sec-head"><h2><Stethoscope size={22} /> Nos médecins</h2></div>
                {doctors.length === 0 ? (
                  <div className="pd-empty">Aucun médecin disponible pour le moment.</div>
                ) : (
                  doctors.map((d) => (
                    <div className="pd-row" key={d.id}>
                      <span className="pd-docavatar">{(d.first_name?.[0] ?? "").toUpperCase()}{(d.last_name?.[0] ?? "").toUpperCase()}</span>
                      <div style={{ flexGrow: 1, minWidth: 0 }}>
                        <div className="pd-strong">Dr. {d.first_name} {d.last_name}</div>
                        <div className="pd-sub">{d.specialty || "Médecine générale"}</div>
                      </div>
                      <button className="pd-btn pd-btn-ghost pd-btn-sm" onClick={() => openBooking(d.id)}>Réserver</button>
                    </div>
                  ))
                )}
              </section>

              <section className="pd-card pd-sec">
                <div className="pd-sec-head"><h2><Info size={22} /> Bon à savoir</h2></div>
                <ul className="pd-tips">
                  <li><CircleCheck size={16} /> Présentez-vous 10 minutes avant l&apos;heure du rendez-vous.</li>
                  <li><CircleCheck size={16} /> Apportez votre carte d&apos;identité et vos derniers résultats d&apos;analyses.</li>
                  <li><CircleCheck size={16} /> Pour annuler ou déplacer un rendez-vous, contactez le secrétariat du cabinet.</li>
                </ul>
              </section>

              <section className="pd-card pd-secure">
                <span className="pd-secure-ic"><ShieldCheck size={30} /></span>
                <div>
                  <b>Un espace personnel et sécurisé</b>
                  <p>Vos données de santé sont protégées conformément aux normes en vigueur.</p>
                </div>
              </section>
            </div>
          </div>
        </div>
      </PatientShell>

      {detail && (
        <div className="pd-overlay" onClick={() => setDetail(null)}>
          <div className="pd-modal" onClick={(e) => e.stopPropagation()}>
            <div className="pd-modal-head">
              <h3>Détail du rendez-vous</h3>
              <button type="button" className="pd-icon-btn" aria-label="Fermer" onClick={() => setDetail(null)}><X size={16} /></button>
            </div>
            <div className="pd-detail">
              <div className="pd-datebox">
                <b>{when(detail).getDate()}</b>
                <span>{when(detail).toLocaleDateString("fr-FR", { month: "short" })}</span>
                <small>{when(detail).getFullYear()}</small>
              </div>
              <div>
                <div className="pd-strong" style={{ fontSize: 16 }}>{detail.reason || "Consultation"}</div>
                <div className="pd-sub">{fLong(String(detail.scheduled_at))} à {clock(String(detail.scheduled_at))}</div>
                <div style={{ marginTop: 8 }}>{pill(detail.status)}</div>
              </div>
            </div>
            <dl className="pd-info" style={{ marginTop: 18 }}>
              <div className="pd-info-row">
                <span className="pd-info-ic"><Stethoscope size={18} /></span>
                <div><dt>Médecin</dt><dd>{doctorName(detail.doctor_id)}, {doctorSpec(detail.doctor_id)}</dd></div>
              </div>
              <div className="pd-info-row">
                <span className="pd-info-ic"><Clock size={18} /></span>
                <div><dt>Heure</dt><dd>{clock(String(detail.scheduled_at))}</dd></div>
              </div>
            </dl>
            <div className="pd-note"><Info size={16} /> Pour annuler ou déplacer ce rendez-vous, contactez le secrétariat du cabinet.</div>
            <div className="pd-modal-actions">
              <button className="pd-btn pd-btn-ghost" onClick={() => setDetail(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}

      {open && (
        <div className="pd-overlay" onClick={close}>
          <form className="pd-modal pd-modal-lg" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <div className="pd-modal-head">
              <h3>Prendre un rendez-vous</h3>
              <button type="button" className="pd-icon-btn" aria-label="Fermer" onClick={close}><X size={16} /></button>
            </div>

            <p className="pd-step">1. Choisissez votre médecin</p>
            <div className="pd-doc-pick">
              {doctors.length === 0 && <div className="pd-empty">Aucun médecin disponible.</div>}
              {doctors.map((d) => (
                <button
                  type="button"
                  key={d.id}
                  className={`pd-doc-opt ${activeDoctorId === d.id ? "on" : ""}`}
                  onClick={() => { setDoctorId(d.id); setTime(""); }}
                >
                  <span className="pd-docavatar">{(d.first_name?.[0] ?? "").toUpperCase()}{(d.last_name?.[0] ?? "").toUpperCase()}</span>
                  <span style={{ textAlign: "left", minWidth: 0 }}>
                    <b>Dr. {d.first_name} {d.last_name}</b>
                    <small>{d.specialty || "Médecine générale"}</small>
                  </span>
                </button>
              ))}
            </div>

            <p className="pd-step">2. Choisissez une date</p>
            <div className="pd-days">
              {Array.from({ length: 7 }, (_, i) => {
                const d = new Date();
                d.setDate(d.getDate() + i);
                const iso = toISODate(d);
                const { top, bottom } = dayChipLabel(d, i);
                return (
                  <button key={iso} type="button" className={`pd-day ${date === iso && !customDate ? "on" : ""}`} onClick={() => { setCustomDate(false); setDate(iso); setTime(""); }}>
                    <span>{top}</span>
                    <b>{bottom}</b>
                  </button>
                );
              })}
              <button type="button" className={`pd-day ${customDate ? "on" : ""}`} onClick={() => setCustomDate((v) => !v)}>
                <span>Autre</span>
                <b>…</b>
              </button>
            </div>
            {customDate && (
              <input className="pd-date-input" type="date" min={toISODate(new Date())} value={date} onChange={(e) => { setDate(e.target.value); setTime(""); }} />
            )}
            {date && <p className="pd-echo">{fLong(`${date}T12:00`)}</p>}

            <p className="pd-step">3. Choisissez un créneau</p>
            {!date ? (
              <p className="pd-hint">Choisissez d&apos;abord une date.</p>
            ) : slotsLoading ? (
              <p className="pd-hint">Lecture de l&apos;agenda…</p>
            ) : grid.length === 0 ? (
              <p className="pd-hint">Aucun créneau n&apos;est ouvert ce jour-là. Essayez un autre jour.</p>
            ) : (
              <>
                <div className="pd-slots">
                  {grid.map((hhmm) => {
                    const isPast = parseLocal(`${date}T${hhmm}`) < new Date();
                    const taken = takenTimes.has(hhmm) || !freeSet.has(hhmm);
                    return (
                      <button
                        key={hhmm}
                        type="button"
                        disabled={taken || isPast}
                        className={`pd-slot ${time === hhmm ? "on" : ""}`}
                        onClick={() => setTime(hhmm)}
                      >
                        {hhmm}
                      </button>
                    );
                  })}
                </div>
                <p className="pd-hint" style={{ marginTop: 8 }}>
                  {freeCount === 0 ? "Journée complète. Essayez un autre jour." : `${freeCount} créneau${freeCount > 1 ? "x" : ""} libre${freeCount > 1 ? "s" : ""}. Les créneaux grisés sont déjà pris.`}
                </p>
              </>
            )}

            <p className="pd-step">4. Motif (facultatif)</p>
            <input className="pd-date-input" style={{ width: "100%" }} placeholder="Consultation de suivi" value={reason} onChange={(e) => setReason(e.target.value)} />

            {formError && <p className="pd-err">{formError}</p>}

            <div className="pd-modal-actions">
              <button type="button" className="pd-btn pd-btn-ghost" onClick={close}>Annuler</button>
              <button type="submit" className="pd-btn pd-btn-primary" disabled={saving || !time}>
                <ChevronRight size={16} /> {saving ? "Enregistrement…" : "Confirmer le rendez-vous"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
