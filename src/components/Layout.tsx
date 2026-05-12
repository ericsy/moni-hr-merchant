import { useEffect, useMemo, useRef, useState } from "react";
import { Layout as AntLayout, Menu, Button, Avatar, Dropdown, Space, Select, Modal, Form, Input, type MenuProps } from "antd";
import { useNavigate } from "react-router-dom";
import {
  House,
  LayoutDashboard,
  Users,
  Store,
  MapPin,
  CalendarDays,
  Clock,
  Globe,
  ChevronLeft,
  ChevronRight,
  Bell,
  CreditCard,
  KeyRound,
  LogOut,
  User,
  CalendarRange,
} from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { useData } from "../context/DataContext";
import { useStore } from "../context/StoreContext";
import { useAuth } from "../context/AuthContext";
import { usePermissions } from "../context/PermissionsContext";
import { merchantApi, type MerchantFeatureTreeNode } from "../lib/merchantApi";
import { toast } from "sonner";
import {
  getFeaturePageKeyHint,
  getPagePath,
  resolveRouteConfigFromFeature,
  type PageKey,
} from "../config/routes";

const { Option } = Select;

const { Sider, Header, Content } = AntLayout;
type MenuItem = NonNullable<MenuProps["items"]>[number];
const dataReloadPages = new Set<string>([
  "dashboard",
  "employees",
  "stores",
  "areas",
  "schedule",
  "rosters",
  "rosterTemplate",
]);

export type { PageKey } from "../config/routes";

interface LayoutProps {
  currentPage?: PageKey;
  onPageChange?: (page: PageKey) => void;
  children?: React.ReactNode;
}

type ChangePasswordFormValues = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};

