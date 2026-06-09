import { Alert, Button, Card, Skeleton } from "antd";
import {
  AlertTriangle,
  CalendarClock,
  CircleDollarSign,
  RefreshCw,
  UserMinus,
  Users,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useData } from "../context/DataContext";
import { useLocale } from "../context/LocaleContext";
import { useStore } from "../context/StoreContext";
import TodayAttendancePanel from "../components/TodayAttendancePanel";
import {
  merchantApi,
  type MerchantDashboardStatistics,
  type MerchantTodayAttendance,
} from "../lib/merchantApi";

type StatTone = "blue" | "red" | "amber" | "indigo" | "rose";

interface DashboardMetric {
  key: keyof MerchantDashboardStatistics;
  title: string;
  value: number;
  suffix?: string;
  helper: string;
  tone: StatTone;
  icon: React.ReactNode;
  format?: "number" | "currency";
}

const toneStyles: Record<
  StatTone,
  {
    accent: string;
    soft: string;
    iconBg: string;
    text: string;
  }
> = {
  blue: {
    accent: "#2563eb",
    soft: "rgba(37, 99, 235, 0.14)",
    iconBg: "rgba(37, 99, 235, 0.12)",
    text: "#2563eb",
  },
  red: {
    accent: "#ef4444",
    soft: "rgba(239, 68, 68, 0.14)",
    iconBg: "rgba(239, 68, 68, 0.1)",
    text: "#dc2626",
  },
  amber: {
    accent: "#f59e0b",
    soft: "rgba(245, 158, 11, 0.16)",
    iconBg: "rgba(245, 158, 11, 0.12)",
    text: "#d97706",
  },
  indigo: {
    accent: "#4f46e5",
    soft: "rgba(79, 70, 229, 0.14)",
    iconBg: "rgba(79, 70, 229, 0.12)",
    text: "#4f46e5",
  },
  rose: {
    accent: "#f43f5e",
    soft: "rgba(244, 63, 94, 0.14)",
    iconBg: "rgba(244, 63, 94, 0.1)",
    text: "#e11d48",
  },
};

const emptyStats: Required<MerchantDashboardStatistics> = {
  staffWorkingToday: 0,
  absentEmployees: 0,
  labourCostToday: 0,
  weeklyHours: 0,
  overtimeRiskEmployees: 0,
};

function toNumber(value: unknown) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

function mergeStats(stats?: MerchantDashboardStatistics | null) {
  return {
    staffWorkingToday: toNumber(stats?.staffWorkingToday),
    absentEmployees: toNumber(stats?.absentEmployees),
    labourCostToday: toNumber(stats?.labourCostToday),
    weeklyHours: toNumber(stats?.weeklyHours),
    overtimeRiskEmployees: toNumber(stats?.overtimeRiskEmployees),
  };
}

