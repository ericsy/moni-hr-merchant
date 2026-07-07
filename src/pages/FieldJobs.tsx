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
import { filterLeavesForStore, getEmployeeFieldJobBlockInfo } from "../lib/employeeLeave";
import { applyFieldJobAssignments } from "../lib/fieldJobAssignment";
import {
  buildFieldJobAssignmentPayloads,
  buildFieldJobEmployeeOptions,
  getFieldJobEmployeeNamesLabel,
  isFieldJobAssigned,
  listActiveEmployeesForStore,
  shouldSyncFieldJobAssignments,
} from "../lib/fieldJobEmployees";
import { filterJobsInWeek, getWeekStart } from "../lib/fieldJobSchedule";
import { ApiError } from "../lib/apiClient";
import { merchantApi } from "../lib/merchantApi";
import type { FieldJobFormSubmitPayload, FieldJobAssignPayload, FieldJobStatus, FieldServiceJob } from "../types/fieldService";

type FieldJobViewMode = "list" | "calendar";

const STATUS_COLORS: Record<FieldJobStatus, string> = {
  pending: "default",
  assigned: "processing",
  in_progress: "blue",
  completed: "success",
  cancelled: "error",
};

function getApiErrorMessage(error: unknown, fallback: string) {
  if (error instanceof ApiError && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export default function FieldJobs() {
  const { t, locale } = useLocale();
  const labels = t.fieldJobs;
  const { selectedStoreId } = useStore();
  const { scheduleShifts, stores, employeeDateLeaves, employeeShiftLeaves, employees: contextEmployees } = useData();

  const dateLeavesForStore = useMemo(
    () => filterLeavesForStore(employeeDateLeaves, selectedStoreId),
    [employeeDateLeaves, selectedStoreId],
  );
  const shiftLeavesForStore = useMemo(
    () => filterLeavesForStore(employeeShiftLeaves, selectedStoreId),
    [employeeShiftLeaves, selectedStoreId],
  );

  const [allJobs, setAllJobs] = useState<FieldServiceJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<FieldJobStatus | "">("");
  const [viewMode, setViewMode] = useState<FieldJobViewMode>("calendar");
  const [selectedDate, setSelectedDate] = useState<Dayjs>(() => dayjs().startOf("day"));
  const [weekStart, setWeekStart] = useState<Dayjs>(() => dayjs().startOf("isoWeek"));
  const [formOpen, setFormOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [editingJob, setEditingJob] = useState<FieldServiceJob | null>(null);
  const [assigningJob, setAssigningJob] = useState<FieldServiceJob | null>(null);

  const employees = useMemo(
    () => listActiveEmployeesForStore(contextEmployees, selectedStoreId),
    [contextEmployees, selectedStoreId],
  );

  const formEmployeeOptions = useMemo(
    () => buildFieldJobEmployeeOptions(employees, editingJob),
    [employees, editingJob],
  );

  const assignEmployeeOptions = useMemo(
    () => buildFieldJobEmployeeOptions(employees, assigningJob),
    [employees, assigningJob],
  );

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

  const jobs = useMemo(() => {
    if (viewMode === "calendar") {
      return filterJobsInWeek(allJobs, weekStart);
    }
    return allJobs;
  }, [allJobs, viewMode, weekStart]);

  const loadJobs = useCallback(async () => {
    if (!selectedStoreId) {
      setAllJobs([]);
      return;
    }

    try {
      setLoading(true);
      const items = await merchantApi.listFieldJobs(selectedStoreId, {
        storeId: selectedStoreId,
        status,
        q: search.trim() || undefined,
        page: 1,
        size: viewMode === "calendar" ? 200 : 50,
      });
      setAllJobs(items);
    } catch (error) {
      console.log("[FieldJobs] load failed:", error);
      toast.error(labels.loadFailed);
      setAllJobs([]);
    } finally {
      setLoading(false);
    }
  }, [labels.loadFailed, search, selectedStoreId, status, viewMode]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const handleSelectedDateChange = useCallback((date: Dayjs) => {
    const nextDate = date.startOf("day");
    setSelectedDate(nextDate);
    const nextWeekStart = getWeekStart(nextDate);
    if (!nextWeekStart.isSame(weekStart, "day")) {
      setWeekStart(nextWeekStart);
    }
  }, [weekStart]);

  const handleWeekChange = useCallback((nextWeekStart: Dayjs) => {
    setWeekStart(getWeekStart(nextWeekStart));
  }, []);

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

  const getEmployeeBlockMessage = useCallback(
    (employeeId: string, scheduledStart: string, scheduledEnd: string) => {
      const blockInfo = getEmployeeFieldJobBlockInfo(
        employeeId,
        scheduledStart,
        scheduledEnd,
        dateLeavesForStore,
        shiftLeavesForStore,
        allJobs,
        { excludeJobId: editingJob?.id },
      );
      if (!blockInfo) return "";

      const employeeName =
        employees.find((employee) => employee.id === employeeId)?.name || employeeId;

      if (blockInfo.reason === "leave") {
        return labels.employeeUnavailableLeave.replace("{name}", employeeName);
      }

      const conflictCustomer = blockInfo.conflictingJob?.customerName?.trim();
      const template = conflictCustomer
        ? labels.employeeUnavailableConflictWithJob
        : labels.employeeUnavailableConflict;
      return template
        .replace("{name}", employeeName)
        .replace("{customer}", conflictCustomer || "");
    },
    [
      allJobs,
      dateLeavesForStore,
      editingJob?.id,
      employees,
      labels.employeeUnavailableConflict,
      labels.employeeUnavailableConflictWithJob,
      labels.employeeUnavailableLeave,
      shiftLeavesForStore,
    ],
  );

  const handleSave = async (payload: FieldJobFormSubmitPayload) => {
    if (!selectedStoreId) {
      toast.error(labels.storeRequired);
      return;
    }

    const { merchantAdminIds = [], syncStoreClockIn, syncStoreClockOut, assignmentsOnly, ...upsert } = payload;

    for (const employeeId of merchantAdminIds) {
      const blockMessage = getEmployeeBlockMessage(
        employeeId,
        upsert.scheduledStart,
        upsert.scheduledEnd,
      );
      if (blockMessage) {
        toast.error(blockMessage);
        return;
      }
    }

    try {
      let jobId = editingJob?.id;

      if (assignmentsOnly && editingJob) {
        if (merchantAdminIds.length === 0) {
          toast.error(labels.employeeRequired);
          return;
        }
        const assignments = buildFieldJobAssignmentPayloads(editingJob, merchantAdminIds, {
          syncStoreClockIn: merchantAdminIds.length === 1 ? !!syncStoreClockIn : false,
          syncStoreClockOut: merchantAdminIds.length === 1 ? !!syncStoreClockOut : false,
        });
        const assignmentChanged = shouldSyncFieldJobAssignments(editingJob, assignments);
        const synced = await applyFieldJobAssignments(
          selectedStoreId,
          editingJob.id,
          editingJob,
          assignments,
          { force: true },
        );
        if (!synced) {
          toast.message(labels.assignUnchanged);
          return;
        }
        toast.success(assignmentChanged ? labels.reassignSuccess : labels.saveSuccess);
        setFormOpen(false);
        setEditingJob(null);
        await loadJobs();
        return;
      }

      if (editingJob) {
        await merchantApi.updateFieldJob(selectedStoreId, editingJob.id, {
          ...upsert,
          storeId: selectedStoreId,
        });
      } else {
        const created = await merchantApi.createFieldJob(selectedStoreId, {
          ...upsert,
          storeId: selectedStoreId,
        });
        jobId = created.id;
      }

      if (jobId) {
        const assignments = buildFieldJobAssignmentPayloads(editingJob, merchantAdminIds, {
          syncStoreClockIn: merchantAdminIds.length === 1 ? !!syncStoreClockIn : false,
          syncStoreClockOut: merchantAdminIds.length === 1 ? !!syncStoreClockOut : false,
        });
        const synced = await applyFieldJobAssignments(
          selectedStoreId,
          jobId,
          editingJob,
          assignments,
          { force: merchantAdminIds.length > 0 },
        );
        if (merchantAdminIds.length > 0 && !synced) {
          toast.message(labels.assignUnchanged);
          return;
        }
      }

      toast.success(labels.saveSuccess);
      setFormOpen(false);
      setEditingJob(null);
      await loadJobs();
    } catch (error) {
      console.log("[FieldJobs] save failed:", error);
      for (const employeeId of merchantAdminIds) {
        const blockMessage = getEmployeeBlockMessage(
          employeeId,
          upsert.scheduledStart,
          upsert.scheduledEnd,
        );
        if (blockMessage) {
          toast.error(blockMessage);
          return;
        }
      }
      toast.error(getApiErrorMessage(error, labels.saveFailed));
    }
  };

  const handleAssignSubmit = async (payload: { assignments: FieldJobAssignPayload[] }) => {
    if (!selectedStoreId || !assigningJob) return;

    if (payload.assignments.length === 0) {
      toast.error(labels.employeeRequired);
      return;
    }

    const isReassign = isFieldJobAssigned(assigningJob);

    try {
      const synced = await applyFieldJobAssignments(
        selectedStoreId,
        assigningJob.id,
        assigningJob,
        payload.assignments,
        { force: true },
      );
      if (!synced) {
        toast.message(labels.assignUnchanged);
        return;
      }
      toast.success(isReassign ? labels.reassignSuccess : labels.assignSuccess);
      setAssignOpen(false);
      setAssigningJob(null);
      await loadJobs();
    } catch (error) {
      console.log("[FieldJobs] assign failed:", error);
      toast.error(
        getApiErrorMessage(error, isReassign ? labels.reassignFailed : labels.assignFailed),
      );
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
      render: (_, record) => getFieldJobEmployeeNamesLabel(record, "—", employees),
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
              {isFieldJobAssigned(record) ? labels.reassign : labels.assign}
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
          weekStart={weekStart}
          locale={locale}
          labels={labels as unknown as Record<string, unknown>}
          statusColors={STATUS_COLORS}
          statusLabel={statusLabel}
          serviceTypeLabel={serviceTypeLabel}
          onSelectedDateChange={handleSelectedDateChange}
          onWeekChange={handleWeekChange}
          onEdit={handleEdit}
          onAssign={handleAssign}
          onCancel={handleCancel}
        />
      )}

      <FieldJobFormModal
        open={formOpen}
        job={editingJob}
        storeId={selectedStoreId}
        storeNameById={storeNameById}
        scheduleShifts={scheduleShifts.filter((shift) => shift.storeId === selectedStoreId)}
        employees={formEmployeeOptions}
        dateLeaves={dateLeavesForStore}
        shiftLeaves={shiftLeavesForStore}
        existingJobs={allJobs}
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
        employees={assignEmployeeOptions}
        dateLeaves={dateLeavesForStore}
        shiftLeaves={shiftLeavesForStore}
        existingJobs={allJobs}
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
