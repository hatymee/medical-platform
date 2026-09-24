"use client";

import { useEffect, useState } from "react";
import { Search, Bell, ChevronDown } from "lucide-react";

interface Props {
  alertCount: number;
  onSearch: (query: string) => void;
  onAlerts: () => void;
  onProfile: () => void;
}

export default function SecretariatTopbar({ alertCount, onSearch, onAlerts, onProfile }: Props) {
  const [query, setQuery] = useState("");
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const day = now
    ? now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";
  const time = now ? now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "";

  return (
    <header className="tb">
      <form
        className="tb-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) onSearch(query.trim());
        }}
      >
        <Search size={18} />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher un patient par nom ou CIN"
          aria-label="Rechercher un patient"
        />
      </form>

      <div className="tb-right">
        <button className="tb-bell" onClick={onAlerts} aria-label={`Alertes (${alertCount})`}>
          <Bell size={21} />
          {alertCount > 0 && <span className="tb-badge">{alertCount > 9 ? "9+" : alertCount}</span>}
        </button>

        <div className="tb-sep" />

        <div className="tb-date">
          <span className="tb-day">{day.charAt(0).toUpperCase() + day.slice(1)}</span>
          <span className="tb-time">{time}</span>
        </div>

        <button className="tb-me" onClick={onProfile} aria-label="Paramètres du compte">
          <span className="tb-avatar">S</span>
          <ChevronDown size={16} />
        </button>
      </div>

      <style jsx global>{`
        .tb {
          position: sticky; top: 0; z-index: 50;
          display: flex; align-items: center; justify-content: space-between; gap: 24px;
          padding: 14px 32px;
          background: rgba(255, 255, 255, 0.92);
          backdrop-filter: blur(8px);
          border-bottom: 1px solid #e1eaf3;
        }
        .tb-search {
          position: relative; flex: 1; max-width: 640px;
        }
        .tb-search svg { position: absolute; left: 16px; top: 50%; transform: translateY(-50%); color: #5a7590; pointer-events: none; }
        .tb-search input {
          width: 100%; box-sizing: border-box; padding: 12px 16px 12px 46px;
          font: inherit; font-size: 14px; color: #0a2540;
          background: #f5f9fd; border: 1px solid #e1eaf3; border-radius: 12px;
          transition: border-color 0.16s ease, box-shadow 0.16s ease, background-color 0.16s ease;
        }
        .tb-search input:focus { outline: none; background: #fff; border-color: #1877e0; box-shadow: 0 0 0 4px rgba(24, 119, 224, 0.14); }

        .tb-right { display: flex; align-items: center; gap: 18px; flex-shrink: 0; }
        .tb-bell {
          position: relative; width: 42px; height: 42px; border-radius: 12px;
          display: flex; align-items: center; justify-content: center;
          border: none; background: none; color: #0a2540; cursor: pointer;
        }
        .tb-bell:hover { background: #eaf3fd; color: #1877e0; }
        .tb-badge {
          position: absolute; top: 4px; right: 3px; min-width: 18px; height: 18px; padding: 0 5px; box-sizing: border-box;
          display: flex; align-items: center; justify-content: center;
          border-radius: 9px; border: 2px solid #fff; background: #e5484d; color: #fff;
          font-size: 10px; font-weight: 800;
        }
        .tb-sep { width: 1px; height: 32px; background: #e1eaf3; }
        .tb-date { display: flex; flex-direction: column; line-height: 1.35; min-width: 150px; }
        .tb-day { font-size: 13px; color: #5a7590; }
        .tb-time { font-size: 14px; font-weight: 700; color: #0a2540; font-variant-numeric: tabular-nums; }
        .tb-me {
          display: flex; align-items: center; gap: 6px; padding: 4px 6px 4px 4px;
          border: none; border-radius: 30px; background: none; color: #5a7590; cursor: pointer;
        }
        .tb-me:hover { background: #eaf3fd; }
        .tb-avatar {
          width: 40px; height: 40px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          background: #1877e0; color: #fff; font-weight: 800; font-size: 16px;
        }
        .tb-bell:focus-visible, .tb-me:focus-visible { outline: 3px solid rgba(24, 119, 224, 0.35); outline-offset: 2px; }

        @media (max-width: 900px) {
          .tb { padding: 12px 18px; gap: 12px; }
          .tb-date, .tb-sep { display: none; }
        }
      `}</style>
    </header>
  );
}
