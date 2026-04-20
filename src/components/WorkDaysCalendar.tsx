import { useState, useMemo } from "react";
import { Button, Select, InputNumber, Tooltip, Badge } from "antd";
import { ChevronLeft, ChevronRight, CalendarDays, Info, Gift } from "lucide-react";
import type { WorkDayPattern } from "../context/DataContext";

const { Option } = Select;

// ─── NZ & AU Public Holidays (YYYY-MM-DD) ───
const PUBLIC_HOLIDAYS: Record<string, string> = {
  // NZ 2025
  "2025-01-01": "New Year's Day",
  "2025-01-02": "Day after New Year's Day",
  "2025-02-06": "Waitangi Day",
  "2025-04-18": "Good Friday",
  "2025-04-21": "Easter Monday",
  "2025-04-25": "ANZAC Day",
  "2025-06-02": "King's Birthday",
  "2025-10-27": "Labour Day",
  "2025-12-25": "Christmas Day",
  "2025-12-26": "Boxing Day",
  // NZ 2026
  "2026-01-01": "New Year's Day",
  "2026-01-02": "Day after New Year's Day",
  "2026-02-06": "Waitangi Day",
  "2026-04-03": "Good Friday",
  "2026-04-06": "Easter Monday",
  "2026-04-25": "ANZAC Day",
  "2026-06-01": "King's Birthday",
  "2026-10-26": "Labour Day",
  "2026-12-25": "Christmas Day",
  "2026-12-28": "Boxing Day (observed)",
  // AU 2025
  "2025-01-27": "Australia Day (observed)",
  "2025-03-10": "Canberra Day",
  "2025-11-04": "Melbourne Cup Day",
};

type DayType = "workday" | "weekend" | "holiday" | "holiday-workday";

interface CalendarDay {
  date: Date;
  dateStr: string;
  dayOfWeek: number; // 0=Mon, 1=Tue ... 6=Sun
  isHoliday: boolean;
  holidayName: string;
  workState: "on" | "off" | "none";
  hours: number;
  type: DayType;
}

function getDayType(
  isHoliday: boolean,
  workState: "on" | "off" | "none",
  dayOfWeek: number
): DayType {
  const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
  if (isHoliday && workState === "on") return "holiday-workday";
  if (isHoliday) return "holiday";
  if (isWeekend && workState !== "on") return "weekend";
  if (workState === "on") return "workday";
  return "weekend";
}

function buildCalendarWeeks(
  year: number,
  month: number,
  pattern: WorkDayPattern[]
): CalendarDay[][] {
  // Get start of the week (Mon) containing first day of month
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Get Monday of the first week
  const startDow = firstDay.getDay(); // 0=Sun, 1=Mon ...
  const mondayOffset = startDow === 0 ? -6 : 1 - startDow;
  const start = new Date(firstDay);
  start.setDate(start.getDate() + mondayOffset);

  // Get Sunday of the last week
  const endDow = lastDay.getDay();
  const sundayOffset = endDow === 0 ? 0 : 7 - endDow;
  const end = new Date(lastDay);
  end.setDate(end.getDate() + sundayOffset);

  const weeks: CalendarDay[][] = [];
  const cur = new Date(start);

  while (cur <= end) {
    const week: CalendarDay[] = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(cur);
      const dateStr = date.toISOString().split("T")[0];
      const dayOfWeek = d; // 0=Mon...6=Sun
      const isHoliday = !!PUBLIC_HOLIDAYS[dateStr];
      const holidayName = PUBLIC_HOLIDAYS[dateStr] ?? "";
      const patternDay = pattern[dayOfWeek] ?? {
        dayIndex: dayOfWeek,
        state: "off",
        hours: 0,
      };
      const workState = patternDay.state;
      const hours = patternDay.hours;
      const type = getDayType(isHoliday, workState, dayOfWeek);

      week.push({
        date,
        dateStr,
        dayOfWeek,
        isHoliday,
        holidayName,
        workState,
        hours,
        type,
      });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
  }

  return weeks;
}

