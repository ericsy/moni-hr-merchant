import { useState, useMemo } from "react";
import {
  Button,
  Input,
  Select,
  Tag,
  Modal,
  Form,
  Popconfirm,
  TimePicker,
  Avatar,
  Tabs,
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
} from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { useData, type Store } from "../context/DataContext";
import { toast } from "sonner";
import dayjs from "dayjs";
import GeoFenceMapPicker from "../components/GeoFenceMapPicker";

const { Option } = Select;

interface GeoFenceValue {
  latitude: number;
  longitude: number;
  geofenceRadius: number;
}

const TIMEZONE_OPTIONS = [
  { value: "Pacific/Auckland", label: "Pacific/Auckland (NZT)" },
  { value: "Australia/Sydney", label: "Australia/Sydney (AEST)" },
  { value: "Australia/Melbourne", label: "Australia/Melbourne (AEST)" },
  { value: "Australia/Brisbane", label: "Australia/Brisbane (AEST)" },
  { value: "Australia/Perth", label: "Australia/Perth (AWST)" },
  { value: "Australia/Adelaide", label: "Australia/Adelaide (ACST)" },
];

const COUNTRY_FLAGS: Record<string, string> = { nz: "🇳🇿", au: "🇦🇺" };

function getStoreInitials(name = "") {
  return name.slice(0, 2).toUpperCase();
}

// ─── Store Form Modal ───
function StoreModal({
  open = false,
  store = null,
  employees = [],
  onSave = () => {},
  onCancel = () => {},
  t,
  locale = "zh",
}: {
  open?: boolean;
  store?: Store | null;
  employees?: { storeIds: string[] }[];
  onSave?: (store: Store) => void | Promise<void>;
  onCancel?: () => void;
  t: ReturnType<typeof useLocale>["t"];
  locale?: string;
}) {
  const [form] = Form.useForm();
  const [activeTab, setActiveTab] = useState("basic");
  const [geofenceValue, setGeofenceValue] = useState<GeoFenceValue | null>(null);
  const isEdit = !!store;
  const st = t.store;

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
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
        openTime: values.openTime ? values.openTime.format("HH:mm") : "09:00",
        closeTime: values.closeTime ? values.closeTime.format("HH:mm") : "22:00",
        timezone: values.timezone,
        status: values.status,
        ...(geofenceValue
          ? {
              latitude: geofenceValue.latitude,
              longitude: geofenceValue.longitude,
              geofenceRadius: geofenceValue.geofenceRadius,
            }
          : store?.latitude !== undefined
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

  const initialValues = store
    ? {
        ...store,
        openTime: store.openTime ? dayjs(store.openTime, "HH:mm") : null,
        closeTime: store.closeTime ? dayjs(store.closeTime, "HH:mm") : null,
      }
    : { status: "enabled" };

  const storeName = form.getFieldValue("name") as string | undefined;

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
                <Option value="nz">🇳🇿 {st.countries.nz}</Option>
                <Option value="au">🇦🇺 {st.countries.au}</Option>
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
          <div className="flex gap-4">
            <Form.Item name="openTime" label={st.openTime} style={{ flex: 1 }}>
              <TimePicker format="HH:mm" style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="closeTime" label={st.closeTime} style={{ flex: 1 }}>
              <TimePicker format="HH:mm" style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <div className="flex gap-4">
            <Form.Item name="timezone" label={st.timezone} rules={[{ required: true, message: t.required }]} style={{ flex: 1 }}>
              <Select placeholder={t.selectPlaceholder}>
                {TIMEZONE_OPTIONS.map((tz) => (
                  <Option key={tz.value} value={tz.value}>{tz.label}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="manager" label={st.manager} style={{ flex: 1 }}>
              <Input placeholder={locale === "zh" ? `负责人姓名` : `Manager name`} />
            </Form.Item>
          </div>
          <Form.Item name="status" label={t.status} rules={[{ required: true }]} initialValue="enabled">
            <Select>
              <Option value="enabled">{t.enabled}</Option>
              <Option value="disabled">{t.disabled}</Option>
            </Select>
          </Form.Item>
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
            storeName={storeName || store?.name || ""}
          />
        </div>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      title={isEdit ? st.editStore : st.addStore}
      onOk={handleOk}
      onCancel={onCancel}
      okText={t.save}
      cancelText={t.cancel}
      width={700}
      destroyOnClose
      styles={{ body: { padding: "12px 24px 0" } }}
    >
      <Tabs
        activeKey={activeTab}
        onChange={(k) => { setActiveTab(k); }}
        items={tabItems}
        style={{ minHeight: 480 }}
      />
    </Modal>
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

// ─── Detail Panel ───
function StoreDetailPanel({
  store,
  employeeCount = 0,
  onEdit = () => {},
  onDelete = () => {},
  t,
}: {
  store: Store;
  employeeCount?: number;
  onEdit?: () => void;
  onDelete?: () => void;
  t: ReturnType<typeof useLocale>["t"];
}) {
  const st = t.store;
  const hasGeofence =
    store.latitude !== undefined &&
    store.longitude !== undefined &&
    store.geofenceRadius !== undefined;

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
            value={`${COUNTRY_FLAGS[store.country] ?? ""} ${st.countries[store.country as "nz" | "au"] ?? store.country}`}
          />
          <StoreInfoRow icon={<MapPin size={13} />} label={st.city} value={store.city} />
          <StoreInfoRow icon={<Building2 size={13} />} label={st.address} value={store.address} />
          <StoreInfoRow icon={<Phone size={13} />} label={st.phone} value={store.phone} />
          <StoreInfoRow icon={<Mail size={13} />} label={st.email} value={store.email} />
          <StoreInfoRow icon={<UserCircle size={13} />} label={st.manager} value={store.manager} />
          <StoreInfoRow
            icon={<Clock size={13} />}
            label={`${st.openTime} / ${st.closeTime}`}
            value={`${store.openTime} – ${store.closeTime}`}
          />
          <StoreInfoRow icon={<Globe size={13} />} label={st.timezone} value={store.timezone} />
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
          <div className="mt-1.5">
            <Tag
              color={store.status === "enabled" ? "success" : "default"}
              style={{ fontSize: 11 }}
            >
              {store.status === "enabled" ? t.enabled : t.disabled}
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
        <Tabs defaultActiveKey="info" items={tabItems} size="small" />
      </div>
    </div>
  );
}

// ─── Main Stores Page ───
export default function Stores() {
  const { t, locale } = useLocale();
  const { stores, saveStore, deleteStore, employees } = useData();
  const st = t.store;

  const [search, setSearch] = useState("");
  const [filterCountry, setFilterCountry] = useState("all");
  const [selectedId, setSelectedId] = useState<string>(stores[0]?.id ?? "");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStore, setEditingStore] = useState<Store | null>(null);

  console.log("[Stores] selectedId:", selectedId, "total:", stores.length);

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
            <Option value="nz">🇳🇿 {st.countries.nz}</Option>
            <Option value="au">🇦🇺 {st.countries.au}</Option>
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
          {st.addStore}
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
                      {COUNTRY_FLAGS[store.country]} {store.city} · {store.code}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Tag
                        color={store.status === "enabled" ? "success" : "default"}
                        style={{ fontSize: 10, padding: "0 4px", lineHeight: "16px", margin: 0 }}
                      >
                        {store.status === "enabled" ? t.enabled : t.disabled}
                      </Tag>
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
              onEdit={handleEdit}
              onDelete={handleDelete}
              t={t}
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
        onSave={handleSave}
        onCancel={() => setModalOpen(false)}
        t={t}
        locale={locale}
      />
    </div>
  );
}
