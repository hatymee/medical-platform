"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Receipt, Tag, TrendingUp, Pencil, EyeOff, RotateCcw, Info, X, CircleCheck } from "lucide-react";
import { api } from "@/lib/api";
import PatientShell, { DOCTOR_NAV } from "@/components/PatientShell";

type Procedure = { id: string; doctor_id: string; label: string; price: number; is_active: boolean };

const money = (v: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "MAD", maximumFractionDigits: 0 }).format(Number(v ?? 0));

export default function DoctorTarifsPage() {
  const router = useRouter();
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
    if (!localStorage.getItem("medical_token")) {
      router.replace("/connexion");
      return;
    }
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
  }, [load, router]);

  function openForm(p?: Procedure) {
    setEditing(p ?? null);
    setForm(p ? { label: p.label, price: String(p.price) } : { label: "", price: "" });
    setFormError("");
    setOpen(true);
  }

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
        await api(`/procedures/${editing.id}`, { method: "PATCH", body: JSON.stringify({ label: form.label.trim(), price }) });
      } else {
        await api("/procedures", { method: "POST", body: JSON.stringify({ label: form.label.trim(), price }) });
      }
      setOpen(false);
      setEditing(null);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  }

  async function toggle(p: Procedure) {
    try {
      await api(`/procedures/${p.id}`, { method: "PATCH", body: JSON.stringify({ is_active: !p.is_active }) });
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Modification impossible.");
    }
  }

  const active = procedures.filter((p) => p.is_active).sort((a, b) => a.label.localeCompare(b.label));
  const inactive = procedures.filter((p) => !p.is_active);
  const prices = active.map((p) => Number(p.price));
  const avg = prices.length ? prices.reduce((s, v) => s + v, 0) / prices.length : 0;

  return (
    <>
      <PatientShell
        active="/doctor/tarifs"
        nav={DOCTOR_NAV}
        home="/doctor/dashboard"
        roleLabel="Médecin généraliste"
        status={error ? "error" : loading ? "loading" : "ready"}
        error={error}
        firstName={me?.first_name}
        lastName={me?.last_name}
        onSearch={(s) => router.push(s ? "/doctor/patients" : "/doctor/patients")}
        searchPlaceholder="Rechercher un patient, un rendez-vous, un dossier…"
      >
        <div className="pd dd">
          <div className="dd-hello-row">
            <div>
              <h1 className="pd-name pd-hello">Mes tarifs</h1>
              <p className="pd-sub" style={{ fontSize: 14 }}>Vos actes et leurs prix, utilisés par le secrétariat pour facturer.</p>
            </div>
            <button className="pd-btn pd-btn-primary" onClick={() => openForm()}><Plus size={16} /> Ajouter un acte</button>
          </div>

          <div className="dd-stats dd-stats-3" style={{ marginBottom: 18 }}>
            <div className="dd-stat">
              <span className="dd-stat-ic blue"><Tag size={20} /></span>
              <span className="dd-stat-body"><span className="dd-stat-k">Actes proposés</span><b>{active.length}</b><em>{inactive.length} retiré{inactive.length > 1 ? "s" : ""}</em></span>
            </div>
            <div className="dd-stat">
              <span className="dd-stat-ic green"><Receipt size={20} /></span>
              <span className="dd-stat-body"><span className="dd-stat-k">Tarif moyen</span><b>{money(avg)}</b><em>sur les actes proposés</em></span>
            </div>
            <div className="dd-stat">
              <span className="dd-stat-ic violet"><TrendingUp size={20} /></span>
              <span className="dd-stat-body"><span className="dd-stat-k">Fourchette</span><b>{prices.length ? `${money(Math.min(...prices))} - ${money(Math.max(...prices))}` : "—"}</b><em>du moins cher au plus cher</em></span>
            </div>
          </div>

          <div className="dd-grid">
            <div className="pd-col">
              <section className="pd-card pd-sec">
                <div className="pd-sec-head"><h2><Tag size={20} /> Actes proposés</h2></div>
                {active.length === 0 ? (
                  <div className="pd-empty">
                    Aucun acte défini. Ajoutez vos actes courants avec leur tarif : la secrétaire pourra facturer sans vous demander les montants.
                    <div style={{ marginTop: 12 }}><button className="pd-btn pd-btn-primary pd-btn-sm" onClick={() => openForm()}><Plus size={14} /> Ajouter le premier acte</button></div>
                  </div>
                ) : (
                  <div className="pd-scroll">
                    <table className="pd-table">
                      <thead><tr><th>Acte</th><th>Tarif</th><th>Statut</th><th className="pd-right">Actions</th></tr></thead>
                      <tbody>
                        {active.map((p) => (
                          <tr key={p.id}>
                            <td><div className="pd-docname"><span className="pd-ic blue"><Tag size={16} /></span><span className="pd-strong">{p.label}</span></div></td>
                            <td className="pd-strong pd-nowrap">{money(p.price)}</td>
                            <td><span className="pd-pill green">Proposé</span></td>
                            <td>
                              <div className="pd-actions">
                                <button className="pd-icon-btn" title="Modifier" aria-label="Modifier" onClick={() => openForm(p)}><Pencil size={15} /></button>
                                <button className="pd-icon-btn" title="Retirer" aria-label="Retirer" onClick={() => toggle(p)}><EyeOff size={15} /></button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {inactive.length > 0 && (
                <section className="pd-card pd-sec">
                  <div className="pd-sec-head"><h2><EyeOff size={20} /> Actes retirés</h2><span className="pd-sub">conservés pour les anciennes factures</span></div>
                  <div className="pd-scroll">
                    <table className="pd-table">
                      <tbody>
                        {inactive.map((p) => (
                          <tr key={p.id} style={{ opacity: 0.65 }}>
                            <td className="pd-strong">{p.label}</td>
                            <td className="pd-nowrap">{money(p.price)}</td>
                            <td><span className="pd-pill grey">Retiré</span></td>
                            <td className="pd-right"><button className="pd-btn pd-btn-ghost pd-btn-sm" onClick={() => toggle(p)}><RotateCcw size={14} /> Remettre</button></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>

            <div className="pd-col">
              <section className="pd-card pd-sec">
                <div className="pd-sec-head"><h2><Info size={20} /> Comment ça marche</h2></div>
                <ul className="pd-tips">
                  <li><CircleCheck size={16} /> Chaque acte proposé apparaît dans la liste du secrétariat lors de la création d&apos;une facture.</li>
                  <li><CircleCheck size={16} /> Le tarif est prérempli, mais reste modifiable au cas par cas.</li>
                  <li><CircleCheck size={16} /> Modifier un tarif ne change pas les factures déjà émises.</li>
                  <li><CircleCheck size={16} /> Un acte retiré n&apos;est plus proposé, mais reste dans l&apos;historique.</li>
                </ul>
              </section>
            </div>
          </div>
        </div>
      </PatientShell>

      {open && (
        <div className="pd-overlay" onClick={() => setOpen(false)}>
          <form className="pd-modal" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
            <div className="pd-modal-head">
              <h3>{editing ? "Modifier l'acte" : "Nouvel acte"}</h3>
              <button type="button" className="pd-icon-btn" aria-label="Fermer" onClick={() => setOpen(false)}><X size={16} /></button>
            </div>
            <div className="pd-form">
              <label className="pd-full">Libellé<input autoFocus placeholder="Consultation générale" value={form.label} onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))} /></label>
              <label className="pd-full">Tarif (MAD)<input inputMode="decimal" placeholder="300" value={form.price} onChange={(e) => setForm((f) => ({ ...f, price: e.target.value }))} /></label>
            </div>
            {editing && <p className="pd-hint">Les factures déjà émises gardent leur montant d&apos;origine.</p>}
            {formError && <p className="pd-err">{formError}</p>}
            <div className="pd-modal-actions">
              <button type="button" className="pd-btn pd-btn-ghost" onClick={() => setOpen(false)}>Annuler</button>
              <button type="submit" className="pd-btn pd-btn-primary" disabled={saving}>{saving ? "Enregistrement…" : "Enregistrer"}</button>
            </div>
          </form>
        </div>
      )}
    </>
  );
}