const DOW_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function formatDateLabel(date: Date) {
  const day = date.getDate();
  const month = MONTH_NAMES[date.getMonth()].slice(0, 3);
  const year = date.getFullYear();
  return { day, month, year };
}

function DayCell({
  day,
  isCurrentMonth = true,
  onToggleHours = () => {},
}: {
  day: CalendarDay;
  isCurrentMonth?: boolean;
  onToggleHours?: (dateStr: string, hours: number) => void;
}) {
  const { day: dayNum, month, year } = formatDateLabel(day.date);
  const isWorkday = day.type === "workday" || day.type === "holiday-workday";
  const isHolidayType = day.type === "holiday" || day.type === "holiday-workday";
  const isWeekendType = day.type === "weekend";

  // Color logic
  let cellBg = "var(--workday-cell-bg)";
  let cellText = "var(--workday-cell-text)";
  let subText = "var(--workday-cell-sub)";
  let hoursBadgeBg = "var(--workday-hours-bg)";
  let hoursBadgeText = "var(--workday-hours-text)";

  if (isWorkday && !isHolidayType) {
    cellBg = "var(--workday-active-bg)";
    cellText = "var(--workday-active-text)";
    subText = "var(--workday-active-sub)";
    hoursBadgeBg = "var(--workday-active-hours-bg)";
    hoursBadgeText = "var(--workday-active-hours-text)";
  } else if (isHolidayType) {
    cellBg = "var(--workday-holiday-bg)";
    cellText = "var(--workday-holiday-text)";
    subText = "var(--workday-holiday-sub)";
    hoursBadgeBg = "var(--workday-holiday-hours-bg)";
    hoursBadgeText = "var(--workday-holiday-hours-text)";
  } else if (isWeekendType) {
    cellBg = "var(--workday-weekend-bg)";
    cellText = "var(--workday-weekend-text)";
    subText = "var(--workday-weekend-sub)";
    hoursBadgeBg = "var(--workday-weekend-hours-bg)";
    hoursBadgeText = "var(--workday-weekend-hours-text)";
  }

  if (!isCurrentMonth) {
    cellBg = "var(--workday-dimmed-bg)";
    cellText = "var(--workday-dimmed-text)";
    subText = "var(--workday-dimmed-text)";
  }

  return (
    <Tooltip
      title={day.isHoliday ? `🎉 ${day.holidayName}` : undefined}
      placement="top"
    >
      <div
        className="flex flex-col items-center justify-between cursor-default select-none"
        style={{
          background: cellBg,
          borderRadius: 6,
          padding: "8px 4px 8px",
          minHeight: 90,
          position: "relative",
          transition: "opacity 0.15s",
          opacity: isCurrentMonth ? 1 : 0.45,
        }}
      >
        {/* Holiday star */}
        {day.isHoliday && isCurrentMonth && (
          <div
            style={{
              position: "absolute",
              top: 5,
              right: 6,
            }}
          >
            <Gift size={11} style={{ color: cellText, opacity: 0.85 }} />
          </div>
        )}

        {/* Day label row */}
        <div className="flex flex-col items-center" style={{ flex: 1 }}>
          <span
            className="text-xs font-medium"
            style={{ color: subText, fontSize: 10, marginBottom: 1 }}
          >
            {DOW_LABELS[day.dayOfWeek]}
          </span>
          <span
            className="font-bold"
            style={{ color: cellText, fontSize: 22, lineHeight: 1.1 }}
          >
            {dayNum}
          </span>
          <span
            className="text-xs"
            style={{ color: subText, fontSize: 10, marginTop: 1 }}
          >
            {month} {year}
          </span>
        </div>

        {/* Hours badge */}
        {(isWorkday || day.type === "holiday-workday") && isCurrentMonth && (
          <div
            className="flex items-center justify-center"
            style={{
              background: hoursBadgeBg,
              borderRadius: 10,
              padding: "1px 8px",
              marginTop: 6,
              minWidth: 38,
            }}
          >
            <span
              className="text-xs font-semibold"
              style={{ color: hoursBadgeText, fontSize: 11 }}
            >
              {day.hours}h
            </span>
          </div>
        )}
      </div>
    </Tooltip>
  );
}

