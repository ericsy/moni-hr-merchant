import type { FieldJobAssignPayload, FieldServiceJob } from "../types/fieldService";

export function getFieldJobAssignments(job?: FieldServiceJob | null) {
  if (job?.assignments?.length) {
    return job.assignments;
  }
  if (job?.assignment?.merchantAdminId) {
    return [job.assignment];
  }
  return [];
}

export function getFieldJobAssignmentEmployeeIds(job?: FieldServiceJob | null) {
  return getFieldJobAssignments(job)
    .map((assignment) => String(assignment.merchantAdminId))
    .filter(Boolean);
}

export function getFieldJobEmployeeNamesLabel(job?: FieldServiceJob | null, fallback = "—") {
  const names = getFieldJobAssignments(job)
    .map((assignment) => assignment.employeeName?.trim())
    .filter(Boolean);
  return names.length > 0 ? names.join("、") : fallback;
}

export function isFieldJobAssigned(job?: FieldServiceJob | null) {
  return getFieldJobAssignmentEmployeeIds(job).length > 0;
}

function assignmentPayloadKey(payload: FieldJobAssignPayload) {
  return [
    payload.merchantAdminId,
    payload.syncStoreClockIn ? "1" : "0",
    payload.syncStoreClockOut ? "1" : "0",
  ].join(":");
}

export function buildFieldJobAssignmentPayloads(
  job: FieldServiceJob | null | undefined,
  merchantAdminIds: string[],
  options?: {
    syncStoreClockIn?: boolean;
    syncStoreClockOut?: boolean;
  },
): FieldJobAssignPayload[] {
  return merchantAdminIds.map((merchantAdminId) => {
    const existing = getFieldJobAssignments(job).find(
      (assignment) => String(assignment.merchantAdminId) === String(merchantAdminId),
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
