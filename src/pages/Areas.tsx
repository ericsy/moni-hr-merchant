import { useEffect, useMemo, useState } from "react";
import { Button, Input, InputNumber, Modal, Tag, Tooltip } from "antd";
import {
  ChevronRight,
  Globe,
  MapPin,
  Palette,
  Pencil,
  Plus,
  Search,
  Store,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useData, type Area } from "../context/DataContext";
import { useLocale } from "../context/LocaleContext";
import { useStore } from "../context/StoreContext";
import { ColorSwatchPicker, DEFAULT_COLOR_KEY, DEFAULT_COLOR_SWATCHES, getColorLabel, resolveColorValue } from "../components/ColorSwatchPicker";

const normalizeName = (value: string) => value.trim().toLowerCase();

const getAreaType = (area: Pick<Area, "areaType"> | { areaType?: "store" | "general" }) =>
  area.areaType || "store";

const getAreaScopeKey = (area: Pick<Area, "areaType" | "storeId"> | { areaType?: "store" | "general"; storeId: string }) =>
  getAreaType(area) === "general" ? "__general__" : area.storeId;

const getAreaColorMeta = (color: string) =>
  DEFAULT_COLOR_SWATCHES.find((option) => option.key === color) || {
    key: color,
    value: resolveColorValue(color),
    labelZh: color || "蓝色",
    labelEn: color || "Blue",
  };

