import { TimePicker, type TimePickerProps } from "antd";
import type { Dayjs } from "dayjs";
import { useRef, useState } from "react";

export default function AutoCloseTimePicker({
  onChange,
  onOpenChange,
  onCalendarChange,
  value,
  ...rest
}: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const lastPanelValueRef = useRef<Dayjs | null>(null);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      lastPanelValueRef.current = value ?? null;
    }
    setOpen(nextOpen);
    onOpenChange?.(nextOpen);
  };

  const shouldCloseAfterPanelSelect = (
    previous: Dayjs | null,
    next: Dayjs,
  ) => {
    if (rest.showSecond) {
      return previous.second() !== next.second();
    }
    if (rest.showMinute !== false) {
      return previous.minute() !== next.minute();
    }
    return previous.hour() !== next.hour();
  };

  return (
    <TimePicker
      {...rest}
      value={value}
      open={open}
      needConfirm={false}
      onOpenChange={handleOpenChange}
      onCalendarChange={(date, dateString, info) => {
        onCalendarChange?.(date, dateString, info);
        const nextValue = date as Dayjs | null;
        if (!nextValue) return;

        const previous = lastPanelValueRef.current;
        lastPanelValueRef.current = nextValue;

        if (previous && shouldCloseAfterPanelSelect(previous, nextValue)) {
          setOpen(false);
        }
      }}
      onChange={(nextValue, dateString) => {
        onChange?.(nextValue, dateString);
      }}
    />
  );
}
