import { useEffect, useMemo, useState } from "react";
import {
  Button,
  Input,
  Select,
  Modal,
  Form,
  Popconfirm,
  TimePicker,
  Avatar,
  Tabs,
  Switch,
} from "antd";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  MapPin,
  Users,
  Radio,
  ChevronRight,
  Building2,
  Phone,
  Mail,
  Clock,
  Globe,
  Hash,
  UserCircle,
  Crown,
  UserCheck,
} from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { useData, type CountryOption, type Employee, type Store, type StoreWeekdayHours } from "../context/DataContext";
import { merchantApi } from "../lib/merchantApi";
import { toast } from "sonner";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import GeoFenceMapPicker from "../components/GeoFenceMapPicker";

const { Option } = Select;

interface GeoFenceValue {
  latitude: number;
  longitude: number;
  geofenceRadius: number;
}

const FALLBACK_COUNTRIES: CountryOption[] = [
  { code: "nz", nameZh: "新西兰", nameEn: "New Zealand", dialCode: "64" },
  { code: "au", nameZh: "澳大利亚", nameEn: "Australia", dialCode: "61" },
];

function getCountryLabel(country: CountryOption, locale: string) {
  const name = locale === "zh" ? country.nameZh || country.nameEn : country.nameEn || country.nameZh;
  return name || country.code.toUpperCase();
}

function getCountrySearchName(code: string, countries: CountryOption[], locale: string) {
  const normalized = code.toLowerCase();
  const country = countries.find((item) => item.code.toLowerCase() === normalized);
  if (!country) return normalized ? normalized.toUpperCase() : "";
  return locale === "zh" ? country.nameZh || country.nameEn : country.nameEn || country.nameZh;
}

function getStoreCountryLabel(code: string, countries: CountryOption[], locale: string, fallbackLabels: Record<string, string>) {
  const normalized = code.toLowerCase();
  const country = countries.find((item) => item.code.toLowerCase() === normalized);
  if (country) return getCountryLabel(country, locale);
  return fallbackLabels[normalized] ?? normalized.toUpperCase();
}

function getStoreInitials(name = "") {
  return name.slice(0, 2).toUpperCase();
}

function getEmployeeFullName(employee?: Pick<Employee, "firstName" | "lastName"> | null) {
  return `${employee?.firstName || ""} ${employee?.lastName || ""}`.trim();
}

function getEmployeeDisplayName(employee?: Employee | null) {
  return getEmployeeFullName(employee) || employee?.employeeId || employee?.email || employee?.id || "";
}

function dedupeEmployeesById(items: Employee[]) {
  const byId = new Map<string, Employee>();
  items.forEach((item) => {
    if (!item.id || byId.has(item.id)) return;
    byId.set(item.id, item);
  });
  return Array.from(byId.values());
}

function employeeBelongsToStore(employee: Employee, storeId: string) {
  if (!storeId) return true;
  return (
    employee.storeIds.includes(storeId) ||
    (employee.assignedStores || []).includes(storeId) ||
    (employee.storeDetails || []).some((store) => store.id === storeId)
  );
}

function getEmployeeInitials(employee?: Pick<Employee, "firstName" | "lastName"> | { name?: string } | null) {
  if (!employee) return "";
  const nameParts = employee as Partial<Pick<Employee, "firstName" | "lastName">>;
  if (nameParts.firstName || nameParts.lastName) {
    const firstName = String(nameParts.firstName || "");
    const lastName = String(nameParts.lastName || "");
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  }
  return String((employee as { name?: string }).name || "").slice(0, 2).toUpperCase();
}

type StoreWeekdayHoursFormRow = {
  weekday: number;
  closed: boolean;
  openTime: Dayjs | null;
  closeTime: Dayjs | null;
};

const DEFAULT_OPEN_TIME = "09:00";
const DEFAULT_CLOSE_TIME = "22:00";
const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7];

function timeValue(value?: string | null) {
  return value ? dayjs(`2000-01-01 ${value}`, "YYYY-MM-DD HH:mm") : null;
}

function getStoreWeeklyHours(store?: Store | null): StoreWeekdayHours[] {
  if (store?.weeklyHours?.length) {
    const byWeekday = new Map(store.weeklyHours.map((item) => [item.weekday, item]));
    return WEEKDAYS.map((weekday) => {
      const item = byWeekday.get(weekday);
      return {
        weekday,
        closed: item?.closed ?? false,
        openTime: item?.openTime || store.openTime || DEFAULT_OPEN_TIME,
        closeTime: item?.closeTime || store.closeTime || DEFAULT_CLOSE_TIME,
      };
    });
  }

  return WEEKDAYS.map((weekday) => ({
    weekday,
    closed: false,
    openTime: store?.openTime || DEFAULT_OPEN_TIME,
    closeTime: store?.closeTime || DEFAULT_CLOSE_TIME,
  }));
}

