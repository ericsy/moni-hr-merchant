import dayjs, { type ConfigType } from "dayjs";

export const API_DATE_FORMAT = "YYYY-MM-DD";

export function getCountryDateFormat(country?: string | null) {
  const normalized = (country || "").trim().toLowerCase();
  if (["cn", "chn", "china", "中国"].includes(normalized)) return "YYYY-MM-DD";
  if (["nz", "nzl", "new zealand", "新西兰", "au", "aus", "australia", "澳大利亚"].includes(normalized)) {
    return "DD/MM/YYYY";
  }
  return API_DATE_FORMAT;
}

export function formatApiDate(value: ConfigType) {
  return value ? dayjs(value).format(API_DATE_FORMAT) : "";
}

export function formatCountryDate(value: ConfigType, country?: string | null) {
  if (!value) return "";
  const date = dayjs(value);
  return date.isValid() ? date.format(getCountryDateFormat(country)) : "";
}

