import { Button, Calendar, Empty, Spin, Tag } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, UserPlus } from "lucide-react";
import { useMemo } from "react";
import { countFieldJobsByDate, filterJobsOnDate } from "../../lib/fieldJobSchedule";
import type { FieldJobStatus, FieldServiceJob } from "../../types/fieldService";

interface FieldJobCalendarViewProps {
  jobs: FieldServiceJob[];
  loading: boolean;
  selectedDate: Dayjs;
  calendarMonth: Dayjs;
  locale: "zh" | "en";
  labels: Record<string, unknown>;
  statusColors: Record<FieldJobStatus, string>;
  statusLabel: (value: FieldJobStatus) => string;
  serviceTypeLabel: (value: string) => string;
  onSelectedDateChange: (date: Dayjs) => void;
  onCalendarMonthChange: (date: Dayjs) => void;
  onEdit: (job: FieldServiceJob) => void;
  onAssign: (job: FieldServiceJob) => void;
  onCancel: (job: FieldServiceJob) => void;
}

export default function FieldJobCalendarView({
  jobs,
  loading,
  selectedDate,
  calendarMonth,
  locale,
  labels,
  statusColors,
  statusLabel,
  serviceTypeLabel,
  onSelectedDateChange,
  onCalendarMonthChange,
  onEdit,
  onAssign,
  onCancel,
}: FieldJobCalendarViewProps) {
  const jobCountByDate = useMemo(() => countFieldJobsByDate(jobs), [jobs]);
  const selectedDateKey = selectedDate.format("YYYY-MM-DD");
  const dayJobs = useMemo(
    () => filterJobsOnDate(jobs, dayjs(selectedDateKey)),
    [jobs, selectedDateKey],
  );

  const prevDayJobs = useMemo(
    () => filterJobsOnDate(jobs, dayjs(selectedDateKey).subtract(1, "day")),
    [jobs, selectedDateKey],
  );
  const nextDayJobs = useMemo(
    () => filterJobsOnDate(jobs, dayjs(selectedDateKey).add(1, "day")),
    [jobs, selectedDateKey],
  );

  const selectedTitle = selectedDate.format(
    locale === "zh" ? "YYYY年M月D日 dddd" : "dddd, MMM D, YYYY",
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(300px,360px)_minmax(0,1fr)]">
      <div
        className="rounded-xl border p-3"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <Calendar
          fullscreen={false}
          value={selectedDate}
          onSelect={(date) => {
            onSelectedDateChange(date.startOf("day"));
            if (!date.isSame(calendarMonth, "month")) {
              onCalendarMonthChange(date.startOf("month"));
            }
          }}
          onPanelChange={(date) => onCalendarMonthChange(date.startOf("month"))}
          cellRender={(date, info) => {
            if (info.type !== "date") return info.originNode;
            const count = jobCountByDate.get(date.format("YYYY-MM-DD")) || 0;
            const isSelected = date.isSame(selectedDate, "day");
            const isToday = date.isSame(dayjs(), "day");

            return (
              <div className="flex flex-col items-center gap-0.5 py-0.5">
                <span
                  className="inline-flex h-7 w-7 items-center justify-center rounded-full text-sm"
                  style={{
                    background: isSelected ? "var(--primary)" : "transparent",
                    color: isSelected ? "var(--primary-foreground)" : "var(--foreground)",
                    fontWeight: isToday ? 700 : 500,
                  }}
                >
                  {date.date()}
                </span>
                {count > 0 ? (
                  <span
                    className="rounded-full px-1.5 text-[10px] leading-4"
                    style={{
                      background: isSelected ? "var(--primary-foreground)" : "var(--secondary)",
                      color: isSelected ? "var(--primary)" : "var(--secondary-foreground)",
                    }}
                  >
                    {count}
                  </span>
                ) : (
                  <span className="h-4" />
                )}
              </div>
            );
          }}
        />
      </div>

      <div
        className="flex min-h-[420px] flex-col rounded-xl border"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div
          className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between"
          style={{ borderColor: "var(--border)" }}
        >
          <div>
            <div className="flex items-center gap-2 text-base font-semibold">
              <CalendarDays size={18} />
              {selectedTitle}
            </div>
            <div className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
              {String(labels.calendarDaySummary)
                .replace("{count}", String(dayJobs.length))
                .replace("{prev}", String(prevDayJobs.length))
                .replace("{next}", String(nextDayJobs.length))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="small"
              icon={<ChevronLeft size={14} />}
              onClick={() => onSelectedDateChange(selectedDate.subtract(1, "day"))}
            />
            <Button size="small" onClick={() => onSelectedDateChange(dayjs().startOf("day"))}>
              {String(labels.today)}
            </Button>
            <Button
              size="small"
              icon={<ChevronRight size={14} />}
              onClick={() => onSelectedDateChange(selectedDate.add(1, "day"))}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex justify-center py-16">
              <Spin />
            </div>
          ) : dayJobs.length === 0 ? (
            <Empty description={String(labels.calendarEmpty)} className="py-12" />
          ) : (
            <div className="flex flex-col gap-3">
              {dayJobs.map((job) => (
                <div
                  key={job.id}
                  className="rounded-lg border p-4"
                  style={{ borderColor: "var(--border)", background: "var(--background)" }}
                >
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium">{job.customerName}</span>
                        <Tag color={statusColors[job.status]}>{statusLabel(job.status)}</Tag>
                        <Tag>{serviceTypeLabel(job.serviceType)}</Tag>
                      </div>
                      <div className="mt-2 text-sm font-medium">
                        {dayjs(job.scheduledStart).format("HH:mm")} –{" "}
                        {dayjs(job.scheduledEnd).format("HH:mm")}
                      </div>
                      <div
                        className="mt-1 inline-flex items-center gap-1 text-sm"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        <MapPin size={13} />
                        <span className="truncate">{job.serviceAddress}</span>
                      </div>
                      <div className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
                        {String(labels.employee)}：{job.assignment?.employeeName || "—"}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button size="small" onClick={() => onEdit(job)}>
                        {String(labels.edit)}
                      </Button>
                      {job.status === "pending" || job.status === "assigned" ? (
                        <Button
                          size="small"
                          type="primary"
                          icon={<UserPlus size={14} />}
                          onClick={() => onAssign(job)}
                        >
                          {String(labels.assign)}
                        </Button>
                      ) : null}
                      {job.status !== "completed" && job.status !== "cancelled" ? (
                        <Button size="small" danger onClick={() => onCancel(job)}>
                          {String(labels.cancel)}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
