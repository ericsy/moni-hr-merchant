import { Button, Dropdown, type MenuProps } from "antd";
import {
  CalendarDays,
  CalendarRange,
  ChevronDown,
  ClipboardList,
  Fingerprint,
  Route,
  Store,
  Users,
} from "lucide-react";
import { useMemo, type CSSProperties } from "react";
import { useNavigate } from "react-router-dom";
import {
  getFeatureDisplayName,
  getFeaturePageKeyHint,
  getPagePath,
  resolveRouteConfigFromFeature,
  type PageKey,
} from "../config/routes";
import { useLocale } from "../context/LocaleContext";
import { usePermissions } from "../context/PermissionsContext";
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
  rosters: <CalendarRange size={16} />,
  attendanceRequests: <ClipboardList size={16} />,
  clockPunches: <Fingerprint size={16} />,
  rosterTemplate: <CalendarDays size={16} />,
  employees: <Users size={16} />,
  stores: <Store size={16} />,
  fieldJobs: <Route size={16} />,
};

interface ShortcutLeaf {
  pageKey: PageKey;
  label: string;
  path: string;
}

interface ShortcutItem {
  key: string;
  pageKey: PageKey;
  label: string;
  icon: React.ReactNode;
  path?: string;
  children?: ShortcutLeaf[];
}

function collectLeaves(
  nodes: MerchantFeatureTreeNode[] | null | undefined,
  locale: "zh" | "en",
  navLabels: Record<string, string>,
): ShortcutLeaf[] {
  if (!nodes?.length) return [];

  const leaves: ShortcutLeaf[] = [];
  const visit = (list: MerchantFeatureTreeNode[]) => {
    for (const node of [...list]
      .filter((item) => item.status === 1)
      .sort((a, b) => (b.sortOrder ?? 0) - (a.sortOrder ?? 0))) {
      const routeConfig = resolveRouteConfigFromFeature(node);
      if (routeConfig) {
        const fallback =
          navLabels[routeConfig.pageKey] || String(routeConfig.pageKey);
        leaves.push({
          pageKey: routeConfig.pageKey,
          label: getFeatureDisplayName(node, locale, fallback),
          path: routeConfig.path,
        });
      }
      if (node.children?.length) visit(node.children);
    }
  };
  visit(nodes);
  return leaves;
}

function nodeContainsPageKey(node: MerchantFeatureTreeNode, pageKey: PageKey): boolean {
  const routeConfig = resolveRouteConfigFromFeature(node);
  if (routeConfig?.pageKey === pageKey) return true;
  if (!node.children?.length) return false;
  return node.children.some((child) => nodeContainsPageKey(child, pageKey));
}

/** 优先匹配带二级权限的分组，否则匹配叶子页面节点 */
function findNodeForShortcut(
  nodes: MerchantFeatureTreeNode[],
  pageKey: PageKey,
): MerchantFeatureTreeNode | undefined {
  let leafMatch: MerchantFeatureTreeNode | undefined;

  const visit = (list: MerchantFeatureTreeNode[]): MerchantFeatureTreeNode | undefined => {
    for (const node of list) {
      if (node.status !== 1) continue;

      const routeConfig = resolveRouteConfigFromFeature(node);
      const hasChildren = Boolean(node.children?.length);
      const hint = getFeaturePageKeyHint(node);
      const matchesHint = hint === pageKey;
      const containsTarget = nodeContainsPageKey(node, pageKey);

      // 结构分组 / 带子节点的入口：作为二级菜单宿主
      if (hasChildren && (matchesHint || containsTarget) && (!routeConfig || containsTarget)) {
        const childLeaves = collectLeaves(node.children, "zh", {});
        if (childLeaves.length > 0 && (matchesHint || childLeaves.some((leaf) => leaf.pageKey === pageKey))) {
          return node;
        }
      }

      if (routeConfig?.pageKey === pageKey && !leafMatch) {
        leafMatch = node;
      }

      if (hasChildren) {
        const nested = visit(node.children || []);
        if (nested) return nested;
      }
    }
    return undefined;
  };

  return visit(nodes) || leafMatch;
}

