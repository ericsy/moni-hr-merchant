import { Button, Empty, Spin, Tag } from "antd";
import type { Dayjs } from "dayjs";
import dayjs from "dayjs";
import { CalendarDays, ChevronLeft, ChevronRight, MapPin, UserPlus } from "lucide-react";
import { useMemo } from "react";
import {
  countFieldJobsByDate,
  filterJobsOnDate,
  getWeekDates,
} from "../../lib/fieldJobSchedule";
import type { FieldJobStatus, FieldServiceJob } from "../../types/fieldService";

interface FieldJobCalendarViewProps {
  jobs: FieldServiceJob[];
  loading: boolean;
  selectedDate: Dayjs;
  weekStart: Dayjs;
  locale: "zh" | "en";
  labels: Record<string, unknown>;
  statusColors: Record<FieldJobStatus, string>;
  statusLabel: (value: FieldJobStatus) => string;
  serviceTypeLabel: (value: string) => string;
  onSelectedDateChange: (date: Dayjs) => void;
  onWeekChange: (weekStart: Dayjs) => void;
  onEdit: (job: FieldServiceJob) => void;
  onAssign: (job: FieldServiceJob) => void;
  onCancel: (job: FieldServiceJob) => void;
}

const WEEKDAY_LABELS_ZH = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];
const WEEKDAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function FieldJobCalendarView({
  jobs,
  loading,
  selectedDate,
  weekStart,
  locale,
  labels,
  statusColors,
  statusLabel,
  serviceTypeLabel,
  onSelectedDateChange,
  onWeekChange,
  onEdit,
  onAssign,
  onCancel,
}: FieldJobCalendarViewProps) {
  const jobCountByDate = useMemo(() => countFieldJobsByDate(jobs), [jobs]);
  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const selectedDateKey = selectedDate.format("YYYY-MM-DD");
  const dayJobs = useMemo(
    () => filterJobsOnDate(jobs, dayjs(selectedDateKey)),
    [jobs, selectedDateKey],
  );

  const weekdayLabels = locale === "zh" ? WEEKDAY_LABELS_ZH : WEEKDAY_LABELS_EN;
  const weekEnd = weekDates[6];
  const weekRangeLabel =
    locale === "zh"
      ? `${weekDates[0].format("M月D日")} - ${weekEnd.format("M月D日")}`
      : `${weekDates[0].format("MMM D")} - ${weekEnd.format("MMM D, YYYY")}`;

  const selectedTitle = selectedDate.format(
    locale === "zh" ? "YYYY年M月D日 dddd" : "dddd, MMM D, YYYY",
  );

  const shiftWeek = (delta: number) => {
    const nextWeekStart = weekStart.add(delta * 7, "day");
    const dayIndex = Math.min(6, Math.max(0, selectedDate.diff(weekStart, "day")));
    onWeekChange(nextWeekStart);
    onSelectedDateChange(nextWeekStart.add(dayIndex, "day"));
  };

  return (
    <div className="flex flex-col gap-4">
      <div
        className="rounded-xl border p-4"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {weekRangeLabel}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="small" icon={<ChevronLeft size={14} />} onClick={() => shiftWeek(-1)} />
            <Button
              size="small"
              onClick={() => {
                const today = dayjs().startOf("day");
                onWeekChange(today.startOf("isoWeek"));
                onSelectedDateChange(today);
              }}
            >
              {String(labels.today)}
            </Button>
            <Button size="small" icon={<ChevronRight size={14} />} onClick={() => shiftWeek(1)} />
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2">
          {weekDates.map((date, index) => {
            const dateKey = date.format("YYYY-MM-DD");
            const count = jobCountByDate.get(dateKey) || 0;
            const isSelected = date.isSame(selectedDate, "day");
            const isToday = date.isSame(dayjs(), "day");

            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => onSelectedDateChange(date.startOf("day"))}
                className="flex min-w-0 flex-col items-center rounded-xl border px-1 py-3 transition-colors"
                style={{
                  borderColor: isSelected ? "var(--primary)" : "var(--border)",
                  background: isSelected ? "var(--secondary)" : "var(--background)",
                  color: "var(--foreground)",
                }}
              >
                <span
                  className="text-xs"
                  style={{ color: isSelected ? "var(--primary)" : "var(--muted-foreground)" }}
                >
                  {weekdayLabels[index]}
                </span>
                <span
                  className="mt-1 inline-flex h-8 w-8 items-center justify-center rounded-full text-base font-semibold"
                  style={{
                    background: isToday ? "var(--primary)" : "transparent",
                    color: isToday ? "var(--primary-foreground)" : "var(--foreground)",
                  }}
                >
                  {date.date()}
                </span>
                <span
                  className="mt-1 min-h-4 text-[11px] leading-4"
                  style={{ color: isSelected ? "var(--primary)" : "var(--muted-foreground)" }}
                >
                  {count > 0
                    ? String(labels.calendarJobCount).replace("{count}", String(count))
                    : " "}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div
        className="flex min-h-[360px] flex-col rounded-xl border"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div
          className="border-b p-4"
          style={{ borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-2 text-base font-semibold">
            <CalendarDays size={18} />
            {selectedTitle}
          </div>
          <div className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
            {String(labels.calendarDaySummary).replace("{count}", String(dayJobs.length))}
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
