import {
  Avatar,
  Button,
  Input,
  Modal,
  Popconfirm,
  Radio,
  Select,
  TimePicker,
  Tooltip,
} from "antd";
import dayjs from "dayjs";
import isoWeek from "dayjs/plugin/isoWeek";
import weekOfYear from "dayjs/plugin/weekOfYear";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clock,
  Download,
  Edit2,
  GripVertical,
  Info,
  LayoutTemplate,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import {
  ColorSwatchPicker,
  DEFAULT_COLOR_KEY,
  getSoftColorStyle,
} from "../components/ColorSwatchPicker";
import {
  useData,
  type Area,
  type RosterTemplate,
  type ScheduleShift,
} from "../context/DataContext";
import { useLocale } from "../context/LocaleContext";
import { useStore } from "../context/StoreContext";
import { formatCountryDate } from "../lib/dateFormat";
import { getDatedShiftAvailabilityWarning } from "../lib/employeeAvailability";
import {
  getEmployeeAvatarUrl,
  getEmployeeInitials,
} from "../lib/employeeAvatar";
import { calcShiftHours, datedShiftsOverlap } from "../lib/shift";
import { isStoreClosedOnWeekday } from "../lib/storeHours";

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);

const { Option } = Select;

// ─── Helpers ───────────────────────────────────────────────────────────────────

const formatTime12 = (t: string) => {
  if (!t) return "";
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")}${ampm}`;
};

const calcHours = (start: string, end: string, brk = 0) =>
  calcShiftHours(start, end, brk);

const getShiftEmployeeIds = (
  shift: Pick<ScheduleShift, "employeeId" | "employeeIds">,
) =>
  shift.employeeIds?.length
    ? shift.employeeIds
    : shift.employeeId
      ? [shift.employeeId]
      : [];

const getColorStyle = (color: string) => getSoftColorStyle(color);

const WEEK_DAY_LABELS_ZH = ["一", "二", "三", "四", "五", "六", "日"];
const WEEK_DAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const makeShiftPresetKey = ({
  shiftType = "store",
  storeId = "",
  shiftName = "",
  startTime,
  endTime,
  color,
}: {
  shiftType?: string;
  storeId?: string;
  shiftName?: string;
  startTime: string;
  endTime: string;
  color: string;
}) =>
  `${shiftType}::${storeId}::${shiftName}::${startTime}::${endTime}::${color}`;

interface ShiftPresetOption {
  key: string;
  shiftId?: string;
  shiftName: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  color: string;
  shiftType: "store" | "general";
  storeId: string;
}

type TemplateConflictStrategy =
  | "overwrite_slot"
  | "merge_old"
  | "merge_new"
  | "replace_range";

interface TemplateCandidateShift {
  candidateKey: string;
  slotKey: string;
  shiftId?: string;
  employeeId: string;
  employeeIds: string[];
  areaId: string;
  storeId: string;
  shiftType: "store" | "general";
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  shiftName: string;
  color: string;
  note: string;
}

interface TemplateApplyPlan {
  templateId: string;
  templateName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  storeId: string;
  coveredAreaIds: string[];
  coveredDates: string[];
  touchedSlotKeys: string[];
  occupiedSlotKeys: string[];
  rangeExistingShiftIds: string[];
  overlapExistingShiftIds: string[];
  candidateShifts: TemplateCandidateShift[];
}

const makeAreaDateKey = (areaId: string, date: string) => `${areaId}::${date}`;

const shiftConflictsWithTemplateCandidate = (
  shift: Pick<
    ScheduleShift,
    "areaId" | "date" | "startTime" | "endTime" | "employeeId" | "employeeIds"
  >,
  candidate: TemplateCandidateShift,
  checkAreaOverlap = true,
) => {
  const candidateEmployeeIds =
    candidate.employeeIds.length > 0
      ? candidate.employeeIds
      : candidate.employeeId
        ? [candidate.employeeId]
        : [];
  const shiftEmployeeIds = getShiftEmployeeIds(shift);
  const sameEmployeeOverlap =
    candidateEmployeeIds.some((employeeId) =>
      shiftEmployeeIds.includes(employeeId),
    ) && datedShiftsOverlap(candidate, shift);
  const sameAreaOverlap =
    checkAreaOverlap &&
    shift.areaId === candidate.areaId &&
    shift.date === candidate.date &&
    datedShiftsOverlap(candidate, shift);
  return sameEmployeeOverlap || sameAreaOverlap;
};

// ─── RosterTemplateCard — display-only shape derived from shared RosterTemplate ─

interface RosterTemplateCard {
  id: string;
  name: string;
  storeId: string;
  type: string; // e.g. "1 week" / "2 weeks" — derived from totalDays
  color: string; // first cell color or "blue"
  shifts: {
    name: string;
    startTime: string;
    endTime: string;
    color: string;
  }[];
}

/** Convert a shared RosterTemplate (from DataContext) into a display card */
function toTemplateCard(t: RosterTemplate): RosterTemplateCard {
  const weeks = Math.round(t.totalDays / 7);
  const typeLabel = weeks === 1 ? `1 week` : `${weeks} weeks`;
  // Collect unique shift signatures for display (first occurrence per label+time)
  const seen = new Set<string>();
  const shifts: RosterTemplateCard["shifts"] = [];
  for (const cell of t.cells) {
    const key = `${cell.label}|${cell.startTime}|${cell.endTime}`;
    if (!seen.has(key)) {
      seen.add(key);
      shifts.push({
        name: cell.label || cell.startTime,
        startTime: cell.startTime,
        endTime: cell.endTime,
        color: cell.color,
      });
    }
  }
  const firstColor = t.cells[0]?.color || DEFAULT_COLOR_KEY;
  return {
    id: t.id,
    name: t.name,
    storeId: t.storeId,
    type: typeLabel,
    color: firstColor,
    shifts,
  };
}

// ─── TemplateCard (draggable) ─────────────────────────────────────────────────

interface TemplateCardProps {
  template?: RosterTemplateCard;
  onDragStart?: (id: string) => void;
  onDragEnd?: () => void;
}