export default function WorkDaysCalendar({
  workDayPattern = [
    { dayIndex: 0, state: "on", hours: 7.5 },
    { dayIndex: 1, state: "on", hours: 7.5 },
    { dayIndex: 2, state: "on", hours: 7.5 },
    { dayIndex: 3, state: "on", hours: 7.5 },
    { dayIndex: 4, state: "on", hours: 7.5 },
    { dayIndex: 5, state: "off", hours: 0 },
    { dayIndex: 6, state: "off", hours: 0 },
  ],
  onPatternChange = () => {},
}: {
  workDayPattern?: WorkDayPattern[];
  onPatternChange?: (pattern: WorkDayPattern[]) => void;
}) {
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());

  const weeks = useMemo(
    () => buildCalendarWeeks(viewYear, viewMonth, workDayPattern),
    [viewYear, viewMonth, workDayPattern]
  );

  // Count holidays this month
  const holidaysThisMonth = useMemo(() => {
    const daysInView = weeks.flat();
    return daysInView.filter(
      (d) =>
        d.isHoliday &&
        d.date.getFullYear() === viewYear &&
        d.date.getMonth() === viewMonth
    );
  }, [weeks, viewYear, viewMonth]);

  // Total working hours this month
  const totalWorkHours = useMemo(() => {
    return weeks.flat().reduce((acc, d) => {
      if (
        d.date.getFullYear() === viewYear &&
        d.date.getMonth() === viewMonth &&
        (d.type === "workday" || d.type === "holiday-workday")
      ) {
        return acc + d.hours;
      }
      return acc;
    }, 0);
  }, [weeks, viewYear, viewMonth]);

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const yearOptions = Array.from({ length: 6 }, (_, i) => now.getFullYear() - 1 + i);

  const handleHoursChange = (dayIndex: number, hours: number) => {
    const next = workDayPattern.map((d) =>
      d.dayIndex === dayIndex ? { ...d, hours } : d
    );
    onPatternChange(next);
  };

  return (
    <div data-cmp="WorkDaysCalendar" className="flex flex-col gap-0" style={{ minWidth: 0 }}>
      {/* ─── Header ─── */}
      <div
        className="flex items-center justify-between px-4 py-3"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <Button
            type="text"
            size="small"
            icon={<ChevronLeft size={15} />}
            onClick={prevMonth}
            style={{ padding: "0 6px" }}
          />
          <div className="flex items-center gap-2">
            <Select
              size="small"
              value={viewMonth}
              onChange={setViewMonth}
              style={{ width: 110 }}
            >
              {MONTH_NAMES.map((m, i) => (
                <Option key={i} value={i}>{m}</Option>
              ))}
            </Select>
            <Select
              size="small"
              value={viewYear}
              onChange={setViewYear}
              style={{ width: 80 }}
            >
              {yearOptions.map((y) => (
                <Option key={y} value={y}>{y}</Option>
              ))}
            </Select>
          </div>
          <Button
            type="text"
            size="small"
            icon={<ChevronRight size={15} />}
            onClick={nextMonth}
            style={{ padding: "0 6px" }}
          />
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4">
          <div
            className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5"
            style={{
              background: "var(--workday-active-bg)",
              color: "var(--workday-active-text)",
            }}
          >
            <CalendarDays size={12} />
            <span style={{ fontWeight: 600 }}>
              {totalWorkHours.toFixed(1)}h
            </span>
            <span style={{ opacity: 0.8 }}>this month</span>
          </div>
          {holidaysThisMonth.length > 0 && (
            <Tooltip
              title={
                <div>
                  {holidaysThisMonth.map((h) => (
                    <div key={h.dateStr}>
                      {h.dateStr} — {h.holidayName}
                    </div>
                  ))}
                </div>
              }
            >
              <div
                className="flex items-center gap-1.5 text-xs rounded-lg px-3 py-1.5 cursor-pointer"
                style={{
                  background: "var(--workday-holiday-bg)",
                  color: "var(--workday-holiday-text)",
                }}
              >
                <Gift size={12} />
                <span style={{ fontWeight: 600 }}>{holidaysThisMonth.length}</span>
                <span style={{ opacity: 0.8 }}>public holiday{holidaysThisMonth.length > 1 ? "s" : ""}</span>
                <Info size={11} style={{ opacity: 0.7 }} />
              </div>
            </Tooltip>
          )}
        </div>
      </div>

      {/* ─── Pattern quick editor ─── */}
      <div
        className="flex items-center gap-3 px-4 py-2 flex-wrap"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--muted)" }}
      >
        <span
          className="text-xs font-medium"
          style={{ color: "var(--muted-foreground)", flexShrink: 0 }}
        >
          Work Hours:
        </span>
        {workDayPattern.map((day) => (
          <div key={day.dayIndex} className="flex items-center gap-1">
            <span
              className="text-xs"
              style={{
                color:
                  day.state === "on"
                    ? "var(--workday-active-text)"
                    : "var(--muted-foreground)",
                fontWeight: day.state === "on" ? 600 : 400,
                minWidth: 28,
              }}
            >
              {DOW_LABELS[day.dayIndex]}
            </span>
            {day.state === "on" ? (
              <InputNumber
                size="small"
                min={0}
                max={24}
                step={0.5}
                value={day.hours}
                onChange={(v) => handleHoursChange(day.dayIndex, v ?? 0)}
                style={{ width: 60, fontSize: 11 }}
              />
            ) : (
              <span
                className="text-xs rounded px-2 py-0.5"
                style={{
                  background: "var(--workday-weekend-bg)",
                  color: "var(--workday-weekend-text)",
                  fontSize: 10,
                }}
              >
                OFF
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ─── Calendar grid ─── */}
      <div style={{ padding: "0 0" }}>
        {/* Column headers */}
        <div className="flex" style={{ borderBottom: "1px solid var(--border)" }}>
          {DOW_LABELS.map((label) => (
            <div
              key={label}
              className="flex items-center justify-center text-xs font-bold py-2"
              style={{
                flex: 1,
                color: label === "Sat" || label === "Sun"
                  ? "var(--workday-weekend-text)"
                  : "var(--foreground)",
                background:
                  label === "Sat" || label === "Sun"
                    ? "var(--workday-weekend-header)"
                    : "var(--card)",
                borderRight: "1px solid var(--border)",
              }}
            >
              {label}
            </div>
          ))}
        </div>

        {/* Week rows */}
        {weeks.map((week, wi) => (
          <div
            key={wi}
            className="flex"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            {week.map((day) => {
              const isCurrentMonth =
                day.date.getFullYear() === viewYear &&
                day.date.getMonth() === viewMonth;
              return (
                <div
                  key={day.dateStr}
                  style={{
                    flex: 1,
                    padding: 3,
                    borderRight: "1px solid var(--border)",
                    background:
                      !isCurrentMonth
                        ? "var(--muted)"
                        : "transparent",
                  }}
                >
                  <DayCell
                    day={day}
                    isCurrentMonth={isCurrentMonth}
                  />
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* ─── Legend ─── */}
      <div
        className="flex items-center gap-4 px-4 py-2 flex-wrap"
        style={{ borderTop: "1px solid var(--border)" }}
      >
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          Legend:
        </span>
        <div className="flex items-center gap-1.5">
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: "var(--workday-active-bg)",
            }}
          />
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Working Day
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: "var(--workday-weekend-bg)",
            }}
          />
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Day Off / Weekend
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: 3,
              background: "var(--workday-holiday-bg)",
            }}
          />
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Public Holiday
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Gift size={12} style={{ color: "var(--workday-holiday-text)" }} />
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            Holiday indicator
          </span>
        </div>
      </div>
    </div>
  );
}