function getWeeklyHoursFormRows(store?: Store | null): StoreWeekdayHoursFormRow[] {
  return getStoreWeeklyHours(store).map((item) => ({
    weekday: item.weekday,
    closed: item.closed === true,
    openTime: item.closed ? null : timeValue(item.openTime || DEFAULT_OPEN_TIME),
    closeTime: item.closed ? null : timeValue(item.closeTime || DEFAULT_CLOSE_TIME),
  }));
}

function getStoreFormInitialValues(store?: Store | null) {
  if (!store) {
    return {
      name: "",
      code: "",
      country: undefined,
      city: "",
      address: "",
      phone: "",
      email: "",
      manager: "",
      weeklyHours: getWeeklyHoursFormRows(),
      status: "enabled",
      managerId: undefined,
      assistantManagerIds: [],
    };
  }

  return {
    ...store,
    weeklyHours: getWeeklyHoursFormRows(store),
    status: store.status || "enabled",
    managerId: store.managerId || store.storeOfficers?.storeManager?.id || undefined,
    assistantManagerIds: store.assistantManagerIds?.length
      ? store.assistantManagerIds
      : (store.storeOfficers?.deputyManagers || []).map((item) => item.id),
  };
}

function serializeWeeklyHours(rows: StoreWeekdayHoursFormRow[] | undefined): StoreWeekdayHours[] {
  const byWeekday = new Map((rows || []).map((row, index) => [Number(row.weekday) || index + 1, row]));
  return WEEKDAYS.map((weekday) => {
    const row = byWeekday.get(weekday);
    const closed = row?.closed === true;
    return {
      weekday,
      closed,
      openTime: closed ? undefined : row?.openTime?.format("HH:mm") || DEFAULT_OPEN_TIME,
      closeTime: closed ? undefined : row?.closeTime?.format("HH:mm") || DEFAULT_CLOSE_TIME,
    };
  });
}

function getPrimaryBusinessHours(weeklyHours: StoreWeekdayHours[]) {
  const firstBusinessDay = weeklyHours.find((item) => !item.closed && item.openTime && item.closeTime);
  return {
    openTime: firstBusinessDay?.openTime || DEFAULT_OPEN_TIME,
    closeTime: firstBusinessDay?.closeTime || DEFAULT_CLOSE_TIME,
  };
}

function formatStoreWeeklyHours(store: Store, weekDayLabels: string[]) {
  return getStoreWeeklyHours(store)
    .filter((item) => !item.closed)
    .map((item) => {
      const dayLabel = weekDayLabels[item.weekday - 1] || `${item.weekday}`;
      const hours = `${item.openTime || DEFAULT_OPEN_TIME} - ${item.closeTime || DEFAULT_CLOSE_TIME}`;
      return `${dayLabel} ${hours}`;
    })
    .join("\n");
}

