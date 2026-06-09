import { Card, Empty, Input, Segmented, Skeleton } from "antd";
import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { useLocale } from "../context/LocaleContext";
import type {
  MerchantTodayAttendance,
  MerchantTodayAttendanceItem,
  MerchantTodayAttendanceStatus,
} from "../lib/merchantApi";

type FilterKey = "all" | MerchantTodayAttendanceStatus | "punched";

const statusStyles: Record<
  MerchantTodayAttendanceStatus,
  { bg: string; border: string; dot: string; text: string }
> = {
  not_punched: {
    bg: "#fef2f2",
    border: "#ef4444",
    dot: "#ef4444",
    text: "#dc2626",
  },
  clocked_in: {
    bg: "#f0fdf4",
    border: "#22c55e",
    dot: "#22c55e",
    text: "#16a34a",
  },
  completed: {
    bg: "#eff6ff",
    border: "#2563eb",
    dot: "#2563eb",
    text: "#1d4ed8",
  },
  on_leave: {
    bg: "#f5f3ff",
    border: "#8b5cf6",
    dot: "#8b5cf6",
    text: "#7c3aed",
  },
};

function getInitials(item: MerchantTodayAttendanceItem) {
  const name = (item.displayName || "").trim();
  if (!name) return "?";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0][0] || ""}${parts[1][0] || ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function formatShiftRange(item: MerchantTodayAttendanceItem) {
  const shift = item.shifts?.[0];
  if (!shift?.startTime && !shift?.endTime) return "";
  const start = shift?.startTime || "--:--";
  const end = shift?.endTime || "--:--";
  const name = shift?.shiftName ? ` · ${shift.shiftName}` : "";
  return `${start}-${end}${name}`;
}

function formatClockTime(iso?: string | null, locale = "zh-CN") {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleTimeString(locale === "zh" ? "zh-CN" : "en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function matchesFilter(item: MerchantTodayAttendanceItem, filter: FilterKey) {
  const status = item.attendanceStatus || "not_punched";
  if (filter === "all") return true;
  if (filter === "punched") {
    return status === "clocked_in" || status === "completed";
  }
  return status === filter;
}

function groupItems(items: MerchantTodayAttendanceItem[]) {
  const groups: Record<MerchantTodayAttendanceStatus, MerchantTodayAttendanceItem[]> = {
    not_punched: [],
    clocked_in: [],
    completed: [],
    on_leave: [],
  };
  for (const item of items) {
    const status = item.attendanceStatus || "not_punched";
    groups[status].push(item);
  }
  return groups;
}

interface TodayAttendancePanelProps {
  data?: MerchantTodayAttendance | null;
  loading?: boolean;
}

export default function TodayAttendancePanel({
  data = null,
  loading = false,
}: TodayAttendancePanelProps) {
  const { locale, t } = useLocale();
  const ta = t.home.todayAttendance;
  const [filter, setFilter] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const summary = data?.summary;
  const allItems = data?.items || [];

  const filteredItems = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allItems.filter((item) => {
      if (!matchesFilter(item, filter)) return false;
      if (!q) return true;
      const hay = [
        item.displayName,
        item.employeeCode,
        item.firstName,
        item.lastName,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [allItems, filter, search]);

  const groups = useMemo(() => groupItems(filteredItems), [filteredItems]);

  const segmentOptions = useMemo(
    () => [
      { label: `${ta.filterAll} (${summary?.scheduled ?? allItems.length})`, value: "all" },
      {
        label: `${ta.filterNotPunched} (${summary?.notPunched ?? 0})`,
        value: "not_punched",
      },
      { label: `${ta.filterPunched} (${summary?.punched ?? 0})`, value: "punched" },
      { label: `${ta.filterOnLeave} (${summary?.onLeave ?? 0})`, value: "on_leave" },
    ],
    [ta, summary, allItems.length],
  );

  const statusLabel = (status: MerchantTodayAttendanceStatus) => {
    switch (status) {
      case "not_punched":
        return ta.statusNotPunched;
      case "clocked_in":
        return ta.statusClockedIn;
      case "completed":
        return ta.statusCompleted;
      case "on_leave":
        return ta.statusOnLeave;
      default:
        return status;
    }
  };

  const punchHint = (item: MerchantTodayAttendanceItem) => {
    const status = item.attendanceStatus;
    if (status === "not_punched") return ta.notPunchedHint;
    if (status === "on_leave") return ta.onLeaveHint;
    const inTime = formatClockTime(item.clockInAt, locale);
    const outTime = formatClockTime(item.clockOutAt, locale);
    if (status === "completed" && inTime && outTime) {
      return `${ta.clockedInHint} ${inTime} · ${ta.clockedOutHint} ${outTime}`;
    }
    if (inTime) return `${ta.clockedInHint} ${inTime}`;
    return ta.clockedInHint;
  };

  const groupOrder: MerchantTodayAttendanceStatus[] = [
    "not_punched",
    "clocked_in",
    "completed",
    "on_leave",
  ];

  return (
    <Card
      style={{ borderColor: "var(--border)", borderRadius: 8 }}
      styles={{ body: { padding: "20px 24px" } }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-base font-semibold" style={{ color: "var(--foreground)" }}>
            {ta.title}
          </div>
          <div className="text-xs mt-1" style={{ color: "var(--muted-foreground)" }}>
            {data?.date || "—"}
            {data?.timeZone ? ` · ${data.timeZone}` : ""}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <SummaryChip label={ta.scheduled} value={summary?.scheduled ?? 0} color="#2563eb" />
          <SummaryChip label={ta.punched} value={summary?.punched ?? 0} color="#22c55e" />
          <SummaryChip label={ta.notPunched} value={summary?.notPunched ?? 0} color="#ef4444" />
          <SummaryChip label={ta.onLeave} value={summary?.onLeave ?? 0} color="#8b5cf6" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <Segmented
          value={filter}
          onChange={(value) => setFilter(value as FilterKey)}
          options={segmentOptions}
        />
        <Input
          allowClear
          prefix={<Search size={14} style={{ color: "var(--muted-foreground)" }} />}
          placeholder={ta.searchPlaceholder}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: 220, maxWidth: "100%" }}
        />
      </div>

      {loading ? (
        <Skeleton active paragraph={{ rows: 6 }} />
      ) : allItems.length === 0 ? (
        <Empty description={ta.empty} />
      ) : filteredItems.length === 0 ? (
        <Empty description={ta.noMatch} />
      ) : (
        <div className="flex flex-col gap-5">
          {groupOrder.map((status) => {
            const items = groups[status];
            if (items.length === 0) return null;
            const style = statusStyles[status];
            return (
              <div key={status}>
                <div
                  className="mb-3 flex items-center gap-2 text-sm font-medium"
                  style={{ color: style.text }}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full"
                    style={{ background: style.dot }}
                  />
                  {statusLabel(status)} ({items.length})
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 max-h-[320px] overflow-y-auto pr-1">
                  {items.map((item) => (
                    <EmployeeAttendanceCard
                      key={String(item.merchantAdminId)}
                      item={item}
                      style={style}
                      shiftText={formatShiftRange(item)}
                      punchText={punchHint(item)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        className="mt-4 flex flex-wrap gap-4 text-xs"
        style={{ color: "var(--muted-foreground)" }}
      >
        <LegendDot color={statusStyles.not_punched.dot} label={ta.statusNotPunched} />
        <LegendDot color={statusStyles.clocked_in.dot} label={ta.statusClockedIn} />
        <LegendDot color={statusStyles.completed.dot} label={ta.statusCompleted} />
        <LegendDot color={statusStyles.on_leave.dot} label={ta.statusOnLeave} />
      </div>
    </Card>
  );
}

function SummaryChip({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div
      className="rounded-lg px-3 py-2 min-w-[88px]"
      style={{ background: `${color}14`, border: `1px solid ${color}33` }}
    >
      <div className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>
        {label}
      </div>
      <div className="text-lg font-semibold leading-tight" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-block h-2 w-2 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

function EmployeeAttendanceCard({
  item,
  style,
  shiftText,
  punchText,
}: {
  item: MerchantTodayAttendanceItem;
  style: { bg: string; border: string; dot: string; text: string };
  shiftText: string;
  punchText: string;
}) {
  return (
    <div
      className="rounded-lg p-2.5 min-h-[96px] flex flex-col"
      style={{
        background: style.bg,
        border: `1px solid ${style.border}44`,
        boxShadow: `inset 3px 0 0 ${style.border}`,
      }}
      title={`${item.displayName || ""}\n${shiftText}\n${punchText}`}
    >
      <div className="flex items-start gap-2">
        <div
          className="h-8 w-8 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold"
          style={{ background: "#fff", color: style.text, border: `1px solid ${style.border}55` }}
        >
          {getInitials(item)}
        </div>
        <div className="min-w-0 flex-1">
          <div
            className="text-xs font-semibold truncate"
            style={{ color: "var(--foreground)" }}
          >
            {item.displayName || "—"}
          </div>
          {item.employeeCode ? (
            <div className="text-[10px] truncate" style={{ color: "var(--muted-foreground)" }}>
              {item.employeeCode}
            </div>
          ) : null}
        </div>
      </div>
      {shiftText ? (
        <div
          className="mt-2 text-[10px] leading-tight truncate"
          style={{ color: "var(--muted-foreground)" }}
        >
          {shiftText}
        </div>
      ) : null}
      <div className="mt-auto pt-1 text-[10px] leading-tight truncate" style={{ color: style.text }}>
        {punchText}
      </div>
    </div>
  );
}