export default function Areas() {
  const { locale } = useLocale();
  const { selectedStoreId } = useStore();
  const { areas, saveArea, deleteArea, stores, employees, rosterTemplates, scheduleShifts } = useData();

  const copy = locale === "zh"
    ? {
        title: "区域管理",
        subtitle: "统一维护基础区域数据，供员工、模版和班次引用",
        addArea: "添加区域",
        editArea: "编辑",
        addAreaDialog: "新增区域",
        editAreaDialog: "编辑区域",
        searchPlaceholder: "搜索区域名称或所属店面",
        noData: "暂无区域数据",
        noDataHint: "先创建区域，排班和模版才能引用它",
        detailEmpty: "请选择左侧区域查看详情",
        areaName: "区域名称",
        areaType: "区域类型",
        store: "所属店面",
        color: "颜色",
        currentStore: "当前店面",
        storeOnly: "门店专属",
        general: "通用区域",
        storeOnlyDesc: "只在选定门店内使用",
        generalDesc: "可供全部店面统一引用",
        generalStoreLabel: "通用区域",
        create: "创建",
        save: "保存",
        cancel: "取消",
        delete: "删除",
        deleteArea: "删除区域",
        areaSaved: "区域已保存",
        areaDeleted: "区域已删除",
        cannotDelete: "该区域已被员工、模版或班次引用，暂时不能删除",
        duplicateName: "同一范围下已存在同名区域",
        storeRequired: "请先选择店面",
        nameRequired: "请输入区域名称",
        order: "排序",
        allStores: "全部店面",
        count: (value: number) => `共 ${value} 条`,
        orderValue: (value: number) => `排序 ${value}`,
        selectedLabel: "已选区域",
        scopeValue: "适用范围",
      }
    : {
        title: "Area Management",
        subtitle: "Maintain base areas once and let employees, templates, and shifts reference them",
        addArea: "Add Area",
        editArea: "Edit",
        addAreaDialog: "Add Area",
        editAreaDialog: "Edit Area",
        searchPlaceholder: "Search area name or store",
        noData: "No areas yet",
        noDataHint: "Create areas first so schedules and templates can reference them",
        detailEmpty: "Select an area from the left to view details",
        areaName: "Area Name",
        areaType: "Area Type",
        store: "Store",
        color: "Color",
        currentStore: "Current Store",
        storeOnly: "Store Only",
        general: "General Area",
        storeOnlyDesc: "Used only in the selected store",
        generalDesc: "Can be reused across all stores",
        generalStoreLabel: "General Area",
        create: "Create",
        save: "Save",
        cancel: "Cancel",
        delete: "Delete",
        deleteArea: "Delete Area",
        areaSaved: "Area saved",
        areaDeleted: "Area deleted",
        cannotDelete: "This area is already referenced by employees, templates, or shifts",
        duplicateName: "An area with the same name already exists in this scope",
        storeRequired: "Please select a store",
        nameRequired: "Please enter an area name",
        order: "Order",
        allStores: "All Stores",
        count: (value: number) => `${value} total`,
        orderValue: (value: number) => `Order ${value}`,
        selectedLabel: "Selected Area",
        scopeValue: "Scope",
      };

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState("");
  const [form, setForm] = useState({
    name: "",
    storeId: selectedStoreId,
    areaType: "store" as "store" | "general",
    color: DEFAULT_COLOR_KEY,
    order: 0,
  });

  const referenceMap = useMemo(() => {
    const refs: Record<string, { employees: number; templates: number; shifts: number }> = {};

    areas.forEach((area) => {
      refs[area.id] = { employees: 0, templates: 0, shifts: 0 };
    });

    employees.forEach((employee) => {
      (employee.areaIds || []).forEach((areaId) => {
        if (refs[areaId]) refs[areaId].employees += 1;
      });
    });

    rosterTemplates.forEach((template) => {
      template.areaIds.forEach((areaId) => {
        if (refs[areaId]) refs[areaId].templates += 1;
      });
    });

    scheduleShifts.forEach((shift) => {
      if (refs[shift.areaId]) refs[shift.areaId].shifts += 1;
    });

    return refs;
  }, [areas, employees, rosterTemplates, scheduleShifts]);

  const filteredAreas = useMemo(() => {
    const keyword = search.trim().toLowerCase();

    return areas
      .filter((area) => !selectedStoreId || getAreaType(area) === "general" || area.storeId === selectedStoreId)
      .filter((area) => {
        if (!keyword) return true;
        const storeName = getAreaType(area) === "general"
          ? copy.generalStoreLabel
          : stores.find((store) => store.id === area.storeId)?.name || "";
        return normalizeName(area.name).includes(keyword) || storeName.toLowerCase().includes(keyword);
      })
      .sort((a, b) => {
        const scopeA = getAreaScopeKey(a);
        const scopeB = getAreaScopeKey(b);
        if (scopeA !== scopeB) {
          if (scopeA === "__general__") return -1;
          if (scopeB === "__general__") return 1;
          return scopeA.localeCompare(scopeB);
        }
        if (a.order !== b.order) return a.order - b.order;
        return a.name.localeCompare(b.name);
      });
  }, [areas, copy.generalStoreLabel, search, selectedStoreId, stores]);

  useEffect(() => {
    if (filteredAreas.length === 0) {
      if (selectedAreaId) setSelectedAreaId("");
      return;
    }
    if (!filteredAreas.some((area) => area.id === selectedAreaId)) {
      setSelectedAreaId(filteredAreas[0].id);
    }
  }, [filteredAreas, selectedAreaId]);

  const selectedArea = filteredAreas.find((area) => area.id === selectedAreaId) || null;

  const selectedStoreLabel = stores.find((store) => store.id === selectedStoreId)?.name || copy.allStores;

  const getStoreName = (area: Area) =>
    getAreaType(area) === "general"
      ? copy.generalStoreLabel
      : stores.find((store) => store.id === area.storeId)?.name || area.storeId;

  const getNextOrder = (areaType: "store" | "general", storeId: string, editingId?: string) => {
    const scopeKey = areaType === "general" ? "__general__" : storeId;
    return areas
      .filter((area) => area.id !== editingId && getAreaScopeKey(area) === scopeKey)
      .reduce((max, area) => Math.max(max, area.order), -1) + 1;
  };

  const openCreateModal = () => {
    const areaType = "store";
    setEditingArea(null);
    setForm({
      name: "",
      storeId: selectedStoreId,
      areaType,
      color: DEFAULT_COLOR_KEY,
      order: getNextOrder(areaType, selectedStoreId),
    });
    setModalOpen(true);
  };

  const openEditModal = (area: Area) => {
    setEditingArea(area);
    setForm({
      name: area.name,
      storeId: area.storeId,
      areaType: getAreaType(area),
      color: area.color,
      order: area.order,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingArea(null);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const normalizedAreaType = form.areaType;
    const storeIdToSave = normalizedAreaType === "general" ? "" : form.storeId;
    const nextScopeKey = normalizedAreaType === "general" ? "__general__" : storeIdToSave;

    if (!name) {
      toast.error(copy.nameRequired);
      return;
    }

    if (normalizedAreaType === "store" && !storeIdToSave) {
      toast.error(copy.storeRequired);
      return;
    }

    const duplicatedArea = areas.find((area) =>
      area.id !== editingArea?.id &&
      getAreaScopeKey(area) === nextScopeKey &&
      normalizeName(area.name) === normalizeName(name)
    );
    if (duplicatedArea) {
      toast.error(copy.duplicateName);
      return;
    }

    const fallbackOrder = getNextOrder(normalizedAreaType, storeIdToSave, editingArea?.id);
    const nextOrder = Number.isFinite(form.order) ? form.order : fallbackOrder;

    const areaToSave: Area = {
      ...(editingArea || { id: `area-${Date.now()}` }),
      name,
      storeId: storeIdToSave,
      areaType: normalizedAreaType,
      color: form.color,
      order: Math.max(0, nextOrder),
    };

    try {
      const saved = await saveArea(areaToSave, editingArea?.id);
      setSelectedAreaId(saved.id);
      closeModal();
      toast.success(copy.areaSaved);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Area save failed");
    }
  };

  const handleDelete = async (area: Area) => {
    const refs = referenceMap[area.id] || { employees: 0, templates: 0, shifts: 0 };
    if (refs.employees > 0 || refs.templates > 0 || refs.shifts > 0) {
      toast.error(copy.cannotDelete);
      return;
    }

    try {
      await deleteArea(area.id);
      toast.success(copy.areaDeleted);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Area delete failed");
    }
  };

  return (
    <div data-cmp="Areas" className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4 px-1">
        <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
          {copy.count(filteredAreas.length)}
        </div>
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreateModal}>
          {copy.addArea}
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
          <div className="border-b p-4" style={{ borderColor: "var(--border)" }}>
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={copy.searchPlaceholder}
              prefix={<Search size={14} style={{ color: "var(--muted-foreground)" }} />}
              allowClear
            />
          </div>

          {filteredAreas.length === 0 ? (
            <div className="flex h-[420px] flex-col items-center justify-center gap-2 px-6 text-center">
              <Store size={28} style={{ color: "var(--muted-foreground)", opacity: 0.45 }} />
              <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                {copy.noData}
              </div>
              <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
                {copy.noDataHint}
              </div>
            </div>
          ) : (
            <div className="max-h-[620px] overflow-auto">
              {filteredAreas.map((area) => {
                const areaColor = getAreaColorMeta(area.color);
                const active = area.id === selectedArea?.id;

                return (
                  <button
                    key={area.id}
                    type="button"
                    onClick={() => setSelectedAreaId(area.id)}
                    className="flex w-full items-center gap-3 border-b px-4 py-3 text-left transition-all"
                    style={{
                      borderColor: "var(--border)",
                      background: active ? "rgba(59, 130, 246, 0.08)" : "transparent",
                      boxShadow: active ? "inset 3px 0 0 var(--primary)" : "none",
                    }}
                  >
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-2xl flex-shrink-0"
                      style={{ background: areaColor.value, color: "white" }}
                    >
                      <MapPin size={16} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-base font-semibold" style={{ color: "var(--foreground)" }}>
                        {area.name}
                      </div>
                      <div className="truncate text-sm" style={{ color: "var(--muted-foreground)" }}>
                        {getStoreName(area)}
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
          {selectedArea ? (
            <>
              <div className="flex items-start justify-between gap-4 border-b p-6" style={{ borderColor: "var(--border)" }}>
                <div className="flex items-start gap-4 min-w-0">
                  <div
                    className="flex h-12 w-12 items-center justify-center rounded-2xl flex-shrink-0"
                    style={{ background: getAreaColorMeta(selectedArea.color).value, color: "white" }}
                  >
                    <MapPin size={18} />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-2xl font-bold" style={{ color: "var(--foreground)" }}>
                      {selectedArea.name}
                    </div>
                    <div className="mt-1 text-base" style={{ color: "var(--muted-foreground)" }}>
                      {`${getStoreName(selectedArea)} · ${copy.orderValue(selectedArea.order)}`}
                    </div>
                    <div className="mt-3 flex items-center gap-2 flex-wrap">
                      <Tag style={{ margin: 0, border: "none", background: "var(--secondary)", color: "var(--foreground)" }}>
                        {getAreaType(selectedArea) === "general" ? copy.general : copy.storeOnly}
                      </Tag>
                      <Tag style={{ margin: 0, border: "none", background: "var(--muted)", color: "var(--muted-foreground)" }}>
                        <Palette size={11} style={{ display: "inline", marginRight: 4 }} />
                        {getColorLabel(selectedArea.color, locale)}
                      </Tag>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button icon={<Pencil size={14} />} onClick={() => openEditModal(selectedArea)}>
                    {copy.editArea}
                  </Button>
                  <Tooltip title={(() => {
                    const refs = referenceMap[selectedArea.id] || { employees: 0, templates: 0, shifts: 0 };
                    return refs.employees > 0 || refs.templates > 0 || refs.shifts > 0 ? copy.cannotDelete : copy.deleteArea;
                  })()}>
                    <Button
                      danger
                      icon={<Trash2 size={14} />}
                      onClick={() => handleDelete(selectedArea)}
                    >
                      {copy.delete}
                    </Button>
                  </Tooltip>
                </div>
              </div>

              <div className="p-2">
                {[
                  {
                    label: copy.store,
                    value: getStoreName(selectedArea),
                  },
                  {
                    label: copy.color,
                    value: (
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block h-3 w-3 rounded-full"
                          style={{ background: getAreaColorMeta(selectedArea.color).value }}
                        />
                        <span>
                          {getColorLabel(selectedArea.color, locale)}
                        </span>
                      </div>
                    ),
                  },
                  {
                    label: copy.order,
                    value: selectedArea.order,
                  },
                  {
                    label: copy.scopeValue,
                    value: getAreaType(selectedArea) === "general" ? copy.general : copy.storeOnly,
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
              <MapPin size={30} style={{ color: "var(--muted-foreground)", opacity: 0.45 }} />
              <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
                {copy.detailEmpty}
              </div>
            </div>
          )}
        </div>
      </div>

      <Modal
        title={editingArea ? copy.editAreaDialog : copy.addAreaDialog}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        okText={editingArea ? copy.save : copy.create}
        cancelText={copy.cancel}
        destroyOnHidden
      >
        <div className="flex flex-col gap-4 pt-3">
          <div>
            <div className="mb-1.5 text-sm" style={{ color: "var(--foreground)" }}>
              {copy.areaName}
            </div>
            <Input
              value={form.name}
              onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
              onPressEnter={handleSave}
              autoFocus
            />
          </div>

          <div>
            <div className="mb-1.5 text-sm" style={{ color: "var(--foreground)" }}>
              {copy.areaType}
            </div>
            <div
              className="grid grid-cols-2 gap-2 rounded-2xl p-2"
              style={{ background: "var(--muted)", border: "1px solid var(--border)" }}
            >
              {[
                { key: "store" as const, label: copy.storeOnly, desc: copy.storeOnlyDesc },
                { key: "general" as const, label: copy.general, desc: copy.generalDesc },
              ].map((option) => {
                const active = form.areaType === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setForm((prev) => ({
                      ...prev,
                      areaType: option.key,
                      storeId: option.key === "general"
                        ? ""
                        : selectedStoreId || prev.storeId,
                      order: editingArea
                        ? prev.order
                        : getNextOrder(option.key, option.key === "general" ? "" : selectedStoreId || prev.storeId),
                    }))}
                    className="rounded-2xl px-4 py-3 text-left transition-all"
                    style={{
                      border: active ? "1px solid var(--primary)" : "1px solid transparent",
                      background: active ? "rgba(59, 130, 246, 0.10)" : "transparent",
                    }}
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

          {form.areaType === "store" && (
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
                <div>{stores.find((store) => store.id === selectedStoreId)?.name || selectedStoreId}</div>
              </div>
            </div>
          )}

          <div>
            <div className="mb-1.5 text-sm" style={{ color: "var(--foreground)" }}>
              {copy.order}
            </div>
            <InputNumber
              min={0}
              step={1}
              precision={0}
              value={form.order}
              onChange={(value) => setForm((prev) => ({ ...prev, order: value ?? 0 }))}
              style={{ width: "100%" }}
            />
          </div>

          <div>
            <div className="mb-1.5 text-sm" style={{ color: "var(--foreground)" }}>
              {copy.color}
            </div>
            <ColorSwatchPicker value={form.color} onChange={(color) => setForm((prev) => ({ ...prev, color }))} locale={locale} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
