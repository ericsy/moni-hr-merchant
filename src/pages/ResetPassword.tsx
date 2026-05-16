import {
  ArrowRight,
  CalendarDays,
  CheckCircle,
  Eye,
  EyeOff,
  Globe,
  Key,
  Lock,
  ShieldCheck,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { useLocale } from "../context/LocaleContext";
import { merchantApi } from "../lib/merchantApi";

const T = {
  en: {
    langToggle: "中文",
    subtitle: "Reset Password",
    welcome: "Welcome",
    setPassword: "Please set your new password",
    boundEmail: "Bound Account Email",
    verified: "Verified",
    newPassword: "Set New Password",
    newPasswordPlaceholder: "Enter new password (min. 8 characters)",
    confirmPassword: "Confirm Password",
    confirmPasswordPlaceholder: "Re-enter your password",
    passwordsMatch: "Passwords match",
    rulesTitle: "Password Requirements",
    rules: [
      "At least 8 characters",
      "Contains uppercase letter",
      "Contains a number",
      "Contains special character (optional)",
    ],
    submitBtn: "Reset Password",
    resetting: "Resetting…",
    successTitle: "Password Reset Successful!",
    successDesc: "Your password has been reset. Redirecting you to login…",
    successBadge: "Going to Login",
    toastSuccess: "Password reset successfully!",
    toastError: "Password reset failed, please try again",
    loadingEmail: "Verifying reset link...",
    missingToken:
      "Reset link is missing a token. Please open the latest reset email again.",
    invalidToken:
      "Reset link is invalid or expired. Please request a new reset email.",
    emailFallback: "Waiting for email verification",
    checking: "Checking",
    unavailable: "Unavailable",
    errPasswordRequired: "Please enter a new password",
    errPasswordTooShort: "Password must be at least 8 characters",
    errConfirmRequired: "Please confirm your password",
    errPasswordMismatch: "Passwords do not match",
    strengthLabels: ["", "Weak", "Fair", "Good", "Strong"],
    strengthPrefix: "Strength:",
    terms: "By resetting, you agree to MONI-HR's",
    termsLink: "Terms of Service",
    and: "and",
    privacyLink: "Privacy Policy",
  },
  zh: {
    langToggle: "English",
    subtitle: "重置密码",
    welcome: "欢迎",
    setPassword: "请设置新密码",
    boundEmail: "绑定账户邮箱",
    verified: "已验证",
    newPassword: "设置新密码",
    newPasswordPlaceholder: "请输入新密码（至少 8 位）",
    confirmPassword: "确认密码",
    confirmPasswordPlaceholder: "请再次输入密码",
    passwordsMatch: "密码一致",
    rulesTitle: "密码规则",
    rules: [
      "至少 8 位字符",
      "包含大写字母",
      "包含数字",
      "包含特殊字符（可选）",
    ],
    submitBtn: "立即重置密码",
    resetting: "重置中…",
    successTitle: "密码重置成功！",
    successDesc: "您的密码已成功重置，系统正在为您跳转…",
    successBadge: "前往登录",
    toastSuccess: "密码重置成功！",
    toastError: "密码重置失败，请重试",
    loadingEmail: "正在验证重置链接...",
    missingToken: "重置链接缺少 token，请重新打开最新的重置邮件。",
    invalidToken: "重置链接无效或已过期，请重新获取重置邮件。",
    emailFallback: "等待邮箱验证",
    checking: "验证中",
    unavailable: "不可用",
    errPasswordRequired: "请输入新密码",
    errPasswordTooShort: "密码至少需要 8 位字符",
    errConfirmRequired: "请再次确认密码",
    errPasswordMismatch: "两次输入的密码不一致",
    strengthLabels: ["", "弱", "一般", "较强", "强"],
    strengthPrefix: "密码强度：",
    terms: "重置即表示您同意 MONI-HR 的",
    termsLink: "服务条款",
    and: "与",
    privacyLink: "隐私政策",
  },
} as const;

type Lang = keyof typeof T;

function StrengthBar({ password, lang }: { password: string; lang: Lang }) {
  const getStrength = () => {
    if (password.length === 0) return 0;
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    return score;
  };

  const strength = getStrength();
  const labels = T[lang].strengthLabels;
  const colors = ["", "#ef4444", "#f59e0b", "#22c55e", "#16a34a"];

  return (
    <div
      className="flex flex-col gap-1.5 mt-1 transition-all"
      style={{
        opacity: password.length === 0 ? 0 : 1,
        height: password.length === 0 ? 0 : "auto",
        overflow: password.length === 0 ? "hidden" : "visible",
      }}
    >
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-1.5 flex-1 rounded-full transition-all duration-300"
            style={{
              background: i <= strength ? colors[strength] : "var(--border)",
            }}
          />
        ))}
      </div>
      <span
        className="text-xs font-medium transition-colors"
        style={{ color: colors[strength] || "var(--muted-foreground)" }}
      >
        {strength > 0 ? `${T[lang].strengthPrefix}${labels[strength]}` : ""}
      </span>
    </div>
  );
}

