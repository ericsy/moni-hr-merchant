import {
  ArrowRight,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock,
  Globe,
  LayoutTemplate,
  LogIn,
  MapPin,
  MessageSquare,
  Shield,
  Users,
} from "lucide-react";
import { Link } from "react-router-dom";
import { useLocale } from "../context/LocaleContext";

const T = {
  en: {
    brand: "MONI-HR",
    navFeatures: "Features",
    navFlow: "How it works",
    navIndustries: "Industries",
    login: "Log In",
    heroEyebrow: "Workforce management for shift-based teams",
    heroTitle: "Smart scheduling, time tracking & team ops in one place",
    heroSubtitle:
      "Plan rosters with drag-and-drop templates, manage leave and attendance, and keep every store running smoothly — built for multi-site merchants.",
    heroCta: "Merchant Log In",
    heroSecondary: "See features",
    trust1: "Multi-store ready",
    trust2: "Template-based rosters",
    trust3: "Leave & attendance",
    trust4: "Role-based access",
    featuresTitle: "Everything you need to run shifts",
    featuresSubtitle:
      "From weekly templates to live rosters, MONI-HR keeps managers and staff aligned.",
    featureSchedulingTitle: "Shift & roster management",
    featureSchedulingDesc:
      "Area and employee views, conflict hints, template drag-and-drop, and publish-ready weekly schedules.",
    featureTemplateTitle: "Roster templates",
    featureTemplateDesc:
      "Reusable multi-week blueprints with position or employee view to automate recurring patterns.",
    featureLeaveTitle: "Leave & requests",
    featureLeaveDesc:
      "Review attendance requests, approved leave overlays on rosters, and substitution workflows.",
    featureTimeTitle: "Time & attendance",
    featureTimeDesc:
      "Clock punches, today attendance dashboard, and planned vs actual visibility per store.",
    featureStoreTitle: "Multi-store operations",
    featureStoreDesc:
      "Manage stores, areas, employees, and permissions from a single merchant console.",
    featureTeamTitle: "Employee profiles",
    featureTeamDesc:
      "Work patterns, availability, roles, and store assignments in one employee hub.",
    flowTitle: "From template to live roster",
    flowSubtitle: "A connected workflow designed for busy store managers.",
    flow1Title: "Build templates",
    flow1Desc: "Set weekly patterns by area or employee with reusable shift cells.",
    flow2Title: "Publish rosters",
    flow2Desc: "Apply templates to the live week, adjust conflicts, and assign staff.",
    flow3Title: "Track attendance",
    flow3Desc: "Monitor clock-ins, absences, and daily labour metrics on the dashboard.",
    industriesTitle: "Built for shift-based businesses",
    industries: [
      "Retail",
      "Hospitality",
      "Healthcare",
      "Manufacturing",
      "Events & venues",
      "Cleaning services",
    ],
    ctaTitle: "Ready to simplify your rostering?",
    ctaSubtitle: "Sign in to your merchant console and start managing your team today.",
    ctaButton: "Go to Log In",
    footer: "© {year} MONI-HR Merchant. Built for modern workforce teams.",
  },
  zh: {
    brand: "MONI-HR",
    navFeatures: "功能",
    navFlow: "使用流程",
    navIndustries: "适用行业",
    login: "登录",
    heroEyebrow: "面向轮班制团队的劳动力管理",
    heroTitle: "排班、考勤与门店运营，一站式搞定",
    heroSubtitle:
      "拖拽式排班模版、实时排班表、请假与打卡管理，帮助多门店商家高效组织人力、减少排班冲突。",
    heroCta: "商家登录",
    heroSecondary: "了解功能",
    trust1: "多门店支持",
    trust2: "排班模版",
    trust3: "请假与考勤",
    trust4: "角色权限",
    featuresTitle: "排班管理所需的核心能力",
    featuresSubtitle: "从周模版到实时排班，让管理者与员工保持同步。",
    featureSchedulingTitle: "排班与班次管理",
    featureSchedulingDesc:
      "区域/员工双视图、冲突提示、模版拖放应用，快速完成一周排班。",
    featureTemplateTitle: "排班模版",
    featureTemplateDesc:
      "可复用的多周蓝图，支持区域视图与员工视图，自动化重复排班模式。",
    featureLeaveTitle: "请假与申请",
    featureLeaveDesc:
      "考勤申请审核、已批准请假在排班表展示，以及替班流程支持。",
    featureTimeTitle: "考勤与打卡",
    featureTimeDesc:
      "打卡记录、今日出勤看板，以及计划工时与实际出勤对比。",
    featureStoreTitle: "多门店运营",
    featureStoreDesc:
      "在同一商家后台管理门店、区域、员工与权限配置。",
    featureTeamTitle: "员工档案",
    featureTeamDesc:
      "工作时段、可用性、职位与门店归属，集中管理员工信息。",
    flowTitle: "从模版到正式排班",
    flowSubtitle: "为忙碌的一线管理者设计的连贯工作流。",
    flow1Title: "创建模版",
    flow1Desc: "按区域或员工设置可复用的周排班模式与班次单元。",
    flow2Title: "发布排班",
    flow2Desc: "将模版应用到当前周，处理冲突并分配员工。",
    flow3Title: "跟踪出勤",
    flow3Desc: "在看板查看打卡、缺勤与当日人力指标。",
    industriesTitle: "适用于各类轮班制场景",
    industries: [
      "零售",
      "餐饮酒店",
      "医疗健康",
      "生产制造",
      "活动场馆",
      "清洁服务",
    ],
    ctaTitle: "准备好简化排班了吗？",
    ctaSubtitle: "登录商家后台，立即开始管理您的团队。",
    ctaButton: "前往登录",
    footer: "© {year} MONI-HR 商家端。为现代劳动力团队而生。",
  },
} as const;

