import { useEffect, useMemo, useState } from "react";
import { Button, InputNumber, Modal, Select, Tag } from "antd";
import {
  ChevronRight,
  Clock,
  Pencil,
  Plus,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useData, type ScheduleShift } from "../context/DataContext";
import { useLocale } from "../context/LocaleContext";
import { useStore } from "../context/StoreContext";
import { getClockRange, toMinutes } from "../lib/shift";
import { ColorSwatchPicker, DEFAULT_COLOR_KEY, DEFAULT_COLOR_SWATCHES, getColorLabel, resolveColorValue } from "../components/ColorSwatchPicker";

const { Option } = Select;

const getShiftColorMeta = (color: string) =>
  DEFAULT_COLOR_SWATCHES.find((item) => item.key === color) || {
    key: color,
    value: resolveColorValue(color),
    labelZh: color || "蓝色",
    labelEn: color || "Blue",
  };

const formatShiftDurationText = (startTime: string, endTime: string, breakMinutes: number) => {
  const { startMinutes, endMinutes } = getClockRange({ startTime, endTime });
  const totalMinutes = Math.max(0, endMinutes - startMinutes - breakMinutes);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
};

interface ScheduleFormState {
  shiftName: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  color: string;
  shiftType: "store" | "general";
  storeId: string;
}

const buildDefaultForm = (selectedStoreId: string, fallbackStoreId = ""): ScheduleFormState => ({
  shiftName: "",
  startTime: "09:00",
  endTime: "17:00",
  breakMinutes: 30,
  color: DEFAULT_COLOR_KEY,
  shiftType: selectedStoreId ? "store" : "general",
  storeId: selectedStoreId || fallbackStoreId,
});

