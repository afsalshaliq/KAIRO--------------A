import React, { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useTenant } from "@/lib/tenant";
import {
  listAnnouncements,
  createAnnouncement,
  publishAnnouncement,
} from "@/services/announcements";
import { useToast, Spinner, StatusBadge, EmptyState, SearchBar } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import type { Announcement, AnnouncementAudience } from "@/types/db";

export default function AdminAnnouncements() {
  const { profile } = useAuth();
  const { school } = useTenant();
  const toast = useToast();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [search, setSearch] = useState("");

  // Form state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [audience, setAudience] = useState<AnnouncementAudience>("all");
  const [department, setDepartment] = useState("");
  const [publishImmediately, setPublishImmediately] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Escape listener for create modal
  useEffect(() => {
    if (!modalOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setModalOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modalOpen]);

  const load = async () => {
    if (!school) return;
    try {
      const data = await listAnnouncements({ schoolId: school.id });
      setAnnouncements(data);
    } catch (e) {
      toast("error", (e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [school]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;
    if (!school || !profile) return;

    setSubmitting(true);
    try {
      await createAnnouncement({
        school_id: school.id,
        title,
        content,
        audience,
        target_department: audience === "department" ? department : null,
        publish_now: publishImmediately,
        published_by: profile.id,
      });

      toast(
        "success",
        publishImmediately
          ? "Announcement published to faculty."
          : "Announcement draft saved."
      );
      setModalOpen(false);
      setTitle("");
      setContent("");
      load();
    } catch (err) {
      toast("error", (err as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePublish = async (id: string) => {
    if (!school || !profile) return;
    try {
      await publishAnnouncement(id, school.id, profile.id);
      toast("success", "Announcement published.");
      load();
    } catch (e) {
      toast("error", (e as Error).message);
    }
  };

  const filteredAnnouncements = useMemo(() => {
    return announcements.filter((a) => {
      return (
        !search ||
        a.title.toLowerCase().includes(search.toLowerCase()) ||
        a.content.toLowerCase().includes(search.toLowerCase())
      );
    });
  }, [announcements, search]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <PageHeader
          title="Principal Bulletins & Announcements"
          subtitle={`Broadcast official communications to faculty and specific academic departments at ${school?.name || "your school"}.`}
        />
        <button
          onClick={() => setModalOpen(true)}
          className="btn-primary text-xs flex items-center gap-2 shrink-0 mb-6"
        >
          <span>+ Create Announcement</span>
        </button>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder="Search announcements…"
          className="max-w-sm w-full"
        />
      </div>

      {loading ? (
        <div className="card p-12 flex justify-center border-border">
          <Spinner label="Loading announcements…" />
        </div>
      ) : !announcements.length ? (
        <EmptyState
          title="No announcements published yet"
          hint="Create an announcement above to communicate school updates or term schedules to teachers."
          action={
            <button onClick={() => setModalOpen(true)} className="btn-primary text-xs">
              Create First Announcement
            </button>
          }
        />
      ) : !filteredAnnouncements.length ? (
        <EmptyState
          title="No matching announcements"
          hint="Try adjusting your search query."
          action={
            <button onClick={() => setSearch("")} className="btn-outline text-xs">
              Clear Search
            </button>
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredAnnouncements.map((a) => (
            <div
              key={a.id}
              className="card p-6 border-border hover:border-accent/40 hover:shadow-card-hover transition-all space-y-3"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base text-fg">{a.title}</h3>
                  <div className="text-xs text-muted mt-0.5">
                    Published by {a.publisher_name || "Principal"} ·{" "}
                    {new Date(a.created_at).toLocaleDateString([], {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="badge bg-purple-50 text-purple-700 border-purple-200 text-xs font-semibold">
                    Audience: {a.audience.replace("_", " ")}
                  </span>
                  {a.is_published ? (
                    <StatusBadge status="active" />
                  ) : (
                    <span className="badge bg-slate-100 text-slate-600 border border-slate-200">
                      Draft
                    </span>
                  )}
                  {!a.is_published && (
                    <button
                      onClick={() => handlePublish(a.id)}
                      className="btn-outline btn-sm text-xs"
                    >
                      Publish
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-surface/50 p-4 rounded-xl border border-border/60 text-xs text-fg leading-relaxed whitespace-pre-line">
                {a.content}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4 animate-fade-in-up"
          role="dialog"
          aria-modal="true"
          aria-labelledby="announcement-modal-title"
          onClick={() => setModalOpen(false)}
        >
          <div
            className="card w-full max-w-lg p-6 bg-card border border-border shadow-card-elevated relative max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="announcement-modal-title" className="text-lg font-bold text-fg">
                New Faculty Announcement
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="btn-outline text-xs px-2.5 py-1 font-semibold"
                aria-label="Close dialog"
              >
                Close
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="label">Announcement Title</label>
                <input
                  type="text"
                  placeholder="e.g. Term 2 Curriculum Alignment Workshop"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="input"
                  required
                />
              </div>

              <div>
                <label className="label">Target Audience</label>
                <select
                  value={audience}
                  onChange={(e) => setAudience(e.target.value as any)}
                  className="input"
                >
                  <option value="all">All School Faculty & Staff</option>
                  <option value="teachers">Classroom Teachers Only</option>
                  <option value="teacher_admins">Teacher Admins Only</option>
                  <option value="department">Specific Academic Department</option>
                </select>
              </div>

              {audience === "department" && (
                <div>
                  <label className="label">Department Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Science or Mathematics"
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                    className="input"
                    required
                  />
                </div>
              )}

              <div>
                <label className="label">Message Content</label>
                <textarea
                  rows={5}
                  placeholder="Draft your communication bulletin here…"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="input py-2.5"
                  required
                />
              </div>

              <label className="flex items-center gap-2 text-xs text-fg cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={publishImmediately}
                  onChange={(e) => setPublishImmediately(e.target.checked)}
                  className="rounded border-border text-accent focus:ring-accent"
                />
                <span>Publish immediately to teacher dashboards</span>
              </label>

              <div className="flex justify-end gap-2.5 pt-4 border-t border-border">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn-outline text-xs"
                >
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary text-xs">
                  {submitting ? "Saving…" : publishImmediately ? "Publish Announcement" : "Save Draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
