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
  LayoutGrid,
  LayoutTemplate,
  Plus,
  Save,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent } from "react";
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
import { isScheduleDateEditable } from "../lib/scheduleLock";
import {
  filterShiftsForEmployeeOnDate,
  filterUnassignedShiftsOnDate,
  getShiftEmployeeIds,
  getWeekScheduleMemberEmployeeIds,
  makeScheduleShiftSlotKey,
  mergeUniqueEmployeeIds,
  readStoredGridViewMode,
  ROSTER_UNASSIGNED_ROW_ID,
  type RosterGridViewMode,
  type ShiftModalMode,
  storeGridViewMode,
} from "../lib/rosterGridIndex";
import { isStoreClosedOnWeekday } from "../lib/storeHours";

const ROSTER_GRID_VIEW_STORAGE_KEY = "moni-roster-grid-view";

dayjs.extend(weekOfYear);
dayjs.extend(isoWeek);

const { Option } = Select;

const LEFT_COL_W = 180;
const DATE_COL_MIN_W = 180;
const TOTAL_GRID_MIN_W = LEFT_COL_W + DATE_COL_MIN_W * 7;

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
const hasTemplateDragData = (dataTransfer: DataTransfer) =>
  Array.from(dataTransfer.types).some(
    (type) => type.toLowerCase() === "templateid",
  );

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
  disabled?: boolean;
}

