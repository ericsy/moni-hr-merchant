import type { FieldJobAssignPayload, FieldServiceJob } from "../types/fieldService";
import {
  buildFieldJobAssignmentPayloads,
  normalizeEmployeeAdminId,
  shouldSyncFieldJobAssignments,
} from "./fieldJobEmployees";
import { merchantApi } from "./merchantApi";

function normalizeAssignmentPayloads(assignments: FieldJobAssignPayload[]): FieldJobAssignPayload[] {
  return assignments
    .map((item) => ({
      merchantAdminId: normalizeEmployeeAdminId(item.merchantAdminId),
      syncStoreClockIn: !!item.syncStoreClockIn,
      syncStoreClockOut: !!item.syncStoreClockOut,
    }))
    .filter((item) => item.merchantAdminId);
}

export { isFieldJobAssigned } from "./fieldJobEmployees";

export function shouldApplyFieldJobAssignments(
  job: FieldServiceJob | null | undefined,
  merchantAdminIds: string[],
  options?: {
    syncStoreClockIn?: boolean;
    syncStoreClockOut?: boolean;
  },
) {
  const assignments = buildFieldJobAssignmentPayloads(job, merchantAdminIds, options);
  return shouldSyncFieldJobAssignments(job, assignments);
}

export async function applyFieldJobAssignments(
  storeId: string,
  jobId: string,
  job: FieldServiceJob | null | undefined,
  assignments: FieldJobAssignPayload[],
): Promise<boolean> {
  const normalized = normalizeAssignmentPayloads(assignments);
  if (normalized.length === 0) {
    return false;
  }
  if (!shouldSyncFieldJobAssignments(job, normalized)) {
    return false;
  }

  await merchantApi.syncFieldJobAssignments(storeId, jobId, { assignments: normalized });
  return true;
}
