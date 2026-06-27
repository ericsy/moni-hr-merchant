import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MoniHrLogo } from "../components/MoniHrLogo";

type Lang = "en" | "zh";

const CONTENT = {
  en: {
    title: "Privacy Policy",
    appName: "Moni HR",
    appSubtitle: "Employee App · iOS & Android",
    effective: "Effective date: June 22, 2026",
    lastUpdated: "Last updated: June 22, 2026",
    intro:
      'This Privacy Policy describes how MONI-HR ("we", "us", or "our") collects, uses, and protects information when you use the Moni HR mobile application (the "App"). The App is provided to employees at the direction of their employer (the "Merchant") for workforce scheduling, attendance, and related HR operations.',
    sections: [
      {
        title: "1. Who we are",
        body: [
          "MONI-HR provides workforce management software to businesses. When your employer enables Moni HR, you receive an account to view schedules, submit attendance requests, and clock in or out where permitted by your employer.",
          "For privacy inquiries: Jerry.d@gpos.co.nz",
        ],
      },
      {
        title: "2. Information we collect",
        body: [
          "Account and profile information: name, work email, employee identifier, store assignment, role, and authentication credentials managed by your employer.",
          "Work-related data: shift schedules, roster assignments, leave and attendance requests, approval status, and punch records submitted through the App.",
          "Location information: when you use clock-in or clock-out features, the App collects your device location (GPS coordinates) to verify that you are within your employer’s configured geofence. Location is used for attendance verification, not for continuous background tracking or advertising.",
          "Device information: device type (iOS or Android) and a device identifier used to help detect duplicate or suspicious punch activity, as configured by your employer’s policies.",
          "Technical logs: app version, request timestamps, and error diagnostics needed to operate and secure the service.",
        ],
      },
      {
        title: "3. How we use information",
        body: [
          "Provide core App features such as viewing today’s work, submitting punches, and managing attendance requests.",
          "Share workforce data with your employer and authorized managers within your organization.",
          "Maintain security, prevent fraud or misuse of punch features, and troubleshoot service issues.",
          "Comply with applicable law and respond to lawful requests.",
          "We do not sell your personal information. We do not use your data for third-party advertising.",
        ],
      },
      {
        title: "4. Legal bases (where applicable)",
        body: [
          "We process information to perform our contract with your employer, with your employer’s instructions as data controller for employee HR data, and where necessary for legitimate interests such as security and service reliability.",
          "Location is processed only when you initiate a punch action and grant location permission on your device.",
        ],
      },
      {
        title: "5. Sharing of information",
        body: [
          "Your employer (Merchant): primary recipient of scheduling, attendance, and punch data.",
          "Service providers: hosting, infrastructure, and support vendors bound by confidentiality and data-processing obligations.",
          "Legal disclosures: when required by law or to protect rights, safety, and integrity of the service.",
        ],
      },
      {
        title: "6. Data retention",
        body: [
          "We retain information for as long as your employer maintains an active account and as required for legal, payroll, or audit purposes defined by your employer and applicable law.",
          "When data is no longer needed, we delete or anonymize it according to our retention practices and your employer’s instructions.",
        ],
      },
      {
        title: "7. Security",
        body: [
          "We use administrative, technical, and organizational measures such as encrypted transport (HTTPS), access controls, and audit logging appropriate to a workforce management platform.",
          "No method of transmission or storage is 100% secure; please use a strong password and keep your device protected.",
        ],
      },
      {
        title: "8. Your choices and rights",
        body: [
          "Location: you can deny location permission; however, geofence-based punch features may not work without it.",
          "Account access: contact your employer’s HR or administrator to update profile details, deactivate access, or exercise rights available under local law (access, correction, deletion, portability, objection, etc.).",
          "We will assist your employer in responding to such requests where we act as a processor.",
        ],
      },
      {
        title: "9. International transfers",
        body: [
          "Your information may be processed in countries where we or our service providers operate. We take steps designed to ensure appropriate safeguards when data is transferred across borders.",
        ],
      },
      {
        title: "10. Children",
        body: [
          "The App is intended for working adults authorized by an employer. It is not directed to children under 16, and we do not knowingly collect personal information from children.",
        ],
      },
      {
        title: "11. Changes to this policy",
        body: [
          "We may update this Privacy Policy from time to time. We will post the revised policy at this URL and update the effective date. Continued use of the App after changes constitutes acceptance where permitted by law.",
        ],
      },
      {
        title: "12. Contact us",
        body: [
          "Email: Jerry.d@gpos.co.nz",
          "Website: https://monihr.com",
          "If you have questions about how your employer uses your data, please contact your employer first.",
        ],
      },
    ],
    back: "Back to home",
  },
  zh: {
    title: "隐私政策",
    appName: "Moni HR",
    appSubtitle: "员工端 App · iOS 与 Android",
    effective: "生效日期：2026 年 6 月 22 日",
    lastUpdated: "最后更新：2026 年 6 月 22 日",
    intro:
      "本隐私政策说明 MONI-HR（「我们」）在您使用 Moni HR 移动应用程序（「本 App」）时如何收集、使用与保护您的信息。本 App 由您所在用人单位（「商家/雇主」）为其员工提供，用于排班、考勤及相关人事管理。",
    sections: [
      {
        title: "1. 我们是谁",
        body: [
          "MONI-HR 向企业提供劳动力管理软件。当您的雇主启用 Moni HR 后，您将获得账户以查看排班、提交考勤申请，并在雇主允许时使用打卡功能。",
          "隐私相关咨询：Jerry.d@gpos.co.nz",
        ],
      },
      {
        title: "2. 我们收集的信息",
        body: [
          "账户与资料：姓名、工作邮箱、员工标识、门店归属、角色，以及由雇主管理的登录凭证。",
          "与工作相关的数据：班次排班、人员安排、请假与考勤申请、审批状态，以及通过 App 提交的打卡记录。",
          "位置信息：当您使用上班/下班打卡功能时，App 会获取设备位置（GPS 坐标），以校验是否在雇主设置的电子围栏内。位置信息用于考勤核验，不会用于持续后台定位或广告投放。",
          "设备信息：设备类型（iOS 或 Android）及设备标识，用于辅助识别重复或异常打卡行为（按雇主政策配置）。",
          "技术日志：App 版本、请求时间戳及保障服务运行与安全所需的诊断信息。",
        ],
      },
      {
        title: "3. 我们如何使用信息",
        body: [
          "提供 App 核心功能，如今日工作、打卡、考勤申请等。",
          "向您的雇主及经授权的管理人员提供排班与考勤数据。",
          "维护安全、防止打卡功能被滥用，并排查服务故障。",
          "遵守适用法律并响应合法要求。",
          "我们不会出售您的个人信息，也不会将您的数据用于第三方广告。",
        ],
      },
      {
        title: "4. 处理依据（如适用）",
        body: [
          "我们基于与雇主的服务关系、雇主作为人事数据控制者的指示，以及在安全与服务可靠性方面的正当利益处理相关信息。",
          "位置信息仅在您主动发起打卡且在设备上授权定位权限时处理。",
        ],
      },
      {
        title: "5. 信息共享",
        body: [
          "您的雇主（商家）：排班、考勤与打卡数据的主要接收方。",
          "服务提供商：托管、基础设施及技术支持方，均受保密与数据处理义务约束。",
          "法律披露：在法律要求或为保护服务、用户及公众安全所必要时。",
        ],
      },
      {
        title: "6. 数据保留",
        body: [
          "在雇主账户有效期间及适用法律、薪酬或审计所需的期限内保留信息。",
          "不再需要时，我们将根据保留规则及雇主指示删除或匿名化处理。",
        ],
      },
      {
        title: "7. 安全",
        body: [
          "我们采取管理、技术与组织措施（如 HTTPS 传输加密、访问控制、审计日志等）保护数据。",
          "任何传输或存储方式都无法保证绝对安全；请妥善保管密码与设备。",
        ],
      },
      {
        title: "8. 您的选择与权利",
        body: [
          "位置权限：您可拒绝授权；但基于围栏的打卡功能可能无法使用。",
          "账户与权利：如需更新资料、停用账户或行使当地法律赋予的访问、更正、删除、可携带等权利，请联系雇主 HR 或管理员；我们作为处理方将协助雇主响应。",
        ],
      },
      {
        title: "9. 跨境传输",
        body: [
          "您的信息可能在我们或服务提供商所在国家/地区处理。跨境传输时我们将采取合理保障措施。",
        ],
      },
      {
        title: "10. 儿童",
        body: [
          "本 App 面向经雇主授权在职使用的成年人，不面向 16 周岁以下儿童，我们也不会故意收集儿童个人信息。",
        ],
      },
      {
        title: "11. 政策更新",
        body: [
          "我们可能不时更新本政策，并在本页面公布修订内容及生效日期。在法律允许范围内，更新后继续使用 App 即视为接受修订。",
        ],
      },
      {
        title: "12. 联系我们",
        body: [
          "邮箱：Jerry.d@gpos.co.nz",
          "网站：https://monihr.com",
          "关于雇主如何使用您的数据，请优先联系您的用人单位。",
        ],
      },
    ],
    back: "返回首页",
  },
} as const;

