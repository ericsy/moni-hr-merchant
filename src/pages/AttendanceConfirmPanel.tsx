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

type EmployeeRow = {
  merchantAdminId: string;
  employeeName: string;
  byDate: Map<string, AttendanceConfirmItem[]>;
  totalMinutes: number;
};

function minutesToHoursLabel(minutes: number, isZh: boolean) {
  const h = Math.round((Math.max(0, minutes) / 60) * 10) / 10;
  return isZh ? `${h} 小时` : `${h} h`;
}

function itemKey(item: Pick<AttendanceConfirmItem, "publishedCellId" | "merchantAdminId">) {
  return `${item.publishedCellId}|${item.merchantAdminId}`;
}

export function AttendanceConfirmPanel({ storeId, dateFormatCountry }: Props) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const dayLabels = isZh
    ? ["一", "二", "三", "四", "五", "六", "日"]
    : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

  const weekDates = useMemo(
    () => Array.from({ length: 7 }, (_, i) => weekStart.add(i, "day")),
    [weekStart],
  );

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
    const originByKey = new Map(weekData.items.map((item) => [itemKey(item), item]));
    return draftItems.some((item) => {
      const origin = originByKey.get(itemKey(item));
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

  /** 员工行 × 日期列 */
  const employeeRows = useMemo(() => {
    const byEmp = new Map<string, EmployeeRow>();
    for (const item of draftItems) {
      const empId = String(item.merchantAdminId);
      let row = byEmp.get(empId);
      if (!row) {
        row = {
          merchantAdminId: empId,
          employeeName: item.employeeName || "—",
          byDate: new Map(),
          totalMinutes: 0,
        };
        byEmp.set(empId, row);
      }
      const dateKey = item.scheduleDate;
      const list = row.byDate.get(dateKey) || [];
      list.push(item);
      row.byDate.set(dateKey, list);
      if (item.attended === 1) {
        row.totalMinutes += item.confirmedNetMinutes || 0;
      }
    }
    for (const row of byEmp.values()) {
      for (const list of row.byDate.values()) {
        list.sort((a, b) =>
          (a.confirmedStartTime || "").localeCompare(b.confirmedStartTime || ""),
        );
      }
    }
    return Array.from(byEmp.values()).sort((a, b) =>
      a.employeeName.localeCompare(b.employeeName, locale === "zh" ? "zh" : "en"),
    );
  }, [draftItems, locale]);

  const totalConfirmedMinutes = employeeRows.reduce((sum, row) => sum + row.totalMinutes, 0);

  const renderShiftCard = (item: AttendanceConfirmItem) => {
    const attended = item.attended === 1;
    const meta =
      [item.areaName, item.shiftName].filter(Boolean).join(" · ") ||
      `${item.plannedStartTime}-${item.plannedEndTime}`;
    return (
      <div
        key={itemKey(item)}
        className="attendance-confirm-cell rounded-md min-w-0"
        style={{
          padding: 6,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          background: attended ? "var(--secondary)" : "var(--muted)",
          border: `1px solid ${attended ? "var(--border)" : "transparent"}`,
          opacity: attended ? 1 : 0.7,
        }}
      >
        <div
          className="flex items-center gap-1 min-w-0"
          style={{ height: 20 }}
        >
          <Tooltip title={isZh ? "出勤" : "Attended"}>
            <Checkbox
              checked={attended}
              onChange={(e) =>
                updateItem(item.publishedCellId, item.merchantAdminId, {
                  attended: e.target.checked ? 1 : 0,
                })
              }
            />
          </Tooltip>
          <span
            className="truncate flex-1 text-[10px] leading-none"
            style={{ color: "var(--muted-foreground)" }}
            title={meta}
          >
            {meta}
          </span>
          <span
            className="text-[10px] font-semibold tabular-nums flex-shrink-0"
            style={{ color: "var(--primary)" }}
          >
            {minutesToHoursLabel(item.confirmedNetMinutes || 0, isZh)}
          </span>
        </div>

        <div className="attendance-confirm-fields">
          <span className="attendance-confirm-label">{isZh ? "起" : "In"}</span>
          <TimePicker
            size="small"
            format="HH:mm"
            allowClear={false}
            inputReadOnly
            suffixIcon={null}
            disabled={!attended}
            value={dayjs(item.confirmedStartTime, "HH:mm") as Dayjs}
            onChange={(v) =>
              updateItem(item.publishedCellId, item.merchantAdminId, {
                confirmedStartTime: v ? v.format("HH:mm") : item.confirmedStartTime,
              })
            }
          />
          <span className="attendance-confirm-label">{isZh ? "止" : "Out"}</span>
          <TimePicker
            size="small"
            format="HH:mm"
            allowClear={false}
            inputReadOnly
            suffixIcon={null}
            disabled={!attended}
            value={dayjs(item.confirmedEndTime, "HH:mm") as Dayjs}
            onChange={(v) =>
              updateItem(item.publishedCellId, item.merchantAdminId, {
                confirmedEndTime: v ? v.format("HH:mm") : item.confirmedEndTime,
              })
            }
          />
          <span className="attendance-confirm-label">{isZh ? "休" : "Br"}</span>
          <div className="attendance-confirm-span">
            <InputNumber
              size="small"
              min={0}
              controls={false}
              disabled={!attended}
              value={item.confirmedBreakMinutes}
              onChange={(v) =>
                updateItem(item.publishedCellId, item.merchantAdminId, {
                  confirmedBreakMinutes: typeof v === "number" ? v : 0,
                })
              }
            />
          </div>
          <span className="attendance-confirm-label">{isZh ? "注" : "Nt"}</span>
          <div className="attendance-confirm-span">
            <Input
              size="small"
              placeholder="—"
              value={item.note || ""}
              onChange={(e) =>
                updateItem(item.publishedCellId, item.merchantAdminId, {
                  note: e.target.value,
                })
              }
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <style>{`
        .attendance-confirm-fields {
          display: grid;
          grid-template-columns: 14px minmax(0, 1fr) 14px minmax(0, 1fr);
          column-gap: 4px;
          row-gap: 4px;
          align-items: center;
        }
        .attendance-confirm-span {
          grid-column: 2 / -1;
          min-width: 0;
        }
        .attendance-confirm-label {
          font-size: 10px;
          line-height: 1;
          color: var(--muted-foreground);
          text-align: center;
          user-select: none;
        }
        .attendance-confirm-cell .ant-checkbox-wrapper {
          margin-inline-end: 0;
          line-height: 1;
        }
        .attendance-confirm-cell .ant-checkbox {
          top: 0;
        }
        .attendance-confirm-cell .ant-picker,
        .attendance-confirm-cell .ant-input-number,
        .attendance-confirm-cell .ant-input {
          width: 100% !important;
          min-width: 0 !important;
          height: 24px !important;
        }
        .attendance-confirm-cell .ant-picker-input > input,
        .attendance-confirm-cell .ant-input-number-input,
        .attendance-confirm-cell .ant-input {
          font-size: 11px !important;
          line-height: 22px !important;
          text-align: center;
          padding: 0 4px !important;
        }
        .attendance-confirm-cell .ant-picker-suffix,
        .attendance-confirm-cell .ant-picker-clear {
          display: none !important;
        }
        .attendance-confirm-cell .ant-input-number-handler-wrap {
          display: none !important;
        }
      `}</style>
      <div
        className="flex items-center justify-between px-3 py-2.5 flex-shrink-0 gap-3 flex-wrap"
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
                if (next.isBefore(currentWeekMonday, "day")) {
                  setWeekStart(next);
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

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-3 py-3">
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
          <div className="flex flex-col gap-3 min-w-0">
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

            <div
              className="rounded-xl overflow-hidden min-w-0 w-full"
              style={{
                border: "1px solid var(--border)",
                background: "var(--card)",
              }}
            >
              <table
                className="border-collapse w-full"
                style={{ tableLayout: "fixed", width: "100%" }}
              >
                <colgroup>
                  <col style={{ width: "11%" }} />
                  {weekDates.map((date) => (
                    <col key={date.format("YYYY-MM-DD")} style={{ width: "12%" }} />
                  ))}
                  <col style={{ width: "5%" }} />
                </colgroup>
                <thead>
                  <tr style={{ background: "var(--muted)" }}>
                    <th
                      className="px-1.5 py-2 text-left text-xs font-semibold"
                      style={{
                        color: "var(--foreground)",
                        borderBottom: "1px solid var(--border)",
                        borderRight: "1px solid var(--border)",
                        background: "var(--muted)",
                      }}
                    >
                      {isZh ? "员工" : "Employee"}
                    </th>
                    {weekDates.map((date, index) => (
                      <th
                        key={date.format("YYYY-MM-DD")}
                        className="px-0.5 py-2 text-center text-[11px] font-semibold"
                        style={{
                          color: "var(--foreground)",
                          borderBottom: "1px solid var(--border)",
                          borderRight: "1px solid var(--border)",
                        }}
                      >
                        <div>{dayLabels[index]}</div>
                        <div
                          className="font-normal truncate"
                          style={{ color: "var(--muted-foreground)" }}
                        >
                          {formatCountryDate(date, dateFormatCountry)}
                        </div>
                      </th>
                    ))}
                    <th
                      className="px-1 py-2 text-center text-[11px] font-semibold"
                      style={{
                        color: "var(--foreground)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      {isZh ? "合计" : "Total"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {employeeRows.map((row) => (
                    <tr key={row.merchantAdminId}>
                      <td
                        className="px-1.5 py-1.5 align-top text-xs font-semibold break-words"
                        style={{
                          color: "var(--foreground)",
                          borderBottom: "1px solid var(--border)",
                          borderRight: "1px solid var(--border)",
                          background: "var(--card)",
                          wordBreak: "break-word",
                        }}
                      >
                        {row.employeeName}
                      </td>
                      {weekDates.map((date) => {
                        const dateKey = date.format("YYYY-MM-DD");
                        const cells = row.byDate.get(dateKey) || [];
                        return (
                          <td
                            key={dateKey}
                            className="px-0.5 py-1 align-top min-w-0"
                            style={{
                              borderBottom: "1px solid var(--border)",
                              borderRight: "1px solid var(--border)",
                              verticalAlign: "top",
                            }}
                          >
                            {cells.length === 0 ? (
                              <div
                                className="text-[11px] text-center py-3"
                                style={{ color: "var(--muted-foreground)" }}
                              >
                                —
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1 min-w-0">
                                {cells.map((item) => renderShiftCard(item))}
                              </div>
                            )}
                          </td>
                        );
                      })}
                      <td
                        className="px-1 py-1.5 align-top text-center text-[11px] font-medium"
                        style={{
                          color: "var(--primary)",
                          borderBottom: "1px solid var(--border)",
                        }}
                      >
                        {minutesToHoursLabel(row.totalMinutes, isZh)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
