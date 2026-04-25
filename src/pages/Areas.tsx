import { useMemo, useState } from "react";
import { Button, Input, Modal, Select, Tag, Tooltip } from "antd";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Globe,
  Store,
  Users,
  CalendarDays,
  Clock,
  Palette,
} from "lucide-react";
import { toast } from "sonner";
import { useData, type Area } from "../context/DataContext";
import { useLocale } from "../context/LocaleContext";
import { useStore } from "../context/StoreContext";

const { Option } = Select;

const AREA_COLOR_OPTIONS = [
  { key: "blue", value: "var(--primary)" },
  { key: "green", value: "var(--chart-2)" },
  { key: "purple", value: "var(--chart-5)" },
  { key: "orange", value: "var(--chart-3)" },
  { key: "red", value: "var(--destructive)" },
];

const normalizeName = (value: string) => value.trim().toLowerCase();

const resolveAreaColor = (color: string) =>
  AREA_COLOR_OPTIONS.find((option) => option.key === color)?.value || color || "var(--primary)";

const getAreaType = (area: Pick<Area, "areaType"> | { areaType?: "store" | "general" }) =>
  area.areaType || "store";

const getAreaScopeKey = (area: Pick<Area, "areaType" | "storeId"> | { areaType?: "store" | "general"; storeId: string }) =>
  getAreaType(area) === "general" ? "__general__" : area.storeId;

const resequenceAreaScope = (areas: Area[], scopeKey: string) => {
  const scopedAreas = areas
    .filter((area) => getAreaScopeKey(area) === scopeKey)
    .sort((a, b) => a.order - b.order)
    .map((area, index) => ({ ...area, order: index }));

  return [
    ...areas.filter((area) => getAreaScopeKey(area) !== scopeKey),
    ...scopedAreas,
  ];
};

