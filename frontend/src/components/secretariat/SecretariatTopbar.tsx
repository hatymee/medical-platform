"use client";

import { useEffect, useRef, useState } from "react";
import { Search, Bell, ChevronDown, Check, Inbox, CalendarDays, CalendarX, FileText, Receipt } from "lucide-react";
import { api } from "@/lib/api";

interface Props {
  alertCount: number;
  onSearch: (query: string) => void;
  onAlerts: () => void;
  onProfile: () => void;
  onNavigate?: (tab: string) => void;
}

type AppNotification = {
  id: string;
  type: string;
  title: string;
  message: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
};

const NOTIF_ICON: Record<string, typeof Bell> = {
  appointment_created: CalendarDays,
  appointment_confirmed: CalendarDays,
  appointment_cancelled: CalendarX,
  appointment_rescheduled: CalendarDays,
  document_added: FileText,
  invoice_created: Receipt,
  invoice_paid: Receipt,
};

function parseLocal(iso: string) {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(iso ?? "");
  if (!m) return new Date(iso);
  return new Date(+m[1], +m[2] - 1, +m[3], +(m[4] ?? 0), +(m[5] ?? 0));
}

function timeAgo(iso: string) {
  const d = parseLocal(iso);
  const diffMin = Math.max(0, Math.round((Date.now() - d.getTime()) / 60000));
  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  const diffH = Math.round(diffMin / 60);
  if (diffH < 24) return `il y a ${diffH} h`;
  const diffJ = Math.round(diffH / 24);
  if (diffJ < 7) return `il y a ${diffJ} j`;
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

export default function SecretariatTopbar({ alertCount, onSearch, onAlerts, onProfile, onNavigate }: Props) {
  const [query, setQuery] = useState("");
  const [now, setNow] = useState<Date | null>(null);
  const [unread, setUnread] = useState(0);
  const [notifs, setNotifs] = useState<AppNotification[] | null>(null);
  const [open, setOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const loadCount = () => {
      api<{ count: number }>("/notifications/unread-count")
        .then((r) => setUnread(r.count))
        .catch(() => {});
    };
    loadCount();
    const id = setInterval(loadCount, 30_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!open) return;
    function onClickOutside(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  function toggleNotifications() {
    const next = !open;
    setOpen(next);
    if (next) {
      api<AppNotification[]>("/notifications/mine?limit=10")
        .then(setNotifs)
        .catch(() => setNotifs([]));
    }
  }

  function openNotification(n: AppNotification) {
    if (!n.is_read) {
      api(`/notifications/${n.id}/read`, { method: "PATCH" }).catch(() => {});
      setUnread((u) => Math.max(0, u - 1));
      setNotifs((list) => list?.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)) ?? list);
    }
    setOpen(false);
    if (n.link && onNavigate) onNavigate(n.link);
  }

  function markAllRead() {
    api("/notifications/read-all", { method: "POST" }).catch(() => {});
    setUnread(0);
    setNotifs((list) => list?.map((x) => ({ ...x, is_read: true })) ?? list);
  }

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
          placeholder="Rechercher un patient, un rendez-vous, un dossier..."
          aria-label="Rechercher un patient"
        />
      </form>

      <div className="tb-right">
        <div className="tb-notif" ref={bellRef}>
          <button
            type="button"
            className="tb-bell"
            aria-label={`${unread} notification(s) non lue(s)`}
            aria-expanded={open}
            onClick={toggleNotifications}
          >
            <Bell size={21} />
            {unread > 0 && <span className="tb-badge">{unread > 9 ? "9+" : unread}</span>}
          </button>

          {open && (
            <div className="tb-notif-panel" role="menu">
              <div className="tb-notif-head">
                <span>Notifications</span>
                {notifs && notifs.some((n) => !n.is_read) && (
                  <button type="button" className="tb-notif-readall" onClick={markAllRead}>
                    <Check size={13} /> Tout marquer comme lu
                  </button>
                )}
              </div>

              {alertCount > 0 && (
                <button
                  type="button"
                  className="tb-notif-pin"
                  onClick={() => { setOpen(false); onAlerts(); }}
                >
                  <CalendarDays size={15} />
                  {alertCount} rendez-vous en attente de confirmation
                </button>
              )}

              <div className="tb-notif-list">
                {notifs === null ? (
                  <div className="tb-notif-empty">Chargement…</div>
                ) : notifs.length === 0 ? (
                  <div className="tb-notif-empty">
                    <Inbox size={22} />
                    <span>Aucune notification pour le moment.</span>
                  </div>
                ) : (
                  notifs.map((n) => {
                    const Icon = NOTIF_ICON[n.type] ?? Bell;
                    return (
                      <button
                        type="button"
                        key={n.id}
                        className={`tb-notif-item ${n.is_read ? "" : "unread"}`}
                        onClick={() => openNotification(n)}
                      >
                        <span className="tb-notif-ic"><Icon size={16} /></span>
                        <span className="tb-notif-body">
                          <span className="tb-notif-title">{n.title}</span>
                          {n.message && <span className="tb-notif-msg">{n.message}</span>}
                          <span className="tb-notif-time">{timeAgo(n.created_at)}</span>
                        </span>
                        {!n.is_read && <span className="tb-notif-dot" />}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

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

        .tb-notif { position: relative; }
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

        .tb-notif-panel {
          position: absolute; top: calc(100% + 14px); right: -6px; width: 360px; max-height: 460px;
          display: flex; flex-direction: column; overflow: hidden; z-index: 80;
          background: #fff; border: 1px solid #e1eaf3; border-radius: 14px;
          box-shadow: 0 20px 48px rgba(10, 37, 64, 0.16);
        }
        .tb-notif-head {
          display: flex; align-items: center; justify-content: space-between; gap: 10px;
          padding: 13px 16px; border-bottom: 1px solid #e1eaf3; font-size: 14px; font-weight: 700; color: #0a2540;
        }
        .tb-notif-readall {
          display: inline-flex; align-items: center; gap: 5px; border: none; background: none; cursor: pointer;
          font: inherit; font-size: 12px; font-weight: 600; color: #1877e0; padding: 0;
        }
        .tb-notif-readall:hover { text-decoration: underline; }
        .tb-notif-pin {
          display: flex; align-items: center; gap: 9px; width: 100%; padding: 11px 16px; border: none;
          border-bottom: 1px solid #e1eaf3; background: #eaf3fd; color: #0f5cbf; cursor: pointer;
          font: inherit; font-size: 12.5px; font-weight: 600; text-align: left;
        }
        .tb-notif-pin:hover { background: #dcedfc; }
        .tb-notif-list { overflow-y: auto; }
        .tb-notif-empty {
          display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 36px 20px;
          color: #5a7590; font-size: 13px; text-align: center;
        }
        .tb-notif-item {
          display: flex; align-items: flex-start; gap: 11px; width: 100%; padding: 12px 16px; border: none;
          border-bottom: 1px solid #f0f4f8; background: #fff; cursor: pointer; text-align: left; font: inherit;
        }
        .tb-notif-item:last-child { border-bottom: none; }
        .tb-notif-item:hover { background: #f7fafd; }
        .tb-notif-item.unread { background: #eaf3fd; }
        .tb-notif-item.unread:hover { background: #e0edfb; }
        .tb-notif-ic {
          width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0; margin-top: 1px;
          display: flex; align-items: center; justify-content: center; background: #eaf3fd; color: #1877e0;
        }
        .tb-notif-body { flex-grow: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
        .tb-notif-title { font-size: 13px; font-weight: 700; color: #0a2540; }
        .tb-notif-msg { font-size: 12.5px; color: #5a7590; line-height: 1.4; overflow-wrap: anywhere; }
        .tb-notif-time { font-size: 11px; color: #9db4cc; margin-top: 2px; }
        .tb-notif-dot { width: 8px; height: 8px; border-radius: 50%; background: #1877e0; flex-shrink: 0; margin-top: 6px; }

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
        @media (max-width: 500px) {
          .tb-notif-panel { position: fixed; top: 64px; right: 10px; left: 10px; width: auto; }
        }
      `}</style>
    </header>
  );
}