export default function Home() {
  const { locale, t } = useLocale();
  const { stores, storesLoaded } = useData();
  const { selectedStoreId } = useStore();
  const [statistics, setStatistics] =
    useState<MerchantDashboardStatistics>(emptyStats);
  const [todayAttendance, setTodayAttendance] =
    useState<MerchantTodayAttendance | null>(null);
  const [loading, setLoading] = useState(false);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [error, setError] = useState("");
  const [attendanceError, setAttendanceError] = useState("");
  const currentStore = stores.find((store) => store.id === selectedStoreId);

  const numberFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
        maximumFractionDigits: 1,
      }),
    [locale],
  );
  const currencyFormatter = useMemo(
    () =>
      new Intl.NumberFormat(locale === "zh" ? "zh-CN" : "en-US", {
        style: "currency",
        currency: "NZD",
        maximumFractionDigits: 0,
      }),
    [locale],
  );

  const loadStatistics = useCallback(async () => {
    if (!selectedStoreId) {
      setStatistics(emptyStats);
      setTodayAttendance(null);
      return;
    }

    setLoading(true);
    setAttendanceLoading(true);
    setError("");
    setAttendanceError("");

    const [statsResult, attendanceResult] = await Promise.allSettled([
      merchantApi.getDashboardStatistics(selectedStoreId),
      merchantApi.getTodayAttendance(selectedStoreId),
    ]);

    if (statsResult.status === "fulfilled") {
      setStatistics(mergeStats(statsResult.value));
    } else {
      console.log("[Home] failed to load dashboard statistics:", statsResult.reason);
      setError(
        statsResult.reason instanceof Error
          ? statsResult.reason.message
          : t.home.dashboardLoadFailed,
      );
      setStatistics(emptyStats);
    }

    if (attendanceResult.status === "fulfilled") {
      setTodayAttendance(attendanceResult.value);
    } else {
      console.log("[Home] failed to load today attendance:", attendanceResult.reason);
      setAttendanceError(
        attendanceResult.reason instanceof Error
          ? attendanceResult.reason.message
          : t.home.todayAttendance.loadFailed,
      );
      setTodayAttendance(null);
    }

    setLoading(false);
    setAttendanceLoading(false);
  }, [selectedStoreId, t.home.dashboardLoadFailed, t.home.todayAttendance.loadFailed]);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  const stats = mergeStats(statistics);
  const metrics: DashboardMetric[] = [
    {
      key: "staffWorkingToday",
      title: t.home.staffWorkingToday,
      value: stats.staffWorkingToday,
      helper: t.home.staffWorkingTodayHint,
      tone: "blue",
      icon: <Users size={22} />,
    },
    {
      key: "absentEmployees",
      title: t.home.absentEmployees,
      value: stats.absentEmployees,
      helper: t.home.absentEmployeesHint,
      tone: "red",
      icon: <UserMinus size={22} />,
    },
    {
      key: "labourCostToday",
      title: t.home.labourCostToday,
      value: stats.labourCostToday,
      helper: t.home.labourCostTodayHint,
      tone: "amber",
      icon: <CircleDollarSign size={22} />,
      format: "currency",
    },
    {
      key: "weeklyHours",
      title: t.home.weeklyHours,
      value: stats.weeklyHours,
      suffix: "h",
      helper: t.home.weeklyHoursHint,
      tone: "indigo",
      icon: <CalendarClock size={22} />,
    },
    {
      key: "overtimeRiskEmployees",
      title: t.home.overtimeRiskEmployees,
      value: stats.overtimeRiskEmployees,
      helper: t.home.overtimeRiskEmployeesHint,
      tone: "rose",
      icon: <AlertTriangle size={22} />,
    },
  ];

  const formatMetricValue = (metric: DashboardMetric) => {
    if (metric.format === "currency") {
      return currencyFormatter.format(metric.value);
    }

    return numberFormatter.format(metric.value);
  };

  const showNoStores = storesLoaded && stores.length === 0;

  return (
    <div data-cmp="HomeDashboard" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div
            className="text-sm font-medium"
            style={{ color: "var(--muted-foreground)" }}
          >
            {t.home.dashboardEyebrow}
          </div>
          <h1
            className="mt-1 text-2xl font-semibold leading-tight"
            style={{ color: "var(--foreground)" }}
          >
            {t.home.dashboardTitle}
          </h1>
          <div
            className="mt-1 text-sm"
            style={{ color: "var(--muted-foreground)" }}
          >
            {currentStore?.name || t.home.currentStoreFallback}
          </div>
        </div>
        <Button
          icon={<RefreshCw size={15} />}
          loading={loading}
          onClick={loadStatistics}
          disabled={!selectedStoreId}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          {t.home.refresh}
        </Button>
      </div>

      {showNoStores && (
        <Alert
          showIcon
          type="info"
          message={t.home.noStoreTitle}
          description={t.home.noStoreDescription}
        />
      )}

      {error && (
        <Alert
          showIcon
          type="error"
          message={t.home.dashboardLoadFailed}
          description={error}
          action={
            <Button size="small" danger onClick={loadStatistics}>
              {t.home.retry}
            </Button>
          }
        />
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        {metrics.map((metric) => (
          <MetricCard
            key={metric.key}
            metric={metric}
            value={formatMetricValue(metric)}
            loading={loading}
          />
        ))}
      </div>

      {attendanceError ? (
        <Alert
          showIcon
          type="warning"
          message={t.home.todayAttendance.loadFailed}
          description={attendanceError}
        />
      ) : null}

      <TodayAttendancePanel data={todayAttendance} loading={attendanceLoading} />
    </div>
  );
}

function MetricCard({
  metric,
  value,
  loading,
}: {
  metric: DashboardMetric;
  value: string;
  loading: boolean;
}) {
  const tone = toneStyles[metric.tone];

  return (
    <Card
      className="overflow-hidden"
      style={{
        borderColor: "var(--border)",
        borderRadius: 8,
        boxShadow: "0 8px 22px rgba(15, 23, 42, 0.07)",
      }}
      styles={{ body: { padding: 0 } }}
    >
      <div className="relative min-h-[112px] p-4 lg:min-h-[104px]">
        <div
          className="absolute left-0 top-3 h-[calc(100%-24px)] w-1 rounded-r-full"
          style={{ background: tone.accent }}
        />
        <div className="relative flex h-full flex-col justify-between gap-3">
          <div className="flex items-center gap-2">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{
                color: tone.text,
                background: tone.iconBg,
              }}
            >
              {metric.icon}
            </div>
            <div
              className="min-w-0 text-xs font-medium leading-snug lg:text-sm"
              style={{ color: "var(--muted-foreground)" }}
            >
              {metric.title}
            </div>
          </div>

          {loading ? (
            <Skeleton active paragraph={false} title={{ width: 80 }} />
          ) : (
            <div>
              <div
                className="flex items-baseline gap-1 text-2xl font-semibold leading-none lg:text-3xl"
                style={{ color: "var(--foreground)" }}
              >
                <span className="truncate">{value}</span>
                {metric.suffix && (
                  <span
                    className="text-base font-semibold lg:text-lg"
                    style={{ color: tone.text }}
                  >
                    {metric.suffix}
                  </span>
                )}
              </div>
              <div
                className="mt-2 truncate text-[11px] leading-tight lg:text-xs"
                style={{ color: "var(--muted-foreground)" }}
                title={metric.helper}
              >
                {metric.helper}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
