import {
  Alert,
  Button,
  DatePicker,
  Select,
  Space,
  Table,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import {
  BarChart3Icon,
  DownloadIcon,
  FilterIcon,
  RefreshCwIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useData } from "../context/DataContext";
import { useLocale } from "../context/LocaleContext";
import { useStore } from "../context/StoreContext";
import {
  merchantApi,
  type MerchantEmployeeIdName,
  type MerchantEmployeeStatisticsItem,
} from "../lib/merchantApi";

const { RangePicker } = DatePicker;

type EmployeeStatsFilters = {
  dateRange: [Dayjs, Dayjs];
  storeIds: string[];
  employeeIds: Array<number | string>;
};

function defaultDateRange(): [Dayjs, Dayjs] {
  return [dayjs().subtract(14, "day"), dayjs()];
}

function asNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function formatHours(value: unknown) {
  return asNumber(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function employeeOptionKey(employee: MerchantEmployeeIdName) {
  return employee.id === undefined || employee.id === null ? "" : String(employee.id);
}

function employeeOptionLabel(employee: MerchantEmployeeIdName) {
  return employee.name || employeeOptionKey(employee);
}

function buildDownloadName(filename: string | undefined, from: string, to: string) {
  if (filename) return filename;
  return `employee-statistics_${from}_${to}.xlsx`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function EmployeeStatsPage() {
  const { locale } = useLocale();
  const { stores } = useData();
  const { selectedStoreId } = useStore();
  const [filters, setFilters] = useState<EmployeeStatsFilters>({
    dateRange: defaultDateRange(),
    storeIds: [],
    employeeIds: [],
  });
  const [rows, setRows] = useState<MerchantEmployeeStatisticsItem[]>([]);
  const [employees, setEmployees] = useState<MerchantEmployeeIdName[]>([]);
  const [loading, setLoading] = useState(false);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const labels = useMemo(() => {
    if (locale === "zh") {
      return {
        title: "员工统计",
        subtitle: "计划/实际工时、申请与异常",
        filters: "筛选",
        dateRange: "时间范围",
        allStores: "全部门店",
        allEmployees: "全部员工",
        reset: "重置",
        refresh: "刷新",
        exportExcel: "导出 Excel",
        employee: "员工",
        employeeId: "员工ID",
        plannedHours: "计划工时",
        actualHours: "实际工时",
        leaveRequests: "请假申请",
        leaveApproved: "请假通过",
        leaveRejected: "请假拒绝",
        missedPunchRequests: "漏打卡申请",
        missedPunchApproved: "漏打卡通过",
        missedPunchRejected: "漏打卡拒绝",
        anomalyPunches: "异常打卡",
        records: "条记录",
        loadFailed: "员工统计加载失败",
        exportSuccess: "员工统计导出已开始下载",
        exportFailed: "员工统计导出失败",
        retry: "重试",
      };
    }

    return {
      title: "Employee Stats",
      subtitle: "Planned/actual hours, requests, and anomalies",
      filters: "Filters",
      dateRange: "Date Range",
      allStores: "All Stores",
      allEmployees: "All Employees",
      reset: "Reset",
      refresh: "Refresh",
      exportExcel: "Export Excel",
      employee: "Employee",
      employeeId: "Employee ID",
      plannedHours: "Planned Hours",
      actualHours: "Actual Hours",
      leaveRequests: "Leave Requests",
      leaveApproved: "Leave Approved",
      leaveRejected: "Leave Rejected",
      missedPunchRequests: "Missed Punch Requests",
      missedPunchApproved: "Missed Punch Approved",
      missedPunchRejected: "Missed Punch Rejected",
      anomalyPunches: "Anomaly Punches",
      records: "records",
      loadFailed: "Failed to load employee statistics",
      exportSuccess: "Employee statistics download started",
      exportFailed: "Failed to export employee statistics",
      retry: "Retry",
    };
  }, [locale]);

  const activeStoreIds = filters.storeIds.length > 0 ? filters.storeIds : selectedStoreId ? [selectedStoreId] : [];
  const activeStoreId = activeStoreIds[0] || selectedStoreId;
  const activeStoreIdsKey = activeStoreIds.map(String).join(",");
  const from = filters.dateRange[0].format("YYYY-MM-DD");
  const to = filters.dateRange[1].format("YYYY-MM-DD");

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
      console.log("[EmployeeStatsPage] failed to load employee options:", loadError);
      setEmployees([]);
    } finally {
      setEmployeeLoading(false);
    }
  }, [activeStoreIdsKey]);

  const loadStats = useCallback(async () => {
    if (!activeStoreId) {
      setRows([]);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const data = await merchantApi.getEmployeeStatistics(activeStoreId, {
        from,
        to,
        storeIds: filters.storeIds,
        merchantAdminIds: filters.employeeIds,
      });
      setRows(data.items || []);
    } catch (loadError) {
      console.log("[EmployeeStatsPage] failed to load stats:", loadError);
      setError(loadError instanceof Error ? loadError.message : labels.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [activeStoreId, filters.employeeIds, filters.storeIds, from, labels.loadFailed, to]);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const setFilterPatch = (patch: Partial<EmployeeStatsFilters>) => {
    setFilters((previous) => ({ ...previous, ...patch }));
  };

  const resetFilters = () => {
    setFilters({
      dateRange: defaultDateRange(),
      storeIds: [],
      employeeIds: [],
    });
  };

  const handleExport = async () => {
    if (!activeStoreId) return;

    try {
      setExporting(true);
      const file = await merchantApi.exportEmployeeStatistics(activeStoreId, {
        from,
        to,
        storeIds: filters.storeIds,
        merchantAdminIds: filters.employeeIds,
      });
      downloadBlob(file.blob, buildDownloadName(file.filename, from, to));
      toast.success(labels.exportSuccess);
    } catch (exportError) {
      console.log("[EmployeeStatsPage] failed to export:", exportError);
      toast.error(exportError instanceof Error ? exportError.message : labels.exportFailed);
    } finally {
      setExporting(false);
    }
  };

  const columns: ColumnsType<MerchantEmployeeStatisticsItem> = [
    {
      title: labels.employee,
      key: "employee",
      fixed: "left",
      width: 190,
      render: (_, record) => (
        <div className="min-w-0">
          <div className="truncate text-sm font-medium">{record.displayName || "-"}</div>
          <div className="text-xs text-muted-foreground">
            {labels.employeeId}: {record.merchantAdminId || "-"}
          </div>
        </div>
      ),
    },
    {
      title: labels.plannedHours,
      dataIndex: "plannedWorkHours",
      width: 120,
      align: "right",
      render: formatHours,
      sorter: (a, b) => asNumber(a.plannedWorkHours) - asNumber(b.plannedWorkHours),
    },
    {
      title: labels.actualHours,
      dataIndex: "actualWorkHours",
      width: 120,
      align: "right",
      render: formatHours,
      sorter: (a, b) => asNumber(a.actualWorkHours) - asNumber(b.actualWorkHours),
    },
    { title: labels.leaveRequests, dataIndex: "leaveRequestCount", width: 120, align: "right", render: asNumber },
    { title: labels.leaveApproved, dataIndex: "leaveApprovedCount", width: 120, align: "right", render: asNumber },
    { title: labels.leaveRejected, dataIndex: "leaveRejectedCount", width: 120, align: "right", render: asNumber },
    { title: labels.missedPunchRequests, dataIndex: "missedPunchRequestCount", width: 150, align: "right", render: asNumber },
    { title: labels.missedPunchApproved, dataIndex: "missedPunchApprovedCount", width: 150, align: "right", render: asNumber },
    { title: labels.missedPunchRejected, dataIndex: "missedPunchRejectedCount", width: 150, align: "right", render: asNumber },
    {
      title: labels.anomalyPunches,
      dataIndex: "clockAnomalyCount",
      width: 130,
      align: "right",
      render: asNumber,
      sorter: (a, b) => asNumber(a.clockAnomalyCount) - asNumber(b.clockAnomalyCount),
    },
  ];

  const pagination = {
    pageSize: 20,
    showSizeChanger: true,
    showTotal: (count: number, range: [number, number]) =>
      locale === "zh"
        ? `第 ${range[0]}-${range[1]} 条，共 ${count} 条`
        : `${range[0]}-${range[1]} of ${count}`,
  };

  return (
    <div data-cmp="EmployeeStatsPage" className="flex flex-col gap-4">
      {error && (
        <Alert
          type="error"
          showIcon
          message={labels.loadFailed}
          description={error}
          action={<Button size="small" danger onClick={loadStats}>{labels.retry}</Button>}
        />
      )}

      <div className="rounded-lg border bg-card p-4" style={{ borderColor: "var(--border)" }}>
        <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-base font-semibold">
              <BarChart3Icon size={18} />
              {labels.title}
            </div>
            <div className="mt-1 text-xs text-muted-foreground">{labels.subtitle}</div>
          </div>
          <Space wrap>
            <Button icon={<RefreshCwIcon size={14} />} onClick={loadStats} loading={loading}>
              {labels.refresh}
            </Button>
            <Button
              type="primary"
              icon={<DownloadIcon size={14} />}
              loading={exporting}
              onClick={handleExport}
            >
              {labels.exportExcel}
            </Button>
          </Space>
        </div>

        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <FilterIcon size={15} />
          {labels.filters}
        </div>
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
            optionFilterProp="label"
            placeholder={labels.allEmployees}
            showSearch
            value={filters.employeeIds}
            onChange={(values) => setFilterPatch({ employeeIds: values })}
            style={{ minWidth: 240, maxWidth: 380 }}
            options={employees
              .map((employee) => ({
                value: employeeOptionKey(employee),
                label: employeeOptionLabel(employee),
              }))
              .filter((option) => option.value)}
          />
          <Button icon={<RefreshCwIcon size={14} />} onClick={resetFilters}>
            {labels.reset}
          </Button>
          <div className="ml-auto text-xs text-muted-foreground">
            {rows.length} {labels.records}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card" style={{ borderColor: "var(--border)" }}>
        <Table
          columns={columns}
          dataSource={rows}
          loading={loading}
          pagination={pagination}
          rowKey={(record) => String(record.merchantAdminId || record.displayName)}
          scroll={{ x: 1350 }}
        />
      </div>
    </div>
  );
}
