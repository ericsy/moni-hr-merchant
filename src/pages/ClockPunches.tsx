import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Divider,
  Drawer,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import {
  AlertTriangleIcon,
  CheckCircleIcon,
  FingerprintIcon,
  LayoutDashboardIcon,
  ListIcon,
  LogInIcon,
  LogOutIcon,
  MapPinIcon,
  RefreshCwIcon,
  ShieldAlertIcon,
  ShieldCheckIcon,
  SmartphoneIcon,
  UsersIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { useData } from "../context/DataContext";
import { useLocale } from "../context/LocaleContext";
import { useStore } from "../context/StoreContext";
import {
  merchantApi,
  type MerchantClockAnomalyPage,
  type MerchantClockAnomalySummary,
  type MerchantClockPunch,
  type MerchantClockPunchQueryParams,
  type MerchantClockPunchSource,
  type MerchantClockPunchType,
  type MerchantClockSummary,
  type MerchantEmployeeIdName,
} from "../lib/merchantApi";

const { RangePicker } = DatePicker;

type ClockFilters = {
  dateRange: [Dayjs, Dayjs];
  storeIds: string[];
  employeeIds: Array<number | string>;
  punchType: "" | MerchantClockPunchType;
  punchSource: "" | MerchantClockPunchSource;
  proxy: "" | "yes" | "no";
};

const chartColors = ["#1677ff", "#52c41a", "#faad14", "#f5222d"];

function todayRange(): [Dayjs, Dayjs] {
  const today = dayjs();
  return [today, today];
}

function asNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD HH:mm") : String(value);
}

function getEmployeeName(record?: MerchantClockPunch | null) {
  const employee = record?.employee;
  if (!employee) return "";
  return employee.displayName || employee.name || [employee.firstName, employee.lastName].filter(Boolean).join(" ") || employee.email || "";
}

function getEmployeeRole(record?: MerchantClockPunch | null) {
  return record?.employee?.role || "";
}

