import { useState, useMemo } from "react";
import {
  Button,
  Input,
  Select,
  Tag,
  Avatar,
  Tabs,
  Form,
  DatePicker,
  InputNumber,
  Popconfirm,
  Modal,
  Tooltip,
} from "antd";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  User,
  Phone,
  Mail,
  CalendarDays,
  Building2,
  DollarSign,
  FileText,
  ChevronRight,
  BadgeCheck,
  Banknote,
  MapPin,
  Cake,
  ClipboardList,
  Briefcase,
  Clock,
  X,
  Check,
  Minus,
} from "lucide-react";
import dayjs from "dayjs";
import { useData, type Employee, type WorkDayPattern, type Area } from "../context/DataContext";
import { useLocale } from "../context/LocaleContext";
import { useStore } from "../context/StoreContext";
import { toast } from "sonner";
import WorkDaysCalendar from "../components/WorkDaysCalendar";

const { Option } = Select;

// ─── Color palette for employee color picker ───
const COLOR_PALETTE = [
  "#60a5fa", "#a78bfa", "#34d399", "#fb923c",
  "#f472b6", "#38bdf8", "#facc15", "#4ade80",
  "#f87171", "#c084fc",
];

const MOCK_POSITIONS = [
  { id: "pos1", name: "Cashier" },
  { id: "pos2", name: "Team Lead" },
  { id: "pos3", name: "Stock Controller" },
];

const defaultWorkDayPattern: WorkDayPattern[] = [
  { dayIndex: 0, state: "on", hours: 7.5 },
  { dayIndex: 1, state: "on", hours: 7.5 },
  { dayIndex: 2, state: "on", hours: 7.5 },
  { dayIndex: 3, state: "on", hours: 7.5 },
  { dayIndex: 4, state: "on", hours: 7.5 },
  { dayIndex: 5, state: "off", hours: 0 },
  { dayIndex: 6, state: "off", hours: 0 },
];

