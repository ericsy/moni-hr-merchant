import type { FieldJobAssignPayload, FieldServiceJob } from "../types/fieldService";
import type { Employee } from "../context/DataContext";

/** Ant Design Select 可能回传 number，统一为字符串避免选项匹配失败、提交丢员工。 */
export function normalizeEmployeeAdminId(value: string | number | null | undefined): string {
  return String(value ?? "").trim();
}

export function normalizeEmployeeAdminIds(
  values: Array<string | number> | null | undefined,
): string[] {
  return (values ?? []).map(normalizeEmployeeAdminId).filter(Boolean);
}

export function getFieldJobEmployeeDisplayName(
  employee: Pick<Employee, "firstName" | "lastName" | "employeeId" | "email" | "id">,
) {
  const fullName = `${employee.firstName || ""} ${employee.lastName || ""}`.trim();
  return fullName || employee.employeeId || employee.email || employee.id || "";
}

export function employeeBelongsToStore(
  employee: Pick<Employee, "storeIds" | "assignedStores" | "storeDetails">,
  storeId: string,
) {
  if (!storeId) return true;
  return (
    employee.storeIds.includes(storeId) ||
    (employee.assignedStores || []).includes(storeId) ||
    (employee.storeDetails || []).some((store) => store.id === storeId)
  );
}

/** 与排班页一致：当前门店在职员工（不要求 App 账号已激活）。 */
export function listActiveEmployeesForStore(
  employees: Employee[],
  storeId: string,
): Array<{ id: string; name: string }> {
  if (!storeId) return [];
  return employees
    .filter((employee) => employee.status === "active")
    .filter((employee) => employeeBelongsToStore(employee, storeId))
    .map((employee) => ({
      id: employee.id,
      name: getFieldJobEmployeeDisplayName(employee),
    }))
    .filter((employee) => employee.id);
}

/** 合并当前工单已分配员工，避免改派时下拉缺少在案人员或选项被静默清空。 */
export function buildFieldJobEmployeeOptions(
  employees: Array<{ id: string; name: string }>,
  job?: FieldServiceJob | null,
): Array<{ id: string; name: string }> {
  const byId = new Map(employees.map((employee) => [String(employee.id), employee]));

  for (const assignment of getFieldJobAssignments(job)) {
    const id = String(assignment.merchantAdminId || "");
    if (!id || byId.has(id)) continue;
    byId.set(id, {
      id,
      name: assignment.employeeName?.trim() || id,
    });
  }

  return Array.from(byId.values()).sort((left, right) =>
    left.name.localeCompare(right.name, undefined, { sensitivity: "base" }),
  );
}

export function getFieldJobAssignments(job?: FieldServiceJob | null) {
  if (job && Array.isArray(job.assignments)) {
    return job.assignments;
  }
  if (job?.assignment?.merchantAdminId) {
    return [job.assignment];
  }
  return [];
}

export function getFieldJobAssignmentEmployeeIds(job?: FieldServiceJob | null) {
  return getFieldJobAssignments(job)
    .map((assignment) => normalizeEmployeeAdminId(assignment.merchantAdminId))
    .filter(Boolean);
}

export function getFieldJobEmployeeNamesLabel(
  job?: FieldServiceJob | null,
  fallback = "—",
  employees?: Array<{ id: string; name: string }>,
) {
  const names = getFieldJobAssignments(job)
    .map((assignment) => {
      const fromAssignment = assignment.employeeName?.trim();
      if (fromAssignment) return fromAssignment;
      const employeeId = String(assignment.merchantAdminId || "");
      return employees?.find((employee) => String(employee.id) === employeeId)?.name || "";
    })
    .filter(Boolean);
  return names.length > 0 ? names.join("、") : fallback;
}

export function isFieldJobAssigned(job?: FieldServiceJob | null) {
  return getFieldJobAssignmentEmployeeIds(job).length > 0;
}

function assignmentPayloadKey(payload: FieldJobAssignPayload) {
  return [
    String(payload.merchantAdminId),
    payload.syncStoreClockIn ? "1" : "0",
    payload.syncStoreClockOut ? "1" : "0",
  ].join(":");
}

export function buildFieldJobAssignmentPayloads(
  job: FieldServiceJob | null | undefined,
  merchantAdminIds: Array<string | number>,
  options?: {
    syncStoreClockIn?: boolean;
    syncStoreClockOut?: boolean;
  },
): FieldJobAssignPayload[] {
  return normalizeEmployeeAdminIds(merchantAdminIds).map((merchantAdminId) => {
    const existing = getFieldJobAssignments(job).find(
      (assignment) =>
        normalizeEmployeeAdminId(assignment.merchantAdminId) === merchantAdminId,
    );
    return {
      merchantAdminId,
      syncStoreClockIn: existing?.syncStoreClockIn ?? options?.syncStoreClockIn ?? false,
      syncStoreClockOut: existing?.syncStoreClockOut ?? options?.syncStoreClockOut ?? false,
    };
  });
}

export function shouldSyncFieldJobAssignments(
  job: FieldServiceJob | null | undefined,
  assignments: FieldJobAssignPayload[],
) {
  const current = buildFieldJobAssignmentPayloads(
    job,
    getFieldJobAssignmentEmployeeIds(job),
  );
  const currentKeys = current.map(assignmentPayloadKey).sort();
  const nextKeys = assignments.map(assignmentPayloadKey).sort();
  return currentKeys.join("|") !== nextKeys.join("|");
}