const features = [
  {
    key: "scheduling",
    icon: CalendarRange,
    titleKey: "featureSchedulingTitle" as const,
    descKey: "featureSchedulingDesc" as const,
  },
  {
    key: "template",
    icon: LayoutTemplate,
    titleKey: "featureTemplateTitle" as const,
    descKey: "featureTemplateDesc" as const,
  },
  {
    key: "leave",
    icon: MessageSquare,
    titleKey: "featureLeaveTitle" as const,
    descKey: "featureLeaveDesc" as const,
  },
  {
    key: "time",
    icon: Clock,
    titleKey: "featureTimeTitle" as const,
    descKey: "featureTimeDesc" as const,
  },
  {
    key: "store",
    icon: MapPin,
    titleKey: "featureStoreTitle" as const,
    descKey: "featureStoreDesc" as const,
  },
  {
    key: "team",
    icon: Users,
    titleKey: "featureTeamTitle" as const,
    descKey: "featureTeamDesc" as const,
  },
];

function LangToggle() {
  const { locale, setLocale } = useLocale();

  return (
    <div className="flex items-center gap-2">
      <Globe size={14} style={{ color: "var(--muted-foreground)" }} />
      <div
        className="flex items-center rounded-full p-0.5 select-none"
        style={{
          background: "var(--muted)",
          border: "1px solid var(--border)",
        }}
      >
        {(["en", "zh"] as const).map((lang) => (
          <button
            key={lang}
            type="button"
            onClick={() => setLocale(lang)}
            className="rounded-full px-3 py-1 text-xs font-semibold transition-all"
            style={{
              background: locale === lang ? "var(--primary)" : "transparent",
              color:
                locale === lang
                  ? "var(--primary-foreground)"
                  : "var(--muted-foreground)",
              cursor: locale === lang ? "default" : "pointer",
            }}
          >
            {lang === "en" ? "EN" : "中文"}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function Landing() {
  const { locale } = useLocale();
  const t = T[locale];
  const year = new Date().getFullYear();

  return (
    <div
      data-cmp="Landing"
      className="min-h-screen"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
    >
      <header
        className="sticky top-0 z-50 border-b backdrop-blur-md"
        style={{
          borderColor: "var(--border)",
          background: "rgba(255, 255, 255, 0.88)",
        }}
      >
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl"
              style={{ background: "var(--primary)" }}
            >
              <CalendarDays
                size={18}
                style={{ color: "var(--primary-foreground)" }}
              />
            </div>
            <span className="text-lg font-bold tracking-tight">{t.brand}</span>
          </div>

          <nav className="hidden items-center gap-6 md:flex">
            <a
              href="#features"
              className="text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--muted-foreground)" }}
            >
              {t.navFeatures}
            </a>
            <a
              href="#flow"
              className="text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--muted-foreground)" }}
            >
              {t.navFlow}
            </a>
            <a
              href="#industries"
              className="text-sm font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--muted-foreground)" }}
            >
              {t.navIndustries}
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <LangToggle />
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              <LogIn size={16} />
              {t.login}
            </Link>
          </div>
        </div>
      </header>

      <main>
        <section className="relative overflow-hidden">
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at top right, rgba(59,130,246,0.12), transparent 42%), radial-gradient(circle at bottom left, rgba(14,165,233,0.08), transparent 38%)",
            }}
          />
          <div className="relative mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:py-24">
            <div>
              <div
                className="mb-4 inline-flex rounded-full px-3 py-1 text-xs font-semibold"
                style={{
                  background: "var(--secondary)",
                  color: "var(--primary)",
                }}
              >
                {t.heroEyebrow}
              </div>
              <h1 className="text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
                {t.heroTitle}
              </h1>
              <p
                className="mt-5 max-w-2xl text-base leading-7 sm:text-lg"
                style={{ color: "var(--muted-foreground)" }}
              >
                {t.heroSubtitle}
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
                  style={{
                    background: "var(--primary)",
                    color: "var(--primary-foreground)",
                  }}
                >
                  {t.heroCta}
                  <ArrowRight size={16} />
                </Link>
                <a
                  href="#features"
                  className="inline-flex items-center gap-2 rounded-xl border px-5 py-3 text-sm font-semibold transition-colors hover:opacity-90"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--card)",
                    color: "var(--foreground)",
                  }}
                >
                  {t.heroSecondary}
                </a>
              </div>
              <div className="mt-8 grid gap-2 sm:grid-cols-2">
                {[t.trust1, t.trust2, t.trust3, t.trust4].map((item) => (
                  <div key={item} className="flex items-center gap-2 text-sm">
                    <CheckCircle2
                      size={16}
                      style={{ color: "var(--primary)", flexShrink: 0 }}
                    />
                    <span style={{ color: "var(--muted-foreground)" }}>
                      {item}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div
              className="rounded-3xl border p-5 shadow-custom"
              style={{
                borderColor: "var(--border)",
                background: "var(--card)",
              }}
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-sm font-semibold">
                    {locale === "zh" ? "本周排班预览" : "Weekly roster preview"}
                  </div>
                  <div
                    className="text-xs"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {locale === "zh" ? "区域视图 · 实时冲突检测" : "Area view · Live conflict checks"}
                  </div>
                </div>
                <span
                  className="rounded-full px-2 py-1 text-xs font-semibold"
                  style={{
                    background: "rgba(34, 197, 94, 0.12)",
                    color: "#15803d",
                  }}
                >
                  {locale === "zh" ? "已发布" : "Published"}
                </span>
              </div>
              <div className="grid grid-cols-7 gap-2 text-center text-[10px] font-semibold">
                {(locale === "zh"
                  ? ["一", "二", "三", "四", "五", "六", "日"]
                  : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
                ).map((day) => (
                  <div key={day} style={{ color: "var(--muted-foreground)" }}>
                    {day}
                  </div>
                ))}
              </div>
              <div className="mt-2 space-y-2">
                {[
                  { name: locale === "zh" ? "早班" : "Morning", time: "8:00–16:00", color: "#fde68a" },
                  { name: locale === "zh" ? "晚班" : "Evening", time: "16:00–00:00", color: "#bfdbfe" },
                  { name: locale === "zh" ? "收银" : "Cashier", time: "10:00–18:00", color: "#fecaca" },
                ].map((shift) => (
                  <div
                    key={shift.name}
                    className="rounded-xl border px-3 py-2"
                    style={{
                      borderColor: "var(--border)",
                      background: shift.color,
                    }}
                  >
                    <div className="text-sm font-semibold">{shift.name}</div>
                    <div
                      className="text-xs"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {shift.time}
                    </div>
                  </div>
                ))}
              </div>
              <div
                className="mt-4 rounded-xl px-3 py-2 text-xs"
                style={{
                  background: "rgba(239, 68, 68, 0.08)",
                  color: "#b91c1c",
                  border: "1px solid rgba(239, 68, 68, 0.18)",
                }}
              >
                {locale === "zh"
                  ? "1 个冲突：员工周五已批准请假"
                  : "1 conflict: employee has approved leave on Friday"}
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="border-t py-16 sm:py-20" style={{ borderColor: "var(--border)" }}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight">{t.featuresTitle}</h2>
              <p
                className="mt-3 text-base leading-7"
                style={{ color: "var(--muted-foreground)" }}
              >
                {t.featuresSubtitle}
              </p>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((feature) => {
                const Icon = feature.icon;
                return (
                  <div
                    key={feature.key}
                    className="rounded-2xl border p-5 transition-shadow hover:shadow-custom"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--card)",
                    }}
                  >
                    <div
                      className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl"
                      style={{
                        background: "var(--secondary)",
                        color: "var(--primary)",
                      }}
                    >
                      <Icon size={20} />
                    </div>
                    <h3 className="text-lg font-semibold">{t[feature.titleKey]}</h3>
                    <p
                      className="mt-2 text-sm leading-6"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      {t[feature.descKey]}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section id="flow" className="py-16 sm:py-20" style={{ background: "var(--muted)" }}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight">{t.flowTitle}</h2>
              <p
                className="mt-3 text-base leading-7"
                style={{ color: "var(--muted-foreground)" }}
              >
                {t.flowSubtitle}
              </p>
            </div>
            <div className="mt-10 grid gap-4 lg:grid-cols-3">
              {[
                { step: "01", title: t.flow1Title, desc: t.flow1Desc },
                { step: "02", title: t.flow2Title, desc: t.flow2Desc },
                { step: "03", title: t.flow3Title, desc: t.flow3Desc },
              ].map((item) => (
                <div
                  key={item.step}
                  className="rounded-2xl border p-6"
                  style={{
                    borderColor: "var(--border)",
                    background: "var(--card)",
                  }}
                >
                  <div
                    className="mb-4 text-sm font-bold"
                    style={{ color: "var(--primary)" }}
                  >
                    {item.step}
                  </div>
                  <h3 className="text-xl font-semibold">{item.title}</h3>
                  <p
                    className="mt-2 text-sm leading-6"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="industries" className="border-t py-16 sm:py-20" style={{ borderColor: "var(--border)" }}>
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="max-w-xl">
                <h2 className="text-3xl font-bold tracking-tight">
                  {t.industriesTitle}
                </h2>
                <div className="mt-6 flex items-start gap-3">
                  <Shield
                    size={20}
                    style={{ color: "var(--primary)", marginTop: 2 }}
                  />
                  <p
                    className="text-sm leading-6"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    {locale === "zh"
                      ? "无论您是单店还是多门店连锁，MONI-HR 都能帮助您统一管理排班、考勤与员工数据。"
                      : "Whether you run one site or many, MONI-HR helps you manage rosters, attendance, and employee data in one console."}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {t.industries.map((industry) => (
                  <span
                    key={industry}
                    className="rounded-full border px-4 py-2 text-sm font-medium"
                    style={{
                      borderColor: "var(--border)",
                      background: "var(--card)",
                      color: "var(--foreground)",
                    }}
                  >
                    {industry}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section
          className="border-t py-16 sm:py-20"
          style={{
            borderColor: "var(--border)",
            background:
              "linear-gradient(180deg, rgba(59,130,246,0.06) 0%, transparent 100%)",
          }}
        >
          <div className="mx-auto max-w-4xl px-4 text-center sm:px-6">
            <h2 className="text-3xl font-bold tracking-tight">{t.ctaTitle}</h2>
            <p
              className="mx-auto mt-4 max-w-2xl text-base leading-7"
              style={{ color: "var(--muted-foreground)" }}
            >
              {t.ctaSubtitle}
            </p>
            <Link
              to="/login"
              className="mt-8 inline-flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold transition-opacity hover:opacity-90"
              style={{
                background: "var(--primary)",
                color: "var(--primary-foreground)",
              }}
            >
              {t.ctaButton}
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </main>

      <footer
        className="border-t py-8"
        style={{ borderColor: "var(--border)", background: "var(--card)" }}
      >
        <div
          className="mx-auto max-w-6xl px-4 text-center text-sm sm:px-6"
          style={{ color: "var(--muted-foreground)" }}
        >
          {t.footer.replace("{year}", String(year))}
        </div>
      </footer>
    </div>
  );
}
