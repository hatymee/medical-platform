"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import PatientShell from "@/components/PatientShell";
import { Plus, Stethoscope, UserRound, ShieldCheck } from "lucide-react";

const ADMIN_NAV = [{ href: "/admin", label: "Mon cabinet" }];

type Staff = {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  specialty?: string | null;
  is_active: boolean;
};

export default function AdminPage() {
  const router = useRouter();
  const [clinic, setClinic] = useState<any>(null);
  const [doctors, setDoctors] = useState<Staff[]>([]);
  const [secretaries, setSecretaries] = useState<Staff[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState<"doctor" | "secretary" | null>(null);
  const [form, setForm] = useState({ email: "", password: "", first_name: "", last_name: "", specialty: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const [manage, setManage] = useState<Staff | null>(null);
  const [manageForm, setManageForm] = useState({ email: "", password: "" });
  const [manageError, setManageError] = useState("");
  const [manageMsg, setManageMsg] = useState("");

  const load = useCallback(async () => {
    const [c, d, s] = await Promise.all([
      api<any>("/clinics/me").catch(() => null),
      api<Staff[]>("/staff/doctors").catch(() => []),
      api<Staff[]>("/secretaries").catch(() => []),
    ]);
    setClinic(c);
    setDoctors(d ?? []);
    setSecretaries(s ?? []);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!localStorage.getItem("medical_token")) { router.push("/connexion"); return; }
      if (localStorage.getItem("medical_role") !== "clinic_admin") {
        setError("Cet espace est réservé à l'administrateur du cabinet.");
        setLoading(false);
        return;
      }
    }
    load()
      .catch((err) => setError(err instanceof Error ? err.message : "Chargement impossible."))
      .finally(() => setLoading(false));
  }, [load, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    if (!form.email.trim() || form.password.length < 8 || !form.first_name.trim() || !form.last_name.trim()) {
      setFormError("Tous les champs sont requis, mot de passe de huit caractères minimum.");
      return;
    }
    setSaving(true);
    try {
      const body: any = {
        email: form.email.trim(),
        password: form.password,
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        clinic_id: clinic?.id ?? null,
      };
      if (open === "doctor") body.specialty = form.specialty.trim() || null;
      await api(open === "doctor" ? "/auth/register/doctor" : "/auth/register/secretary", {
        method: "POST",
        body: JSON.stringify(body),
      });
      setOpen(null);
      setForm({ email: "", password: "", first_name: "", last_name: "", specialty: "" });
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Création impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function saveEmail() {
    if (!manage || !manageForm.email.trim()) return;
    setManageError(""); setManageMsg("");
    try {
      await api(`/staff/${manage.user_id}`, {
        method: "PATCH",
        body: JSON.stringify({ email: manageForm.email.trim() }),
      });
      setManageMsg("Email mis à jour.");
      await load();
    } catch (err) {
      setManageError(err instanceof Error ? err.message : "Modification impossible.");
    }
  }

  async function resetPassword() {
    if (!manage || manageForm.password.length < 8) {
      setManageError("Huit caractères minimum.");
      return;
    }
    setManageError(""); setManageMsg("");
    try {
      await api(`/staff/${manage.user_id}`, {
        method: "PATCH",
        body: JSON.stringify({ reset_password: manageForm.password }),
      });
      setManageMsg("Mot de passe réinitialisé. Communiquez-le de vive voix.");
      setManageForm((f) => ({ ...f, password: "" }));
    } catch (err) {
      setManageError(err instanceof Error ? err.message : "Modification impossible.");
    }
  }

  async function toggleActive() {
    if (!manage) return;
    setManageError(""); setManageMsg("");
    try {
      await api(`/staff/${manage.user_id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !manage.is_active }),
      });
      setManage(null);
      await load();
    } catch (err) {
      setManageError(err instanceof Error ? err.message : "Modification impossible.");
    }
  }

  function openManage(s: Staff) {
    setManage(s);
    setManageForm({ email: s.email, password: "" });
    setManageError(""); setManageMsg("");
  }

  const activeCount = [...doctors, ...secretaries].filter((s) => s.is_active).length;
  const initialsOf = (s: Staff) => `${(s.first_name || "?")[0]}${(s.last_name || "")[0] ?? ""}`.toUpperCase();

  const staffTable = (list: Staff[], kind: "doctor" | "secretary") =>
    list.length === 0 ? (
      <div className="empty">
        {kind === "doctor" ? "Aucun médecin rattaché au cabinet." : "Aucun compte de secrétariat."}
      </div>
    ) : (
      <div className="tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>{kind === "doctor" ? "Médecin" : "Secrétaire"}</th>
              <th>Email</th>
              {kind === "doctor" && <th>Spécialité</th>}
              <th>Statut</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => (
              <tr key={s.id} className={s.is_active ? "" : "off"}>
                <td>
                  <div className="who">
                    <span className="avatar">{initialsOf(s)}</span>
                    <span className="name">{kind === "doctor" ? "Dr. " : ""}{s.first_name} {s.last_name}</span>
                  </div>
                </td>
                <td className="muted">{s.email}</td>
                {kind === "doctor" && <td>{s.specialty || <span className="muted">Médecine générale</span>}</td>}
                <td>
                  <span className={`pill ${s.is_active ? "pill-on" : ""}`}>{s.is_active ? "Actif" : "Désactivé"}</span>
                </td>
                <td style={{ textAlign: "right" }}>
                  <button className="btn ghost sm" onClick={() => openManage(s)}>Gérer</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );

  return (
    <PatientShell
      active="/admin"
      nav={ADMIN_NAV}
      home="/admin"
      roleLabel="Administrateur"
      eyebrow="ESPACE CABINET"
      status={error ? "error" : loading ? "loading" : "ready"}
      error={error}
      firstName={clinic?.name ?? "Cabinet"}
      lastName=""
      title={clinic?.name ?? "Mon cabinet"}
      subtitle={`${doctors.length} médecin(s) et ${secretaries.length} secrétaire(s) rattachés`}
    >
      <style jsx>{`
        .kpis { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; margin-bottom: 20px; }
        .kpi { display: flex; align-items: center; gap: 16px; padding: 18px 20px; background: #fff; border: 1px solid #e1eaf3; border-radius: 14px; }
        .kpi-ic { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .kpi-ic.blue { background: #eaf3fd; color: #1877e0; }
        .kpi-ic.green { background: #e3f5ea; color: #1a7f4b; }
        .kpi-ic.amber { background: #fbf0de; color: #a86a12; }
        .kpi-k { display: block; font-size: 13px; color: #5a7590; }
        .kpi-v { display: block; font-size: 24px; font-weight: 800; margin-top: 2px; }
        .card { background: #fff; border: 1px solid #e1eaf3; border-radius: 14px; overflow: hidden; margin-bottom: 18px; }
        .head { padding: 16px 22px; border-bottom: 1px solid #e1eaf3; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        h2 { display: flex; align-items: center; gap: 10px; font-size: 16px; font-weight: 700; margin: 0; }
        .tbl-wrap { overflow-x: auto; }
        .tbl { width: 100%; border-collapse: collapse; font-size: 14px; }
        .tbl th { text-align: left; padding: 12px 22px; font-size: 13px; font-weight: 500; color: #5a7590; background: #f7fafd; border-bottom: 1px solid #e1eaf3; white-space: nowrap; }
        .tbl td { padding: 12px 22px; border-bottom: 1px solid #e1eaf3; vertical-align: middle; white-space: nowrap; }
        .tbl tr:last-child td { border-bottom: none; }
        .tbl tr.off td { opacity: 0.55; }
        .who { display: flex; align-items: center; gap: 12px; }
        .avatar { width: 38px; height: 38px; border-radius: 50%; display: flex; align-items: center; justify-content: center; background: #eaf3fd; color: #1877e0; font-weight: 700; font-size: 13px; flex-shrink: 0; }
        .name { font-weight: 600; font-size: 15px; }
        .muted { color: #5a7590; }
        @media (max-width: 900px) { .kpis { grid-template-columns: 1fr; } }
        .empty { padding: 32px 24px; text-align: center; color: #5a7590; font-size: 14px; }
        .pill { padding: 4px 11px; border-radius: 7px; font-size: 12px; font-weight: 700; background: #eef2f6; color: #5a7590; }
        .btn { font: inherit; font-size: 14px; font-weight: 600; border-radius: 9px; cursor: pointer; padding: 11px 20px; border: 1px solid transparent; transition: transform 0.16s ease, background-color 0.18s ease; }
        .btn:hover { transform: translateY(-2px); }
        .primary { background: #1877e0; color: #fff; }
        .primary:hover { background: #0f5cbf; }
        .ghost { background: #fff; color: #0a2540; border-color: #e1eaf3; }
        .ghost:hover { border-color: #1877e0; color: #1877e0; }
        .danger { background: #fff; color: #cf3a3a; border-color: #e1eaf3; }
        .danger:hover { background: #fcebeb; border-color: #cf3a3a; }
        .sm { padding: 7px 14px; font-size: 13px; }
        .field { width: 100%; box-sizing: border-box; padding: 11px 14px; font: inherit; font-size: 14px; color: #0a2540; background: #fff; border: 1px solid #e1eaf3; border-radius: 9px; }
        .field:focus { outline: none; border-color: #1877e0; box-shadow: 0 0 0 4px rgba(24,119,224,0.14); }
        .lab { display: block; font-size: 13px; font-weight: 600; color: #5a7590; margin-bottom: 6px; }
        .overlay { position: fixed; inset: 0; z-index: 1000; padding: 24px; background: rgba(10,37,64,0.42); display: flex; align-items: center; justify-content: center; }
        .modal { background: #fff; border-radius: 18px; padding: 28px; width: 470px; max-width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 30px 70px rgba(10,37,64,0.28); }
        .modal-title { font-size: 20px; font-weight: 800; margin: 0 0 6px; }
        .modal-sub { font-size: 14px; color: #5a7590; margin: 0 0 22px; }
        .actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
        .err { color: #cf3a3a; font-size: 14px; font-weight: 600; margin: 16px 0 0; }
        .ok { color: #1a7f4b; font-size: 14px; font-weight: 600; margin: 16px 0 0; }
        .alert { background: #fcebeb; color: #cf3a3a; padding: 13px 18px; border-radius: 10px; font-size: 14px; font-weight: 600; }
        .block { padding-bottom: 20px; margin-bottom: 20px; border-bottom: 1px solid #e1eaf3; }

        .meta { font-size: 13px; color: #5a7590; margin-top: 2px; }
        .pill.pill-on { background: #e3f5ea; color: #1a7f4b; }
      `}</style>

      <div className="kpis">
        <div className="kpi">
          <span className="kpi-ic blue"><Stethoscope size={22} /></span>
          <span><span className="kpi-k">Médecins</span><span className="kpi-v">{doctors.length}</span></span>
        </div>
        <div className="kpi">
          <span className="kpi-ic amber"><UserRound size={22} /></span>
          <span><span className="kpi-k">Secrétaires</span><span className="kpi-v">{secretaries.length}</span></span>
        </div>
        <div className="kpi">
          <span className="kpi-ic green"><ShieldCheck size={22} /></span>
          <span><span className="kpi-k">Comptes actifs</span><span className="kpi-v">{activeCount}</span></span>
        </div>
      </div>

      <div className="card">
        <div className="head">
          <h2><Stethoscope size={20} color="#1877e0" /> Médecins</h2>
          <button className="btn primary sm" onClick={() => { setOpen("doctor"); setFormError(""); }}>
            <Plus size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />Ajouter un médecin
          </button>
        </div>
        {staffTable(doctors, "doctor")}
      </div>

      <div className="card">
        <div className="head">
          <h2><UserRound size={20} color="#1877e0" /> Secrétariat</h2>
          <button className="btn primary sm" onClick={() => { setOpen("secretary"); setFormError(""); }}>
            <Plus size={15} style={{ verticalAlign: "-2px", marginRight: 6 }} />Ajouter une secrétaire
          </button>
        </div>
        {staffTable(secretaries, "secretary")}
      </div>

      {open && (
        <div className="overlay" onClick={() => setOpen(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <h3 className="modal-title">{open === "doctor" ? "Nouveau médecin" : "Nouvelle secrétaire"}</h3>
            <p className="modal-sub">Le compte sera créé avec un mot de passe temporaire.</p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div>
                <label className="lab">Prénom</label>
                <input className="field" value={form.first_name} onChange={(e) => setForm((f) => ({ ...f, first_name: e.target.value }))} />
              </div>
              <div>
                <label className="lab">Nom</label>
                <input className="field" value={form.last_name} onChange={(e) => setForm((f) => ({ ...f, last_name: e.target.value }))} />
              </div>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="lab">Email professionnel</label>
              <input className="field" type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>

            <div style={{ marginBottom: 14 }}>
              <label className="lab">Mot de passe temporaire</label>
              <input className="field" type="text" value={form.password} onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))} />
            </div>

            {open === "doctor" && (
              <div>
                <label className="lab">Spécialité</label>
                <input className="field" placeholder="Médecine générale" value={form.specialty} onChange={(e) => setForm((f) => ({ ...f, specialty: e.target.value }))} />
              </div>
            )}

            {formError && <p className="err">{formError}</p>}

            <div className="actions">
              <button type="button" className="btn ghost" onClick={() => setOpen(null)}>Annuler</button>
              <button type="submit" className="btn primary" disabled={saving}>
                {saving ? "Création…" : "Créer le compte"}
              </button>
            </div>
          </form>
        </div>
      )}

      {manage && (
        <div className="overlay" onClick={() => setManage(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">{manage.first_name} {manage.last_name}</h3>
            <p className="modal-sub">{manage.specialty ? `Médecin · ${manage.specialty}` : "Compte professionnel"}</p>

            <div className="block">
              <label className="lab">Adresse email</label>
              <div style={{ display: "flex", gap: 10 }}>
                <input className="field" type="email" value={manageForm.email} onChange={(e) => setManageForm((f) => ({ ...f, email: e.target.value }))} />
                <button className="btn ghost sm" onClick={saveEmail} style={{ flexShrink: 0 }}>Enregistrer</button>
              </div>
            </div>

            <div className="block">
              <label className="lab">Réinitialiser le mot de passe</label>
              <div style={{ display: "flex", gap: 10 }}>
                <input className="field" type="text" placeholder="Nouveau mot de passe" value={manageForm.password} onChange={(e) => setManageForm((f) => ({ ...f, password: e.target.value }))} />
                <button className="btn ghost sm" onClick={resetPassword} style={{ flexShrink: 0 }}>Réinitialiser</button>
              </div>
              <p className="meta" style={{ marginTop: 8 }}>
                Communiquez-le de vive voix. La personne pourra le changer depuis ses paramètres.
              </p>
            </div>

            <div>
              <label className="lab">Accès à la plateforme</label>
              <p className="meta" style={{ marginBottom: 12 }}>
                {manage.is_active
                  ? "Le compte est actif. Le désactiver empêche la connexion sans rien supprimer : consultations, ordonnances et factures restent intactes."
                  : "Le compte est désactivé. La personne ne peut plus se connecter."}
              </p>
              <button className={`btn ${manage.is_active ? "danger" : "primary"} sm`} onClick={toggleActive}>
                {manage.is_active ? "Désactiver le compte" : "Réactiver le compte"}
              </button>
            </div>

            {manageError && <p className="err">{manageError}</p>}
            {manageMsg && <p className="ok">{manageMsg}</p>}

            <div className="actions">
              <button className="btn ghost" onClick={() => setManage(null)}>Fermer</button>
            </div>
          </div>
        </div>
      )}
    </PatientShell>
  );
}