export default function ResetPassword() {
  const { locale, setLocale } = useLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>(
    {},
  );
  const [done, setDone] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [adminName, setAdminName] = useState("");
  const [tokenLoading, setTokenLoading] = useState(false);
  const [tokenLookupError, setTokenLookupError] = useState("");

  const lang: Lang = locale;
  const t = T[lang];
  const token = useMemo(
    () => searchParams.get("token")?.trim() || "",
    [searchParams],
  );
  const email = resetEmail || "";
  const name = adminName || (lang === "en" ? "User" : "用户");
  const tokenError = !token ? t.missingToken : tokenLookupError;
  const visibleEmail = token ? email : "";
  const formDisabled =
    tokenLoading || Boolean(tokenError) || !visibleEmail || done;

  const RULES = t.rules.map((label, i) => ({
    label,
    test: [
      (p: string) => p.length >= 8,
      (p: string) => /[A-Z]/.test(p),
      (p: string) => /[0-9]/.test(p),
      (p: string) => /[^A-Za-z0-9]/.test(p),
    ][i],
  }));

  useEffect(() => {
    let cancelled = false;

    if (!token) {
      return;
    }

    Promise.resolve().then(() => {
      if (cancelled) return;

      setTokenLoading(true);
      setTokenLookupError("");
      merchantApi
        .getPasswordResetEmail(token)
        .then((result) => {
          if (cancelled) return;
          if (!result?.email) {
            setTokenLookupError(t.invalidToken);
            setResetEmail("");
            setAdminName("");
            return;
          }
          setResetEmail(result.email);
          setAdminName(result.adminName || result.email);
        })
        .catch((error) => {
          if (cancelled) return;
          const message =
            error instanceof Error ? error.message : t.invalidToken;
          setTokenLookupError(message || t.invalidToken);
          setResetEmail("");
          setAdminName("");
        })
        .finally(() => {
          if (!cancelled) setTokenLoading(false);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [token, t.invalidToken]);

  console.log(
    "[ResetPassword] render, email:",
    email,
    "loading:",
    loading,
    "done:",
    done,
    "lang:",
    lang,
    "token:",
    Boolean(token),
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      return;
    }
    if (tokenError || tokenLoading) {
      return;
    }
    const errs: { password?: string; confirm?: string } = {};
    if (!password) {
      errs.password = t.errPasswordRequired;
    } else if (password.length < 8) {
      errs.password = t.errPasswordTooShort;
    }
    if (!confirmPassword) {
      errs.confirm = t.errConfirmRequired;
    } else if (password && confirmPassword !== password) {
      errs.confirm = t.errPasswordMismatch;
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      await merchantApi.resetPassword(token, password);
      setDone(true);
      toast.success(t.toastSuccess);
      window.setTimeout(() => {
        navigate(`/login?email=${encodeURIComponent(email)}`, {
          replace: true,
        });
      }, 1200);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t.toastError);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-cmp="ResetPassword"
      className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden"
    >
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          width: 480,
          height: 480,
          top: -160,
          right: -140,
          background: "var(--secondary)",
          opacity: 0.5,
        }}
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          width: 300,
          height: 300,
          bottom: -80,
          left: -80,
          background: "var(--accent)",
          opacity: 0.65,
        }}
      />
      <div
        className="absolute pointer-events-none rounded-full"
        style={{
          width: 180,
          height: 180,
          top: "40%",
          left: "15%",
          background: "var(--secondary)",
          opacity: 0.35,
        }}
      />

      <div
        className="absolute top-5 right-6 flex items-center gap-2"
        style={{ zIndex: 10 }}
      >
        <Globe size={14} style={{ color: "var(--muted-foreground)" }} />
        <div
          className="flex items-center rounded-full p-0.5 select-none"
          style={{
            background: "var(--muted)",
            border: "1px solid var(--border)",
          }}
        >
          <button
            type="button"
            onClick={() => setLocale("en")}
            className="rounded-full px-3 py-1 text-xs font-semibold transition-all"
            style={{
              background: lang === "en" ? "var(--primary)" : "transparent",
              color:
                lang === "en"
                  ? "var(--primary-foreground)"
                  : "var(--muted-foreground)",
              cursor: lang === "en" ? "default" : "pointer",
            }}
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLocale("zh")}
            className="rounded-full px-3 py-1 text-xs font-semibold transition-all"
            style={{
              background: lang === "zh" ? "var(--primary)" : "transparent",
              color:
                lang === "zh"
                  ? "var(--primary-foreground)"
                  : "var(--muted-foreground)",
              cursor: lang === "zh" ? "default" : "pointer",
            }}
          >
            中文
          </button>
        </div>
      </div>

      <div
        className="relative w-full z-10"
        style={{ maxWidth: 480, padding: "0 20px" }}
      >
        <div
          className="flex flex-col items-center gap-5 py-16 px-8 bg-card rounded-2xl shadow-custom transition-all"
          style={{ display: done ? "flex" : "none" }}
        >
          <div
            className="flex items-center justify-center rounded-full"
            style={{
              width: 72,
              height: 72,
              background: "rgba(34,197,94,0.12)",
            }}
          >
            <CheckCircle size={36} style={{ color: "#22c55e" }} />
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-2xl font-bold text-foreground">
              {t.successTitle}
            </h2>
            <p className="text-sm text-muted-foreground">{t.successDesc}</p>
          </div>
          <div
            className="inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-full"
            style={{
              background: "var(--accent)",
              color: "var(--accent-foreground)",
            }}
          >
            <CalendarDays size={14} />
            {t.successBadge}
          </div>
        </div>

        <div
          className="bg-card rounded-2xl shadow-custom overflow-hidden"
          style={{ display: done ? "none" : "block" }}
        >
          <div
            className="h-1.5 w-full"
            style={{
              background: `linear-gradient(90deg, var(--primary) 0%, #22c55e 100%)`,
            }}
          />

          <div className="p-8 flex flex-col gap-7">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="flex items-center justify-center rounded-lg"
                  style={{
                    width: 34,
                    height: 34,
                    background: "var(--primary)",
                  }}
                >
                  <CalendarDays size={17} color="var(--primary-foreground)" />
                </div>
                <span className="text-sm font-bold text-foreground">
                  MONI-HR
                </span>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className="flex items-center justify-center rounded-xl flex-shrink-0"
                  style={{
                    width: 50,
                    height: 50,
                    background: "var(--secondary)",
                  }}
                >
                  <Key size={23} style={{ color: "var(--primary)" }} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl font-bold text-foreground">
                      {t.subtitle}
                    </h1>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t.welcome}，
                    <span className="font-semibold text-foreground">
                      {name}
                    </span>
                    ！{t.setPassword}
                  </p>
                </div>
              </div>
            </div>

            <div
              className="flex items-center gap-3 rounded-xl px-4 py-3"
              style={{
                background: "var(--accent)",
                border: "1px solid var(--border)",
              }}
            >
              <ShieldCheck
                size={18}
                style={{ color: "var(--primary)", flexShrink: 0 }}
              />
              <div className="flex flex-col min-w-0">
                <span className="text-xs text-muted-foreground">
                  {t.boundEmail}
                </span>
                <span className="text-sm font-semibold text-foreground truncate">
                  {tokenLoading
                    ? t.loadingEmail
                    : visibleEmail || t.emailFallback}
                </span>
              </div>
              <div
                className="ml-auto flex-shrink-0 text-xs font-medium px-2 py-0.5 rounded-full"
                style={{
                  background: tokenError
                    ? "rgba(239,68,68,0.1)"
                    : "var(--secondary)",
                  color: tokenError ? "var(--destructive)" : "var(--primary)",
                }}
              >
                {tokenLoading
                  ? t.checking
                  : tokenError
                    ? t.unavailable
                    : t.verified}
              </div>
            </div>
            <span
              className="text-xs -mt-5"
              style={{
                color: "var(--destructive)",
                display: tokenError ? "block" : "none",
              }}
            >
              {tokenError}
            </span>

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-foreground">
                  {t.newPassword}
                </label>
                <div className="relative flex items-center">
                  <span
                    className="absolute left-3 flex items-center pointer-events-none"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <Lock size={15} />
                  </span>
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      if (errors.password)
                        setErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    placeholder={t.newPasswordPlaceholder}
                    autoComplete="new-password"
                    className="w-full rounded-xl pl-9 pr-10 py-2.5 text-sm outline-none transition-all"
                    style={{
                      background: "var(--muted)",
                      border: `1.5px solid ${errors.password ? "var(--destructive)" : "var(--border)"}`,
                      color: "var(--foreground)",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--primary)";
                      e.currentTarget.style.boxShadow = `0 0 0 3px var(--ring)`;
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = errors.password
                        ? "var(--destructive)"
                        : "var(--border)";
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                  <button
                    type="button"
                    className="absolute right-3 flex items-center transition-opacity hover:opacity-70"
                    style={{ color: "var(--muted-foreground)" }}
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                  >
                    <span className={showPassword ? "block" : "hidden"}>
                      <EyeOff size={15} />
                    </span>
                    <span className={showPassword ? "hidden" : "block"}>
                      <Eye size={15} />
                    </span>
                  </button>
                </div>
                <span
                  className="text-xs transition-all"
                  style={{
                    color: "var(--destructive)",
                    display: errors.password ? "block" : "none",
                  }}
                >
                  {errors.password}
                </span>
                <StrengthBar password={password} lang={lang} />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-semibold text-foreground">
                  {t.confirmPassword}
                </label>
                <div className="relative flex items-center">
                  <span
                    className="absolute left-3 flex items-center pointer-events-none"
                    style={{ color: "var(--muted-foreground)" }}
                  >
                    <Lock size={15} />
                  </span>
                  <input
                    type={showConfirm ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => {
                      setConfirmPassword(e.target.value);
                      if (errors.confirm)
                        setErrors((prev) => ({ ...prev, confirm: undefined }));
                    }}
                    placeholder={t.confirmPasswordPlaceholder}
                    autoComplete="new-password"
                    className="w-full rounded-xl pl-9 pr-10 py-2.5 text-sm outline-none transition-all"
                    style={{
                      background: "var(--muted)",
                      border: `1.5px solid ${
                        errors.confirm
                          ? "var(--destructive)"
                          : confirmPassword && password === confirmPassword
                            ? "#22c55e"
                            : "var(--border)"
                      }`,
                      color: "var(--foreground)",
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = "var(--primary)";
                      e.currentTarget.style.boxShadow = `0 0 0 3px var(--ring)`;
                    }}
                    onBlur={(e) => {
                      if (errors.confirm) {
                        e.currentTarget.style.borderColor =
                          "var(--destructive)";
                      } else if (
                        confirmPassword &&
                        password === confirmPassword
                      ) {
                        e.currentTarget.style.borderColor = "#22c55e";
                      } else {
                        e.currentTarget.style.borderColor = "var(--border)";
                      }
                      e.currentTarget.style.boxShadow = "none";
                    }}
                  />
                  <button
                    type="button"
                    className="absolute right-3 flex items-center transition-opacity hover:opacity-70"
                    style={{ color: "var(--muted-foreground)" }}
                    onClick={() => setShowConfirm(!showConfirm)}
                    tabIndex={-1}
                  >
                    <span className={showConfirm ? "block" : "hidden"}>
                      <EyeOff size={15} />
                    </span>
                    <span className={showConfirm ? "hidden" : "block"}>
                      <Eye size={15} />
                    </span>
                  </button>
                </div>
                <span
                  className="text-xs"
                  style={{
                    color: "var(--destructive)",
                    display: errors.confirm ? "block" : "none",
                  }}
                >
                  {errors.confirm}
                </span>
                <span
                  className="flex items-center gap-1 text-xs font-medium"
                  style={{
                    color: "#22c55e",
                    display:
                      confirmPassword && password === confirmPassword
                        ? "flex"
                        : "none",
                  }}
                >
                  <CheckCircle size={12} />
                  {t.passwordsMatch}
                </span>
              </div>

              <div
                className="rounded-xl px-4 py-3 flex flex-col gap-2.5"
                style={{
                  background: "var(--muted)",
                  border: "1px solid var(--border)",
                }}
              >
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  {t.rulesTitle}
                </span>
                <div className="flex flex-col gap-1.5">
                  {RULES.map((rule) => {
                    const passed = rule.test(password);
                    return (
                      <div key={rule.label} className="flex items-center gap-2">
                        <CheckCircle
                          size={13}
                          style={{
                            color: passed ? "#22c55e" : "var(--border)",
                            flexShrink: 0,
                            transition: "color 0.2s",
                          }}
                        />
                        <span
                          className="text-xs transition-colors"
                          style={{
                            color: passed
                              ? "#22c55e"
                              : "var(--muted-foreground)",
                          }}
                        >
                          {rule.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || formDisabled}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl text-sm font-bold transition-all mt-1"
                style={{
                  background:
                    loading || formDisabled
                      ? "var(--muted)"
                      : `linear-gradient(90deg, var(--primary) 0%, #0e4fc4 100%)`,
                  color:
                    loading || formDisabled
                      ? "var(--muted-foreground)"
                      : "white",
                  cursor: loading || formDisabled ? "not-allowed" : "pointer",
                  border: "none",
                  boxShadow:
                    loading || formDisabled
                      ? "none"
                      : "0 4px 14px rgba(22,119,255,0.35)",
                }}
              >
                <span
                  className={loading ? "flex" : "hidden"}
                  style={{ alignItems: "center", gap: 8 }}
                >
                  <span
                    className="inline-block rounded-full border-2 animate-spin"
                    style={{
                      width: 16,
                      height: 16,
                      borderColor:
                        "var(--muted-foreground) transparent var(--muted-foreground) transparent",
                    }}
                  />
                  {t.resetting}
                </span>
                <span
                  className={loading ? "hidden" : "flex"}
                  style={{ alignItems: "center", gap: 8 }}
                >
                  <ShieldCheck size={16} />
                  {t.submitBtn}
                  <ArrowRight size={15} />
                </span>
              </button>
            </form>
          </div>
        </div>

        <p
          className="text-center text-xs mt-5"
          style={{
            color: "var(--muted-foreground)",
            display: done ? "none" : "block",
          }}
        >
          {t.terms}&nbsp;
          <span className="font-medium" style={{ color: "var(--primary)" }}>
            {t.termsLink}
          </span>
          &nbsp;{t.and}&nbsp;
          <span className="font-medium" style={{ color: "var(--primary)" }}>
            {t.privacyLink}
          </span>
        </p>
      </div>
    </div>
  );
}
