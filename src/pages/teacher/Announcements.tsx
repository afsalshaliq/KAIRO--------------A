import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useTenant } from "@/lib/tenant";
import { listAnnouncements } from "@/services/announcements";
import { Spinner, SearchBar, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import type { Announcement } from "@/types/db";

export default function TeacherAnnouncements() {
  const { profile } = useAuth();
  const { school } = useTenant();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (school && profile) {
      listAnnouncements({
        schoolId: school.id,
        isPublishedOnly: true,
        userRole: profile.role,
        department: profile.department,
      })
        .then((data) => setAnnouncements(data))
        .finally(() => setLoading(false));
    }
  }, [school, profile]);

  const filteredAnnouncements = useMemo(() => {
    if (!search.trim()) return announcements;
    const q = search.toLowerCase();
    return announcements.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        a.content.toLowerCase().includes(q) ||
        (a.publisher_name && a.publisher_name.toLowerCase().includes(q))
    );
  }, [announcements, search]);

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <PageHeader
        title="School Bulletins & Announcements"
        subtitle={`Official policy directives, term updates, and campus communications from ${school?.name || "the Principal's office"}.`}
        breadcrumbs={[{ label: "Teacher Portal", to: "/teacher/dashboard" }, { label: "Bulletins" }]}
        badge="Official Communications"
      />

      <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="w-full sm:w-80">
          <SearchBar
            value={search}
            onChange={setSearch}
            placeholder="Search bulletins by title or keyword…"
          />
        </div>
        <div className="text-xs text-muted font-medium">
          Showing {filteredAnnouncements.length} of {announcements.length} bulletins
        </div>
      </div>

      {loading ? (
        <div className="card p-12 flex justify-center">
          <Spinner label="Loading announcements…" />
        </div>
      ) : filteredAnnouncements.length === 0 ? (
        <EmptyState
          title={search ? "No matching announcements" : "No active bulletins"}
          description={
            search
              ? "No announcements matched your search criteria. Try a different query."
              : "No announcements published for your department at this time."
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredAnnouncements.map((a) => (
            <div
              key={a.id}
              className="card p-6 space-y-3 border border-border hover:border-accent/30 transition shadow-sm"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="font-bold text-lg text-fg">{a.title}</h2>
                  <span className="text-xs text-muted block mt-0.5">
                    From {a.publisher_name || "Principal's Office"} ·{" "}
                    {new Date(a.created_at).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="badge bg-indigo-50 text-indigo-700 text-[10px] font-semibold uppercase">
                    Audience: {a.audience.replace("_", " ")}
                  </span>
                </div>
              </div>

              <div className="bg-surface p-4 rounded-xl border border-border/50 text-sm text-fg leading-relaxed whitespace-pre-line">
                {a.content}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
