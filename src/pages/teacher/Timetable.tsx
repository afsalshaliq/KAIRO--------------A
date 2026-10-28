import { useState, useEffect } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { useTenant } from "@/lib/tenant";
import { listTeacherTimetable, computeScheduleStatus } from "@/services/timetable";
import { Spinner, EmptyState } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import type { TimetableRow } from "@/types/db";

const DAYS = [
  { num: 1, label: "Monday" },
  { num: 2, label: "Tuesday" },
  { num: 3, label: "Wednesday" },
  { num: 4, label: "Thursday" },
  { num: 5, label: "Friday" },
];

export default function TeacherTimetable() {
  const { profile } = useAuth();
  const { school } = useTenant();

  const [timetable, setTimetable] = useState<TimetableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(1);

  useEffect(() => {
    if (profile && school) {
      listTeacherTimetable(profile.id, school.id)
        .then((data) => setTimetable(data))
        .finally(() => setLoading(false));
    }
  }, [profile, school]);

  const status = computeScheduleStatus(timetable);
  const daySchedule = timetable.filter((t) => t.day_of_week === selectedDay);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Teaching Timetable"
        subtitle={`Weekly schedule, assigned periods, and classroom locations at ${school?.name || "your school"}.`}
      />

      {/* Today's Live Status Overview */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Previous Class */}
        <div className="card p-4 border-border">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
            Previous Class
          </span>
          {status.previousClass ? (
            <div>
              <span className="font-bold text-sm text-fg block">{status.previousClass.subjectName}</span>
              <span className="text-xs text-muted">
                {status.previousClass.className} · {status.previousClass.start_time} - {status.previousClass.end_time}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted/70 italic">No prior class today</span>
          )}
        </div>

        {/* Current Class */}
        <div className="card p-4 border border-accent/40 bg-accent-soft/30 shadow-xs">
          <span className="text-[11px] font-bold text-accent uppercase tracking-wider block mb-1">
            Current Active Class
          </span>
          {status.currentClass ? (
            <div>
              <span className="font-extrabold text-base text-fg block">{status.currentClass.subjectName}</span>
              <span className="text-xs text-fg/80 font-medium">
                {status.currentClass.className} (Sec {status.currentClass.sectionName}) · {status.currentClass.room || "Room 101"}
              </span>
            </div>
          ) : (
            <span className="text-xs text-accent font-semibold italic">Free Period right now</span>
          )}
        </div>

        {/* Next Class */}
        <div className="card p-4 border-border">
          <span className="text-[11px] font-bold text-muted uppercase tracking-wider block mb-1">
            Next Upcoming Class
          </span>
          {status.nextClass ? (
            <div>
              <span className="font-bold text-sm text-fg block">{status.nextClass.subjectName}</span>
              <span className="text-xs text-muted">
                {status.nextClass.className} · Starts {status.nextClass.start_time}
              </span>
            </div>
          ) : (
            <span className="text-xs text-muted/70 italic">No further periods today</span>
          )}
        </div>
      </div>

      {/* Day Selector */}
      <div className="flex gap-2 border-b border-border/60 pb-3 overflow-x-auto">
        {DAYS.map((d) => (
          <button
            key={d.num}
            onClick={() => setSelectedDay(d.num)}
            className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${
              selectedDay === d.num
                ? "bg-accent text-white shadow-xs"
                : "bg-surface text-muted hover:text-fg hover:bg-surface-hover"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>

      {/* Schedule Table */}
      {loading ? (
        <div className="card p-12 flex justify-center border-border">
          <Spinner label="Loading class schedule…" />
        </div>
      ) : daySchedule.length === 0 ? (
        <EmptyState
          title="No classes scheduled for this day"
          hint="Free day allocated for lesson preparation, curriculum exploration, and marking."
        />
      ) : (
        <div className="card overflow-hidden border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-surface text-muted border-b border-border uppercase tracking-wider text-[11px] font-semibold">
                <tr>
                  <th className="px-4 py-3">Period</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Class & Section</th>
                  <th className="px-4 py-3">Subject</th>
                  <th className="px-4 py-3">Room</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {daySchedule.map((entry) => (
                  <tr key={entry.id} className="hover:bg-surface/50 transition-colors">
                    <td className="px-4 py-3.5">
                      <span className="badge bg-accent-soft text-accent border border-accent/20 font-bold">
                        Period {entry.period_number}
                      </span>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-muted">
                      {entry.start_time} - {entry.end_time}
                    </td>
                    <td className="px-4 py-3.5 font-semibold text-fg">
                      {entry.className} (Sec {entry.sectionName})
                    </td>
                    <td className="px-4 py-3.5 font-bold text-accent">{entry.subjectName}</td>
                    <td className="px-4 py-3.5 text-muted">{entry.room || "Room 101"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
