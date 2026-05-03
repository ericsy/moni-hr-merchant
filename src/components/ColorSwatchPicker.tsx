import { Tooltip } from "antd";
import type { CSSProperties } from "react";

export interface ColorSwatchOption {
  key: string;
  value: string;
  labelZh: string;
  labelEn: string;
}

export const DEFAULT_COLOR_SWATCHES: ColorSwatchOption[] = [
  { key: "blue", value: "#60a5fa", labelZh: "蓝色", labelEn: "Blue" },
  { key: "green", value: "#34d399", labelZh: "绿色", labelEn: "Green" },
  { key: "purple", value: "#a78bfa", labelZh: "紫色", labelEn: "Purple" },
  { key: "orange", value: "#fb923c", labelZh: "橙色", labelEn: "Orange" },
  { key: "red", value: "#f87171", labelZh: "红色", labelEn: "Red" },
  { key: "cyan", value: "#38bdf8", labelZh: "青色", labelEn: "Cyan" },
  { key: "yellow", value: "#facc15", labelZh: "黄色", labelEn: "Yellow" },
  { key: "pink", value: "#f472b6", labelZh: "粉色", labelEn: "Pink" },
];

export const DEFAULT_COLOR_KEY = DEFAULT_COLOR_SWATCHES[0].key;
export const DEFAULT_COLOR_VALUE = DEFAULT_COLOR_SWATCHES[0].value;

export const isHexColor = (value = "") => /^#(?:[0-9A-Fa-f]{3}){1,2}$/.test(value);

export const hexToRgba = (hex: string, alpha: number) => {
  const normalized = hex.replace("#", "");
  const safeHex = normalized.length === 3
    ? normalized.split("").map((char) => char + char).join("")
    : normalized;
  const int = Number.parseInt(safeHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const getDefaultColorSwatch = (color = "") => {
  const normalized = color.trim().toLowerCase();
  return DEFAULT_COLOR_SWATCHES.find((option) =>
    option.key === normalized || option.value.toLowerCase() === normalized
  ) || null;
};

export const resolveColorValue = (color = "") => {
  const trimmed = color.trim();
  if (isHexColor(trimmed) || trimmed.startsWith("var(")) return trimmed;
  return getDefaultColorSwatch(trimmed)?.value || DEFAULT_COLOR_VALUE;
};

export const getColorLabel = (color: string, locale: string) => {
  const swatch = getDefaultColorSwatch(color);
  if (!swatch) return color || (locale === "zh" ? "蓝色" : "Blue");
  return locale === "zh" ? swatch.labelZh : swatch.labelEn;
};

export const getSoftColorStyle = (color: string) => {
  const value = resolveColorValue(color);
  return {
    bg: isHexColor(value) ? hexToRgba(value, 0.14) : "var(--secondary)",
    border: value,
    text: value,
  };
};

export function ColorSwatchPicker({
  value = DEFAULT_COLOR_KEY,
  onChange = () => {},
  locale = "zh",
  valueMode = "key",
  size = 26,
  gap = 8,
}: {
  value?: string;
  onChange?: (value: string) => void;
  locale?: string;
  valueMode?: "key" | "value";
  size?: number;
  gap?: number;
}) {
  const selectedSwatch = getDefaultColorSwatch(value);

  return (
    <div className="flex items-center" style={{ gap, flexWrap: "wrap" }}>
      {DEFAULT_COLOR_SWATCHES.map((option) => {
        const active = selectedSwatch?.key === option.key;
        const label = locale === "zh" ? option.labelZh : option.labelEn;
        const nextValue = valueMode === "value" ? option.value : option.key;
        const style: CSSProperties = {
          width: size,
          height: size,
          borderRadius: "50%",
          background: option.value,
          border: active ? "3px solid var(--foreground)" : "2px solid var(--border)",
          boxShadow: active ? `0 0 0 2px ${hexToRgba(option.value, 0.28)}` : "none",
          cursor: "pointer",
          transform: active ? "scale(1.08)" : "scale(1)",
          transition: "transform 0.15s, border-color 0.15s, box-shadow 0.15s",
        };

        return (
          <Tooltip key={option.key} title={label}>
            <button
              type="button"
              aria-label={label}
              onClick={() => onChange(nextValue)}
              className="transition-all"
              style={style}
            />
          </Tooltip>
        );
      })}
    </div>
  );
}
