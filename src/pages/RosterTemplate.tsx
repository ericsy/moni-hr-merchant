import {
  Avatar,
  Button,
  Input,
  InputNumber,
  Modal,
  Popconfirm,
  Select,
  Tag,
  TimePicker,
  Tooltip,
} from "antd";
import dayjs from "dayjs";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Clock,
  Edit2,
  GripVertical,
  LayoutGrid,
  Minus,
  Plus,
  Save,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent } from "react";
import { toast } from "sonner";
import {
  ColorSwatchPicker,
  DEFAULT_COLOR_KEY,
  getSoftColorStyle,
} from "../components/ColorSwatchPicker";
import {
  useData,
  type Area,
  type Employee,
  type RosterTemplate,
  type RosterTemplateCell,
  type Store,
} from "../context/DataContext";
import { useLocale } from "../context/LocaleContext";
import { useStore } from "../context/StoreContext";
import { getTemplateShiftAvailabilityWarning } from "../lib/employeeAvailability";
import {
  getEmployeeAvatarUrl,
  getEmployeeInitials,
} from "../lib/employeeAvatar";
import { calcShiftHours, indexedShiftsOverlap } from "../lib/shift";
import {
  filterCellsForEmployeeOnDay,
  filterUnassignedCellsOnDay,
  getTemplateMemberEmployeeIds,
  makeTemplateCellSlotKey,
  mergeUniqueEmployeeIds,
  readStoredGridViewMode,
  ROSTER_UNASSIGNED_ROW_ID,
  type RosterGridViewMode,
  type ShiftModalMode,
  storeGridViewMode,
} from "../lib/rosterGridIndex";
import { isStoreClosedOnDayIndex } from "../lib/storeHours";

const TEMPLATE_GRID_VIEW_STORAGE_KEY = "moni-roster-template-grid-view";
import { EmployeeModal } from "./Employees";

const { Option } = Select;

const TEMPLATE_AREA_COLUMN_WIDTH = 180;
const TEMPLATE_DAY_COLUMN_WIDTH = 180;
const TEMPLATE_ACTION_COLUMN_WIDTH = 60;
const SCROLL_CLICK_DELAY_MS = 260;

// ─── Types ────────────────────────────────────────────────────────────────────

type RosterShiftCell = RosterTemplateCell;

// ─── Helpers ──────────────────────────────────────────────────────────────────

const calcHours = (start: string, end: string) =>
  Number.parseFloat(calcShiftHours(start, end, 0));

const WEEKDAY_LABELS_ZH = [
  "周一",
  "周二",
  "周三",
  "周四",
  "周五",
  "周六",
  "周日",
];
const WEEKDAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const formatTime12 = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  const ampm = h >= 12 ? "pm" : "am";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")}${ampm}`;
};

const getWeekdayLabel = (dayIndex: number, locale: "zh" | "en") => {
  const labels = locale === "zh" ? WEEKDAY_LABELS_ZH : WEEKDAY_LABELS_EN;
  return labels[((dayIndex % 7) + 7) % 7];
};

const getDetailedDayLabel = (dayIndex: number, locale: "zh" | "en") => {
  const weekNumber = Math.floor(dayIndex / 7) + 1;
  const weekdayLabel = getWeekdayLabel(dayIndex, locale);
  return locale === "zh"
    ? `第${weekNumber}周 ${weekdayLabel}`
    : `Week ${weekNumber} ${weekdayLabel}`;
};

const getCycleWeek = (dayIndex: number) => Math.floor(dayIndex / 7) + 1;

const formatDurationLabel = (days: number, locale: "zh" | "en") => {
  if (days % 7 === 0) {
    const weeks = days / 7;
    return locale === "zh"
      ? `${weeks}周`
      : `${weeks} ${weeks === 1 ? "week" : "weeks"}`;
  }
  return locale === "zh" ? `${days}天` : `${days} days`;
};

const getShiftColor = (key: string) => getSoftColorStyle(key);

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

// ─── Sub-component: Employee Panel Card ───────────────────────────────────────

interface EmployeeCardProps {
  employeeId?: string;
  firstName?: string;
  lastName?: string;
  avatarUrl?: string;
  color?: string;
  hoursPerDay?: number[];
  onDragStart?: (empId: string) => void;
  onDragEnd?: () => void;
}

function EmployeeCard({
  employeeId = "",
  firstName = "",
  lastName = "",
  avatarUrl = "",
  color = "var(--primary)",
  hoursPerDay = [],
  onDragStart = () => {},
  onDragEnd = () => {},
}: EmployeeCardProps) {
  const total = hoursPerDay.reduce((s, h) => s + h, 0);

  return (
    <div
      data-cmp="EmployeeCard"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("employeeId", employeeId);
        e.dataTransfer.setData("text/plain", employeeId);
        e.dataTransfer.effectAllowed = "copy";
        onDragStart(employeeId);
      }}
      onDragEnd={onDragEnd}
      className="rounded-lg p-3 mb-2 cursor-grab active:cursor-grabbing"
      style={{ background: "var(--card)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Avatar
            size={28}
            src={avatarUrl || undefined}
            style={{ background: color, flexShrink: 0, fontSize: 11 }}
          >
            {getEmployeeInitials(firstName, lastName)}
          </Avatar>
          <span
            className="text-sm font-medium"
            style={{ color: "var(--foreground)" }}
          >
            {firstName} {lastName}
          </span>
        </div>
        <span
          className="text-xs font-semibold"
          style={{ color: "var(--primary)" }}
        >
          {total}h
        </span>
      </div>
    </div>
  );
}

// ─── Sub-component: Shift Cell (multi-employee) ───────────────────────────────

interface ShiftCellProps {
  cell?: RosterShiftCell;
  employees?: {
    id: string;
    name: string;
    color: string;
    avatarUrl?: string;
    availabilityWarning?: string | null;
  }[];
  onEdit?: () => void;
  onDelete?: () => void;
  onDrop?: (empId: string) => void;
  onRemoveEmployee?: (empId: string) => void;
  onAddEmployeeClick?: () => void;
  viewMode?: RosterGridViewMode;
  areaName?: string;
}

function ShiftCell({
  cell,
  employees = [],
  onEdit = () => {},
  onDelete = () => {},
  onDrop = () => {},
  onRemoveEmployee = () => {},
  onAddEmployeeClick = () => {},
  viewMode = "area",
  areaName = "",
}: ShiftCellProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const { locale } = useLocale();

  if (!cell) return null;

  const isEmployeeView = viewMode === "employee";
  const sc = getShiftColor(cell.color);
  const hrs = calcHours(cell.startTime, cell.endTime);

  return (
    <div
      data-cmp="ShiftCell"
      className="rounded-lg mb-1 relative group"
      style={{
        background: isDragOver ? "var(--secondary)" : sc.bg,
        border: `1.5px solid ${isDragOver ? "var(--primary)" : sc.border}`,
        padding: "4px 6px",
        transition: "all 0.15s",
      }}
      onDragOver={(e) => {
        if (isEmployeeView) return;
        e.preventDefault();
        setIsDragOver(true);
      }}
      onDragLeave={() => {
        if (isEmployeeView) return;
        setIsDragOver(false);
      }}
      onDrop={(e) => {
        if (isEmployeeView) return;
        e.preventDefault();
        setIsDragOver(false);
        const id = e.dataTransfer.getData("employeeId");
        if (id) onDrop(id);
      }}
    >
      {/* Time row (moved up) */}
      <div className="flex items-center gap-1 mb-0.5">
        <Clock size={10} style={{ color: "var(--foreground)" }} />
        <span style={{ fontSize: 11, color: "var(--foreground)" }}>
          {formatTime12(cell.startTime)} – {formatTime12(cell.endTime)}
        </span>
        <span
          className="rounded-full px-1 ml-auto font-semibold"
          style={{
            fontSize: 10,
            background: sc.border,
            color: "var(--primary-foreground)",
          }}
        >
          {hrs}h
        </span>
      </div>

      {/* Shift name + action buttons (moved down) */}
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-1">
        <div className="min-w-0 w-full overflow-hidden">
          <span
            className="text-xs font-semibold truncate"
            style={{ color: "var(--foreground)", fontSize: 14 }}
            title={cell.label || ""}
          >
            {cell.label || formatTime12(cell.startTime)}
          </span>
        </div>
        <div className="flex items-center gap-0.5 justify-self-end opacity-0 transition-opacity flex-shrink-0 group-hover:opacity-100">
          <button
            onClick={onEdit}
            className="rounded p-0.5 hover:opacity-70"
            style={{ color: "var(--muted-foreground)" }}
          >
            <Edit2 size={10} />
          </button>
          <button
            onClick={onDelete}
            className="rounded p-0.5 hover:opacity-70"
            style={{ color: "var(--destructive)" }}
          >
            <Trash2 size={10} />
          </button>
        </div>
      </div>

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
      {!isEmployeeView && (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onAddEmployeeClick();
        }}
        className="w-full flex items-center justify-center rounded-md mt-0.5 transition-all hover:opacity-80"
        style={{
          border: `1px dashed ${isDragOver ? "var(--primary)" : sc.border}`,
          padding: "2px 4px",
          background: isDragOver ? "var(--secondary)" : "transparent",
          cursor: "pointer",
          position: "relative",
          zIndex: 1,
        }}
      >
        <span
          style={{
            color: isDragOver ? "var(--primary)" : sc.text,
            fontSize: 11,
          }}
        >
          {employees.length > 0 ? `+ 添加员工` : `选择员工`}
        </span>
      </button>
      )}

      {/* Employees (dynamic) */}
      {!isEmployeeView && employees.length > 0 && (
        <div className="mt-1 flex w-full flex-wrap items-center gap-0.5 min-w-0">
          {employees.map((emp) => (
            <Tooltip key={emp.id} title={emp.availabilityWarning || undefined}>
              <div
                className="flex max-w-full min-w-0 items-center gap-0.5 rounded-md px-1 py-0.5"
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
                      : "var(--foreground)",
                    maxWidth: 80,
                    fontSize: 14,
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
                  style={{
                    color: "var(--muted-foreground)",
                    flexShrink: 0,
                  }}
                >
                  <X size={9} />
                </button>
              </div>
            </Tooltip>
          ))}
        </div>
      )}
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

