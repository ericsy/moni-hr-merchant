import { useState, useMemo } from "react";
import { Button, Select, InputNumber, Tooltip } from "antd";
import { ChevronLeft, ChevronRight, CalendarDays, Info, Gift } from "lucide-react";
import type { WorkDayPattern } from "../context/DataContext";
import { useLocale } from "../context/LocaleContext";

const { Option } = Select;

// ─── NZ & AU Public Holidays (YYYY-MM-DD) ───
const PUBLIC_HOLIDAYS: Record<string, { en: string; zh: string }> = {
  // NZ 2025
  "2025-01-01": { en: "New Year's Day", zh: "元旦" },
  "2025-01-02": { en: "Day after New Year's Day", zh: "元旦次日" },
  "2025-02-06": { en: "Waitangi Day", zh: "怀唐伊日" },
  "2025-04-18": { en: "Good Friday", zh: "耶稣受难日" },
  "2025-04-21": { en: "Easter Monday", zh: "复活节星期一" },
  "2025-04-25": { en: "ANZAC Day", zh: "澳新军团日" },
  "2025-06-02": { en: "King's Birthday", zh: "国王诞辰日" },
  "2025-10-27": { en: "Labour Day", zh: "劳动节" },
  "2025-12-25": { en: "Christmas Day", zh: "圣诞节" },
  "2025-12-26": { en: "Boxing Day", zh: "节礼日" },
  // NZ 2026
  "2026-01-01": { en: "New Year's Day", zh: "元旦" },
  "2026-01-02": { en: "Day after New Year's Day", zh: "元旦次日" },
  "2026-02-06": { en: "Waitangi Day", zh: "怀唐伊日" },
  "2026-04-03": { en: "Good Friday", zh: "耶稣受难日" },
  "2026-04-06": { en: "Easter Monday", zh: "复活节星期一" },
  "2026-04-25": { en: "ANZAC Day", zh: "澳新军团日" },
  "2026-06-01": { en: "King's Birthday", zh: "国王诞辰日" },
  "2026-10-26": { en: "Labour Day", zh: "劳动节" },
  "2026-12-25": { en: "Christmas Day", zh: "圣诞节" },
  "2026-12-28": { en: "Boxing Day (observed)", zh: "节礼日（补假）" },
  // AU 2025
  "2025-01-27": { en: "Australia Day (observed)", zh: "澳大利亚日（补假）" },
  "2025-03-10": { en: "Canberra Day", zh: "堪培拉日" },
  "2025-11-04": { en: "Melbourne Cup Day", zh: "墨尔本杯日" },
};

const FALLBACK_CALENDAR_COPY = {
  weekDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  monthNames: [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ],
  monthShortNames: [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ],
  workHours: "Work Hours",
  thisMonth: "this month",
  publicHoliday: "public holiday",
  publicHolidays: "public holidays",
  off: "OFF",
  legend: "Legend",
  workingDay: "Working Day",
  dayOffWeekend: "Day Off / Weekend",
  publicHolidayLegend: "Public Holiday",
  holidayIndicator: "Holiday indicator",
  holidayTooltipPrefix: "Holiday",
};

type WorkDaysCalendarCopy = typeof FALLBACK_CALENDAR_COPY;

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
  pattern: WorkDayPattern[],
  locale: string
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
      const dateStr = formatLocalDateKey(date);
      const dayOfWeek = d; // 0=Mon...6=Sun
      const holiday = PUBLIC_HOLIDAYS[dateStr];
      const isHoliday = !!holiday;
      const holidayName = holiday ? (locale === "zh" ? holiday.zh : holiday.en) : "";
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

function formatLocalDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(date: Date, monthShortNames: string[]) {
  const day = date.getDate();
  const month = monthShortNames[date.getMonth()] ?? FALLBACK_CALENDAR_COPY.monthShortNames[date.getMonth()];
  const year = date.getFullYear();
  return { day, month, year };
}

function DayCell({
  day,
  copy,
  isCurrentMonth = true,
  onToggleHours = () => {},
}: {
  day: CalendarDay;
  copy: WorkDaysCalendarCopy;
  isCurrentMonth?: boolean;
  onToggleHours?: (dateStr: string, hours: number) => void;
}) {
  const { day: dayNum, month, year } = formatDateLabel(day.date, copy.monthShortNames);
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
      title={day.isHoliday ? `${copy.holidayTooltipPrefix}: ${day.holidayName}` : undefined}
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
            {copy.weekDays[day.dayOfWeek] ?? FALLBACK_CALENDAR_COPY.weekDays[day.dayOfWeek]}
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
  const { locale, t } = useLocale();
  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const employeeCopy = t.employee as Record<string, unknown>;
  const calendarCopy = (employeeCopy.workDaysCalendar ?? {}) as Partial<WorkDaysCalendarCopy>;
  const copy: WorkDaysCalendarCopy = {
    ...FALLBACK_CALENDAR_COPY,
    ...calendarCopy,
    weekDays: (employeeCopy.weekDays as string[] | undefined) ?? FALLBACK_CALENDAR_COPY.weekDays,
    monthNames: calendarCopy.monthNames ?? FALLBACK_CALENDAR_COPY.monthNames,
    monthShortNames: calendarCopy.monthShortNames ?? FALLBACK_CALENDAR_COPY.monthShortNames,
  };

  const weeks = useMemo(
    () => buildCalendarWeeks(viewYear, viewMonth, workDayPattern, locale),
    [viewYear, viewMonth, workDayPattern, locale]
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
              {copy.monthNames.map((m, i) => (
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
            <span style={{ opacity: 0.8 }}>{copy.thisMonth}</span>
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
                <span style={{ opacity: 0.8 }}>
                  {holidaysThisMonth.length > 1 ? copy.publicHolidays : copy.publicHoliday}
                </span>
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
          {copy.workHours}:
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
              {copy.weekDays[day.dayIndex] ?? FALLBACK_CALENDAR_COPY.weekDays[day.dayIndex]}
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
                {copy.off}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* ─── Calendar grid ─── */}
      <div style={{ padding: "0 0" }}>
        {/* Column headers */}
        <div className="flex" style={{ borderBottom: "1px solid var(--border)" }}>
          {copy.weekDays.map((label, index) => (
            <div
              key={label}
              className="flex items-center justify-center text-xs font-bold py-2"
              style={{
                flex: 1,
                color: index >= 5
                  ? "var(--workday-weekend-text)"
                  : "var(--foreground)",
                background:
                  index >= 5
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
                    copy={copy}
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
          {copy.legend}:
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
            {copy.workingDay}
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
            {copy.dayOffWeekend}
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
            {copy.publicHolidayLegend}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Gift size={12} style={{ color: "var(--workday-holiday-text)" }} />
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {copy.holidayIndicator}
          </span>
        </div>
      </div>
    </div>
  );
}
