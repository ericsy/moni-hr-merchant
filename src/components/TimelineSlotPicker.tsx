import { useCallback, useEffect, useRef, useState } from "react";
import { CheckIcon, PencilIcon, PlusCircleIcon, Trash2Icon, XIcon } from "lucide-react";
import type { TimeSlot } from "../context/DataContext";

const TOTAL_MINUTES = 24 * 60;
const STEP = 15;
const AXIS_HOURS = [0, 3, 6, 9, 12, 15, 18, 21, 24];

type DragMode = "moveSlot" | "resizeLeft" | "resizeRight";

interface DragState {
  mode: DragMode;
  slotIdx: number;
  startX: number;
  origStartMin: number;
  origEndMin: number;
  allSlots: TimeSlot[];
}

interface TimelineSlotPickerProps {
  slots?: TimeSlot[];
  onChange?: (slots: TimeSlot[]) => void;
  color?: string;
  disabled?: boolean;
}

function minutesToTime(minutes: number): string {
  const clamped = Math.max(0, Math.min(TOTAL_MINUTES, Math.round(minutes / STEP) * STEP));
  const hours = Math.floor(clamped / 60);
  const mins = clamped % 60;
  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function formatLabel(time: string): string {
  const [hours, minutes] = time.split(":").map(Number);
  if (hours === 0 && minutes === 0) return "12:00am";
  if (hours === 12 && minutes === 0) return "12:00pm";
  const suffix = hours >= 12 ? "pm" : "am";
  const displayHour = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHour}:${String(minutes).padStart(2, "0")}${suffix}`;
}

function parseTimeInput(raw: string): string | null {
  const trimmed = raw.trim().toLowerCase();
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})$/);
  if (match24) {
    const hours = Number(match24[1]);
    const minutes = Number(match24[2]);
    if (hours >= 0 && hours <= 24 && minutes >= 0 && minutes < 60 && (hours < 24 || minutes === 0)) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  const match12 = trimmed.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/);
  if (match12) {
    let hours = Number(match12[1]);
    const minutes = Number(match12[2] ?? "0");
    const suffix = match12[3];
    if (suffix === "am" && hours === 12) hours = 0;
    if (suffix === "pm" && hours !== 12) hours += 12;
    if (hours >= 0 && hours <= 24 && minutes >= 0 && minutes < 60 && (hours < 24 || minutes === 0)) {
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    }
  }

  return null;
}

function normalizeSlots(slots: TimeSlot[]) {
  return [...slots]
    .filter((slot) => timeToMinutes(slot.end) > timeToMinutes(slot.start))
    .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
}

function getSlotBounds(slots: TimeSlot[], idx: number) {
  return {
    minStart: idx > 0 ? timeToMinutes(slots[idx - 1].end) : 0,
    maxEnd: idx < slots.length - 1 ? timeToMinutes(slots[idx + 1].start) : TOTAL_MINUTES,
  };
}

function canPlaceSlot(slots: TimeSlot[], idx: number, candidate: TimeSlot): boolean {
  const start = timeToMinutes(candidate.start);
  const end = timeToMinutes(candidate.end);
  if (end <= start) return false;

  return slots.every((slot, slotIdx) => {
    if (slotIdx === idx) return true;
    const slotStart = timeToMinutes(slot.start);
    const slotEnd = timeToMinutes(slot.end);
    return end <= slotStart || start >= slotEnd;
  });
}

function findSlotInGap(slots: TimeSlot[], targetStart: number, duration = 60): TimeSlot | null {
  const orderedSlots = normalizeSlots(slots);
  let gapStart = 0;

  for (const slot of orderedSlots) {
    const gapEnd = timeToMinutes(slot.start);
    if (gapEnd - gapStart >= STEP && targetStart >= gapStart && targetStart < gapEnd) {
      const start = clamp(targetStart, gapStart, gapEnd - STEP);
      const end = Math.min(start + duration, gapEnd);
      return { start: minutesToTime(start), end: minutesToTime(end) };
    }
    gapStart = Math.max(gapStart, timeToMinutes(slot.end));
  }

  if (TOTAL_MINUTES - gapStart >= STEP && targetStart >= gapStart && targetStart <= TOTAL_MINUTES) {
    const start = clamp(targetStart, gapStart, TOTAL_MINUTES - STEP);
    const end = Math.min(start + duration, TOTAL_MINUTES);
    return { start: minutesToTime(start), end: minutesToTime(end) };
  }

  return null;
}

function findDefaultSlot(slots: TimeSlot[], preferredStart: number, duration = 60): TimeSlot | null {
  const preferred = findSlotInGap(slots, preferredStart, duration);
  if (preferred) return preferred;

  const orderedSlots = normalizeSlots(slots);
  let gapStart = 0;
  for (const slot of orderedSlots) {
    const gapEnd = timeToMinutes(slot.start);
    if (gapEnd - gapStart >= STEP) {
      return {
        start: minutesToTime(gapStart),
        end: minutesToTime(Math.min(gapStart + duration, gapEnd)),
      };
    }
    gapStart = Math.max(gapStart, timeToMinutes(slot.end));
  }

  if (TOTAL_MINUTES - gapStart >= STEP) {
    return {
      start: minutesToTime(gapStart),
      end: minutesToTime(Math.min(gapStart + duration, TOTAL_MINUTES)),
    };
  }

  return null;
}

function SlotTag({
  slot,
  idx,
  color,
  onRemove,
  onUpdate,
  disabled,
}: {
  slot: TimeSlot;
  idx: number;
  color: string;
  onRemove: (idx: number) => void;
  onUpdate: (idx: number, updated: TimeSlot) => boolean;
  disabled: boolean;
}) {
  const startMin = timeToMinutes(slot.start);
  const endMin = timeToMinutes(slot.end);
  const durationH = (endMin - startMin) / 60;
  const [editing, setEditing] = useState(false);
  const [startVal, setStartVal] = useState("");
  const [endVal, setEndVal] = useState("");
  const [startErr, setStartErr] = useState(false);
  const [endErr, setEndErr] = useState(false);
  const startInputRef = useRef<HTMLInputElement>(null);

  const openEdit = () => {
    if (disabled) return;
    setStartVal(formatLabel(slot.start));
    setEndVal(formatLabel(slot.end));
    setStartErr(false);
    setEndErr(false);
    setEditing(true);
  };

  useEffect(() => {
    if (!editing) return;
    window.setTimeout(() => startInputRef.current?.focus(), 30);
  }, [editing]);

  const handleConfirm = () => {
    const parsedStart = parseTimeInput(startVal);
    const parsedEnd = parseTimeInput(endVal);
    let hasError = false;

    if (!parsedStart) {
      setStartErr(true);
      hasError = true;
    }
    if (!parsedEnd) {
      setEndErr(true);
      hasError = true;
    }
    if (hasError || !parsedStart || !parsedEnd) return;
    if (timeToMinutes(parsedEnd) <= timeToMinutes(parsedStart)) {
      setEndErr(true);
      return;
    }

    const didUpdate = onUpdate(idx, { ...slot, start: parsedStart, end: parsedEnd });
    if (!didUpdate) {
      setStartErr(true);
      setEndErr(true);
      return;
    }
    setEditing(false);
  };

  const handleCancel = () => {
    setEditing(false);
    setStartErr(false);
    setEndErr(false);
  };

  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") handleConfirm();
    if (event.key === "Escape") handleCancel();
  };

  return (
    <div
      className="flex items-center gap-1 rounded-full text-xs font-medium"
      style={{
        background: `color-mix(in srgb, ${color} 14%, var(--card))`,
        border: `1px solid color-mix(in srgb, ${color} 40%, transparent)`,
        color: "var(--foreground)",
        padding: editing ? "3px 6px" : "2px 8px",
      }}
    >
      <div className={editing ? "hidden" : "flex items-center gap-1"}>
        <span>
          {formatLabel(slot.start)}-{formatLabel(slot.end)}
        </span>
        <span className="font-semibold" style={{ color }}>
          {durationH % 1 === 0 ? durationH : durationH.toFixed(1)}h
        </span>
        {!disabled && (
          <button
            type="button"
            onClick={openEdit}
            className="flex items-center justify-center rounded-full"
            title="Edit time"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--muted-foreground)",
              padding: 1,
            }}
          >
            <PencilIcon size={10} />
          </button>
        )}
        {!disabled && (
          <button
            type="button"
            onClick={() => onRemove(idx)}
            className="flex items-center justify-center rounded-full"
            title="Remove time"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--muted-foreground)",
              padding: 1,
            }}
          >
            <Trash2Icon size={10} />
          </button>
        )}
      </div>

      <div className={editing ? "flex items-center gap-1" : "hidden"}>
        <input
          ref={startInputRef}
          value={startVal}
          onChange={(event) => {
            setStartVal(event.target.value);
            setStartErr(false);
          }}
          onKeyDown={handleKeyDown}
          placeholder="9:00am"
          style={{
            width: 70,
            fontSize: 11,
            fontWeight: 500,
            padding: "1px 5px",
            borderRadius: 4,
            border: startErr
              ? "1.5px solid var(--destructive)"
              : `1.5px solid color-mix(in srgb, ${color} 60%, transparent)`,
            background: "var(--card)",
            color: "var(--foreground)",
            outline: "none",
          }}
        />
        <span style={{ color: "var(--muted-foreground)", fontSize: 10 }}>-</span>
        <input
          value={endVal}
          onChange={(event) => {
            setEndVal(event.target.value);
            setEndErr(false);
          }}
          onKeyDown={handleKeyDown}
          placeholder="10:00am"
          style={{
            width: 70,
            fontSize: 11,
            fontWeight: 500,
            padding: "1px 5px",
            borderRadius: 4,
            border: endErr
              ? "1.5px solid var(--destructive)"
              : `1.5px solid color-mix(in srgb, ${color} 60%, transparent)`,
            background: "var(--card)",
            color: "var(--foreground)",
            outline: "none",
          }}
        />
        <button
          type="button"
          onClick={handleConfirm}
          title="Confirm"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color,
            padding: 1,
            display: "flex",
            alignItems: "center",
          }}
        >
          <CheckIcon size={12} />
        </button>
        <button
          type="button"
          onClick={handleCancel}
          title="Cancel"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--muted-foreground)",
            padding: 1,
            display: "flex",
            alignItems: "center",
          }}
        >
          <XIcon size={12} />
        </button>
      </div>
    </div>
  );
}

export default function TimelineSlotPicker({
  slots = [],
  onChange = () => {},
  color = "var(--primary)",
  disabled = false,
}: TimelineSlotPickerProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const [dragging, setDragging] = useState(false);
  const orderedSlots = normalizeSlots(slots);

  const getRailWidth = () => railRef.current?.getBoundingClientRect().width ?? 600;

  const xToMinutes = useCallback((clientX: number): number => {
    const rect = railRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    return Math.round((ratio * TOTAL_MINUTES) / STEP) * STEP;
  }, []);

  const handleRailMouseDown = (event: React.MouseEvent) => {
    if (disabled) return;
    if ((event.target as HTMLElement).closest("[data-slot-handle]")) return;
    event.preventDefault();
    const startMin = xToMinutes(event.clientX);
    const newSlot = findSlotInGap(orderedSlots, startMin, STEP);
    if (!newSlot) return;
    const nextSlots = normalizeSlots([...orderedSlots, newSlot]);
    const newIdx = nextSlots.findIndex((slot) => slot === newSlot);
    dragRef.current = {
      mode: "resizeRight",
      slotIdx: newIdx,
      startX: event.clientX,
      origStartMin: timeToMinutes(newSlot.start),
      origEndMin: timeToMinutes(newSlot.end),
      allSlots: nextSlots,
    };
    setDragging(true);
    onChange(normalizeSlots(nextSlots));
  };

  const handleSlotMouseDown = (event: React.MouseEvent, idx: number) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const slot = orderedSlots[idx];
    dragRef.current = {
      mode: "moveSlot",
      slotIdx: idx,
      startX: event.clientX,
      origStartMin: timeToMinutes(slot.start),
      origEndMin: timeToMinutes(slot.end),
      allSlots: orderedSlots,
    };
    setDragging(true);
  };

  const handleLeftHandleMouseDown = (event: React.MouseEvent, idx: number) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const slot = orderedSlots[idx];
    dragRef.current = {
      mode: "resizeLeft",
      slotIdx: idx,
      startX: event.clientX,
      origStartMin: timeToMinutes(slot.start),
      origEndMin: timeToMinutes(slot.end),
      allSlots: orderedSlots,
    };
    setDragging(true);
  };

  const handleRightHandleMouseDown = (event: React.MouseEvent, idx: number) => {
    if (disabled) return;
    event.preventDefault();
    event.stopPropagation();
    const slot = orderedSlots[idx];
    dragRef.current = {
      mode: "resizeRight",
      slotIdx: idx,
      startX: event.clientX,
      origStartMin: timeToMinutes(slot.start),
      origEndMin: timeToMinutes(slot.end),
      allSlots: orderedSlots,
    };
    setDragging(true);
  };

  useEffect(() => {
    const onMouseMove = (event: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag) return;

      const railWidth = getRailWidth();
      const pixelsPerMinute = railWidth / TOTAL_MINUTES;
      const deltaMin = Math.round(((event.clientX - drag.startX) / pixelsPerMinute) / STEP) * STEP;

      const updated = drag.allSlots.map((slot, index) => {
        if (index !== drag.slotIdx) return slot;
        const duration = drag.origEndMin - drag.origStartMin;
        const { minStart, maxEnd } = getSlotBounds(drag.allSlots, index);

        if (drag.mode === "moveSlot") {
          const newStart = clamp(drag.origStartMin + deltaMin, minStart, maxEnd - duration);
          return { ...slot, start: minutesToTime(newStart), end: minutesToTime(newStart + duration) };
        }
        if (drag.mode === "resizeLeft") {
          const newStart = clamp(drag.origStartMin + deltaMin, minStart, drag.origEndMin - STEP);
          return { ...slot, start: minutesToTime(newStart) };
        }
        const newEnd = clamp(drag.origEndMin + deltaMin, drag.origStartMin + STEP, maxEnd);
        return { ...slot, end: minutesToTime(newEnd) };
      });

      onChange(normalizeSlots(updated));
    };

    const onMouseUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      setDragging(false);
    };

    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
  }, [onChange]);

  const removeSlot = (idx: number) => {
    onChange(orderedSlots.filter((_, index) => index !== idx));
  };

  const updateSlot = (idx: number, updated: TimeSlot) => {
    if (!canPlaceSlot(orderedSlots, idx, updated)) return false;
    onChange(normalizeSlots(orderedSlots.map((slot, index) => (index === idx ? updated : slot))));
    return true;
  };

  const addDefaultSlot = () => {
    const last = orderedSlots[orderedSlots.length - 1];
    const preferredStart = last ? timeToMinutes(last.end) : 9 * 60;
    const newSlot = findDefaultSlot(orderedSlots, preferredStart, 60);
    if (!newSlot) return;
    onChange(normalizeSlots([...orderedSlots, newSlot]));
  };

  return (
    <div
      data-cmp="TimelineSlotPicker"
      className="flex flex-col gap-2"
      style={{ userSelect: dragging ? "none" : "auto" }}
    >
      <div className="relative" style={{ height: 44 }}>
        <div
          ref={railRef}
          onMouseDown={handleRailMouseDown}
          className="absolute inset-x-0"
          style={{
            top: 10,
            height: 24,
            borderRadius: 6,
            background: "var(--muted)",
            border: "1px solid var(--border)",
            cursor: disabled ? "default" : "crosshair",
          }}
        >
          {AXIS_HOURS.map((hour) => (
            <div
              key={hour}
              style={{
                position: "absolute",
                left: `${(hour / 24) * 100}%`,
                top: 0,
                bottom: 0,
                width: 1,
                background: "var(--border)",
                opacity: 0.6,
                pointerEvents: "none",
              }}
            />
          ))}

          {orderedSlots.map((slot, idx) => {
            const startMin = timeToMinutes(slot.start);
            const endMin = timeToMinutes(slot.end);
            const leftPct = (startMin / TOTAL_MINUTES) * 100;
            const widthPct = ((endMin - startMin) / TOTAL_MINUTES) * 100;
            const durationH = (endMin - startMin) / 60;
            const label = durationH >= 0.75 ? `${formatLabel(slot.start)} - ${formatLabel(slot.end)}` : "";

            return (
              <div
                key={`${slot.id ?? idx}-${slot.start}-${slot.end}`}
                data-slot-handle="bar"
                onMouseDown={(event) => handleSlotMouseDown(event, idx)}
                style={{
                  position: "absolute",
                  left: `${leftPct}%`,
                  width: `${widthPct}%`,
                  top: 0,
                  height: "100%",
                  borderRadius: 5,
                  background: color,
                  opacity: 0.88,
                  cursor: dragging ? "grabbing" : "grab",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  zIndex: 2,
                }}
              >
                <div
                  data-slot-handle="left"
                  onMouseDown={(event) => handleLeftHandleMouseDown(event, idx)}
                  style={{
                    position: "absolute",
                    left: 0,
                    top: 0,
                    bottom: 0,
                    width: 8,
                    cursor: "ew-resize",
                    background: "rgba(255,255,255,0.3)",
                    borderRadius: "5px 0 0 5px",
                    zIndex: 3,
                  }}
                />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--primary-foreground)",
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    padding: "0 10px",
                  }}
                >
                  {label}
                </span>
                <div
                  data-slot-handle="right"
                  onMouseDown={(event) => handleRightHandleMouseDown(event, idx)}
                  style={{
                    position: "absolute",
                    right: 0,
                    top: 0,
                    bottom: 0,
                    width: 8,
                    cursor: "ew-resize",
                    background: "rgba(255,255,255,0.3)",
                    borderRadius: "0 5px 5px 0",
                    zIndex: 3,
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>

      <div className="relative" style={{ height: 16, marginTop: -4 }}>
        {AXIS_HOURS.map((hour) => (
          <span
            key={hour}
            style={{
              position: "absolute",
              left: `${(hour / 24) * 100}%`,
              transform: hour === 0 ? "none" : hour === 24 ? "translateX(-100%)" : "translateX(-50%)",
              fontSize: 9,
              color: "var(--muted-foreground)",
              whiteSpace: "nowrap",
              fontWeight: 500,
            }}
          >
            {hour}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5" style={{ minHeight: 22 }}>
        {orderedSlots.map((slot, idx) => (
          <SlotTag
            key={`${slot.id ?? idx}-${slot.start}-${slot.end}`}
            slot={slot}
            idx={idx}
            color={color}
            onRemove={removeSlot}
            onUpdate={updateSlot}
            disabled={disabled}
          />
        ))}
        {!disabled && (
          <button
            type="button"
            onClick={addDefaultSlot}
            className="flex items-center gap-1 text-xs rounded-full px-2 py-0.5"
            style={{
              background: "transparent",
              border: "1px dashed var(--border)",
              color: "var(--primary)",
              cursor: "pointer",
            }}
          >
            <PlusCircleIcon size={11} />
            Add
          </button>
        )}
      </div>
    </div>
  );
}