export default function Areas() {
  const { locale } = useLocale();
  const { selectedStoreId } = useStore();
  const { areas, saveArea, deleteArea, stores, employees, rosterTemplates, scheduleShifts } = useData();

  const copy = locale === "zh"
    ? {
        title: "区域管理",
        subtitle: "统一维护基础区域数据，供员工、模版和班次引用",
        addArea: "新增区域",
        editArea: "编辑区域",
        searchPlaceholder: "搜索区域名称或店面...",
        noData: "暂无区域数据",
        noDataHint: "先创建基础区域，再让排班模版和班次引用它",
        areaName: "区域名称",
        areaType: "区域类型",
        store: "所属店面",
        color: "区域颜色",
        currentStore: "当前店面",
        storeOnly: "门店专属",
        general: "通用",
        storeOnlyDesc: "只在选定门店中使用",
        generalDesc: "可作为全局通用区域",
        generalStoreLabel: "通用区域",
        create: "创建",
        save: "保存",
        cancel: "取消",
        delete: "删除",
        cannotDelete: "该区域已被员工、模版或班次引用，暂时不能删除",
        duplicateName: "同一店面下已存在同名区域",
        storeRequired: "请先选择店面",
        nameRequired: "请输入区域名称",
        order: "排序",
        references: "引用情况",
        employeeRefs: "员工",
        templateRefs: "模版",
        shiftRefs: "班次",
        allStores: "全部店面",
      }
    : {
        title: "Area Management",
        subtitle: "Maintain base areas once and let employees, templates, and shifts reference them",
        addArea: "Add Area",
        editArea: "Edit Area",
        searchPlaceholder: "Search area or store...",
        noData: "No areas yet",
        noDataHint: "Create base areas first, then reference them from templates and shifts",
        areaName: "Area Name",
        areaType: "Area Type",
        store: "Store",
        color: "Area Color",
        currentStore: "Current Store",
        storeOnly: "Store Only",
        general: "General",
        storeOnlyDesc: "Used only in the selected store",
        generalDesc: "Can be used as a general area",
        generalStoreLabel: "General Area",
        create: "Create",
        save: "Save",
        cancel: "Cancel",
        delete: "Delete",
        cannotDelete: "This area is already referenced by employees, templates, or shifts",
        duplicateName: "An area with the same name already exists in this store",
        storeRequired: "Please select a store",
        nameRequired: "Please enter an area name",
        order: "Order",
        references: "References",
        employeeRefs: "Employees",
        templateRefs: "Templates",
        shiftRefs: "Shifts",
        allStores: "All Stores",
      };

  const enabledStores = stores.filter((store) => store.status === "enabled");

  const [search, setSearch] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [form, setForm] = useState({
    name: "",
    storeId: selectedStoreId !== "all" ? selectedStoreId : "",
    areaType: "store" as "store" | "general",
    color: "blue",
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
      .filter((area) => selectedStoreId === "all" || getAreaType(area) === "general" || area.storeId === selectedStoreId)
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
        return a.order - b.order;
      });
  }, [areas, search, selectedStoreId, stores, copy.generalStoreLabel]);

  const openCreateModal = () => {
    setEditingArea(null);
    setForm({
      name: "",
      storeId: selectedStoreId !== "all" ? selectedStoreId : "",
      areaType: "store",
      color: "blue",
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

    const nextOrder = editingArea && getAreaScopeKey(editingArea) === nextScopeKey
      ? editingArea.order
      : areas
        .filter((area) => getAreaScopeKey(area) === nextScopeKey)
        .reduce((max, area) => Math.max(max, area.order), -1) + 1;

    const areaToSave: Area = {
      ...(editingArea || { id: `area-${Date.now()}` }),
      name,
      storeId: storeIdToSave,
      areaType: normalizedAreaType,
      color: form.color,
      order: nextOrder,
    };

    try {
      await saveArea(areaToSave, editingArea?.id);
      closeModal();
      toast.success(locale === "zh" ? "区域已保存" : "Area saved");
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
      toast.success(locale === "zh" ? "区域已删除" : "Area deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Area delete failed");
    }
  };

  return (
    <div data-cmp="Areas" className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="text-xl font-bold" style={{ color: "var(--foreground)" }}>
            {copy.title}
          </div>
          <div className="text-sm" style={{ color: "var(--muted-foreground)" }}>
            {copy.subtitle}
          </div>
        </div>
        <Button type="primary" icon={<Plus size={14} />} onClick={openCreateModal}>
          {copy.addArea}
        </Button>
      </div>

      <div
        className="rounded-xl p-4 flex items-center gap-3"
        style={{ background: "var(--card)", border: "1px solid var(--border)" }}
      >
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={copy.searchPlaceholder}
          prefix={<Search size={14} style={{ color: "var(--muted-foreground)" }} />}
          allowClear
          style={{ maxWidth: 320 }}
        />
        <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
          {selectedStoreId === "all"
            ? copy.allStores
            : stores.find((store) => store.id === selectedStoreId)?.name || copy.allStores}
        </span>
      </div>

      {filteredAreas.length === 0 ? (
        <div
          className="rounded-xl flex flex-col items-center justify-center gap-2"
          style={{ minHeight: 260, background: "var(--card)", border: "1px solid var(--border)" }}
        >
          <Store size={28} style={{ color: "var(--muted-foreground)", opacity: 0.4 }} />
          <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
            {copy.noData}
          </div>
          <div className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {copy.noDataHint}
          </div>
        </div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))" }}>
          {filteredAreas.map((area) => {
            const refs = referenceMap[area.id] || { employees: 0, templates: 0, shifts: 0 };
            const areaType = getAreaType(area);
            const storeName = areaType === "general"
              ? copy.generalStoreLabel
              : stores.find((store) => store.id === area.storeId)?.name || area.storeId;
            const inUse = refs.employees > 0 || refs.templates > 0 || refs.shifts > 0;

            return (
              <div
                key={area.id}
                className="rounded-xl p-4 flex flex-col gap-4"
                style={{ background: "var(--card)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <div
                      className="rounded-full flex-shrink-0"
                      style={{ width: 14, height: 14, background: resolveAreaColor(area.color), marginTop: 4 }}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate" style={{ color: "var(--foreground)" }}>
                        {area.name}
                      </div>
                      <div className="text-xs flex items-center gap-1" style={{ color: "var(--muted-foreground)" }}>
                        {areaType === "general" ? <Globe size={11} /> : <Store size={11} />}
                        {storeName}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <Tooltip title={copy.editArea}>
                      <button
                        type="button"
                        onClick={() => openEditModal(area)}
                        className="rounded-lg flex items-center justify-center"
                        style={{ width: 30, height: 30, background: "var(--muted)", color: "var(--muted-foreground)" }}
                      >
                        <Pencil size={13} />
                      </button>
                    </Tooltip>
                    <Tooltip title={inUse ? copy.cannotDelete : copy.delete}>
                      <button
                        type="button"
                        onClick={() => handleDelete(area)}
                        className="rounded-lg flex items-center justify-center"
                        style={{
                          width: 30,
                          height: 30,
                          background: inUse ? "var(--muted)" : "rgba(239, 68, 68, 0.1)",
                          color: inUse ? "var(--muted-foreground)" : "var(--destructive)",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </Tooltip>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  <Tag style={{ margin: 0, border: "none", background: "var(--secondary)", color: "var(--foreground)" }}>
                    {areaType === "general" ? copy.general : copy.storeOnly}
                  </Tag>
                  <Tag style={{ margin: 0, border: "none", background: "var(--secondary)", color: "var(--primary)" }}>
                    {copy.order} #{area.order + 1}
                  </Tag>
                  <Tag style={{ margin: 0, border: "none", background: "var(--muted)", color: "var(--muted-foreground)" }}>
                    <Palette size={11} style={{ display: "inline", marginRight: 4 }} />
                    {area.color}
                  </Tag>
                </div>

                <div>
                  <div className="text-xs mb-2" style={{ color: "var(--muted-foreground)" }}>
                    {copy.references}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag style={{ margin: 0 }}>
                      <Users size={11} style={{ display: "inline", marginRight: 4 }} />
                      {copy.employeeRefs} {refs.employees}
                    </Tag>
                    <Tag style={{ margin: 0 }}>
                      <CalendarDays size={11} style={{ display: "inline", marginRight: 4 }} />
                      {copy.templateRefs} {refs.templates}
                    </Tag>
                    <Tag style={{ margin: 0 }}>
                      <Clock size={11} style={{ display: "inline", marginRight: 4 }} />
                      {copy.shiftRefs} {refs.shifts}
                    </Tag>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        title={editingArea ? copy.editArea : copy.addArea}
        open={modalOpen}
        onCancel={closeModal}
        onOk={handleSave}
        okText={editingArea ? copy.save : copy.create}
        cancelText={copy.cancel}
        destroyOnHidden
      >
        <div className="flex flex-col gap-4 pt-3">
          <div>
            <div className="text-sm mb-1.5" style={{ color: "var(--foreground)" }}>
              {copy.areaName}
            </div>
            <Input
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              onPressEnter={handleSave}
              autoFocus
            />
          </div>

          <div>
            <div className="text-sm mb-1.5" style={{ color: "var(--foreground)" }}>
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
                        : selectedStoreId !== "all"
                        ? selectedStoreId
                        : prev.storeId,
                    }))}
                    className="rounded-2xl px-4 py-3 text-left transition-all"
                    style={{
                      border: active ? "1px solid var(--primary)" : "1px solid transparent",
                      background: active ? "rgba(59, 130, 246, 0.10)" : "transparent",
                      cursor: "pointer",
                    }}
                  >
                    <div
                      className="text-sm font-semibold"
                      style={{ color: active ? "var(--primary)" : "var(--foreground)" }}
                    >
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
              <div className="text-sm mb-1.5" style={{ color: "var(--foreground)" }}>
                {copy.store}
              </div>
              {selectedStoreId === "all" ? (
                <Select
                  value={form.storeId || undefined}
                  onChange={(value) => setForm((prev) => ({ ...prev, storeId: value }))}
                  style={{ width: "100%" }}
                  placeholder={copy.store}
                >
                  {enabledStores.map((store) => (
                    <Option key={store.id} value={store.id}>
                      {store.name}
                    </Option>
                  ))}
                </Select>
              ) : (
                <div
                  className="rounded-xl px-3 py-2.5 text-sm"
                  style={{ background: "var(--muted)", border: "1px solid var(--border)", color: "var(--foreground)" }}
                >
                  <div className="text-xs mb-1" style={{ color: "var(--muted-foreground)" }}>
                    {copy.currentStore}
                  </div>
                  <div>{stores.find((store) => store.id === selectedStoreId)?.name || selectedStoreId}</div>
                </div>
              )}
            </div>
          )}

          <div>
            <div className="text-sm mb-1.5" style={{ color: "var(--foreground)" }}>
              {copy.color}
            </div>
            <div className="flex items-center gap-2">
              {AREA_COLOR_OPTIONS.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => setForm((prev) => ({ ...prev, color: option.key }))}
                  className="rounded-full transition-all"
                  style={{
                    width: 26,
                    height: 26,
                    background: option.value,
                    border: form.color === option.key ? "3px solid var(--foreground)" : "2px solid var(--border)",
                    transform: form.color === option.key ? "scale(1.08)" : "scale(1)",
                  }}
                />
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
