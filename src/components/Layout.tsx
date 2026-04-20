import { useState } from "react";
import { Layout as AntLayout, Menu, Button, Avatar, Dropdown, Badge, Space, Select } from "antd";
import {
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
  Settings,
  LogOut,
  User,
  CalendarRange,
} from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { useData } from "../context/DataContext";
import { useStore } from "../context/StoreContext";
import { useAuth } from "../context/AuthContext";

const { Option } = Select;

const { Sider, Header, Content } = AntLayout;

export type PageKey = "dashboard" | "employees" | "stores" | "areas" | "schedule" | "rosterTemplate" | "rosters";

interface LayoutProps {
  currentPage?: PageKey;
  onPageChange?: (page: PageKey) => void;
  children?: React.ReactNode;
}

export default function AppLayout({
  currentPage = "dashboard",
  onPageChange = () => {},
  children,
}: LayoutProps) {
  const { locale, setLocale, t } = useLocale();
  const { stores } = useData();
  const { selectedStoreId, setSelectedStoreId } = useStore();
  const { logout, user } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  console.log("[Layout] currentPage:", currentPage, "collapsed:", collapsed, "selectedStoreId:", selectedStoreId);

  const menuItems = [
    {
      key: "dashboard",
      icon: <LayoutDashboard size={18} />,
      label: t.nav.dashboard,
    },
    {
      key: "employees",
      icon: <Users size={18} />,
      label: t.nav.employees,
    },
    {
      key: "stores",
      icon: <Store size={18} />,
      label: t.nav.stores,
    },
    {
      key: "areas",
      icon: <MapPin size={18} />,
      label: t.nav.areas,
    },
    {
      key: "schedule",
      icon: <Clock size={18} />,
      label: t.nav.schedule,
    },
    {
      key: "rosters",
      icon: <CalendarRange size={18} />,
      label: t.nav.rosters,
    },
    {
      key: "rosterTemplate",
      icon: <CalendarDays size={18} />,
      label: t.nav.rosterTemplate,
    },
  ];

  const userMenuItems = [
    { key: "profile", icon: <User size={14} />, label: locale === "zh" ? "个人资料" : "Profile" },
    { key: "settings", icon: <Settings size={14} />, label: locale === "zh" ? "设置" : "Settings" },
    { type: "divider" as const },
    { key: "logout", icon: <LogOut size={14} />, label: locale === "zh" ? "退出登录" : "Logout", danger: true },
  ];

  const handleUserMenuClick = ({ key }: { key: string }) => {
    if (key === "logout") {
      console.log("[Layout] user logout");
      logout();
    }
  };

  return (
    <div data-cmp="AppLayout" className="min-h-screen flex" style={{ width: "100%", minWidth: 0 }}>
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
                <div className="font-bold text-base leading-tight" style={{ color: "var(--foreground)" }}>
                  MONI-HR
                </div>
              </div>
            )}
          </div>

          {/* Menu */}
          <Menu
            mode="inline"
            selectedKeys={[currentPage]}
            items={menuItems}
            onClick={({ key }) => onPageChange(key as PageKey)}
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
              {collapsed ? <ChevronRight size={16} /> : (
                <span className="flex items-center gap-1">
                  <ChevronLeft size={16} />
                  {locale === "zh" ? "收起" : "Collapse"}
                </span>
              )}
            </div>
          </div>
        </Sider>

        {/* Main area */}
        <AntLayout style={{ marginLeft: collapsed ? 72 : 240, transition: "margin 0.2s" }}>
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
            <div className="font-semibold text-lg" style={{ color: "var(--foreground)" }}>
              {t.nav[currentPage as keyof typeof t.nav] ?? currentPage}
            </div>

            <Space size={12}>
              {/* Global Store Selector */}
              <Select
                value={selectedStoreId}
                onChange={(v) => {
                  console.log("[Layout] store changed:", v);
                  setSelectedStoreId(v);
                }}
                style={{ width: 160 }}
                size="small"
              >
                <Option value="all">
                  <span style={{ color: "var(--muted-foreground)" }}>
                    {locale === "zh" ? "全部店面" : "All Stores"}
                  </span>
                </Option>
                {stores.map((s) => (
                  <Option key={s.id} value={s.id}>{s.name}</Option>
                ))}
              </Select>

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
              <Badge count={3} size="small">
                <Button
                  type="text"
                  icon={<Bell size={18} />}
                  style={{ display: "flex", alignItems: "center", color: "var(--muted-foreground)" }}
                />
              </Badge>

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
                    <span className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
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
    </div>
  );
}