export default function AppLayout({
  currentPage = "home",
  onPageChange,
  children,
}: LayoutProps) {
  const navigate = useNavigate();
  const { locale, setLocale, t } = useLocale();
  const { stores, storesLoaded, refreshData, reloadForStore } = useData();
  const { selectedStoreId, setSelectedStoreId } = useStore();
  const { logout, user } = useAuth();
  const { permissions } = usePermissions();
  const [collapsed, setCollapsed] = useState(false);
  const [openMenuKeys, setOpenMenuKeys] = useState<string[]>([]);
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordForm] = Form.useForm<ChangePasswordFormValues>();
  const lastDataReloadKeyRef = useRef("");
  const requiresFirstStore = storesLoaded && stores.length === 0;

  console.log("[Layout] currentPage:", currentPage, "collapsed:", collapsed, "selectedStoreId:", selectedStoreId);

  useEffect(() => {
    if (requiresFirstStore || !dataReloadPages.has(currentPage)) return;

    const reloadKey = `${currentPage}:${selectedStoreId || "__default__"}`;
    if (lastDataReloadKeyRef.current === reloadKey) return;
    lastDataReloadKeyRef.current = reloadKey;

    const reload = selectedStoreId ? reloadForStore(selectedStoreId) : refreshData();
    reload.catch((error) => {
      console.log("[Layout] failed to reload page data:", currentPage, error);
      lastDataReloadKeyRef.current = "";
    });
  }, [currentPage, refreshData, reloadForStore, requiresFirstStore, selectedStoreId]);

  const routePathByPageKey = useMemo(() => {
    const map = new Map<PageKey, string>();

    const visit = (nodes: MerchantFeatureTreeNode[]) => {
      for (const node of nodes) {
        if (node.status !== 1) continue;

        const routeConfig = resolveRouteConfigFromFeature(node);
        if (routeConfig && !map.has(routeConfig.pageKey)) {
          map.set(routeConfig.pageKey, routeConfig.path);
        }

        if (node.children?.length) {
          visit(node.children);
        }
      }
    };

    visit(permissions);
    return map;
  }, [permissions]);

  const { items: menuItems, defaultOpenKeys: defaultOpenMenuKeys } = useMemo(() => {
    const seenPageKeys = new Set<PageKey>();
    const defaultOpenKeys = new Set<string>();
    const iconMap: Record<string, React.ReactNode> = {
      home: <House size={18} />,
      dashboard: <LayoutDashboard size={18} />,
      employees: <Users size={18} />,
      stores: <Store size={18} />,
      areas: <MapPin size={18} />,
      schedule: <Clock size={18} />,
      rosters: <CalendarRange size={18} />,
      rosterTemplate: <CalendarDays size={18} />,
      billing: <CreditCard size={18} />,
    };

    const getNodeLabel = (node: MerchantFeatureTreeNode, fallback: string) => {
      if (locale === "zh") return node.nameZh || node.nameEn || fallback;
      return node.nameEn || node.nameZh || fallback;
    };

    const getFeatureMenuKey = (node: MerchantFeatureTreeNode, label: string) =>
      `feature-${node.id ?? node.url ?? label}`;

    const buildMenuItems = (nodes: MerchantFeatureTreeNode[]): MenuItem[] => {
      return [...nodes]
        .filter((node) => node.status === 1)
        .sort((a, b) => (b.sortOrder ?? 0) - (a.sortOrder ?? 0))
        .flatMap((node) => {
          const children = node.children?.length ? buildMenuItems(node.children) : [];
          const routeConfig = resolveRouteConfigFromFeature(node);

          if (!routeConfig) {
            if (children.length === 0) return [];

            const groupLabel = locale === "zh"
              ? node.nameZh || node.nameEn || ""
              : node.nameEn || node.nameZh || "";
            const groupKey = getFeatureMenuKey(node, groupLabel);
            const groupPageKey = getFeaturePageKeyHint(node);

            defaultOpenKeys.add(groupKey);

            return [{
              key: groupKey,
              icon: groupPageKey ? iconMap[groupPageKey] : undefined,
              label: groupLabel,
              children,
            }];
          }

          if (seenPageKeys.has(routeConfig.pageKey)) {
            return children;
          }

          seenPageKeys.add(routeConfig.pageKey);
          const fallbackLabel = t.nav[routeConfig.pageKey as keyof typeof t.nav] ?? routeConfig.pageKey;

          return [{
            key: routeConfig.pageKey,
            icon: iconMap[routeConfig.pageKey],
            label: getNodeLabel(node, fallbackLabel),
            children: children.length > 0 ? children : undefined,
          }];
        });
    };

    const homeMenuItem: MenuItem = {
      key: "home",
      icon: iconMap.home,
      label: t.nav.home,
    };

    const items = [homeMenuItem, ...buildMenuItems(permissions)];
    if (!requiresFirstStore) {
      return { items, defaultOpenKeys: [...defaultOpenKeys] };
    }

    const storeItems = items.filter((item) => item?.key === "stores");
    const firstStoreItems = storeItems.length > 0
      ? storeItems
      : [{
        key: "stores",
        icon: iconMap.stores,
        label: t.nav.stores,
      }];

    return { items: firstStoreItems, defaultOpenKeys: [] };
  }, [permissions, locale, t, requiresFirstStore]);

  useEffect(() => {
    setOpenMenuKeys((previousKeys) => {
      const nextKeys = new Set([...previousKeys, ...defaultOpenMenuKeys]);
      if (nextKeys.size === previousKeys.length && previousKeys.every((key) => nextKeys.has(key))) {
        return previousKeys;
      }
      return [...nextKeys];
    });
  }, [defaultOpenMenuKeys]);

  const handlePageChange = (page: PageKey) => {
    if (requiresFirstStore && page !== "stores") return;

    if (onPageChange) {
      onPageChange(page);
      return;
    }

    const path = routePathByPageKey.get(page) || getPagePath(page);
    if (path) {
      navigate(path);
    }
  };

  const userMenuItems = [
    { key: "profile", icon: <User size={14} />, label: locale === "zh" ? "个人资料" : "Profile" },
    { key: "changePassword", icon: <KeyRound size={14} />, label: t.employee.changePassword },
    { type: "divider" as const },
    { key: "logout", icon: <LogOut size={14} />, label: locale === "zh" ? "退出登录" : "Logout", danger: true },
  ];

  const openChangePasswordModal = () => {
    passwordForm.resetFields();
    setPasswordModalOpen(true);
  };

  const closeChangePasswordModal = () => {
    if (passwordSaving) return;
    setPasswordModalOpen(false);
    passwordForm.resetFields();
  };

  const handleChangePassword = async () => {
    try {
      const values = await passwordForm.validateFields();
      setPasswordSaving(true);
      await merchantApi.changePassword(values.currentPassword, values.newPassword);
      toast.success(t.employee.passwordChanged);
      setPasswordModalOpen(false);
      passwordForm.resetFields();
      logout();
      navigate("/login", { replace: true });
    } catch (error) {
      const isValidationError =
        typeof error === "object" &&
        error !== null &&
        "errorFields" in error;
      if (!isValidationError) {
        toast.error(error instanceof Error ? error.message : t.employee.passwordChangeFailed);
      }
    } finally {
      setPasswordSaving(false);
    }
  };

  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === "changePassword") {
      openChangePasswordModal();
      return;
    }

    if (key === "logout") {
      console.log("[Layout] user logout");
      logout();
    }
  };

  return (
    <div
      data-cmp="AppLayout"
      className="min-h-screen flex"
      style={{ width: "100%", minWidth: 0 }}
    >
      <AntLayout style={{ minHeight: "100vh", width: "100%" }}>
        {/* Sidebar */}
        <Sider
          width={240}
          collapsedWidth={72}
          collapsed={collapsed}
          style={{
            background: "var(--sidebar)",
            borderRight: "1px solid var(--sidebar-border)",
            position: "fixed",
            height: "100vh",
            left: 0,
            top: 0,
            zIndex: 100,
            overflow: "auto",
          }}
        >
          {/* Logo */}
          <div
            className="flex items-center px-4 py-5"
            style={{
              borderBottom: "1px solid var(--sidebar-border)",
              minHeight: 64,
              overflow: "hidden",
            }}
          >
            <div
              className="flex items-center justify-center rounded-lg flex-shrink-0"
              style={{
                width: 36,
                height: 36,
                background: "var(--primary)",
              }}
            >
              <CalendarDays size={20} color="var(--primary-foreground)" />
            </div>
            {!collapsed && (
              <div className="ml-3 overflow-hidden">
                <div
                  className="font-bold text-base leading-tight"
                  style={{ color: "var(--foreground)" }}
                >
                  MONI-MERCHANT
                </div>
              </div>
            )}
          </div>

          {/* Menu */}
          <Menu
            mode="inline"
            selectedKeys={[currentPage]}
            openKeys={openMenuKeys}
            onOpenChange={setOpenMenuKeys}
            items={menuItems}
            onClick={({ key }) => handlePageChange(key as PageKey)}
            style={{
              background: "transparent",
              border: "none",
              padding: "8px 0",
            }}
          />

          {/* Collapse button */}
          <div
            className="absolute bottom-4 flex items-center justify-center cursor-pointer w-full"
            onClick={() => setCollapsed(!collapsed)}
          >
            <div
              className="flex items-center justify-center rounded-lg px-2 py-1"
              style={{
                color: "var(--muted-foreground)",
                background: "var(--muted)",
                fontSize: 12,
                gap: 4,
              }}
            >
              {collapsed ? (
                <ChevronRight size={16} />
              ) : (
                <span className="flex items-center gap-1">
                  <ChevronLeft size={16} />
                  {locale === "zh" ? "收起" : "Collapse"}
                </span>
              )}
            </div>
          </div>
        </Sider>

        {/* Main area */}
        <AntLayout
          style={{
            marginLeft: collapsed ? 72 : 240,
            transition: "margin 0.2s",
          }}
        >
          {/* Header */}
          <Header
            style={{
              background: "var(--card)",
              borderBottom: "1px solid var(--border)",
              padding: "0 24px",
              height: 64,
              lineHeight: "64px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              position: "sticky",
              top: 0,
              zIndex: 99,
              width: "100%",
              margin: 0,
            }}
          >
            <div
              className="font-semibold text-lg"
              style={{ color: "var(--foreground)" }}
            >
              {t.nav[currentPage as keyof typeof t.nav] ?? currentPage}
            </div>

            <Space size={12}>
              {/* Store Selector */}
              {!requiresFirstStore && (
                <Select
                  value={selectedStoreId}
                  onChange={(v) => {
                    console.log("[Layout] store changed:", v);
                    setSelectedStoreId(v);
                  }}
                  style={{ width: 160 }}
                  size="small"
                  placeholder={locale === "zh" ? "选择店面" : "Select Store"}
                >
                  {stores.map((s) => (
                    <Option key={s.id} value={s.id}>
                      {s.name}
                    </Option>
                  ))}
                </Select>
              )}

              {/* Language switch */}
              <Button
                type="default"
                size="small"
                icon={<Globe size={14} />}
                onClick={() => setLocale(locale === "zh" ? "en" : "zh")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                  borderColor: "var(--border)",
                  color: "var(--foreground)",
                }}
              >
                {locale === "zh" ? "EN" : "中文"}
              </Button>

              {/* Notification */}
              <Button
                type="text"
                icon={<Bell size={18} />}
                style={{
                  display: "flex",
                  alignItems: "center",
                  color: "var(--muted-foreground)",
                }}
              />

              {/* User */}
              <Dropdown
                menu={{ items: userMenuItems, onClick: handleUserMenuClick }}
                placement="bottomRight"
                trigger={["click"]}
              >
                <div className="flex items-center gap-2 cursor-pointer">
                  <Avatar
                    size={32}
                    style={{ background: "var(--primary)", cursor: "pointer" }}
                  >
                    {user?.name?.[0]?.toUpperCase() ?? "A"}
                  </Avatar>
                  {!collapsed && (
                    <span
                      className="text-sm font-medium"
                      style={{ color: "var(--foreground)" }}
                    >
                      {user?.name ?? "Admin"}
                    </span>
                  )}
                </div>
              </Dropdown>
            </Space>
          </Header>

          {/* Content */}
          <Content
            style={{
              padding: "24px",
              minHeight: "calc(100vh - 64px)",
              background: "var(--background)",
            }}
          >
            {children}
          </Content>
        </AntLayout>
      </AntLayout>
      <ChangePasswordModal
        open={passwordModalOpen}
        loading={passwordSaving}
        form={passwordForm}
        t={t}
        onOk={handleChangePassword}
        onCancel={closeChangePasswordModal}
      />
    </div>
  );
}