interface TemplateEmployeeDayCellProps {
  dayIndex: number;
  employeeId?: string;
  rowKind?: "employee" | "unassigned" | "add-employee";
  cells?: RosterShiftCell[];
  areaNameMap?: Record<string, string>;
  activeEmployees?: Employee[];
  empNameMap?: Record<string, string>;
  empColorMap?: Record<string, string>;
  empAvatarMap?: Record<string, string>;
  defaultAreaId?: string;
  activeTemplateStore?: Store;
  locale?: string;
  onAddCell?: (
    areaId: string,
    dayIndex: number,
    employeeIds: string[],
  ) => void;
  onEditCell?: (cell: RosterShiftCell, rowEmployeeId?: string) => void;
  onDeleteCell?: (cellId: string, rowEmployeeId?: string) => void;
  onDropEmployee?: (cellId: string, empId: string) => void;
  onRemoveEmployee?: (cellId: string, empId: string) => void;
  onAddEmployeeToTemplate?: (empId: string) => void;
  sidebarDragEmpId?: string | null;
  getTemplateShiftAvailabilityWarning?: typeof getTemplateShiftAvailabilityWarning;
}

function TemplateEmployeeDayCell({
  dayIndex,
  employeeId = "",
  rowKind = "employee",
  cells = [],
  areaNameMap = {},
  activeEmployees = [],
  empNameMap = {},
  empColorMap = {},
  empAvatarMap = {},
  defaultAreaId = "",
  activeTemplateStore,
  locale = "zh",
  onAddCell = () => {},
  onEditCell = () => {},
  onDeleteCell = () => {},
  onDropEmployee = () => {},
  onRemoveEmployee = () => {},
  onAddEmployeeToTemplate = () => {},
  sidebarDragEmpId = null,
}: TemplateEmployeeDayCellProps) {
  const isStoreClosed = isStoreClosedOnDayIndex(activeTemplateStore, dayIndex);
  const isAddEmployeeRow = rowKind === "add-employee";

  return (
    <div
      data-cmp="TemplateEmployeeDayCell"
      className="p-1.5"
      style={{
        flex: `1 1 ${TEMPLATE_DAY_COLUMN_WIDTH}px`,
        minWidth: TEMPLATE_DAY_COLUMN_WIDTH,
        borderRight: "1px solid var(--border)",
        minHeight: isAddEmployeeRow ? 44 : 88,
        background: isStoreClosed
          ? "var(--workday-weekend-header)"
          : isAddEmployeeRow
            ? "var(--muted)"
            : "transparent",
      }}
      onDragOver={(e) => {
        if (!sidebarDragEmpId) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }}
      onDrop={(e) => {
        if (!sidebarDragEmpId) return;
        e.preventDefault();
        e.stopPropagation();
        const empId = readSidebarEmployeeId(e, sidebarDragEmpId);
        if (empId) onAddEmployeeToTemplate(empId);
      }}
    >
      {cells.map((cell) => {
        const cellEmployees = cell.employeeIds
          .map((eid) => {
            const emp = activeEmployees.find((employee) => employee.id === eid);
            if (!emp) return null;
            return {
              id: eid,
              name: empNameMap[eid],
              color: empColorMap[eid] || "var(--primary)",
              avatarUrl: empAvatarMap[eid] || "",
              availabilityWarning: getTemplateShiftAvailabilityWarning(
                emp,
                {
                  dayIndex: cell.dayIndex,
                  startTime: cell.startTime,
                  endTime: cell.endTime,
                },
                locale as "zh" | "en",
              ),
            };
          })
          .filter(Boolean) as {
          id: string;
          name: string;
          color: string;
          avatarUrl: string;
          availabilityWarning: string | null;
        }[];
        return (
          <ShiftCell
            key={cell.id}
            cell={cell}
            employees={cellEmployees}
            onEdit={() =>
              onEditCell(cell, rowKind === "employee" ? employeeId : undefined)
            }
            onDelete={() =>
              onDeleteCell(
                cell.id,
                rowKind === "employee" ? employeeId : undefined,
              )
            }
            onDrop={(empId) => onDropEmployee(cell.id, empId)}
            onRemoveEmployee={(empId) => onRemoveEmployee(cell.id, empId)}
            onAddEmployeeClick={() =>
              onEditCell(cell, rowKind === "employee" ? employeeId : undefined)
            }
            viewMode="employee"
            areaName={areaNameMap[cell.areaId] || cell.areaId}
          />
        );
      })}

      {defaultAreaId && !isAddEmployeeRow && (
        <button
          onClick={() =>
            onAddCell(
              defaultAreaId,
              dayIndex,
              rowKind === "unassigned" ? [] : employeeId ? [employeeId] : [],
            )
          }
          className="w-full rounded-lg flex items-center justify-center transition-all hover:opacity-80"
          style={{
            height: 22,
            border: "1.5px dashed var(--border)",
            color: "var(--muted-foreground)",
            background: "transparent",
            fontSize: 10,
          }}
        >
          <Plus size={10} />
        </button>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface RosterTemplatePageProps {
  onSave?: () => void;
}

export default function RosterTemplatePage({
  onSave = () => {},
}: RosterTemplatePageProps) {
  const {
    employees,
    saveEmployee,
    stores,
    areas,
    workAreas,
    scheduleShifts,
    rosterTemplates: allTemplates,
    setRosterTemplates: setTemplates,
    saveRosterTemplate,
    deleteRosterTemplate,
  } = useData();
  const { locale, t } = useLocale();
  const { selectedStoreId } = useStore();

  // ── State ──────────────────────────────────────────────────────────────────
  // templates & setTemplates come from DataContext (rosterTemplates / setRosterTemplates)
  const [activeTemplateId, setActiveTemplateId] = useState<string>(
    allTemplates[0]?.id || "",
  );
  const [searchText, setSearchText] = useState("");
  const [gridViewMode, setGridViewMode] = useState<RosterGridViewMode>(() =>
    readStoredGridViewMode(TEMPLATE_GRID_VIEW_STORAGE_KEY),
  );
  const [dragEmpId, setDragEmpId] = useState<string | null>(null);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);

  // Modals
  const [addAreaOpen, setAddAreaOpen] = useState(false);
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [cellModalOpen, setCellModalOpen] = useState(false);
  const [cellModalMode, setCellModalMode] = useState<ShiftModalMode>("area");
  const [lockedEmployeeId, setLockedEmployeeId] = useState("");
  const [editingCell, setEditingCell] = useState<RosterShiftCell | null>(null);
  const [editingAreaId, setEditingAreaId] = useState<string>("");
  const [editingDayIndex, setEditingDayIndex] = useState<number>(0);
  const [cellForm, setCellForm] = useState({
    presetKey: "",
    shiftId: "",
    startTime: "09:00",
    endTime: "17:00",
    label: "",
    color: DEFAULT_COLOR_KEY,
    employeeIds: [] as string[],
  });

  // Duration selector
  const [customDaysInput, setCustomDaysInput] = useState<number>(14);
  const [hasHorizontalOverflow, setHasHorizontalOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Template name edit
  const [nameEditing, setNameEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const nextCreatedCellIdRef = useRef(0);
  const nextCreatedTemplateIdRef = useRef(0);
  const gridScrollRef = useRef<HTMLDivElement | null>(null);
  const gridContentRef = useRef<HTMLDivElement | null>(null);
  const scrollClickTimerRef = useRef<number | null>(null);
  const [gridOverlayHeight, setGridOverlayHeight] = useState(0);

  const visibleTemplates = allTemplates.filter(
    (template) => !selectedStoreId || template.storeId === selectedStoreId,
  );
  const resolvedActiveTemplateId = visibleTemplates.some(
    (template) => template.id === activeTemplateId,
  )
    ? activeTemplateId
    : visibleTemplates[0]?.id || "";
  const activeTemplate =
    visibleTemplates.find(
      (template) => template.id === resolvedActiveTemplateId,
    ) || null;
  const activeTemplateStoreId = activeTemplate?.storeId || selectedStoreId;
  const activeTemplateStore = stores.find(
    (store) => store.id === activeTemplateStoreId,
  );
  const activeTemplateTotalDays = activeTemplate?.totalDays || 7;
  const activeTemplateVisibleCells = (activeTemplate?.cells || []).filter(
    (cell) => cell.dayIndex >= 0 && cell.dayIndex < activeTemplateTotalDays,
  );

  // ── Computed ──────────────────────────────────────────────────────────────

  const templateAreaMap: Record<string, Area> = {};
  areas.forEach((area) => {
    templateAreaMap[area.id] = area;
  });

  const templateAreas = (activeTemplate?.areaIds || [])
    .map((areaId) => templateAreaMap[areaId])
    .filter(Boolean) as Area[];

  const defaultTemplateAreaId = templateAreas[0]?.id || "";

  const templateAreaNameMap = useMemo(() => {
    const map: Record<string, string> = {};
    templateAreas.forEach((area) => {
      map[area.id] = area.name;
    });
    return map;
  }, [templateAreas]);

  useEffect(() => {
    storeGridViewMode(TEMPLATE_GRID_VIEW_STORAGE_KEY, gridViewMode);
  }, [gridViewMode]);

  useEffect(() => {
    setCustomDaysInput(activeTemplateTotalDays);
  }, [activeTemplateTotalDays]);

  const hasUnassignedCellsInTemplate = useMemo(
    () =>
      activeTemplateVisibleCells.some(
        (cell) => !(cell.employeeIds || []).length,
      ),
    [activeTemplateVisibleCells],
  );

  const selectableAreas = areas
    .filter((area) => {
      if ((area.areaType || "store") === "general") return true;
      if (activeTemplateStoreId) return area.storeId === activeTemplateStoreId;
      return !selectedStoreId || area.storeId === selectedStoreId;
    })
    .filter((area) => !(activeTemplate?.areaIds || []).includes(area.id))
    .sort((a, b) => a.order - b.order);

  const shiftPresetMap: Record<
    string,
    {
      key: string;
      shiftId?: string;
      shiftName: string;
      startTime: string;
      endTime: string;
      color: string;
      shiftType: "store" | "general";
    }
  > = {};

  scheduleShifts.forEach((shift) => {
    if (!shift.isGlobalPreset) return;

    const shiftType = shift.shiftType || "store";
    const belongsToTemplate =
      shiftType === "general" || shift.storeId === activeTemplateStoreId;
    if (!belongsToTemplate) return;

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
        color: shift.color,
        shiftType,
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
  const currentShiftName = (cellForm.label || "").trim();

  if (currentShiftName) {
    const currentKey = makeShiftPresetKey({
      shiftType: "store",
      storeId: activeTemplateStoreId,
      shiftName: currentShiftName,
      startTime: cellForm.startTime,
      endTime: cellForm.endTime,
      color: cellForm.color,
    });

    if (!modalShiftPresetOptions.some((option) => option.key === currentKey)) {
      modalShiftPresetOptions.unshift({
        key: currentKey,
        shiftId: cellForm.shiftId,
        shiftName: currentShiftName,
        startTime: cellForm.startTime,
        endTime: cellForm.endTime,
        color: cellForm.color,
        shiftType: "store",
      });
    }
  }

  const activeEmployees = employees.filter((e) => e.status === "active");
  const filteredEmployees = activeEmployees.filter(
    (e) =>
      !searchText ||
      `${e.firstName} ${e.lastName}`
        .toLowerCase()
        .includes(searchText.toLowerCase()),
  );

  const templateMemberEmployeeIds = useMemo(
    () => new Set(getTemplateMemberEmployeeIds(activeTemplate)),
    [activeTemplate],
  );

  const templateMemberEmployeeOrder = useMemo(
    () => getTemplateMemberEmployeeIds(activeTemplate),
    [activeTemplate],
  );

  const sidebarEmployees = useMemo(() => {
    if (gridViewMode !== "employee") return filteredEmployees;
    return filteredEmployees.filter(
      (employee) => !templateMemberEmployeeIds.has(employee.id),
    );
  }, [filteredEmployees, gridViewMode, templateMemberEmployeeIds]);

  const gridEmployees = useMemo(() => {
    if (gridViewMode !== "employee") return filteredEmployees;
    const empById = new Map(filteredEmployees.map((employee) => [employee.id, employee]));
    return templateMemberEmployeeOrder
      .map((id) => empById.get(id))
      .filter(Boolean) as typeof filteredEmployees;
  }, [filteredEmployees, gridViewMode, templateMemberEmployeeOrder]);

  // Hours per employee per day — iterate employeeIds array
  const empHoursMap: Record<string, number[]> = {};
  activeEmployees.forEach((e) => {
    empHoursMap[e.id] = Array.from({ length: activeTemplateTotalDays }).map(
      () => 0,
    );
  });
  activeTemplateVisibleCells.forEach((cell) => {
    const hrs = calcHours(cell.startTime, cell.endTime);
    cell.employeeIds.forEach((eid) => {
      if (empHoursMap[eid]) {
        empHoursMap[eid][cell.dayIndex] += hrs;
      }
    });
  });

  const totalDaysList = Array.from(
    { length: activeTemplateTotalDays },
    (_, i) => i + 1,
  );

  const updateHorizontalScrollState = () => {
    const scroller = gridScrollRef.current;
    if (!scroller) {
      setHasHorizontalOverflow(false);
      setCanScrollLeft(false);
      setCanScrollRight(false);
      return;
    }

    const maxScrollLeft = scroller.scrollWidth - scroller.clientWidth;
    const hasOverflow = maxScrollLeft > 1;
    setHasHorizontalOverflow(hasOverflow);
    setCanScrollLeft(hasOverflow && scroller.scrollLeft > 1);
    setCanScrollRight(hasOverflow && scroller.scrollLeft < maxScrollLeft - 1);
  };

  const getHorizontalScrollStep = (mode: "cell" | "page") => {
    const scroller = gridScrollRef.current;
    if (!scroller) return TEMPLATE_DAY_COLUMN_WIDTH;

    const pageStep = Math.max(
      TEMPLATE_DAY_COLUMN_WIDTH,
      scroller.clientWidth -
        TEMPLATE_AREA_COLUMN_WIDTH -
        TEMPLATE_ACTION_COLUMN_WIDTH,
    );
    return mode === "page" ? pageStep : TEMPLATE_DAY_COLUMN_WIDTH;
  };

  const scrollTemplateGrid = (direction: -1 | 1, mode: "cell" | "page") => {
    const scroller = gridScrollRef.current;
    if (!scroller) return;

    scroller.scrollBy({
      left: direction * getHorizontalScrollStep(mode),
      behavior: "smooth",
    });
  };

  const handleHorizontalScrollButtonClick = (
    event: MouseEvent<HTMLButtonElement>,
    direction: -1 | 1,
  ) => {
    if (event.detail > 1) return;

    if (scrollClickTimerRef.current !== null) {
      window.clearTimeout(scrollClickTimerRef.current);
    }

    scrollClickTimerRef.current = window.setTimeout(() => {
      scrollTemplateGrid(direction, "cell");
      scrollClickTimerRef.current = null;
    }, SCROLL_CLICK_DELAY_MS);
  };

  const handleHorizontalScrollButtonDoubleClick = (direction: -1 | 1) => {
    if (scrollClickTimerRef.current !== null) {
      window.clearTimeout(scrollClickTimerRef.current);
      scrollClickTimerRef.current = null;
    }

    scrollTemplateGrid(direction, "page");
  };

  useEffect(() => {
    const scroller = gridScrollRef.current;
    if (!scroller) return;

    updateHorizontalScrollState();
    scroller.addEventListener("scroll", updateHorizontalScrollState, {
      passive: true,
    });
    window.addEventListener("resize", updateHorizontalScrollState);

    return () => {
      scroller.removeEventListener("scroll", updateHorizontalScrollState);
      window.removeEventListener("resize", updateHorizontalScrollState);
      if (scrollClickTimerRef.current !== null) {
        window.clearTimeout(scrollClickTimerRef.current);
        scrollClickTimerRef.current = null;
      }
    };
  }, [activeTemplateTotalDays, templateAreas.length]);

  useEffect(() => {
    const gridContent = gridContentRef.current;
    if (!gridContent) return;

    const updateGridOverlayHeight = () => {
      setGridOverlayHeight(gridContent.offsetHeight);
    };

    updateGridOverlayHeight();
    window.addEventListener("resize", updateGridOverlayHeight);

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updateGridOverlayHeight)
        : null;
    resizeObserver?.observe(gridContent);

    return () => {
      window.removeEventListener("resize", updateGridOverlayHeight);
      resizeObserver?.disconnect();
    };
  }, [activeTemplateTotalDays, templateAreas.length]);

  const empNameMap: Record<string, string> = {};
  const empColorMap: Record<string, string> = {};
  const empAvatarMap: Record<string, string> = {};
  employees.forEach((e) => {
    empNameMap[e.id] = `${e.firstName} ${e.lastName}`;
    empColorMap[e.id] = e.employeeColor || "var(--primary)";
    empAvatarMap[e.id] = getEmployeeAvatarUrl(e);
  });

  // ── Conflict detection ─────────────────────────────────────────────────────

  /**
   * Check if adding `empId` to the given shift would conflict with another shift
   * across the template timeline, including overnight shifts spilling into the next day.
   */
  const findConflict = (
    empId: string,
    dayIndex: number,
    startTime: string,
    endTime: string,
    excludeCellId?: string,
  ): RosterShiftCell | null => {
    for (const cell of activeTemplateVisibleCells) {
      if (cell.id === excludeCellId) continue;
      if (!cell.employeeIds.includes(empId)) continue;
      if (
        indexedShiftsOverlap(
          { dayIndex, startTime, endTime },
          {
            dayIndex: cell.dayIndex,
            startTime: cell.startTime,
            endTime: cell.endTime,
          },
        )
      ) {
        return cell;
      }
    }
    return null;
  };

  const findAvailabilityWarning = (
    empId: string,
    dayIndex: number,
    startTime: string,
    endTime: string,
  ) => {
    const employee = activeEmployees.find((item) => item.id === empId);
    if (!employee) return null;
    return getTemplateShiftAvailabilityWarning(
      employee,
      { dayIndex, startTime, endTime },
      locale,
    );
  };

  const conflictEmployeeIdSet = useMemo(() => {
    if (!cellModalOpen) return new Set<string>();
    const set = new Set<string>();
    for (const emp of activeEmployees) {
      const conflict = findConflict(
        emp.id,
        editingDayIndex,
        cellForm.startTime,
        cellForm.endTime,
        editingCell?.id,
      );
      if (conflict) set.add(emp.id);
    }
    return set;
  }, [
    activeEmployees,
    cellForm.endTime,
    cellForm.startTime,
    cellModalOpen,
    editingCell?.id,
    editingDayIndex,
    findConflict,
  ]);

  useEffect(() => {
    if (!cellModalOpen) return;
    if (cellForm.employeeIds.length === 0) return;
    if (conflictEmployeeIdSet.size === 0) return;
    const conflicted = cellForm.employeeIds.filter((id) =>
      conflictEmployeeIdSet.has(id),
    );
    if (conflicted.length === 0) return;
    setCellForm((prev) => ({
      ...prev,
      employeeIds: prev.employeeIds.filter((id) => !conflictEmployeeIdSet.has(id)),
    }));
    toast.warning(
      locale === "zh"
        ? `已移除 ${conflicted.length} 名时间冲突员工`
        : `Removed ${conflicted.length} conflicting employee(s)`,
    );
  }, [cellForm.employeeIds, cellModalOpen, conflictEmployeeIdSet, locale]);

  // ── Template CRUD ─────────────────────────────────────────────────────────

  const createDraftTemplate = (initialAreaIds: string[] = []) => {
    const uniqueAreaIds = Array.from(new Set(initialAreaIds.filter(Boolean)));
    const firstArea = uniqueAreaIds
      .map((areaId) => templateAreaMap[areaId])
      .find(Boolean);
    const inferredStoreId =
      firstArea && (firstArea.areaType || "store") !== "general"
        ? firstArea.storeId
        : "";
    const defaultStoreId =
      selectedStoreId || inferredStoreId || stores[0]?.id || "";
    nextCreatedTemplateIdRef.current += 1;
    const newTemplate: RosterTemplate = {
      id: `rt-new-${nextCreatedTemplateIdRef.current}`,
      name:
        locale === "zh"
          ? `新排班模版 ${allTemplates.length + 1}`
          : `New Roster Template ${allTemplates.length + 1}`,
      storeId: defaultStoreId,
      totalDays: 7,
      areaIds: uniqueAreaIds,
      employeeIds: [],
      cells: [],
    };

    setTemplates((prev) => [...prev, newTemplate]);
    setActiveTemplateId(newTemplate.id);
    return newTemplate;
  };

  const updateTemplate = (updater: (t: RosterTemplate) => RosterTemplate) => {
    if (!resolvedActiveTemplateId) return;
    setTemplates((prev) =>
      prev.map((t) => (t.id === resolvedActiveTemplateId ? updater(t) : t)),
    );
  };

  const handleSetDays = (days: number) => {
    const normalizedDays = Math.max(7, Math.floor(days));
    updateTemplate((t) => ({
      ...t,
      totalDays: normalizedDays,
      cells: t.cells.map((cell) => ({
        ...cell,
        cycleWeek: getCycleWeek(cell.dayIndex),
      })),
    }));
    toast.success(
      locale === "zh"
        ? `已设置为 ${formatDurationLabel(normalizedDays, locale)}`
        : `Set to ${formatDurationLabel(normalizedDays, locale)}`,
    );
  };

  const handleAddArea = () => {
    if (!selectedAreaId) return;

    if (!activeTemplate) {
      createDraftTemplate([selectedAreaId]);
      setSelectedAreaId("");
      setAddAreaOpen(false);
      toast.success(
        locale === "zh"
          ? "已创建模版并加入区域"
          : "Template created and area linked",
      );
      return;
    }

    updateTemplate((t) => ({
      ...t,
      areaIds: t.areaIds.includes(selectedAreaId)
        ? t.areaIds
        : [...t.areaIds, selectedAreaId],
    }));
    setSelectedAreaId("");
    setAddAreaOpen(false);
    toast.success(
      locale === "zh" ? "区域已加入模版" : "Area linked to template",
    );
  };

  const handleDeleteArea = (areaId: string) => {
    updateTemplate((t) => ({
      ...t,
      areaIds: t.areaIds.filter((id) => id !== areaId),
      cells: t.cells.filter((c) => c.areaId !== areaId),
    }));
    toast.success(
      locale === "zh" ? "区域已从模版移除" : "Area removed from template",
    );
  };

  const openAddEmployeeModal = () => {
    setAddEmployeeOpen(true);
  };

  const handleAddEmployee = async (employee: Employee) => {
    try {
      await saveEmployee(employee);
      setSearchText("");
      setAddEmployeeOpen(false);
      toast.success(locale === "zh" ? "员工已添加" : "Employee added");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Employee save failed",
      );
    }
  };

  const syncTemplateMembers = (
    template: RosterTemplate,
    memberIds: string[],
  ): RosterTemplate => {
    const nextIds = [...(template.employeeIds || [])];
    memberIds.forEach((id) => {
      if (id && !nextIds.includes(id)) nextIds.push(id);
    });
    return { ...template, employeeIds: nextIds };
  };

  const handleAddEmployeeToTemplate = (empId: string) => {
    if (!empId) return;
    if (templateMemberEmployeeIds.has(empId)) {
      toast.warning(
        locale === "zh" ? "该员工已在模版中" : "Employee already in template",
      );
      setDragEmpId(null);
      return;
    }

    updateTemplate((t) => ({
      ...t,
      employeeIds: [...(t.employeeIds || []), empId],
    }));
    setDragEmpId(null);
    toast.success(
      locale === "zh" ? "员工已加入模版" : "Employee added to template",
    );
  };

  const handleRemoveEmployeeFromTemplate = (empId: string) => {
    updateTemplate((t) => ({
      ...t,
      employeeIds: (t.employeeIds || []).filter((id) => id !== empId),
      cells: t.cells.map((cell) => ({
        ...cell,
        employeeIds: cell.employeeIds.filter((id) => id !== empId),
      })),
    }));
    toast.success(
      locale === "zh" ? "员工已从模版移除" : "Employee removed from template",
    );
  };

  const handleTemplateMemberDragOver = (e: DragEvent) => {
    if (gridViewMode !== "employee" || !dragEmpId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const handleTemplateMemberDrop = (e: DragEvent) => {
    if (gridViewMode !== "employee" || !dragEmpId) return;
    e.preventDefault();
    e.stopPropagation();
    const empId = readSidebarEmployeeId(e, dragEmpId);
    if (empId) handleAddEmployeeToTemplate(empId);
  };

  // ── Cell CRUD ─────────────────────────────────────────────────────────────

  const openAddCell = (
    areaId: string,
    dayIndex: number,
    presetEmployeeIds: string[] = [],
    options?: { modalMode?: ShiftModalMode },
  ) => {
    const modalMode =
      options?.modalMode ||
      (presetEmployeeIds.length === 1 ? "employee" : "area");
    if (modalMode === "area" && !areaId) {
      toast.error(
        locale === "zh" ? "请先添加区域" : "Please add an area first",
      );
      return;
    }

    setCellModalMode(modalMode);
    setLockedEmployeeId(
      modalMode === "employee" ? presetEmployeeIds[0] || "" : "",
    );
    setEditingCell(null);
    setEditingAreaId(areaId || defaultTemplateAreaId);
    setEditingDayIndex(dayIndex);
    setCellForm({
      presetKey: "",
      shiftId: "",
      startTime: "09:00",
      endTime: "17:00",
      label: "",
      color: DEFAULT_COLOR_KEY,
      employeeIds: [...presetEmployeeIds],
    });
    setCellModalOpen(true);
  };

  const closeCellModal = () => {
    setCellModalOpen(false);
    setEditingCell(null);
    setCellModalMode("area");
    setLockedEmployeeId("");
  };

  const openEditCell = (cell: RosterShiftCell, rowEmployeeId = "") => {
    const useEmployeeModal =
      gridViewMode === "employee" && !!rowEmployeeId;
    setCellModalMode(useEmployeeModal ? "employee" : "area");
    setLockedEmployeeId(useEmployeeModal ? rowEmployeeId : "");

    const presetKey = makeShiftPresetKey({
      shiftType: "store",
      storeId: activeTemplateStoreId,
      shiftName: cell.label,
      startTime: cell.startTime,
      endTime: cell.endTime,
      color: cell.color,
    });

    setEditingCell(cell);
    setEditingAreaId(cell.areaId);
    setEditingDayIndex(cell.dayIndex);
    setCellForm({
      presetKey,
      shiftId: cell.shiftId || "",
      startTime: cell.startTime,
      endTime: cell.endTime,
      label: cell.label,
      color: cell.color,
      employeeIds: [...cell.employeeIds],
    });
    setCellModalOpen(true);
  };

  const handleSaveCell = () => {
    if (!cellForm.label.trim()) {
      toast.error(locale === "zh" ? "请选择班次" : "Please choose a shift");
      return;
    }
    if (!editingAreaId) {
      toast.error(locale === "zh" ? "请选择区域" : "Please select an area");
      return;
    }

    const employeeIds =
      cellModalMode === "employee" && lockedEmployeeId
        ? [lockedEmployeeId]
        : cellForm.employeeIds;

    if (employeeIds.length === 0) {
      toast.error(
        locale === "zh"
          ? "请至少选择一名员工"
          : "Please select at least one employee",
      );
      return;
    }

    const slotKey = makeTemplateCellSlotKey({
      areaId: editingAreaId,
      dayIndex: editingDayIndex,
      startTime: cellForm.startTime,
      endTime: cellForm.endTime,
      shiftId: cellForm.shiftId,
      label: cellForm.label,
    });

    const checkEmployeeConflicts = (
      ids: string[],
      ignoreCellId?: string,
    ) => {
      const availabilityWarnings: string[] = [];
      for (const empId of ids) {
        const availabilityWarning = findAvailabilityWarning(
          empId,
          editingDayIndex,
          cellForm.startTime,
          cellForm.endTime,
        );
        if (availabilityWarning) {
          availabilityWarnings.push(availabilityWarning);
        }

        const conflict = findConflict(
          empId,
          editingDayIndex,
          cellForm.startTime,
          cellForm.endTime,
          ignoreCellId,
        );
        if (conflict) {
          const empName = empNameMap[empId] || empId;
          toast.error(
            locale === "zh"
              ? `${empName} 在 ${getDetailedDayLabel(editingDayIndex, locale)} ${conflict.label || conflict.startTime} 已有排班冲突`
              : `${empName} has a scheduling conflict on ${getDetailedDayLabel(editingDayIndex, locale)} (${conflict.label || conflict.startTime})`,
          );
          return false;
        }
      }

      if (availabilityWarnings.length > 0) {
        availabilityWarnings.forEach((w) => toast.warning(w));
      }
      return true;
    };

    if (editingCell) {
      if (cellModalMode === "employee" && lockedEmployeeId) {
        const empId = lockedEmployeeId;

        if (!checkEmployeeConflicts([empId], editingCell.id)) {
          return;
        }

        const newSlotKey = makeTemplateCellSlotKey({
          areaId: editingAreaId,
          dayIndex: editingDayIndex,
          startTime: cellForm.startTime,
          endTime: cellForm.endTime,
          shiftId: cellForm.shiftId,
          label: cellForm.label,
        });
        const isSameSlot =
          newSlotKey === makeTemplateCellSlotKey(editingCell);
        const remainingIds = editingCell.employeeIds.filter((id) => id !== empId);
        const newCellFields = {
          areaId: editingAreaId,
          shiftId: cellForm.shiftId || undefined,
          startTime: cellForm.startTime,
          endTime: cellForm.endTime,
          label: cellForm.label,
          color: cellForm.color,
        };

        if (isSameSlot && editingCell.employeeIds.length > 1) {
          closeCellModal();
          toast.success(locale === "zh" ? "班次已保存" : "Shift saved");
          return;
        }

        updateTemplate((t) => {
          let cells: RosterShiftCell[];

          if (isSameSlot) {
            cells = t.cells.map((c) =>
              c.id === editingCell.id
                ? { ...c, ...newCellFields, employeeIds: [empId] }
                : c,
            );
          } else {
            cells = t.cells
              .map((c) => {
                if (c.id !== editingCell.id) return c;
                if (remainingIds.length === 0) return null;
                return { ...c, employeeIds: remainingIds };
              })
              .filter((c): c is RosterShiftCell => c !== null);

            const existingAtNew = cells.find(
              (c) =>
                c.id !== editingCell.id &&
                makeTemplateCellSlotKey(c) === newSlotKey,
            );

            if (existingAtNew) {
              cells = cells.map((c) =>
                c.id === existingAtNew.id
                  ? {
                      ...c,
                      employeeIds: mergeUniqueEmployeeIds(c.employeeIds, [empId]),
                    }
                  : c,
              );
            } else {
              nextCreatedCellIdRef.current += 1;
              cells.push({
                id: `cell-new-${nextCreatedCellIdRef.current}`,
                ...newCellFields,
                dayIndex: editingDayIndex,
                cycleWeek: getCycleWeek(editingDayIndex),
                employeeIds: [empId],
              });
            }
          }

          return syncTemplateMembers({ ...t, cells }, [empId]);
        });

        closeCellModal();
        toast.success(locale === "zh" ? "班次已保存" : "Shift saved");
        return;
      }

      const employeeIdsToSave =
        cellModalMode === "employee"
          ? editingCell.employeeIds
          : employeeIds;

      if (!checkEmployeeConflicts(employeeIdsToSave, editingCell.id)) {
        return;
      }

      updateTemplate((t) =>
        syncTemplateMembers(
          {
            ...t,
            cells: t.cells.map((c) =>
              c.id === editingCell.id
                ? {
                    ...c,
                    areaId: editingAreaId,
                    shiftId: cellForm.shiftId || undefined,
                    startTime: cellForm.startTime,
                    endTime: cellForm.endTime,
                    label: cellForm.label,
                    color: cellForm.color,
                    employeeIds: employeeIdsToSave,
                  }
                : c,
            ),
          },
          employeeIdsToSave,
        ),
      );
    } else {
      const existing = activeTemplateVisibleCells.find(
        (cell) => makeTemplateCellSlotKey(cell) === slotKey,
      );

      if (existing) {
        const mergedEmployeeIds = mergeUniqueEmployeeIds(
          existing.employeeIds,
          employeeIds,
        );
        const newlyAddedEmployeeIds = employeeIds.filter(
          (empId) => !existing.employeeIds.includes(empId),
        );

        if (!checkEmployeeConflicts(newlyAddedEmployeeIds, existing.id)) {
          return;
        }

        updateTemplate((t) =>
          syncTemplateMembers(
            {
              ...t,
              cells: t.cells.map((c) =>
                c.id === existing.id
                  ? {
                      ...c,
                      areaId: editingAreaId,
                      shiftId: cellForm.shiftId || undefined,
                      startTime: cellForm.startTime,
                      endTime: cellForm.endTime,
                      label: cellForm.label,
                      color: cellForm.color,
                      employeeIds: mergedEmployeeIds,
                    }
                  : c,
              ),
            },
            mergedEmployeeIds,
          ),
        );
        toast.success(locale === "zh" ? "班次已保存" : "Shift saved");
        closeCellModal();
        return;
      }

      if (!checkEmployeeConflicts(employeeIds)) {
        return;
      }

      nextCreatedCellIdRef.current += 1;
      const newCell: RosterShiftCell = {
        id: `cell-new-${nextCreatedCellIdRef.current}`,
        shiftId: cellForm.shiftId || undefined,
        areaId: editingAreaId,
        dayIndex: editingDayIndex,
        cycleWeek: getCycleWeek(editingDayIndex),
        startTime: cellForm.startTime,
        endTime: cellForm.endTime,
        label: cellForm.label,
        color: cellForm.color,
        employeeIds,
      };
      updateTemplate((t) =>
        syncTemplateMembers({ ...t, cells: [...t.cells, newCell] }, employeeIds),
      );
    }

    closeCellModal();
    toast.success(locale === "zh" ? "班次已保存" : "Shift saved");
  };

  const handleDeleteCell = (cellId: string) => {
    updateTemplate((t) => ({
      ...t,
      cells: t.cells.filter((c) => c.id !== cellId),
    }));
    toast.success(locale === "zh" ? "班次已删除" : "Shift deleted");
  };

  const handleDeleteCellForEmployeeRow = (
    cellId: string,
    rowEmployeeId?: string,
  ) => {
    if (!rowEmployeeId) {
      handleDeleteCell(cellId);
      return;
    }

    const cell = (activeTemplate?.cells || []).find((item) => item.id === cellId);
    if (!cell) return;

    if (cell.employeeIds.length <= 1) {
      handleDeleteCell(cellId);
      return;
    }

    handleRemoveEmployee(cellId, rowEmployeeId);
  };

  /** Drop an employee onto a cell: availability warns only; overlapping shifts still block. */
  const handleDropEmployee = (cellId: string, empId: string) => {
    const cell = (activeTemplate?.cells || []).find((c) => c.id === cellId);
    if (!cell) return;

    if (cell.employeeIds.includes(empId)) {
      toast.warning(
        locale === "zh"
          ? "该员工已在此班次中"
          : "Employee already assigned to this shift",
      );
      setDragEmpId(null);
      return;
    }

    const availabilityWarning = findAvailabilityWarning(
      empId,
      cell.dayIndex,
      cell.startTime,
      cell.endTime,
    );
    if (availabilityWarning) {
      toast.warning(availabilityWarning);
    }

    const conflict = findConflict(
      empId,
      cell.dayIndex,
      cell.startTime,
      cell.endTime,
      cellId,
    );
    if (conflict) {
      const empName = empNameMap[empId] || empId;
      toast.error(
        locale === "zh"
          ? `${empName} 在 ${getDetailedDayLabel(cell.dayIndex, locale)} ${conflict.label || conflict.startTime} 已有排班冲突`
          : `${empName} has a scheduling conflict on ${getDetailedDayLabel(cell.dayIndex, locale)} (${conflict.label || conflict.startTime})`,
      );
      setDragEmpId(null);
      return;
    }

    updateTemplate((t) =>
      syncTemplateMembers(
        {
          ...t,
          cells: t.cells.map((c) =>
            c.id === cellId ? { ...c, employeeIds: [...c.employeeIds, empId] } : c,
          ),
        },
        [empId],
      ),
    );
    setDragEmpId(null);
    console.log("[RosterTemplate] drop employee", empId, "onto cell", cellId);
    toast.success(
      locale === "zh" ? "员工已添加到班次" : "Employee added to shift",
    );
  };

  const handleRemoveEmployee = (cellId: string, empId: string) => {
    updateTemplate((t) => ({
      ...t,
      cells: t.cells.map((c) =>
        c.id === cellId
          ? { ...c, employeeIds: c.employeeIds.filter((id) => id !== empId) }
          : c,
      ),
    }));
  };

  // ── Name save ─────────────────────────────────────────────────────────────

  const handleSaveName = () => {
    if (!nameDraft.trim()) return;
    updateTemplate((t) => ({ ...t, name: nameDraft.trim() }));
    setNameEditing(false);
  };

  // ── New template ──────────────────────────────────────────────────────────

  const handleNewTemplate = () => {
    const defaultStoreId = selectedStoreId || stores[0]?.id || "";
    const defaultAreaId =
      areas.find(
        (area) =>
          (area.areaType || "store") === "general" ||
          area.storeId === defaultStoreId,
      )?.id || "";
    createDraftTemplate(defaultAreaId ? [defaultAreaId] : []);
    toast.success(locale === "zh" ? "新模版已创建" : "New template created");
  };

  const handleSaveTemplate = async () => {
    if (!activeTemplate) return;
    try {
      const saved = await saveRosterTemplate(activeTemplate);
      setActiveTemplateId(saved.id);
      onSave();
      toast.success(locale === "zh" ? "模版已保存" : "Template saved");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Template save failed",
      );
    }
  };

  const handleDeleteTemplate = async () => {
    if (!activeTemplate) return;
    const deletedTemplateId = activeTemplate.id;
    const nextTemplateId =
      visibleTemplates.find((template) => template.id !== deletedTemplateId)
        ?.id || "";

    try {
      await deleteRosterTemplate(deletedTemplateId);
      setActiveTemplateId(nextTemplateId);
      setNameEditing(false);
      onSave();
      toast.success(locale === "zh" ? "模版已删除" : "Template deleted");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Template delete failed",
      );
    }
  };

  // ── Duration buttons ───────────────────────────────────────────────────────

  const durationOptions = [
    { label: locale === "zh" ? "1周" : "1 Week", days: 7 },
    { label: locale === "zh" ? "2周" : "2 Weeks", days: 14 },
    { label: locale === "zh" ? "3周" : "3 Weeks", days: 21 },
    { label: locale === "zh" ? "4周" : "4 Weeks", days: 28 },
  ];
  const durationSelectOptions = [
    ...durationOptions.map((opt) => ({ value: opt.days, label: opt.label })),
    ...(durationOptions.some((opt) => opt.days === activeTemplateTotalDays)
      ? []
      : [
          {
            value: activeTemplateTotalDays,
            label: formatDurationLabel(activeTemplateTotalDays, locale),
          },
        ]),
  ];

  const visibleTemplateCount = visibleTemplates.length;

  console.log(
    "[RosterTemplatePage] activeTemplate:",
    activeTemplate?.id,
    "totalDays:",
    activeTemplate?.totalDays,
  );

  return (
    <div
      data-cmp="RosterTemplatePage"
      className="flex flex-col"
      style={{ height: "calc(100vh - 88px)", overflow: "hidden" }}
    >
      {/* ── Top bar ─────────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between px-4 py-3 flex-shrink-0"
        style={{
          background: "var(--card)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        {/* Left: template tabs */}
        <div className="flex items-center gap-2">
          {visibleTemplates.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTemplateId(t.id)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background:
                  resolvedActiveTemplateId === t.id
                    ? "var(--primary)"
                    : "var(--muted)",
                color:
                  resolvedActiveTemplateId === t.id
                    ? "var(--primary-foreground)"
                    : "var(--muted-foreground)",
              }}
            >
              {t.name}
            </button>
          ))}
          {visibleTemplateCount === 0 && (
            <span
              className="text-sm"
              style={{ color: "var(--muted-foreground)" }}
            >
              {locale === "zh"
                ? "当前店面暂无模版"
                : "No templates for this store"}
            </span>
          )}
          <Tooltip title={locale === "zh" ? "新建模版" : "New template"}>
            <button
              onClick={handleNewTemplate}
              className="flex items-center justify-center rounded-lg"
              style={{
                width: 30,
                height: 30,
                background: "var(--muted)",
                color: "var(--muted-foreground)",
              }}
            >
              <Plus size={14} />
            </button>
          </Tooltip>
        </div>

        {/* Right: duration selector + save */}
        <div className="flex items-center gap-2">
          <span
            className="text-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            {locale === "zh" ? "模版时长" : "Duration"}
          </span>
          <Select
            value={activeTemplateTotalDays}
            onChange={(days) => handleSetDays(Number(days))}
            disabled={!activeTemplate}
            style={{ minWidth: locale === "zh" ? 120 : 140 }}
            options={durationSelectOptions}
            dropdownRender={(menu) => (
              <>
                {menu}
                <div
                  style={{
                    padding: "12px 16px",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <div
                    className="text-sm mb-2.5"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {locale === "zh" ? "自定义天数" : "Custom days"}
                  </div>
                  <div className="flex items-center gap-2.5">
                    <InputNumber
                      min={7}
                      max={84}
                      step={7}
                      value={customDaysInput}
                      onChange={(v) =>
                        setCustomDaysInput(Math.max(7, Number(v) || 7))
                      }
                      style={{ width: 120, height: 36 }}
                      controls
                    />
                    <span
                      className="text-sm"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {locale === "zh" ? "天" : "days"}
                    </span>
                    <Button
                      type="primary"
                      onClick={() => handleSetDays(customDaysInput)}
                      style={{ height: 36 }}
                    >
                      {locale === "zh" ? "确定" : "OK"}
                    </Button>
                  </div>
                </div>
              </>
            )}
          />

          <Button
            type="primary"
            icon={<Save size={14} />}
            onClick={handleSaveTemplate}
            disabled={!activeTemplate}
            style={{ display: "flex", alignItems: "center", gap: 4 }}
          >
            {locale === "zh" ? "保存模版" : "Save Template"}
          </Button>
          <Popconfirm
            title={locale === "zh" ? "删除排班模版" : "Delete roster template"}
            description={
              locale === "zh"
                ? "删除后不可恢复，确定继续？"
                : "This cannot be undone. Continue?"
            }
            okText={locale === "zh" ? "删除" : "Delete"}
            cancelText={locale === "zh" ? "取消" : "Cancel"}
            okButtonProps={{ danger: true }}
            onConfirm={handleDeleteTemplate}
            disabled={!activeTemplate}
          >
            <Button
              danger
              icon={<Trash2 size={14} />}
              disabled={!activeTemplate}
              style={{ display: "flex", alignItems: "center", gap: 4 }}
            >
              {locale === "zh" ? "删除模版" : "Delete Template"}
            </Button>
          </Popconfirm>
        </div>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Left Panel: Employees ────────────────────────────────────────── */}
        <div
          className="flex flex-col flex-shrink-0"
          style={{
            width: 260,
            background: "var(--card)",
            borderRight: "1px solid var(--border)",
            overflow: "hidden",
          }}
        >
          {/* Search */}
          <div
            className="px-3 py-3 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <Input
              prefix={
                <Search
                  size={13}
                  style={{ color: "var(--muted-foreground)" }}
                />
              }
              placeholder={
                locale === "zh" ? "搜索员工..." : "Search employees..."
              }
              size="small"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
            <div className="flex items-center justify-between mt-2">
              <span
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                {gridViewMode === "employee"
                  ? locale === "zh"
                    ? "拖拽到模版表格添加员工"
                    : "Drag to template grid to add employees"
                  : locale === "zh"
                    ? "显示所有职位"
                    : "Show All Positions"}
              </span>
              <span
                className="text-xs font-medium"
                style={{ color: "var(--primary)" }}
              >
                {sidebarEmployees.length} {locale === "zh" ? "人" : "staff"}
              </span>
            </div>
          </div>

          {/* Sort label */}
          <div
            className="px-3 py-2 flex-shrink-0"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <span
              className="text-xs"
              style={{ color: "var(--muted-foreground)" }}
            >
              {locale === "zh" ? "按姓名排序 A-Z" : "Sort by First Name A-Z"}
            </span>
          </div>

          {/* Employee list */}
          <div className="flex-1 overflow-y-auto px-3 py-2">
            {sidebarEmployees.map((emp) => (
              <EmployeeCard
                key={emp.id}
                employeeId={emp.id}
                firstName={emp.firstName}
                lastName={emp.lastName}
                avatarUrl={getEmployeeAvatarUrl(emp)}
                color={emp.employeeColor || "var(--primary)"}
                hoursPerDay={empHoursMap[emp.id] || []}
                onDragStart={(id) => {
                  setDragEmpId(id);
                  console.log("[RosterTemplate] drag start:", id);
                }}
                onDragEnd={() => setDragEmpId(null)}
              />
            ))}

            {/* Add Employee placeholder */}
            <button
              type="button"
              onClick={openAddEmployeeModal}
              className="w-full rounded-lg text-sm py-2.5 mt-1"
              style={{
                border: "1.5px dashed var(--border)",
                color: "var(--primary)",
                background: "transparent",
              }}
            >
              <Plus size={13} className="inline mr-1" />
              {locale === "zh" ? "添加员工" : "Add Employee"}
            </button>
          </div>
        </div>

        {/* ── Right Panel: Schedule Grid ───────────────────────────────────── */}
        <div
          ref={gridScrollRef}
          className="flex-1 overflow-auto relative"
        >
          {/* Template name header */}
          <div
            className="px-4 py-2 flex items-center justify-between flex-shrink-0 sticky top-0 left-0 z-10"
            style={{
              background: "var(--card)",
              borderBottom: "1px solid var(--border)",
              zIndex: 40,
              width: "100%",
            }}
          >
            {nameEditing ? (
              <div className="flex items-center gap-2">
                <Input
                  size="small"
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onPressEnter={handleSaveName}
                  style={{ width: 200 }}
                  autoFocus
                />
                <Button size="small" type="primary" onClick={handleSaveName}>
                  {locale === "zh" ? "确定" : "OK"}
                </Button>
                <Button size="small" onClick={() => setNameEditing(false)}>
                  {locale === "zh" ? "取消" : "Cancel"}
                </Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span
                  className="font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  {activeTemplate?.name}
                </span>
                <button
                  onClick={() => {
                    setNameEditing(true);
                    setNameDraft(activeTemplate?.name || "");
                  }}
                >
                  <Edit2
                    size={13}
                    style={{ color: "var(--muted-foreground)" }}
                  />
                </button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span
                className="text-xs"
                style={{ color: "var(--muted-foreground)" }}
              >
                {activeTemplate?.totalDays} {locale === "zh" ? "天" : "days"}
              </span>
              <Tag
                style={{
                  background: "var(--secondary)",
                  color: "var(--primary)",
                  border: "none",
                }}
              >
                {templateAreas.length} {locale === "zh" ? "个区域" : "areas"}
              </Tag>
              {/* Multi-employee tip */}
              <div
                className="flex items-center gap-1 rounded-md px-2 py-0.5"
                style={{
                  background: "var(--secondary)",
                  border: "1px solid var(--border)",
                }}
              >
                <AlertTriangle size={10} style={{ color: "var(--primary)" }} />
                <span style={{ color: "var(--primary)", fontSize: 10 }}>
                  {locale === "zh"
                    ? "每班次支持多名员工"
                    : "Multiple employees per shift"}
                </span>
              </div>
              <div
                className="flex items-center rounded-lg p-0.5"
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
                  }}
                >
                  <LayoutGrid size={12} />
                  {locale === "zh" ? "区域" : "Area"}
                </button>
                <button
                  type="button"
                  onClick={() => setGridViewMode("employee")}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all"
                  style={{
                    background:
                      gridViewMode === "employee"
                        ? "var(--card)"
                        : "transparent",
                    color:
                      gridViewMode === "employee"
                        ? "var(--primary)"
                        : "var(--muted-foreground)",
                  }}
                >
                  <Users size={12} />
                  {locale === "zh" ? "员工" : "Employee"}
                </button>
              </div>
            </div>
          </div>

          {hasHorizontalOverflow && (
            <div
              className="sticky left-0 right-0 top-0 z-30 pointer-events-none"
              style={{
                height: gridOverlayHeight,
                marginBottom: -gridOverlayHeight,
              }}
            >
              <Tooltip
                title={
                  locale === "zh"
                    ? "单击左移一格，双击左移一屏"
                    : "Click to move one cell, double-click to move one page"
                }
              >
                <button
                  type="button"
                  aria-label={
                    locale === "zh"
                      ? "向左滚动排班模版"
                      : "Scroll roster template left"
                  }
                  disabled={!canScrollLeft}
                  onClick={(event) =>
                    handleHorizontalScrollButtonClick(event, -1)
                  }
                  onDoubleClick={() =>
                    handleHorizontalScrollButtonDoubleClick(-1)
                  }
                  className="absolute flex items-center justify-center rounded-md pointer-events-auto transition-all"
                  style={{
                    left: TEMPLATE_AREA_COLUMN_WIDTH + 16,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 34,
                    height: 84,
                    background: "var(--card)",
                    border: "1px solid var(--primary)",
                    color: "var(--primary)",
                    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.14)",
                    opacity: canScrollLeft ? 0.95 : 0.35,
                    cursor: canScrollLeft ? "pointer" : "not-allowed",
                  }}
                >
                  <ChevronLeft size={18} />
                </button>
              </Tooltip>

              <Tooltip
                title={
                  locale === "zh"
                    ? "单击右移一格，双击右移一屏"
                    : "Click to move one cell, double-click to move one page"
                }
              >
                <button
                  type="button"
                  aria-label={
                    locale === "zh"
                      ? "向右滚动排班模版"
                      : "Scroll roster template right"
                  }
                  disabled={!canScrollRight}
                  onClick={(event) =>
                    handleHorizontalScrollButtonClick(event, 1)
                  }
                  onDoubleClick={() =>
                    handleHorizontalScrollButtonDoubleClick(1)
                  }
                  className="absolute flex items-center justify-center rounded-md pointer-events-auto transition-all"
                  style={{
                    right: 16,
                    top: "50%",
                    transform: "translateY(-50%)",
                    width: 34,
                    height: 84,
                    background: "var(--card)",
                    border: "1px solid var(--primary)",
                    color: "var(--primary)",
                    boxShadow: "0 8px 24px rgba(15, 23, 42, 0.14)",
                    opacity: canScrollRight ? 0.95 : 0.35,
                    cursor: canScrollRight ? "pointer" : "not-allowed",
                  }}
                >
                  <ChevronRight size={18} />
                </button>
              </Tooltip>
            </div>
          )}

          {/* Grid */}
          <div
            ref={gridContentRef}
            onDragOver={handleTemplateMemberDragOver}
            onDrop={handleTemplateMemberDrop}
            style={{
              width: "100%",
              minWidth: Math.max(
                700,
                totalDaysList.length * TEMPLATE_DAY_COLUMN_WIDTH +
                  TEMPLATE_AREA_COLUMN_WIDTH +
                  TEMPLATE_ACTION_COLUMN_WIDTH,
              ),
            }}
          >
            {/* Day header row */}
            <div
              className="flex sticky top-10 z-20"
              onDragOver={handleTemplateMemberDragOver}
              onDrop={handleTemplateMemberDrop}
              style={{
                background: "var(--card)",
                borderBottom: "1px solid var(--border)",
              }}
            >
              {/* Area column header */}
              <div
                className="sticky left-0 flex-shrink-0 flex items-center px-4"
                style={{
                  width: TEMPLATE_AREA_COLUMN_WIDTH,
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
                    ? locale === "zh"
                      ? "区域"
                      : "Area"
                    : locale === "zh"
                      ? "员工"
                      : "Employee"}
                </span>
              </div>

              {/* Day columns */}
              {totalDaysList.map((day) => {
                const dayIndex = day - 1;
                const isStoreClosed = isStoreClosedOnDayIndex(
                  activeTemplateStore,
                  dayIndex,
                );

                return (
                  <div
                    key={day}
                    className="flex items-center justify-center"
                    style={{
                      flex: `1 1 ${TEMPLATE_DAY_COLUMN_WIDTH}px`,
                      minWidth: TEMPLATE_DAY_COLUMN_WIDTH,
                      minHeight: 44,
                      borderRight: "1px solid var(--border)",
                      background: isStoreClosed
                        ? "var(--workday-weekend-header)"
                        : "var(--card)",
                    }}
                  >
                    <span
                      className="text-sm font-semibold"
                      style={{
                        color: isStoreClosed
                          ? "var(--workday-weekend-text)"
                          : "var(--foreground)",
                      }}
                    >
                      {getWeekdayLabel(dayIndex, locale)}
                    </span>
                  </div>
                );
              })}

              {/* +/- columns */}
              <div
                className="flex items-center px-2"
                style={{
                  flex: `0 0 ${TEMPLATE_ACTION_COLUMN_WIDTH}px`,
                  width: TEMPLATE_ACTION_COLUMN_WIDTH,
                  minWidth: TEMPLATE_ACTION_COLUMN_WIDTH,
                  minHeight: 44,
                }}
              >
                <Tooltip
                  title={locale === "zh" ? "删除/增减列" : "Manage columns"}
                >
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() =>
                        activeTemplate &&
                        activeTemplate.totalDays > 7 &&
                        handleSetDays(activeTemplate.totalDays - 7)
                      }
                      className="flex items-center justify-center rounded-md"
                      style={{
                        width: 20,
                        height: 20,
                        background: "var(--destructive)",
                        color: "var(--primary-foreground)",
                      }}
                    >
                      <Minus size={10} />
                    </button>
                    <button
                      onClick={() =>
                        handleSetDays((activeTemplate?.totalDays || 7) + 7)
                      }
                      className="flex items-center justify-center rounded-md"
                      style={{
                        width: 20,
                        height: 20,
                        background: "var(--primary)",
                        color: "var(--primary-foreground)",
                      }}
                    >
                      <Plus size={10} />
                    </button>
                  </div>
                </Tooltip>
              </div>
            </div>

            {/* Grid body: area or employee rows */}
            {gridViewMode === "area" ? (
            templateAreas.map((area) => (
              <div
                key={area.id}
                className="flex"
                style={{ borderBottom: "1px solid var(--border)" }}
              >
                {/* Area name cell */}
                <div
                  className="sticky left-0 flex-shrink-0 flex items-start justify-between px-3 py-3 group"
                  style={{
                    width: TEMPLATE_AREA_COLUMN_WIDTH,
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
                  <Popconfirm
                    title={
                      locale === "zh" ? "删除此区域？" : "Delete this area?"
                    }
                    onConfirm={() => handleDeleteArea(area.id)}
                    okText={locale === "zh" ? "是" : "Yes"}
                    cancelText={locale === "zh" ? "否" : "No"}
                  >
                    <button
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      style={{ color: "var(--destructive)" }}
                    >
                      <Trash2 size={11} />
                    </button>
                  </Popconfirm>
                </div>

                {/* Day cells */}
                {totalDaysList.map((day) => {
                  const dayIndex = day - 1;
                  const isStoreClosed = isStoreClosedOnDayIndex(
                    activeTemplateStore,
                    dayIndex,
                  );
                  const cellsInSlot = activeTemplateVisibleCells.filter(
                    (c) => c.areaId === area.id && c.dayIndex === dayIndex,
                  );

                  return (
                    <div
                      key={day}
                      className="p-1.5"
                      style={{
                        flex: `1 1 ${TEMPLATE_DAY_COLUMN_WIDTH}px`,
                        minWidth: TEMPLATE_DAY_COLUMN_WIDTH,
                        borderRight: "1px solid var(--border)",
                        minHeight: 88,
                        background: isStoreClosed
                          ? "var(--workday-weekend-header)"
                          : "transparent",
                      }}
                      onDragOver={(e) => e.preventDefault()}
                    >
                      {cellsInSlot.map((cell) => {
                        const cellEmployees = cell.employeeIds
                          .map((eid) => {
                            const emp = activeEmployees.find(
                              (employee) => employee.id === eid,
                            );
                            if (!emp) return null;
                            return {
                              id: eid,
                              name: empNameMap[eid],
                              color: empColorMap[eid] || "var(--primary)",
                              avatarUrl: empAvatarMap[eid] || "",
                              availabilityWarning:
                                getTemplateShiftAvailabilityWarning(
                                  emp,
                                  {
                                    dayIndex: cell.dayIndex,
                                    startTime: cell.startTime,
                                    endTime: cell.endTime,
                                  },
                                  locale,
                                ),
                            };
                          })
                          .filter(Boolean) as {
                          id: string;
                          name: string;
                          color: string;
                          avatarUrl: string;
                          availabilityWarning: string | null;
                        }[];
                        return (
                          <ShiftCell
                            key={cell.id}
                            cell={cell}
                            employees={cellEmployees}
                            onEdit={() => openEditCell(cell)}
                            onDelete={() => handleDeleteCell(cell.id)}
                            onDrop={(empId) =>
                              handleDropEmployee(cell.id, empId)
                            }
                            onRemoveEmployee={(empId) =>
                              handleRemoveEmployee(cell.id, empId)
                            }
                            onAddEmployeeClick={() => openEditCell(cell)}
                            viewMode="area"
                          />
                        );
                      })}

                      {/* Add shift button */}
                      <button
                        onClick={() => openAddCell(area.id, dayIndex)}
                        className="w-full rounded-lg flex items-center justify-center transition-all hover:opacity-80"
                        style={{
                          height: 22,
                          border: "1.5px dashed var(--border)",
                          color: "var(--muted-foreground)",
                          background: "transparent",
                          fontSize: 10,
                        }}
                      >
                        <Plus size={10} />
                      </button>
                    </div>
                  );
                })}

                {/* spacer */}
                <div
                  aria-hidden="true"
                  style={{
                    flex: `0 0 ${TEMPLATE_ACTION_COLUMN_WIDTH}px`,
                    width: TEMPLATE_ACTION_COLUMN_WIDTH,
                    minWidth: TEMPLATE_ACTION_COLUMN_WIDTH,
                  }}
                />
              </div>
            ))
            ) : templateAreas.length === 0 ? (
              <div
                className="flex items-center justify-center px-4 py-8 text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                {locale === "zh"
                  ? "请先添加区域"
                  : "Add areas to this template first"}
              </div>
            ) : gridEmployees.length === 0 &&
              !hasUnassignedCellsInTemplate &&
              sidebarEmployees.length === 0 &&
              filteredEmployees.length === 0 ? (
              <div
                className="flex items-center justify-center px-4 py-8 text-sm"
                style={{ color: "var(--muted-foreground)" }}
              >
                {locale === "zh" ? "暂无匹配员工" : "No matching employees"}
              </div>
            ) : (
              <>
                {gridEmployees.map((emp) => (
                  <div
                    key={emp.id}
                    className="flex"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <div
                      className="sticky left-0 flex-shrink-0 flex items-start justify-between px-3 py-3 group"
                      onDragOver={handleTemplateMemberDragOver}
                      onDrop={handleTemplateMemberDrop}
                      style={{
                        width: TEMPLATE_AREA_COLUMN_WIDTH,
                        borderRight: "1px solid var(--border)",
                        minHeight: 88,
                        background: "var(--muted)",
                        zIndex: 10,
                      }}
                    >
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <Avatar
                          size={24}
                          src={empAvatarMap[emp.id] || undefined}
                          style={{
                            background:
                              empColorMap[emp.id] || "var(--primary)",
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
                        </div>
                      </div>
                      <Popconfirm
                        title={
                          locale === "zh"
                            ? "从模版中移除此员工？"
                            : "Remove this employee from template?"
                        }
                        onConfirm={() =>
                          handleRemoveEmployeeFromTemplate(emp.id)
                        }
                        okText={locale === "zh" ? "是" : "Yes"}
                        cancelText={locale === "zh" ? "否" : "No"}
                      >
                        <button
                          type="button"
                          className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                          style={{ color: "var(--destructive)", flexShrink: 0 }}
                        >
                          <Trash2 size={11} />
                        </button>
                      </Popconfirm>
                    </div>

                    {totalDaysList.map((day) => {
                      const dayIndex = day - 1;
                      const cellsInSlot = filterCellsForEmployeeOnDay(
                        activeTemplateVisibleCells,
                        emp.id,
                        dayIndex,
                      );

                      return (
                        <TemplateEmployeeDayCell
                          key={day}
                          dayIndex={dayIndex}
                          employeeId={emp.id}
                          rowKind="employee"
                          cells={cellsInSlot}
                          areaNameMap={templateAreaNameMap}
                          activeEmployees={activeEmployees}
                          empNameMap={empNameMap}
                          empColorMap={empColorMap}
                          empAvatarMap={empAvatarMap}
                          defaultAreaId={defaultTemplateAreaId}
                          activeTemplateStore={activeTemplateStore}
                          locale={locale}
                          onAddCell={openAddCell}
                          onEditCell={openEditCell}
                          onDeleteCell={handleDeleteCellForEmployeeRow}
                          onDropEmployee={handleDropEmployee}
                          onRemoveEmployee={handleRemoveEmployee}
                          onAddEmployeeToTemplate={handleAddEmployeeToTemplate}
                          sidebarDragEmpId={dragEmpId}
                        />
                      );
                    })}

                    <div
                      aria-hidden="true"
                      style={{
                        flex: `0 0 ${TEMPLATE_ACTION_COLUMN_WIDTH}px`,
                        width: TEMPLATE_ACTION_COLUMN_WIDTH,
                        minWidth: TEMPLATE_ACTION_COLUMN_WIDTH,
                      }}
                    />
                  </div>
                ))}
                {hasUnassignedCellsInTemplate && (
                  <div
                    key={ROSTER_UNASSIGNED_ROW_ID}
                    className="flex"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <div
                      className="sticky left-0 flex-shrink-0 flex items-center px-3 py-3"
                      style={{
                        width: TEMPLATE_AREA_COLUMN_WIDTH,
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
                        {locale === "zh" ? "未分配" : "Unassigned"}
                      </span>
                    </div>
                    {totalDaysList.map((day) => {
                      const dayIndex = day - 1;
                      const cellsInSlot = filterUnassignedCellsOnDay(
                        activeTemplateVisibleCells,
                        dayIndex,
                      );

                      return (
                        <TemplateEmployeeDayCell
                          key={day}
                          dayIndex={dayIndex}
                          rowKind="unassigned"
                          cells={cellsInSlot}
                          areaNameMap={templateAreaNameMap}
                          activeEmployees={activeEmployees}
                          empNameMap={empNameMap}
                          empColorMap={empColorMap}
                          empAvatarMap={empAvatarMap}
                          defaultAreaId={defaultTemplateAreaId}
                          activeTemplateStore={activeTemplateStore}
                          locale={locale}
                          onAddCell={openAddCell}
                          onEditCell={openEditCell}
                          onDeleteCell={handleDeleteCellForEmployeeRow}
                          onDropEmployee={handleDropEmployee}
                          onRemoveEmployee={handleRemoveEmployee}
                          onAddEmployeeToTemplate={handleAddEmployeeToTemplate}
                          sidebarDragEmpId={dragEmpId}
                        />
                      );
                    })}
                    <div
                      aria-hidden="true"
                      style={{
                        flex: `0 0 ${TEMPLATE_ACTION_COLUMN_WIDTH}px`,
                        width: TEMPLATE_ACTION_COLUMN_WIDTH,
                        minWidth: TEMPLATE_ACTION_COLUMN_WIDTH,
                      }}
                    />
                  </div>
                )}
                <div
                  key="__template_add_employee__"
                  className="flex"
                  style={{ borderBottom: "1px solid var(--border)" }}
                >
                  <div
                    className="sticky left-0 flex-shrink-0 flex items-center px-3 py-2"
                    onDragOver={handleTemplateMemberDragOver}
                    onDrop={handleTemplateMemberDrop}
                    style={{
                      width: TEMPLATE_AREA_COLUMN_WIDTH,
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
                      {locale === "zh"
                        ? "从左侧拖入员工"
                        : "Drag employees from the left"}
                    </span>
                  </div>
                  {totalDaysList.map((day) => {
                    const dayIndex = day - 1;
                    return (
                      <TemplateEmployeeDayCell
                        key={day}
                        dayIndex={dayIndex}
                        rowKind="add-employee"
                        cells={[]}
                        areaNameMap={templateAreaNameMap}
                        activeEmployees={activeEmployees}
                        empNameMap={empNameMap}
                        empColorMap={empColorMap}
                        empAvatarMap={empAvatarMap}
                        defaultAreaId={defaultTemplateAreaId}
                        activeTemplateStore={activeTemplateStore}
                        locale={locale}
                        onAddEmployeeToTemplate={handleAddEmployeeToTemplate}
                        sidebarDragEmpId={dragEmpId}
                      />
                    );
                  })}
                  <div
                    aria-hidden="true"
                    style={{
                      flex: `0 0 ${TEMPLATE_ACTION_COLUMN_WIDTH}px`,
                      width: TEMPLATE_ACTION_COLUMN_WIDTH,
                      minWidth: TEMPLATE_ACTION_COLUMN_WIDTH,
                    }}
                  />
                </div>
              </>
            )}

            {gridViewMode === "area" && (
            <div
              className="flex items-center px-4 py-3"
              style={{
                borderBottom: "1px solid var(--border)",
                background: "var(--muted)",
              }}
            >
              <button
                onClick={() => {
                  setSelectedAreaId(selectableAreas[0]?.id || "");
                  setAddAreaOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-all"
                style={{
                  background: "var(--primary)",
                  color: "var(--primary-foreground)",
                }}
              >
                <Plus size={13} />
                {locale === "zh" ? "添加区域" : "Add Area"}
              </button>
            </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Add Area Modal ───────────────────────────────────────────────────── */}
      <EmployeeModal
        open={addEmployeeOpen}
        employee={null}
        stores={stores}
        defaultStoreIds={activeTemplateStoreId ? [activeTemplateStoreId] : []}
        onSave={handleAddEmployee}
        onCancel={() => setAddEmployeeOpen(false)}
        t={t}
        locale={locale}
      />

      <Modal
        title={locale === "zh" ? "添加区域" : "Add Area"}
        open={addAreaOpen}
        onCancel={() => {
          setAddAreaOpen(false);
          setSelectedAreaId("");
        }}
        onOk={handleAddArea}
        maskClosable={false}
        okText={locale === "zh" ? "添加" : "Add"}
        cancelText={locale === "zh" ? "取消" : "Cancel"}
        destroyOnHidden
        width={400}
      >
        <div className="py-3">
          <div
            className="text-sm mb-2"
            style={{ color: "var(--muted-foreground)" }}
          >
            {locale === "zh" ? "选择基础区域" : "Select Base Area"}
          </div>
          <Select
            value={selectedAreaId || undefined}
            onChange={setSelectedAreaId}
            style={{ width: "100%" }}
            placeholder={
              locale === "zh"
                ? "从区域管理中选择..."
                : "Choose from area management..."
            }
          >
            {selectableAreas.map((area) => (
              <Option key={area.id} value={area.id}>
                {area.name}
              </Option>
            ))}
          </Select>
          {selectableAreas.length === 0 && (
            <div
              className="text-xs mt-2"
              style={{ color: "var(--muted-foreground)" }}
            >
              {locale === "zh"
                ? "当前店面没有可加入的区域，请先到区域管理新增"
                : "No available areas for this store. Add them in Area Management first."}
            </div>
          )}
        </div>
      </Modal>

      {/* ── Cell Edit Modal (multi-employee) ────────────────────────────────── */}
      <Modal
        title={locale === "zh" ? "设置班次" : "Configure Shift"}
        open={cellModalOpen}
        onCancel={closeCellModal}
        onOk={handleSaveCell}
        maskClosable={false}
        okText={locale === "zh" ? "保存" : "Save"}
        cancelText={locale === "zh" ? "取消" : "Cancel"}
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
              {locale === "zh" ? "选择班次" : "Select Shift"}
            </div>
            <Select
              showSearch
              value={cellForm.presetKey || undefined}
              onChange={(value) => {
                const preset = modalShiftPresetOptions.find(
                  (option) => option.key === value,
                );
                if (!preset) {
                  setCellForm((form) => ({ ...form, presetKey: value }));
                  return;
                }

                setCellForm((form) => ({
                  ...form,
                  presetKey: preset.key,
                  shiftId: preset.shiftId || "",
                  label: preset.shiftName,
                  startTime: preset.startTime,
                  endTime: preset.endTime,
                  color: preset.color,
                }));
              }}
              placeholder={
                locale === "zh" ? "请选择班次" : "Please choose a shift"
              }
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
                {locale === "zh"
                  ? "暂无可选班次，请先到班次管理创建班次"
                  : "No shifts available yet. Create shifts in Shift Management first."}
              </div>
            )}
          </div>

          {cellModalMode === "employee" && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div
                    className="text-sm mb-1.5"
                    style={{ color: "var(--foreground)" }}
                  >
                    {locale === "zh" ? "星期" : "Day"}
                  </div>
                  <div
                    className="rounded-md px-3 py-2 text-sm"
                    style={{
                      background: "var(--muted)",
                      color: "var(--foreground)",
                    }}
                  >
                    {getDetailedDayLabel(editingDayIndex, locale)}
                  </div>
                </div>
                <div>
                  <div
                    className="text-sm mb-1.5"
                    style={{ color: "var(--foreground)" }}
                  >
                    {locale === "zh" ? "员工" : "Employee"}
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
                  {locale === "zh" ? "区域" : "Area"}
                </div>
                <Select
                  value={editingAreaId || undefined}
                  onChange={(value) => setEditingAreaId(value)}
                  placeholder={locale === "zh" ? "请选择区域" : "Select area"}
                  style={{ width: "100%" }}
                  options={templateAreas.map((area) => ({
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
                {locale === "zh" ? "开始时间" : "Start Time"}
              </div>
              <TimePicker
                disabled
                format="HH:mm"
                value={dayjs(cellForm.startTime, "HH:mm")}
                onChange={(v) =>
                  setCellForm((f) => ({
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
                {locale === "zh" ? "结束时间" : "End Time"}
              </div>
              <TimePicker
                disabled
                format="HH:mm"
                value={dayjs(cellForm.endTime, "HH:mm")}
                onChange={(v) =>
                  setCellForm((f) => ({
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
              {calcHours(cellForm.startTime, cellForm.endTime)}
              {locale === "zh" ? " 小时" : " hours"}
            </span>
          </div>

          {/* Color */}
          <div>
            <div
              className="text-sm mb-1.5"
              style={{ color: "var(--foreground)" }}
            >
              {locale === "zh" ? "颜色标识" : "Color"}
            </div>
            <ColorSwatchPicker
              value={cellForm.color}
              onChange={(color) => setCellForm((f) => ({ ...f, color }))}
              locale={locale}
            />
          </div>

          {/* Multi-employee assignment */}
          {cellModalMode !== "employee" && (
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <div className="text-sm" style={{ color: "var(--foreground)" }}>
                {locale === "zh"
                  ? "分配员工（支持多人）"
                  : "Assign Employees (multi-select)"}
              </div>
              <span
                className="text-xs rounded-md px-1.5 py-0.5"
                style={{
                  background: "var(--secondary)",
                  color: "var(--primary)",
                }}
              >
                {cellForm.employeeIds.length}{" "}
                {locale === "zh" ? "人" : "assigned"}
              </span>
            </div>
            <Select
              mode="multiple"
              value={cellForm.employeeIds}
              onChange={(v: string[]) =>
                setCellForm((f) => ({ ...f, employeeIds: v }))
              }
              placeholder={
                locale === "zh"
                  ? "选择员工（可多选）..."
                  : "Select employees..."
              }
              style={{ width: "100%" }}
              maxTagCount="responsive"
              tagRender={(props) => {
                const emp = activeEmployees.find(
                  (employee) => employee.id === props.value,
                );
                const warning = emp
                  ? getTemplateShiftAvailabilityWarning(
                      emp,
                      {
                        dayIndex: editingDayIndex,
                        startTime: cellForm.startTime,
                        endTime: cellForm.endTime,
                      },
                      locale,
                    )
                  : null;
                return (
                  <Tooltip title={warning || undefined}>
                    <Tag
                      closable={props.closable}
                      onClose={props.onClose}
                      style={{
                        marginInlineEnd: 4,
                        color: warning ? "var(--destructive)" : undefined,
                        borderColor: warning ? "var(--destructive)" : undefined,
                        fontWeight: warning ? 700 : undefined,
                      }}
                    >
                      {props.label}
                      {warning && (
                        <AlertTriangle
                          size={10}
                          style={{
                            display: "inline",
                            marginLeft: 4,
                            verticalAlign: -1,
                          }}
                        />
                      )}
                    </Tag>
                  </Tooltip>
                );
              }}
              optionRender={(option) => {
                const emp = activeEmployees.find((e) => e.id === option.value);
                if (!emp) return <span>{option.label}</span>;
                const warning = getTemplateShiftAvailabilityWarning(
                  emp,
                  {
                    dayIndex: editingDayIndex,
                    startTime: cellForm.startTime,
                    endTime: cellForm.endTime,
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
                <Option key={e.id} value={e.id}>
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
                {locale === "zh"
                  ? "保存时将检测员工工作时间是否完整覆盖班次（仅提醒），并检测同一员工时间冲突（含跨天班次，阻止保存）"
                  : "Save checks that employee work hours fully cover the shift (warning only) and that no employee has overlapping shifts, including overnight shifts (blocking)"}
              </span>
            </div>
          </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