// ─── Store Form Modal ───
function StoreModal({
  open = false,
  store = null,
  employees = [],
  countries = FALLBACK_COUNTRIES,
  locked = false,
  onSave = () => {},
  onCancel = () => {},
  t,
  locale = "zh",
}: {
  open?: boolean;
  store?: Store | null;
  employees?: Employee[];
  countries?: CountryOption[];
  locked?: boolean;
  onSave?: (store: Store) => void | Promise<void>;
  onCancel?: () => void;
  t: ReturnType<typeof useLocale>["t"];
  locale?: string;
}) {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("basic");
  const [geofenceValue, setGeofenceValue] = useState<GeoFenceValue | null>(null);
  const [storeEmployees, setStoreEmployees] = useState<Employee[]>([]);
  const [storeEmployeesLoading, setStoreEmployeesLoading] = useState(false);
  const managerId = Form.useWatch("managerId", form) as string | undefined;
  const assistantManagerIds = (Form.useWatch("assistantManagerIds", form) as string[] | undefined) || [];
  const isEdit = !!store;
  const st = t.store;
  const countryOptions = countries.length > 0 ? countries : FALLBACK_COUNTRIES;
  const initialValues = useMemo(() => getStoreFormInitialValues(store), [store]);
  const staffStoreId = store?.id || "";
  const currentOfficerFallbacks = useMemo(() => {
    const officerItems = [
      store?.storeOfficers?.storeManager,
      ...(store?.storeOfficers?.deputyManagers || []),
    ];
    return officerItems.reduce<Employee[]>((items, officer) => {
      if (!officer?.id || items.some((item) => item.id === officer.id)) return items;
      items.push({
        id: officer.id,
        firstName: officer.name,
        lastName: "",
        employeeId: officer.id,
        role: "staff",
        phone: "",
        email: "",
        status: "active",
        startDate: "",
        storeIds: staffStoreId ? [staffStoreId] : [],
        hourlyRate: 0,
        notes: "",
      });
      return items;
    }, []);
  }, [staffStoreId, store]);
  const activeEmployees = useMemo(
    () => {
      const scopedEmployees = staffStoreId
        ? employees.filter((employee) => employeeBelongsToStore(employee, staffStoreId))
        : employees;
      const source = storeEmployees.length > 0 ? storeEmployees : scopedEmployees;
      return dedupeEmployeesById([...source, ...currentOfficerFallbacks])
        .filter((employee) => employee.status !== "inactive");
    },
    [currentOfficerFallbacks, employees, staffStoreId, storeEmployees]
  );

  useEffect(() => {
    if (!open) return;
    form.resetFields();
    form.setFieldsValue(initialValues);
    queueMicrotask(() => {
      setGeofenceValue(null);
      setActiveTab("basic");
      setStoreEmployees([]);
      setStoreEmployeesLoading(false);
    });
  }, [form, initialValues, open]);

  useEffect(() => {
    if (!open || activeTab !== "staff" || !staffStoreId) return;

    let cancelled = false;
    setStoreEmployeesLoading(true);
    merchantApi.listEmployeesByStore(staffStoreId, { status: "active", size: 200 })
      .then((items) => {
        if (cancelled) return;
        setStoreEmployees(items);
      })
      .catch((error) => {
        if (cancelled) return;
        console.warn("[StoreModal] failed to load store employees:", error);
        setStoreEmployees([]);
      })
      .finally(() => {
        if (!cancelled) setStoreEmployeesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTab, open, staffStoreId]);

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const weeklyHours = serializeWeeklyHours(values.weeklyHours);
      const primaryHours = getPrimaryBusinessHours(weeklyHours);
      const saved: Store = {
        id: store?.id || `s${Date.now()}`,
        name: values.name,
        code: values.code,
        address: values.address || "",
        city: values.city || "",
        country: values.country,
        phone: values.phone || "",
        email: values.email || "",
        manager: values.manager || "",
        openTime: primaryHours.openTime,
        closeTime: primaryHours.closeTime,
        weeklyHours,
        timezone: store?.timezone || "Pacific/Auckland",
        status: values.status || "enabled",
        managerId: values.managerId || undefined,
        assistantManagerIds: (values.assistantManagerIds || []).filter((id: string) => id && id !== values.managerId),
        storeOfficers: {
          storeManager: values.managerId
            ? {
                id: values.managerId,
                name: getEmployeeDisplayName(activeEmployees.find((employee) => employee.id === values.managerId)),
              }
            : null,
          deputyManagers: (values.assistantManagerIds || [])
            .filter((id: string) => id && id !== values.managerId)
            .map((id: string) => {
              const employee = activeEmployees.find((item) => item.id === id);
              return { id, name: getEmployeeDisplayName(employee) };
            }),
        },
        ...(geofenceValue
          ? {
              latitude: geofenceValue.latitude,
              longitude: geofenceValue.longitude,
              geofenceRadius: geofenceValue.geofenceRadius,
            }
          : isEdit && store?.latitude !== undefined
          ? {
              latitude: store.latitude,
              longitude: store.longitude,
              geofenceRadius: store.geofenceRadius,
            }
          : {}),
      };
      await onSave(saved);
      console.log("[StoreModal] saved store:", saved);
    } catch (err) {
      console.log("[StoreModal] validation error:", err);
    }
  };

  const watchedName = Form.useWatch("name", form) as string | undefined;
  const watchedAddress = Form.useWatch("address", form) as string | undefined;
  const watchedCity = Form.useWatch("city", form) as string | undefined;
  const watchedCountry = Form.useWatch("country", form) as string | undefined;
  const locationAddress = (watchedAddress ?? store?.address ?? "").trim();
  const locationCity = (watchedCity ?? store?.city ?? "").trim();
  const locationCountry = getCountrySearchName(
    (watchedCountry ?? store?.country ?? "").trim(),
    countryOptions,
    locale
  );
  const defaultLocationQuery = locationAddress
    ? [locationAddress, locationCity, locationCountry].filter(Boolean).join(", ")
    : locationCity
    ? [locationCity, locationCountry].filter(Boolean).join(", ")
    : "";

  const tabItems = [
    {
      key: "basic",
      label: st.tabBasic,
      children: (
        <Form form={form} layout="vertical" initialValues={initialValues} preserve={false} size="small" style={{ marginTop: 8 }}>
          <div className="flex gap-4">
            <Form.Item name="name" label={st.storeName} rules={[{ required: true, message: t.required }]} style={{ flex: 2 }}>
              <Input placeholder={locale === "zh" ? `例：Auckland CBD` : `e.g. Auckland CBD`} />
            </Form.Item>
            <Form.Item name="code" label={st.storeCode} rules={[{ required: true, message: t.required }]} style={{ flex: 1 }}>
              <Input placeholder="AKL01" />
            </Form.Item>
          </div>
          <div className="flex gap-4">
            <Form.Item name="country" label={st.country} rules={[{ required: true, message: t.required }]} style={{ flex: 1 }}>
              <Select placeholder={t.selectPlaceholder}>
                {countryOptions.map((country) => (
                  <Option key={country.code} value={country.code.toLowerCase()}>
                    {getCountryLabel(country, locale)}
                  </Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="city" label={st.city} style={{ flex: 1 }}>
              <Input placeholder={locale === "zh" ? `例：Auckland` : `e.g. Auckland`} />
            </Form.Item>
          </div>
          <Form.Item name="address" label={st.address}>
            <Input placeholder={locale === "zh" ? `街道地址` : `Street address`} />
          </Form.Item>
          <div className="flex gap-4">
            <Form.Item name="phone" label={st.phone} style={{ flex: 1 }}>
              <Input placeholder="+64 9 xxx xxxx" />
            </Form.Item>
            <Form.Item name="email" label={st.email} style={{ flex: 1 }}>
              <Input placeholder="store@example.com" />
            </Form.Item>
          </div>
          <Form.Item label={st.weeklyHours}>
            <Form.List name="weeklyHours">
              {(fields) => (
                <div className="flex flex-col gap-2">
                  {fields.map((field) => (
                    <WeeklyHoursRow
                      key={field.key}
                      fieldName={field.name}
                      st={st}
                      weekDayLabel={st.weekDays[field.name] || `${field.name + 1}`}
                      form={form}
                    />
                  ))}
                </div>
              )}
            </Form.List>
          </Form.Item>
          <div className="flex gap-4">
            <Form.Item name="manager" label={st.manager} style={{ flex: 1 }}>
              <Input placeholder={locale === "zh" ? `负责人姓名` : `Manager name`} />
            </Form.Item>
            <Form.Item name="status" label={st.status} style={{ flex: 1 }}>
              <Select>
                <Option value="enabled">{t.enabled}</Option>
                <Option value="disabled">{t.disabled}</Option>
              </Select>
            </Form.Item>
          </div>
        </Form>
      ),
    },
    {
      key: "geofence",
      label: st.tabGeofence,
      children: (
        <div style={{ marginTop: 8 }}>
          <GeoFenceMapPicker
            value={
              geofenceValue
                ? geofenceValue
                : store?.latitude !== undefined
                ? {
                    latitude: store.latitude,
                    longitude: store.longitude ?? 174.7633,
                    geofenceRadius: store.geofenceRadius ?? 200,
                  }
                : undefined
            }
            onChange={(val) => {
              setGeofenceValue(val);
              console.log("[StoreModal] geofence updated:", val);
            }}
            storeName={watchedName || store?.name || ""}
            defaultLocationQuery={defaultLocationQuery}
          />
        </div>
      ),
    },
    {
      key: "staff",
      label: st.tabStaff,
      children: (
        <Form form={form} layout="vertical" initialValues={initialValues} preserve={false} size="small" style={{ marginTop: 8 }}>
          <div className="flex flex-col gap-4">
            <div
              className="rounded-md px-4 py-3 text-xs"
              style={{
                background: "var(--muted)",
                border: "1px solid var(--border)",
                color: "var(--muted-foreground)",
              }}
            >
              {st.staffSectionDesc}
            </div>
            <Form.Item name="managerId" label={st.staffManager}>
              <Select
                placeholder={st.staffManagerPlaceholder}
                allowClear
                showSearch
                loading={storeEmployeesLoading}
                notFoundContent={storeEmployeesLoading ? t.loading : t.noData}
                optionFilterProp="label"
                onChange={(value) => {
                  if (!value) return;
                  const nextAssistantIds = ((form.getFieldValue("assistantManagerIds") as string[] | undefined) || [])
                    .filter((id) => id !== value);
                  form.setFieldValue("assistantManagerIds", nextAssistantIds);
                }}
              >
                {activeEmployees.map((employee) => {
                  const label = getEmployeeDisplayName(employee);
                  return (
                    <Option
                      key={employee.id}
                      value={employee.id}
                      label={`${label} ${employee.employeeId} ${employee.email}`}
                      disabled={assistantManagerIds.includes(employee.id)}
                    >
                      {label}
                      {employee.employeeId ? (
                        <span style={{ color: "var(--muted-foreground)" }}> · {employee.employeeId}</span>
                      ) : null}
                    </Option>
                  );
                })}
              </Select>
            </Form.Item>
            <Form.Item name="assistantManagerIds" label={st.staffAssistantManagers}>
              <Select
                mode="multiple"
                placeholder={st.staffAssistantManagersPlaceholder}
                allowClear
                showSearch
                loading={storeEmployeesLoading}
                notFoundContent={storeEmployeesLoading ? t.loading : t.noData}
                optionFilterProp="label"
              >
                {activeEmployees.map((employee) => {
                  const label = getEmployeeDisplayName(employee);
                  return (
                    <Option
                      key={employee.id}
                      value={employee.id}
                      label={`${label} ${employee.employeeId} ${employee.email}`}
                      disabled={managerId === employee.id}
                    >
                      {label}
                      {employee.employeeId ? (
                        <span style={{ color: "var(--muted-foreground)" }}> · {employee.employeeId}</span>
                      ) : null}
                    </Option>
                  );
                })}
              </Select>
            </Form.Item>
          </div>
        </Form>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      title={isEdit ? st.editStore : st.addStore}
      onOk={handleOk}
      onCancel={locked ? undefined : onCancel}
      maskClosable={false}
      okText={t.save}
      cancelText={t.cancel}
      width={700}
      destroyOnClose
      keyboard={!locked}
      closable={!locked}
      cancelButtonProps={{ style: { display: locked ? "none" : undefined } }}
      styles={{ body: { padding: "12px 24px 0" } }}
    >
      {locked && (
        <div
          className="mb-3 rounded-lg px-4 py-3 text-sm"
          style={{
            background: "var(--accent)",
            border: "1px solid var(--border)",
            color: "var(--muted-foreground)",
          }}
        >
          <div className="font-semibold mb-1" style={{ color: "var(--accent-foreground)" }}>
            {st.firstStoreTitle}
          </div>
          <div>{st.firstStoreDesc}</div>
        </div>
      )}
      <Tabs
        activeKey={activeTab}
        onChange={(k) => { setActiveTab(k); }}
        items={tabItems}
        style={{ minHeight: 480 }}
      />
    </Modal>
  );
}

function WeeklyHoursRow({
  fieldName,
  weekDayLabel,
  st,
  form,
}: {
  fieldName: number;
  weekDayLabel: string;
  st: ReturnType<typeof useLocale>["t"]["store"];
  form: ReturnType<typeof Form.useForm>[0];
}) {
  const closed = Form.useWatch(["weeklyHours", fieldName, "closed"], form) === true;

  return (
    <div
      className="grid items-center gap-3 rounded-md px-3 py-2"
      style={{
        gridTemplateColumns: "72px 96px 1fr 1fr",
        background: "var(--muted)",
        border: "1px solid var(--border)",
      }}
    >
      <Form.Item name={[fieldName, "weekday"]} hidden>
        <Input />
      </Form.Item>
      <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
        {weekDayLabel}
      </div>
      <Switch
        size="small"
        checked={!closed}
        checkedChildren={st.openStatus}
        unCheckedChildren={st.closedStatus}
        onChange={(checked) => {
          form.setFieldValue(["weeklyHours", fieldName, "closed"], !checked);
        }}
      />
      <Form.Item
        name={[fieldName, "openTime"]}
        style={{ marginBottom: 0 }}
        rules={[{ required: !closed, message: st.openTimeRequired }]}
      >
        <TimePicker
          disabled={closed}
          format="HH:mm"
          placeholder={st.openTime}
          style={{ width: "100%" }}
        />
      </Form.Item>
      <Form.Item
        name={[fieldName, "closeTime"]}
        style={{ marginBottom: 0 }}
        rules={[{ required: !closed, message: st.closeTimeRequired }]}
      >
        <TimePicker
          disabled={closed}
          format="HH:mm"
          placeholder={st.closeTime}
          style={{ width: "100%" }}
        />
      </Form.Item>
    </div>
  );
}

function StoreInfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 py-2" style={{ borderBottom: `1px solid var(--border)` }}>
      <span className="mt-0.5 flex-shrink-0" style={{ color: "var(--muted-foreground)" }}>{icon}</span>
      <span className="text-xs flex-shrink-0 w-36" style={{ color: "var(--muted-foreground)" }}>{label}</span>
      <span className="text-xs font-medium flex-1" style={{ color: "var(--foreground)" }}>{value || "-"}</span>
    </div>
  );
}

function StoreStaffRow({
  employee,
  fallback,
}: {
  employee?: Employee;
  fallback?: { id: string; name: string } | null;
}) {
  const displayName = employee ? getEmployeeFullName(employee) : fallback?.name || "";
  const employeeCode = employee?.employeeId || fallback?.id || "";
  return (
    <div className="flex items-center gap-3 py-2" style={{ borderBottom: `1px solid var(--border)` }}>
      <Avatar
        size={32}
        style={{
          background: employee?.employeeColor || "var(--secondary)",
          color: "var(--primary)",
          fontSize: 12,
          fontWeight: 700,
          flexShrink: 0,
        }}
      >
        {getEmployeeInitials(employee || fallback)}
      </Avatar>
      <div className="flex-1 min-w-0">
        <div className="text-xs font-medium truncate" style={{ color: "var(--foreground)" }}>
          {displayName || "-"}
        </div>
        <div className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
          {employeeCode}
        </div>
      </div>
    </div>
  );
}

// ─── Detail Panel ───
function StoreDetailPanel({
  store,
  employeeCount = 0,
  employees = [],
  onEdit = () => {},
  onDelete = () => {},
  t,
  countries = FALLBACK_COUNTRIES,
  locale = "zh",
}: {
  store: Store;
  employeeCount?: number;
  employees?: Employee[];
  onEdit?: () => void;
  onDelete?: () => void;
  t: ReturnType<typeof useLocale>["t"];
  countries?: CountryOption[];
  locale?: string;
}) {
  const st = t.store;
  const weeklyHoursText = formatStoreWeeklyHours(store, st.weekDays);
  const hasGeofence =
    store.latitude !== undefined &&
    store.longitude !== undefined &&
    store.geofenceRadius !== undefined;
  const managerId = store.managerId || store.storeOfficers?.storeManager?.id || "";
  const assistantManagerIds = store.assistantManagerIds?.length
    ? store.assistantManagerIds
    : (store.storeOfficers?.deputyManagers || []).map((item) => item.id);
  const managerEmployee = employees.find((employee) => employee.id === managerId);
  const managerFallback = store.storeOfficers?.storeManager;
  const assistantEmployees = assistantManagerIds.map((id) => ({
    id,
    employee: employees.find((item) => item.id === id),
    fallback: store.storeOfficers?.deputyManagers?.find((item) => item.id === id),
  }));

  const tabItems = [
    {
      key: "info",
      label: st.tabBasic,
      children: (
        <div className="flex flex-col">
          <StoreInfoRow icon={<Hash size={13} />} label={st.storeCode} value={store.code} />
          <StoreInfoRow
            icon={<Globe size={13} />}
            label={st.country}
            value={getStoreCountryLabel(store.country, countries, locale, st.countries)}
          />
          <StoreInfoRow icon={<MapPin size={13} />} label={st.city} value={store.city} />
          <StoreInfoRow icon={<Building2 size={13} />} label={st.address} value={store.address} />
          <StoreInfoRow icon={<Phone size={13} />} label={st.phone} value={store.phone} />
          <StoreInfoRow icon={<Mail size={13} />} label={st.email} value={store.email} />
          <StoreInfoRow icon={<UserCircle size={13} />} label={st.manager} value={store.manager} />
          <StoreInfoRow
            icon={<Clock size={13} />}
            label={st.weeklyHours}
            value={
              <span style={{ whiteSpace: "pre-line" }}>
                {weeklyHoursText || "-"}
              </span>
            }
          />
          <StoreInfoRow
            icon={<Users size={13} />}
            label={st.employeeCount}
            value={`${employeeCount}`}
          />
        </div>
      ),
    },
    {
      key: "geofence",
      label: st.tabGeofence,
      children: (
        <div className="flex flex-col gap-3 py-2">
          {hasGeofence ? (
            <>
              <div className="flex items-center gap-2">
                <Radio size={14} style={{ color: "var(--primary)" }} />
                <span className="text-sm font-medium" style={{ color: "var(--primary)" }}>
                  {st.geofenceSet}
                </span>
              </div>
              <StoreInfoRow icon={<MapPin size={13} />} label={st.geofenceLat} value={`${store.latitude}`} />
              <StoreInfoRow icon={<MapPin size={13} />} label={st.geofenceLng} value={`${store.longitude}`} />
              <StoreInfoRow icon={<Radio size={13} />} label={st.geofenceRadius} value={`${store.geofenceRadius} m`} />
            </>
          ) : (
            <div className="flex items-center gap-2 py-4" style={{ color: "var(--muted-foreground)" }}>
              <Radio size={14} />
              <span className="text-sm">{st.geofenceNotSet}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: "staff",
      label: st.tabStaff,
      children: (
        <div className="flex flex-col gap-4 py-2">
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <Crown size={13} style={{ color: "var(--primary)" }} />
              <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                {st.staffManager}
              </span>
            </div>
            {managerEmployee || managerFallback ? (
              <StoreStaffRow employee={managerEmployee} fallback={managerFallback} />
            ) : (
              <div className="text-xs py-2" style={{ color: "var(--muted-foreground)" }}>
                {st.staffNone}
              </div>
            )}
          </div>
          <div>
            <div className="flex items-center gap-1.5 mb-2">
              <UserCheck size={13} style={{ color: "var(--primary)" }} />
              <span className="text-xs font-semibold" style={{ color: "var(--foreground)" }}>
                {st.staffAssistantManagers}
              </span>
            </div>
            {assistantEmployees.length > 0 ? (
              assistantEmployees.map((item) => (
                <StoreStaffRow
                  key={item.id}
                  employee={item.employee}
                  fallback={item.fallback}
                />
              ))
            ) : (
              <div className="text-xs py-2" style={{ color: "var(--muted-foreground)" }}>
                {st.staffNone}
              </div>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div data-cmp="StoreDetailPanel" className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-4 px-6 py-5"
        style={{ borderBottom: `1px solid var(--border)`, background: "var(--card)" }}
      >
        <Avatar
          size={56}
          style={{
            background: "var(--secondary)",
            color: "var(--primary)",
            fontSize: 20,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {getStoreInitials(store.name)}
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base leading-tight truncate" style={{ color: "var(--foreground)" }}>
            {store.name}
          </div>
          <div className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {store.code} · {store.city}
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
        <Tabs defaultActiveKey="info" items={tabItems} size="small" />
      </div>
    </div>
  );
}

// ─── Main Stores Page ───
export default function Stores() {
  const { t, locale } = useLocale();
  const { stores, storesLoaded, saveStore, deleteStore, employees, countries } = useData();
  const st = t.store;
  const countryOptions = countries.length > 0 ? countries : FALLBACK_COUNTRIES;
  const requiresFirstStore = storesLoaded && stores.length === 0;

  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("all");
  const [selectedId, setSelectedId] = useState<string>(stores[0]?.id ?? "");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);

  console.log("[Stores] selectedId:", selectedId, "total:", stores.length);

  useEffect(() => {
    if (!requiresFirstStore) return;
    queueMicrotask(() => {
      setEditingStore(null);
      setModalOpen(true);
    });
  }, [requiresFirstStore]);

  const filtered = useMemo(() => {
    return stores.filter((s) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q);
      const matchCountry = filterCountry === "all" || s.country === filterCountry;
      return matchSearch && matchCountry;
    });
  }, [stores, search, filterCountry]);

  const selectedStore = stores.find((s) => s.id === selectedId) ?? filtered[0] ?? null;

  const getEmployeeCount = (storeId: string) =>
    employees.filter((e) => e.storeIds.includes(storeId) && e.status === "active").length;

  const handleAdd = () => {
    setEditingStore(null);
    setModalOpen(true);
  };

  const handleEdit = () => {
    if (!selectedStore) return;
    setEditingStore(selectedStore);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedStore) return;
    try {
      await deleteStore(selectedStore.id);
      setSelectedId(filtered.find((s) => s.id !== selectedStore.id)?.id ?? "");
      toast.success(st.deleteSuccess);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  };

  const handleSave = async (store: Store) => {
    try {
      const saved = await saveStore(store, editingStore?.id);
      setSelectedId(saved.id);
      setModalOpen(false);
      toast.success(st.saveSuccess);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    }
  };

  return (
    <div data-cmp="Stores" className="flex flex-col h-full" style={{ minHeight: "calc(100vh - 112px)" }}>
      {/* ─── Top bar ─── */}
      <div
        className="flex items-center justify-between px-0 pb-4"
        style={{ flexShrink: 0 }}
      >
        <div className="flex items-center gap-2 flex-1">
          <Input
            prefix={<Search size={14} style={{ color: "var(--muted-foreground)" }} />}
            placeholder={st.searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            value={filterCountry}
            onChange={(v) => setFilterCountry(v ?? "all")}
            style={{ width: 160 }}
          >
            <Option value="all">{st.allCountries}</Option>
            {countryOptions.map((country) => (
              <Option key={country.code} value={country.code.toLowerCase()}>
                {getCountryLabel(country, locale)}
              </Option>
            ))}
          </Select>
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t.total} {filtered.length} {t.items}
          </span>
        </div>
        <Button
          type="primary"
          icon={<Plus size={14} />}
          onClick={handleAdd}
          disabled={requiresFirstStore && modalOpen}
        >
          {st.addStore}
        </Button>
      </div>

      {requiresFirstStore && (
        <div
          className="mb-4 rounded-xl px-5 py-4"
          style={{
            background: "var(--accent)",
            border: "1px solid var(--border)",
            color: "var(--muted-foreground)",
          }}
        >
          <div className="font-semibold text-sm mb-1" style={{ color: "var(--accent-foreground)" }}>
            {st.firstStoreTitle}
          </div>
          <div className="text-sm">{st.firstStoreDesc}</div>
        </div>
      )}

      {/* ─── Body: left list + right detail ─── */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left list */}
        <div
          className="flex flex-col overflow-auto rounded-xl"
          style={{
            width: 280,
            flexShrink: 0,
            background: "var(--card)",
            border: `1px solid var(--border)`,
            boxShadow: "var(--shadow)",
          }}
        >
          {filtered.length === 0 ? (
            <div
              className="flex items-center justify-center flex-1 text-sm"
              style={{ color: "var(--muted-foreground)", padding: 32 }}
            >
              {t.noData}
            </div>
          ) : (
            filtered.map((store) => {
              const isActive = store.id === selectedStore?.id;
              const empCount = getEmployeeCount(store.id);
              return (
                <button
                  key={store.id}
                  type="button"
                  onClick={() => setSelectedId(store.id)}
                  className="flex items-center gap-3 px-4 py-3 text-left transition-all"
                  style={{
                    background: isActive ? "var(--muted)" : "transparent",
                    borderLeft: isActive ? `3px solid var(--primary)` : "3px solid transparent",
                    borderBottom: `1px solid var(--border)`,
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  <Avatar
                    size={38}
                    style={{
                      background: "var(--secondary)",
                      color: "var(--primary)",
                      fontSize: 13,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {getStoreInitials(store.name)}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-semibold truncate"
                      style={{ color: "var(--foreground)" }}
                    >
                      {store.name}
                    </div>
                    <div className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                      {store.city} · {store.code}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs flex items-center gap-0.5" style={{ color: "var(--muted-foreground)" }}>
                        <Users size={10} />
                        {empCount}
                      </span>
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
            border: `1px solid var(--border)`,
            boxShadow: "var(--shadow)",
          }}
        >
          {selectedStore ? (
            <StoreDetailPanel
              store={selectedStore}
              employeeCount={getEmployeeCount(selectedStore.id)}
              employees={employees}
              onEdit={handleEdit}
              onDelete={handleDelete}
              t={t}
              countries={countryOptions}
              locale={locale}
            />
          ) : (
            <div
              className="flex items-center justify-center h-full text-sm"
              style={{ color: "var(--muted-foreground)" }}
            >
              {t.noData}
            </div>
          )}
        </div>
      </div>

      {/* ─── Add/Edit Modal ─── */}
      <StoreModal
        open={modalOpen}
        store={editingStore}
        employees={employees}
        countries={countryOptions}
        locked={requiresFirstStore}
        onSave={handleSave}
        onCancel={() => {
          if (requiresFirstStore) return;
          setModalOpen(false);
        }}
        t={t}
        locale={locale}
      />
    </div>
  );
}