function proxyReasons(record: MerchantClockPunch) {
  if (record.proxyPunchReasons?.length) return record.proxyPunchReasons;
  return String(record.proxyPunchReason || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function sourceLabel(source: string | null | undefined, labels: ReturnType<typeof useLocale>["t"]["clockPunch"]) {
  if (source === "missed_punch_backfill") return labels.sourceMissed;
  if (source === "leave") return labels.sourceLeave;
  return labels.sourceNormal;
}

function punchTypeLabel(type: string | null | undefined, labels: ReturnType<typeof useLocale>["t"]["clockPunch"]) {
  return type === "clock_out" ? labels.clockOut : labels.clockIn;
}

function riskReasonLabel(reason: string, labels: ReturnType<typeof useLocale>["t"]["clockPunch"]) {
  if (reason === "new_device_id") return labels.newDeviceId;
  if (reason === "shared_merchant_device") return labels.sharedMerchantDevice;
  return reason;
}

export default function ClockPunchPage() {
  const { locale, t } = useLocale();
  const labels = t.clockPunch;
  const { stores } = useData();
  const { selectedStoreId } = useStore();
  const [activeTab, setActiveTab] = useState("overview");
  const [filters, setFilters] = useState<ClockFilters>({
    dateRange: todayRange(),
    storeIds: [],
    employeeIds: [],
    punchType: "",
    punchSource: "",
    proxy: "",
  });
  const [summary, setSummary] = useState<MerchantClockSummary>({});
  const [anomalySummary, setAnomalySummary] = useState<MerchantClockAnomalySummary>({});
  const [punches, setPunches] = useState<MerchantClockPunch[]>([]);
  const [anomalyPage, setAnomalyPage] = useState<MerchantClockAnomalyPage>({});
  const [employees, setEmployees] = useState<MerchantEmployeeIdName[]>([]);
  const [punchLoading, setPunchLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [anomalyLoading, setAnomalyLoading] = useState(false);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [error, setError] = useState("");
  const [punchPage, setPunchPage] = useState(1);
  const [punchPageSize, setPunchPageSize] = useState(20);
  const [anomalyPageNum, setAnomalyPageNum] = useState(1);
  const [anomalyPageSize, setAnomalyPageSize] = useState(20);
  const [drawerRecord, setDrawerRecord] = useState<MerchantClockPunch | null>(null);

  const activeStoreIds = filters.storeIds.length > 0 ? filters.storeIds : selectedStoreId ? [selectedStoreId] : [];
  const activeStoreId = activeStoreIds[0] || selectedStoreId;
  const from = filters.dateRange[0].format("YYYY-MM-DD");
  const to = filters.dateRange[1].format("YYYY-MM-DD");

  const queryParams = useMemo<MerchantClockPunchQueryParams>(() => ({
    from,
    to,
    storeIds: filters.storeIds,
    merchantAdminIds: filters.employeeIds,
    punchType: filters.punchType,
    punchSource: filters.punchSource,
    proxyPunchSuspected: filters.proxy === "yes" ? true : filters.proxy === "no" ? false : undefined,
  }), [filters.employeeIds, filters.proxy, filters.punchSource, filters.punchType, filters.storeIds, from, to]);

  const loadEmployees = useCallback(async () => {
    if (activeStoreIds.length === 0) {
      setEmployees([]);
      return;
    }

    try {
      setEmployeeLoading(true);
      const nextEmployees = await merchantApi.listActiveEmployeeBriefs(activeStoreIds);
      setEmployees(nextEmployees);
    } catch (loadError) {
      console.log("[ClockPunchPage] failed to load active employees:", loadError);
      setEmployees([]);
    } finally {
      setEmployeeLoading(false);
    }
  }, [activeStoreIds.join(",")]);

  const loadSummary = useCallback(async () => {
    if (!activeStoreId) {
      setSummary({});
      setAnomalySummary({});
      return;
    }

    try {
      setSummaryLoading(true);
      setError("");
      const [nextSummary, nextAnomalySummary] = await Promise.all([
        merchantApi.getClockSummary(activeStoreId, to),
        merchantApi.getClockAnomalySummary(activeStoreId, queryParams),
      ]);
      setSummary(nextSummary);
      setAnomalySummary(nextAnomalySummary);
    } catch (loadError) {
      console.log("[ClockPunchPage] failed to load summary:", loadError);
      setError(loadError instanceof Error ? loadError.message : labels.loadFailed);
    } finally {
      setSummaryLoading(false);
    }
  }, [activeStoreId, labels.loadFailed, queryParams, to]);

  const loadPunches = useCallback(async () => {
    if (!activeStoreId) {
      setPunches([]);
      return;
    }

    try {
      setPunchLoading(true);
      setError("");
      const data = await merchantApi.listClockPunches(activeStoreId, queryParams);
      setPunches(data.punches || []);
    } catch (loadError) {
      console.log("[ClockPunchPage] failed to load punches:", loadError);
      setError(loadError instanceof Error ? loadError.message : labels.loadFailed);
    } finally {
      setPunchLoading(false);
    }
  }, [activeStoreId, labels.loadFailed, queryParams]);

  const loadAnomalies = useCallback(async () => {
    if (!activeStoreId) {
      setAnomalyPage({});
      return;
    }

    try {
      setAnomalyLoading(true);
      setError("");
      const data = await merchantApi.listClockAnomalies(activeStoreId, {
        ...queryParams,
        page: anomalyPageNum,
        size: anomalyPageSize,
      });
      setAnomalyPage(data);
      if (data.summary) setAnomalySummary(data.summary);
    } catch (loadError) {
      console.log("[ClockPunchPage] failed to load anomalies:", loadError);
      setError(loadError instanceof Error ? loadError.message : labels.loadFailed);
    } finally {
      setAnomalyLoading(false);
    }
  }, [activeStoreId, anomalyPageNum, anomalyPageSize, labels.loadFailed, queryParams]);

  const reloadAll = useCallback(() => {
    loadEmployees();
    loadSummary();
    loadPunches();
    loadAnomalies();
  }, [loadAnomalies, loadEmployees, loadPunches, loadSummary]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    loadSummary();
    loadPunches();
  }, [loadPunches, loadSummary]);

  useEffect(() => {
    loadAnomalies();
  }, [loadAnomalies]);

  const visiblePunches = useMemo(() => {
    const start = (punchPage - 1) * punchPageSize;
    return punches.slice(start, start + punchPageSize);
  }, [punchPage, punchPageSize, punches]);

  const anomalyItems = anomalyPage.items || [];
  const anomalyTotal = asNumber((anomalyPage.page as { total?: unknown })?.total) || anomalyItems.length;
  const punchTotal = punches.length;

  const setFilterPatch = (patch: Partial<ClockFilters>) => {
    setPunchPage(1);
    setAnomalyPageNum(1);
    setFilters((previous) => ({ ...previous, ...patch }));
  };

  const tabItems = [
    {
      key: "overview",
      label: (
        <span className="flex items-center gap-1.5">
          <LayoutDashboardIcon size={14} />
          {labels.tabOverview}
        </span>
      ),
      children: (
        <ClockOverview
          summary={summary}
          anomalySummary={anomalySummary}
          labels={labels}
          loading={summaryLoading}
        />
      ),
    },
    {
      key: "records",
      label: (
        <span className="flex items-center gap-1.5">
          <ListIcon size={14} />
          {labels.tabRecords}
        </span>
      ),
      children: (
        <ClockPunchTable
          data={visiblePunches}
          total={punchTotal}
          page={punchPage}
          pageSize={punchPageSize}
          labels={labels}
          locale={locale}
          loading={punchLoading}
          onPageChange={(nextPage, nextPageSize) => {
            setPunchPage(nextPage);
            setPunchPageSize(nextPageSize);
          }}
          onOpenRecord={setDrawerRecord}
        />
      ),
    },
    {
      key: "anomalies",
      label: (
        <span className="flex items-center gap-1.5">
          <AlertTriangleIcon size={14} />
          {labels.tabAnomalies}
        </span>
      ),
      children: (
        <ClockAnomalies
          summary={anomalySummary}
          data={anomalyItems}
          total={anomalyTotal}
          page={anomalyPageNum}
          pageSize={anomalyPageSize}
          labels={labels}
          locale={locale}
          loading={anomalyLoading}
          onPageChange={(nextPage, nextPageSize) => {
            setAnomalyPageNum(nextPage);
            setAnomalyPageSize(nextPageSize);
          }}
          onOpenRecord={setDrawerRecord}
        />
      ),
    },
  ];

  return (
    <div data-cmp="ClockPunchPage" className="flex min-h-[calc(100vh-112px)] flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <FingerprintIcon size={22} style={{ color: "var(--primary)" }} />
            <h1 className="text-2xl font-semibold leading-tight" style={{ color: "var(--foreground)" }}>
              {labels.title}
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">{labels.subtitle}</p>
        </div>
        <Button icon={<RefreshCwIcon size={15} />} loading={summaryLoading || punchLoading || anomalyLoading} onClick={reloadAll}>
          {labels.refreshBtn}
        </Button>
      </div>

      {error && (
        <Alert
          type="error"
          showIcon
          message={labels.loadFailed}
          description={error}
          action={<Button size="small" danger onClick={reloadAll}>{locale === "zh" ? "重试" : "Retry"}</Button>}
        />
      )}

      <div className="rounded-lg border bg-card p-4" style={{ borderColor: "var(--border)" }}>
        <div className="flex flex-wrap items-center gap-3">
          <RangePicker
            value={filters.dateRange}
            allowClear={false}
            onChange={(value) => {
              const nextValue = value as [Dayjs, Dayjs] | null;
              if (nextValue) setFilterPatch({ dateRange: nextValue });
            }}
          />
          <Select
            mode="multiple"
            allowClear
            maxTagCount="responsive"
            value={filters.storeIds}
            onChange={(values) => setFilterPatch({ storeIds: values, employeeIds: [] })}
            placeholder={labels.allStores}
            style={{ minWidth: 180, maxWidth: 320 }}
            options={stores.map((store) => ({ value: store.id, label: store.name }))}
          />
          <Select
            mode="multiple"
            allowClear
            maxTagCount="responsive"
            loading={employeeLoading}
            value={filters.employeeIds}
            onChange={(values) => setFilterPatch({ employeeIds: values })}
            placeholder={labels.allEmployees}
            style={{ minWidth: 180, maxWidth: 320 }}
            options={employees.map((employee) => ({ value: employee.id, label: employee.name || String(employee.id) }))}
          />
          <Select
            value={filters.punchType}
            onChange={(value) => setFilterPatch({ punchType: value })}
            style={{ width: 140 }}
            options={[
              { value: "", label: labels.allTypes },
              { value: "clock_in", label: labels.clockIn },
              { value: "clock_out", label: labels.clockOut },
            ]}
          />
          <Select
            value={filters.punchSource}
            onChange={(value) => setFilterPatch({ punchSource: value })}
            style={{ width: 160 }}
            options={[
              { value: "", label: labels.allSources },
              { value: "normal", label: labels.sourceNormal },
              { value: "missed_punch_backfill", label: labels.sourceMissed },
              { value: "leave", label: labels.sourceLeave },
            ]}
          />
          <Select
            value={filters.proxy}
            onChange={(value) => setFilterPatch({ proxy: value })}
            style={{ width: 150 }}
            options={[
              { value: "", label: labels.allProxy },
              { value: "yes", label: labels.proxySuspected },
              { value: "no", label: labels.normalPunch },
            ]}
          />
        </div>
      </div>

      <Tabs
        className="clock-punch-tabs"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        style={{ background: "var(--card)", borderRadius: 8, minHeight: 0, padding: "0 16px 16px" }}
      />

      <PunchDetailDrawer record={drawerRecord} labels={labels} open={!!drawerRecord} onClose={() => setDrawerRecord(null)} />
    </div>
  );
}

function ClockOverview({
  summary,
  anomalySummary,
  labels,
  loading,
}: {
  summary: MerchantClockSummary;
  anomalySummary: MerchantClockAnomalySummary;
  labels: ReturnType<typeof useLocale>["t"]["clockPunch"];
  loading: boolean;
}) {
  const sourceData = [
    { name: labels.sourceNormal, value: asNumber(summary.normalPunchCount) },
    { name: labels.sourceMissed, value: asNumber(summary.missedPunchBackfillCount) },
    { name: labels.sourceLeave, value: asNumber(summary.leavePunchCount) },
  ].filter((item) => item.value > 0);

  return (
    <div className="flex flex-col gap-5 pt-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Metric label={labels.totalPunches} value={asNumber(summary.totalPunches)} icon={<CheckCircleIcon size={20} />} color="#1677ff" loading={loading} />
        <Metric label={labels.clockInCount} value={asNumber(summary.clockInCount)} icon={<LogInIcon size={20} />} color="#52c41a" loading={loading} />
        <Metric label={labels.clockOutCount} value={asNumber(summary.clockOutCount)} icon={<LogOutIcon size={20} />} color="#faad14" loading={loading} />
        <Metric label={labels.employeesPunched} value={asNumber(summary.employeesPunched)} icon={<UsersIcon size={20} />} color="#722ed1" loading={loading} />
        <Metric label={labels.proxySuspected} value={asNumber(summary.suspectedProxyCount)} icon={<ShieldAlertIcon size={20} />} color="#f5222d" loading={loading} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <div className="rounded-lg border bg-card p-5" style={{ borderColor: "var(--border)" }}>
          <div className="mb-4 text-sm font-semibold">{labels.sourceDistribution}</div>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={sourceData} dataKey="value" innerRadius={58} outerRadius={86} paddingAngle={3}>
                  {sourceData.map((_, index) => (
                    <Cell key={index} fill={chartColors[index % chartColors.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Metric label={labels.pendingMissedPunchRequests} value={asNumber(summary.pendingMissedPunchRequests)} icon={<ClockIcon size={20} />} color="#d48806" loading={loading} />
          <Metric label={labels.newDeviceCount} value={asNumber(anomalySummary.newDeviceIdCount)} icon={<SmartphoneIcon size={20} />} color="#fa541c" loading={loading} />
          <Metric label={labels.sharedDeviceCount} value={asNumber(anomalySummary.sharedMerchantDeviceCount)} icon={<ShieldAlertIcon size={20} />} color="#eb2f96" loading={loading} />
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  icon,
  color,
  loading,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border bg-card p-4" style={{ borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-muted-foreground">{label}</span>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ color, background: `${color}18` }}>
          {icon}
        </div>
      </div>
      <div className="mt-3 text-3xl font-semibold" style={{ color }}>
        {loading ? "-" : value}
      </div>
    </div>
  );
}

function ClockAnomalies({
  summary,
  data,
  total,
  page,
  pageSize,
  labels,
  locale,
  loading,
  onPageChange,
  onOpenRecord,
}: {
  summary: MerchantClockAnomalySummary;
  data: MerchantClockPunch[];
  total: number;
  page: number;
  pageSize: number;
  labels: ReturnType<typeof useLocale>["t"]["clockPunch"];
  locale: "zh" | "en";
  loading: boolean;
  onPageChange: (page: number, pageSize: number) => void;
  onOpenRecord: (record: MerchantClockPunch) => void;
}) {
  return (
    <div className="flex flex-col gap-5 pt-4">
      <Alert
        type="warning"
        showIcon
        message={`${asNumber(summary.totalCount)} ${labels.anomalyCount}`}
        description={`${labels.newDeviceCount}: ${asNumber(summary.newDeviceIdCount)} · ${labels.sharedDeviceCount}: ${asNumber(summary.sharedMerchantDeviceCount)}`}
      />
      <ClockPunchTable
        data={data}
        total={total}
        page={page}
        pageSize={pageSize}
        labels={labels}
        locale={locale}
        loading={loading}
        onPageChange={onPageChange}
        onOpenRecord={onOpenRecord}
      />
    </div>
  );
}

function ClockPunchTable({
  data,
  total,
  page,
  pageSize,
  labels,
  locale,
  loading,
  onPageChange,
  onOpenRecord,
}: {
  data: MerchantClockPunch[];
  total: number;
  page: number;
  pageSize: number;
  labels: ReturnType<typeof useLocale>["t"]["clockPunch"];
  locale: "zh" | "en";
  loading: boolean;
  onPageChange: (page: number, pageSize: number) => void;
  onOpenRecord: (record: MerchantClockPunch) => void;
}) {
  const columns: ColumnsType<MerchantClockPunch> = [
    {
      title: labels.employee,
      key: "employee",
      fixed: "left",
      width: 170,
      render: (_, record) => (
        <div>
          <div className="text-sm font-medium">{getEmployeeName(record) || "-"}</div>
          <div className="text-xs text-muted-foreground">{getEmployeeRole(record) || `#${record.merchantAdminId || "-"}`}</div>
        </div>
      ),
    },
    {
      title: labels.store,
      dataIndex: "storeName",
      width: 170,
      render: (name, record) => <span className="text-sm text-muted-foreground">{name || record.storeId || "-"}</span>,
    },
    {
      title: labels.punchType,
      dataIndex: "punchType",
      width: 120,
      render: (type) => <PunchTypeTag type={type} labels={labels} />,
    },
    {
      title: labels.punchSource,
      dataIndex: "punchSource",
      width: 140,
      render: (source) => <SourceTag source={source} labels={labels} />,
    },
    {
      title: labels.deviceType,
      key: "device",
      width: 180,
      render: (_, record) => (
        <div className="flex flex-col gap-0.5">
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <SmartphoneIcon size={12} />
            {String(record.deviceType || "-").toUpperCase()}
          </span>
          <span className="text-xs font-mono" style={{ color: "var(--foreground)", opacity: 0.72 }}>
            {record.deviceId ? `${record.deviceId.slice(0, 18)}${record.deviceId.length > 18 ? "..." : ""}` : "-"}
          </span>
        </div>
      ),
    },
    {
      title: labels.distance,
      key: "distance",
      width: 130,
      render: (_, record) => (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <MapPinIcon size={12} />
          {record.distanceMeters === undefined || record.distanceMeters === null ? "-" : `${Number(record.distanceMeters).toFixed(0)} ${labels.meters}`}
        </span>
      ),
    },
    {
      title: labels.proxyRisk,
      key: "proxy",
      width: 200,
      render: (_, record) => <ProxyRisk record={record} labels={labels} />,
    },
    {
      title: labels.punchedAt,
      dataIndex: "punchedAt",
      width: 170,
      render: (value) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(value)}</span>,
      sorter: (a, b) => dayjs(a.punchedAt || 0).valueOf() - dayjs(b.punchedAt || 0).valueOf(),
      defaultSortOrder: "descend",
    },
  ];

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
    onChange: onPageChange,
    showTotal: (count, range) =>
      locale === "zh"
        ? `第 ${range[0]}-${range[1]} 条，共 ${count} 条`
        : `${range[0]}-${range[1]} of ${count}`,
  };

  return (
    <div className="rounded-lg border bg-card" style={{ borderColor: "var(--border)" }}>
      <Table
        dataSource={data}
        columns={columns}
        rowKey={(record) => String(record.id)}
        loading={loading}
        pagination={pagination}
        scroll={{ x: 1180 }}
        onRow={(record) => ({
          onClick: () => onOpenRecord(record),
          style: { cursor: "pointer" },
        })}
      />
    </div>
  );
}

function PunchTypeTag({ type, labels }: { type?: string | null; labels: ReturnType<typeof useLocale>["t"]["clockPunch"] }) {
  const isOut = type === "clock_out";
  return (
    <Tag color={isOut ? "orange" : "blue"} icon={isOut ? <LogOutIcon size={11} /> : <LogInIcon size={11} />}>
      {punchTypeLabel(type, labels)}
    </Tag>
  );
}

function SourceTag({ source, labels }: { source?: string | null; labels: ReturnType<typeof useLocale>["t"]["clockPunch"] }) {
  const color = source === "missed_punch_backfill" ? "purple" : source === "leave" ? "cyan" : "default";
  return <Tag color={color}>{sourceLabel(source, labels)}</Tag>;
}

function ProxyRisk({ record, labels }: { record: MerchantClockPunch; labels: ReturnType<typeof useLocale>["t"]["clockPunch"] }) {
  const suspected = !!record.suspectedProxyPunch;
  const reasons = proxyReasons(record);
  return (
    <div className="flex flex-col gap-1">
      <span className="flex items-center gap-1" style={{ color: suspected ? "#f5222d" : "#52c41a" }}>
        {suspected ? <ShieldAlertIcon size={13} /> : <ShieldCheckIcon size={13} />}
        <span className="text-xs font-medium">{suspected ? labels.proxySuspected : labels.noRisk}</span>
      </span>
      <div className="flex flex-wrap gap-1">
        {reasons.map((reason) => (
          <Tag key={reason} color="red" style={{ fontSize: 10, lineHeight: "16px", padding: "0 4px" }}>
            {riskReasonLabel(reason, labels)}
          </Tag>
        ))}
      </div>
    </div>
  );
}

function PunchDetailDrawer({
  record,
  labels,
  open,
  onClose,
}: {
  record: MerchantClockPunch | null;
  labels: ReturnType<typeof useLocale>["t"]["clockPunch"];
  open: boolean;
  onClose: () => void;
}) {
  const sharedEmployees = record?.proxySharedDeviceEmployees || [];

  return (
    <Drawer title={labels.detailTitle} open={open} onClose={onClose} width={520}>
      {record && (
        <div className="flex flex-col gap-5">
          <Descriptions
            column={2}
            size="small"
            items={[
              { key: "employee", label: labels.employee, children: getEmployeeName(record) || "-" },
              { key: "role", label: "Role", children: getEmployeeRole(record) || "-" },
              { key: "store", label: labels.store, children: record.storeName || record.storeId || "-" },
              { key: "storeCode", label: "Store Code", children: record.storeCode || "-" },
            ]}
          />
          <Divider style={{ margin: 0 }} />
          <Descriptions
            column={2}
            size="small"
            items={[
              { key: "punchType", label: labels.punchType, children: <PunchTypeTag type={record.punchType} labels={labels} /> },
              { key: "punchSource", label: labels.punchSource, children: <SourceTag source={record.punchSource} labels={labels} /> },
              { key: "punchedAt", label: labels.punchedAt, children: formatDateTime(record.punchedAt), span: 2 },
              { key: "createdAt", label: labels.createdAt, children: formatDateTime(record.createdAt), span: 2 },
            ]}
          />
          <Divider style={{ margin: 0 }} />
          <Descriptions
            column={1}
            size="small"
            items={[
              { key: "deviceType", label: labels.deviceType, children: String(record.deviceType || "-").toUpperCase() },
              { key: "deviceId", label: labels.deviceId, children: <span className="font-mono text-xs">{record.deviceId || "-"}</span> },
            ]}
          />
          <Divider style={{ margin: 0 }} />
          <Descriptions
            column={2}
            size="small"
            items={[
              { key: "lat", label: labels.latitude, children: record.latitude === undefined || record.latitude === null ? "-" : Number(record.latitude).toFixed(5) },
              { key: "lng", label: labels.longitude, children: record.longitude === undefined || record.longitude === null ? "-" : Number(record.longitude).toFixed(5) },
              {
                key: "distance",
                label: labels.distance,
                children: record.distanceMeters === undefined || record.distanceMeters === null ? "-" : `${Number(record.distanceMeters).toFixed(1)} ${labels.meters}`,
              },
            ]}
          />
          <Divider style={{ margin: 0 }} />
          <Descriptions
            column={1}
            size="small"
            items={[
              { key: "proxy", label: labels.proxyRisk, children: <ProxyRisk record={record} labels={labels} /> },
              {
                key: "shared",
                label: labels.proxySharedDeviceIds,
                children: sharedEmployees.length > 0 ? (
                  <div className="flex flex-wrap gap-1">
                    {sharedEmployees.map((employee, index) => (
                      <Tag key={`${employee.id || employee.merchantAdminId || index}`} color="volcano">
                        {employee.displayName || employee.name || employee.email || employee.id || employee.merchantAdminId}
                      </Tag>
                    ))}
                  </div>
                ) : "-",
              },
            ]}
          />
        </div>
      )}
    </Drawer>
  );
}
