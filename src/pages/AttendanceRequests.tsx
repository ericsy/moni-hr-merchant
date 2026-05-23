import {
  Alert,
  Button,
  DatePicker,
  Descriptions,
  Divider,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Spin,
  Table,
  Tag,
  Tooltip,
} from "antd";
import type { ColumnsType, TablePaginationConfig } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import {
  CalendarIcon,
  CheckCircleIcon,
  ClipboardListIcon,
  ClockIcon,
  EyeIcon,
  FileTextIcon,
  FilterIcon,
  RefreshCwIcon,
  XCircleIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useData } from "../context/DataContext";
import { useLocale } from "../context/LocaleContext";
import { useStore } from "../context/StoreContext";
import {
  merchantApi,
  type MerchantAttendanceLeaveItem,
  type MerchantAttendanceRequest,
  type MerchantAttendanceRequestStatus,
  type MerchantAttendanceRequestSummary,
  type MerchantAttendanceRequestType,
  type MerchantEmployeeBrief,
  type MerchantEmployeeIdName,
} from "../lib/merchantApi";

const { RangePicker } = DatePicker;
const { TextArea } = Input;

type RequestFilter = {
  employeeIds: Array<number | string>;
  requestType: "" | MerchantAttendanceRequestType;
  status: "" | MerchantAttendanceRequestStatus;
  storeIds: string[];
  dateRange: [Dayjs, Dayjs] | null;
};

type AttendanceSummaryView = Required<Omit<MerchantAttendanceRequestSummary, "storeId">>;
type StoreOption = { id: string | number; name: string };

const emptySummary: AttendanceSummaryView = {
  pending: 0,
  approved: 0,
  rejected: 0,
  reviewed: 0,
  total: 0,
  leave: 0,
  missedPunch: 0,
  pendingAssignedToMe: 0,
};

function employeeOptionKey(employee: MerchantEmployeeIdName) {
  return employee.id === undefined || employee.id === null ? "" : String(employee.id);
}

function employeeOptionLabel(employee: MerchantEmployeeIdName) {
  return employee.name || employeeOptionKey(employee);
}

function asNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function getPersonName(person?: MerchantEmployeeBrief | null) {
  if (!person) return "";
  return person.displayName || person.name || [person.firstName, person.lastName].filter(Boolean).join(" ") || person.email || "";
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("YYYY-MM-DD HH:mm") : String(value);
}

function formatShift(start?: string | null, end?: string | null) {
  return start && end ? `${start} - ${end}` : "-";
}

function statusColor(status?: string | null) {
  if (status === "approved") return "green";
  if (status === "rejected") return "red";
  return "gold";
}

function requestTypeColor(type?: string | null) {
  return type === "leave" ? "blue" : "purple";
}

