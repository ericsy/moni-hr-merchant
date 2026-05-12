import { Card, Row, Col, Button, List, Tag, Avatar } from "antd";
import {
  Users,
  Store,
  ArrowRight,
  Plus,
} from "lucide-react";
import { useLocale } from "../context/LocaleContext";
import { useData } from "../context/DataContext";

interface DashboardProps {
  onNavigate?: (page: string) => void;
}

export default function Dashboard({ onNavigate = () => {} }: DashboardProps) {
  const { t, locale } = useLocale();
  const { employees, stores } = useData();

  const activeEmployees = employees.filter((e) => e.status === "active").length;

  const statsCards = [
    {
      title: t.dashboard.totalEmployees,
      value: activeEmployees,
      icon: <Users size={22} />,
      color: "var(--primary)",
      bg: "var(--secondary)",
      onClick: () => onNavigate("employees"),
    },
    {
      title: t.dashboard.totalStores,
      value: stores.length,
      icon: <Store size={22} />,
      color: "var(--chart-2)",
      bg: "var(--secondary)",
      onClick: () => onNavigate("stores"),
    },
  ];

  const quickActions = [
    { label: t.dashboard.addEmployee, icon: <Users size={16} />, page: "employees" },
    { label: t.dashboard.addStore, icon: <Store size={16} />, page: "stores" },
  ];

  console.log("[Dashboard] stats:", { activeEmployees, stores: stores.length });

  return (
    <div data-cmp="Dashboard" className="flex flex-col gap-6">
      {/* Stats */}
      <Row gutter={[16, 16]}>
        {statsCards.map((card, idx) => (
          <Col key={idx} flex="1">
            <Card
              hoverable
              onClick={card.onClick}
              style={{
                borderColor: "var(--border)",
                cursor: "pointer",
              }}
              styles={{ body: { padding: "20px 24px" } }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-xs mb-2" style={{ color: "var(--muted-foreground)" }}>
                    {card.title}
                  </div>
                  <div className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
                    {card.value}
                  </div>
                </div>
                <div
                  className="flex items-center justify-center rounded-xl"
                  style={{
                    width: 48,
                    height: 48,
                    background: card.bg,
                    color: card.color,
                  }}
                >
                  {card.icon}
                </div>
              </div>
            </Card>
          </Col>
        ))}
      </Row>

      {/* Lower section */}
      <div className="flex gap-4">
        {/* Employee List Preview */}
        <div className="flex-1">
          <Card
            title={
              <div className="flex items-center justify-between">
                <span style={{ color: "var(--foreground)" }}>
                  {locale === "zh" ? "近期员工" : "Recent Employees"}
                </span>
                <Button
                  type="link"
                  size="small"
                  icon={<ArrowRight size={14} />}
                  onClick={() => onNavigate("employees")}
                  style={{ color: "var(--primary)", padding: 0, display: "flex", alignItems: "center", flexDirection: "row-reverse", gap: 4 }}
                >
                  {locale === "zh" ? "查看全部" : "View All"}
                </Button>
              </div>
            }
            style={{ borderColor: "var(--border)" }}
            styles={{ header: { borderBottom: "1px solid var(--border)" } }}
          >
            <List
              dataSource={employees.slice(0, 6)}
              renderItem={(emp) => {
                const initials = `${emp.firstName[0]}${emp.lastName[0]}`;
                const assignedStoreNames = stores
                  .filter((s) => emp.assignedStores?.includes(s.id))
                  .map((s) => s.name)
                  .join(", ");
                return (
                  <List.Item style={{ padding: "10px 0", borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-3 w-full">
                      <Avatar
                        size={36}
                        style={{
                          background: "var(--primary)",
                          flexShrink: 0,
                          fontSize: 13,
                        }}
                      >
                        {initials}
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate" style={{ color: "var(--foreground)" }}>
                          {emp.firstName} {emp.lastName}
                        </div>
                        <div className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                          {emp.role} {assignedStoreNames ? `· ${assignedStoreNames}` : ""}
                        </div>
                      </div>
                      <Tag
                        color={emp.status === "active" ? "success" : "default"}
                        style={{ margin: 0, fontSize: 11 }}
                      >
                        {emp.status === "active" ? t.active : t.inactive}
                      </Tag>
                    </div>
                  </List.Item>
                );
              }}
            />
          </Card>
        </div>

        {/* Right column */}
        <div style={{ width: 240, flexShrink: 0 }} className="flex flex-col gap-4">
          {/* Quick Actions */}
          <Card
            title={<span style={{ color: "var(--foreground)" }}>{t.dashboard.quickActions}</span>}
            style={{ borderColor: "var(--border)" }}
            styles={{ header: { borderBottom: "1px solid var(--border)" } }}
          >
            <div className="flex flex-col gap-3">
              {quickActions.map((action, idx) => (
                <Button
                  key={idx}
                  block
                  icon={<Plus size={14} />}
                  onClick={() => onNavigate(action.page)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "flex-start",
                    gap: 8,
                    borderColor: "var(--border)",
                    color: "var(--foreground)",
                    height: 40,
                  }}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </Card>

          {/* Store Overview */}
          <Card
            title={<span style={{ color: "var(--foreground)" }}>{locale === "zh" ? "店面概览" : "Store Overview"}</span>}
            style={{ borderColor: "var(--border)" }}
            styles={{ header: { borderBottom: "1px solid var(--border)" }, body: { padding: "12px 16px" } }}
          >
            {stores.map((store) => (
              <div key={store.id} className="flex items-center justify-between py-2" style={{ borderBottom: "1px solid var(--border)" }}>
                <div>
                  <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                    {store.name}
                  </div>
                  <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {store.country.toUpperCase()} · {store.city}
                  </div>
                </div>
              </div>
            ))}
          </Card>
        </div>
      </div>
    </div>
  );
}
