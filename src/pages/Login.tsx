import {
  CalendarDays,
  Eye,
  EyeOff,
  Globe,
  Lock,
  LogIn,
  Mail,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { Checkbox } from "../components/ui/checkbox";
import { useAuth } from "../context/AuthContext";
import { useLocale } from "../context/LocaleContext";
import {
  clearCredentials,
  decryptCredentials,
  encryptCredentials,
  loadCredentials,
  saveCredentials,
} from "../lib/credentials";
import { merchantApi } from "../lib/merchantApi";

const T = {
  en: {
    welcomeBack: "Welcome back",
    subtitle: "Sign in to your account",
    emailLabel: "Email address",
    emailPlaceholder: "Enter email address",
    passwordLabel: "Password",
    passwordPlaceholder: "Enter password",
    rememberMe: "Remember me",
    forgotPassword: "Forgot password?",
    submitBtn: "Sign In",
    signingIn: "Signing in...",
    toastError: "Sign in failed",
    errEmailRequired: "Please enter your email address",
    errEmailInvalid: "Please enter a valid email address",
    errPasswordRequired: "Please enter your password",
    forgotPasswordTitle: "Reset Password",
    forgotPasswordDesc:
      "Enter your email address and we'll send you a link to reset your password.",
    forgotPasswordEmailPlaceholder: "Enter your email address",
    sendResetLink: "Send Reset Link",
    sending: "Sending...",
    toastForgotPasswordSuccess:
      "Password reset link sent. Please check your email.",
    toastForgotPasswordError: "Failed to send reset link",
    cancel: "Cancel",
  },
  zh: {
    welcomeBack: "欢迎回来",
    subtitle: "请登录您的账户",
    emailLabel: "邮箱地址",
    emailPlaceholder: "请输入邮箱地址",
    passwordLabel: "密码",
    passwordPlaceholder: "请输入密码",
    rememberMe: "记住我",
    forgotPassword: "忘记密码？",
    submitBtn: "登录",
    signingIn: "登录中...",
    toastError: "登录失败",
    errEmailRequired: "请输入邮箱地址",
    errEmailInvalid: "请输入有效的邮箱地址",
    errPasswordRequired: "请输入密码",
    forgotPasswordTitle: "重置密码",
    forgotPasswordDesc: "输入您的邮箱地址，我们将向您发送重置密码的链接。",
    forgotPasswordEmailPlaceholder: "请输入邮箱地址",
    sendResetLink: "发送重置链接",
    sending: "发送中...",
    toastForgotPasswordSuccess: "密码重置链接已发送，请查收邮件。",
    toastForgotPasswordError: "发送重置链接失败",
    cancel: "取消",
  },
} as const;

type Lang = keyof typeof T;
const REMEMBER_ME_STORAGE_KEY = "moni_hr_remember_me";

function readRememberMePreference() {
  if (typeof window === "undefined") return false;

  try {
    return window.localStorage.getItem(REMEMBER_ME_STORAGE_KEY) === "true";
  } catch (error) {
    console.log("[Login] failed to read remember me preference:", error);
    return false;
  }
}

function writeRememberMePreference(rememberMe: boolean) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(
      REMEMBER_ME_STORAGE_KEY,
      rememberMe ? "true" : "false",
    );
  } catch (error) {
    console.log("[Login] failed to save remember me preference:", error);
  }
}