export default function AttendanceRequestPage() {
  const { locale, t } = useLocale();
  const labels = t.attendanceRequest;
  const { stores } = useData();
  const { selectedStoreId } = useStore();
  const [filter, setFilter] = useState<RequestFilter>({
    employeeIds: [],
    requestType: "",
    status: "",
    storeIds: [],
    dateRange: null,
  });
  const [summary, setSummary] = useState<MerchantAttendanceRequestSummary>(emptySummary);
  const [requests, setRequests] = useState<MerchantAttendanceRequest[]>([]);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [error, setError] = useState("");
  const [employeeOptions, setEmployeeOptions] = useState<MerchantEmployeeIdName[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<MerchantAttendanceRequest | null>(null);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewing, setReviewing] = useState<"approved" | "rejected" | null>(null);

  const activeStoreIds = filter.storeIds.length > 0 ? filter.storeIds : selectedStoreId ? [selectedStoreId] : [];
  const activeStoreId = activeStoreIds[0] || selectedStoreId;
  const activeStoreIdsKey = activeStoreIds.map(String).join(",");
  const from = filter.dateRange?.[0]?.format("YYYY-MM-DD");
  const to = filter.dateRange?.[1]?.format("YYYY-MM-DD");

  const storeNameById = useMemo(
    () => new Map(stores.map((store) => [String(store.id), store.name])),
    [stores],
  );

  const currentSummary = {
    pending: asNumber(summary.pending),
    approved: asNumber(summary.approved),
    rejected: asNumber(summary.rejected),
    reviewed: asNumber(summary.reviewed),
    total: asNumber(summary.total),
    leave: asNumber(summary.leave),
    missedPunch: asNumber(summary.missedPunch),
    pendingAssignedToMe: asNumber(summary.pendingAssignedToMe),
  };

  const loadData = useCallback(async () => {
    if (!activeStoreId) {
      setRequests([]);
      setSummary(emptySummary);
      setTotal(0);
      return;
    }

    try {
      setLoading(true);
      setError("");
      const [nextSummary, nextPage] = await Promise.all([
        merchantApi.getAttendanceRequestSummary(activeStoreId, {
          requestType: filter.requestType,
          from,
          to,
        }),
        merchantApi.listAttendanceRequests(activeStoreId, {
          page,
          size: pageSize,
          storeIds: filter.storeIds,
          merchantAdminIds: filter.employeeIds,
          status: filter.status,
          requestType: filter.requestType,
          from,
          to,
        }),
      ]);

      setSummary(nextSummary);
      setRequests(nextPage.items || []);
      const meta = nextPage.page || {};
      setTotal(asNumber((meta as { total?: unknown }).total) || (nextPage.items || []).length);
    } catch (loadError) {
      console.log("[AttendanceRequestPage] failed to load:", loadError);
      const message = loadError instanceof Error ? loadError.message : labels.loadFailed;
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [activeStoreId, filter.employeeIds, filter.requestType, filter.status, filter.storeIds, from, labels.loadFailed, page, pageSize, to]);

  const loadEmployeeOptions = useCallback(async (name = "") => {
    if (activeStoreIds.length === 0) {
      setEmployeeOptions([]);
      return;
    }

    try {
      setEmployeeLoading(true);
      const nextEmployees = await merchantApi.listActiveEmployeeBriefs(activeStoreIds, name.trim() || undefined);
      setEmployeeOptions(nextEmployees);
    } catch (loadError) {
      console.log("[AttendanceRequestPage] failed to load active employees:", loadError);
      setEmployeeOptions([]);
    } finally {
      setEmployeeLoading(false);
    }
  }, [activeStoreIdsKey]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    loadEmployeeOptions();
  }, [loadEmployeeOptions]);

  const openDetail = async (record: MerchantAttendanceRequest) => {
    setSelectedRequest(record);
    setReviewComment(record.reviewComment || "");

    const detailStoreId = String(record.storeId || activeStoreId || "");
    if (!record.id || !detailStoreId) return;

    try {
      setDetailLoading(true);
      const detail = await merchantApi.getAttendanceRequest(record.id, detailStoreId);
      setSelectedRequest(detail);
      setReviewComment(detail.reviewComment || "");
    } catch (detailError) {
      console.log("[AttendanceRequestPage] failed to load detail:", detailError);
      toast.error(detailError instanceof Error ? detailError.message : labels.loadFailed);
    } finally {
      setDetailLoading(false);
    }
  };

  const closeDetail = () => {
    if (reviewing) return;
    setSelectedRequest(null);
    setReviewComment("");
  };

  const submitReview = async (status: "approved" | "rejected") => {
    const reviewStoreId = String(selectedRequest?.storeId || activeStoreId || "");
    if (!selectedRequest?.id || !reviewStoreId) return;

    try {
      setReviewing(status);
      const updated = await merchantApi.reviewAttendanceRequest(selectedRequest.id, reviewStoreId, {
        approved: status === "approved",
        reviewComment,
      });
      toast.success(labels.reviewSuccess);
      setSelectedRequest(updated);
      setRequests((previous) => previous.map((item) => String(item.id) === String(updated.id) ? updated : item));
      await loadData();
    } catch (reviewError) {
      console.log("[AttendanceRequestPage] failed to review:", reviewError);
      toast.error(reviewError instanceof Error ? reviewError.message : labels.reviewFailed);
    } finally {
      setReviewing(null);
    }
  };

  const resetFilters = () => {
    setFilter({ employeeIds: [], requestType: "", status: "", storeIds: [], dateRange: null });
    setPage(1);
  };

  const columns: ColumnsType<MerchantAttendanceRequest> = [
    {
      title: "#",
      dataIndex: "id",
      width: 72,
      render: (id) => <span className="text-xs text-muted-foreground font-mono">{String(id || "-")}</span>,
    },
    {
      title: labels.applicant,
      key: "applicant",
      width: 180,
      render: (_, record) => (
        <div className="min-w-0">
          <div className="text-sm font-medium">{getPersonName(record.applicant) || "-"}</div>
          <div className="text-xs text-muted-foreground">
            {record.storeName || storeNameById.get(String(record.storeId)) || `#${record.storeId || "-"}`}
          </div>
        </div>
      ),
    },
    {
      title: locale === "zh" ? "类型" : "Type",
      dataIndex: "requestType",
      width: 120,
      render: (type) => <RequestTypeTag type={type} labels={labels} />,
    },
    {
      title: t.status,
      dataIndex: "status",
      width: 110,
      render: (status) => <StatusTag status={status} labels={labels} />,
    },
    {
      title: locale === "zh" ? "摘要" : "Summary",
      key: "summary",
      ellipsis: true,
      render: (_, record) => <RequestSummary request={record} labels={labels} />,
    },
    {
      title: labels.approver,
      key: "approver",
      width: 160,
      render: (_, record) => (
        <div className="text-sm">
          <div>{getPersonName(record.approver) || "-"}</div>
          {record.proxyReview && <Tag color="geekblue">{labels.proxyReview}</Tag>}
        </div>
      ),
    },
    {
      title: labels.submittedAt,
      dataIndex: "submittedAt",
      width: 170,
      render: (value) => <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(value)}</span>,
      sorter: (a, b) => dayjs(a.submittedAt || 0).valueOf() - dayjs(b.submittedAt || 0).valueOf(),
      defaultSortOrder: "descend",
    },
    {
      title: t.actions,
      key: "actions",
      align: "center",
      width: 90,
      render: (_, record) => (
      <Tooltip title={record.status === "pending" ? labels.requestDetail : labels.requestDetail}>
          <Button
            type="text"
            icon={record.status === "pending" ? <ClipboardListIcon size={15} /> : <EyeIcon size={15} />}
            onClick={(event) => {
              event.stopPropagation();
              openDetail(record);
            }}
          />
        </Tooltip>
      ),
    },
  ];

  const pagination: TablePaginationConfig = {
    current: page,
    pageSize,
    total,
    showSizeChanger: true,
    onChange: (nextPage, nextPageSize) => {
      setPage(nextPage);
      setPageSize(nextPageSize);
    },
    showTotal: (count, range) =>
      locale === "zh"
        ? `第 ${range[0]}-${range[1]} 条，共 ${count} 条`
        : `${range[0]}-${range[1]} of ${count}`,
  };

  return (
    <div data-cmp="AttendanceRequestPage" className="flex flex-col gap-3">
      {error && (
        <Alert
          type="error"
          showIcon
          message={labels.loadFailed}
          description={error}
          action={<Button size="small" danger onClick={loadData}>{locale === "zh" ? "重试" : "Retry"}</Button>}
        />
      )}

      <AttendanceRequestList
        columns={columns}
        data={requests}
        employeeLoading={employeeLoading}
        employeeOptions={employeeOptions}
        filter={filter}
        labels={labels}
        loading={loading}
        locale={locale}
        pagination={pagination}
        summary={currentSummary}
        stores={stores}
        totalRecords={total}
        onEmployeeSearch={loadEmployeeOptions}
        onFilterChange={(patch) => {
          setPage(1);
          setFilter((previous) => ({ ...previous, ...patch }));
        }}
        onOpenDetail={openDetail}
        onResetFilters={resetFilters}
      />

      <AttendanceDetailModal
        request={selectedRequest}
        labels={labels}
        locale={locale}
        loading={detailLoading}
        open={!!selectedRequest}
        reviewing={reviewing}
        reviewComment={reviewComment}
        onReviewCommentChange={setReviewComment}
        onClose={closeDetail}
        onReview={submitReview}
      />
    </div>
  );
}