function TemplateCard({
  template,
  onDragStart = () => {},
  onDragEnd = () => {},
  disabled = false,
}: TemplateCardProps) {
  if (!template) return null;
  const cs = getColorStyle(template.color);
  return (
    <div
      data-cmp="TemplateCard"
      draggable={!disabled}
      onDragStart={(e) => {
        if (disabled) {
          e.preventDefault();
          return;
        }
        e.dataTransfer.setData("templateId", template.id);
        e.dataTransfer.effectAllowed = "copy";
        onDragStart(template.id);
        console.log("[Rosters] drag template start:", template.id);
      }}
      onDragEnd={onDragEnd}
      className="rounded-xl p-3 mb-2 select-none transition-all hover:shadow-custom"
      style={{
        background: "var(--card)",
        border: `1px solid var(--border)`,
        cursor: disabled ? "default" : "grab",
        opacity: disabled ? 0.76 : 1,
      }}
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

const readSidebarEmployeeId = (
  e: DragEvent,
  fallbackId?: string | null,
): string =>
  e.dataTransfer.getData("employeeId") ||
  e.dataTransfer.getData("text/plain") ||
  fallbackId ||
  "";

type ShiftEmployeeChip = {
  id: string;
  name: string;
  color: string;
  avatarUrl?: string;
  availabilityWarning?: string | null;
  approvedLeaveHint?: string | null;
};

function EmployeeViewStatusBadges({
  emp,
  shift,
  locale,
  substitutionLabel,
}: {
  emp?: ShiftEmployeeChip;
  shift: ScheduleShift;
  locale: "zh" | "en";
  substitutionLabel: string;
}) {
  if (!emp) return null;
  const onApprovedLeave = !!emp.approvedLeaveHint;
  const onSubstitution = !!shift.isSubstitution;
  const hasAvailabilityWarning = !!emp.availabilityWarning;
  if (!onApprovedLeave && !onSubstitution && !hasAvailabilityWarning) return null;

  const tooltipTitle = (
    <div style={{ fontSize: 12, lineHeight: 1.35 }}>
      {onSubstitution ? (
        <div>
          <span
            className="inline-flex items-center rounded px-1.5 py-0.5"
            style={{
              fontWeight: 800,
              color: "#F3E8FF",
              background: "rgba(124, 58, 237, 0.28)",
              border: "1px solid rgba(196, 181, 253, 0.45)",
            }}
          >
            {shift.originalDisplayName
              ? `${substitutionLabel}: ${shift.originalDisplayName}`
              : locale === "zh"
                ? "替班"
                : "Substitution"}
          </span>
        </div>
      ) : null}
      {emp.approvedLeaveHint ? (
        <div style={{ marginTop: onSubstitution ? 6 : 0 }}>
          <span
            className="inline-flex items-center rounded px-1.5 py-0.5"
            style={{
              fontWeight: 800,
              color: "#DCFCE7",
              background: "rgba(34, 197, 94, 0.28)",
              border: "1px solid rgba(134, 239, 172, 0.45)",
            }}
          >
            {emp.approvedLeaveHint}
          </span>
        </div>
      ) : null}
      {emp.availabilityWarning ? (
        <div
          style={{
            marginTop: onSubstitution || emp.approvedLeaveHint ? 6 : 0,
          }}
        >
          {emp.availabilityWarning}
        </div>
      ) : null}
    </div>
  );

  return (
    <Tooltip title={tooltipTitle}>
      <span className="inline-flex items-center gap-0.5 flex-shrink-0">
        {onSubstitution ? (
          <span
            className="rounded px-1 font-bold"
            style={{
              fontSize: 12,
              background: "#f3e8ff",
              color: "#7c3aed",
              border: "1px solid #c4b5fd",
              lineHeight: 1.2,
            }}
          >
            {locale === "zh" ? "替" : "Sub"}
          </span>
        ) : null}
        {onApprovedLeave ? (
          <span
            className="rounded px-1 font-bold"
            style={{
              fontSize: 12,
              background: "rgba(34, 197, 94, 0.18)",
              color: "#065f46",
              border: "1px solid rgba(34, 197, 94, 0.35)",
              lineHeight: 1.2,
            }}
          >
            {locale === "zh" ? "假" : "Leave"}
          </span>
        ) : null}
        {hasAvailabilityWarning ? (
          <AlertTriangle
            size={9}
            style={{ color: "var(--destructive)", flexShrink: 0 }}
          />
        ) : null}
      </span>
    </Tooltip>
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
    /** Approved date-range leave hint for the shift date (for display only) */
    approvedLeaveHint?: string | null;
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
  readonly?: boolean;
  viewMode?: RosterGridViewMode;
  areaName?: string;
  /** Personal view: only render chip for this row employee */
  rowEmployeeId?: string;
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
  readonly = false,
  viewMode = "area",
  areaName = "",
  rowEmployeeId = "",
}: ShiftEntryProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const { locale, t } = useLocale();
  if (!shift) return null;
  const isSubstitutionLocked = !!shift.isSubstitution;
  const isLocked = readonly || isSubstitutionLocked;
  const isEmployeeView = viewMode === "employee";
  const displayEmployees =
    isEmployeeView && rowEmployeeId
      ? assignedEmployees.filter((emp) => emp.id === rowEmployeeId)
      : assignedEmployees;
  const rowEmp = isEmployeeView ? displayEmployees[0] : undefined;
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
        if (isLocked && !hasTemplateDragData(e.dataTransfer)) return;
        if (isEmployeeView && !hasTemplateDragData(e.dataTransfer)) return;
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
          if (isLocked) return;
          onDropTemplate(templateId);
          return;
        }
        if (isEmployeeView) return;
        if (isLocked) return;
        const empId = e.dataTransfer.getData("employeeId");
        if (empId) onDropEmployee(empId);
      }}
    >
      {/* Time + status badges + hours */}
      <div className="flex items-center gap-1 flex-wrap mb-0.5">
        <Clock size={10} style={{ color: "var(--foreground)" }} />
        <span style={{ fontSize: 11, color: "var(--foreground)" }}>
          {formatTime12(shift.startTime)} – {formatTime12(shift.endTime)}
        </span>
        <div className="ml-auto flex items-center gap-0.5 flex-shrink-0">
          {isEmployeeView ? (
            <EmployeeViewStatusBadges
              emp={rowEmp}
              shift={shift}
              locale={locale}
              substitutionLabel={t.schedule.substitutionReplacedFor}
            />
          ) : null}
          <span
            className="rounded-full px-1 font-semibold"
            style={{
              fontSize: 10,
              background: cs.border,
              color: "var(--primary-foreground)",
            }}
          >
            {hrs}h
          </span>
        </div>
      </div>

      {/* Shift name + action buttons (moved down) */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1">
        <div className="min-w-0 w-full overflow-hidden">
          <span className="inline-flex items-center gap-1 min-w-0 max-w-full">
            <span
              className="text-xs font-semibold truncate"
              style={{ color: "var(--foreground)", fontSize: 14 }}
              title={shift.shiftName || ""}
            >
              {shift.shiftName || formatTime12(shift.startTime)}
            </span>
            {shift.isSubstitution && !isEmployeeView ? (
              <span
                className="rounded px-1 font-bold flex-shrink-0"
                style={{
                  fontSize: 10,
                  background: "#f3e8ff",
                  color: "#7c3aed",
                  border: "1px solid #c4b5fd",
                  lineHeight: 1.2,
                }}
              >
                {locale === "zh" ? "替班" : "Sub"}
              </span>
            ) : null}
          </span>
        </div>
        {!isLocked && (
          <div className="flex items-center gap-0.5 justify-self-end opacity-0 transition-opacity flex-shrink-0 group-hover:opacity-100">
            <button
              onClick={onEdit}
              className="rounded p-0.5 hover:opacity-70"
              style={{ color: "var(--muted-foreground)" }}
            >
              <Edit2 size={10} />
            </button>
            <Popconfirm
              title={
                locale === "zh" ? "确认删除该班次？" : "Delete this shift?"
              }
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
        )}
      </div>

      {shift.isSubstitution && shift.originalDisplayName ? (
        <div
          className="mt-0.5 truncate"
          style={{ fontSize: 11, color: "#6d28d9", fontWeight: 600 }}
          title={`${t.schedule.substitutionReplacedFor}: ${shift.originalDisplayName}`}
        >
          {t.schedule.substitutionReplacedFor}: {shift.originalDisplayName}
        </div>
      ) : null}

      {isEmployeeView && areaName ? (
        <div
          className="mt-0.5 truncate"
          style={{ fontSize: 11, color: "var(--muted-foreground)", fontWeight: 600 }}
          title={areaName}
        >
          {areaName}
        </div>
      ) : null}

      {/* Add employee button (above employee list) */}
      {!isEmployeeView && !isLocked && (
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
              fontSize: 11,
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
      )}

      {/* Employees — area view only */}
      {!isEmployeeView && displayEmployees.length > 0 && (
        <div className="mt-1 flex w-full flex-wrap items-center gap-0.5 min-w-0">
          {displayEmployees.map((emp) => {
            const onApprovedLeave = !!emp.approvedLeaveHint;
            const tooltipTitle =
              emp.approvedLeaveHint || emp.availabilityWarning
                ? (
                    <div style={{ fontSize: 12, lineHeight: 1.35 }}>
                      {emp.approvedLeaveHint ? (
                        <div>
                          <span
                            className="inline-flex items-center rounded px-1.5 py-0.5"
                            style={{
                              fontWeight: 800,
                              color: "#DCFCE7",
                              background: "rgba(34, 197, 94, 0.28)",
                              border: "1px solid rgba(134, 239, 172, 0.45)",
                            }}
                          >
                            {emp.approvedLeaveHint}
                          </span>
                        </div>
                      ) : null}
                      {emp.availabilityWarning ? (
                        <div style={{ marginTop: emp.approvedLeaveHint ? 6 : 0 }}>
                          {emp.availabilityWarning}
                        </div>
                      ) : null}
                    </div>
                  )
                : undefined;
            return (
              <Tooltip key={emp.id} title={tooltipTitle}>
              <div
                className="flex max-w-full min-w-0 items-center gap-0.5 rounded-md px-1 py-0.5"
                style={{
                  background: onApprovedLeave
                    ? "rgba(34, 197, 94, 0.12)"
                    : "var(--card)",
                  border: emp.availabilityWarning
                    ? "1px solid var(--destructive)"
                    : onApprovedLeave
                      ? "1px solid rgba(34, 197, 94, 0.35)"
                    : "1px solid transparent",
                }}
              >
                <Avatar
                  size={13}
                  src={emp.avatarUrl || undefined}
                  style={{
                    background: emp.color,
                    flexShrink: 0,
                    fontSize: 11,
                  }}
                >
                  {getEmployeeInitials(emp.name)}
                </Avatar>
                <span
                  className="min-w-0 flex-1 truncate text-xs"
                  style={{
                    color: emp.availabilityWarning
                      ? "var(--destructive)"
                      : onApprovedLeave
                        ? "#065f46"
                        : "var(--foreground)",
                    maxWidth: 72,
                    fontSize: 14,
                    fontWeight: emp.availabilityWarning ? 700 : 400,
                  }}
                >
                  {emp.name}
                </span>
                {onApprovedLeave && (
                  <span
                    className="rounded px-1 flex-shrink-0"
                    style={{
                      fontSize: 12,
                      background: "rgba(34, 197, 94, 0.18)",
                      color: "#065f46",
                      border: "1px solid rgba(34, 197, 94, 0.35)",
                      lineHeight: 1.2,
                      fontWeight: 800,
                    }}
                  >
                    {locale === "zh" ? "假" : "Leave"}
                  </span>
                )}
                {emp.availabilityWarning && (
                  <AlertTriangle
                    size={9}
                    style={{ color: "var(--destructive)", flexShrink: 0 }}
                  />
                )}
                {!isLocked && (
                  <button
                    onClick={() => onRemoveEmployee(emp.id)}
                    className="rounded-full hover:opacity-70"
                    style={{ color: "var(--muted-foreground)", flexShrink: 0 }}
                  >
                    <X size={9} />
                  </button>
                )}
              </div>
            </Tooltip>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── DateColHeader (droppable for templates) ──────────────────────────────────

interface DateColHeaderProps {
  date?: dayjs.Dayjs;
  dayLabel?: string;
  isToday?: boolean;
  isClosedDay?: boolean;
  isPublicHoliday?: boolean;
  publicHolidayName?: string;
  dateFormatCountry?: string;
  onDropTemplate?: (templateId: string, dateStr: string) => void;
  shiftCount?: number;
  readonly?: boolean;
}

function DateColHeader({
  date,
  dayLabel = "",
  isToday = false,
  isClosedDay = false,
  isPublicHoliday = false,
  publicHolidayName = "",
  dateFormatCountry = "",
  onDropTemplate = () => {},
  shiftCount = 0,
  readonly = false,
}: DateColHeaderProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const { locale } = useLocale();

  const handleDragOver = (e: React.DragEvent) => {
    const isTemplateDrag = hasTemplateDragData(e.dataTransfer);
    if (readonly && !isTemplateDrag) return;
    if (isTemplateDrag) {
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
      return;
    }
    if (readonly) return;
  };

  return (
    <div
      data-cmp="DateColHeader"
      className="flex flex-col items-center justify-center relative transition-all"
      style={{
        flex: `1 1 ${DATE_COL_MIN_W}px`,
        minWidth: DATE_COL_MIN_W,
        minHeight: 44,
        borderRight: "1px solid var(--border)",
        background: isDragOver
          ? "var(--accent)"
          : isToday
            ? "var(--primary)"
            : isPublicHoliday
              ? "rgba(250, 204, 21, 0.16)"
            : isClosedDay
              ? "var(--workday-weekend-header)"
              : "var(--card)",
        cursor: isDragOver ? "copy" : "default",
        border: isDragOver ? `2px dashed var(--primary)` : undefined,
        opacity: readonly ? 0.82 : 1,
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
            : isPublicHoliday
              ? "rgba(161, 98, 7, 0.95)"
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
            : isPublicHoliday
              ? "rgba(120, 53, 15, 0.98)"
            : isClosedDay
              ? "var(--workday-weekend-text)"
              : "var(--foreground)",
          lineHeight: 1.05,
        }}
      >
        <span className="inline-flex items-center gap-1">
          <span>{dayLabel}</span>
          {isPublicHoliday && !isDragOver && (
            <span
              className="rounded-full px-1.5 py-0.5"
              title={
                publicHolidayName ||
                (locale === "zh" ? "公共假期" : "Public holiday")
              }
              style={{
                fontSize: 9,
                fontWeight: 800,
                background: "rgba(250, 204, 21, 0.26)",
                color: "rgba(120, 53, 15, 0.98)",
                border: "1px solid rgba(250, 204, 21, 0.55)",
                lineHeight: 1,
              }}
            >
              {locale === "zh" ? "公假" : "Holiday"}
            </span>
          )}
        </span>
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
  getApprovedLeaveHint?: (
    empId: string,
    shift: Pick<ScheduleShift, "date" | "startTime" | "endTime">,
  ) => string | null;
  isToday?: boolean;
  isClosedDay?: boolean;
  isPublicHoliday?: boolean;
  readonly?: boolean;
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
  getApprovedLeaveHint = () => null,
  isToday = false,
  isClosedDay = false,
  isPublicHoliday = false,
  readonly = false,
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
    } else if (readonly) {
      return;
    } else if (empId) {
      const dateStr = date?.format("YYYY-MM-DD") || "";
      // Drop onto the cell itself (no specific shift) → create a new shift for this employee
      onDropEmployee(empId, areaId, dateStr);
    }
  };

  return (
    <div
      data-cmp="AreaDateCell"
      className="p-1.5"
      style={{
        flex: `1 1 ${DATE_COL_MIN_W}px`,
        minWidth: DATE_COL_MIN_W,
        minHeight: 88,
        borderRight: "1px solid var(--border)",
        background: isDragOver
          ? "var(--secondary)"
          : isToday
            ? "var(--workday-active-bg)"
            : isPublicHoliday
              ? "rgba(250, 204, 21, 0.12)"
            : isClosedDay
              ? "var(--workday-weekend-header)"
              : "transparent",
        transition: "background 0.12s",
        outline: isDragOver ? `2px dashed var(--primary)` : undefined,
        outlineOffset: -2,
        opacity: readonly ? 0.82 : 1,
      }}
      onDragOver={(e) => {
        if (readonly && !hasTemplateDragData(e.dataTransfer)) return;
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
          approvedLeaveHint: getApprovedLeaveHint(empId, sh),
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
            readonly={readonly}
            viewMode="area"
          />
        );
      })}

      {/* Add shift button — matches RosterTemplate's dashed pill button style */}
      {!readonly && (
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
      )}
    </div>
  );
}

// ─── EmployeeDateCell (employee × date) ────────────────────────────────────────

interface EmployeeDateCellProps {
  date?: dayjs.Dayjs;
  employeeId?: string;
  rowKind?: "employee" | "unassigned" | "add-employee";
  shifts?: ScheduleShift[];
  areaNameMap?: Record<string, string>;
  employees?: {
    id: string;
    name: string;
    color: string;
    avatarUrl?: string;
    availabilityWarning?: string | null;
  }[];
  defaultAreaId?: string;
  onAddShift?: (employeeId: string, date: string, defaultAreaId: string) => void;
  onEditShift?: (shift: ScheduleShift, rowEmployeeId?: string) => void;
  onDeleteShift?: (shiftId: string, rowEmployeeId?: string) => void;
  onRemoveEmployeeFromShift?: (shiftId: string, empId: string) => void;
  onDropEmployee?: (
    empId: string,
    date: string,
    defaultAreaId: string,
  ) => void;
  onDropEmployeeToShift?: (empId: string, shift: ScheduleShift) => void;
  onDropTemplate?: (templateId: string, dateStr: string) => void;
  onAddEmployeeToRoster?: (empId: string) => void;
  sidebarDragEmpId?: string | null;
  getAvailabilityWarning?: (
    empId: string,
    shift: ScheduleShift,
  ) => string | null;
  getApprovedLeaveHint?: (
    empId: string,
    shift: Pick<ScheduleShift, "date" | "startTime" | "endTime">,
  ) => string | null;
  isToday?: boolean;
  isClosedDay?: boolean;
  isPublicHoliday?: boolean;
  readonly?: boolean;
}

function EmployeeDateCell({
  date,
  employeeId = "",
  rowKind = "employee",
  shifts = [],
  areaNameMap = {},
  employees = [],
  defaultAreaId = "",
  onAddShift = () => {},
  onEditShift = () => {},
  onDeleteShift = () => {},
  onRemoveEmployeeFromShift = () => {},
  onDropEmployee = () => {},
  onDropEmployeeToShift = () => {},
  onDropTemplate = () => {},
  onAddEmployeeToRoster = () => {},
  sidebarDragEmpId = null,
  getAvailabilityWarning = () => null,
  getApprovedLeaveHint = () => null,
  isToday = false,
  isClosedDay = false,
  isPublicHoliday = false,
  readonly = false,
}: EmployeeDateCellProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const { locale } = useLocale();
  const dateStr = date?.format("YYYY-MM-DD") || "";
  const isAddEmployeeRow = rowKind === "add-employee";

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
    if (templateId) {
      onDropTemplate(templateId, dateStr);
      return;
    }
    const empId = readSidebarEmployeeId(e, sidebarDragEmpId);
    if (sidebarDragEmpId && empId) {
      e.stopPropagation();
      onAddEmployeeToRoster(empId);
      return;
    }
    if (readonly) return;
    if (empId && defaultAreaId) {
      onDropEmployee(empId, dateStr, defaultAreaId);
    }
  };

  return (
    <div
      data-cmp="EmployeeDateCell"
      className="p-1.5"
      style={{
        flex: `1 1 ${DATE_COL_MIN_W}px`,
        minWidth: DATE_COL_MIN_W,
        minHeight: isAddEmployeeRow ? 44 : 88,
        borderRight: "1px solid var(--border)",
        background: isDragOver
          ? "var(--secondary)"
          : isAddEmployeeRow
            ? "var(--muted)"
            : isToday
              ? "var(--workday-active-bg)"
              : isPublicHoliday
                ? "rgba(250, 204, 21, 0.12)"
                : isClosedDay
                  ? "var(--workday-weekend-header)"
                  : "transparent",
        transition: "background 0.12s",
        outline: isDragOver ? `2px dashed var(--primary)` : undefined,
        outlineOffset: -2,
        opacity: readonly ? 0.82 : 1,
      }}
      onDragOver={(e) => {
        if (hasTemplateDragData(e.dataTransfer)) {
          e.preventDefault();
          setIsDragOver(true);
          return;
        }
        if (sidebarDragEmpId) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "copy";
          setIsDragOver(true);
          return;
        }
        if (readonly) return;
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={handleCellDrop}
    >
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

      {shifts.map((sh) => {
        const assignedEmps = getShiftEmployeeIds(sh).map((empId) => ({
          id: empId,
          name: empMap[empId]?.name || empId,
          color: empMap[empId]?.color || "var(--primary)",
          avatarUrl: empMap[empId]?.avatarUrl || "",
          availabilityWarning: getAvailabilityWarning(empId, sh),
          approvedLeaveHint: getApprovedLeaveHint(empId, sh),
        }));
        return (
          <ShiftEntry
            key={sh.id}
            shift={sh}
            assignedEmployees={assignedEmps}
            onEdit={() =>
              onEditShift(sh, rowKind === "employee" ? employeeId : undefined)
            }
            onDelete={() =>
              onDeleteShift(
                sh.id,
                rowKind === "employee" ? employeeId : undefined,
              )
            }
            onRemoveEmployee={(empId) =>
              onRemoveEmployeeFromShift(sh.id, empId)
            }
            onDropEmployee={(empId) => onDropEmployeeToShift(empId, sh)}
            onDropTemplate={(templateId) => onDropTemplate(templateId, dateStr)}
            onAddEmployeeClick={() =>
              onEditShift(sh, rowKind === "employee" ? employeeId : undefined)
            }
            readonly={readonly}
            viewMode="employee"
            areaName={areaNameMap[sh.areaId] || sh.areaId}
            rowEmployeeId={
              rowKind === "employee" ? employeeId : undefined
            }
          />
        );
      })}

      {!readonly && defaultAreaId && !isAddEmployeeRow && (
        <button
          onClick={() =>
            onAddShift(
              rowKind === "unassigned" ? "" : employeeId,
              dateStr,
              defaultAreaId,
            )
          }
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
      )}
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
    employeeDateLeaves,
    employeeShiftLeaves,
    saveScheduleDraft,
    publishSchedule,
    loading: dataLoading,
    stores,
    areas,
    rosterTemplates: rawRosterTemplates,
  } = useData();
  const { selectedStoreId } = useStore();
  const scheduleBaselineRef = useRef("");
  const [isScheduleDirty, setIsScheduleDirty] = useState(false);

  // ── Week navigation ─────────────────────────────────────────────────────────
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = dayjs()
    .startOf("isoWeek")
    .add(weekOffset * 7, "day");
  const weekDates = Array.from({ length: 7 }, (_, i) =>
    weekStart.add(i, "day"),
  );
  const weekFromStr = weekDates[0].format("YYYY-MM-DD");
  const weekToStr = weekDates[6].format("YYYY-MM-DD");

  const dateLeavesForStore = useMemo(() => {
    if (!selectedStoreId) return employeeDateLeaves;
    return employeeDateLeaves.filter(
      (l) => !l.storeId || String(l.storeId) === String(selectedStoreId),
    );
  }, [employeeDateLeaves, selectedStoreId]);

  const shiftLeavesForStore = useMemo(() => {
    if (!selectedStoreId) return employeeShiftLeaves;
    return employeeShiftLeaves.filter(
      (l) => !l.storeId || String(l.storeId) === String(selectedStoreId),
    );
  }, [employeeShiftLeaves, selectedStoreId]);
  const isReadonlyWeek = weekDates.every((date) =>
    !isScheduleDateEditable(date),
  );
  const readonlyRosterMessage = isZh
    ? "当前日期及之前的排班只能查看，不能修改"
    : "Rosters for today and earlier are read-only";
  const todayStr = dayjs().format("YYYY-MM-DD");
  const selectedStore =
    stores.find((store) => store.id === selectedStoreId) || stores[0];
  const dateFormatCountry = selectedStore?.country;
  const isStoreClosedDate = (date: dayjs.Dayjs) =>
    isStoreClosedOnWeekday(selectedStore, date.isoWeekday());
  const publicHolidayNameByDate = useMemo(() => {
    const map = new Map<string, string>();
    (selectedStore?.publicHolidays || []).forEach((holiday) => {
      const dateStr = (holiday?.date || "").slice(0, 10);
      if (!dateStr) return;
      map.set(dateStr, holiday?.name || "");
    });
    return map;
  }, [selectedStore?.publicHolidays]);

  // ── Left panel state ────────────────────────────────────────────────────────
  const [leftTab, setLeftTab] = useState<"templates" | "employees">(
    "templates",
  );
  const [templateSearch, setTemplateSearch] = useState("");
  const [gridViewMode, setGridViewMode] = useState<RosterGridViewMode>(() =>
    readStoredGridViewMode(ROSTER_GRID_VIEW_STORAGE_KEY),
  );
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [dragEmpId, setDragEmpId] = useState<string | null>(null);
  const [rosterMemberEmployeeIds, setRosterMemberEmployeeIds] = useState<
    string[]
  >([]);
  const rosterScopeKeyRef = useRef("");

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
  const [shiftModalMode, setShiftModalMode] = useState<ShiftModalMode>("area");
  const [lockedEmployeeId, setLockedEmployeeId] = useState("");
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
  const conflictEmployeeIdSet = useMemo(() => {
    if (!shiftForm.date || !shiftForm.startTime || !shiftForm.endTime) {
      return new Set<string>();
    }
    const nextShift = {
      date: shiftForm.date,
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
    };
    const set = new Set<string>();
    for (const emp of activeEmployees) {
      const empId = emp.id;
      const hasConflict = scheduleShifts.some((s) => {
        if (!s.date) return false;
        if (s.isGlobalPreset) return false;
        if (s.id === editingShift?.id) return false;
        if (!getShiftEmployeeIds(s).includes(empId)) return false;
        return datedShiftsOverlap(nextShift, s);
      });
      if (hasConflict) set.add(empId);
    }
    return set;
  }, [
    activeEmployees,
    editingShift?.id,
    scheduleShifts,
    shiftForm.date,
    shiftForm.endTime,
    shiftForm.startTime,
  ]);

  // Areas: use shared base area data from context
  const displayAreas: Area[] = areas
    .filter(
      (area) =>
        !selectedStoreId ||
        (area.areaType || "store") === "general" ||
        area.storeId === selectedStoreId,
    )
    .sort((a, b) => a.order - b.order);

  const defaultScheduleAreaId = displayAreas[0]?.id || "";

  const areaNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    areas.forEach((area) => {
      map[area.id] = area.name;
    });
    return map;
  }, [areas]);

  useEffect(() => {
    storeGridViewMode(ROSTER_GRID_VIEW_STORAGE_KEY, gridViewMode);
  }, [gridViewMode]);

  const hasUnassignedShiftsInWeek = useMemo(
    () =>
      weekDates.some((d) => {
        const dateStr = d.format("YYYY-MM-DD");
        return (
          filterUnassignedShiftsOnDate(
            scheduleShifts,
            dateStr,
            selectedStoreId,
          ).length > 0
        );
      }),
    [weekDates, scheduleShifts, selectedStoreId],
  );

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

  const rosterScopeKey = `${selectedStoreId || "all"}:${weekFromStr}`;

  useEffect(() => {
    const shiftMemberIds = getWeekScheduleMemberEmployeeIds(
      scheduleShifts,
      weekFromStr,
      weekToStr,
      selectedStoreId,
    );

    if (rosterScopeKeyRef.current !== rosterScopeKey) {
      rosterScopeKeyRef.current = rosterScopeKey;
      setRosterMemberEmployeeIds(shiftMemberIds);
      return;
    }

    setRosterMemberEmployeeIds((prev) => {
      const next = [...prev];
      let changed = false;
      shiftMemberIds.forEach((id) => {
        if (!next.includes(id)) {
          next.push(id);
          changed = true;
        }
      });
      return changed ? next : prev;
    });
  }, [rosterScopeKey, scheduleShifts, weekFromStr, weekToStr, selectedStoreId]);

  const rosterMemberEmployeeIdSet = useMemo(
    () => new Set(rosterMemberEmployeeIds),
    [rosterMemberEmployeeIds],
  );

  const sidebarEmployees = useMemo(() => {
    if (gridViewMode !== "employee") return filteredEmployees;
    return filteredEmployees.filter(
      (employee) => !rosterMemberEmployeeIdSet.has(employee.id),
    );
  }, [filteredEmployees, gridViewMode, rosterMemberEmployeeIdSet]);

  const gridEmployees = useMemo(() => {
    if (gridViewMode !== "employee") return filteredEmployees;
    const empById = new Map(
      filteredEmployees.map((employee) => [employee.id, employee]),
    );
    return rosterMemberEmployeeIds
      .map((id) => empById.get(id))
      .filter(Boolean) as typeof filteredEmployees;
  }, [filteredEmployees, gridViewMode, rosterMemberEmployeeIds]);

  const empNameMap: Record<string, string> = {};
  const empColorMap: Record<string, string> = {};
  employees.forEach((e) => {
    empNameMap[e.id] = `${e.firstName} ${e.lastName}`;
    empColorMap[e.id] = e.employeeColor || "var(--primary)";
  });

  const getSidebarDateLeaveWarning = (empId: string): string | null => {
    const hit = dateLeavesForStore.find((leave) => {
      if (String(leave.merchantAdminId) !== String(empId)) return false;
      const from = (leave.leaveDateFrom ?? "").slice(0, 10);
      const to = (leave.leaveDateTo ?? "").slice(0, 10);
      if (!from || !to) return false;
      return weekFromStr <= to && weekToStr >= from;
    });
    if (!hit) return null;
    const range = `${(hit.leaveDateFrom ?? "").slice(0, 10)} ~ ${(hit.leaveDateTo ?? "").slice(0, 10)}`;
    if (hit.status === "pending") {
      return isZh
        ? `本周与待审批按日期请假重叠（${range}），建议勿排班`
        : `Overlaps pending date leave this week (${range}); avoid scheduling`;
    }
    return isZh
      ? `本周与已批准按日期请假重叠（${range}），建议勿排班`
      : `Overlaps approved date leave this week (${range}); avoid scheduling`;
  };

  const findDateLeaveWarning = (empId: string, dateStr: string): string | null => {
    const hit = dateLeavesForStore.find((leave) => {
      if (String(leave.merchantAdminId) !== String(empId)) return false;
      const from = (leave.leaveDateFrom ?? "").slice(0, 10);
      const to = (leave.leaveDateTo ?? "").slice(0, 10);
      if (!from || !to) return false;
      return dateStr >= from && dateStr <= to;
    });
    if (!hit) return null;
    const range = `${(hit.leaveDateFrom ?? "").slice(0, 10)} ~ ${(hit.leaveDateTo ?? "").slice(0, 10)}`;
    if (hit.status === "pending") {
      return isZh
        ? `该员工在此区间有待审批请假（${range}），建议勿排班`
        : `Pending date leave (${range}); avoid scheduling`;
    }
    return isZh
      ? `该员工在此区间已请假（${range}），建议勿排班`
      : `Approved date leave (${range}); avoid scheduling`;
  };

  const findAvailabilityWarning = (
    empId: string,
    shift: Pick<ScheduleShift, "date" | "startTime" | "endTime">,
  ) => {
    const dateLeaveWarning = findDateLeaveWarning(empId, shift.date);
    if (dateLeaveWarning) return dateLeaveWarning;
    const employee = activeEmployees.find((item) => item.id === empId);
    if (!employee) return null;
    return getDatedShiftAvailabilityWarning(employee, shift, locale);
  };

  /**
   * 多人格子：只标示“已批准请假”（按班次/部分班次优先，其次按日期区间），不把整格染色、也不把它当作 destructive warning。
   */
  const findApprovedLeaveHint = (
    empId: string,
    shift: Pick<ScheduleShift, "date" | "startTime" | "endTime">,
  ): string | null => {
    const dateStr = shift.date;
    const shiftStart = (shift.startTime || "").trim();
    const shiftEnd = (shift.endTime || "").trim();

    const toMinutes = (hhmm: string): number | null => {
      if (!hhmm) return null;
      const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
      if (!m) return null;
      const h = Number(m[1]);
      const mm = Number(m[2]);
      if (!Number.isFinite(h) || !Number.isFinite(mm) || h < 0 || h > 23 || mm < 0 || mm > 59) return null;
      return h * 60 + mm;
    };
    const normalizeRange = (start: string, end: string): { s: number; e: number } | null => {
      const s0 = toMinutes(start);
      const e0 = toMinutes(end);
      if (s0 == null || e0 == null) return null;
      const e = e0 <= s0 ? e0 + 24 * 60 : e0;
      return { s: s0, e };
    };
    const overlaps = (a: { s: number; e: number }, b: { s: number; e: number }) =>
      Math.max(a.s, b.s) < Math.min(a.e, b.e);

    const shiftRange = normalizeRange(shiftStart, shiftEnd);

    if (shiftRange) {
      const hitShift = shiftLeavesForStore.find((leave) => {
        if (String(leave.merchantAdminId) !== String(empId)) return false;
        const d = (leave.scheduleDate ?? "").slice(0, 10);
        if (!d) return false;
        if (dateStr !== d) return false;

        const st = (leave.shiftStartTime ?? "").trim();
        const et = (leave.shiftEndTime ?? "").trim();
        const ps = (leave.partialStartTime ?? "").trim();
        const pe = (leave.partialEndTime ?? "").trim();
        const effect = (leave.leaveEffect ?? "").trim();

        let leaveRange: { s: number; e: number } | null = null;
        if (effect === "late_in") {
          leaveRange = normalizeRange(st, pe);
        } else if (effect === "early_out") {
          leaveRange = normalizeRange(ps, et);
        } else if (effect === "full") {
          leaveRange = normalizeRange(st, et);
        } else {
          leaveRange = normalizeRange(st, et);
        }
        if (!leaveRange) return false;
        return overlaps(shiftRange, leaveRange);
      });

      if (hitShift) {
        const st = (hitShift.shiftStartTime ?? "").trim();
        const et = (hitShift.shiftEndTime ?? "").trim();
        const ps = (hitShift.partialStartTime ?? "").trim();
        const pe = (hitShift.partialEndTime ?? "").trim();
        const effect = (hitShift.leaveEffect ?? "").trim();
        if (effect === "late_in") {
          const span = `${st || "??:??"} ~ ${pe || "??:??"}`;
          return isZh ? `已批准请假（晚到 ${span}）` : `Approved leave (late in ${span})`;
        }
        if (effect === "early_out") {
          const span = `${ps || "??:??"} ~ ${et || "??:??"}`;
          return isZh ? `已批准请假（早退 ${span}）` : `Approved leave (early out ${span})`;
        }
        if (effect === "full") {
          const span = `${st || "??:??"} ~ ${et || "??:??"}`;
          return isZh ? `已批准请假（整班次 ${span}）` : `Approved leave (full shift ${span})`;
        }
        return isZh ? "已批准请假（按班次）" : "Approved leave (shift)";
      }
    }

    const hit = dateLeavesForStore.find((leave) => {
      if (leave.status !== "approved") return false;
      if (String(leave.merchantAdminId) !== String(empId)) return false;
      const from = (leave.leaveDateFrom ?? "").slice(0, 10);
      const to = (leave.leaveDateTo ?? "").slice(0, 10);
      if (!from || !to) return false;
      return dateStr >= from && dateStr <= to;
    });
    if (!hit) return null;
    const range = `${(hit.leaveDateFrom ?? "").slice(0, 10)} ~ ${(hit.leaveDateTo ?? "").slice(0, 10)}`;
    return isZh ? `已批准请假（${range}）` : `Approved leave (${range})`;
  };

  /**
   * 给格子内的员工 chip 使用：仅检查排班模式/工作时段可用性，不把“按日期请假”当作 destructive warning。
   */
  const findPatternAvailabilityWarning = (
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

  const buildScheduleSnapshot = useCallback(
    (shifts: ScheduleShift[]) => {
      const scoped = shifts
        .filter(
          (shift) =>
            !shift.isGlobalPreset &&
            shift.date &&
            isScheduleDateEditable(shift.date) &&
            (!selectedStoreId || shift.storeId === selectedStoreId),
        )
        .map((shift) => ({
          id: shift.id,
          shiftId: shift.shiftId || "",
          areaId: shift.areaId,
          date: shift.date,
          storeId: shift.storeId,
          startTime: shift.startTime,
          endTime: shift.endTime,
          breakMinutes: shift.breakMinutes ?? 0,
          shiftName: shift.shiftName || "",
          color: shift.color || "",
          note: shift.note || "",
          status: shift.status,
          employeeIds: [...getShiftEmployeeIds(shift)].sort(),
        }))
        .sort((a, b) =>
          `${a.date}|${a.areaId}|${a.id}`.localeCompare(
            `${b.date}|${b.areaId}|${b.id}`,
          ),
        );
      return JSON.stringify(scoped);
    },
    [selectedStoreId],
  );

  const syncScheduleBaseline = useCallback(() => {
    scheduleBaselineRef.current = buildScheduleSnapshot(scheduleShifts);
    setIsScheduleDirty(false);
  }, [buildScheduleSnapshot, scheduleShifts]);

  useEffect(() => {
    scheduleBaselineRef.current = "";
    setIsScheduleDirty(false);
  }, [selectedStoreId]);

  useEffect(() => {
    if (!selectedStoreId || dataLoading) return;

    const snapshot = buildScheduleSnapshot(scheduleShifts);
    if (!scheduleBaselineRef.current) {
      scheduleBaselineRef.current = snapshot;
      setIsScheduleDirty(false);
      return;
    }

    setIsScheduleDirty(snapshot !== scheduleBaselineRef.current);
  }, [
    buildScheduleSnapshot,
    dataLoading,
    scheduleShifts,
    selectedStoreId,
  ]);

  /** Any editable draft for the current store (controls Publish visibility). */
  const publishableDraftCount = useMemo(
    () =>
      scheduleShifts.filter(
        (shift) =>
          !shift.isGlobalPreset &&
          isScheduleDateEditable(shift.date) &&
          shift.status === "draft" &&
          (!selectedStoreId || shift.storeId === selectedStoreId),
      ).length,
    [scheduleShifts, selectedStoreId],
  );

  const draftCount = scheduleShifts.filter((s) => {
    const d = dayjs(s.date);
    return (
      isScheduleDateEditable(s.date) &&
      s.status === "draft" &&
      d >= weekStart &&
      d <= weekStart.add(6, "day")
    );
  }).length;

  const publishDirtyTooltip = isZh
    ? "请先保存后再发布"
    : "Save your changes before publishing";

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
    ).filter((date) => isScheduleDateEditable(date));
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
      if (!isScheduleDateEditable(targetDate)) return;

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
      endDate:
        coveredDates[coveredDates.length - 1] ||
        dayjs(startDate)
          .add(Math.max(rawTmpl.totalDays, 1) - 1, "day")
          .format("YYYY-MM-DD"),
      totalDays: coveredDates.length,
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
    if (plan.candidateShifts.some((shift) => !isScheduleDateEditable(shift.date))) {
      toast.warning(readonlyRosterMessage);
      return;
    }

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
        if (!isScheduleDateEditable(shift.date)) return true;
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

        if (validEmployeeIds.length === 0) {
          if (employeeIds.length > 0) skipped += 1;
          return;
        }

        if (validEmployeeIds.length < employeeIds.length) {
          skipped += employeeIds.length - validEmployeeIds.length;
        }

        const multiEmployeeCandidate: TemplateCandidateShift = {
          ...candidate,
          employeeId: validEmployeeIds[0] || "",
          employeeIds: validEmployeeIds,
        };

        const hasRemainingConflict = workingShifts.some((shift) =>
          shiftConflictsWithTemplateCandidate(
            shift,
            multiEmployeeCandidate,
            false,
          ),
        );
        if (hasRemainingConflict) {
          skipped += 1;
          return;
        }

        workingShifts.push({
          id: `tmpl_${applySeed}_${index}`,
          shiftId: candidate.shiftId,
          employeeId: validEmployeeIds[0] || "",
          employeeIds: validEmployeeIds,
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

  const closeShiftModal = () => {
    setModalOpen(false);
    setEditingShift(null);
    setShiftModalMode("area");
    setLockedEmployeeId("");
  };

  const openAddShift = (
    areaId: string,
    date: string,
    empId = "",
    options?: { modalMode?: ShiftModalMode },
  ) => {
    if (!isScheduleDateEditable(date)) {
      toast.warning(readonlyRosterMessage);
      return;
    }
    const modalMode = options?.modalMode || "area";
    if (modalMode === "area" && !areaId) {
      toast.error(
        isZh ? "请先添加区域" : "Please add an area in Area Management first",
      );
      return;
    }

    setShiftModalMode(modalMode);
    setLockedEmployeeId(modalMode === "employee" ? empId : "");
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

  const openAddShiftForEmployee = (
    empId: string,
    date: string,
    areaId: string,
  ) => {
    if (!empId) {
      openAddShift(areaId, date, "", { modalMode: "area" });
      return;
    }
    openAddShift(areaId || defaultScheduleAreaId, date, empId, {
      modalMode: "employee",
    });
  };

  const handleDropEmployeeByDate = (
    empId: string,
    dateStr: string,
    areaId: string,
  ) => {
    handleDropEmployee(empId, areaId, dateStr);
  };

  const handleAddEmployeeToRoster = (empId: string) => {
    if (!empId) return;
    if (isReadonlyWeek) {
      toast.warning(readonlyRosterMessage);
      setDragEmpId(null);
      return;
    }
    if (rosterMemberEmployeeIdSet.has(empId)) {
      toast.warning(
        locale === "zh" ? "该员工已在排班表中" : "Employee already in roster",
      );
      setDragEmpId(null);
      return;
    }

    setRosterMemberEmployeeIds((prev) => [...prev, empId]);
    setDragEmpId(null);
    toast.success(
      locale === "zh" ? "员工已加入排班表" : "Employee added to roster",
    );
  };

  const handleRemoveEmployeeFromRoster = (empId: string) => {
    if (isReadonlyWeek) {
      toast.warning(readonlyRosterMessage);
      return;
    }

    setRosterMemberEmployeeIds((prev) => prev.filter((id) => id !== empId));
    setScheduleShifts((prev) =>
      prev.map((shift) => {
        const employeeIds = getShiftEmployeeIds(shift).filter(
          (id) => id !== empId,
        );
        if (employeeIds.length === getShiftEmployeeIds(shift).length) {
          return shift;
        }
        return {
          ...shift,
          employeeId: employeeIds[0] || "",
          employeeIds,
        };
      }),
    );
    toast.success(
      locale === "zh" ? "员工已从排班表移除" : "Employee removed from roster",
    );
  };

  const handleRosterMemberDragOver = (e: DragEvent) => {
    if (gridViewMode !== "employee" || !dragEmpId || isReadonlyWeek) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleRosterMemberDrop = (e: DragEvent) => {
    if (gridViewMode !== "employee" || !dragEmpId || isReadonlyWeek) return;
    e.preventDefault();
    e.stopPropagation();
    const empId = readSidebarEmployeeId(e, dragEmpId);
    if (empId) handleAddEmployeeToRoster(empId);
  };

  const openEditShift = (shift: ScheduleShift, rowEmployeeId = "") => {
    if (!isScheduleDateEditable(shift.date)) {
      toast.warning(readonlyRosterMessage);
      return;
    }

    const useEmployeeModal =
      gridViewMode === "employee" && !!rowEmployeeId;
    setShiftModalMode(useEmployeeModal ? "employee" : "area");
    setLockedEmployeeId(useEmployeeModal ? rowEmployeeId : "");

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
    if (!isScheduleDateEditable(shiftForm.date)) {
      toast.warning(readonlyRosterMessage);
      return;
    }
    if (!shiftForm.areaId) {
      toast.error(isZh ? "请选择区域" : "Please select an area");
      return;
    }
    if (!shiftForm.shiftName.trim()) {
      toast.error(locale === "zh" ? "请选择班次" : "Please choose a shift");
      return;
    }

    const empIds =
      shiftModalMode === "employee" && lockedEmployeeId
        ? [lockedEmployeeId]
        : shiftForm.employeeIds.length > 0
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

    const storeIdToUse =
      shiftForm.storeId ||
      selectedStoreId ||
      areas.find((area) => area.id === shiftForm.areaId)?.storeId ||
      stores[0]?.id ||
      "s1";

    const slotKey = makeScheduleShiftSlotKey({
      areaId: shiftForm.areaId,
      date: shiftForm.date,
      startTime: shiftForm.startTime,
      endTime: shiftForm.endTime,
      shiftId: shiftForm.shiftId,
      shiftName: shiftForm.shiftName,
    });

    const checkEmployeeConflicts = (
      employeeIds: string[],
      ignoreShiftId?: string,
    ) => {
      const availabilityWarnings: string[] = [];
      for (const empId of employeeIds) {
        const availabilityWarning = findAvailabilityWarning(empId, nextShift);
        if (availabilityWarning) {
          availabilityWarnings.push(availabilityWarning);
        }

        const hasConflict = scheduleShifts.some((s) => {
          if (ignoreShiftId && s.id === ignoreShiftId) return false;
          if (!getShiftEmployeeIds(s).includes(empId)) return false;
          return datedShiftsOverlap(nextShift, s);
        });

        if (hasConflict) {
          toast.error(
            locale === "zh"
              ? `${empNameMap[empId]} 在该时间段存在冲突`
              : `Conflict detected for ${empNameMap[empId]}`,
          );
          return false;
        }
      }

      if (availabilityWarnings.length > 0) {
        availabilityWarnings.forEach((w) => toast.warning(w));
      }
      return true;
    };

    if (editingShift) {
      if (shiftModalMode === "employee" && lockedEmployeeId) {
        const empId = lockedEmployeeId;

        if (!checkEmployeeConflicts([empId], editingShift.id)) {
          return;
        }

        const oldSlotKey = makeScheduleShiftSlotKey(editingShift);
        const isSameSlot = slotKey === oldSlotKey;
        const remainingIds = getShiftEmployeeIds(editingShift).filter(
          (id) => id !== empId,
        );
        const newShiftFields = {
          shiftId: shiftForm.shiftId || editingShift.shiftId,
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
        };

        if (isSameSlot && getShiftEmployeeIds(editingShift).length > 1) {
          const unchanged =
            (shiftForm.color || "") === (editingShift.color || "") &&
            (shiftForm.note || "") === (editingShift.note || "") &&
            shiftForm.breakMinutes === editingShift.breakMinutes;

          if (unchanged) {
            closeShiftModal();
            return;
          }

          setScheduleShifts((prev) => {
            const shifts = prev
              .map((s) => {
                if (s.id !== editingShift.id) return s;
                return {
                  ...s,
                  employeeId: remainingIds[0] || "",
                  employeeIds: remainingIds,
                };
              })
              .filter((s) => getShiftEmployeeIds(s).length > 0);

            nextCreatedShiftIdRef.current += 1;
            shifts.push({
              ...editingShift,
              id: `sh-new-${nextCreatedShiftIdRef.current}`,
              ...newShiftFields,
              employeeId: empId,
              employeeIds: [empId],
            });

            return shifts;
          });
          closeShiftModal();
          toast.success(locale === "zh" ? "班次已更新" : "Shift updated");
          return;
        }

        setScheduleShifts((prev) => {
          let shifts: ScheduleShift[];

          if (isSameSlot) {
            shifts = prev.map((s) =>
              s.id === editingShift.id
                ? {
                    ...s,
                    ...newShiftFields,
                    employeeId: empId,
                    employeeIds: [empId],
                  }
                : s,
            );
          } else {
            shifts = prev
              .map((s) => {
                if (s.id !== editingShift.id) return s;
                if (remainingIds.length === 0) return null;
                return {
                  ...s,
                  employeeId: remainingIds[0] || "",
                  employeeIds: remainingIds,
                };
              })
              .filter((s): s is ScheduleShift => s !== null);

            const existingAtNew = shifts.find(
              (s) =>
                !s.isGlobalPreset &&
                s.id !== editingShift.id &&
                makeScheduleShiftSlotKey(s) === slotKey,
            );

            if (existingAtNew) {
              const mergedIds = mergeUniqueEmployeeIds(
                getShiftEmployeeIds(existingAtNew),
                [empId],
              );
              shifts = shifts.map((s) =>
                s.id === existingAtNew.id
                  ? {
                      ...s,
                      ...newShiftFields,
                      employeeId: mergedIds[0] || "",
                      employeeIds: mergedIds,
                    }
                  : s,
              );
            } else {
              nextCreatedShiftIdRef.current += 1;
              shifts.push({
                ...editingShift,
                id: `sh-new-${nextCreatedShiftIdRef.current}`,
                ...newShiftFields,
                employeeId: empId,
                employeeIds: [empId],
              });
            }
          }

          return shifts;
        });

        closeShiftModal();
        toast.success(locale === "zh" ? "班次已更新" : "Shift updated");
        return;
      }

      const employeeIdsToSave =
        shiftModalMode === "employee"
          ? getShiftEmployeeIds(editingShift)
          : empIds;

      if (!checkEmployeeConflicts(employeeIdsToSave, editingShift.id)) {
        return;
      }

      const data: ScheduleShift = {
        ...editingShift,
        shiftId: shiftForm.shiftId || editingShift.shiftId,
        employeeId: employeeIdsToSave[0] || "",
        employeeIds: employeeIdsToSave,
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
    } else {
      const existing = scheduleShifts.find(
        (shift) =>
          !shift.isGlobalPreset &&
          makeScheduleShiftSlotKey(shift) === slotKey,
      );

      if (existing) {
        const mergedEmployeeIds = mergeUniqueEmployeeIds(
          getShiftEmployeeIds(existing),
          empIds,
        );
        const newlyAddedEmployeeIds = empIds.filter(
          (empId) => !getShiftEmployeeIds(existing).includes(empId),
        );

        if (
          !checkEmployeeConflicts(newlyAddedEmployeeIds, existing.id)
        ) {
          return;
        }

        setScheduleShifts((prev) =>
          prev.map((shift) =>
            shift.id === existing.id
              ? {
                  ...shift,
                  shiftId: shiftForm.shiftId || shift.shiftId,
                  employeeId: mergedEmployeeIds[0] || "",
                  employeeIds: mergedEmployeeIds,
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
                }
              : shift,
          ),
        );
        toast.success(
          locale === "zh"
            ? newlyAddedEmployeeIds.length > 0
              ? `已添加 ${newlyAddedEmployeeIds.length} 名员工到班次`
              : "班次已更新"
            : newlyAddedEmployeeIds.length > 0
              ? `Added ${newlyAddedEmployeeIds.length} employee${newlyAddedEmployeeIds.length > 1 ? "s" : ""} to shift`
              : "Shift updated",
        );
      } else {
        if (!checkEmployeeConflicts(empIds)) {
          return;
        }

        nextCreatedShiftIdRef.current += 1;
        const newShift: ScheduleShift = {
          id: `sh-new-${nextCreatedShiftIdRef.current}`,
          shiftId: shiftForm.shiftId || undefined,
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
        setScheduleShifts((prev) => [...prev, newShift]);
        toast.success(
          locale === "zh"
            ? `已添加 ${empIds.length} 名员工到班次`
            : `Added ${empIds.length} employee${empIds.length > 1 ? "s" : ""} to shift`,
        );
      }
    }
    closeShiftModal();
  };

  const handleDeleteShift = (id: string) => {
    const targetShift = scheduleShifts.find((shift) => shift.id === id);
    if (targetShift && !isScheduleDateEditable(targetShift.date)) {
      toast.warning(readonlyRosterMessage);
      return;
    }

    setScheduleShifts((prev) => prev.filter((s) => s.id !== id));
    toast.success(locale === "zh" ? "班次已删除" : "Shift deleted");
  };

  const handleDeleteShiftForEmployeeRow = (
    shiftId: string,
    rowEmployeeId?: string,
  ) => {
    if (!rowEmployeeId) {
      handleDeleteShift(shiftId);
      return;
    }

    const targetShift = scheduleShifts.find((shift) => shift.id === shiftId);
    if (!targetShift) return;

    const assignedIds = getShiftEmployeeIds(targetShift);
    if (assignedIds.length <= 1) {
      handleDeleteShift(shiftId);
      return;
    }

    handleRemoveEmployeeFromShift(shiftId, rowEmployeeId);
  };

  const handleRemoveEmployeeFromShift = (shiftId: string, empId: string) => {
    const targetShift = scheduleShifts.find((shift) => shift.id === shiftId);
    if (targetShift && !isScheduleDateEditable(targetShift.date)) {
      toast.warning(readonlyRosterMessage);
      return;
    }

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
    if (!isScheduleDateEditable(dateStr)) {
      toast.warning(readonlyRosterMessage);
      return;
    }

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
    if (!isScheduleDateEditable(targetShift.date)) {
      toast.warning(readonlyRosterMessage);
      return;
    }

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

    const dateLeaveWarning = findDateLeaveWarning(empId, targetShift.date);
    const employee = activeEmployees.find((item) => item.id === empId);
    const patternAvailabilityWarning = employee
      ? getDatedShiftAvailabilityWarning(employee, nextShift, locale)
      : null;

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

    // Other hints should behave like the modal: warning only (not blocking).
    if (dateLeaveWarning) toast.warning(dateLeaveWarning);
    if (patternAvailabilityWarning) toast.warning(patternAvailabilityWarning);

    // Drag-to-shift: directly apply, no modal confirmation.
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

  // ── Drop template onto a date column/cell: anchor to that week's Monday ─────
  const handleDropTemplateToDate = (templateId: string, dateStr: string) => {
    const weekAnchor = dayjs(dateStr).startOf("isoWeek").format("YYYY-MM-DD");
    console.log(
      "[Rosters] drop template",
      templateId,
      "onto date",
      dateStr,
      "anchor",
      weekAnchor,
    );
    prepareTemplateApply(templateId, weekAnchor, null);
  };

  // ── Publish ─────────────────────────────────────────────────────────────────
  const handlePublish = async () => {
    if (isScheduleDirty) {
      toast.warning(publishDirtyTooltip);
      return;
    }

    const ids = scheduleShifts
      .filter((s) => {
        const d = dayjs(s.date);
        return (
          isScheduleDateEditable(s.date) &&
          s.status === "draft" &&
          d >= weekStart &&
          d <= weekStart.add(6, "day")
        );
      })
      .map((s) => s.id);
    if (ids.length === 0) {
      toast.warning(
        isReadonlyWeek
          ? readonlyRosterMessage
          : isZh
            ? "当前周没有可发布的草稿排班"
            : "No draft shifts to publish for this week",
      );
      return;
    }

    try {
      await saveScheduleDraft(
        scheduleShifts,
        selectedStoreId,
        weekDates
          .map((d) => d.format("YYYY-MM-DD"))
          .filter((dateStr) => isScheduleDateEditable(dateStr)),
      );
      const publishResult = await publishSchedule(selectedStoreId);
      toast.success(
        locale === "zh"
          ? `已发布 ${ids.length} 个班次`
          : `Published ${ids.length} shifts`,
      );
      const conflicts = publishResult.conflicts || [];
      const orphaned = publishResult.orphanedSubstitutions || [];
      if (conflicts.length > 0 || orphaned.length > 0) {
        Modal.info({
          title: locale === "zh" ? "发布完成（替班提示）" : "Published (substitution notes)",
          width: 560,
          content: (
            <div className="flex flex-col gap-3 text-sm">
              {conflicts.length > 0 ? (
                <div>
                  <div className="font-semibold mb-1">
                    {locale === "zh" ? "冲突" : "Conflicts"}
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {conflicts.map((item, index) => (
                      <li key={`c-${item.substitutionId || index}`}>
                        {item.message || item.conflictCode || "-"}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {orphaned.length > 0 ? (
                <div>
                  <div className="font-semibold mb-1">
                    {locale === "zh" ? "已作废替班" : "Cancelled substitutions"}
                  </div>
                  <ul className="list-disc pl-5 space-y-1">
                    {orphaned.map((item, index) => (
                      <li key={`o-${item.substitutionId || index}`}>
                        {locale === "zh"
                          ? `请假明细 #${item.leaveItemId ?? "-"}`
                          : `Leave item #${item.leaveItemId ?? "-"}`}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ),
        });
      }
      console.log("[Rosters] published", ids.length, "shifts");
      syncScheduleBaseline();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Publish failed");
    }
  };

  const handleSaveRoster = async () => {
    if (isReadonlyWeek) {
      toast.warning(readonlyRosterMessage);
      return;
    }

    try {
      await saveScheduleDraft(
        scheduleShifts,
        selectedStoreId,
        weekDates
          .map((d) => d.format("YYYY-MM-DD"))
          .filter((dateStr) => isScheduleDateEditable(dateStr)),
      );
      onSave();
      syncScheduleBaseline();
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
          {/* Grid view: area vs employee */}
          <div
            className="flex items-center rounded-lg p-0.5 ml-1"
            style={{
              background: "var(--muted)",
              border: "1px solid var(--border)",
            }}
          >
            <button
              type="button"
              onClick={() => setGridViewMode("area")}
              className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all"
              style={{
                background:
                  gridViewMode === "area" ? "var(--card)" : "transparent",
                color:
                  gridViewMode === "area"
                    ? "var(--primary)"
                    : "var(--muted-foreground)",
                boxShadow:
                  gridViewMode === "area"
                    ? "0 1px 2px rgba(0,0,0,0.06)"
                    : "none",
              }}
            >
              <LayoutGrid size={12} />
              {isZh ? "区域" : "Area"}
            </button>
            <button
              type="button"
              onClick={() => setGridViewMode("employee")}
              className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all"
              style={{
                background:
                  gridViewMode === "employee" ? "var(--card)" : "transparent",
                color:
                  gridViewMode === "employee"
                    ? "var(--primary)"
                    : "var(--muted-foreground)",
                boxShadow:
                  gridViewMode === "employee"
                    ? "0 1px 2px rgba(0,0,0,0.06)"
                    : "none",
              }}
            >
              <Users size={12} />
              {isZh ? "员工" : "Employee"}
            </button>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {publishableDraftCount > 0 && (
            <Tooltip
              title={isScheduleDirty ? publishDirtyTooltip : undefined}
            >
              <span className="inline-flex">
                <Button
                  onClick={handlePublish}
                  disabled={isReadonlyWeek || isScheduleDirty}
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
              </span>
            </Tooltip>
          )}
          <Button
            type="primary"
            icon={<Save size={12} style={{ display: "inline" }} />}
            onClick={handleSaveRoster}
            disabled={isReadonlyWeek}
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
                    disabled={isReadonlyWeek}
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
                    {gridViewMode === "employee"
                      ? isZh
                        ? "拖拽到排班表格添加员工"
                        : "Drag to roster grid to add employees"
                      : isZh
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
                    {(gridViewMode === "employee"
                      ? sidebarEmployees
                      : filteredEmployees
                    ).length}
                  </span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto px-3 py-2">
                {(gridViewMode === "employee"
                  ? sidebarEmployees
                  : filteredEmployees
                ).map((emp) => {
                  const hrs = parseFloat(weekHoursForEmp(emp.id));
                  const shortDays = ["M", "T", "W", "T", "F", "S", "S"];
                  const sidebarLeaveWarn = getSidebarDateLeaveWarning(emp.id);
                  return (
                    <Tooltip
                      key={emp.id}
                      title={sidebarLeaveWarn || undefined}
                    >
                    <div
                      draggable={!isReadonlyWeek}
                      onDragStart={(e) => {
                        if (isReadonlyWeek) {
                          e.preventDefault();
                          return;
                        }
                        e.dataTransfer.setData("employeeId", emp.id);
                        e.dataTransfer.setData("text/plain", emp.id);
                        e.dataTransfer.effectAllowed = "copy";
                        setDragEmpId(emp.id);
                        console.log("[Rosters] drag employee:", emp.id);
                      }}
                      onDragEnd={() => setDragEmpId(null)}
                      className="rounded-xl p-2.5 mb-2 select-none transition-all hover:shadow-custom"
                      style={{
                        background: "var(--muted)",
                        border: sidebarLeaveWarn
                          ? "1px solid var(--destructive)"
                          : "1px solid var(--border)",
                        cursor: isReadonlyWeek ? "default" : "grab",
                        opacity: isReadonlyWeek ? 0.76 : 1,
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
                    </Tooltip>
                  );
                })}
                {(gridViewMode === "employee"
                  ? sidebarEmployees
                  : filteredEmployees
                ).length === 0 && (
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
          <div
            style={{ minWidth: TOTAL_GRID_MIN_W, width: "100%" }}
            onDragOver={handleRosterMemberDragOver}
            onDrop={handleRosterMemberDrop}
          >
            {/* ── Sticky header row ───────────────────────────────────────── */}
            <div
              className="flex sticky top-0 z-20"
              onDragOver={handleRosterMemberDragOver}
              onDrop={handleRosterMemberDrop}
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
                  {gridViewMode === "area"
                    ? isZh
                      ? "区域"
                      : "Area"
                    : isZh
                      ? "员工"
                      : "Employee"}
                </span>
              </div>

              {/* Date columns */}
              {weekDates.map((d, i) => {
                const dateStr = d.format("YYYY-MM-DD");
                const isToday = dateStr === todayStr;
                const isClosedDay = isStoreClosedDate(d);
                const publicHolidayName =
                  publicHolidayNameByDate.get(dateStr) || "";
                const cnt = dateTotalShifts(dateStr);
                return (
                  <DateColHeader
                    key={i}
                    date={d}
                    dayLabel={dayLabels[i]}
                    isToday={isToday}
                    isClosedDay={isClosedDay}
                    isPublicHoliday={!!publicHolidayName}
                    publicHolidayName={publicHolidayName}
                    dateFormatCountry={dateFormatCountry}
                    onDropTemplate={handleDropTemplateToDate}
                    shiftCount={cnt}
                    readonly={!isScheduleDateEditable(d)}
                  />
                );
              })}
            </div>

            {/* ── Grid body: area or employee rows ─────────────────────────── */}
            {gridViewMode === "area" ? (
              displayAreas.length === 0 ? (
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

                    {weekDates.map((d, i) => {
                      const dateStr = d.format("YYYY-MM-DD");
                      const isToday = dateStr === todayStr;
                      const isClosedDay = isStoreClosedDate(d);
                      const isPublicHoliday =
                        publicHolidayNameByDate.has(dateStr);
                      const cellShifts = getShifts(area.id, dateStr);
                      const isReadonlyDate = !isScheduleDateEditable(d);

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
                          getAvailabilityWarning={
                            findPatternAvailabilityWarning
                          }
                          getApprovedLeaveHint={findApprovedLeaveHint}
                          isToday={isToday}
                          isClosedDay={isClosedDay}
                          isPublicHoliday={isPublicHoliday}
                          readonly={isReadonlyDate}
                        />
                      );
                    })}
                  </div>
                ))
              )
            ) : displayAreas.length === 0 ? (
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
            ) : gridEmployees.length === 0 &&
              !hasUnassignedShiftsInWeek &&
              sidebarEmployees.length === 0 &&
              filteredEmployees.length === 0 ? (
              <div
                className="flex items-center justify-center"
                style={{ minHeight: 220, color: "var(--muted-foreground)" }}
              >
                <div className="flex flex-col items-center gap-2 text-sm">
                  <Users size={28} style={{ opacity: 0.35 }} />
                  <span>
                    {isZh ? "暂无匹配员工" : "No matching employees"}
                  </span>
                </div>
              </div>
            ) : (
              <>
                {gridEmployees.map((emp) => {
                  const hrs = parseFloat(weekHoursForEmp(emp.id));
                  const sidebarLeaveWarn = getSidebarDateLeaveWarning(emp.id);
                  return (
                    <div
                      key={emp.id}
                      className="flex"
                      style={{ borderBottom: "1px solid var(--border)" }}
                    >
                      <div
                        className="sticky left-0 flex-shrink-0 flex items-start justify-between px-3 py-3 group"
                        onDragOver={handleRosterMemberDragOver}
                        onDrop={handleRosterMemberDrop}
                        style={{
                          width: LEFT_COL_W,
                          borderRight: "1px solid var(--border)",
                          minHeight: 88,
                          background: sidebarLeaveWarn
                            ? "rgba(254, 226, 226, 0.35)"
                            : "var(--muted)",
                          zIndex: 10,
                        }}
                      >
                        <div className="flex items-center gap-1.5 min-w-0 flex-1">
                          <Avatar
                            size={24}
                            src={getEmployeeAvatarUrl(emp) || undefined}
                            style={{
                              background:
                                emp.employeeColor || "var(--primary)",
                              flexShrink: 0,
                              fontSize: 10,
                            }}
                          >
                            {getEmployeeInitials(emp.firstName, emp.lastName)}
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div
                              className="text-xs font-semibold truncate"
                              style={{ color: "var(--foreground)" }}
                            >
                              {emp.firstName} {emp.lastName}
                            </div>
                            <div
                              className="truncate"
                              style={{
                                fontSize: 9,
                                color: "var(--muted-foreground)",
                              }}
                            >
                              {emp.role}
                            </div>
                            <div
                              className="text-xs font-semibold mt-0.5"
                              style={{
                                fontSize: 9,
                                color: hrs > 0 ? "var(--primary)" : "var(--muted-foreground)",
                              }}
                            >
                              {hrs > 0 ? `${hrs}h` : "–"}
                            </div>
                          </div>
                        </div>
                        {!isReadonlyWeek && (
                          <Popconfirm
                            title={
                              isZh
                                ? "从排班表中移除此员工？"
                                : "Remove this employee from roster?"
                            }
                            onConfirm={() =>
                              handleRemoveEmployeeFromRoster(emp.id)
                            }
                            okText={isZh ? "是" : "Yes"}
                            cancelText={isZh ? "否" : "No"}
                          >
                            <button
                              type="button"
                              className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                              style={{
                                color: "var(--destructive)",
                                flexShrink: 0,
                              }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </Popconfirm>
                        )}
                      </div>

                      {weekDates.map((d, i) => {
                        const dateStr = d.format("YYYY-MM-DD");
                        const isToday = dateStr === todayStr;
                        const isClosedDay = isStoreClosedDate(d);
                        const isPublicHoliday =
                          publicHolidayNameByDate.has(dateStr);
                        const cellShifts = filterShiftsForEmployeeOnDate(
                          scheduleShifts,
                          emp.id,
                          dateStr,
                          selectedStoreId,
                        );
                        const isReadonlyDate = !isScheduleDateEditable(d);

                        return (
                          <EmployeeDateCell
                            key={i}
                            date={d}
                            employeeId={emp.id}
                            rowKind="employee"
                            shifts={cellShifts}
                            areaNameMap={areaNameMap}
                            employees={allEmpList}
                            defaultAreaId={defaultScheduleAreaId}
                            onAddShift={openAddShiftForEmployee}
                            onEditShift={openEditShift}
                            onDeleteShift={handleDeleteShiftForEmployeeRow}
                            onRemoveEmployeeFromShift={
                              handleRemoveEmployeeFromShift
                            }
                            onDropEmployee={handleDropEmployeeByDate}
                            onDropEmployeeToShift={handleDropEmployeeToShift}
                            onDropTemplate={handleDropTemplateToDate}
                            onAddEmployeeToRoster={handleAddEmployeeToRoster}
                            sidebarDragEmpId={dragEmpId}
                            getAvailabilityWarning={
                              findPatternAvailabilityWarning
                            }
                            getApprovedLeaveHint={findApprovedLeaveHint}
                            isToday={isToday}
                            isClosedDay={isClosedDay}
                            isPublicHoliday={isPublicHoliday}
                            readonly={isReadonlyDate}
                          />
                        );
                      })}
                    </div>
                  );
                })}
                {hasUnassignedShiftsInWeek && (
                  <div
                    key={ROSTER_UNASSIGNED_ROW_ID}
                    className="flex"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <div
                      className="sticky left-0 flex-shrink-0 flex items-center px-3 py-3"
                      style={{
                        width: LEFT_COL_W,
                        borderRight: "1px solid var(--border)",
                        minHeight: 88,
                        background: "var(--muted)",
                        zIndex: 10,
                      }}
                    >
                      <span
                        className="text-sm font-medium italic"
                        style={{ color: "var(--muted-foreground)" }}
                      >
                        {isZh ? "未分配" : "Unassigned"}
                      </span>
                    </div>
                    {weekDates.map((d, i) => {
                      const dateStr = d.format("YYYY-MM-DD");
                      const isToday = dateStr === todayStr;
                      const isClosedDay = isStoreClosedDate(d);
                      const isPublicHoliday =
                        publicHolidayNameByDate.has(dateStr);
                      const cellShifts = filterUnassignedShiftsOnDate(
                        scheduleShifts,
                        dateStr,
                        selectedStoreId,
                      );
                      const isReadonlyDate = !isScheduleDateEditable(d);

                      return (
                        <EmployeeDateCell
                          key={i}
                          date={d}
                          rowKind="unassigned"
                          shifts={cellShifts}
                          areaNameMap={areaNameMap}
                          employees={allEmpList}
                          defaultAreaId={defaultScheduleAreaId}
                          onAddShift={openAddShiftForEmployee}
                          onEditShift={openEditShift}
                          onDeleteShift={handleDeleteShiftForEmployeeRow}
                          onRemoveEmployeeFromShift={
                            handleRemoveEmployeeFromShift
                          }
                          onDropEmployee={handleDropEmployeeByDate}
                          onDropEmployeeToShift={handleDropEmployeeToShift}
                          onDropTemplate={handleDropTemplateToDate}
                          onAddEmployeeToRoster={handleAddEmployeeToRoster}
                          sidebarDragEmpId={dragEmpId}
                          getAvailabilityWarning={
                            findPatternAvailabilityWarning
                          }
                          getApprovedLeaveHint={findApprovedLeaveHint}
                          isToday={isToday}
                          isClosedDay={isClosedDay}
                          isPublicHoliday={isPublicHoliday}
                          readonly={isReadonlyDate}
                        />
                      );
                    })}
                  </div>
                )}
                <div
                  key="__roster_add_employee__"
                  className="flex"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <div
                    className="sticky left-0 flex-shrink-0 flex items-center px-3 py-2"
                    onDragOver={handleRosterMemberDragOver}
                    onDrop={handleRosterMemberDrop}
                    style={{
                      width: LEFT_COL_W,
                      borderRight: "1px solid var(--border)",
                      minHeight: 44,
                      background: "var(--muted)",
                      zIndex: 10,
                    }}
                  >
                    <span
                      className="text-xs italic"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {isZh
                        ? "从左侧拖入员工"
                        : "Drag employees from the left"}
                    </span>
                  </div>
                  {weekDates.map((d, i) => {
                    const dateStr = d.format("YYYY-MM-DD");
                    const isToday = dateStr === todayStr;
                    const isClosedDay = isStoreClosedDate(d);
                    const isPublicHoliday =
                      publicHolidayNameByDate.has(dateStr);
                    const isReadonlyDate = !isScheduleDateEditable(d);

                    return (
                      <EmployeeDateCell
                        key={i}
                        date={d}
                        rowKind="add-employee"
                        shifts={[]}
                        areaNameMap={areaNameMap}
                        employees={allEmpList}
                        defaultAreaId={defaultScheduleAreaId}
                        onAddEmployeeToRoster={handleAddEmployeeToRoster}
                        sidebarDragEmpId={dragEmpId}
                        onDropTemplate={handleDropTemplateToDate}
                        isToday={isToday}
                        isClosedDay={isClosedDay}
                        isPublicHoliday={isPublicHoliday}
                        readonly={isReadonlyDate}
                      />
                    );
                  })}
                </div>
              </>
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
        onCancel={closeShiftModal}
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

          {shiftModalMode === "employee" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div
                    className="text-sm mb-1.5"
                    style={{ color: "var(--foreground)" }}
                  >
                    {isZh ? "日期" : "Date"}
                  </div>
                  <div
                    className="rounded-md px-3 py-2 text-sm"
                    style={{
                      background: "var(--muted)",
                      color: "var(--foreground)",
                    }}
                  >
                    {shiftForm.date
                      ? formatCountryDate(
                          dayjs(shiftForm.date),
                          dateFormatCountry,
                        )
                      : "—"}
                  </div>
                </div>
                <div>
                  <div
                    className="text-sm mb-1.5"
                    style={{ color: "var(--foreground)" }}
                  >
                    {isZh ? "员工" : "Employee"}
                  </div>
                  <div
                    className="rounded-md px-3 py-2 text-sm truncate"
                    style={{
                      background: "var(--muted)",
                      color: "var(--foreground)",
                    }}
                  >
                    {empNameMap[lockedEmployeeId] || lockedEmployeeId || "—"}
                  </div>
                </div>
              </div>

              <div>
                <div
                  className="text-sm mb-1.5"
                  style={{ color: "var(--foreground)" }}
                >
                  {isZh ? "区域" : "Area"}
                </div>
                <Select
                  value={shiftForm.areaId || undefined}
                  onChange={(value) =>
                    setShiftForm((form) => ({
                      ...form,
                      areaId: value,
                      storeId:
                        areas.find((area) => area.id === value)?.storeId ||
                        form.storeId,
                    }))
                  }
                  placeholder={isZh ? "请选择区域" : "Select area"}
                  style={{ width: "100%" }}
                  options={displayAreas.map((area) => ({
                    value: area.id,
                    label: area.name,
                  }))}
                />
              </div>
            </>
          )}

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
          {shiftModalMode !== "employee" && (
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
              {activeEmployees
                .filter((e) => !conflictEmployeeIdSet.has(e.id))
                .map((e) => (
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
          )}
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
