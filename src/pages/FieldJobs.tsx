import { Button, Input, Segmented, Select, Table, Tag } from "antd";
import type { ColumnsType } from "antd/es/table";
import dayjs, { type Dayjs } from "dayjs";
import { CalendarDays, LayoutList, MapPin, Plus, RefreshCw, Search, UserPlus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import FieldJobAssignModal from "../components/fieldService/FieldJobAssignModal";
import FieldJobCalendarView from "../components/fieldService/FieldJobCalendarView";
import FieldJobFormModal from "../components/fieldService/FieldJobFormModal";
import { useData } from "../context/DataContext";
import { useLocale } from "../context/LocaleContext";
import { useStore } from "../context/StoreContext";
import { filterLeavesForStore } from "../lib/employeeLeave";
import { merchantApi } from "../lib/merchantApi";
import type { FieldJobStatus, FieldJobUpsertPayload, FieldServiceJob } from "../types/fieldService";

type FieldJobViewMode = "list" | "calendar";

const STATUS_COLORS: Record<FieldJobStatus, string> = {
  pending: "default",
  assigned: "processing",
  in_progress: "blue",
  completed: "success",
  cancelled: "error",
};

export default function FieldJobs() {
  const { t, locale } = useLocale();
  const labels = t.fieldJobs;
  const { selectedStoreId } = useStore();
  const { scheduleShifts, stores, employeeDateLeaves, employeeShiftLeaves } = useData();

  const dateLeavesForStore = useMemo(
    () => filterLeavesForStore(employeeDateLeaves, selectedStoreId),
    [employeeDateLeaves, selectedStoreId],
  );
  const shiftLeavesForStore = useMemo(
    () => filterLeavesForStore(employeeShiftLeaves, selectedStoreId),
    [employeeShiftLeaves, selectedStoreId],
  );

  const [jobs, setJobs] = useState<FieldServiceJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FieldJobStatus | "">("");
  const [viewMode, setViewMode] = useState<FieldJobViewMode>("list");
  const [selectedDate, setSelectedDate] = useState<Dayjs>(() => dayjs().startOf("day"));
  const [calendarMonth, setCalendarMonth] = useState<Dayjs>(() => dayjs().startOf("month"));
  const [formOpen, setFormOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<FieldServiceJob | null>(null);
  const [assigningJob, setAssigningJob] = useState<FieldServiceJob | null>(null);
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);

  const storeNameById = useMemo(
    () =>
      stores.reduce<Record<string, string>>((map, store) => {
        map[store.id] = store.name;
        return map;
      }, {}),
    [stores],
  );

  const statusOptions = useMemo(
    () => [
      { value: "", label: labels.allStatus },
      { value: "pending", label: labels.statusPending },
      { value: "assigned", label: labels.statusAssigned },
      { value: "in_progress", label: labels.statusInProgress },
      { value: "completed", label: labels.statusCompleted },
      { value: "cancelled", label: labels.statusCancelled },
    ],
    [labels],
  );

  const statusLabel = useCallback(
    (value: FieldJobStatus) => {
      const map: Record<FieldJobStatus, string> = {
        pending: labels.statusPending,
        assigned: labels.statusAssigned,
        in_progress: labels.statusInProgress,
        completed: labels.statusCompleted,
        cancelled: labels.statusCancelled,
      };
      return map[value] || value;
    },
    [labels],
  );

  const serviceTypeLabel = useCallback(
    (value: string) =>
      (labels.serviceTypes as Record<string, string>)[value] || value,
    [labels.serviceTypes],
  );

  const loadJobs = useCallback(async () => {
    if (!selectedStoreId) {
      setJobs([]);
      return;
    }

    try {
      setLoading(true);
      const monthStart = calendarMonth.startOf("month");
      const monthEnd = calendarMonth.endOf("month");
      const items = await merchantApi.listFieldJobs(selectedStoreId, {
        storeId: selectedStoreId,
        status,
        q: search.trim() || undefined,
        ...(viewMode === "calendar"
          ? {
              from: monthStart.format("YYYY-MM-DD"),
              to: monthEnd.format("YYYY-MM-DD"),
              size: 200,
            }
          : {
              page: 1,
              size: 50,
            }),
      });
      setJobs(items);
    } catch (error) {
      console.log("[FieldJobs] load failed:", error);
      toast.error(labels.loadFailed);
      setJobs([]);
    } finally {
      setLoading(false);
    }
  }, [calendarMonth, labels.loadFailed, search, selectedStoreId, status, viewMode]);

  const loadEmployees = useCallback(async () => {
    if (!selectedStoreId) {
      setEmployees([]);
      return;
    }
    try {
      const items = await merchantApi.listActiveEmployeeBriefs([selectedStoreId]);
      setEmployees(
        items
          .map((item) => ({
            id: String(item.id || ""),
            name: item.name || "",
          }))
          .filter((item) => item.id),
      );
    } catch (error) {
      console.log("[FieldJobs] employees load failed:", error);
      setEmployees([]);
    }
  }, [selectedStoreId]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    void loadEmployees();
  }, [loadEmployees]);

  const handleSelectedDateChange = useCallback((date: Dayjs) => {
    const nextDate = date.startOf("day");
    setSelectedDate(nextDate);
    if (!nextDate.isSame(calendarMonth, "month")) {
      setCalendarMonth(nextDate.startOf("month"));
    }
  }, [calendarMonth]);

  const handleCreate = () => {
    if (!selectedStoreId) {
      toast.error(labels.storeRequired);
      return;
    }
    setEditingJob(null);
    setFormOpen(true);
  };

  const handleEdit = (job: FieldServiceJob) => {
    setEditingJob(job);
    setFormOpen(true);
  };

  const handleAssign = (job: FieldServiceJob) => {
    setAssigningJob(job);
    setAssignOpen(true);
  };

  const handleSave = async (payload: FieldJobUpsertPayload) => {
    if (!selectedStoreId) {
      toast.error(labels.storeRequired);
      return;
    }

    try {
      if (editingJob) {
        await merchantApi.updateFieldJob(selectedStoreId, editingJob.id, {
          ...payload,
          storeId: selectedStoreId,
        });
      } else {
        await merchantApi.createFieldJob(selectedStoreId, {
          ...payload,
          storeId: selectedStoreId,
        });
      }
      toast.success(labels.saveSuccess);
      setFormOpen(false);
      setEditingJob(null);
      await loadJobs();
    } catch (error) {
      console.log("[FieldJobs] save failed:", error);
      toast.error(labels.saveFailed);
      throw error;
    }
  };

  const handleAssignSubmit = async (payload: {
    merchantAdminId: string;
    syncStoreClockIn: boolean;
    syncStoreClockOut: boolean;
  }) => {
    if (!selectedStoreId || !assigningJob) return;

    try {
      await merchantApi.assignFieldJob(selectedStoreId, assigningJob.id, payload);
      toast.success(labels.assignSuccess);
      setAssignOpen(false);
      setAssigningJob(null);
      await loadJobs();
    } catch (error) {
      console.log("[FieldJobs] assign failed:", error);
      toast.error(labels.assignFailed);
      throw error;
    }
  };

  const handleCancel = async (job: FieldServiceJob) => {
    if (!selectedStoreId) return;
    try {
      await merchantApi.cancelFieldJob(selectedStoreId, job.id);
      toast.success(labels.cancelSuccess);
      await loadJobs();
    } catch (error) {
      console.log("[FieldJobs] cancel failed:", error);
      toast.error(labels.saveFailed);
    }
  };

  const columns: ColumnsType<FieldServiceJob> = [
    {
      title: labels.customerName,
      dataIndex: "customerName",
      key: "customerName",
      render: (_, record) => (
        <div>
          <div className="font-medium">{record.customerName}</div>
          <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {record.customerPhone}
          </div>
        </div>
      ),
    },
    {
      title: labels.serviceType,
      dataIndex: "serviceType",
      key: "serviceType",
      width: 110,
      render: (value: string) => serviceTypeLabel(value),
    },
    {
      title: `${labels.scheduledStart}`,
      key: "schedule",
      width: 180,
      render: (_, record) => (
        <div className="text-sm">
          <div>{dayjs(record.scheduledStart).format("MM-DD HH:mm")}</div>
          <div style={{ color: "var(--muted-foreground)" }}>
            {dayjs(record.scheduledEnd).format("MM-DD HH:mm")}
          </div>
        </div>
      ),
    },
    {
      title: labels.serviceAddress,
      dataIndex: "serviceAddress",
      key: "serviceAddress",
      ellipsis: true,
      render: (value: string) => (
        <span className="inline-flex items-center gap-1 text-sm">
          <MapPin size={13} />
          {value}
        </span>
      ),
    },
    {
      title: labels.employee,
      key: "employee",
      width: 120,
      render: (_, record) => record.assignment?.employeeName || "—",
    },
    {
      title: t.status,
      dataIndex: "status",
      key: "status",
      width: 110,
      render: (value: FieldJobStatus) => (
        <Tag color={STATUS_COLORS[value]}>{statusLabel(value)}</Tag>
      ),
    },
    {
      title: t.actions,
      key: "actions",
      width: 220,
      render: (_, record) => (
        <div className="flex flex-wrap gap-2">
          <Button size="small" onClick={() => handleEdit(record)}>
            {labels.edit}
          </Button>
          {record.status === "pending" || record.status === "assigned" ? (
            <Button size="small" type="primary" icon={<UserPlus size={14} />} onClick={() => handleAssign(record)}>
              {labels.assign}
            </Button>
          ) : null}
          {record.status !== "completed" && record.status !== "cancelled" ? (
            <Button size="small" danger onClick={() => handleCancel(record)}>
              {labels.cancel}
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div data-cmp="FieldJobs" className="flex min-h-[calc(100vh-112px)] flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-col gap-3 md:flex-row md:items-center">
          <Segmented
            value={viewMode}
            onChange={(value) => setViewMode(value as FieldJobViewMode)}
            options={[
              {
                value: "list",
                label: (
                  <span className="inline-flex items-center gap-1.5 px-1">
                    <LayoutList size={14} />
                    {labels.viewList}
                  </span>
                ),
              },
              {
                value: "calendar",
                label: (
                  <span className="inline-flex items-center gap-1.5 px-1">
                    <CalendarDays size={14} />
                    {labels.viewCalendar}
                  </span>
                ),
              },
            ]}
          />
          <Input
            allowClear
            prefix={<Search size={16} />}
            placeholder={labels.searchPlaceholder}
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="md:max-w-xs"
          />
          <Select
            value={status}
            onChange={setStatus}
            options={statusOptions}
            className="md:w-44"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button icon={<RefreshCw size={16} />} onClick={() => void loadJobs()}>
            {labels.refresh}
          </Button>
          <Button type="primary" icon={<Plus size={16} />} onClick={handleCreate}>
            {labels.create}
          </Button>
        </div>
      </div>

      {viewMode === "list" ? (
        <Table
          rowKey="id"
          loading={loading}
          columns={columns}
          dataSource={jobs}
          pagination={{ pageSize: 20, showSizeChanger: false }}
          locale={{ emptyText: selectedStoreId ? undefined : labels.storeRequired }}
        />
      ) : (
        <FieldJobCalendarView
          jobs={jobs}
          loading={loading}
          selectedDate={selectedDate}
          calendarMonth={calendarMonth}
          locale={locale}
          labels={labels as unknown as Record<string, unknown>}
          statusColors={STATUS_COLORS}
          statusLabel={statusLabel}
          serviceTypeLabel={serviceTypeLabel}
          onSelectedDateChange={handleSelectedDateChange}
          onCalendarMonthChange={setCalendarMonth}
          onEdit={handleEdit}
          onAssign={handleAssign}
          onCancel={handleCancel}
        />
      )}

      <FieldJobFormModal
        open={formOpen}
        job={editingJob}
        locale={locale}
        labels={labels as unknown as Record<string, unknown>}
        onCancel={() => {
          setFormOpen(false);
          setEditingJob(null);
        }}
        onSubmit={handleSave}
      />

      <FieldJobAssignModal
        open={assignOpen}
        job={assigningJob}
        storeId={selectedStoreId}
        storeNameById={storeNameById}
        employees={employees}
        dateLeaves={dateLeavesForStore}
        shiftLeaves={shiftLeavesForStore}
        scheduleShifts={scheduleShifts.filter((shift) => shift.storeId === selectedStoreId)}
        locale={locale}
        labels={labels as unknown as Record<string, unknown>}
        onCancel={() => {
          setAssignOpen(false);
          setAssigningJob(null);
        }}
        onSubmit={handleAssignSubmit}
      />
    </div>
  );
}