function StatusTag({ status, labels }: { status?: string | null; labels: ReturnType<typeof useLocale>["t"]["attendanceRequest"] }) {
  const text = status === "approved" ? labels.approved : status === "rejected" ? labels.rejected : labels.pending;
  return <Tag color={statusColor(status)}>{text}</Tag>;
}

function RequestTypeTag({ type, labels }: { type?: string | null; labels: ReturnType<typeof useLocale>["t"]["attendanceRequest"] }) {
  const text = type === "leave" ? labels.leaveRequest : labels.missedPunch;
  return <Tag color={requestTypeColor(type)}>{text}</Tag>;
}

function RequestSummary({ request, labels }: { request: MerchantAttendanceRequest; labels: ReturnType<typeof useLocale>["t"]["attendanceRequest"] }) {
  if (request.requestType === "leave") {
    return (
      <span className="text-sm text-muted-foreground">
        {labels.leaveItems}: {request.leaveItems?.length || 0}
      </span>
    );
  }

  return (
    <span className="text-sm text-muted-foreground">
      {request.punchType === "clock_out" ? labels.clockOut : labels.clockIn}
      {" · "}
      {formatDateTime(request.actualPunchedAt)}
    </span>
  );
}

function AttendanceRequestList({
  columns,
  data,
  employeeLoading,
  employeeOptions,
  filter,
  labels,
  loading,
  locale,
  pagination,
  summary,
  stores,
  totalRecords,
  onEmployeeSearch,
  onFilterChange,
  onOpenDetail,
  onResetFilters,
}: {
  columns: ColumnsType<MerchantAttendanceRequest>;
  data: MerchantAttendanceRequest[];
  employeeLoading: boolean;
  employeeOptions: MerchantEmployeeIdName[];
  filter: RequestFilter;
  labels: ReturnType<typeof useLocale>["t"]["attendanceRequest"];
  loading: boolean;
  locale: "zh" | "en";
  pagination: TablePaginationConfig;
  summary: AttendanceSummaryView;
  stores: StoreOption[];
  totalRecords: number;
  onEmployeeSearch: (name?: string) => void;
  onFilterChange: (patch: Partial<RequestFilter>) => void;
  onOpenDetail: (record: MerchantAttendanceRequest) => void;
  onResetFilters: () => void;
}) {
  return (
    <div data-cmp="AttendanceRequestList" className="flex flex-col gap-4 pt-4">
      <div className="flex flex-wrap gap-3">
        <CompactStatCard label={labels.pending} value={summary.pending} icon={<ClockIcon size={15} />} tone="amber" />
        <CompactStatCard label={labels.approved} value={summary.approved} icon={<CheckCircleIcon size={15} />} tone="green" />
        <CompactStatCard label={labels.rejected} value={summary.rejected} icon={<XCircleIcon size={15} />} tone="red" />
        <CompactStatCard label={locale === "zh" ? "共计" : "Total" } value={summary.total} icon={<ClipboardListIcon size={15} />} tone="blue" />
      </div>

      <div className="rounded-lg border bg-card p-4" style={{ borderColor: "var(--border)" }}>
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <FilterIcon size={15} />
          {labels.filters}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select
            mode="multiple"
            allowClear
            filterOption={false}
            loading={employeeLoading}
            maxTagCount="responsive"
            optionFilterProp="label"
            placeholder={locale === "zh" ? "搜索/选择申请人" : "Search or select applicant"}
            showSearch
            value={filter.employeeIds}
            onChange={(values) => onFilterChange({ employeeIds: values })}
            onSearch={onEmployeeSearch}
            onClear={() => {
              onFilterChange({ employeeIds: [] });
              onEmployeeSearch();
            }}
            onDropdownVisibleChange={(open) => {
              if (open) onEmployeeSearch();
            }}
            style={{ minWidth: 260, maxWidth: 360 }}
            options={employeeOptions
              .map((employee) => ({
                value: employeeOptionKey(employee),
                label: employeeOptionLabel(employee),
              }))
              .filter((option) => option.value)}
          />
          <Select
            value={filter.requestType}
            onChange={(value) => onFilterChange({ requestType: value })}
            style={{ width: 150 }}
            options={[
              { value: "", label: labels.allTypes },
              { value: "leave", label: labels.leaveRequest },
              { value: "missed_punch", label: labels.missedPunch },
            ]}
          />
          <Select
            value={filter.status}
            onChange={(value) => onFilterChange({ status: value })}
            style={{ width: 140 }}
            options={[
              { value: "", label: labels.allStatus },
              { value: "pending", label: labels.pending },
              { value: "approved", label: labels.approved },
              { value: "rejected", label: labels.rejected },
            ]}
          />
          <Select
            mode="multiple"
            allowClear
            maxTagCount="responsive"
            value={filter.storeIds}
            onChange={(values) => onFilterChange({ storeIds: values, employeeIds: [] })}
            placeholder={labels.allStores}
            style={{ minWidth: 180, maxWidth: 320 }}
            options={stores.map((store) => ({ value: store.id, label: store.name }))}
          />
          <RangePicker
            value={filter.dateRange}
            onChange={(values) => onFilterChange({ dateRange: values as [Dayjs, Dayjs] | null })}
          />
          <Button icon={<RefreshCwIcon size={14} />} onClick={onResetFilters}>
            {labels.reset}
          </Button>
          <div className="ml-auto text-xs text-muted-foreground">
            {data.length} / {totalRecords} {labels.records}
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card" style={{ borderColor: "var(--border)" }}>
        <Table
          columns={columns}
          dataSource={data}
          rowKey={(record) => String(record.id)}
          loading={loading}
          pagination={pagination}
          scroll={{ x: 980 }}
          onRow={(record) => ({
            onClick: () => onOpenDetail(record),
            style: { cursor: "pointer" },
          })}
        />
      </div>
    </div>
  );
}

