import { Button, InputNumber, Popover } from "antd";
import dayjs, { type Dayjs } from "dayjs";
import { Clock } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const TIME_ONLY_DATE = "2000-01-01";

export function parseTimeParts(
  value?: Dayjs | string | null,
  fallbackHour = 9,
  fallbackMinute = 0,
) {
  if (dayjs.isDayjs(value) && value.isValid()) {
    return { hour: value.hour(), minute: value.minute() };
  }
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (match) {
      const hour = Number(match[1]);
      const minute = Number(match[2]);
      if (
        hour >= 0 &&
        hour <= 23 &&
        minute >= 0 &&
        minute <= 59
      ) {
        return { hour, minute };
      }
    }
  }
  return { hour: fallbackHour, minute: fallbackMinute };
}

export function partsToDayjs(hour: number, minute: number) {
  const safeHour = Math.min(23, Math.max(0, Math.round(hour)));
  const safeMinute = Math.min(59, Math.max(0, Math.round(minute)));
  return dayjs(
    `${TIME_ONLY_DATE} ${String(safeHour).padStart(2, "0")}:${String(safeMinute).padStart(2, "0")}`,
    "YYYY-MM-DD HH:mm",
  );
}

export function normalizeMinuteValue(minute: number, step = 1) {
  const clamped = Math.min(59, Math.max(0, Math.round(minute)));
  if (step <= 1) return clamped;
  const snapped = Math.round(clamped / step) * step;
  return Math.min(59, Math.max(0, snapped));
}

export interface HourMinuteTimePickerProps {
  value?: Dayjs | null;
  onChange?: (value: Dayjs | null) => void;
  disabled?: boolean;
  placeholder?: string;
  minuteStep?: number;
  locale?: "zh" | "en";
  className?: string;
  style?: React.CSSProperties;
}

export default function HourMinuteTimePicker({
  value,
  onChange,
  disabled = false,
  placeholder,
  minuteStep = 1,
  locale = "zh",
  className,
  style,
}: HourMinuteTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [draftHour, setDraftHour] = useState(9);
  const [draftMinute, setDraftMinute] = useState(0);
  const [error, setError] = useState("");

  const labels = useMemo(
    () =>
      locale === "zh"
        ? {
            hour: "时",
            minute: "分",
            confirm: "确定",
            invalid: "请输入有效时间",
          }
        : {
            hour: "Hr",
            minute: "Min",
            confirm: "OK",
            invalid: "Enter a valid time",
          },
    [locale],
  );

  const displayText = useMemo(() => {
    if (!value || !dayjs.isDayjs(value) || !value.isValid()) return "";
    return value.format("HH:mm");
  }, [value]);

  const syncDraftFromValue = () => {
    const parts = parseTimeParts(value);
    setDraftHour(parts.hour);
    setDraftMinute(parts.minute);
    setError("");
  };

  useEffect(() => {
    if (!open) return;
    syncDraftFromValue();
  }, [open, value]);

  const handleConfirm = () => {
    const hour = Number(draftHour);
    const minute = normalizeMinuteValue(Number(draftMinute), minuteStep);

    if (
      !Number.isFinite(hour) ||
      !Number.isFinite(minute) ||
      hour < 0 ||
      hour > 23
    ) {
      setError(labels.invalid);
      return;
    }

    onChange?.(partsToDayjs(hour, minute));
    setOpen(false);
    setError("");
  };

  const popoverContent = (
    <div className="flex flex-col gap-3" style={{ minWidth: 220 }}>
      <div className="flex items-center justify-center gap-2">
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {labels.hour}
          </span>
          <InputNumber
            min={0}
            max={23}
            value={draftHour}
            onChange={(next) => {
              if (next === null) return;
              setDraftHour(next);
              setError("");
            }}
            onPressEnter={handleConfirm}
            controls
            style={{ width: 72 }}
          />
        </div>
        <span
          className="text-lg font-semibold pt-5"
          style={{ color: "var(--muted-foreground)" }}
        >
          :
        </span>
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {labels.minute}
          </span>
          <InputNumber
            min={0}
            max={59}
            step={minuteStep > 1 ? minuteStep : 1}
            value={draftMinute}
            onChange={(next) => {
              if (next === null) return;
              setDraftMinute(next);
              setError("");
            }}
            onPressEnter={handleConfirm}
            controls
            style={{ width: 72 }}
          />
        </div>
      </div>
      {error ? (
        <div className="text-xs text-center" style={{ color: "var(--destructive)" }}>
          {error}
        </div>
      ) : null}
      <Button type="primary" size="small" block onClick={handleConfirm}>
        {labels.confirm}
      </Button>
    </div>
  );

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        if (disabled) return;
        if (!nextOpen) {
          setError("");
        }
        setOpen(nextOpen);
      }}
      trigger="click"
      placement="bottomLeft"
      content={popoverContent}
    >
      <button
        type="button"
        disabled={disabled}
        className={`flex w-full items-center gap-2 rounded-md px-3 text-sm ${className || ""}`}
        style={{
          height: 32,
          border: "1px solid var(--border)",
          background: disabled ? "var(--muted)" : "var(--card)",
          color: displayText ? "var(--foreground)" : "var(--muted-foreground)",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.7 : 1,
          ...style,
        }}
      >
        <Clock size={14} style={{ flexShrink: 0 }} />
        <span className="flex-1 text-left">
          {displayText || placeholder || "00:00"}
        </span>
      </button>
    </Popover>
  );
}
