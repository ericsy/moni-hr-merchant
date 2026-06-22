export const MONI_HR_LOGO_SRC = "/moni-hr-logo.png";

interface MoniHrLogoProps {
  size?: number;
  className?: string;
  rounded?: "lg" | "xl" | "2xl";
}

export function MoniHrLogo({
  size = 36,
  className = "",
  rounded = "xl",
}: MoniHrLogoProps) {
  const radiusClass =
    rounded === "lg"
      ? "rounded-lg"
      : rounded === "2xl"
        ? "rounded-2xl"
        : "rounded-xl";

  return (
    <img
      src={MONI_HR_LOGO_SRC}
      alt="MONI-HR"
      width={size}
      height={size}
      className={`flex-shrink-0 object-contain ${radiusClass} ${className}`.trim()}
    />
  );
}