function CompactStatCard({
  label,
  value,
  icon,
  tone,
}: {
  label: string;
  value: number | string;
  icon: React.ReactNode;
  tone: "blue" | "amber" | "green" | "red";
}) {
  const tones = {
    blue: { color: "#1677ff", bg: "rgba(22,119,255,0.1)", border: "rgba(22,119,255,0.24)" },
    amber: { color: "#d48806", bg: "rgba(250,173,20,0.12)", border: "rgba(250,173,20,0.28)" },
    green: { color: "#389e0d", bg: "rgba(82,196,26,0.12)", border: "rgba(82,196,26,0.28)" },
    red: { color: "#cf1322", bg: "rgba(245,34,45,0.1)", border: "rgba(245,34,45,0.26)" },
  };
  const currentTone = tones[tone];

  return (
    <div
      className="flex min-w-[128px] items-center gap-3 rounded-lg border px-4 py-3"
      style={{ background: currentTone.bg, borderColor: currentTone.border }}
    >
      <div className="flex h-7 w-7 items-center justify-center rounded-full" style={{ color: currentTone.color, background: "rgba(255,255,255,0.65)" }}>
        {icon}
      </div>
      <div>
        <div className="text-xl font-semibold leading-none" style={{ color: currentTone.color }}>
          {value}
        </div>
        <div className="mt-1 text-xs text-muted-foreground">{label}</div>
      </div>
    </div>
  );
}