export default function Login() {
  const { login } = useAuth();
  const { locale, setLocale } = useLocale();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(() => searchParams.get("email") || "");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(readRememberMePreference);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [forgotPasswordOpen, setForgotPasswordOpen] = useState(false);
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("");
  const [forgotPasswordLoading, setForgotPasswordLoading] = useState(false);
  const lang: Lang = locale;
  const t = T[lang];

  useEffect(() => {
    const cipherText = loadCredentials();
    console.log("[Login] loadCredentials, cipherText:", cipherText);
    if (cipherText) {
      decryptCredentials(cipherText).then((creds) => {
        console.log("[Login] decryptCredentials, creds:", creds);
        if (creds) {
          setEmail(creds.email);
          setPassword(creds.password);
          setRememberMe(true);
        }
      });
    }
  }, []);

  console.log("[Login] render, loading:", loading, "lang:", lang);

  const validate = () => {
    const errs: { email?: string; password?: string } = {};
    if (!email.trim()) {
      errs.email = t.errEmailRequired;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errs.email = t.errEmailInvalid;
    }
    if (!password) {
      errs.password = t.errPasswordRequired;
    }
    return errs;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const result = await login(email.trim(), password, rememberMe);
      if (!result.success) {
        toast.error(result.message ?? t.toastError);
      } else {
        writeRememberMePreference(rememberMe);
        if (rememberMe) {
          const cipherText = await encryptCredentials(email.trim(), password);
          saveCredentials(cipherText);
        } else {
          clearCredentials();
        }
        navigate("/", { replace: true });
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotPasswordEmail.trim()) {
      toast.error(t.errEmailRequired);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(forgotPasswordEmail)) {
      toast.error(t.errEmailInvalid);
      return;
    }
    setForgotPasswordLoading(true);
    try {
      await merchantApi.forgotPassword(forgotPasswordEmail.trim());
      toast.success(t.toastForgotPasswordSuccess);
      setForgotPasswordOpen(false);
      setForgotPasswordEmail("");
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t.toastForgotPasswordError,
      );
    } finally {
      setForgotPasswordLoading(false);
    }
  };

  return (
    <div
      data-cmp="Login"
      className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden"
    >
      {/* Background decoration */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ zIndex: 0 }}
      >
        <div
          className="absolute rounded-full"
          style={{
            width: 480,
            height: 480,
            top: "-120px",
            right: "-80px",
            background: "var(--secondary)",
            opacity: 0.6,
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 320,
            height: 320,
            bottom: "-60px",
            left: "-60px",
            background: "var(--accent)",
            opacity: 0.8,
          }}
        />
      </div>

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

      {/* Card */}
      <div
        className="relative bg-card rounded-2xl shadow-custom w-full mx-4 overflow-hidden"
        style={{ maxWidth: 440, zIndex: 1 }}
      >
        {/* Top accent bar */}
        <div className="h-1 w-full" style={{ background: "var(--primary)" }} />

        <div className="p-10">
          {/* Logo & title */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="flex items-center justify-center rounded-2xl mb-4"
              style={{
                width: 56,
                height: 56,
                background: "var(--primary)",
              }}
            >
              <CalendarDays size={28} color="var(--primary-foreground)" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">MONI-HR</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t.welcomeBack}, {t.subtitle}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* Email */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                {t.emailLabel}
              </label>
              <div className="relative flex items-center">
                <span
                  className="absolute left-3 flex items-center pointer-events-none"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (errors.email)
                      setErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  placeholder={t.emailPlaceholder}
                  autoComplete="email"
                  className="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none transition-all"
                  style={{
                    background: "var(--muted)",
                    border: `1px solid ${errors.email ? "var(--destructive)" : "var(--border)"}`,
                    color: "var(--foreground)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.boxShadow = `0 0 0 3px var(--ring)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = errors.email
                      ? "var(--destructive)"
                      : "var(--border)";
                    e.currentTarget.style.boxShadow = "none";
                  }}
                />
              </div>
              {errors.email && (
                <span
                  className="text-xs"
                  style={{ color: "var(--destructive)" }}
                >
                  {errors.email}
                </span>
              )}
            </div>

            {/* Password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">
                {t.passwordLabel}
              </label>
              <div className="relative flex items-center">
                <span
                  className="absolute left-3 flex items-center pointer-events-none"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <Lock size={16} />
                </span>
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errors.password)
                      setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  placeholder={t.passwordPlaceholder}
                  autoComplete="current-password"
                  className="w-full rounded-lg pl-9 pr-10 py-2.5 text-sm outline-none transition-all"
                  style={{
                    background: "var(--muted)",
                    border: `1px solid ${errors.password ? "var(--destructive)" : "var(--border)"}`,
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
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <span
                  className="text-xs"
                  style={{ color: "var(--destructive)" }}
                >
                  {errors.password}
                </span>
              )}
            </div>

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="remember-me"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <label
                  htmlFor="remember-me"
                  className="text-sm text-muted-foreground select-none cursor-pointer"
                >
                  {t.rememberMe}
                </label>
              </div>
              <button
                type="button"
                className="text-sm font-medium transition-opacity hover:opacity-70"
                style={{ color: "var(--primary)" }}
                onClick={() => {
                  setForgotPasswordEmail(email);
                  setForgotPasswordOpen(true);
                }}
              >
                {t.forgotPassword}
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity mt-1"
              style={{
                background: loading ? "var(--muted)" : "var(--primary)",
                color: loading
                  ? "var(--muted-foreground)"
                  : "var(--primary-foreground)",
                cursor: loading ? "not-allowed" : "pointer",
                border: "none",
              }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span
                    className="inline-block rounded-full border-2 animate-spin"
                    style={{
                      width: 16,
                      height: 16,
                      borderColor:
                        "var(--muted-foreground) transparent var(--muted-foreground) transparent",
                    }}
                  />
                  {t.signingIn}
                </span>
              ) : (
                <>
                  <LogIn size={16} />
                  {t.submitBtn}
                </>
              )}
            </button>
          </form>
        </div>
      </div>

      {forgotPasswordOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 50, background: "rgba(0, 0, 0, 0.5)" }}
          onClick={() => !forgotPasswordLoading && setForgotPasswordOpen(false)}
        >
          <div
            className="relative bg-card rounded-2xl shadow-custom w-full mx-4 overflow-hidden"
            style={{ maxWidth: 440 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="h-1 w-full"
              style={{ background: "var(--primary)" }}
            />

            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-foreground">
                  {t.forgotPasswordTitle}
                </h2>
                <button
                  type="button"
                  className="flex items-center justify-center transition-opacity hover:opacity-70"
                  style={{ color: "var(--muted-foreground)" }}
                  onClick={() =>
                    !forgotPasswordLoading && setForgotPasswordOpen(false)
                  }
                  disabled={forgotPasswordLoading}
                >
                  <X size={20} />
                </button>
              </div>

              <p className="text-sm text-muted-foreground mb-6">
                {t.forgotPasswordDesc}
              </p>

              <form
                onSubmit={handleForgotPassword}
                className="flex flex-col gap-5"
              >
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-foreground">
                    {t.emailLabel}
                  </label>
                  <div className="relative flex items-center">
                    <span
                      className="absolute left-3 flex items-center pointer-events-none"
                      style={{ color: "var(--muted-foreground)" }}
                    >
                      <Mail size={16} />
                    </span>
                    <input
                      type="email"
                      value={forgotPasswordEmail}
                      onChange={(e) => setForgotPasswordEmail(e.target.value)}
                      placeholder={t.forgotPasswordEmailPlaceholder}
                      autoComplete="email"
                      className="w-full rounded-lg pl-9 pr-4 py-2.5 text-sm outline-none transition-all"
                      style={{
                        background: "var(--muted)",
                        border: "1px solid var(--border)",
                        color: "var(--foreground)",
                      }}
                      onFocus={(e) => {
                        e.currentTarget.style.borderColor = "var(--primary)";
                        e.currentTarget.style.boxShadow = `0 0 0 3px var(--ring)`;
                      }}
                      onBlur={(e) => {
                        e.currentTarget.style.borderColor = "var(--border)";
                        e.currentTarget.style.boxShadow = "none";
                      }}
                      disabled={forgotPasswordLoading}
                    />
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    type="button"
                    className="flex-1 py-2.5 rounded-lg text-sm font-semibold transition-opacity"
                    style={{
                      background: "var(--muted)",
                      color: "var(--foreground)",
                      border: "1px solid var(--border)",
                      cursor: forgotPasswordLoading ? "not-allowed" : "pointer",
                    }}
                    onClick={() => setForgotPasswordOpen(false)}
                    disabled={forgotPasswordLoading}
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={forgotPasswordLoading}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-opacity"
                    style={{
                      background: forgotPasswordLoading
                        ? "var(--muted)"
                        : "var(--primary)",
                      color: forgotPasswordLoading
                        ? "var(--muted-foreground)"
                        : "var(--primary-foreground)",
                      cursor: forgotPasswordLoading ? "not-allowed" : "pointer",
                      border: "none",
                    }}
                  >
                    {forgotPasswordLoading ? (
                      <span className="flex items-center gap-2">
                        <span
                          className="inline-block rounded-full border-2 animate-spin"
                          style={{
                            width: 16,
                            height: 16,
                            borderColor:
                              "var(--muted-foreground) transparent var(--muted-foreground) transparent",
                          }}
                        />
                        {t.sending}
                      </span>
                    ) : (
                      t.sendResetLink
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