export default function Schedule() {
  const { locale } = useLocale();
  const { stores, scheduleShifts, saveGlobalShift, deleteGlobalShift } = useData();
  const { selectedStoreId } = useStore();

  const copy = locale === "zh"
    ? {
        addShift: "添加班次",
        editShift: "编辑",
        addShiftDialog: "添加班次",
        editShiftDialog: "编辑班次",
        noData: "暂无班次数据",
        noDataHint: "先创建班次定义，供后续排班引用",
        detailEmpty: "请选择左侧班次查看详情",
        titleCount: (value: number) => `共 ${value} 条`,
        nameRequired: "请输入班次名称",
        timeRequired: "请填写开始和结束时间",
        timeOrderInvalid: "结束时间必须大于开始时间",
        storeRequired: "请选择所属店面",
        saved: "班次已保存",
        deleted: "班次已删除",
        allStores: "所有店面通用",
        storeOnly: "门店专属",
        general: "通用班次",
        shiftName: "班次名称",
        startTime: "开始时间",
        endTime: "结束时间",
        breakMinutes: "休息时长（分钟）",
        duration: "工时",
        color: "颜色",
        store: "所属店面",
        shiftType: "班次类型",
        colorTag: "颜色标识",
        save: "保存",
        cancel: "取消",
        delete: "删除",
        currentStore: "当前店面",
        generalDesc: "可供全部店面统一使用",
        storeOnlyDesc: "只在选定门店内使用",
      }
    : {
        addShift: "Add Shift",
        editShift: "Edit",
        addShiftDialog: "Add Shift",
        editShiftDialog: "Edit Shift",
        noData: "No shifts yet",
        noDataHint: "Create shift definitions first so rosters can reference them",
        detailEmpty: "Select a shift from the left to view details",
        titleCount: (value: number) => `${value} total`,
        nameRequired: "Please enter a shift name",
        timeRequired: "Please fill in start and end time",
        timeOrderInvalid: "End time must be later than start time",
        storeRequired: "Please select a store",
        saved: "Shift saved",
        deleted: "Shift deleted",
        allStores: "Available to all stores",
        storeOnly: "Store Only",
        general: "General Shift",
        shiftName: "Shift Name",
        startTime: "Start Time",
        endTime: "End Time",
        breakMinutes: "Break Minutes",
        duration: "Duration",
        color: "Color",
        store: "Store",
        shiftType: "Shift Type",
        colorTag: "Color Label",
        save: "Save",
        cancel: "Cancel",
        delete: "Delete",
        currentStore: "Current Store",
        generalDesc: "Reusable across all stores",
        storeOnlyDesc: "Used only in the selected store",
      };

  const selectableStores = stores;
  const [modalOpen, setModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<ScheduleShift | null>(null);
  const [selectedShiftId, setSelectedShiftId] = useState("");
  const [savingShift, setSavingShift] = useState(false);
  const [form, setForm] = useState<ScheduleFormState>(() => buildDefaultForm(selectedStoreId));

  const getStoreLabel = (shift: Pick<ScheduleShift, "shiftType" | "storeId">) => {
    if ((shift.shiftType || "store") === "general") return copy.allStores;
    return stores.find((store) => store.id === shift.storeId)?.name || shift.storeId || copy.allStores;
  };

  const globalShifts = useMemo(
    () => scheduleShifts.filter((shift) => shift.isGlobalPreset),
    [scheduleShifts]
  );

  const filteredShifts = useMemo(() => {
    return globalShifts
      .filter((shift) => !selectedStoreId || (shift.shiftType || "store") === "general" || shift.storeId === selectedStoreId)
      .sort((a, b) => {
        if (a.startTime !== b.startTime) return a.startTime.localeCompare(b.startTime);
        if (a.endTime !== b.endTime) return a.endTime.localeCompare(b.endTime);
        return (a.shiftName || "").localeCompare(b.shiftName || "");
      });
  }, [globalShifts, selectedStoreId]);

  useEffect(() => {
    if (filteredShifts.length === 0) {
      if (selectedShiftId) setSelectedShiftId("");
      return;
    }
    if (!filteredShifts.some((shift) => shift.id === selectedShiftId)) {
      setSelectedShiftId(filteredShifts[0].id);
    }
  }, [filteredShifts, selectedShiftId]);

  const selectedShift = filteredShifts.find((shift) => shift.id === selectedShiftId) || null;

  const openCreateModal = () => {
    setEditingShift(null);
    setForm(buildDefaultForm(selectedStoreId, selectableStores[0]?.id || ""));
    setModalOpen(true);
  };

  const openEditModal = (shift: ScheduleShift) => {
    setEditingShift(shift);
    setForm({
      shiftName: shift.shiftName || "",
      startTime: shift.startTime || "09:00",
      endTime: shift.endTime || "17:00",
      breakMinutes: shift.breakMinutes ?? 30,
      color: shift.color || DEFAULT_COLOR_KEY,
      shiftType: shift.shiftType || ((shift.storeId || "") ? "store" : "general"),
      storeId: shift.storeId || selectedStoreId,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingShift(null);
  };

  const handleSaveShift = async () => {
    if (savingShift) return;

    if (!form.shiftName.trim()) {
      toast.error(copy.nameRequired);
      return;
    }

    if (!form.startTime || !form.endTime) {
      toast.error(copy.timeRequired);
      return;
    }

    if (toMinutes(form.endTime) <= toMinutes(form.startTime)) {
      toast.error(copy.timeOrderInvalid);
      return;
    }

    if (form.shiftType === "store" && !form.storeId) {
      toast.error(copy.storeRequired);
      return;
    }

    const shiftData: ScheduleShift = {
      id: editingShift?.id || `sh${Date.now()}`,
      shiftId: editingShift?.shiftId,
      isGlobalPreset: true,
      employeeId: "",
      employeeIds: [],
      areaId: "",
      storeId: form.shiftType === "general" ? "" : form.storeId,
      shiftType: form.shiftType,
      date: "",
      startTime: form.startTime,
      endTime: form.endTime,
      breakMinutes: Number(form.breakMinutes) || 0,
      shiftName: form.shiftName.trim(),
      color: form.color,
      note: editingShift?.note || "",
      status: "published",
    };

    try {
      setSavingShift(true);
      const saved = await saveGlobalShift(shiftData, editingShift?.shiftId);
      setSelectedShiftId(saved.id);
      closeModal();
      toast.success(copy.saved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Save failed");
    } finally {
      setSavingShift(false);
    }
  };

  const handleDeleteShift = async (shift: ScheduleShift) => {
    try {
      await deleteGlobalShift(shift.shiftId || shift.id);
      toast.success(copy.deleted);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Delete failed");
    }
  };

  return (
    <div data-cmp="Schedule" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 px-1">
        <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          {copy.titleCount(filteredShifts.length)}
        </div>
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreateModal}>
          {copy.addShift}
        </Button>
      </div>

      <div className="grid min-w-[960px] grid-cols-[320px_minmax(0,1fr)] gap-4">
        <div
          className="overflow-hidden rounded-2xl"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow)",
            minHeight: 560,
          }}
        >
          {filteredShifts.length === 0 ? (
            <div className="flex h-[560px] flex-col items-center justify-center gap-2 px-6 text-center">
              <Clock size={28} style={{ color: "var(--muted-foreground)", opacity: 0.45 }} />
              <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                {copy.noData}
              </div>
              <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {copy.noDataHint}
              </div>
            </div>
          ) : (
            <div className="max-h-[620px] overflow-auto">
              {filteredShifts.map((shift) => {
                const active = shift.id === selectedShift?.id;
                const colorMeta = getShiftColorMeta(shift.color);

                return (
                  <button
                    key={shift.id}
                    type="button"
                    onClick={() => setSelectedShiftId(shift.id)}
                    className="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-all"
                    style={{
                      borderColor: "var(--border)",
                      background: active ? "rgba(59, 130, 246, 0.08)" : "transparent",
                      boxShadow: active ? "inset 3px 0 0 var(--primary)" : "none",
                    }}
                  >
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-2xl flex-shrink-0"
                      style={{ background: colorMeta.value, color: "white" }}
                    >
                      <Clock size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold" style={{ color: "var(--foreground)" }}>
                        {shift.shiftName || (locale === "zh" ? "未命名班次" : "Untitled Shift")}
                      </div>
                      <div className="truncate text-sm" style={{ color: "var(--muted-foreground)" }}>
                        {shift.startTime} – {shift.endTime}
                      </div>
                      <div className="truncate text-sm" style={{ color: "var(--muted-foreground)" }}>
                        {getStoreLabel(shift)}
                      </div>
                    </div>
                    <ChevronRight size={16} style={{ color: "var(--muted-foreground)" }} />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div
          className="overflow-hidden rounded-2xl"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow)",
            minHeight: 560,
          }}
        >
          {selectedShift ? (
            <>
              <div className="flex items-start justify-between gap-4 border-b p-6" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-start gap-4 min-w-0">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl flex-shrink-0"
                    style={{ background: getShiftColorMeta(selectedShift.color).value, color: "white" }}
                  >
                    <Clock size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                      {selectedShift.shiftName || (locale === "zh" ? "未命名班次" : "Untitled Shift")}
                    </div>
                    <div className="mt-1 text-base" style={{ color: "var(--muted-foreground)" }}>
                      {selectedShift.startTime} – {selectedShift.endTime}
                    </div>
                    <div className="mt-3">
                      <Tag style={{ margin: 0, border: "none", background: "rgba(59, 130, 246, 0.12)", color: "var(--primary)" }}>
                        {getColorLabel(selectedShift.color, locale)}
                      </Tag>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button icon={<Pencil size={14} />} onClick={() => openEditModal(selectedShift)}>
                    {copy.editShift}
                  </Button>
                  <Button danger icon={<Trash2 size={14} />} onClick={() => handleDeleteShift(selectedShift)}>
                    {copy.delete}
                  </Button>
                </div>
              </div>

              <div className="p-2">
                {[
                  { label: copy.store, value: getStoreLabel(selectedShift) },
                  { label: copy.startTime, value: selectedShift.startTime },
                  { label: copy.endTime, value: selectedShift.endTime },
                  { label: copy.breakMinutes, value: `${selectedShift.breakMinutes || 0} min` },
                  { label: copy.duration, value: formatShiftDurationText(selectedShift.startTime, selectedShift.endTime, selectedShift.breakMinutes || 0) },
                  {
                    label: copy.color,
                    value: (
                      <div className="flex items-center gap-2">
                        <span className="inline-block h-3 w-3 rounded-full" style={{ background: getShiftColorMeta(selectedShift.color).value }} />
                        <span>{getColorLabel(selectedShift.color, locale)}</span>
                      </div>
                    ),
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="grid items-center gap-4 px-4 py-4 md:grid-cols-[120px_minmax(0,1fr)]"
                    style={{ borderBottom: "1px solid var(--border)" }}
                  >
                    <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
                      {item.label}
                    </div>
                    <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="flex h-[560px] flex-col items-center justify-center gap-2 px-6 text-center">
              <Clock size={30} style={{ color: "var(--muted-foreground)", opacity: 0.45 }} />
              <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                {copy.detailEmpty}
              </div>
            </div>
          )}
        </div>
      </div>

      <ShiftModal
        open={modalOpen}
        isEdit={!!editingShift}
        form={form}
        setForm={setForm}
        stores={selectableStores.map((store) => ({ id: store.id, name: store.name }))}
        currentStoreId={selectedStoreId}
        onClose={closeModal}
        onSave={handleSaveShift}
        saving={savingShift}
        locale={locale}
        copy={copy}
      />
    </div>
  );
}

interface ShiftModalProps {
  open: boolean;
  isEdit: boolean;
  form: ScheduleFormState;
  setForm: React.Dispatch<React.SetStateAction<ScheduleFormState>>;
  stores: Array<{ id: string; name: string }>;
  currentStoreId: string;
  onClose: () => void;
  onSave: () => void;
  saving: boolean;
  locale: string;
  copy: {
    addShiftDialog: string;
    editShiftDialog: string;
    shiftName: string;
    startTime: string;
    endTime: string;
    timeOrderInvalid: string;
    breakMinutes: string;
    store: string;
    shiftType: string;
    colorTag: string;
    duration: string;
    save: string;
    cancel: string;
    currentStore: string;
    general: string;
    storeOnly: string;
    generalDesc: string;
    storeOnlyDesc: string;
  };
}

function ShiftModal({
  open,
  isEdit,
  form,
  setForm,
  stores,
  currentStoreId,
  onClose,
  onSave,
  saving,
  locale,
  copy,
}: ShiftModalProps) {
  const durationText = formatShiftDurationText(form.startTime, form.endTime, Number(form.breakMinutes) || 0);
  const isTimeOrderInvalid =
    !!form.startTime &&
    !!form.endTime &&
    toMinutes(form.endTime) <= toMinutes(form.startTime);

  return (
    <Modal
      title={isEdit ? copy.editShiftDialog : copy.addShiftDialog}
      open={open}
      onCancel={onClose}
      onOk={onSave}
      confirmLoading={saving}
      maskClosable={false}
      okText={copy.save}
      cancelText={copy.cancel}
      destroyOnHidden
      width={560}
    >
      <div className="flex flex-col gap-5 pt-4">
        <div>
          <div className="mb-1.5 text-sm" style={{ color: "var(--foreground)" }}>
            {copy.shiftName}
          </div>
          <input
            type="text"
            value={form.shiftName}
            onChange={(event) => setForm((prev) => ({ ...prev, shiftName: event.target.value }))}
            placeholder={locale === "zh" ? "例如：早班、晚班" : "e.g. Morning, Evening"}
            className="rounded-xl px-4 text-sm outline-none"
            style={{
              height: 44,
              border: "1px solid var(--border)",
              background: "var(--card)",
              color: "var(--foreground)",
              width: "100%",
            }}
          />
        </div>

        <div>
          <div className="mb-1.5 text-sm" style={{ color: "var(--foreground)" }}>
            {copy.shiftType}
          </div>
          <div
            className="grid grid-cols-2 gap-2 rounded-2xl p-2"
            style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
          >
            {[
              { key: "store" as const, label: copy.storeOnly, desc: copy.storeOnlyDesc },
              { key: "general" as const, label: copy.general, desc: copy.generalDesc },
            ].map((option) => {
              const active = form.shiftType === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  className="rounded-2xl px-4 py-3 text-left transition-all"
                  style={{
                    border: active ? "1px solid var(--primary)" : "1px solid transparent",
                    background: active ? "rgba(59, 130, 246, 0.10)" : "transparent",
                  }}
                  onClick={() => setForm((prev) => ({
                    ...prev,
                    shiftType: option.key,
                    storeId: option.key === "general"
                      ? ""
                      : currentStoreId || prev.storeId || stores[0]?.id || "",
                  }))}
                >
                  <div className="text-sm font-semibold" style={{ color: active ? "var(--primary)" : "var(--foreground)" }}>
                    {option.label}
                  </div>
                  <div className="mt-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
                    {option.desc}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {form.shiftType === "store" && (
          <div>
            <div className="mb-1.5 text-sm" style={{ color: "var(--foreground)" }}>
              {copy.store}
            </div>
            <div
              className="rounded-xl px-3 py-2.5 text-sm"
              style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}
            >
              <div className="mb-1 text-xs" style={{ color: "var(--muted-foreground)" }}>
                {copy.currentStore}
              </div>
              <div>{stores.find((store) => store.id === currentStoreId)?.name || currentStoreId}</div>
            </div>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="mb-1.5 text-sm" style={{ color: "var(--foreground)" }}>
              {copy.startTime}
            </div>
            <input
              type="time"
              value={form.startTime}
              onChange={(event) => setForm((prev) => ({ ...prev, startTime: event.target.value }))}
              className="w-full rounded-xl px-4 text-sm outline-none"
              style={{
                height: 44,
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "var(--foreground)",
              }}
            />
          </div>
          <div>
            <div className="mb-1.5 text-sm" style={{ color: "var(--foreground)" }}>
              {copy.endTime}
            </div>
            <input
              type="time"
              value={form.endTime}
              onChange={(event) => setForm((prev) => ({ ...prev, endTime: event.target.value }))}
              className="w-full rounded-xl px-4 text-sm outline-none"
              style={{
                height: 44,
                border: "1px solid var(--border)",
                background: "var(--card)",
                color: "var(--foreground)",
              }}
            />
          </div>
        </div>
        {isTimeOrderInvalid && (
          <div className="-mt-3 text-xs" style={{ color: "var(--destructive)" }}>
            {copy.timeOrderInvalid}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_160px]">
          <div>
            <div className="mb-1.5 text-sm" style={{ color: "var(--foreground)" }}>
              {copy.breakMinutes}
            </div>
            <InputNumber
              min={0}
              step={5}
              value={form.breakMinutes}
              onChange={(value) => setForm((prev) => ({ ...prev, breakMinutes: Number(value) || 0 }))}
              style={{ width: "100%" }}
            />
          </div>
          <div>
            <div className="mb-1.5 text-sm" style={{ color: "var(--foreground)" }}>
              {copy.duration}
            </div>
            <div
              className="flex h-[44px] items-center rounded-xl px-4 text-sm font-semibold"
              style={{ background: "var(--secondary)", border: "1px solid var(--border)", color: "var(--primary)" }}
            >
              {durationText}
            </div>
          </div>
        </div>

        <div>
          <div className="mb-1.5 text-sm" style={{ color: "var(--foreground)" }}>
            {copy.colorTag}
          </div>
          <ColorSwatchPicker value={form.color} onChange={(color) => setForm((prev) => ({ ...prev, color }))} locale={locale} size={28} />
        </div>
      </div>
    </Modal>
  );
}