function AttendanceDetailModal({
  request,
  labels,
  locale,
  loading,
  open,
  reviewing,
  reviewComment,
  onReviewCommentChange,
  onClose,
  onReview,
}: {
  request: MerchantAttendanceRequest | null;
  labels: ReturnType<typeof useLocale>["t"]["attendanceRequest"];
  locale: "zh" | "en";
  loading: boolean;
  open: boolean;
  reviewing: "approved" | "rejected" | null;
  reviewComment: string;
  onReviewCommentChange: (value: string) => void;
  onClose: () => void;
  onReview: (status: "approved" | "rejected") => void;
}) {
  const isPending = request?.status === "pending";

  return (
    <Modal
      open={open}
      onCancel={onClose}
      footer={null}
      width={760}
      title={
        request ? (
          <Space>
            <FileTextIcon size={18} />
            <span>{labels.requestDetail}</span>
            <RequestTypeTag type={request.requestType} labels={labels} />
            <StatusTag status={request.status} labels={labels} />
          </Space>
        ) : labels.requestDetail
      }
    >
      <Spin spinning={loading}>
        {request && (
          <div className="flex flex-col gap-4">
            <Descriptions
              size="small"
              bordered
              column={2}
              items={[
                { key: "applicant", label: labels.applicant, children: getPersonName(request.applicant) || "-" },
                { key: "store", label: labels.store, children: request.storeName || request.storeId || "-" },
                { key: "submittedAt", label: labels.submittedAt, children: formatDateTime(request.submittedAt) },
                { key: "approver", label: labels.approver, children: getPersonName(request.approver) || "-" },
                { key: "reviewer", label: labels.reviewer, children: getPersonName(request.reviewer) || "-" },
                {
                  key: "proxyReviewer",
                  label: labels.proxyReviewer,
                  children: request.proxyReview ? getPersonName(request.proxyReviewer || request.reviewer) || "-" : "-",
                },
              ]}
            />

            {request.requestType === "leave" ? (
              <LeaveDetail items={request.leaveItems || []} labels={labels} locale={locale} />
            ) : (
              <Descriptions
                size="small"
                bordered
                title={labels.missedPunchDetail}
                column={2}
                items={[
                  { key: "punchType", label: labels.punchType, children: request.punchType === "clock_out" ? labels.clockOut : labels.clockIn },
                  { key: "actualPunchedAt", label: labels.actualPunchTime, children: formatDateTime(request.actualPunchedAt) },
                  { key: "scheduleDate", label: labels.scheduleDate, children: request.scheduleDate || "-" },
                  { key: "shift", label: labels.shift, children: formatShift(request.shiftStartTime, request.shiftEndTime) },
                ]}
              />
            )}

            <div>
              <div className="mb-1 text-xs font-semibold uppercase text-muted-foreground">{labels.reason}</div>
              <div className="rounded-lg bg-muted px-4 py-3 text-sm">{request.reason || "-"}</div>
            </div>

            {!isPending && (
              <div>
                <Divider style={{ margin: "4px 0 12px" }} />
                <Descriptions
                  size="small"
                  column={2}
                  items={[
                    { key: "reviewedAt", label: labels.reviewedAt, children: formatDateTime(request.reviewedAt) },
                    { key: "reviewComment", label: labels.reviewComment, children: request.reviewComment || "-" },
                  ]}
                />
              </div>
            )}

            {isPending && (
              <Form layout="vertical">
                <Form.Item label={labels.reviewComment}>
                  <TextArea
                    rows={3}
                    maxLength={512}
                    showCount
                    value={reviewComment}
                    placeholder={labels.commentPlaceholder}
                    onChange={(event) => onReviewCommentChange(event.target.value)}
                  />
                </Form.Item>
                <div className="flex justify-end gap-3">
                  <Button onClick={onClose} disabled={!!reviewing}>
                    {locale === "zh" ? "取消" : "Cancel"}
                  </Button>
                  <Button
                    danger
                    icon={<XCircleIcon size={14} />}
                    loading={reviewing === "rejected"}
                    disabled={reviewing === "approved"}
                    onClick={() => onReview("rejected")}
                  >
                    {labels.reject}
                  </Button>
                  <Button
                    type="primary"
                    icon={<CheckCircleIcon size={14} />}
                    loading={reviewing === "approved"}
                    disabled={reviewing === "rejected"}
                    onClick={() => onReview("approved")}
                  >
                    {labels.approve}
                  </Button>
                </div>
              </Form>
            )}
          </div>
        )}
      </Spin>
    </Modal>
  );
}

