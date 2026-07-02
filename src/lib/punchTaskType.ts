import type { MerchantClockPunch } from "./merchantApi";

export type PunchTaskKind =
  | "store_shift"
  | "field_job"
  | "field_sync_store_in"
  | "field_sync_store_out";

function normalizeRefType(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/-/g, "_");
}

function normalizeSyncEffect(value: string | null | undefined): string {
  return (value ?? "none").trim().toLowerCase().replace(/-/g, "_");
}

export function isFieldJobClockPunch(punch: Pick<MerchantClockPunch, "refType" | "refId" | "publishedCellId">): boolean {
  if (normalizeRefType(punch.refType) === "field_job") return true;
  const cellId = Number(punch.publishedCellId);
  return (!Number.isFinite(cellId) || cellId <= 0) && punch.refId != null && String(punch.refId).trim() !== "";
}

export function resolvePunchTaskKind(punch: Pick<MerchantClockPunch, "refType" | "refId" | "publishedCellId" | "syncEffect">): PunchTaskKind {
  if (isFieldJobClockPunch(punch)) return "field_job";
  const sync = normalizeSyncEffect(punch.syncEffect);
  if (sync === "store_clock_in") return "field_sync_store_in";
  if (sync === "store_clock_out") return "field_sync_store_out";
  return "store_shift";
}

export type PunchTaskLabels = {
  taskStoreShift: string;
  taskFieldJob: string;
  taskFieldSyncStoreIn: string;
  taskFieldSyncStoreOut: string;
};

export function formatPunchTaskTypeLabel(
  punch: Pick<MerchantClockPunch, "refType" | "refId" | "publishedCellId" | "syncEffect">,
  labels: PunchTaskLabels,
): string {
  switch (resolvePunchTaskKind(punch)) {
    case "field_job":
      return labels.taskFieldJob;
    case "field_sync_store_in":
      return labels.taskFieldSyncStoreIn;
    case "field_sync_store_out":
      return labels.taskFieldSyncStoreOut;
    case "store_shift":
    default:
      return labels.taskStoreShift;
  }
}

export function punchTaskTagColor(kind: PunchTaskKind): string {
  switch (kind) {
    case "field_job":
      return "geekblue";
    case "field_sync_store_in":
    case "field_sync_store_out":
      return "purple";
    case "store_shift":
    default:
      return "default";
  }
}
