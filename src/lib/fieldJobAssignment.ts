import type { FieldJobAssignPayload, FieldServiceJob } from "../types/fieldService";
import {
  buildFieldJobAssignmentPayloads,
  isFieldJobAssigned,
  shouldSyncFieldJobAssignments,
} from "./fieldJobEmployees";
import { merchantApi } from "./merchantApi";

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
  if (!shouldSyncFieldJobAssignments(job, assignments)) {
    return false;
  }

  await merchantApi.syncFieldJobAssignments(storeId, jobId, { assignments });
  return true;
}