function TemplateCard({
  template,
  onDragStart = () => {},
  onDragEnd = () => {},
}: TemplateCardProps) {
  if (!template) return null;
  const cs = getColorStyle(template.color);
  return (
    <div
      data-cmp="TemplateCard"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("templateId", template.id);
        e.dataTransfer.effectAllowed = "copy";
        onDragStart(template.id);
        console.log("[Rosters] drag template start:", template.id);
      }}
      onDragEnd={onDragEnd}
      className="rounded-xl p-3 mb-2 cursor-grab active:cursor-grabbing select-none transition-all hover:shadow-custom"
      style={{ background: "var(--card)", border: `1px solid var(--border)` }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="flex items-center justify-center rounded-lg"
            style={{
              width: 30,
              height: 30,
              background: cs.bg,
              border: `1.5px solid ${cs.border}`,
            }}
          >
            <CalendarDays size={14} style={{ color: cs.text }} />
          </div>
          <div>
            <div
              className="text-sm font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              {template.name}
            </div>
            <div
              className="text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              {template.type}
            </div>
          </div>
        </div>
        <GripVertical size={14} style={{ color: "var(--muted-foreground)" }} />
      </div>
      <div className="flex flex-wrap gap-1">
        {template.shifts.map((s, i) => {
          const sc = getColorStyle(s.color);
          return (
            <div
              key={i}
              className="flex items-center gap-0.5 rounded-full px-2 py-0.5"
              style={{ background: sc.bg, border: `1px solid ${sc.border}` }}
            >
              <Clock size={8} style={{ color: sc.text }} />
              <span style={{ fontSize: 9, color: sc.text }}>
                {s.name} {formatTime12(s.startTime)}-{formatTime12(s.endTime)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── ShiftEntry (inside a cell) ───────────────────────────────────────────────

interface ShiftEntryProps {
  shift?: ScheduleShift;
  /** List of employees assigned to this shift */
  assignedEmployees?: {
    id: string;
    name: string;
    color: string;
    avatarUrl?: string;
    availabilityWarning?: string | null;
  }[];
  onEdit?: () => void;
  onDelete?: () => void;
  /** Called when an employee is removed from the shift via X button */
  onRemoveEmployee?: (empId: string) => void;
  /** Called when an employee card is dropped onto this shift */
  onDropEmployee?: (empId: string) => void;
  /** Called when a template card is dropped onto this shift */
  onDropTemplate?: (templateId: string) => void;
  /** Opens the shift editor so employees can be selected without dragging */
  onAddEmployeeClick?: () => void;
}

function ShiftEntry({
  shift,
  assignedEmployees = [],
  onEdit = () => {},
  onDelete = () => {},
  onRemoveEmployee = () => {},
  onDropEmployee = () => {},
  onDropTemplate = () => {},
  onAddEmployeeClick = () => {},
}: ShiftEntryProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const { locale } = useLocale();
  if (!shift) return null;
  const cs = getColorStyle(shift.color);
  const hrs = calcHours(shift.startTime, shift.endTime, shift.breakMinutes);

  return (
    <div
      data-cmp="ShiftEntry"
      className="rounded-lg mb-1 relative group"
      style={{
        background: isDragOver ? "var(--secondary)" : cs.bg,
        border: `1.5px solid ${isDragOver ? "var(--primary)" : cs.border}`,
        padding: "4px 6px",
        transition: "all 0.15s",
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragOver(false);
        const templateId = e.dataTransfer.getData("templateId");
        if (templateId) {
          onDropTemplate(templateId);
          return;
        }
        const empId = e.dataTransfer.getData("employeeId");
        if (empId) onDropEmployee(empId);
      }}
    >
      {/* Top row: employee pills + action buttons */}
      <div className="flex items-center justify-between mb-0.5">
        <div className="flex items-center gap-0.5 min-w-0 flex-1 flex-wrap">
          {assignedEmployees.length > 0 ? (
            assignedEmployees.map((emp) => (
              <Tooltip
                key={emp.id}
                title={emp.availabilityWarning || undefined}
              >
                <div
                  className="flex items-center gap-0.5 rounded-md px-1 py-0.5"
                  style={{
                    background: "var(--card)",
                    border: emp.availabilityWarning
                      ? "1px solid var(--destructive)"
                      : "1px solid transparent",
                  }}
                >
                  <Avatar
                    size={13}
                    src={emp.avatarUrl || undefined}
                    style={{
                      background: emp.color,
                      flexShrink: 0,
                      fontSize: 7,
                    }}
                  >
                    {getEmployeeInitials(emp.name)}
                  </Avatar>
                  <span
                    className="text-xs truncate"
                    style={{
                      color: emp.availabilityWarning
                        ? "var(--destructive)"
                        : "var(--foreground)",
                      maxWidth: 72,
                      fontSize: 10,
                      fontWeight: emp.availabilityWarning ? 700 : 400,
                    }}
                  >
                    {emp.name}
                  </span>
                  {emp.availabilityWarning && (
                    <AlertTriangle
                      size={9}
                      style={{ color: "var(--destructive)", flexShrink: 0 }}
                    />
                  )}
                  <button
                    onClick={() => onRemoveEmployee(emp.id)}
                    className="rounded-full hover:opacity-70"
                    style={{ color: "var(--muted-foreground)", flexShrink: 0 }}
                  >
                    <X size={9} />
                  </button>
                </div>
              </Tooltip>
            ))
          ) : (
            <span
              className="text-xs font-semibold truncate"
              style={{ color: cs.text, maxWidth: 90, fontSize: 10 }}
            >
              {shift.shiftName || formatTime12(shift.startTime)}
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <button
            onClick={onEdit}
            className="rounded p-0.5 hover:opacity-70"
            style={{ color: "var(--muted-foreground)" }}
          >
            <Edit2 size={10} />
          </button>
          <Popconfirm
            title={locale === "zh" ? "确认删除该班次？" : "Delete this shift?"}
            onConfirm={onDelete}
            okText={locale === "zh" ? "是" : "Yes"}
            cancelText={locale === "zh" ? "否" : "No"}
            placement="topRight"
          >
            <button
              className="rounded p-0.5 hover:opacity-70"
              style={{ color: "var(--destructive)" }}
            >
              <Trash2 size={10} />
            </button>
          </Popconfirm>
        </div>
      </div>

      {/* Time + hours badge */}
      <div className="flex items-center gap-1">
        <Clock size={8} style={{ color: cs.text }} />
        <span style={{ fontSize: 9, color: cs.text }}>
          {formatTime12(shift.startTime)} – {formatTime12(shift.endTime)}
        </span>
        <span
          className="rounded-full px-1 ml-auto font-semibold"
          style={{
            fontSize: 8,
            background: cs.border,
            color: "var(--primary-foreground)",
          }}
        >
          {hrs}h
        </span>
      </div>

      {/* Shift label when employees are present */}
      {assignedEmployees.length > 0 && shift.shiftName && (
        <div
          className="mt-0.5 truncate"
          style={{ fontSize: 9, color: cs.text, fontWeight: 600 }}
        >
          {shift.shiftName}
        </div>
      )}

      {/* Drop hint / add employee button */}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onAddEmployeeClick();
        }}
        className="w-full flex items-center justify-center rounded-md mt-0.5 transition-all hover:opacity-80"
        style={{
          border: `1px dashed ${isDragOver ? "var(--primary)" : cs.border}`,
          padding: "2px 4px",
          background: isDragOver ? "var(--secondary)" : "transparent",
          cursor: "pointer",
          position: "relative",
          zIndex: 1,
        }}
      >
        <span
          style={{
            color: isDragOver ? "var(--primary)" : cs.text,
            fontSize: 9,
          }}
        >
          {assignedEmployees.length > 0
            ? locale === "zh"
              ? `+ 添加员工`
              : `+ add employee`
            : locale === "zh"
              ? `选择员工`
              : `select employee`}
        </span>
      </button>
    </div>
  );
}

// ─── DateColHeader (droppable for templates) ──────────────────────────────────

interface DateColHeaderProps {
  date?: dayjs.Dayjs;
  dayLabel?: string;
  isToday?: boolean;
  isClosedDay?: boolean;
  dateFormatCountry?: string;
  onDropTemplate?: (templateId: string, dateStr: string) => void;
  shiftCount?: number;
}

function DateColHeader({
  date,
  dayLabel = "",
  isToday = false,
  isClosedDay = false,
  dateFormatCountry = "",
  onDropTemplate = () => {},
  shiftCount = 0,
}: DateColHeaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const { locale } = useLocale();

  const handleDragOver = (e: React.DragEvent) => {
    if (e.dataTransfer.types.includes("templateid")) {
      e.preventDefault();
      setIsDragOver(true);
    } else {
      e.preventDefault();
      setIsDragOver(true);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const templateId = e.dataTransfer.getData("templateId");
    if (templateId && date) {
      onDropTemplate(templateId, date.format("YYYY-MM-DD"));
    }
  };

  return (
    <div
      data-cmp="DateColHeader"
      className="flex-shrink-0 flex flex-col items-center justify-center relative transition-all"
      style={{
        width: 160,
        minHeight: 44,
        borderRight: "1px solid var(--border)",
        background: isDragOver
          ? "var(--accent)"
          : isToday
            ? "var(--primary)"
            : isClosedDay
              ? "var(--workday-weekend-header)"
              : "var(--card)",
        cursor: isDragOver ? "copy" : "default",
        border: isDragOver ? `2px dashed var(--primary)` : undefined,
      }}
      onDragOver={handleDragOver}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleDrop}
    >
      {isDragOver && (
        <div
          className="absolute inset-0 flex items-center justify-center rounded"
          style={{ background: "var(--secondary)", zIndex: 2 }}
        >
          <div className="flex flex-col items-center gap-0.5">
            <Download size={14} style={{ color: "var(--primary)" }} />
            <span
              style={{ fontSize: 10, color: "var(--primary)", fontWeight: 600 }}
            >
              {locale === "zh" ? "应用到本日" : "Apply to day"}
            </span>
          </div>
        </div>
      )}
      <span
        className="text-xs font-medium"
        style={{
          color: isToday
            ? "var(--primary-foreground)"
            : isClosedDay
              ? "var(--workday-weekend-text)"
              : "var(--muted-foreground)",
        }}
      >
        {date ? formatCountryDate(date, dateFormatCountry) : ""}
      </span>
      <span
        className="font-bold"
        style={{
          fontSize: 15,
          color: isToday
            ? "var(--primary-foreground)"
            : isClosedDay
              ? "var(--workday-weekend-text)"
              : "var(--foreground)",
        }}
      >
        {dayLabel}
      </span>
      {shiftCount > 0 && !isDragOver && (
        <div
          className="rounded-full flex items-center justify-center mt-0.5"
          style={{
            minWidth: 16,
            height: 16,
            background: isToday
              ? "var(--primary-foreground)"
              : "var(--primary)",
            padding: "0 4px",
          }}
        >
          <span
            style={{
              fontSize: 9,
              color: isToday ? "var(--primary)" : "var(--primary-foreground)",
              fontWeight: 700,
            }}
          >
            {shiftCount}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── AreaDateCell (droppable for employees & templates) ───────────────────────

interface AreaDateCellProps {
  date?: dayjs.Dayjs;
  areaId?: string;
  shifts?: ScheduleShift[];
  employees?: {
    id: string;
    name: string;
    color: string;
    avatarUrl?: string;
    availabilityWarning?: string | null;
  }[];
  onAddShift?: (areaId: string, date: string) => void;
  onEditShift?: (shift: ScheduleShift) => void;
  onDeleteShift?: (id: string) => void;
  onRemoveEmployeeFromShift?: (shiftId: string, empId: string) => void;
  onDropEmployee?: (empId: string, areaId: string, date: string) => void;
  onDropEmployeeToShift?: (empId: string, shift: ScheduleShift) => void;
  onDropTemplate?: (templateId: string) => void;
  getAvailabilityWarning?: (
    empId: string,
    shift: ScheduleShift,
  ) => string | null;
  isToday?: boolean;
  isClosedDay?: boolean;
}

function AreaDateCell({
  date,
  areaId = "",
  shifts = [],
  employees = [],
  onAddShift = () => {},
  onEditShift = () => {},
  onDeleteShift = () => {},
  onRemoveEmployeeFromShift = () => {},
  onDropEmployee = () => {},
  onDropEmployeeToShift = () => {},
  onDropTemplate = () => {},
  getAvailabilityWarning = () => null,
  isToday = false,
  isClosedDay = false,
}: AreaDateCellProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const { locale } = useLocale();

  const empMap: Record<
    string,
    {
      name: string;
      color: string;
      avatarUrl?: string;
      availabilityWarning?: string | null;
    }
  > = {};
  employees.forEach((e) => {
    empMap[e.id] = { name: e.name, color: e.color, avatarUrl: e.avatarUrl };
  });

  const handleCellDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const templateId = e.dataTransfer.getData("templateId");
    const empId = e.dataTransfer.getData("employeeId");
    if (templateId) {
      onDropTemplate(templateId);
    } else if (empId) {
      const dateStr = date?.format("YYYY-MM-DD") || "";
      // Drop onto the cell itself (no specific shift) → create a new shift for this employee
      onDropEmployee(empId, areaId, dateStr);
    }
  };

  return (
    <div
      data-cmp="AreaDateCell"
      className="flex-shrink-0 p-1.5"
      style={{
        width: 160,
        minHeight: 88,
        borderRight: "1px solid var(--border)",
        background: isDragOver
          ? "var(--secondary)"
          : isToday
            ? "var(--workday-active-bg)"
            : isClosedDay
              ? "var(--workday-weekend-header)"
              : "transparent",
        transition: "background 0.12s",
        outline: isDragOver ? `2px dashed var(--primary)` : undefined,
        outlineOffset: -2,
      }}
      onDragOver={(e) => {
        // Only accept if no shift is being targeted (handled by ShiftEntry itself)
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleCellDrop}
    >
      {/* Empty drop hint shown when dragging over empty cell */}
      {isDragOver && shifts.length === 0 && (
        <div
          className="flex items-center justify-center rounded-lg mb-1"
          style={{
            height: 40,
            border: "1.5px dashed var(--primary)",
            background: "var(--secondary)",
          }}
        >
          <span style={{ color: "var(--primary)", fontSize: 9 }}>
            {locale === "zh" ? "放置到此处" : "Drop here"}
          </span>
        </div>
      )}

      {/* Shift entries — each shift can also receive employee drops */}
      {shifts.map((sh) => {
        const assignedEmps = getShiftEmployeeIds(sh).map((empId) => ({
          id: empId,
          name: empMap[empId]?.name || empId,
          color: empMap[empId]?.color || "var(--primary)",
          avatarUrl: empMap[empId]?.avatarUrl || "",
          availabilityWarning: getAvailabilityWarning(empId, sh),
        }));
        return (
          <ShiftEntry
            key={sh.id}
            shift={sh}
            assignedEmployees={assignedEmps}
            onEdit={() => onEditShift(sh)}
            onDelete={() => onDeleteShift(sh.id)}
            onRemoveEmployee={(empId) =>
              onRemoveEmployeeFromShift(sh.id, empId)
            }
            onDropEmployee={(empId) => onDropEmployeeToShift(empId, sh)}
            onDropTemplate={onDropTemplate}
            onAddEmployeeClick={() => onEditShift(sh)}
          />
        );
      })}

      {/* Add shift button — matches RosterTemplate's dashed pill button style */}
      <button
        onClick={() => onAddShift(areaId, date?.format("YYYY-MM-DD") || "")}
        className="w-full rounded-lg flex items-center justify-center gap-0.5 transition-all hover:opacity-80"
        style={{
          height: 22,
          border: "1.5px dashed var(--border)",
          color: "var(--muted-foreground)",
          background: "transparent",
          fontSize: 10,
        }}
      >
        <Plus size={10} />
        <span style={{ fontSize: 10 }}>
          {locale === "zh" ? "加班次" : "Add shift"}
        </span>
      </button>
    </div>
  );
}

// ─── Main ──────────────────────────────────────────────────────────────────────

interface RostersProps {
  onSave?: () => void;
}

export default function Rosters({ onSave = () => {} }: RostersProps) {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const {
    employees,
    scheduleShifts,
    setScheduleShifts,
    saveScheduleDraft,
    publishSchedule,
    stores,
    areas,
    rosterTemplates: rawRosterTemplates,
  } = useData();
  const { selectedStoreId } = useStore();

  // ── Week navigation ─────────────────────────────────────────────────────────
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = dayjs()
    .startOf("isoWeek")
    .add(weekOffset * 7, "day");
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    weekStart.add(i, "day"),
  );
  const todayStr = dayjs().format("YYYY-MM-DD");
  const selectedStore =
    stores.find((store) => store.id === selectedStoreId) || stores[0];
  const dateFormatCountry = selectedStore?.country;
  const isStoreClosedDate = (date: dayjs.Dayjs) =>
    isStoreClosedOnWeekday(selectedStore, date.isoWeekday());

  // ── Left panel state ────────────────────────────────────────────────────────
  const [leftTab, setLeftTab] = useState<"templates" | "employees">(
    "templates",
  );
  const [templateSearch, setTemplateSearch] = useState("");
  const [employeeSearch, setEmployeeSearch] = useState("");

  // Convert shared RosterTemplate[] → display RosterTemplateCard[] (derived, not stored in state)
  const rosterTemplates: RosterTemplateCard[] =
    rawRosterTemplates.map(toTemplateCard);

  // ── Drag state ──────────────────────────────────────────────────────────────
  const [draggingTemplateId, setDraggingTemplateId] = useState<string | null>(
    null,
  );
  const [templateConflictModalOpen, setTemplateConflictModalOpen] =
    useState(false);
  const [pendingTemplatePlan, setPendingTemplatePlan] =
    useState<TemplateApplyPlan | null>(null);
  const [templateConflictStrategy, setTemplateConflictStrategy] =
    useState<TemplateConflictStrategy>("merge_old");
  const templateApplySeedRef = useRef(0);
  const nextCreatedShiftIdRef = useRef(0);

  // ── Shift modal ─────────────────────────────────────────────────────────────
  const [modalOpen, setModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ScheduleShift | null>(null);
  const [shiftForm, setShiftForm] = useState({
    presetKey: "",
    shiftId: "",
    employeeIds: [] as string[],
    employeeId: "",
    areaId: "",
    date: "",
    shiftType: "store" as "store" | "general",
    startTime: "09:00",
    endTime: "17:00",
    breakMinutes: 30,
    shiftName: "",
    color: DEFAULT_COLOR_KEY,
    note: "",
    storeId: "",
  });

  // ── Computed ────────────────────────────────────────────────────────────────
  const activeEmployees = employees.filter((e) => e.status === "active");

  // Areas: use shared base area data from context
  const displayAreas: Area[] = areas
    .filter(
      (area) =>
        !selectedStoreId ||
        (area.areaType || "store") === "general" ||
        area.storeId === selectedStoreId,
    )
    .sort((a, b) => a.order - b.order);

  const filteredTemplates = rosterTemplates.filter(
    (t) =>
      (!selectedStoreId || t.storeId === selectedStoreId) &&
      (!templateSearch ||
        t.name.toLowerCase().includes(templateSearch.toLowerCase())),
  );
  const filteredEmployees = activeEmployees.filter(
    (e) =>
      !employeeSearch ||
      `${e.firstName} ${e.lastName}`
        .toLowerCase()
        .includes(employeeSearch.toLowerCase()),
  );

  const empNameMap: Record<string, string> = {};
  const empColorMap: Record<string, string> = {};
  employees.forEach((e) => {
    empNameMap[e.id] = `${e.firstName} ${e.lastName}`;
    empColorMap[e.id] = e.employeeColor || "var(--primary)";
  });

  const findAvailabilityWarning = (
    empId: string,
    shift: Pick<ScheduleShift, "date" | "startTime" | "endTime">,
  ) => {
    const employee = activeEmployees.find((item) => item.id === empId);
    if (!employee) return null;
    return getDatedShiftAvailabilityWarning(employee, shift, locale);
  };

  const allEmpList = employees.map((e) => ({
    id: e.id,
    name: `${e.firstName} ${e.lastName}`,
    color: e.employeeColor || "var(--primary)",
    avatarUrl: getEmployeeAvatarUrl(e),
  }));

  const modalStoreId =
    shiftForm.storeId ||
    selectedStoreId ||
    areas.find((area) => area.id === shiftForm.areaId)?.storeId ||
    "";

  const shiftPresetMap: Record<string, ShiftPresetOption> = {};
  scheduleShifts.forEach((shift) => {
    if (!shift.isGlobalPreset) return;

    const shiftType = shift.shiftType || "store";
    const belongsToStore =
      shiftType === "general" ||
      !modalStoreId ||
      shift.storeId === modalStoreId;
    if (!belongsToStore) return;

    const shiftName = (shift.shiftName || "").trim();
    if (!shiftName) return;

    const key = makeShiftPresetKey({
      shiftType,
      storeId: shift.storeId,
      shiftName,
      startTime: shift.startTime,
      endTime: shift.endTime,
      color: shift.color,
    });

    if (!shiftPresetMap[key]) {
      shiftPresetMap[key] = {
        key,
        shiftId: shift.shiftId,
        shiftName,
        startTime: shift.startTime,
        endTime: shift.endTime,
        breakMinutes: shift.breakMinutes,
        color: shift.color,
        shiftType,
        storeId: shift.storeId,
      };
    }
  });

  const shiftPresetOptions = Object.values(shiftPresetMap).sort((a, b) => {
    return (
      a.shiftName.localeCompare(b.shiftName) ||
      a.startTime.localeCompare(b.startTime) ||
      a.endTime.localeCompare(b.endTime)
    );
  });

  const modalShiftPresetOptions = [...shiftPresetOptions];
  const currentShiftName = (shiftForm.shiftName || "").trim();

  if (currentShiftName) {
    const currentKey = makeShiftPresetKey({
      shiftType: editingShift?.shiftType || "store",
      storeId: shiftForm.storeId || editingShift?.storeId || "",
      shiftName: currentShiftName,
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      color: shiftForm.color,
    });

    if (!modalShiftPresetOptions.some((option) => option.key === currentKey)) {
      modalShiftPresetOptions.unshift({
        key: currentKey,
        shiftId: shiftForm.shiftId || editingShift?.shiftId,
        shiftName: currentShiftName,
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        breakMinutes: shiftForm.breakMinutes,
        color: shiftForm.color,
        shiftType: editingShift?.shiftType || "store",
        storeId: shiftForm.storeId || editingShift?.storeId || "",
      });
    }
  }

  // Get shifts for area × date
  const getShifts = useCallback(
    (areaId: string, dateStr: string): ScheduleShift[] =>
      scheduleShifts.filter((s) => {
        const matchArea = s.areaId === areaId;
        const matchDate = s.date === dateStr;
        const matchStore = !selectedStoreId || s.storeId === selectedStoreId;
        return matchArea && matchDate && matchStore;
      }),
    [scheduleShifts, selectedStoreId],
  );

  // Week shifts count per date (for header badge)
  const dateTotalShifts = (dateStr: string) =>
    scheduleShifts.filter(
      (s) =>
        s.date === dateStr &&
        (!selectedStoreId || s.storeId === selectedStoreId),
    ).length;

  // Weekly total hours per employee
  const weekHoursForEmp = (empId: string) =>
    weekDates
      .reduce((sum, d) => {
        const ss = scheduleShifts.filter(
          (s) =>
            getShiftEmployeeIds(s).includes(empId) &&
            s.date === d.format("YYYY-MM-DD") &&
            (!selectedStoreId || s.storeId === selectedStoreId),
        );
        return (
          sum +
          ss.reduce(
            (s2, sh) =>
              s2 +
              parseFloat(calcHours(sh.startTime, sh.endTime, sh.breakMinutes)),
            0,
          )
        );
      }, 0)
      .toFixed(1);

  const draftCount = scheduleShifts.filter((s) => {
    const d = dayjs(s.date);
    return (
      s.status === "draft" && d >= weekStart && d <= weekStart.add(6, "day")
    );
  }).length;

  const resolveTemplateCellPreset = (
    cell: RosterTemplate["cells"][number],
    storeId: string,
  ) => {
    if (cell.shiftId) {
      const matchedById = scheduleShifts.find(
        (shift) => shift.isGlobalPreset && shift.shiftId === cell.shiftId,
      );
      return {
        shiftId: cell.shiftId,
        breakMinutes: matchedById?.breakMinutes ?? 30,
        shiftName: matchedById?.shiftName || cell.label || cell.startTime,
        color: cell.color || matchedById?.color || DEFAULT_COLOR_KEY,
      };
    }

    const cellLabel = (cell.label || cell.startTime).trim();
    const matchedPreset = scheduleShifts.find((shift) => {
      if (!shift.isGlobalPreset || !shift.shiftId) return false;
      const shiftType = shift.shiftType || "store";
      if (shiftType !== "general" && shift.storeId !== storeId) return false;
      return (
        (shift.shiftName || "").trim() === cellLabel &&
        shift.startTime === cell.startTime &&
        shift.endTime === cell.endTime &&
        (shift.color || "") === (cell.color || "")
      );
    });

    return {
      shiftId: matchedPreset?.shiftId,
      breakMinutes: matchedPreset?.breakMinutes ?? 30,
      shiftName: matchedPreset?.shiftName || cell.label || cell.startTime,
      color: cell.color || matchedPreset?.color || DEFAULT_COLOR_KEY,
    };
  };

  const buildTemplateApplyPlan = (
    templateId: string,
    startDate: string,
    targetAreaId: string | null,
  ) => {
    const rawTmpl = rawRosterTemplates.find(
      (template) => template.id === templateId,
    );
    if (!rawTmpl || !startDate) return null;

    const storeId = rawTmpl.storeId || selectedStoreId || stores[0]?.id || "s1";
    const visibleAreaIds = new Set(displayAreas.map((area) => area.id));
    const templateAreaIds = Array.from(
      new Set(
        (targetAreaId
          ? [targetAreaId]
          : rawTmpl.areaIds.length > 0
            ? rawTmpl.areaIds
            : rawTmpl.cells.map((cell) => cell.areaId)
        ).filter(Boolean),
      ),
    ).filter((areaId) => visibleAreaIds.has(areaId));
    const coveredDates = Array.from(
      { length: Math.max(rawTmpl.totalDays, 1) },
      (_, index) => dayjs(startDate).add(index, "day").format("YYYY-MM-DD"),
    );
    const coveredAreaSet = new Set(templateAreaIds);
    const coveredDateSet = new Set(coveredDates);
    const candidateShifts: TemplateCandidateShift[] = [];

    rawTmpl.cells.forEach((cell, cellIdx) => {
      const mappedAreaId = cell.areaId;
      if (!mappedAreaId) return;
      if (targetAreaId && mappedAreaId !== targetAreaId) return;
      if (!coveredAreaSet.has(mappedAreaId)) return;

      const targetDate = dayjs(startDate)
        .add(cell.dayIndex, "day")
        .format("YYYY-MM-DD");

      const employeeIds = Array.from(new Set(cell.employeeIds || [])).filter(
        Boolean,
      );
      const preset = resolveTemplateCellPreset(cell, storeId);

      candidateShifts.push({
        candidateKey: `${templateId}_${cell.id}_${cellIdx}`,
        slotKey: makeAreaDateKey(mappedAreaId, targetDate),
        shiftId: preset.shiftId,
        employeeId: employeeIds[0] || "",
        employeeIds,
        areaId: mappedAreaId,
        storeId,
        shiftType: "store",
        date: targetDate,
        startTime: cell.startTime,
        endTime: cell.endTime,
        breakMinutes: preset.breakMinutes,
        shiftName: preset.shiftName,
        color: preset.color,
        note:
          locale === "zh"
            ? `来自模版: ${rawTmpl.name}`
            : `From template: ${rawTmpl.name}`,
      });
    });

    const touchedSlotKeys = Array.from(
      new Set(candidateShifts.map((shift) => shift.slotKey)),
    );
    const touchedSlotSet = new Set(touchedSlotKeys);
    const occupiedSlotKeysSet = new Set<string>();
    const rangeExistingShiftIdsSet = new Set<string>();
    const overlapExistingShiftIdsSet = new Set<string>();

    scheduleShifts.forEach((shift) => {
      const slotKey = makeAreaDateKey(shift.areaId, shift.date);
      const inCoveredRange =
        coveredAreaSet.has(shift.areaId) && coveredDateSet.has(shift.date);
      if (inCoveredRange) {
        rangeExistingShiftIdsSet.add(shift.id);
        if (touchedSlotSet.has(slotKey)) {
          occupiedSlotKeysSet.add(slotKey);
        }
      }
    });

    candidateShifts.forEach((candidate) => {
      scheduleShifts.forEach((shift) => {
        if (shiftConflictsWithTemplateCandidate(shift, candidate)) {
          overlapExistingShiftIdsSet.add(shift.id);
        }
      });
    });

    return {
      templateId,
      templateName: rawTmpl.name,
      startDate,
      endDate: coveredDates[coveredDates.length - 1] || startDate,
      totalDays: Math.max(rawTmpl.totalDays, 1),
      storeId,
      coveredAreaIds: templateAreaIds,
      coveredDates,
      touchedSlotKeys,
      occupiedSlotKeys: Array.from(occupiedSlotKeysSet),
      rangeExistingShiftIds: Array.from(rangeExistingShiftIdsSet),
      overlapExistingShiftIds: Array.from(overlapExistingShiftIdsSet),
      candidateShifts,
    } satisfies TemplateApplyPlan;
  };

  const closeTemplateConflictModal = () => {
    setTemplateConflictModalOpen(false);
    setPendingTemplatePlan(null);
    setTemplateConflictStrategy("merge_old");
    setDraggingTemplateId(null);
  };

  const commitTemplateApplyPlan = (
    plan: TemplateApplyPlan,
    strategy: TemplateConflictStrategy,
  ) => {
    type WorkingShift = ScheduleShift & { __temp?: boolean };

    const touchedSlotSet = new Set(plan.touchedSlotKeys);
    const occupiedSlotSet = new Set(plan.occupiedSlotKeys);
    const coveredAreaSet = new Set(plan.coveredAreaIds);
    const coveredDateSet = new Set(plan.coveredDates);
    templateApplySeedRef.current += 1;
    const applySeed = templateApplySeedRef.current;
    const removedIds = new Set<string>();
    let skipped = 0;
    let workingShifts: WorkingShift[] = scheduleShifts.map((shift) => ({
      ...shift,
    }));

    const removeMatching = (predicate: (shift: WorkingShift) => boolean) => {
      workingShifts = workingShifts.filter((shift) => {
        if (!predicate(shift)) return true;
        if (!shift.__temp) removedIds.add(shift.id);
        return false;
      });
    };

    if (strategy === "overwrite_slot") {
      removeMatching((shift) =>
        touchedSlotSet.has(makeAreaDateKey(shift.areaId, shift.date)),
      );
    } else if (strategy === "replace_range") {
      removeMatching(
        (shift) =>
          coveredAreaSet.has(shift.areaId) && coveredDateSet.has(shift.date),
      );
    }

    plan.candidateShifts.forEach((candidate, index) => {
      const employeeIds =
        candidate.employeeIds.length > 0
          ? candidate.employeeIds
          : candidate.employeeId
            ? [candidate.employeeId]
            : [];

      if (employeeIds.length === 0) {
        if (
          strategy === "merge_old" &&
          occupiedSlotSet.has(candidate.slotKey)
        ) {
          skipped += 1;
          return;
        }

        if (strategy !== "merge_old") {
          removeMatching(
            (shift) =>
              !shift.__temp &&
              shiftConflictsWithTemplateCandidate(shift, candidate, false),
          );
        }

        const hasRemainingConflict = workingShifts.some((shift) =>
          shiftConflictsWithTemplateCandidate(shift, candidate, false),
        );
        if (hasRemainingConflict) {
          skipped += 1;
          return;
        }

        workingShifts.push({
          id: `tmpl_${applySeed}_${index}`,
          shiftId: candidate.shiftId,
          employeeId: "",
          employeeIds: [],
          areaId: candidate.areaId,
          storeId: candidate.storeId,
          shiftType: candidate.shiftType,
          date: candidate.date,
          startTime: candidate.startTime,
          endTime: candidate.endTime,
          breakMinutes: candidate.breakMinutes,
          shiftName: candidate.shiftName,
          color: candidate.color,
          note: candidate.note,
          status: "draft",
          __temp: true,
        });
      } else {
        if (strategy !== "merge_old") {
          removeMatching(
            (shift) =>
              !shift.__temp &&
              shiftConflictsWithTemplateCandidate(shift, candidate, false),
          );
        }

        const validEmployeeIds: string[] = [];

        for (const empId of employeeIds) {
          const singleEmployeeCandidate = {
            ...candidate,
            employeeId: empId,
            employeeIds: [empId],
          };

          if (
            strategy === "merge_old" &&
            occupiedSlotSet.has(candidate.slotKey)
          ) {
            const hasEmployeeConflict = workingShifts.some((shift) =>
              shiftConflictsWithTemplateCandidate(
                shift,
                singleEmployeeCandidate,
                false,
              ),
            );
            if (hasEmployeeConflict) {
              skipped += 1;
              continue;
            }
          }

          const hasRemainingConflict = workingShifts.some((shift) =>
            shiftConflictsWithTemplateCandidate(
              shift,
              singleEmployeeCandidate,
              false,
            ),
          );
          if (hasRemainingConflict) {
            skipped += 1;
            continue;
          }

          validEmployeeIds.push(empId);
        }

        validEmployeeIds.forEach((empId, empIdx) => {
          workingShifts.push({
            id: `tmpl_${applySeed}_${index}_${empIdx}`,
            shiftId: candidate.shiftId,
            employeeId: empId,
            employeeIds: [empId],
            areaId: candidate.areaId,
            storeId: candidate.storeId,
            shiftType: candidate.shiftType,
            date: candidate.date,
            startTime: candidate.startTime,
            endTime: candidate.endTime,
            breakMinutes: candidate.breakMinutes,
            shiftName: candidate.shiftName,
            color: candidate.color,
            note: candidate.note,
            status: "draft",
            __temp: true,
          });
        });
      }
    });

    const nextShifts = workingShifts.map(({ __temp, ...shift }) => shift);
    const added = nextShifts.length - (scheduleShifts.length - removedIds.size);

    setScheduleShifts(nextShifts);

    if (added > 0) {
      const removedText =
        removedIds.size > 0
          ? locale === "zh"
            ? `，移除 ${removedIds.size} 个旧班次`
            : `, removed ${removedIds.size} old shifts`
          : "";
      const skippedText =
        skipped > 0
          ? locale === "zh"
            ? `，跳过 ${skipped} 个无法写入的班次`
            : `, skipped ${skipped} shifts`
          : "";
      toast.success(
        locale === "zh"
          ? `已应用「${plan.templateName}」，新增 ${added} 个班次${removedText}${skippedText}`
          : `Applied "${plan.templateName}": added ${added} shifts${removedText}${skippedText}`,
      );
    } else {
      toast.warning(
        locale === "zh"
          ? `「${plan.templateName}」没有新增班次${removedIds.size > 0 ? `，但已移除 ${removedIds.size} 个旧班次` : ""}`
          : `"${plan.templateName}" added no new shifts${removedIds.size > 0 ? `, but removed ${removedIds.size} old shifts` : ""}`,
      );
    }

    setTemplateConflictModalOpen(false);
    setPendingTemplatePlan(null);
    setTemplateConflictStrategy("merge_old");
    setDraggingTemplateId(null);
  };

  const prepareTemplateApply = (
    templateId: string,
    startDate: string,
    targetAreaId: string | null,
  ) => {
    const plan = buildTemplateApplyPlan(templateId, startDate, targetAreaId);
    if (!plan) {
      setDraggingTemplateId(null);
      return;
    }

    if (plan.coveredAreaIds.length === 0) {
      toast.warning(
        locale === "zh"
          ? "当前视图没有可应用的模版区域"
          : "No template areas are available in the current view",
      );
      setDraggingTemplateId(null);
      return;
    }

    if (plan.candidateShifts.length === 0) {
      toast.warning(
        locale === "zh"
          ? "模版中没有可应用的班次"
          : "This template has no shifts to apply",
      );
      setDraggingTemplateId(null);
      return;
    }

    const hasExistingRangeData = plan.rangeExistingShiftIds.length > 0;
    const hasDirectConflicts = plan.overlapExistingShiftIds.length > 0;

    if (hasExistingRangeData || hasDirectConflicts) {
      setPendingTemplatePlan(plan);
      setTemplateConflictStrategy("merge_old");
      setTemplateConflictModalOpen(true);
      return;
    }

    commitTemplateApplyPlan(plan, "merge_old");
  };

  // ── Modal handlers ──────────────────────────────────────────────────────────

  const openAddShift = (areaId: string, date: string, empId = "") => {
    setEditingShift(null);
    setShiftForm({
      presetKey: "",
      shiftId: "",
      employeeIds: empId ? [empId] : [],
      employeeId: empId,
      areaId,
      date,
      shiftType: "store",
      startTime: "09:00",
      endTime: "17:00",
      breakMinutes: 30,
      shiftName: "",
      color: DEFAULT_COLOR_KEY,
      note: "",
      storeId:
        selectedStoreId ||
        areas.find((area) => area.id === areaId)?.storeId ||
        stores[0]?.id ||
        "",
    });
    setModalOpen(true);
  };

  const openEditShift = (shift: ScheduleShift) => {
    const presetKey = makeShiftPresetKey({
      shiftType: shift.shiftType || "store",
      storeId: shift.storeId,
      shiftName: shift.shiftName,
      startTime: shift.startTime,
      endTime: shift.endTime,
      color: shift.color,
    });

    setEditingShift(shift);
    setShiftForm({
      presetKey,
      shiftId: shift.shiftId || "",
      employeeIds: getShiftEmployeeIds(shift),
      employeeId: shift.employeeId,
      areaId: shift.areaId,
      date: shift.date,
      shiftType: shift.shiftType || "store",
      startTime: shift.startTime,
      endTime: shift.endTime,
      breakMinutes: shift.breakMinutes,
      shiftName: shift.shiftName,
      color: shift.color,
      note: shift.note,
      storeId: shift.storeId,
    });
    setModalOpen(true);
  };

  const handleSaveShift = () => {
    if (!shiftForm.date) {
      toast.error(locale === "zh" ? "请选择日期" : "Please select a date");
      return;
    }
    if (!shiftForm.shiftName.trim()) {
      toast.error(locale === "zh" ? "请选择班次" : "Please choose a shift");
      return;
    }
    const empIds =
      shiftForm.employeeIds.length > 0
        ? shiftForm.employeeIds
        : shiftForm.employeeId
          ? [shiftForm.employeeId]
          : [];
    if (empIds.length === 0) {
      toast.error(
        locale === "zh"
          ? "请至少选择一名员工"
          : "Please select at least one employee",
      );
      return;
    }
    const nextShift = {
      date: shiftForm.date,
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
    };

    // Check availability warnings for all selected employees (warning only, not blocking)
    const availabilityWarnings: string[] = [];
    for (const empId of empIds) {
      const availabilityWarning = findAvailabilityWarning(empId, nextShift);
      if (availabilityWarning) {
        availabilityWarnings.push(availabilityWarning);
      }

      const hasConflict = scheduleShifts.some((s) => {
        if (s.id === editingShift?.id) return false;
        if (!getShiftEmployeeIds(s).includes(empId)) return false;
        return datedShiftsOverlap(nextShift, s);
      });

      if (hasConflict) {
        toast.error(
          locale === "zh"
            ? `${empNameMap[empId]} 在该时间段存在冲突`
            : `Conflict detected for ${empNameMap[empId]}`,
        );
        return;
      }
    }

    if (availabilityWarnings.length > 0) {
      availabilityWarnings.forEach((w) => toast.warning(w));
    }

    const storeIdToUse =
      shiftForm.storeId ||
      selectedStoreId ||
      areas.find((area) => area.id === shiftForm.areaId)?.storeId ||
      stores[0]?.id ||
      "s1";

    if (editingShift) {
      // For edit: update existing shift with first selected employee, update employeeIds
      const data: ScheduleShift = {
        ...editingShift,
        shiftId: shiftForm.shiftId || editingShift.shiftId,
        employeeId: empIds[0],
        employeeIds: empIds,
        areaId: shiftForm.areaId,
        storeId: storeIdToUse,
        shiftType: shiftForm.shiftType,
        date: shiftForm.date,
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        breakMinutes: shiftForm.breakMinutes,
        shiftName: shiftForm.shiftName,
        color: shiftForm.color,
        note: shiftForm.note,
        status: "draft",
      };
      setScheduleShifts((prev) =>
        prev.map((s) => (s.id === editingShift.id ? data : s)),
      );
      toast.success(locale === "zh" ? "班次已更新" : "Shift updated");
      console.log("[Rosters] updated shift:", data);
    } else {
      // For add: create one shift record per employee (each with its own id)
      nextCreatedShiftIdRef.current += 1;
      const createdShiftBatchId = nextCreatedShiftIdRef.current;
      const newShifts: ScheduleShift[] = empIds.map((empId, idx) => ({
        id: `sh-new-${createdShiftBatchId}-${idx}`,
        shiftId: shiftForm.shiftId || undefined,
        employeeId: empId,
        employeeIds: [empId],
        areaId: shiftForm.areaId,
        storeId: storeIdToUse,
        shiftType: shiftForm.shiftType,
        date: shiftForm.date,
        startTime: shiftForm.startTime,
        endTime: shiftForm.endTime,
        breakMinutes: shiftForm.breakMinutes,
        shiftName: shiftForm.shiftName,
        color: shiftForm.color,
        note: shiftForm.note,
        status: "draft" as const,
      }));
      setScheduleShifts((prev) => [...prev, ...newShifts]);
      toast.success(
        locale === "zh"
          ? `已添加 ${newShifts.length} 个班次`
          : `Added ${newShifts.length} shift${newShifts.length > 1 ? "s" : ""}`,
      );
      console.log("[Rosters] added shifts:", newShifts);
    }
    setModalOpen(false);
  };

  const handleDeleteShift = (id: string) => {
    setScheduleShifts((prev) => prev.filter((s) => s.id !== id));
    toast.success(locale === "zh" ? "班次已删除" : "Shift deleted");
  };

  const handleRemoveEmployeeFromShift = (shiftId: string, empId: string) => {
    setScheduleShifts((prev) =>
      prev.map((shift) => {
        if (shift.id !== shiftId) return shift;

        const nextEmployeeIds = getShiftEmployeeIds(shift).filter(
          (id) => id !== empId,
        );
        return {
          ...shift,
          employeeId: nextEmployeeIds[0] || "",
          employeeIds: nextEmployeeIds,
        };
      }),
    );
    toast.success(
      locale === "zh" ? "员工已从班次移除" : "Employee removed from shift",
    );
  };

  // ── Drop employee into area cell ────────────────────────────────────────────
  const handleDropEmployee = (
    empId: string,
    areaId: string,
    dateStr: string,
  ) => {
    console.log(
      "[Rosters] drop employee",
      empId,
      "into area",
      areaId,
      "date",
      dateStr,
    );
    openAddShift(areaId, dateStr, empId);
  };

  const handleDropEmployeeToShift = (
    empId: string,
    targetShift: ScheduleShift,
  ) => {
    const existingEmployeeIds = getShiftEmployeeIds(targetShift);
    if (existingEmployeeIds.includes(empId)) {
      toast.warning(
        locale === "zh"
          ? "该员工已在此班次中"
          : "Employee already assigned to this shift",
      );
      return;
    }

    const nextShift = {
      date: targetShift.date,
      startTime: targetShift.startTime,
      endTime: targetShift.endTime,
    };

    const availabilityWarning = findAvailabilityWarning(empId, nextShift);
    if (availabilityWarning) {
      toast.error(availabilityWarning);
      return;
    }

    const hasConflict = scheduleShifts.some((shift) => {
      if (shift.id === targetShift.id) return false;
      if (!getShiftEmployeeIds(shift).includes(empId)) return false;
      return datedShiftsOverlap(nextShift, shift);
    });

    if (hasConflict) {
      toast.error(
        locale === "zh"
          ? `${empNameMap[empId]} 在该时间段存在冲突`
          : `Conflict detected for ${empNameMap[empId]}`,
      );
      return;
    }

    setScheduleShifts((prev) =>
      prev.map((shift) => {
        if (shift.id !== targetShift.id) return shift;

        const nextEmployeeIds = [...getShiftEmployeeIds(shift), empId];
        return {
          ...shift,
          employeeId: nextEmployeeIds[0] || empId,
          employeeIds: nextEmployeeIds,
          status: "draft",
        };
      }),
    );
    toast.success(
      locale === "zh" ? "员工已添加到班次" : "Employee added to shift",
    );
  };

  // ── Drop template onto the current visible week body ────────────────────────
  const handleDropTemplateToCurrentWeek = (templateId: string) => {
    prepareTemplateApply(templateId, weekStart.format("YYYY-MM-DD"), null);
  };

  // ── Drop template onto date column header (applies to all areas) ────────────
  const handleDropTemplateToDate = (templateId: string, dateStr: string) => {
    console.log(
      "[Rosters] drop template",
      templateId,
      "onto date column",
      dateStr,
    );
    prepareTemplateApply(templateId, dateStr, null);
  };

  // ── Publish ─────────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    const ids = scheduleShifts
      .filter((s) => {
        const d = dayjs(s.date);
        return (
          s.status === "draft" && d >= weekStart && d <= weekStart.add(6, "day")
        );
      })
      .map((s) => s.id);
    try {
      await saveScheduleDraft(scheduleShifts, selectedStoreId);
      await publishSchedule(selectedStoreId);
      toast.success(
        locale === "zh"
          ? `已发布 ${ids.length} 个班次`
          : `Published ${ids.length} shifts`,
      );
      console.log("[Rosters] published", ids.length, "shifts");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish failed");
    }
  };

  const handleSaveRoster = async () => {
    try {
      await saveScheduleDraft(scheduleShifts, selectedStoreId);
      onSave();
      toast.success(isZh ? "排班已保存" : "Roster saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Roster save failed",
      );
    }
  };

  const dayLabels = locale === "zh" ? WEEK_DAY_LABELS_ZH : WEEK_DAY_LABELS_EN;

  console.log(
    "[Rosters] weekOffset:",
    weekOffset,
    "areas:",
    displayAreas.length,
    "draftCount:",
    draftCount,
  );

  // ── Column width constants ──────────────────────────────────────────────────
  const LEFT_COL_W = 120;
  const DATE_COL_W = 160;
  const TOTAL_GRID_W = LEFT_COL_W + DATE_COL_W * 7;

  return (
    <div
      data-cmp="Rosters"
      className="flex flex-col"
      style={{ height: "calc(100vh - 88px)", overflow: "hidden" }}
    >
      {/* ── Top toolbar ───────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-5 py-2.5 flex-shrink-0"
        style={{
          background: "var(--card)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Left */}
        <div className="flex items-center gap-3">
          {/* Today button */}
          <Button
            size="small"
            onClick={() => setWeekOffset(0)}
            style={{
              background:
                weekOffset === 0 ? "var(--secondary)" : "var(--muted)",
              color:
                weekOffset === 0 ? "var(--primary)" : "var(--muted-foreground)",
              border: `1px solid var(--border)`,
              fontWeight: 600,
            }}
          >
            {isZh ? "今天" : "Today"}
          </Button>
          {/* Week nav */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setWeekOffset((w) => w - 1)}
              className="flex items-center justify-center rounded-lg transition-all hover:opacity-80"
              style={{
                width: 28,
                height: 28,
                background: "var(--muted)",
                color: "var(--muted-foreground)",
                border: "1px solid var(--border)",
              }}
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => setWeekOffset((w) => w + 1)}
              className="flex items-center justify-center rounded-lg transition-all hover:opacity-80"
              style={{
                width: 28,
                height: 28,
                background: "var(--muted)",
                color: "var(--muted-foreground)",
                border: "1px solid var(--border)",
              }}
            >
              <ChevronRight size={15} />
            </button>
          </div>
          {/* Week range */}
          <div className="flex items-center gap-2">
            <CalendarDays
              size={14}
              style={{ color: "var(--muted-foreground)" }}
            />
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--foreground)" }}
            >
              {`${formatCountryDate(weekStart, dateFormatCountry)} - ${formatCountryDate(weekStart.add(6, "day"), dateFormatCountry)}`}
            </span>
            <span
              className="rounded-full px-2 py-0.5 text-xs font-medium"
              style={{
                background: "var(--secondary)",
                color: "var(--primary)",
              }}
            >
              {isZh
                ? `第 ${weekStart.isoWeek()} 周`
                : `W${weekStart.isoWeek()}`}
            </span>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {draftCount > 0 && (
            <Button
              onClick={handlePublish}
              style={{
                background: "var(--chart-2)",
                color: "var(--primary-foreground)",
                border: "none",
                display: "flex",
                alignItems: "center",
                gap: 5,
              }}
              icon={<Send size={12} style={{ display: "inline" }} />}
            >
              {isZh ? "发布" : "Publish"}
            </Button>
          )}
          <Button
            type="primary"
            icon={<Save size={12} style={{ display: "inline" }} />}
            onClick={handleSaveRoster}
            style={{ display: "flex", alignItems: "center", gap: 5 }}
          >
            {isZh ? "保存" : "Save"}
          </Button>
        </div>
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel ──────────────────────────────────────────────────── */}
        <div
          className="flex flex-col flex-shrink-0"
          style={{
            width: 256,
            background: "var(--card)",
            borderRight: "1px solid var(--border)",
            overflow: "hidden",
          }}
        >
          {/* Tab */}
          <div
            className="flex flex-shrink-0"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            {(["templates", "employees"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setLeftTab(tab)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-sm font-medium transition-all"
                style={{
                  background:
                    leftTab === tab ? "var(--secondary)" : "transparent",
                  color:
                    leftTab === tab
                      ? "var(--primary)"
                      : "var(--muted-foreground)",
                  borderBottom:
                    leftTab === tab
                      ? `2px solid var(--primary)`
                      : "2px solid transparent",
                }}
              >
                {tab === "templates" ? (
                  <LayoutTemplate size={13} />
                ) : (
                  <Users size={13} />
                )}
                {tab === "templates"
                  ? isZh
                    ? "模版"
                    : "Templates"
                  : isZh
                    ? "员工"
                    : "Employees"}
              </button>
            ))}
          </div>

          {/* ── Templates panel ────────────────────────────────────────────── */}
          {leftTab === "templates" && (
            <>
              <div
                className="px-3 py-2.5 flex-shrink-0"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <Input
                  prefix={
                    <Search
                      size={11}
                      style={{ color: "var(--muted-foreground)" }}
                    />
                  }
                  placeholder={isZh ? "搜索模版..." : "Search templates..."}
                  size="small"
                  value={templateSearch}
                  onChange={(e) => setTemplateSearch(e.target.value)}
                  allowClear
                />
              </div>
              {/* Drag hint */}
              <div className="px-3 pt-2.5 flex-shrink-0">
                <div
                  className="flex items-start gap-1.5 rounded-xl px-2.5 py-2 mb-2"
                  style={{
                    background: "var(--secondary)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <Info
                    size={11}
                    style={{
                      color: "var(--primary)",
                      flexShrink: 0,
                      marginTop: 1,
                    }}
                  />
                  <div
                    style={{
                      fontSize: 10,
                      color: "var(--primary)",
                      lineHeight: 1.5,
                    }}
                  >
                    {isZh
                      ? "将模版拖到周视图任意位置会按当前周自动对齐并跨周顺延；拖到日期列头则从该日期开始顺延应用"
                      : "Drop a template anywhere on the weekly grid to align it to the current week, or onto a date header to start from that day"}
                  </div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 pb-3">
                {filteredTemplates.map((tmpl) => (
                  <TemplateCard
                    key={tmpl.id}
                    template={tmpl}
                    onDragStart={(id) => setDraggingTemplateId(id)}
                    onDragEnd={() => setDraggingTemplateId(null)}
                  />
                ))}
                {filteredTemplates.length === 0 && (
                  <div
                    className="flex flex-col items-center py-8"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <LayoutTemplate
                      size={28}
                      style={{ opacity: 0.3, marginBottom: 8 }}
                    />
                    <span style={{ fontSize: 12 }}>
                      {isZh ? "未找到模版" : "No templates"}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}

          {/* ── Employees panel ────────────────────────────────────────────── */}
          {leftTab === "employees" && (
            <>
              <div
                className="px-3 py-2.5 flex-shrink-0"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                <Input
                  prefix={
                    <Search
                      size={11}
                      style={{ color: "var(--muted-foreground)" }}
                    />
                  }
                  placeholder={isZh ? "搜索员工..." : "Search employees..."}
                  size="small"
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  allowClear
                />
                <div className="flex items-center justify-between mt-1.5">
                  <span
                    style={{ fontSize: 11, color: "var(--muted-foreground)" }}
                  >
                    {isZh
                      ? "拖拽到格子中添加班次"
                      : "Drag to a cell to add a shift"}
                  </span>
                  <span
                    className="rounded-full px-1.5 py-0.5"
                    style={{
                      fontSize: 10,
                      background: "var(--secondary)",
                      color: "var(--primary)",
                    }}
                  >
                    {filteredEmployees.length}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2">
                {filteredEmployees.map((emp) => {
                  const hrs = parseFloat(weekHoursForEmp(emp.id));
                  const shortDays = ["M", "T", "W", "T", "F", "S", "S"];
                  return (
                    <div
                      key={emp.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.setData("employeeId", emp.id);
                        console.log("[Rosters] drag employee:", emp.id);
                      }}
                      className="rounded-xl p-2.5 mb-2 cursor-grab active:cursor-grabbing select-none transition-all hover:shadow-custom"
                      style={{
                        background: "var(--muted)",
                        border: "1px solid var(--border)",
                      }}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-1.5">
                          <Avatar
                            size={22}
                            src={getEmployeeAvatarUrl(emp) || undefined}
                            style={{
                              background: emp.employeeColor || "var(--primary)",
                              flexShrink: 0,
                              fontSize: 9,
                            }}
                          >
                            {getEmployeeInitials(emp.firstName, emp.lastName)}
                          </Avatar>
                          <div>
                            <div
                              className="text-xs font-semibold truncate"
                              style={{
                                color: "var(--foreground)",
                                maxWidth: 130,
                              }}
                            >
                              {emp.firstName} {emp.lastName}
                            </div>
                            <div
                              style={{
                                fontSize: 9,
                                color: "var(--muted-foreground)",
                              }}
                            >
                              {emp.role}
                            </div>
                          </div>
                        </div>
                        <span
                          className="rounded-full px-1.5 py-0.5 font-semibold"
                          style={{
                            fontSize: 9,
                            background:
                              hrs > 0 ? "var(--secondary)" : "var(--card)",
                            color:
                              hrs > 0
                                ? "var(--primary)"
                                : "var(--muted-foreground)",
                          }}
                        >
                          {hrs > 0 ? `${hrs}h` : "–"}
                        </span>
                      </div>
                      {/* Per-day mini chart */}
                      <div className="flex items-center gap-0.5">
                        {weekDates.map((d, i) => {
                          const ss = scheduleShifts.filter(
                            (s) =>
                              getShiftEmployeeIds(s).includes(emp.id) &&
                              s.date === d.format("YYYY-MM-DD") &&
                              (!selectedStoreId ||
                                s.storeId === selectedStoreId),
                          );
                          const dayHrs = ss.reduce(
                            (acc, sh) =>
                              acc +
                              parseFloat(
                                calcHours(
                                  sh.startTime,
                                  sh.endTime,
                                  sh.breakMinutes,
                                ),
                              ),
                            0,
                          );
                          return (
                            <div
                              key={i}
                              className="flex flex-col items-center"
                              style={{ flex: 1 }}
                            >
                              <span
                                style={{
                                  fontSize: 7,
                                  color: "var(--muted-foreground)",
                                }}
                              >
                                {shortDays[i]}
                              </span>
                              <div
                                className="rounded-sm w-full text-center"
                                style={{
                                  fontSize: 7,
                                  background:
                                    dayHrs > 0
                                      ? "var(--secondary)"
                                      : "var(--border)",
                                  color:
                                    dayHrs > 0
                                      ? "var(--primary)"
                                      : "transparent",
                                  padding: "1px 0",
                                  minWidth: 12,
                                }}
                              >
                                {dayHrs > 0 ? dayHrs.toFixed(0) : "·"}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {filteredEmployees.length === 0 && (
                  <div
                    className="flex flex-col items-center py-8"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <Users
                      size={28}
                      style={{ opacity: 0.3, marginBottom: 8 }}
                    />
                    <span style={{ fontSize: 12 }}>
                      {isZh ? "未找到员工" : "No employees"}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* ── Right: Grid ───────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-auto relative">
          <div style={{ minWidth: TOTAL_GRID_W }}>
            {/* ── Sticky header row ───────────────────────────────────────── */}
            <div
              className="flex sticky top-0 z-20"
              style={{
                background: "var(--card)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {/* Left label column */}
              <div
                className="sticky left-0 flex-shrink-0 flex items-center px-4"
                style={{
                  width: LEFT_COL_W,
                  borderRight: "1px solid var(--border)",
                  minHeight: 44,
                  background: "var(--card)",
                  zIndex: 30,
                }}
              >
                <span
                  className="text-xs font-semibold"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  {isZh ? "区域" : "Area"}
                </span>
              </div>

              {/* Date columns */}
              {weekDates.map((d, i) => {
                const isToday = d.format("YYYY-MM-DD") === todayStr;
                const isClosedDay = isStoreClosedDate(d);
                const cnt = dateTotalShifts(d.format("YYYY-MM-DD"));
                return (
                  <DateColHeader
                    key={i}
                    date={d}
                    dayLabel={dayLabels[i]}
                    isToday={isToday}
                    isClosedDay={isClosedDay}
                    dateFormatCountry={dateFormatCountry}
                    onDropTemplate={handleDropTemplateToDate}
                    shiftCount={cnt}
                  />
                );
              })}
            </div>

            {/* ── Area rows (RosterTemplate-aligned layout) ────────────────── */}
            {displayAreas.length === 0 ? (
              <div
                className="flex items-center justify-center"
                style={{ minHeight: 220, color: "var(--muted-foreground)" }}
              >
                <div className="flex flex-col items-center gap-2 text-sm">
                  <LayoutTemplate size={28} style={{ opacity: 0.35 }} />
                  <span>
                    {isZh
                      ? "暂无基础区域，请先到区域管理维护"
                      : "No base areas yet. Add them in Area Management first."}
                  </span>
                </div>
              </div>
            ) : (
              displayAreas.map((area) => (
                <div
                  key={area.id}
                  className="flex"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  {/* Area name cell — matches RosterTemplate area label cell */}
                  <div
                    className="sticky left-0 flex-shrink-0 flex items-start justify-between px-3 py-3 group"
                    style={{
                      width: LEFT_COL_W,
                      borderRight: "1px solid var(--border)",
                      minHeight: 88,
                      background: "var(--muted)",
                      zIndex: 10,
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <GripVertical
                        size={12}
                        style={{ color: "var(--muted-foreground)" }}
                      />
                      <span
                        className="text-sm font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        {area.name}
                      </span>
                    </div>
                  </div>

                  {/* Day cells — one per weekday, matching RosterTemplate cell layout */}
                  {weekDates.map((d, i) => {
                    const dateStr = d.format("YYYY-MM-DD");
                    const isToday = dateStr === todayStr;
                    const isClosedDay = isStoreClosedDate(d);
                    const cellShifts = getShifts(area.id, dateStr);

                    return (
                      <AreaDateCell
                        key={i}
                        date={d}
                        areaId={area.id}
                        shifts={cellShifts}
                        employees={allEmpList}
                        onAddShift={openAddShift}
                        onEditShift={openEditShift}
                        onDeleteShift={handleDeleteShift}
                        onRemoveEmployeeFromShift={
                          handleRemoveEmployeeFromShift
                        }
                        onDropEmployee={handleDropEmployee}
                        onDropEmployeeToShift={handleDropEmployeeToShift}
                        onDropTemplate={handleDropTemplateToCurrentWeek}
                        getAvailabilityWarning={findAvailabilityWarning}
                        isToday={isToday}
                        isClosedDay={isClosedDay}
                      />
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Add/Edit Shift Modal ──────────────────────────────────────────── */}
      <Modal
        title={
          editingShift
            ? isZh
              ? "编辑班次"
              : "Edit Shift"
            : isZh
              ? "添加班次"
              : "Add Shift"
        }
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        onOk={handleSaveShift}
        maskClosable={false}
        okText={isZh ? "保存" : "Save"}
        cancelText={isZh ? "取消" : "Cancel"}
        destroyOnHidden
        width={500}
      >
        <div className="flex flex-col gap-4 py-3">
          {/* Preset select */}
          <div>
            <div
              className="text-sm mb-1.5"
              style={{ color: "var(--foreground)" }}
            >
              {isZh ? "选择班次" : "Select Shift"}
            </div>
            <Select
              showSearch
              value={shiftForm.presetKey || undefined}
              onChange={(value) => {
                const preset = modalShiftPresetOptions.find(
                  (option) => option.key === value,
                );
                if (!preset) {
                  setShiftForm((form) => ({ ...form, presetKey: value }));
                  return;
                }

                setShiftForm((form) => ({
                  ...form,
                  presetKey: preset.key,
                  shiftId: preset.shiftId || "",
                  shiftType: preset.shiftType,
                  storeId:
                    preset.shiftType === "general"
                      ? form.storeId
                      : preset.storeId,
                  shiftName: preset.shiftName,
                  startTime: preset.startTime,
                  endTime: preset.endTime,
                  breakMinutes: preset.breakMinutes,
                  color: preset.color,
                }));
              }}
              placeholder={isZh ? "请选择班次" : "Please choose a shift"}
              style={{ width: "100%" }}
              optionFilterProp="label"
              options={modalShiftPresetOptions.map((option) => ({
                value: option.key,
                label: `${option.shiftName} (${option.startTime} - ${option.endTime})`,
              }))}
            />
            {shiftPresetOptions.length === 0 && (
              <div
                className="text-xs mt-2"
                style={{ color: "var(--muted-foreground)" }}
              >
                {isZh
                  ? "暂无可选班次，请先到班次管理创建班次"
                  : "No shifts available yet. Create shifts in Shift Management first."}
              </div>
            )}
          </div>

          {/* Time */}
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div
                className="text-sm mb-1.5"
                style={{ color: "var(--foreground)" }}
              >
                {isZh ? "开始时间" : "Start Time"}
              </div>
              <TimePicker
                disabled
                format="HH:mm"
                value={dayjs(shiftForm.startTime, "HH:mm")}
                onChange={(v) =>
                  setShiftForm((f) => ({
                    ...f,
                    startTime: v ? v.format("HH:mm") : "09:00",
                  }))
                }
                style={{ width: "100%" }}
              />
            </div>
            <div className="flex-1">
              <div
                className="text-sm mb-1.5"
                style={{ color: "var(--foreground)" }}
              >
                {isZh ? "结束时间" : "End Time"}
              </div>
              <TimePicker
                disabled
                format="HH:mm"
                value={dayjs(shiftForm.endTime, "HH:mm")}
                onChange={(v) =>
                  setShiftForm((f) => ({
                    ...f,
                    endTime: v ? v.format("HH:mm") : "17:00",
                  }))
                }
                style={{ width: "100%" }}
              />
            </div>
          </div>

          {/* Duration preview */}
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{ background: "var(--secondary)" }}
          >
            <Clock size={14} style={{ color: "var(--primary)" }} />
            <span className="text-sm" style={{ color: "var(--primary)" }}>
              {calcHours(
                shiftForm.startTime,
                shiftForm.endTime,
                shiftForm.breakMinutes,
              )}
              {isZh ? " 小时" : " hours"}
              <span
                style={{
                  fontSize: 11,
                  marginLeft: 8,
                  color: "var(--muted-foreground)",
                }}
              >
                ({formatTime12(shiftForm.startTime)} –{" "}
                {formatTime12(shiftForm.endTime)})
              </span>
            </span>
          </div>

          {/* Color */}
          <div>
            <div
              className="text-sm mb-1.5"
              style={{ color: "var(--foreground)" }}
            >
              {isZh ? "颜色标识" : "Color"}
            </div>
            <ColorSwatchPicker
              value={shiftForm.color}
              onChange={(color) => setShiftForm((f) => ({ ...f, color }))}
              locale={locale}
            />
          </div>

          {/* Multi-employee assignment */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-sm" style={{ color: "var(--foreground)" }}>
                {isZh
                  ? "分配员工（支持多人）*"
                  : "Assign Employees (multi-select) *"}
              </div>
              <span
                className="text-xs rounded-md px-1.5 py-0.5"
                style={{
                  background: "var(--secondary)",
                  color: "var(--primary)",
                }}
              >
                {shiftForm.employeeIds.length} {isZh ? "人" : "assigned"}
              </span>
            </div>
            <Select
              mode="multiple"
              value={shiftForm.employeeIds}
              onChange={(v: string[]) =>
                setShiftForm((f) => ({
                  ...f,
                  employeeIds: v,
                  employeeId: v[0] || "",
                }))
              }
              placeholder={
                isZh ? "选择员工（可多选）..." : "Select employees..."
              }
              style={{ width: "100%" }}
              maxTagCount="responsive"
              showSearch
              optionFilterProp="label"
              tagRender={(props) => {
                const emp = activeEmployees.find(
                  (employee) => employee.id === props.value,
                );
                const warning = emp
                  ? getDatedShiftAvailabilityWarning(
                      emp,
                      {
                        date: shiftForm.date,
                        startTime: shiftForm.startTime,
                        endTime: shiftForm.endTime,
                      },
                      locale,
                    )
                  : null;
                return (
                  <Tooltip title={warning || undefined}>
                    <span
                      className="ant-select-selection-item rounded px-1.5 py-0.5 inline-flex items-center gap-1"
                      style={{
                        marginInlineEnd: 4,
                        color: warning ? "var(--destructive)" : undefined,
                        border: warning
                          ? "1px solid var(--destructive)"
                          : undefined,
                        fontWeight: warning ? 700 : undefined,
                      }}
                    >
                      {props.label}
                      {warning && <AlertTriangle size={10} />}
                      {props.closable && (
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={props.onClose}
                          style={{ color: "inherit", lineHeight: 1 }}
                        >
                          <X size={10} />
                        </button>
                      )}
                    </span>
                  </Tooltip>
                );
              }}
              optionRender={(option) => {
                const emp = activeEmployees.find((e) => e.id === option.value);
                if (!emp) return <span>{option.label}</span>;
                const warning = getDatedShiftAvailabilityWarning(
                  emp,
                  {
                    date: shiftForm.date,
                    startTime: shiftForm.startTime,
                    endTime: shiftForm.endTime,
                  },
                  locale,
                );
                return (
                  <Tooltip title={warning || undefined} placement="right">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <Avatar
                          size={18}
                          src={getEmployeeAvatarUrl(emp) || undefined}
                          style={{
                            background: emp.employeeColor || "var(--primary)",
                            fontSize: 9,
                            flexShrink: 0,
                          }}
                        >
                          {getEmployeeInitials(emp.firstName, emp.lastName)}
                        </Avatar>
                        <span
                          className="truncate"
                          style={{
                            color: warning
                              ? "var(--destructive)"
                              : "var(--foreground)",
                            fontWeight: warning ? 700 : 400,
                          }}
                        >
                          {emp.firstName} {emp.lastName}
                        </span>
                      </div>
                      {warning && (
                        <AlertTriangle
                          size={13}
                          style={{ color: "var(--destructive)", flexShrink: 0 }}
                        />
                      )}
                    </div>
                  </Tooltip>
                );
              }}
            >
              {activeEmployees.map((e) => (
                <Option
                  key={e.id}
                  value={e.id}
                  label={`${e.firstName} ${e.lastName}`}
                >
                  {e.firstName} {e.lastName}
                </Option>
              ))}
            </Select>
            {/* Conflict hint */}
            <div
              className="flex items-start gap-1.5 mt-2 rounded-md px-2 py-1.5"
              style={{ background: "var(--muted)" }}
            >
              <AlertTriangle
                size={12}
                style={{ color: "var(--chart-3)", flexShrink: 0, marginTop: 1 }}
              />
              <span style={{ color: "var(--muted-foreground)", fontSize: 11 }}>
                {isZh
                  ? "保存时将检测员工工作时间是否完整覆盖班次（仅提醒），并检测同一员工时间冲突（含跨天班次，阻止保存）"
                  : "Save checks that employee work hours fully cover the shift (warning only) and that no employee has overlapping shifts, including overnight shifts (blocking)"}
              </span>
            </div>
          </div>
        </div>
      </Modal>

      <Modal
        title={isZh ? "模版数据冲突处理" : "Template Conflict Resolution"}
        open={templateConflictModalOpen}
        onCancel={closeTemplateConflictModal}
        onOk={() => {
          if (!pendingTemplatePlan) return;
          commitTemplateApplyPlan(
            pendingTemplatePlan,
            templateConflictStrategy,
          );
        }}
        maskClosable={false}
        okText={isZh ? "继续应用" : "Apply"}
        cancelText={isZh ? "取消" : "Cancel"}
        destroyOnHidden
        width={620}
      >
        {pendingTemplatePlan && (
          <div className="flex flex-col gap-4 py-2">
            <div
              className="flex items-start gap-2 rounded-lg px-3 py-2.5"
              style={{ background: "var(--secondary)" }}
            >
              <AlertTriangle
                size={16}
                style={{ color: "var(--chart-3)", flexShrink: 0, marginTop: 1 }}
              />
              <div className="flex-1">
                <div
                  className="text-sm font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  {pendingTemplatePlan.templateName}
                </div>
                <div
                  className="text-xs mt-1"
                  style={{ color: "var(--muted-foreground)", lineHeight: 1.6 }}
                >
                  {isZh
                    ? `检测到当前排班区间已有数据。模版将从 ${formatCountryDate(pendingTemplatePlan.startDate, dateFormatCountry)} 开始对齐，并持续到 ${formatCountryDate(pendingTemplatePlan.endDate, dateFormatCountry)}。`
                    : `Existing schedule data was found in this range. The template will align from ${formatCountryDate(pendingTemplatePlan.startDate, dateFormatCountry)} to ${formatCountryDate(pendingTemplatePlan.endDate, dateFormatCountry)}.`}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  label: isZh ? "覆盖天数" : "Covered Days",
                  value: `${pendingTemplatePlan.totalDays}`,
                },
                {
                  label: isZh ? "覆盖区域" : "Covered Areas",
                  value: `${pendingTemplatePlan.coveredAreaIds.length}`,
                },
                {
                  label: isZh ? "模版班次" : "Template Shifts",
                  value: `${pendingTemplatePlan.candidateShifts.length}`,
                },
                {
                  label: isZh ? "已有班次" : "Existing Shifts",
                  value: `${pendingTemplatePlan.rangeExistingShiftIds.length}`,
                },
                {
                  label: isZh ? "已占用格子" : "Occupied Slots",
                  value: `${pendingTemplatePlan.occupiedSlotKeys.length}`,
                },
                {
                  label: isZh ? "直接冲突班次" : "Direct Conflicts",
                  value: `${pendingTemplatePlan.overlapExistingShiftIds.length}`,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-lg px-3 py-2"
                  style={{ background: "var(--muted)" }}
                >
                  <div
                    style={{ fontSize: 11, color: "var(--muted-foreground)" }}
                  >
                    {item.label}
                  </div>
                  <div
                    className="text-sm font-semibold mt-1"
                    style={{ color: "var(--foreground)" }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div
                className="text-sm mb-2"
                style={{ color: "var(--foreground)" }}
              >
                {isZh ? "选择冲突处理方式" : "Choose a conflict strategy"}
              </div>
              <Radio.Group
                value={templateConflictStrategy}
                onChange={(event) =>
                  setTemplateConflictStrategy(event.target.value)
                }
                className="w-full"
              >
                <div className="flex flex-col gap-2">
                  {[
                    {
                      value: "overwrite_slot",
                      title: isZh ? "覆盖已有数据" : "Overwrite Occupied Slots",
                      desc: isZh
                        ? "只替换模版本身有班次的格子，格子内旧数据会被新模版替换。"
                        : "Replace only the slots where the template has data, keeping the rest untouched.",
                    },
                    {
                      value: "merge_old",
                      title: isZh
                        ? "合并数据，老数据优先"
                        : "Merge, Old Data Wins",
                      desc: isZh
                        ? "仅向空白格写入模版数据；已有旧数据的格子保持不变。"
                        : "Fill only empty slots and preserve existing schedule data.",
                    },
                    {
                      value: "merge_new",
                      title: isZh
                        ? "合并数据，新数据优先"
                        : "Merge, New Data Wins",
                      desc: isZh
                        ? "保留其他旧数据，仅把与模版直接冲突的旧班次替换成新数据。"
                        : "Keep unrelated old shifts, but replace old shifts that directly conflict with the template.",
                    },
                    {
                      value: "replace_range",
                      title: isZh
                        ? "清空覆盖周期后重建"
                        : "Clear Covered Range",
                      desc: isZh
                        ? "清空模版覆盖周期内相关区域的旧数据，再按模版中非空内容重新生成排班。"
                        : "Clear old shifts in the covered range first, then rebuild using non-empty template data.",
                    },
                  ].map((option) => (
                    <label
                      key={option.value}
                      className="flex items-start gap-3 rounded-lg px-3 py-2.5 cursor-pointer transition-all"
                      style={{
                        background:
                          templateConflictStrategy === option.value
                            ? "var(--secondary)"
                            : "var(--muted)",
                        border:
                          templateConflictStrategy === option.value
                            ? "1px solid var(--primary)"
                            : "1px solid var(--border)",
                      }}
                    >
                      <Radio value={option.value} />
                      <div className="flex-1">
                        <div
                          className="text-sm font-semibold"
                          style={{ color: "var(--foreground)" }}
                        >
                          {option.title}
                        </div>
                        <div
                          className="text-xs mt-1"
                          style={{
                            color: "var(--muted-foreground)",
                            lineHeight: 1.6,
                          }}
                        >
                          {option.desc}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </Radio.Group>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