function buildShortcutItem(
  pageKey: PageKey,
  node: MerchantFeatureTreeNode | undefined,
  locale: "zh" | "en",
  navLabels: Record<string, string>,
  simpleLabels: Record<string, string>,
): ShortcutItem | null {
  const fallbackLabel =
    simpleLabels[pageKey] || navLabels[pageKey] || String(pageKey);
  const icon = shortcutIcons[pageKey] || <Route size={16} />;

  if (!node) {
    if (pageKey !== "stores") return null;
    return {
      key: pageKey,
      pageKey,
      label: fallbackLabel,
      icon,
      path: getPagePath(pageKey) || "/stores",
    };
  }

  const routeConfig = resolveRouteConfigFromFeature(node);
  const childLeaves = collectLeaves(node.children, locale, navLabels);

  // 有二级权限：下拉，不直接进页
  if (childLeaves.length > 0) {
    return {
      key: `group-${node.id ?? pageKey}`,
      pageKey,
      label: getFeatureDisplayName(node, locale, fallbackLabel),
      icon,
      children: childLeaves,
    };
  }

  if (!routeConfig) return null;

  return {
    key: routeConfig.pageKey,
    pageKey: routeConfig.pageKey,
    label: getFeatureDisplayName(node, locale, fallbackLabel),
    icon,
    path: routeConfig.path,
  };
}

export default function SimpleHomeLauncher() {
  const navigate = useNavigate();
  const { locale, t } = useLocale();
  const { permissions } = usePermissions();
  const simpleLabels = t.home.simple;
  const navLabels = t.nav as Record<string, string>;
  const shortcutLabelMap = simpleLabels.shortcuts as Record<string, string>;

  const shortcuts = useMemo(() => {
    const usedPageKeys = new Set<PageKey>();
    const items: ShortcutItem[] = [];

    for (const pageKey of SIMPLE_HOME_SHORTCUTS) {
      const node = findNodeForShortcut(permissions, pageKey);
      const item = buildShortcutItem(
        pageKey,
        node,
        locale,
        navLabels,
        shortcutLabelMap,
      );
      if (!item) continue;

      if (item.children?.length) {
        const children = item.children.filter(
          (child) => !usedPageKeys.has(child.pageKey),
        );
        if (children.length === 0) continue;
        children.forEach((child) => usedPageKeys.add(child.pageKey));
        items.push({
          ...item,
          label: shortcutLabelMap[pageKey] || item.label,
          children,
        });
        continue;
      }

      if (!item.path || usedPageKeys.has(item.pageKey)) continue;
      usedPageKeys.add(item.pageKey);
      items.push({
        ...item,
        label: shortcutLabelMap[pageKey] || item.label,
      });
    }

    return items;
  }, [locale, navLabels, permissions, shortcutLabelMap]);

  const goTo = (path: string) => {
    navigate(path);
  };

  return (
    <div data-cmp="SimpleHomeLauncher" className="flex flex-col gap-3">
      <div>
        <h1
          className="text-lg font-semibold leading-tight"
          style={{ color: "var(--foreground)" }}
        >
          {simpleLabels.title}
        </h1>
        <div className="mt-0.5 text-xs" style={{ color: "var(--muted-foreground)" }}>
          {simpleLabels.hint}
        </div>
      </div>

      <div className="flex flex-wrap items-stretch gap-2">
        {shortcuts.map((item) => {
          const buttonStyle: CSSProperties = {
            width: 168,
            minWidth: 168,
            height: 44,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "flex-start",
            gap: 8,
            paddingInline: 14,
            textAlign: "left",
          };

          if (item.children?.length) {
            const menuItems: MenuProps["items"] = item.children.map((child) => ({
              key: child.path,
              label: child.label,
            }));

            return (
              <Dropdown
                key={item.key}
                trigger={["click"]}
                menu={{
                  items: menuItems,
                  onClick: ({ key }) => goTo(String(key)),
                }}
              >
                <Button type="default" icon={item.icon} style={buttonStyle}>
                  <span className="flex-1 truncate">{item.label}</span>
                  <ChevronDown size={14} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
                </Button>
              </Dropdown>
            );
          }

          return (
            <Button
              key={item.key}
              type="default"
              icon={item.icon}
              onClick={() => item.path && goTo(item.path)}
              style={buttonStyle}
            >
              <span className="flex-1 truncate text-left">{item.label}</span>
            </Button>
          );
        })}
      </div>
    </div>
  );
}
