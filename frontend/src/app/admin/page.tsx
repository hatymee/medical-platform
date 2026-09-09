"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type Staff = {
  id: string;
  first_name: string;
  last_name: string;
  email?: string;
  specialty?: string | null;
};

export default function AdminPage() {
  const router = useRouter();
  const [clinic, setClinic] = useState<any>(null);
  const [doctors, setDoctors] = useState<Staff[]>([]);
  const [secretaries, setSecretaries] = useState<Staff[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState<"doctor" | "secretary" | null>(null);
  const [form, setForm] = useState({
    email: "", password: "", first_name: "", last_name: "", specialty: "",
  });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const [c, d, s] = await Promise.all([
      api<any>("/clinics/me").catch(() => null),
      api<Staff[]>("/doctors").catch(() => []),
      api<Staff[]>("/secretaries").catch(() => []),
    ]);
    setClinic(c);
    setDoctors(d ?? []);
    setSecretaries(s ?? []);
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (!localStorage.getItem("medical_token")) {
        router.push("/connexion");
        return;
      }
      if (localStorage.getItem("medical_role") !== "clinic_admin") {
        setError("Cet espace est réservé à l'administrateur du cabinet.");
        setLoading(false);
        return;
      }
    }
    load().catch((err) => {
      setError(err instanceof Error ? err.message : "Chargement impossible.");
    }).finally(() => setLoading(false));
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

  function logout() {
    localStorage.clear();
    router.push("/connexion");
  }

  return (
    <div className="wrap">
      <style jsx>{`
        .wrap {
          min-height: 100vh;
          background: #f5f9fd;
          color: #0a2540;
          padding: 40px 32px 64px;
        }
        .inner { max-width: 980px; margin: 0 auto; }
        .top { display: flex; align-items: flex-end; justify-content: space-between; gap: 20px; margin-bottom: 32px; }
        .kicker { font-size: 12px; font-weight: 700; letter-spacing: 0.09em; color: #1877e0; margin: 0 0 8px; }
        h1 { font-size: 32px; font-weight: 800; letter-spacing: -0.025em; margin: 0 0 6px; }
        .sub { font-size: 15px; color: #5a7590; margin: 0; }
        .card { background: #fff; border: 1px solid #e1eaf3; border-radius: 14px; overflow: hidden; margin-bottom: 20px; }
        .head { padding: 18px 24px; border-bottom: 1px solid #e1eaf3; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
        h2 { font-size: 17px; font-weight: 700; margin: 0; }
        .item { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 15px 24px; border-top: 1px solid #e1eaf3; }
        .item:first-of-type { border-top: none; }
        .name { font-weight: 700; font-size: 15px; }
        .meta { font-size: 13px; color: #5a7590; margin-top: 2px; }
        .empty { padding: 32px 24px; text-align: center; color: #5a7590; font-size: 14px; }
        .btn {
          font: inherit; font-size: 14px; font-weight: 600; border-radius: 9px;
          cursor: pointer; padding: 11px 20px; border: 1px solid transparent;
          transition: transform 0.16s ease, background-color 0.18s ease, box-shadow 0.2s ease;
        }
        .btn:hover { transform: translateY(-2px); }
        .primary { background: #1877e0; color: #fff; box-shadow: 0 2px 6px rgba(24,119,224,0.28); }
        .primary:hover { background: #0f5cbf; }
        .ghost { background: #fff; color: #0a2540; border-color: #e1eaf3; }
        .ghost:hover { border-color: #1877e0; color: #1877e0; }
        .sm { padding: 7px 14px; font-size: 13px; }
        .field {
          width: 100%; box-sizing: border-box; padding: 11px 14px;
          font: inherit; font-size: 14px; color: #0a2540; background: #fff;
          border: 1px solid #e1eaf3; border-radius: 9px;
        }
        .field:focus { outline: none; border-color: #1877e0; box-shadow: 0 0 0 4px rgba(24,119,224,0.14); }
        .lab { display: block; font-size: 13px; font-weight: 600; color: #5a7590; margin-bottom: 6px; }
        .overlay {
          position: fixed; inset: 0; z-index: 1000; padding: 24px;
          background: rgba(10,37,64,0.42); display: flex; align-items: center; justify-content: center;
        }
        .modal {
          background: #fff; border-radius: 18px; padding: 28px;
          width: 470px; max-width: 100%; max-height: 90vh; overflow-y: auto;
          box-shadow: 0 30px 70px rgba(10,37,64,0.28);
        }
        .modal-title { font-size: 20px; font-weight: 800; margin: 0 0 20px; }
        .actions { display: flex; justify-content: flex-end; gap: 12px; margin-top: 24px; }
        .err { color: #cf3a3a; font-size: 14px; font-weight: 600; margin: 16px 0 0; }
        .alert { background: #fcebeb; color: #cf3a3a; padding: 13px 18px; border-radius: 10px; font-size: 14px; font-weight: 600; }
      `}</style>

      <div className="inner">
        <div className="top">
          <div>
            <p className="kicker">ADMINISTRATION DU CABINET</p>
            <h1>{clinic?.name ?? "Cabinet"}</h1>
            <p className="sub">
              {loading ? "Chargement…" : `${doctors.length} médecin(s) · ${secretaries.length} secrétaire(s)`}
            </p>
          </div>
          <button className="btn ghost" onClick={logout}>Se déconnecter</button>
        </div>

        {error && <div className="alert">{error}</div>}

        {!error && (
          <>
            <div className="card">
              <div className="head">
                <h2>Médecins</h2>
                <button className="btn primary sm" onClick={() => { setOpen("doctor"); setFormError(""); }}>
                  Ajouter un médecin
                </button>
              </div>
              {doctors.length === 0 ? (
                <div className="empty">Aucun médecin rattaché au cabinet.</div>
              ) : (
                doctors.map((d) => (
                  <div className="item" key={d.id}>
                    <div>
                      <div className="name">Dr. {d.first_name} {d.last_name}</div>
                      {d.specialty && <div className="meta">{d.specialty}</div>}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="card">
              <div className="head">
                <h2>Secrétariat</h2>
                <button className="btn primary sm" onClick={() => { setOpen("secretary"); setFormError(""); }}>
                  Ajouter une secrétaire
                </button>
              </div>
              {secretaries.length === 0 ? (
                <div className="empty">Aucun compte de secrétariat.</div>
              ) : (
                secretaries.map((s) => (
                  <div className="item" key={s.id}>
                    <div>
                      <div className="name">{s.first_name} {s.last_name}</div>
                      {s.email && <div className="meta">{s.email}</div>}
                    </div>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>

      {open && (
        <div className="overlay" onClick={() => setOpen(null)}>
          <form className="modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <h3 className="modal-title">
              {open === "doctor" ? "Nouveau médecin" : "Nouvelle secrétaire"}
            </h3>

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
              <p className="meta" style={{ marginTop: 6 }}>
                Huit caractères minimum. À communiquer de vive voix.
              </p>
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
    </div>
  );
}