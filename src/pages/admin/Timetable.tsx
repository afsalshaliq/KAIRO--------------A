import { useState, useEffect } from "react";
import { useTenant } from "@/lib/tenant";
import { listSchoolTimetable } from "@/services/timetable";
import { useToast, Spinner, StatusBadge } from "@/components/ui";
import { PageHeader } from "@/components/PageHeader";
import type { TimetableRow } from "@/types/db";

const DAYS = [
  { num: 1, label: "Monday" },
  { num: 2, label: "Tuesday" },
  { num: 3, label: "Wednesday" },
  { num: 4, label: "Thursday" },
  { num: 5, label: "Friday" },
];

const PERIODS = [
  { num: 1, time: "09:00 - 10:00" },
  { num: 2, time: "10:00 - 11:00" },
  { num: 3, time: "11:15 - 12:15" },
  { num: 4, time: "12:15 - 01:15" },
  { num: 5, time: "02:00 - 03:00" },
];

export default function AdminTimetable() {
  const { school } = useTenant();
  const toast = useToast();

  const [timetable, setTimetable] = useState<TimetableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(1);

  const load = async () => {
    if (!school) return;
    try {
      const data = await listSchoolTimetable(school.id);
      setTimetable(data);
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

  const getEntry = (day: number, period: number) => {
    return timetable.find((t) => t.day_of_week === day && t.period_number === period);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="School Timetable"
        subtitle={`Master weekly schedule, period allocations, and assigned rooms for ${school?.name || "your school"}.`}
      />

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

      {loading ? (
        <div className="card p-12 flex justify-center border-border">
          <Spinner label="Loading master timetable…" />
        </div>
      ) : (
        <div className="space-y-3">
          {PERIODS.map((p) => {
            const entry = getEntry(selectedDay, p.num);
            return (
              <div
                key={p.num}
                className="card p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-border hover:border-accent/40 hover:shadow-card-hover transition-all"
              >
                <div className="flex items-center gap-4">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent font-extrabold text-sm border border-accent/20">
                    P{p.num}
                  </div>
                  <div>
                    <span className="text-xs font-mono text-muted block mb-0.5">{p.time}</span>
                    {entry ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-base text-fg">{entry.subjectName}</span>
                        <span className="badge bg-surface text-fg border border-border text-xs">
                          {entry.className} · Sec {entry.sectionName}
                        </span>
                      </div>
                    ) : (
                      <span className="font-medium text-muted text-sm italic">
                        Free Period / Available
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  {entry && (
                    <div className="text-right hidden sm:block">
                      <div className="font-bold text-fg">{entry.teacherName || "Assigned Faculty"}</div>
                      <div className="text-muted text-[11px]">{entry.room || "Room 101"}</div>
                    </div>
                  )}
                  {entry ? (
                    <StatusBadge status="active" />
                  ) : (
                    <span className="badge bg-surface text-muted border border-border">
                      Free
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