export default function PrivacyPolicy() {
  const [lang, setLang] = useState<Lang>(() => {
    if (typeof navigator !== "undefined" && navigator.language.toLowerCase().startsWith("zh")) {
      return "zh";
    }
    return "en";
  });

  const copy = useMemo(() => CONTENT[lang], [lang]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b" style={{ borderColor: "var(--border)" }}>
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <MoniHrLogo className="h-8 w-8" />
            <span className="font-semibold">MONI-HR</span>
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 ${lang === "en" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              onClick={() => setLang("en")}
            >
              EN
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1.5 ${lang === "zh" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
              onClick={() => setLang("zh")}
            >
              中文
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
        <p className="text-sm font-medium text-primary">{copy.appSubtitle}</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight">{copy.title}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{copy.appName}</p>
        <p className="mt-1 text-sm text-muted-foreground">{copy.effective}</p>
        <p className="text-sm text-muted-foreground">{copy.lastUpdated}</p>

        <p className="mt-8 leading-7 text-muted-foreground">{copy.intro}</p>

        <div className="mt-10 space-y-8">
          {copy.sections.map((section) => (
            <section key={section.title}>
              <h2 className="text-lg font-semibold">{section.title}</h2>
              <ul className="mt-3 list-disc space-y-2 pl-5 leading-7 text-muted-foreground">
                {section.body.map((paragraph) => (
                  <li key={paragraph}>{paragraph}</li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-12 border-t pt-8" style={{ borderColor: "var(--border)" }}>
          <Link to="/" className="text-sm font-medium text-primary hover:underline">
            ← {copy.back}
          </Link>
        </div>
      </main>
    </div>
  );
}