function LeaveDetail({
  items,
  labels,
  locale,
}: {
  items: MerchantAttendanceLeaveItem[];
  labels: ReturnType<typeof useLocale>["t"]["attendanceRequest"];
  locale: "zh" | "en";
}) {
  const leaveScopeLabel = (scope?: string | null) => scope === "partial" ? labels.partialShift : labels.fullShift;
  const leaveEffectLabel = (effect?: string | null) => {
    if (effect === "late_in") return labels.lateIn;
    if (effect === "early_out") return labels.earlyOut;
    return labels.fullDay;
  };

  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <CalendarIcon size={15} />
        {labels.leaveItems}
      </div>
      {items.length === 0 ? (
        <div className="rounded-lg bg-muted px-4 py-3 text-sm text-muted-foreground">{labels.noLeaveItems}</div>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item, index) => (
            <div key={String(item.id || index)} className="rounded-lg border p-3" style={{ borderColor: "var(--border)" }}>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
                <Info label={labels.scheduleDate} value={item.scheduleDate || "-"} />
                <Info label={labels.shift} value={formatShift(item.shiftStartTime, item.shiftEndTime)} />
                <Info label={labels.scope} value={leaveScopeLabel(item.leaveScope)} tagColor="blue" />
                <Info label={labels.effect} value={leaveEffectLabel(item.leaveEffect)} tagColor="geekblue" />
                {item.leaveScope === "partial" && (
                  <Info label={labels.timeRange} value={`${item.partialStartTime || "-"} - ${item.partialEndTime || "-"}`} />
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {locale === "zh" ? null : null}
    </div>
  );
}

function Info({ label, value, tagColor }: { label: string; value: React.ReactNode; tagColor?: string }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      {tagColor ? <Tag color={tagColor}>{value}</Tag> : <div className="text-sm font-medium">{value}</div>}
    </div>
  );
}
