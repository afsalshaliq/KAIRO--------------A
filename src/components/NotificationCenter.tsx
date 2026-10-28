import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/features/auth/AuthContext";
import { listNotifications, markAsRead, markAllAsRead } from "@/services/notifications";
import type { Notification } from "@/types/db";

export function NotificationCenter() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const unreadCount = notifications.filter((n) => !n.is_read).length;

  const load = async () => {
    if (!profile) return;
    setLoading(true);
    try {
      const data = await listNotifications(profile.id);
      setNotifications(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // load() is async and only sets state after awaiting — not a synchronous render cascade.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (profile) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMarkRead = async (id: string) => {
    await markAsRead(id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
    );
  };

  const handleMarkAllRead = async () => {
    if (!profile) return;
    await markAllAsRead(profile.id);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  };

  if (!profile) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen(!open)}
        className="relative flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border bg-surface/70 hover:bg-surface text-fg/80 hover:text-fg text-xs font-semibold transition focus:outline-none"
        aria-label="View notifications"
      >
        <span>Alerts</span>
        {unreadCount > 0 && (
          <span className="flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-accent text-[10px] font-bold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-fg/10 bg-bg shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
          <div className="flex items-center justify-between px-4 py-3 border-b border-fg/5 bg-surface/50">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm">Notifications</span>
              {unreadCount > 0 && (
                <span className="badge bg-accent-soft text-accent text-xs">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-accent hover:underline font-medium"
              >
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto divide-y divide-fg/5">
            {loading ? (
              <div className="p-4 text-center text-xs text-fg/50">Loading notifications…</div>
            ) : notifications.length === 0 ? (
              <div className="p-8 text-center text-sm text-fg/50">
                <p className="font-medium text-fg/80 text-xs uppercase tracking-wider mb-1">All Caught Up</p>
                <p className="text-xs text-muted">No notifications right now</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  className={`p-3.5 transition hover:bg-surface/60 ${
                    !n.is_read ? "bg-accent-soft/30" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium text-xs text-fg">{n.title}</p>
                    <span className="text-[10px] text-fg/40 whitespace-nowrap">
                      {new Date(n.created_at).toLocaleDateString([], {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <p className="text-xs text-fg/70 mt-1 leading-relaxed">{n.body}</p>
                  <div className="mt-2 flex items-center justify-between text-[11px]">
                    {n.link ? (
                      <Link
                        to={n.link}
                        onClick={() => {
                          handleMarkRead(n.id);
                          setOpen(false);
                        }}
                        className="text-accent font-medium hover:underline"
                      >
                        View details →
                      </Link>
                    ) : <span />}
                    {!n.is_read && (
                      <button
                        onClick={() => handleMarkRead(n.id)}
                        className="text-fg/50 hover:text-fg text-[11px]"
                      >
                        Mark read
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
