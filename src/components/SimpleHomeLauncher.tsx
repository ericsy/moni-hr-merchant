import {
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Fingerprint,
  Route,
  Store,
  Users,
} from "lucide-react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  getPagePath,
  resolveRouteConfigFromFeature,
  type PageKey,
} from "../config/routes";
import { useLocale } from "../context/LocaleContext";
import { usePermissions } from "../context/PermissionsContext";
import { useStore } from "../context/StoreContext";
import type { MerchantFeatureTreeNode } from "../lib/merchantApi";

/** 简易版控制台快捷入口顺序（按产品要求） */
const SIMPLE_HOME_SHORTCUTS: PageKey[] = [
  "rosters",
  "attendanceRequests",
  "clockPunches",
  "rosterTemplate",
  "employees",
  "stores",
  "fieldJobs",
];

const shortcutIcons: Record<string, React.ReactNode> = {
  rosters: <CalendarRange size={28} />,
  attendanceRequests: <ClipboardList size={28} />,
  clockPunches: <Fingerprint size={28} />,
  rosterTemplate: <CalendarDays size={28} />,
  employees: <Users size={28} />,
  stores: <Store size={28} />,
  fieldJobs: <Route size={28} />,
};

function collectAuthorizedPageKeys(nodes: MerchantFeatureTreeNode[]) {
  const keys = new Set<PageKey>();
  const visit = (list: MerchantFeatureTreeNode[]) => {
    for (const node of list) {
      if (node.status !== 1) continue;
      const routeConfig = resolveRouteConfigFromFeature(node);
      if (routeConfig) keys.add(routeConfig.pageKey);
      if (node.children?.length) visit(node.children);
    }
  };
  visit(nodes);
  return keys;
}

function collectAuthorizedPaths(nodes: MerchantFeatureTreeNode[]) {
  const map = new Map<PageKey, string>();
  const visit = (list: MerchantFeatureTreeNode[]) => {
    for (const node of list) {
      if (node.status !== 1) continue;
      const routeConfig = resolveRouteConfigFromFeature(node);
      if (routeConfig && !map.has(routeConfig.pageKey)) {
        map.set(routeConfig.pageKey, routeConfig.path);
      }
      if (node.children?.length) visit(node.children);
    }
  };
  visit(nodes);
  return map;
}

export default function SimpleHomeLauncher() {
  const navigate = useNavigate();
  const { t } = useLocale();
  const { permissions } = usePermissions();
  const { selectedStoreId } = useStore();

  const authorizedKeys = useMemo(
    () => collectAuthorizedPageKeys(permissions),
    [permissions],
  );
  const pathByPageKey = useMemo(
    () => collectAuthorizedPaths(permissions),
    [permissions],
  );

  const simpleLabels = t.home.simple;

  const shortcuts = useMemo(() => {
    return SIMPLE_HOME_SHORTCUTS.filter((pageKey) => {
      if (pageKey === "stores") return true;
      return authorizedKeys.has(pageKey);
    }).map((pageKey) => {
      const label =
        simpleLabels.shortcuts[pageKey as keyof typeof simpleLabels.shortcuts] ||
        t.nav[pageKey as keyof typeof t.nav] ||
        pageKey;
      const path = pathByPageKey.get(pageKey) || getPagePath(pageKey) || "/";
      return {
        pageKey,
        label,
        path,
        icon: shortcutIcons[pageKey],
      };
    });
  }, [authorizedKeys, pathByPageKey, simpleLabels.shortcuts, t.nav]);

  return (
    <div data-cmp="SimpleHomeLauncher" className="flex flex-col gap-5">
      <div>
        <div
          className="text-sm font-medium"
          style={{ color: "var(--muted-foreground)" }}
        >
          {simpleLabels.eyebrow}
        </div>
        <h1
          className="mt-1 text-2xl font-semibold leading-tight"
          style={{ color: "var(--foreground)" }}
        >
          {simpleLabels.title}
        </h1>
        <div className="mt-1 text-sm" style={{ color: "var(--muted-foreground)" }}>
          {simpleLabels.hint}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shortcuts.map((item) => (
          <button
            key={item.pageKey}
            type="button"
            onClick={() => navigate(item.path)}
            className="flex flex-col items-start gap-3 rounded-xl p-4 text-left transition-colors"
            style={{
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--foreground)",
              boxShadow: "0 6px 18px rgba(15, 23, 42, 0.06)",
            }}
            onMouseEnter={(event) => {
              event.currentTarget.style.borderColor = "var(--primary)";
              event.currentTarget.style.background = "var(--secondary)";
            }}
            onMouseLeave={(event) => {
              event.currentTarget.style.borderColor = "var(--border)";
              event.currentTarget.style.background = "var(--card)";
            }}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-lg"
              style={{
                background: "rgba(37, 99, 235, 0.1)",
                color: "var(--primary)",
              }}
            >
              {item.icon}
            </div>
            <div className="text-base font-semibold leading-snug">{item.label}</div>
            {!selectedStoreId && item.pageKey !== "stores" ? (
              <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {simpleLabels.selectStoreFirst}
              </div>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  );
}