function ChangePasswordModal({
  open,
  loading,
  form,
  t,
  onOk,
  onCancel,
}: {
  open: boolean;
  loading: boolean;
  form: ReturnType<typeof Form.useForm<ChangePasswordFormValues>>[0];
  t: ReturnType<typeof useLocale>["t"];
  onOk: () => void;
  onCancel: () => void;
}) {
  return (
    <Modal
      open={open}
      title={t.employee.changePasswordTitle}
      onOk={onOk}
      onCancel={onCancel}
      maskClosable={false}
      okText={t.employee.changePassword}
      cancelText={t.cancel}
      confirmLoading={loading}
      destroyOnClose
    >
      <Form form={form} layout="vertical" preserve={false}>
        <Form.Item
          name="currentPassword"
          label={t.employee.currentPassword}
          rules={[{ required: true, message: t.required }]}
        >
          <Input.Password
            autoComplete="current-password"
            placeholder={t.employee.currentPasswordPlaceholder}
          />
        </Form.Item>
        <Form.Item
          name="newPassword"
          label={t.employee.newPassword}
          rules={[
            { required: true, message: t.required },
            { min: 8, message: t.employee.passwordTooShort },
          ]}
        >
          <Input.Password
            autoComplete="new-password"
            placeholder={t.employee.newPasswordPlaceholder}
          />
        </Form.Item>
        <Form.Item
          name="confirmPassword"
          label={t.employee.confirmPassword}
          dependencies={["newPassword"]}
          rules={[
            { required: true, message: t.required },
            ({ getFieldValue }) => ({
              validator(_, value) {
                if (!value || getFieldValue("newPassword") === value) {
                  return Promise.resolve();
                }
                return Promise.reject(new Error(t.employee.passwordMismatch));
              },
            }),
          ]}
        >
          <Input.Password
            autoComplete="new-password"
            placeholder={t.employee.confirmPasswordPlaceholder}
          />
        </Form.Item>
      </Form>
    </Modal>
  );
}
