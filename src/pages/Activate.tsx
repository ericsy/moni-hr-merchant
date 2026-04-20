import { useState } from "react";
import { Lock, Eye, EyeOff, CalendarDays, CheckCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "../context/AuthContext";

function StrengthBar({ password }: { password: string }) {
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
  const labels = ["", "弱", "一般", "较强", "强"];
  const colorVars = ["", "var(--destructive)", "var(--chart-3)", "var(--chart-2)", "var(--chart-2)"];

  if (password.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5 mt-1">
      <div className="flex gap-1">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="h-1 flex-1 rounded-full transition-all"
            style={{
              background: i <= strength ? colorVars[strength] : "var(--border)",
            }}
          />
        ))}
      </div>
      {strength > 0 && (
        <span className="text-xs" style={{ color: colorVars[strength] }}>
          密码强度：{labels[strength]}
        </span>
      )}
    </div>
  );
}

const RULES = [
  { label: "至少 8 位字符", test: (p: string) => p.length >= 8 },
  { label: "包含大写字母", test: (p: string) => /[A-Z]/.test(p) },
  { label: "包含数字", test: (p: string) => /[0-9]/.test(p) },
];

export default function Activate() {
  const { user, activate } = useAuth();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});

  const email = user?.email ?? "";
  const name = user?.name ?? "用户";

  console.log("[Activate] render, email:", email, "loading:", loading);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: { password?: string; confirm?: string } = {};
    if (!password) {
      errs.password = "请输入新密码";
    } else if (password.length < 8) {
      errs.password = "密码至少需要 8 位字符";
    }
    if (!confirmPassword) {
      errs.confirm = "请再次确认密码";
    } else if (password && confirmPassword !== password) {
      errs.confirm = "两次输入的密码不一致";
    }
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    setLoading(true);
    try {
      const result = await activate(email, password, confirmPassword);
      if (result.success) {
        toast.success("账户已激活，正在进入系统…");
      } else {
        toast.error(result.message ?? "激活失败，请重试");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      data-cmp="Activate"
      className="min-h-screen flex items-center justify-center bg-background"
    >
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }}>
        <div
          className="absolute rounded-full"
          style={{
            width: 520,
            height: 520,
            top: "-140px",
            left: "-80px",
            background: "var(--secondary)",
            opacity: 0.5,
          }}
        />
        <div
          className="absolute rounded-full"
          style={{
            width: 360,
            height: 360,
            bottom: "-80px",
            right: "-60px",
            background: "var(--accent)",
            opacity: 0.7,
          }}
        />
      </div>

      {/* Card */}
      <div
        className="relative bg-card rounded-2xl shadow-custom w-full mx-4 overflow-hidden"
        style={{ maxWidth: 460, zIndex: 1 }}
      >
        {/* Top accent bar */}
        <div
          className="h-1 w-full"
          style={{ background: `linear-gradient(90deg, var(--primary), var(--chart-2))` }}
        />

        <div className="p-10">
          {/* Header */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="flex items-center justify-center rounded-2xl mb-4"
              style={{ width: 56, height: 56, background: "var(--primary)" }}
            >
              <CalendarDays size={28} color="var(--primary-foreground)" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">激活账户</h1>
            <p className="text-sm text-muted-foreground mt-1 text-center">
              欢迎，<span className="font-medium text-foreground">{name}</span>！请设置您的登录密码以完成账户激活
            </p>
          </div>

          {/* Email display */}
          <div
            className="flex items-center gap-3 rounded-xl px-4 py-3 mb-6"
            style={{
              background: "var(--accent)",
              border: "1px solid var(--border)",
            }}
          >
            <ShieldCheck size={18} style={{ color: "var(--primary)", flexShrink: 0 }} />
            <div className="flex flex-col min-w-0">
              <span className="text-xs text-muted-foreground">账户邮箱</span>
              <span className="text-sm font-medium text-foreground truncate">{email}</span>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            {/* New password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">设置密码</label>
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
                    if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
                  }}
                  placeholder="请输入新密码（至少 8 位）"
                  autoComplete="new-password"
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
                    e.currentTarget.style.borderColor = errors.password ? "var(--destructive)" : "var(--border)";
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
                <span className="text-xs" style={{ color: "var(--destructive)" }}>
                  {errors.password}
                </span>
              )}
              <StrengthBar password={password} />
            </div>

            {/* Confirm password */}
            <div className="flex flex-col gap-1.5">
              <label className="text-sm font-medium text-foreground">确认密码</label>
              <div className="relative flex items-center">
                <span
                  className="absolute left-3 flex items-center pointer-events-none"
                  style={{ color: "var(--muted-foreground)" }}
                >
                  <Lock size={16} />
                </span>
                <input
                  type={showConfirm ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errors.confirm) setErrors((prev) => ({ ...prev, confirm: undefined }));
                  }}
                  placeholder="请再次输入密码"
                  autoComplete="new-password"
                  className="w-full rounded-lg pl-9 pr-10 py-2.5 text-sm outline-none transition-all"
                  style={{
                    background: "var(--muted)",
                    border: `1px solid ${errors.confirm ? "var(--destructive)" : "var(--border)"}`,
                    color: "var(--foreground)",
                  }}
                  onFocus={(e) => {
                    e.currentTarget.style.borderColor = "var(--primary)";
                    e.currentTarget.style.boxShadow = `0 0 0 3px var(--ring)`;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = errors.confirm ? "var(--destructive)" : "var(--border)";
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
                  {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.confirm && (
                <span className="text-xs" style={{ color: "var(--destructive)" }}>
                  {errors.confirm}
                </span>
              )}
              {/* Match indicator */}
              {confirmPassword && password && confirmPassword === password && (
                <span className="flex items-center gap-1 text-xs" style={{ color: "var(--chart-2)" }}>
                  <CheckCircle size={12} />
                  密码匹配
                </span>
              )}
            </div>

            {/* Password rules */}
            <div
              className="rounded-xl px-4 py-3 flex flex-col gap-2"
              style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
            >
              <span className="text-xs font-medium text-muted-foreground">密码要求</span>
              <div className="flex flex-col gap-1.5">
                {RULES.map((rule) => {
                  const passed = rule.test(password);
                  return (
                    <div key={rule.label} className="flex items-center gap-2">
                      <CheckCircle
                        size={13}
                        style={{ color: passed ? "var(--chart-2)" : "var(--border)", flexShrink: 0 }}
                      />
                      <span
                        className="text-xs"
                        style={{ color: passed ? "var(--chart-2)" : "var(--muted-foreground)" }}
                      >
                        {rule.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg text-sm font-semibold transition-opacity mt-1"
              style={{
                background: loading ? "var(--muted)" : "var(--primary)",
                color: loading ? "var(--muted-foreground)" : "var(--primary-foreground)",
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
                      borderColor: "var(--muted-foreground) transparent var(--muted-foreground) transparent",
                    }}
                  />
                  激活中…
                </span>
              ) : (
                <>
                  <ShieldCheck size={16} />
                  激活账户
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
