import type { Employee } from "../context/DataContext";

export function getEmployeeInitials(firstName = "", lastName = "") {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function isHttpUrl(value = "") {
  return /^https?:\/\//i.test(value.trim());
}

export function getEmployeeAvatarUrl(
  employee?: Pick<Employee, "avatar" | "avatarPreviewUrl"> | null,
) {
  if (!employee) return "";
  const previewUrl = employee.avatarPreviewUrl || "";
  if (isHttpUrl(previewUrl)) return previewUrl;
  const avatar = employee.avatar || "";
  if (isHttpUrl(avatar)) return avatar;
  return "";
}
