"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import PatientShell, { DOCTOR_NAV } from "@/components/PatientShell";

type Procedure = {
  id: string;
  doctor_id: string;
  label: string;
  price: number;
  is_active: boolean;
};

const money = (v: number) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(v);

export default function DoctorTarifsPage() {
  const [me, setMe] = useState<any>(null);
  const [procedures, setProcedures] = useState<Procedure[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Procedure | null>(null);
  const [form, setForm] = useState({ label: "", price: "" });
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setProcedures((await api<Procedure[]>("/procedures?include_inactive=true").catch(() => [])) ?? []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setMe(await api<any>("/doctors/me").catch(() => null));
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de charger vos tarifs.");
      } finally {
        setLoading(false);
      }
    })();
  }, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setFormError("");
    const price = parseFloat(form.price.replace(",", "."));
    if (!form.label.trim() || isNaN(price) || price < 0) {
      setFormError("Un libellé et un tarif valide sont requis.");
      return;
    }
    setSaving(true);
    try {
      if (editing) {
        await api(`/procedures/${editing.id}`, {
          method: "PATCH",
          body: JSON.stringify({ label: form.label.trim(), price }),
        });
      } else {
        await api("/procedures", {
          method: "POST",
          body: JSON.stringify({ label: form.label.trim(), price }),
        });
      }
      setOpen(false);
      setEditing(null);
      setForm({ label: "", price: "" });
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(p: Procedure) {
    try {
      await api(`/procedures/${p.id}`, {
        method: "PATCH",
        body: JSON.stringify({ is_active: !p.is_active }),
      });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Modification impossible.");
    }
  }

  const active = procedures.filter((p) => p.is_active);
  const inactive = procedures.filter((p) => !p.is_active);

  return (
    <>
      <PatientShell
        active="/doctor/tarifs"
        nav={DOCTOR_NAV}
        home="/doctor/dashboard"
        roleLabel="Médecin"
        status={error ? "error" : loading ? "loading" : "ready"}
        error={error}
        firstName={me?.first_name}
        lastName={me?.last_name}
        eyebrow="ESPACE MÉDECIN"
        title="Mes tarifs"
        subtitle={
          active.length > 0
            ? `${active.length} acte${active.length > 1 ? "s" : ""} proposé${active.length > 1 ? "s" : ""} au secrétariat`
            : "Définissez vos actes et leurs tarifs."
        }
        action={
          <button
            className="ml-btn ml-btn-primary"
            style={{ marginBottom: 4 }}
            onClick={() => { setEditing(null); setForm({ label: "", price: "" }); setFormError(""); setOpen(true); }}
          >
            Ajouter un acte
          </button>
        }
      >
        <article className="ml-card" style={{ marginBottom: 16 }}>
          <div className="ml-card-top"><h2>Actes proposés</h2></div>
          {active.length === 0 ? (
            <div className="ml-empty">
              <p>
                Aucun acte défini. Ajoutez vos actes courants avec leur tarif :
                la secrétaire pourra facturer sans vous demander les montants.
              </p>
              <button
                className="ml-btn ml-btn-primary"
                onClick={() => { setEditing(null); setForm({ label: "", price: "" }); setFormError(""); setOpen(true); }}
              >
                Ajouter le premier acte
              </button>
            </div>
          ) : (
            active.map((p) => (
              <div className="ml-item" key={p.id}>
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <h3>{p.label}</h3>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums" }}>
                  {money(p.price)}
                </span>
                <button
                  className="ml-btn ml-btn-ghost"
                  style={{ padding: "7px 14px", fontSize: 13 }}
                  onClick={() => {
                    setEditing(p);
                    setForm({ label: p.label, price: String(p.price) });
                    setFormError("");
                    setOpen(true);
                  }}
                >
                  Modifier
                </button>
                <button
                  className="ml-btn ml-btn-ghost"
                  style={{ padding: "7px 14px", fontSize: 13 }}
                  onClick={() => toggle(p)}
                >
                  Retirer
                </button>
              </div>
            ))
          )}
        </article>

        {inactive.length > 0 && (
          <article className="ml-card">
            <div className="ml-card-top">
              <h2>Actes retirés</h2>
              <span className="ml-stat-s">conservés pour les anciennes factures</span>
            </div>
            {inactive.map((p) => (
              <div className="ml-item" key={p.id} style={{ opacity: 0.6 }}>
                <div style={{ flexGrow: 1, minWidth: 0 }}>
                  <h3>{p.label}</h3>
                </div>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{money(p.price)}</span>
                <button
                  className="ml-btn ml-btn-ghost"
                  style={{ padding: "7px 14px", fontSize: 13 }}
                  onClick={() => toggle(p)}
                >
                  Remettre
                </button>
              </div>
            ))}
          </article>
        )}
      </PatientShell>

      {open && (
        <div className="ml-overlay" onClick={() => setOpen(false)}>
          <form className="ml-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <h3 className="ml-modal-title">{editing ? "Modifier l'acte" : "Nouvel acte"}</h3>

            <div style={{ marginBottom: 16 }}>
              <label className="ml-lab">Libellé</label>
              <input
                className="ml-field"
                autoFocus
                placeholder="Pose de couronne"
                value={form.label}
                onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              />
            </div>

            <div>
              <label className="ml-lab">Tarif (MAD)</label>
              <input
                className="ml-field"
                inputMode="decimal"
                placeholder="1500"
                value={form.price}
                onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))}
              />
              {editing && (
                <p className="ml-hint" style={{ marginTop: 6 }}>
                  Les factures déjà émises gardent leur montant d&apos;origine.
                </p>
              )}
            </div>

            {formError && <p className="ml-err">{formError}</p>}

            <div className="ml-modal-actions">
              <button type="button" className="ml-btn ml-btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
              <button type="submit" className="ml-btn ml-btn-primary" disabled={saving}>
                {saving ? "Enregistrement…" : "Enregistrer"}
              </button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}