function getInitials(firstName = "", lastName = "") {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

// ─── WorkDayEditor component ───
function WorkDayEditor({
  value = defaultWorkDayPattern,
  onChange = () => {},
  weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
}: {
  value?: WorkDayPattern[];
  onChange?: (v: WorkDayPattern[]) => void;
  weekDays?: string[];
}) {
  const stateOrder: Array<"on" | "off" | "none"> = ["on", "off", "none"];

  const cycleState = (idx: number) => {
    const next = value.map((d) => {
      if (d.dayIndex !== idx) return d;
      const cur = stateOrder.indexOf(d.state);
      const nextState = stateOrder[(cur + 1) % stateOrder.length];
      return { ...d, state: nextState, hours: nextState === "on" ? 7.5 : 0 };
    });
    onChange(next);
  };

  const setHours = (idx: number, hours: number) => {
    onChange(value.map((d) => (d.dayIndex === idx ? { ...d, hours } : d)));
  };

  return (
    <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
      {value.map((day) => (
        <div
          key={day.dayIndex}
          className="flex flex-col items-center gap-1"
          style={{ minWidth: 52 }}
        >
          <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
            {weekDays[day.dayIndex]}
          </span>
          <button
            type="button"
            onClick={() => cycleState(day.dayIndex)}
            className="rounded-lg flex items-center justify-center text-xs font-semibold transition-all"
            style={{
              width: 44,
              height: 36,
              border: "1.5px solid var(--border)",
              background:
                day.state === "on"
                  ? "var(--primary)"
                  : day.state === "off"
                  ? "var(--muted)"
                  : "transparent",
              color:
                day.state === "on"
                  ? "var(--primary-foreground)"
                  : "var(--muted-foreground)",
            }}
          >
            {day.state === "on" ? (
              <Check size={14} />
            ) : day.state === "off" ? (
              <X size={14} />
            ) : (
              <Minus size={14} />
            )}
          </button>
          {day.state === "on" && (
            <InputNumber
              size="small"
              min={0}
              max={24}
              step={0.5}
              value={day.hours}
              onChange={(v) => setHours(day.dayIndex, v ?? 0)}
              style={{ width: 52, fontSize: 11 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── ColorDot picker ───
function ColorPicker({
  value = "#60a5fa",
  onChange = () => {},
}: {
  value?: string;
  onChange?: (c: string) => void;
}) {
  return (
    <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
      {COLOR_PALETTE.map((c) => (
        <Tooltip key={c} title={c}>
          <button
            type="button"
            onClick={() => onChange(c)}
            style={{
              width: 26,
              height: 26,
              borderRadius: "50%",
              border: value === c ? "3px solid var(--foreground)" : "2px solid var(--border)",
              background: c,
              cursor: "pointer",
              transition: "transform 0.15s",
              transform: value === c ? "scale(1.2)" : "scale(1)",
            }}
          />
        </Tooltip>
      ))}
    </div>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
      <span className="mt-0.5 flex-shrink-0" style={{ color: "var(--muted-foreground)" }}>{icon}</span>
      <span className="text-xs flex-shrink-0 w-36" style={{ color: "var(--muted-foreground)" }}>{label}</span>
      <span className="text-xs font-medium flex-1" style={{ color: "var(--foreground)" }}>{value || "-"}</span>
    </div>
  );
}

// ─── Employee form modal (Add/Edit) ───
export function EmployeeModal({
  open = false,
  employee = null,
  stores = [],
  areas = [],
  defaultStoreIds = [],
  onSave = () => {},
  onCancel = () => {},
  t,
}: {
  open?: boolean;
  employee?: Employee | null;
  stores?: { id: string; name: string }[];
  areas?: Area[];
  defaultStoreIds?: string[];
  onSave?: (emp: Employee) => void;
  onCancel?: () => void;
  t: ReturnType<typeof useLocale>["t"];
}) {
  const [form] = Form.useForm();
  const isEdit = !!employee;

  const handleOk = () => {
    form.validateFields().then((values) => {
      const saved: Employee = {
        id: employee?.id ?? `e${Date.now()}`,
        firstName: values.firstName ?? "",
        lastName: values.lastName ?? "",
        employeeId: values.employeeId ?? "",
        role: values.role ?? "staff",
        phone: values.phone ?? "",
        email: values.email ?? "",
        status: values.status ?? "active",
        startDate: values.startDate ? dayjs(values.startDate).format("YYYY-MM-DD") : "",
        storeIds: values.storeIds ?? [],
        assignedStores: values.storeIds ?? [],
        hourlyRate: values.hourlyRate ?? 0,
        notes: values.notes ?? "",
        avatar: employee?.avatar ?? "",
        employeeColor: values.employeeColor ?? "#60a5fa",
        address: values.address ?? "",
        dateOfBirth: values.dateOfBirth ? dayjs(values.dateOfBirth).format("YYYY-MM-DD") : "",
        irdNumber: values.irdNumber ?? "",
        taxCode: values.taxCode ?? "",
        kiwiSaverStatus: values.kiwiSaverStatus ?? "",
        employeeContributionRate: values.employeeContributionRate ?? "3%",
        employerContributionRate: values.employerContributionRate ?? "3",
        esctRate: values.esctRate ?? "",
        bankAccountNumber: values.bankAccountNumber ?? "",
        payrollEmployeeId: values.payrollEmployeeId ?? "",
        areaIds: values.areaIds ?? [],
        positionIds: values.positionIds ?? [],
        paidHoursPerDay: values.paidHoursPerDay ?? 8,
        workDayPattern: values.workDayPattern ?? defaultWorkDayPattern,
        contractType: values.contractType ?? "permanent",
        endDate: values.endDate ? dayjs(values.endDate).format("YYYY-MM-DD") : "",
        contractedHours: values.contractedHours ?? "",
        annualSalary: values.annualSalary ?? "",
        defaultHourlyRate: values.defaultHourlyRate ?? "",
      };
      onSave(saved);
    });
  };

  const initialValues = employee
    ? {
        ...employee,
        startDate: employee.startDate ? dayjs(employee.startDate) : undefined,
        dateOfBirth: employee.dateOfBirth ? dayjs(employee.dateOfBirth) : undefined,
        endDate: employee.endDate ? dayjs(employee.endDate) : undefined,
        workDayPattern: employee.workDayPattern ?? defaultWorkDayPattern,
      }
    : {
        status: "active",
        role: "staff",
        storeIds: defaultStoreIds,
        employeeColor: "#60a5fa",
        employeeContributionRate: "3%",
        employerContributionRate: "3",
        kiwiSaverStatus: "Enrolled",
        contractType: "permanent",
        workDayPattern: defaultWorkDayPattern,
        paidHoursPerDay: 8,
      };

  const et = t.employee as Record<string, unknown>;
  const storeNameMap: Record<string, string> = {};
  stores.forEach((store) => {
    storeNameMap[store.id] = store.name;
  });

  const tabItems = [
    {
      key: "general",
      label: et.tabGeneral as string,
      children: (
        <div className="flex flex-col gap-0">
          <div className="flex gap-4">
            <Form.Item name="firstName" label={et.firstName as string} rules={[{ required: true, message: t.required }]} style={{ flex: 1 }}>
              <Input prefix={<User size={13} />} />
            </Form.Item>
            <Form.Item name="lastName" label={et.lastName as string} rules={[{ required: true, message: t.required }]} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </div>
          <div className="flex gap-4">
            <Form.Item name="employeeId" label={et.employeeId as string} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="role" label={et.role as string} style={{ flex: 1 }}>
              <Select>
                {Object.entries(t.employee.roles).map(([k, v]) => (
                  <Option key={k} value={k}>{v}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          <div className="flex gap-4">
            <Form.Item name="phone" label={et.phone as string} style={{ flex: 1 }}>
              <Input prefix={<Phone size={13} />} />
            </Form.Item>
            <Form.Item name="email" label={et.email as string} rules={[{ type: "email", message: "Invalid email" }]} style={{ flex: 1 }}>
              <Input prefix={<Mail size={13} />} />
            </Form.Item>
          </div>
          <div className="flex gap-4">
            <Form.Item name="startDate" label={et.startDate as string} style={{ flex: 1 }}>
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="dateOfBirth" label={et.dateOfBirth as string} style={{ flex: 1 }}>
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <Form.Item name="address" label={et.address as string}>
            <Input prefix={<MapPin size={13} />} />
          </Form.Item>
          <div className="flex gap-4">
            <Form.Item name="status" label={et.status as string} style={{ flex: 1 }}>
              <Select>
                <Option value="active">{t.active}</Option>
                <Option value="inactive">{t.inactive}</Option>
              </Select>
            </Form.Item>
            <Form.Item name="storeIds" label={et.assignedStores as string} style={{ flex: 1 }}>
              <Select mode="multiple" placeholder={t.selectPlaceholder}>
                {stores.map((s) => (
                  <Option key={s.id} value={s.id}>{s.name}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="employeeColor" label={et.employeeColor as string}>
            <Form.Item name="employeeColor" noStyle>
              <ColorPicker />
            </Form.Item>
          </Form.Item>
          <Form.Item name="notes" label={et.notes as string}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </div>
      ),
    },
    {
      key: "payroll",
      label: et.tabPayroll as string,
      children: (
        <div className="flex flex-col gap-0">
          <div className="flex gap-4">
            <Form.Item name="irdNumber" label={et.irdNumber as string} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="taxCode" label={et.taxCode as string} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </div>
          <div className="flex gap-4">
            <Form.Item name="kiwiSaverStatus" label={et.kiwiSaverStatus as string} style={{ flex: 1 }}>
              <Select>
                <Option value="Enrolled">{(et.kiwiSaverOptions as Record<string, string>).enrolled}</Option>
                <Option value="Non-enrolled">{(et.kiwiSaverOptions as Record<string, string>).nonEnrolled}</Option>
                <Option value="Opted Out">{(et.kiwiSaverOptions as Record<string, string>).optedOut}</Option>
                <Option value="Exempt">{(et.kiwiSaverOptions as Record<string, string>).exempt}</Option>
              </Select>
            </Form.Item>
            <Form.Item name="employeeContributionRate" label={et.employeeContributionRate as string} style={{ flex: 1 }}>
              <Select>
                {["3%", "4%", "6%", "8%", "10%"].map((r) => (
                  <Option key={r} value={r}>{r}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          <div className="flex gap-4">
            <Form.Item name="employerContributionRate" label={et.employerContributionRate as string} style={{ flex: 1 }}>
              <InputNumber min={0} max={100} step={0.5} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="esctRate" label={et.esctRate as string} style={{ flex: 1 }}>
              <InputNumber min={0} max={100} step={0.5} style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <Form.Item name="bankAccountNumber" label={et.bankAccountNumber as string}>
            <Input prefix={<Banknote size={13} />} />
          </Form.Item>
          <Form.Item name="payrollEmployeeId" label={et.payrollEmployeeId as string}>
            <Input />
          </Form.Item>
          <div className="flex gap-4">
            <Form.Item name="hourlyRate" label={et.hourlyRate as string} style={{ flex: 1 }}>
              <InputNumber min={0} step={0.5} style={{ width: "100%" }} addonAfter={et.nzd as string} />
            </Form.Item>
          </div>
        </div>
      ),
    },
    {
      key: "assignments",
      label: et.tabAssignments as string,
      children: (
        <div className="flex flex-col gap-0">
          <Form.Item name="areaIds" label={et.areas as string}>
            <Select mode="multiple" placeholder={t.selectPlaceholder}>
              {areas.map((area) => (
                <Option key={area.id} value={area.id}>
                  {storeNameMap[area.storeId] ? `${storeNameMap[area.storeId]} / ${area.name}` : area.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="positionIds" label={et.positions as string}>
            <Select mode="multiple" placeholder={t.selectPlaceholder}>
              {MOCK_POSITIONS.map((p) => (
                <Option key={p.id} value={p.id}>{p.name}</Option>
              ))}
            </Select>
          </Form.Item>
        </div>
      ),
    },
    {
      key: "workdays",
      label: et.tabWorkDays as string,
      children: (
        <div className="flex flex-col gap-4">
          <Form.Item name="paidHoursPerDay" label={et.paidHoursPerDay as string}>
            <InputNumber min={0} max={24} step={0.5} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="workDayPattern" label={et.workDayPattern as string}>
            <WorkDayEditor weekDays={et.weekDays as string[]} />
          </Form.Item>
        </div>
      ),
    },
    {
      key: "employment",
      label: et.tabEmployment as string,
      children: (
        <div className="flex flex-col gap-0">
          <div className="flex gap-4">
            <Form.Item name="contractType" label={et.contractType as string} style={{ flex: 1 }}>
              <Select>
                {Object.entries((et.contractTypes as Record<string, string>)).map(([k, v]) => (
                  <Option key={k} value={k}>{v}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="endDate" label={et.endDate as string} style={{ flex: 1 }}>
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <div className="flex gap-4">
            <Form.Item name="contractedHours" label={et.contractedHours as string} style={{ flex: 1 }}>
              <InputNumber min={0} max={168} step={0.5} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="annualSalary" label={et.annualSalary as string} style={{ flex: 1 }}>
              <InputNumber min={0} step={1000} style={{ width: "100%" }} addonAfter="$" />
            </Form.Item>
          </div>
          <Form.Item name="defaultHourlyRate" label={et.defaultHourlyRate as string}>
            <InputNumber min={0} step={0.5} style={{ width: "100%" }} addonAfter={et.nzd as string} />
          </Form.Item>
        </div>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      title={isEdit ? et.editEmployee as string : et.addEmployee as string}
      onOk={handleOk}
      onCancel={onCancel}
      okText={t.save}
      cancelText={t.cancel}
      width={680}
      destroyOnClose
    >
      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        preserve={false}
        size="small"
      >
        <Tabs defaultActiveKey="general" items={tabItems} />
      </Form>
    </Modal>
  );
}

// ─── Detail Panel ───
function DetailPanel({
  employee,
  stores = [],
  areas = [],
  onEdit = () => {},
  onDelete = () => {},
  t,
}: {
  employee: Employee;
  stores?: { id: string; name: string }[];
  areas?: Area[];
  onEdit?: () => void;
  onDelete?: () => void;
  t: ReturnType<typeof useLocale>["t"];
}) {
  const et = t.employee as Record<string, unknown>;

  const assignedStoreNames = (employee.storeIds ?? [])
    .map((id) => stores.find((s) => s.id === id)?.name)
    .filter(Boolean) as string[];

  const areaNames = (employee.areaIds ?? [])
    .map((id) => areas.find((area) => area.id === id)?.name)
    .filter(Boolean) as string[];

  const positionNames = (employee.positionIds ?? [])
    .map((id) => MOCK_POSITIONS.find((p) => p.id === id)?.name)
    .filter(Boolean) as string[];

  const workDays = employee.workDayPattern ?? defaultWorkDayPattern;
  const weekDays = et.weekDays as string[];

  const roleLabel =
    (et.roles as Record<string, string>)[employee.role] ?? employee.role;

  const contractTypeLabel =
    employee.contractType
      ? ((et.contractTypes as Record<string, string>)[employee.contractType] ?? employee.contractType)
      : "-";

  const tabItems = [
    {
      key: "general",
      label: et.tabGeneral as string,
      children: (
        <div className="flex flex-col">
          <InfoRow icon={<User size={13} />} label={et.fullName as string} value={`${employee.firstName} ${employee.lastName}`} />
          <InfoRow icon={<BadgeCheck size={13} />} label={et.employeeId as string} value={employee.employeeId} />
          <InfoRow icon={<Briefcase size={13} />} label={et.role as string} value={roleLabel} />
          <InfoRow icon={<Phone size={13} />} label={et.phone as string} value={employee.phone} />
          <InfoRow icon={<Mail size={13} />} label={et.email as string} value={employee.email} />
          <InfoRow icon={<CalendarDays size={13} />} label={et.startDate as string} value={employee.startDate} />
          <InfoRow icon={<Cake size={13} />} label={et.dateOfBirth as string} value={employee.dateOfBirth ?? ""} />
          <InfoRow icon={<MapPin size={13} />} label={et.address as string} value={employee.address ?? ""} />
          <InfoRow
            icon={<Building2 size={13} />}
            label={et.assignedStores as string}
            value={
              assignedStoreNames.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {assignedStoreNames.map((name) => (
                    <Tag key={name} style={{ fontSize: 11, margin: 0 }}>{name}</Tag>
                  ))}
                </div>
              ) : "-"
            }
          />
          {employee.notes && (
            <InfoRow icon={<FileText size={13} />} label={et.notes as string} value={employee.notes} />
          )}
        </div>
      ),
    },
    {
      key: "payroll",
      label: et.tabPayroll as string,
      children: (
        <div className="flex flex-col">
          <InfoRow icon={<BadgeCheck size={13} />} label={et.irdNumber as string} value={employee.irdNumber ?? ""} />
          <InfoRow icon={<FileText size={13} />} label={et.taxCode as string} value={employee.taxCode ?? ""} />
          <InfoRow icon={<BadgeCheck size={13} />} label={et.kiwiSaverStatus as string} value={employee.kiwiSaverStatus ?? ""} />
          <InfoRow icon={<DollarSign size={13} />} label={et.employeeContributionRate as string} value={employee.employeeContributionRate ?? ""} />
          <InfoRow icon={<DollarSign size={13} />} label={et.employerContributionRate as string} value={employee.employerContributionRate ? `${employee.employerContributionRate}%` : ""} />
          <InfoRow icon={<DollarSign size={13} />} label={et.esctRate as string} value={employee.esctRate ? `${employee.esctRate}%` : ""} />
          <InfoRow icon={<Banknote size={13} />} label={et.bankAccountNumber as string} value={employee.bankAccountNumber ?? ""} />
          <InfoRow icon={<BadgeCheck size={13} />} label={et.payrollEmployeeId as string} value={employee.payrollEmployeeId ?? ""} />
          <InfoRow icon={<DollarSign size={13} />} label={et.hourlyRate as string} value={employee.hourlyRate ? `$${employee.hourlyRate} ${et.nzd as string}` : ""} />
        </div>
      ),
    },
    {
      key: "assignments",
      label: et.tabAssignments as string,
      children: (
        <div className="flex flex-col">
          <InfoRow
            icon={<MapPin size={13} />}
            label={et.areas as string}
            value={
              areaNames.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {areaNames.map((n) => <Tag key={n} style={{ fontSize: 11, margin: 0 }}>{n}</Tag>)}
                </div>
              ) : "-"
            }
          />
          <InfoRow
            icon={<ClipboardList size={13} />}
            label={et.positions as string}
            value={
              positionNames.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {positionNames.map((n) => <Tag key={n} color="blue" style={{ fontSize: 11, margin: 0 }}>{n}</Tag>)}
                </div>
              ) : "-"
            }
          />
        </div>
      ),
    },
    {
      key: "workdays",
      label: et.tabWorkDays as string,
      children: (
        <div className="flex flex-col gap-0" style={{ margin: "-8px -8px 0" }}>
          <WorkDaysCalendar
            workDayPattern={workDays}
            onPatternChange={(newPattern) => {
              console.log("[WorkDaysCalendar] pattern changed:", newPattern);
              // In view mode, show toast hint
              toast.info(`Work pattern updated. Click Edit to save changes.`);
            }}
          />
        </div>
      ),
    },
    {
      key: "employment",
      label: et.tabEmployment as string,
      children: (
        <div className="flex flex-col">
          <InfoRow icon={<FileText size={13} />} label={et.contractType as string} value={contractTypeLabel} />
          <InfoRow icon={<CalendarDays size={13} />} label={et.endDate as string} value={employee.endDate ?? ""} />
          <InfoRow icon={<Clock size={13} />} label={et.contractedHours as string} value={employee.contractedHours ? `${employee.contractedHours} hrs` : ""} />
          <InfoRow icon={<DollarSign size={13} />} label={et.annualSalary as string} value={employee.annualSalary ? `$${employee.annualSalary}` : ""} />
          <InfoRow icon={<DollarSign size={13} />} label={et.defaultHourlyRate as string} value={employee.defaultHourlyRate ? `$${employee.defaultHourlyRate} ${et.nzd as string}` : ""} />
        </div>
      ),
    },
  ];

  return (
    <div data-cmp="DetailPanel" className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-4 px-6 py-5"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--card)" }}
      >
        <Avatar
          size={56}
          style={{
            background: employee.employeeColor ?? "var(--primary)",
            fontSize: 20,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {getInitials(employee.firstName, employee.lastName)}
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base leading-tight truncate" style={{ color: "var(--foreground)" }}>
            {employee.firstName} {employee.lastName}
          </div>
          <div className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {(et.roles as Record<string, string>)[employee.role] ?? employee.role} · {employee.employeeId}
          </div>
          <div className="mt-1.5">
            <Tag
              color={employee.status === "active" ? "success" : "default"}
              style={{ fontSize: 11 }}
            >
              {employee.status === "active" ? t.active : t.inactive}
            </Tag>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            type="default"
            size="small"
            icon={<Pencil size={13} />}
            onClick={onEdit}
          >
            {t.edit}
          </Button>
          <Popconfirm
            title={t.deleteConfirm}
            description={t.deleteWarning}
            onConfirm={onDelete}
            okText={t.yes}
            cancelText={t.no}
          >
            <Button type="default" size="small" danger icon={<Trash2 size={13} />}>
              {t.delete}
            </Button>
          </Popconfirm>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-auto px-4 py-2">
        <Tabs defaultActiveKey="general" items={tabItems} size="small" />
      </div>
    </div>
  );
}

// ─── Main Employees Page ───
export default function Employees() {
  const { employees, setEmployees, stores, areas } = useData();
  const { t } = useLocale();
  const { selectedStoreId } = useStore();
  const et = t.employee as Record<string, unknown>;

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string>(employees[0]?.id ?? "");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  console.log("[Employees] selectedId:", selectedId, "total:", employees.length, "globalStore:", selectedStoreId);

  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        emp.employeeId.toLowerCase().includes(q);
      const matchStore = selectedStoreId === "all" || emp.storeIds.includes(selectedStoreId);
      const matchStatus = !filterStatus || emp.status === filterStatus;
      return matchSearch && matchStore && matchStatus;
    });
  }, [employees, search, selectedStoreId, filterStatus]);

  const selectedEmployee = employees.find((e) => e.id === selectedId) ?? filtered[0] ?? null;

  const handleAdd = () => {
    setEditingEmployee(null);
    setModalOpen(true);
  };

  const handleEdit = () => {
    if (!selectedEmployee) return;
    setEditingEmployee(selectedEmployee);
    setModalOpen(true);
  };

  const handleDelete = () => {
    if (!selectedEmployee) return;
    setEmployees((prev) => prev.filter((e) => e.id !== selectedEmployee.id));
    setSelectedId(filtered.find((e) => e.id !== selectedEmployee.id)?.id ?? "");
    toast.success(et.deleteSuccess as string);
  };

  const handleSave = (emp: Employee) => {
    if (editingEmployee) {
      setEmployees((prev) => prev.map((e) => (e.id === emp.id ? emp : e)));
    } else {
      setEmployees((prev) => [...prev, emp]);
      setSelectedId(emp.id);
    }
    setModalOpen(false);
    toast.success(et.saveSuccess as string);
  };

  return (
    <div data-cmp="Employees" className="flex flex-col h-full" style={{ minHeight: "calc(100vh - 112px)" }}>
      {/* ─── Top bar ─── */}
      <div
        className="flex items-center justify-between px-0 pb-4"
        style={{ flexShrink: 0 }}
      >
        <div className="flex items-center gap-2 flex-1">
          <Input
            prefix={<Search size={14} style={{ color: "var(--muted-foreground)" }} />}
            placeholder={et.searchPlaceholder as string}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            value={filterStatus || undefined}
            onChange={(v) => setFilterStatus(v ?? "")}
            placeholder={et.filterStatus as string}
            allowClear
            style={{ width: 140 }}
          >
            <Option value="active">{t.active}</Option>
            <Option value="inactive">{t.inactive}</Option>
          </Select>
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t.total} {filtered.length} {t.items}
          </span>
        </div>
        <Button
          type="primary"
          icon={<Plus size={14} />}
          onClick={handleAdd}
        >
          {et.addEmployee as string}
        </Button>
      </div>

      {/* ─── Body: left list + right detail ─── */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left list */}
        <div
          className="flex flex-col overflow-auto rounded-xl"
          style={{
            width: 280,
            flexShrink: 0,
            background: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow)",
          }}
        >
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center flex-1 text-sm" style={{ color: "var(--muted-foreground)", padding: 32 }}>
              {t.noData}
            </div>
          ) : (
            filtered.map((emp) => {
              const isActive = emp.id === selectedEmployee?.id;
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => setSelectedId(emp.id)}
                  className="flex items-center gap-3 px-4 py-3 text-left transition-all"
                  style={{
                    background: isActive ? "var(--muted)" : "transparent",
                    borderLeft: isActive ? `3px solid ${emp.employeeColor ?? "var(--primary)"}` : "3px solid transparent",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  <Avatar
                    size={38}
                    style={{
                      background: emp.employeeColor ?? "var(--primary)",
                      fontSize: 13,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(emp.firstName, emp.lastName)}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-semibold truncate"
                      style={{ color: "var(--foreground)" }}
                    >
                      {emp.firstName} {emp.lastName}
                    </div>
                    <div className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                      {(et.roles as Record<string, string>)[emp.role] ?? emp.role}
                    </div>
                    <div className="mt-0.5">
                      <Tag
                        color={emp.status === "active" ? "success" : "default"}
                        style={{ fontSize: 10, padding: "0 4px", lineHeight: "16px" }}
                      >
                        {emp.status === "active" ? t.active : t.inactive}
                      </Tag>
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
                </button>
              );
            })
          )}
        </div>

        {/* Right detail */}
        <div
          className="flex-1 overflow-hidden rounded-xl"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow)",
          }}
        >
          {selectedEmployee ? (
            <DetailPanel
              employee={selectedEmployee}
              stores={stores}
              areas={areas}
              onEdit={handleEdit}
              onDelete={handleDelete}
              t={t}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm" style={{ color: "var(--muted-foreground)" }}>
              {t.noData}
            </div>
          )}
        </div>
      </div>

      {/* ─── Add/Edit Modal ─── */}
      <EmployeeModal
        open={modalOpen}
        employee={editingEmployee}
        stores={stores}
        areas={areas}
        onSave={handleSave}
        onCancel={() => setModalOpen(false)}
        t={t}
      />
    </div>
  );
}
