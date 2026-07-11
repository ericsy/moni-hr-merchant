import { Button, Checkbox, Input, InputNumber, TimePicker, Tooltip } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import {
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Info,
  Save,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocale } from "../context/LocaleContext";
import {
  merchantApi,
  type AttendanceConfirmItem,
  type AttendanceConfirmWeek,
} from "../lib/merchantApi";
import { formatCountryDate } from "../lib/dateFormat";

dayjs.extend(isoWeek);

type Props = {
  storeId: string;
  dateFormatCountry?: string;
};

function minutesToHoursLabel(minutes: number, isZh: boolean) {
  const h = Math.round((Math.max(0, minutes) / 60) * 10) / 10;
  return isZh ? `${h} 小时` : `${h} h`;
}

export function AttendanceConfirmPanel({ storeId, dateFormatCountry }: Props) {
  const { locale } = useLocale();
  const isZh = locale === "zh";

  /** 默认展示上一周（当周之前） */
  const [weekStart, setWeekStart] = useState(() =>
    dayjs().startOf("isoWeek").subtract(1, "week"),
  );
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [weekData, setWeekData] = useState<AttendanceConfirmWeek | null>(null);
  const [draftItems, setDraftItems] = useState<AttendanceConfirmItem[]>([]);

  const currentWeekMonday = dayjs().startOf("isoWeek");
  const isPastWeek = weekStart.isBefore(currentWeekMonday, "day");

  const loadWeek = useCallback(async () => {
    if (!storeId) return;
    setLoading(true);
    try {
      const data = await merchantApi.getAttendanceConfirmWeek(
        storeId,
        weekStart.format("YYYY-MM-DD"),
      );
      setWeekData(data);
      setDraftItems(data.items.map((item) => ({ ...item })));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isZh
            ? "加载确认出勤失败"
            : "Failed to load attendance confirmation",
      );
    } finally {
      setLoading(false);
    }
  }, [storeId, weekStart, isZh]);

  useEffect(() => {
    void loadWeek();
  }, [loadWeek]);

  const dirty = useMemo(() => {
    if (!weekData) return false;
    if (weekData.items.length !== draftItems.length) return true;
    return draftItems.some((item, index) => {
      const origin = weekData.items[index];
      if (!origin) return true;
      return (
        item.attended !== origin.attended ||
        item.confirmedStartTime !== origin.confirmedStartTime ||
        item.confirmedEndTime !== origin.confirmedEndTime ||
        item.confirmedBreakMinutes !== origin.confirmedBreakMinutes ||
        (item.note || "") !== (origin.note || "")
      );
    });
  }, [draftItems, weekData]);

  const updateItem = (
    publishedCellId: number | string,
    merchantAdminId: number | string,
    patch: Partial<AttendanceConfirmItem>,
  ) => {
    setDraftItems((prev) =>
      prev.map((item) => {
        if (
          String(item.publishedCellId) !== String(publishedCellId) ||
          String(item.merchantAdminId) !== String(merchantAdminId)
        ) {
          return item;
        }
        const next = { ...item, ...patch };
        if (next.attended === 0) {
          next.confirmedNetMinutes = 0;
        } else {
          const start = dayjs(next.confirmedStartTime, "HH:mm");
          const end = dayjs(next.confirmedEndTime, "HH:mm");
          let mins = end.diff(start, "minute");
          if (mins <= 0) mins += 24 * 60;
          mins -= Math.max(0, next.confirmedBreakMinutes || 0);
          next.confirmedNetMinutes = Math.max(0, mins);
        }
        return next;
      }),
    );
  };

  const save = async (confirm: boolean) => {
    if (!storeId || !isPastWeek) {
      toast.warning(
        isZh
          ? "仅可确认当周之前的排班"
          : "Only weeks before the current week can be confirmed",
      );
      return;
    }
    setSaving(true);
    try {
      const data = await merchantApi.saveAttendanceConfirmWeek(storeId, {
        weekStart: weekStart.format("YYYY-MM-DD"),
        confirm,
        items: draftItems.map((item) => ({
          publishedCellId: Number(item.publishedCellId),
          merchantAdminId: Number(item.merchantAdminId),
          attended: item.attended,
          confirmedStartTime: item.confirmedStartTime,
          confirmedEndTime: item.confirmedEndTime,
          confirmedBreakMinutes: item.confirmedBreakMinutes,
          note: item.note || undefined,
        })),
      });
      setWeekData(data);
      setDraftItems(data.items.map((item) => ({ ...item })));
      toast.success(
        confirm
          ? isZh
            ? "本周出勤已确认"
            : "Week attendance confirmed"
          : isZh
            ? "草稿已保存"
            : "Draft saved",
      );
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : isZh
            ? "保存失败"
            : "Save failed",
      );
    } finally {
      setSaving(false);
    }
  };

  const grouped = useMemo(() => {
    const map = new Map<string, AttendanceConfirmItem[]>();
    for (const item of draftItems) {
      const key = item.scheduleDate;
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [draftItems]);

  const totalConfirmedMinutes = draftItems.reduce(
    (sum, item) => sum + (item.attended === 1 ? item.confirmedNetMinutes || 0 : 0),
    0,
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="flex items-center justify-between px-5 py-2.5 flex-shrink-0 gap-3 flex-wrap"
        style={{
          background: "var(--card)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => setWeekStart((w) => w.subtract(1, "week"))}
              className="flex items-center justify-center rounded-lg transition-all hover:opacity-80"
              style={{
                width: 28,
                height: 28,
                color: "var(--muted-foreground)",
                border: "1px solid var(--border)",
              }}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              type="button"
              onClick={() => {
                const next = weekStart.add(1, "week");
                if (next.isBefore(currentWeekMonday, "day") || next.isSame(currentWeekMonday, "day")) {
                  // 不允许进入当周及以后：最多到上周
                  if (next.isBefore(currentWeekMonday, "day")) {
                    setWeekStart(next);
                  }
                }
              }}
              className="flex items-center justify-center rounded-lg transition-all hover:opacity-80"
              style={{
                width: 28,
                height: 28,
                color: "var(--muted-foreground)",
                border: "1px solid var(--border)",
              }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays size={14} style={{ color: "var(--muted-foreground)" }} />
            <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
              {`${formatCountryDate(weekStart, dateFormatCountry)} - ${formatCountryDate(weekStart.add(6, "day"), dateFormatCountry)}`}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{ background: "var(--secondary)", color: "var(--primary)" }}
            >
              {isZh ? `第 ${weekStart.isoWeek()} 周` : `W${weekStart.isoWeek()}`}
            </span>
            {weekData?.allConfirmed ? (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                style={{
                  background: "rgba(34,197,94,0.15)",
                  color: "#166534",
                }}
              >
                <CheckCircle2 size={12} />
                {isZh ? "已确认" : "Confirmed"}
              </span>
            ) : (
              <span
                className="rounded-full px-2 py-0.5 text-xs font-medium"
                style={{ background: "var(--muted)", color: "var(--muted-foreground)" }}
              >
                {isZh ? "未确认" : "Pending"}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Tooltip
            title={
              isZh
                ? "按实际出勤调整时段后确认；确认后的净工时计入员工统计"
                : "Adjust times to match actual attendance, then confirm. Confirmed net hours feed employee statistics."
            }
          >
            <Info size={14} style={{ color: "var(--muted-foreground)" }} />
          </Tooltip>
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {isZh
              ? `合计 ${minutesToHoursLabel(totalConfirmedMinutes, true)}`
              : `Total ${minutesToHoursLabel(totalConfirmedMinutes, false)}`}
          </span>
          <Button
            size="small"
            icon={<Save size={14} />}
            loading={saving}
            disabled={!isPastWeek || loading || draftItems.length === 0}
            onClick={() => void save(false)}
          >
            {isZh ? "保存草稿" : "Save draft"}
          </Button>
          <Button
            type="primary"
            size="small"
            icon={<CheckCircle2 size={14} />}
            loading={saving}
            disabled={!isPastWeek || loading || draftItems.length === 0}
            onClick={() => void save(true)}
          >
            {isZh ? "确认本周" : "Confirm week"}
          </Button>
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto px-5 py-4">
        {loading ? (
          <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {isZh ? "加载中…" : "Loading…"}
          </div>
        ) : weekData?.clockPunchEnabled ? (
          <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {isZh
              ? "本店要求打卡，无需确认出勤。"
              : "This store requires clock punches; attendance confirmation is not needed."}
          </div>
        ) : !isPastWeek ? (
          <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {isZh
              ? "请选择当周之前的周次进行出勤确认。"
              : "Select a week before the current week to confirm attendance."}
          </div>
        ) : draftItems.length === 0 ? (
          <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {isZh ? "该周没有已发布排班。" : "No published shifts in this week."}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {dirty ? (
              <div
                className="rounded-lg px-3 py-2 text-xs"
                style={{
                  background: "rgba(245, 158, 11, 0.12)",
                  color: "#92400e",
                  border: "1px solid rgba(245, 158, 11, 0.35)",
                }}
              >
                {isZh
                  ? "有未保存的调整，请先保存草稿或确认本周。"
                  : "You have unsaved changes. Save draft or confirm the week."}
              </div>
            ) : null}
            {grouped.map(([date, items]) => (
              <div
                key={date}
                className="rounded-xl overflow-hidden"
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--card)",
                }}
              >
                <div
                  className="px-4 py-2 text-sm font-semibold"
                  style={{
                    background: "var(--muted)",
                    color: "var(--foreground)",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  {formatCountryDate(dayjs(date), dateFormatCountry)}
                </div>
                <div className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {items.map((item) => (
                    <div
                      key={`${item.publishedCellId}-${item.merchantAdminId}`}
                      className="px-4 py-3 grid gap-3"
                      style={{
                        gridTemplateColumns: "minmax(120px,1.2fr) minmax(100px,1fr) auto auto auto auto minmax(100px,1fr)",
                        alignItems: "center",
                      }}
                    >
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>
                          {item.employeeName || "—"}
                        </div>
                        <div className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                          {[item.areaName, item.shiftName].filter(Boolean).join(" · ") ||
                            `${item.plannedStartTime}-${item.plannedEndTime}`}
                        </div>
                      </div>
                      <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                        {isZh ? "计划" : "Planned"}{" "}
                        {item.plannedStartTime}-{item.plannedEndTime}
                        {item.plannedBreakMinutes
                          ? ` (−${item.plannedBreakMinutes}m)`
                          : ""}
                      </div>
                      <Checkbox
                        checked={item.attended === 1}
                        onChange={(e) =>
                          updateItem(item.publishedCellId, item.merchantAdminId, {
                            attended: e.target.checked ? 1 : 0,
                          })
                        }
                      >
                        {isZh ? "出勤" : "Attended"}
                      </Checkbox>
                      <TimePicker
                        format="HH:mm"
                        allowClear={false}
                        disabled={item.attended !== 1}
                        value={dayjs(item.confirmedStartTime, "HH:mm") as Dayjs}
                        onChange={(v) =>
                          updateItem(item.publishedCellId, item.merchantAdminId, {
                            confirmedStartTime: v ? v.format("HH:mm") : item.confirmedStartTime,
                          })
                        }
                        style={{ width: 96 }}
                      />
                      <TimePicker
                        format="HH:mm"
                        allowClear={false}
                        disabled={item.attended !== 1}
                        value={dayjs(item.confirmedEndTime, "HH:mm") as Dayjs}
                        onChange={(v) =>
                          updateItem(item.publishedCellId, item.merchantAdminId, {
                            confirmedEndTime: v ? v.format("HH:mm") : item.confirmedEndTime,
                          })
                        }
                        style={{ width: 96 }}
                      />
                      <InputNumber
                        min={0}
                        disabled={item.attended !== 1}
                        value={item.confirmedBreakMinutes}
                        onChange={(v) =>
                          updateItem(item.publishedCellId, item.merchantAdminId, {
                            confirmedBreakMinutes: typeof v === "number" ? v : 0,
                          })
                        }
                        addonAfter="m"
                        style={{ width: 100 }}
                      />
                      <div className="flex flex-col gap-1">
                        <span className="text-xs font-medium" style={{ color: "var(--primary)" }}>
                          {minutesToHoursLabel(item.confirmedNetMinutes || 0, isZh)}
                        </span>
                        <Input
                          size="small"
                          placeholder={isZh ? "备注" : "Note"}
                          value={item.note || ""}
                          onChange={(e) =>
                            updateItem(item.publishedCellId, item.merchantAdminId, {
                              note: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
