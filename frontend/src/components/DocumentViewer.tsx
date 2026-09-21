"use client";

import { useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";

type Doc = { id: string; title: string; file_url: string; category?: string };

export default function DocumentViewer({ doc, onClose }: { doc: Doc; onClose: () => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number } | null>(null);

  const isPdf = doc.file_url.toLowerCase().endsWith(".pdf");

  useEffect(() => {
    api<{ url: string }>(`/documents/${doc.id}/view`)
      .then((r) => setUrl(r.url))
      .catch((e) => setError(e instanceof Error ? e.message : "Ouverture impossible."));
  }, [doc.id]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const zoom = (delta: number) => setScale((s) => Math.min(6, Math.max(0.5, +(s + delta).toFixed(2))));
  const reset = () => { setScale(1); setOffset({ x: 0, y: 0 }); };

  const btn: React.CSSProperties = {
    border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.08)", color: "#fff",
    borderRadius: 8, padding: "8px 14px", fontSize: 14, fontWeight: 600, cursor: "pointer",
  };

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 2000, background: "rgba(5,15,30,0.92)", display: "flex", flexDirection: "column" }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 20px", color: "#fff" }}
      >
        <div style={{ flexGrow: 1, fontWeight: 700, fontSize: 16 }}>{doc.title}</div>
        {!isPdf && (
          <>
            <button style={btn} onClick={() => zoom(-0.25)}>−</button>
            <span style={{ minWidth: 52, textAlign: "center", fontSize: 14 }}>{Math.round(scale * 100)} %</span>
            <button style={btn} onClick={() => zoom(0.25)}>+</button>
            <button style={btn} onClick={reset}>Réinitialiser</button>
          </>
        )}
        {url && <a href={url} target="_blank" rel="noopener" style={{ ...btn, textDecoration: "none" }}>Nouvel onglet</a>}
        <button style={btn} onClick={onClose}>Fermer</button>
      </div>

      <div
        onClick={(e) => e.stopPropagation()}
        style={{ flexGrow: 1, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}
        onWheel={(e) => { if (!isPdf) zoom(e.deltaY < 0 ? 0.15 : -0.15); }}
      >
        {error && <p style={{ color: "#ff9b9b", fontWeight: 600 }}>{error}</p>}
        {!error && !url && <p style={{ color: "#9db4cc" }}>Chargement du document…</p>}

        {url && isPdf && (
          <iframe src={url} title={doc.title} style={{ width: "92%", height: "100%", border: "none", borderRadius: 8, background: "#fff" }} />
        )}

        {url && !isPdf && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={doc.title}
            draggable={false}
            onMouseDown={(e) => { drag.current = { x: e.clientX - offset.x, y: e.clientY - offset.y }; }}
            onMouseMove={(e) => { if (drag.current) setOffset({ x: e.clientX - drag.current.x, y: e.clientY - drag.current.y }); }}
            onMouseUp={() => { drag.current = null; }}
            onMouseLeave={() => { drag.current = null; }}
            onDoubleClick={reset}
            style={{
              maxWidth: "90%", maxHeight: "90%",
              transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
              transition: drag.current ? "none" : "transform 0.12s ease",
              cursor: scale > 1 ? "grab" : "zoom-in",
              userSelect: "none",
            }}
          />
        )}
      </div>
    </div>
  );
}