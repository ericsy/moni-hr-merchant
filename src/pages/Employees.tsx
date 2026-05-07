import { useState, useMemo, useEffect } from "react";
import {
  Button,
  Input,
  Select,
  Tag,
  Avatar,
  Tabs,
  Form,
  DatePicker,
  InputNumber,
  Popconfirm,
  Modal,
  Upload,
  type UploadFile,
  type UploadProps,
} from "antd";
import {
  Search,
  Plus,
  Pencil,
  Trash2,
  User,
  Phone,
  Mail,
  CalendarDays,
  Building2,
  DollarSign,
  FileText,
  ChevronRight,
  BadgeCheck,
  Banknote,
  MapPin,
  Cake,
  Briefcase,
  Clock,
  X,
  Check,
  Minus,
  Upload as UploadIcon,
  ExternalLink,
  Paperclip,
  IdCard,
} from "lucide-react";
import dayjs from "dayjs";
import { useData, type Employee, type WorkDayPattern } from "../context/DataContext";
import { useLocale } from "../context/LocaleContext";
import { useStore } from "../context/StoreContext";
import { toast } from "sonner";
import WorkDaysCalendar from "../components/WorkDaysCalendar";
import { ColorSwatchPicker, DEFAULT_COLOR_VALUE } from "../components/ColorSwatchPicker";
import { merchantApi } from "../lib/merchantApi";

const { Option } = Select;

const defaultWorkDayPattern: WorkDayPattern[] = [
  { dayIndex: 0, state: "on", hours: 7.5 },
  { dayIndex: 1, state: "on", hours: 7.5 },
  { dayIndex: 2, state: "on", hours: 7.5 },
  { dayIndex: 3, state: "on", hours: 7.5 },
  { dayIndex: 4, state: "on", hours: 7.5 },
  { dayIndex: 5, state: "off", hours: 0 },
  { dayIndex: 6, state: "off", hours: 0 },
];

const cloneWorkDayPattern = (pattern: WorkDayPattern[] = defaultWorkDayPattern) =>
  pattern.map((day) => ({ ...day }));

const getEmptyEmployeeFormValues = (defaultStoreIds: string[]) => ({
  firstName: "",
  lastName: "",
  employeeId: "",
  role: "staff",
  phone: "",
  email: "",
  password: "",
  startDate: undefined,
  dateOfBirth: undefined,
  address: "",
  status: "active",
  storeIds: [...defaultStoreIds],
  avatar: "",
  employeeColor: DEFAULT_COLOR_VALUE,
  notes: "",
  gender: undefined,
  maritalStatus: undefined,
  identityDocumentType: undefined,
  identityDocumentNumber: "",
  idDocumentFrontKey: "",
  idDocumentBackKey: "",
  visaDocumentKey: "",
  passportDocumentKey: "",
  irdNumber: "",
  taxCode: "",
  kiwiSaverStatus: "Enrolled",
  employeeContributionRate: "3%",
  employerContributionRate: "3",
  esctRate: undefined,
  bankAccountNumber: "",
  payrollEmployeeId: "",
  hourlyRate: undefined,
  positionIds: [],
  paidHoursPerDay: 8,
  workDayPattern: cloneWorkDayPattern(defaultWorkDayPattern),
  contractType: "permanent",
  endDate: undefined,
  contractedHours: undefined,
  annualSalary: undefined,
  defaultHourlyRate: undefined,
  contractDocumentKey: "",
});

function getInitials(firstName = "", lastName = "") {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getEmployeeAvatarUrl(employee?: Pick<Employee, "avatar" | "avatarPreviewUrl"> | null) {
  if (!employee) return "";
  const previewUrl = employee.avatarPreviewUrl || "";
  if (previewUrl.startsWith("http://") || previewUrl.startsWith("https://")) return previewUrl;
  const avatar = employee.avatar || "";
  if (avatar.startsWith("http://") || avatar.startsWith("https://")) return avatar;
  return previewUrl;
}

type EmployeeDocumentField =
  | "idDocumentFront"
  | "idDocumentBack"
  | "visaDocument"
  | "passportDocument";

type EmployeeDocumentUploadKind = "id-front" | "id-back" | "visa" | "passport";
type EmployeeIdentityDocumentType = "id" | "passport";

const EMPLOYEE_DOCUMENT_FIELDS: Record<EmployeeDocumentField, {
  keyField: keyof Employee;
  urlField: keyof Employee;
  uploadKind: EmployeeDocumentUploadKind;
  labelKey: string;
}> = {
  idDocumentFront: {
    keyField: "idDocumentFrontKey",
    urlField: "idDocumentFrontUrl",
    uploadKind: "id-front",
    labelKey: "idDocumentFront",
  },
  idDocumentBack: {
    keyField: "idDocumentBackKey",
    urlField: "idDocumentBackUrl",
    uploadKind: "id-back",
    labelKey: "idDocumentBack",
  },
  visaDocument: {
    keyField: "visaDocumentKey",
    urlField: "visaDocumentUrl",
    uploadKind: "visa",
    labelKey: "visaDocument",
  },
  passportDocument: {
    keyField: "passportDocumentKey",
    urlField: "passportDocumentUrl",
    uploadKind: "passport",
    labelKey: "passportDocument",
  },
};

const EMPLOYEE_DOCUMENT_FIELDS_BY_TYPE: Record<EmployeeIdentityDocumentType, EmployeeDocumentField[]> = {
  id: ["idDocumentFront", "idDocumentBack"],
  passport: ["passportDocument", "visaDocument"],
};

const getEmployeeDocumentFieldsByType = (type?: string): EmployeeDocumentField[] =>
  type === "id" || type === "passport" ? EMPLOYEE_DOCUMENT_FIELDS_BY_TYPE[type] : [];

// ─── WorkDayEditor component ───
function WorkDayEditor({
  value = defaultWorkDayPattern,
  onChange = () => {},
  weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
}: {
  value?: WorkDayPattern[];
  onChange?: (v: WorkDayPattern[]) => void;
  weekDays?: string[];
}) {
  const stateOrder: Array<"on" | "off" | "none"> = ["on", "off", "none"];

  const cycleState = (idx: number) => {
    const next = value.map((d) => {
      if (d.dayIndex !== idx) return d;
      const cur = stateOrder.indexOf(d.state);
      const nextState = stateOrder[(cur + 1) % stateOrder.length];
      return { ...d, state: nextState, hours: nextState === "on" ? 7.5 : 0 };
    });
    onChange(next);
  };

  const setHours = (idx: number, hours: number) => {
    onChange(value.map((d) => (d.dayIndex === idx ? { ...d, hours } : d)));
  };

  return (
    <div className="flex gap-2" style={{ flexWrap: "wrap" }}>
      {value.map((day) => (
        <div
          key={day.dayIndex}
          className="flex flex-col items-center gap-1"
          style={{ minWidth: 52 }}
        >
          <span className="text-xs font-medium" style={{ color: "var(--muted-foreground)" }}>
            {weekDays[day.dayIndex]}
          </span>
          <button
            type="button"
            onClick={() => cycleState(day.dayIndex)}
            className="rounded-lg flex items-center justify-center text-xs font-semibold transition-all"
            style={{
              width: 44,
              height: 36,
              border: "1.5px solid var(--border)",
              background:
                day.state === "on"
                  ? "var(--primary)"
                  : day.state === "off"
                  ? "var(--muted)"
                  : "transparent",
              color:
                day.state === "on"
                  ? "var(--primary-foreground)"
                  : "var(--muted-foreground)",
            }}
          >
            {day.state === "on" ? (
              <Check size={14} />
            ) : day.state === "off" ? (
              <X size={14} />
            ) : (
              <Minus size={14} />
            )}
          </button>
          {day.state === "on" && (
            <InputNumber
              size="small"
              min={0}
              max={24}
              step={0.5}
              value={day.hours}
              onChange={(v) => setHours(day.dayIndex, v ?? 0)}
              style={{ width: 52, fontSize: 11 }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── ColorDot picker ───
function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-2 py-2" style={{ borderBottom: "1px solid var(--border)" }}>
      <span className="mt-0.5 flex-shrink-0" style={{ color: "var(--muted-foreground)" }}>{icon}</span>
      <span className="text-xs flex-shrink-0 w-36" style={{ color: "var(--muted-foreground)" }}>{label}</span>
      <span className="text-xs font-medium flex-1" style={{ color: "var(--foreground)" }}>{value || "-"}</span>
    </div>
  );
}

// ─── Employee form modal (Add/Edit) ───
export function EmployeeModal({
  open = false,
  employee = null,
  stores = [],
  defaultStoreIds = [],
  onSave = () => {},
  onCancel = () => {},
  t,
  locale = "zh",
}: {
  open?: boolean;
  employee?: Employee | null;
  stores?: { id: string; name: string }[];
  defaultStoreIds?: string[];
  onSave?: (emp: Employee) => void | Promise<void>;
  onCancel?: () => void;
  t: ReturnType<typeof useLocale>["t"];
  locale?: string;
}) {
  const [form] = Form.useForm();
  const isEdit = !!employee;
  const [activeTabKey, setActiveTabKey] = useState("general");
  const [uploadingContract, setUploadingContract] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingDocuments, setUploadingDocuments] = useState<Record<EmployeeDocumentField, boolean>>({
    idDocumentFront: false,
    idDocumentBack: false,
    visaDocument: false,
    passportDocument: false,
  });
  const identityDocumentType = Form.useWatch("identityDocumentType", form);
  const visibleDocumentFields = getEmployeeDocumentFieldsByType(identityDocumentType);
  const formInitialValues = employee
    ? {
        ...getEmptyEmployeeFormValues(defaultStoreIds),
        ...employee,
        startDate: employee.startDate ? dayjs(employee.startDate) : undefined,
        dateOfBirth: employee.dateOfBirth ? dayjs(employee.dateOfBirth) : undefined,
        endDate: employee.endDate ? dayjs(employee.endDate) : undefined,
        workDayPattern: cloneWorkDayPattern(employee.workDayPattern ?? defaultWorkDayPattern),
        avatar: employee.avatar ?? "",
        contractDocumentKey: employee.contractDocumentKey || employee.contractDocumentUrl || "",
        idDocumentFrontKey: employee.idDocumentFrontKey || employee.idDocumentFrontUrl || "",
        idDocumentBackKey: employee.idDocumentBackKey || employee.idDocumentBackUrl || "",
        visaDocumentKey: employee.visaDocumentKey || employee.visaDocumentUrl || "",
        passportDocumentKey: employee.passportDocumentKey || employee.passportDocumentUrl || "",
      }
    : getEmptyEmployeeFormValues(defaultStoreIds);
  const formInstanceKey = employee ? `edit-${employee.id}` : `new-${defaultStoreIds.join("|") || "none"}`;
  const buildContractFileList = (targetEmployee: Employee | null): UploadFile[] => {
    if (!targetEmployee?.contractDocumentKey && !targetEmployee?.contractDocumentUrl) return [];
    return [{
      uid: targetEmployee.contractDocumentKey || targetEmployee.contractDocumentUrl || "contract-file",
      name: targetEmployee.contractDocumentKey?.split("/").pop() || "contract",
      status: "done",
      url: targetEmployee.contractDocumentUrl || undefined,
    }];
  };
  const buildDocumentFileList = (targetEmployee: Employee | null, field: EmployeeDocumentField): UploadFile[] => {
    const meta = EMPLOYEE_DOCUMENT_FIELDS[field];
    const key = String(targetEmployee?.[meta.keyField] || "");
    const url = String(targetEmployee?.[meta.urlField] || "");
    if (!key && !url) return [];
    return [{
      uid: key || url || `${field}-file`,
      name: key.split("/").pop() || url.split("/").pop() || field,
      status: "done",
      url: url || undefined,
    }];
  };
  const [contractFileList, setContractFileList] = useState<UploadFile[]>(() => {
    if (!employee?.contractDocumentKey && !employee?.contractDocumentUrl) return [];
    return [{
      uid: employee.contractDocumentKey || employee.contractDocumentUrl || "contract-file",
      name: employee.contractDocumentKey?.split("/").pop() || "contract",
      status: "done",
      url: employee.contractDocumentUrl || undefined,
    }];
  });
  const [documentFileLists, setDocumentFileLists] = useState<Record<EmployeeDocumentField, UploadFile[]>>(() => ({
    idDocumentFront: buildDocumentFileList(employee, "idDocumentFront"),
    idDocumentBack: buildDocumentFileList(employee, "idDocumentBack"),
    visaDocument: buildDocumentFileList(employee, "visaDocument"),
    passportDocument: buildDocumentFileList(employee, "passportDocument"),
  }));

  useEffect(() => {
    if (!open) return;
    form.setFieldsValue(getEmptyEmployeeFormValues(defaultStoreIds));
    form.setFieldsValue(formInitialValues);
    setContractFileList(buildContractFileList(employee));
    setDocumentFileLists({
      idDocumentFront: buildDocumentFileList(employee, "idDocumentFront"),
      idDocumentBack: buildDocumentFileList(employee, "idDocumentBack"),
      visaDocument: buildDocumentFileList(employee, "visaDocument"),
      passportDocument: buildDocumentFileList(employee, "passportDocument"),
    });
    setUploadingContract(false);
    setUploadingAvatar(false);
    setUploadingDocuments({
      idDocumentFront: false,
      idDocumentBack: false,
      visaDocument: false,
      passportDocument: false,
    });
    setActiveTabKey("general");
  }, [open, employee?.id, defaultStoreIds.join("|")]);

  const buildAvatarFileList = (targetEmployee: Employee | null): UploadFile[] => {
    const avatarUrl = getEmployeeAvatarUrl(targetEmployee);
    const avatarValue = targetEmployee?.avatar || "";
    if (!avatarUrl && !avatarValue) return [];
    return [{
      uid: avatarValue || avatarUrl || "avatar-file",
      name: avatarValue.split("/").pop() || avatarUrl.split("/").pop() || "avatar",
      status: "done",
      url: avatarUrl || undefined,
    }];
  };
  const [avatarFileList, setAvatarFileList] = useState<UploadFile[]>(() => buildAvatarFileList(employee));

  useEffect(() => {
    if (!open) return;
    setAvatarFileList(buildAvatarFileList(employee));
  }, [open, employee?.id]);

  const syncContractFormValue = (fileList: UploadFile[]) => {
    const uploaded = fileList[0];
    form.setFieldValue("contractDocumentKey", uploaded?.response?.key || uploaded?.uid || "");
  };

  const syncAvatarFormValue = (fileList: UploadFile[]) => {
    const uploaded = fileList[0];
    form.setFieldValue("avatar", uploaded?.response?.key || uploaded?.uid || "");
  };

  const syncDocumentFormValue = (field: EmployeeDocumentField, fileList: UploadFile[]) => {
    const uploaded = fileList[0];
    form.setFieldValue(EMPLOYEE_DOCUMENT_FIELDS[field].keyField, uploaded?.response?.key || uploaded?.uid || "");
  };

  const et = t.employee as Record<string, unknown>;
  const contractRequiredMessage = et.contractUploadRequired as string;

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const contractDocumentKey = String(values.contractDocumentKey || "").trim();
      const selectedDocumentType = String(values.identityDocumentType || "");
      const shouldUseIdDocuments = selectedDocumentType === "id";
      const shouldUsePassportDocuments = selectedDocumentType === "passport";

      if (uploadingContract || !contractDocumentKey) {
        const message = uploadingContract
          ? et.contractUploading as string
          : contractRequiredMessage;
        setActiveTabKey("employment");
        form.setFields([{ name: "contractDocumentKey", errors: [message] }]);
        toast.error(message);
        return;
      }

      const saved: Employee = {
        id: employee?.id ?? `e${Date.now()}`,
        password: values.password || undefined,
        firstName: values.firstName ?? "",
        lastName: values.lastName ?? "",
        employeeId: values.employeeId ?? "",
        role: values.role ?? "staff",
        phone: values.phone ?? "",
        email: values.email ?? "",
        status: values.status ?? "active",
        startDate: values.startDate ? dayjs(values.startDate).format("YYYY-MM-DD") : "",
        storeIds: values.storeIds ?? [],
        assignedStores: values.storeIds ?? [],
        hourlyRate: values.hourlyRate ?? 0,
        notes: values.notes ?? "",
        avatar: values.avatar ?? employee?.avatar ?? "",
        avatarPreviewUrl: avatarFileList[0]?.url ?? employee?.avatarPreviewUrl ?? employee?.avatar ?? "",
        employeeColor: values.employeeColor ?? DEFAULT_COLOR_VALUE,
        address: values.address ?? "",
        dateOfBirth: values.dateOfBirth ? dayjs(values.dateOfBirth).format("YYYY-MM-DD") : "",
        gender: values.gender ?? "",
        maritalStatus: values.maritalStatus ?? "",
        identityDocumentType: selectedDocumentType,
        identityDocumentNumber: values.identityDocumentNumber ?? "",
        idDocumentFrontKey: shouldUseIdDocuments ? values.idDocumentFrontKey ?? "" : "",
        idDocumentFrontUrl: shouldUseIdDocuments && values.idDocumentFrontKey ? documentFileLists.idDocumentFront[0]?.url ?? employee?.idDocumentFrontUrl ?? "" : "",
        idDocumentBackKey: shouldUseIdDocuments ? values.idDocumentBackKey ?? "" : "",
        idDocumentBackUrl: shouldUseIdDocuments && values.idDocumentBackKey ? documentFileLists.idDocumentBack[0]?.url ?? employee?.idDocumentBackUrl ?? "" : "",
        visaDocumentKey: shouldUsePassportDocuments ? values.visaDocumentKey ?? "" : "",
        visaDocumentUrl: shouldUsePassportDocuments && values.visaDocumentKey ? documentFileLists.visaDocument[0]?.url ?? employee?.visaDocumentUrl ?? "" : "",
        passportDocumentKey: shouldUsePassportDocuments ? values.passportDocumentKey ?? "" : "",
        passportDocumentUrl: shouldUsePassportDocuments && values.passportDocumentKey ? documentFileLists.passportDocument[0]?.url ?? employee?.passportDocumentUrl ?? "" : "",
        irdNumber: values.irdNumber ?? "",
        taxCode: values.taxCode ?? "",
        kiwiSaverStatus: values.kiwiSaverStatus ?? "",
        employeeContributionRate: values.employeeContributionRate ?? "3%",
        employerContributionRate: values.employerContributionRate ?? "3",
        esctRate: values.esctRate ?? "",
        bankAccountNumber: values.bankAccountNumber ?? "",
        payrollEmployeeId: values.payrollEmployeeId ?? "",
        areaIds: employee?.areaIds ?? [],
        positionIds: employee?.positionIds ?? [],
        paidHoursPerDay: values.paidHoursPerDay ?? 8,
        workDayPattern: values.workDayPattern ?? defaultWorkDayPattern,
        contractType: values.contractType ?? "permanent",
        contractDocumentKey,
        contractDocumentUrl: contractFileList[0]?.url ?? employee?.contractDocumentUrl ?? "",
        endDate: values.endDate ? dayjs(values.endDate).format("YYYY-MM-DD") : "",
        contractedHours: values.contractedHours ?? "",
        annualSalary: values.annualSalary ?? "",
        defaultHourlyRate: values.defaultHourlyRate ?? "",
      };
      await onSave(saved);
    } catch (err) {
      console.log("[EmployeeModal] save failed:", err);
      const errorFields = (err as { errorFields?: Array<{ name?: Array<string | number> }> })?.errorFields ?? [];
      const hasContractError = errorFields.some((field) => field.name?.includes("contractDocumentKey"));
      if (hasContractError) {
        setActiveTabKey("employment");
        toast.error(contractRequiredMessage);
      }
    }
  };

  const contractUploadText = uploadingContract
    ? et.contractUploading as string
    : (contractFileList.length > 0 ? et.contractUploadReplace as string : et.contractUploadButton as string);
  const avatarUploadText = uploadingAvatar
    ? et.contractUploading as string
    : (avatarFileList.length > 0 ? et.avatarUploadReplace as string : et.avatarUploadButton as string);

  const handleContractUpload: UploadProps["beforeUpload"] = async (file) => {
    try {
      setUploadingContract(true);
      const uploaded = await merchantApi.uploadEmployeeContract(file);
      const nextFile: UploadFile = {
        uid: uploaded.key || `${file.name}-${Date.now()}`,
        name: file.name,
        status: "done",
        url: uploaded.downloadUrl || undefined,
        response: uploaded,
      };
      const nextFileList = [nextFile];
      setContractFileList(nextFileList);
      syncContractFormValue(nextFileList);
      form.validateFields(["contractDocumentKey"]).catch(() => undefined);
      toast.success(et.contractUploadSuccess as string);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : et.contractUploadFailed as string);
    } finally {
      setUploadingContract(false);
    }
    return Upload.LIST_IGNORE;
  };

  const handleRemoveContract = () => {
    setContractFileList([]);
    syncContractFormValue([]);
  };

  const handleAvatarUpload: UploadProps["beforeUpload"] = async (file) => {
    try {
      setUploadingAvatar(true);
      const uploaded = await merchantApi.uploadEmployeeAvatar(file);
      const nextFile: UploadFile = {
        uid: uploaded.key || `${file.name}-${Date.now()}`,
        name: file.name,
        status: "done",
        url: uploaded.downloadUrl || undefined,
        response: uploaded,
      };
      const nextFileList = [nextFile];
      setAvatarFileList(nextFileList);
      syncAvatarFormValue(nextFileList);
      toast.success(et.avatarUploadSuccess as string);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : et.avatarUploadFailed as string);
    } finally {
      setUploadingAvatar(false);
    }
    return Upload.LIST_IGNORE;
  };

  const handleRemoveAvatar = () => {
    setAvatarFileList([]);
    syncAvatarFormValue([]);
  };

  const handleDocumentUpload = (field: EmployeeDocumentField): UploadProps["beforeUpload"] => async (file) => {
    const meta = EMPLOYEE_DOCUMENT_FIELDS[field];
    try {
      setUploadingDocuments((prev) => ({ ...prev, [field]: true }));
      const uploaded = await merchantApi.uploadEmployeeDocument(meta.uploadKind, file);
      const nextFile: UploadFile = {
        uid: uploaded.key || `${file.name}-${Date.now()}`,
        name: file.name,
        status: "done",
        url: uploaded.downloadUrl || undefined,
        response: uploaded,
      };
      const nextFileList = [nextFile];
      setDocumentFileLists((prev) => ({ ...prev, [field]: nextFileList }));
      syncDocumentFormValue(field, nextFileList);
      toast.success(et.documentUploadSuccess as string);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : et.documentUploadFailed as string);
    } finally {
      setUploadingDocuments((prev) => ({ ...prev, [field]: false }));
    }
    return Upload.LIST_IGNORE;
  };

  const handleRemoveDocument = (field: EmployeeDocumentField) => {
    setDocumentFileLists((prev) => ({ ...prev, [field]: [] }));
    syncDocumentFormValue(field, []);
  };

  const renderDocumentUpload = (field: EmployeeDocumentField) => {
    const meta = EMPLOYEE_DOCUMENT_FIELDS[field];
    const fileList = documentFileLists[field];
    return (
      <Form.Item
        name={meta.keyField}
        label={et[meta.labelKey] as string}
        extra={et.documentUploadHint as string}
      >
        <div className="flex flex-col gap-3">
          <Upload
            fileList={fileList}
            maxCount={1}
            beforeUpload={handleDocumentUpload(field)}
            onRemove={() => {
              handleRemoveDocument(field);
              return true;
            }}
            accept=".pdf,image/*"
            showUploadList={{
              showPreviewIcon: !!fileList[0]?.url,
              showRemoveIcon: true,
            }}
            onPreview={(file) => {
              if (file.url) window.open(file.url, "_blank", "noopener,noreferrer");
            }}
          >
            <Button icon={<UploadIcon size={14} />} loading={uploadingDocuments[field]}>
              {fileList.length > 0 ? et.documentUploadReplace as string : et.documentUploadButton as string}
            </Button>
          </Upload>
          {fileList[0]?.url && (
            <a
              href={fileList[0].url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: "var(--primary)" }}
            >
              <ExternalLink size={12} />
              {et.documentView as string}
            </a>
          )}
        </div>
      </Form.Item>
    );
  };

  const tabItems = [
    {
      key: "general",
      label: et.tabGeneral as string,
      children: (
        <div className="flex flex-col gap-0">
          <Form.Item name="avatar" hidden>
            <Input />
          </Form.Item>
          <Form.Item label={et.avatar as string} extra={et.avatarHint as string}>
            <div className="flex items-center gap-4">
              <Avatar
                size={64}
                src={avatarFileList[0]?.url}
                style={{
                  background: (form.getFieldValue("employeeColor") || employee?.employeeColor || DEFAULT_COLOR_VALUE),
                  fontSize: 22,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {getInitials(form.getFieldValue("firstName") || employee?.firstName || "", form.getFieldValue("lastName") || employee?.lastName || "")}
              </Avatar>
              <div className="flex items-center gap-2" style={{ flexWrap: "wrap" }}>
                <Upload
                  fileList={avatarFileList}
                  maxCount={1}
                  beforeUpload={handleAvatarUpload}
                  onRemove={() => {
                    handleRemoveAvatar();
                    return true;
                  }}
                  accept="image/*"
                  showUploadList={false}
                >
                  <Button icon={<UploadIcon size={14} />} loading={uploadingAvatar}>
                    {avatarUploadText}
                  </Button>
                </Upload>
                {avatarFileList.length > 0 && (
                  <Button onClick={handleRemoveAvatar}>
                    {et.avatarRemove as string}
                  </Button>
                )}
              </div>
            </div>
          </Form.Item>
          <div className="flex gap-4">
            <Form.Item name="firstName" label={et.firstName as string} rules={[{ required: true, message: t.required }]} style={{ flex: 1 }}>
              <Input prefix={<User size={13} />} />
            </Form.Item>
            <Form.Item name="lastName" label={et.lastName as string} rules={[{ required: true, message: t.required }]} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </div>
          <div className="flex gap-4">
            <Form.Item name="employeeId" label={et.employeeId as string} rules={[{ required: true, message: t.required }]} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="role" label={et.role as string} style={{ flex: 1 }}>
              <Select>
                {Object.entries(t.employee.roles).map(([k, v]) => (
                  <Option key={k} value={k}>{v}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          <div className="flex gap-4">
            <Form.Item name="phone" label={et.phone as string} style={{ flex: 1 }}>
              <Input prefix={<Phone size={13} />} />
            </Form.Item>
            <Form.Item name="email" label={et.email as string} rules={[{ required: true, message: t.required }, { type: "email", message: et.invalidEmail as string }]} style={{ flex: 1 }}>
              <Input prefix={<Mail size={13} />} />
            </Form.Item>
          </div>
          {!isEdit && (
            <Form.Item
              name="password"
              label={et.initialPassword as string}
              rules={[{ required: true, message: t.required }, { min: 8, message: et.passwordMinLength as string }]}
            >
              <Input.Password />
            </Form.Item>
          )}
          <div className="flex gap-4">
            <Form.Item name="startDate" label={et.startDate as string} style={{ flex: 1 }}>
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="dateOfBirth" label={et.dateOfBirth as string} style={{ flex: 1 }}>
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <div className="flex gap-4">
            <Form.Item name="gender" label={et.gender as string} style={{ flex: 1 }}>
              <Select allowClear placeholder={t.selectPlaceholder}>
                {Object.entries(et.genderOptions as Record<string, string>).map(([key, label]) => (
                  <Option key={key} value={key}>{label}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="maritalStatus" label={et.maritalStatus as string} style={{ flex: 1 }}>
              <Select allowClear placeholder={t.selectPlaceholder}>
                {Object.entries(et.maritalStatusOptions as Record<string, string>).map(([key, label]) => (
                  <Option key={key} value={key}>{label}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="address" label={et.address as string}>
            <Input prefix={<MapPin size={13} />} />
          </Form.Item>
          <div className="flex gap-4">
            <Form.Item name="status" label={et.status as string} style={{ flex: 1 }}>
              <Select>
                <Option value="active">{t.active}</Option>
                <Option value="inactive">{t.inactive}</Option>
              </Select>
            </Form.Item>
            <Form.Item name="storeIds" label={et.assignedStores as string} style={{ flex: 1 }}>
              <Select mode="multiple" placeholder={t.selectPlaceholder}>
                {stores.map((s) => (
                  <Option key={s.id} value={s.id}>{s.name}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          <Form.Item name="employeeColor" label={et.employeeColor as string}>
            <Form.Item name="employeeColor" noStyle>
              <ColorSwatchPicker valueMode="value" locale={locale} />
            </Form.Item>
          </Form.Item>
          <Form.Item name="notes" label={et.notes as string}>
            <Input.TextArea rows={2} />
          </Form.Item>
        </div>
      ),
    },
    {
      key: "payroll",
      label: et.tabPayroll as string,
      children: (
        <div className="flex flex-col gap-0">
          <div className="flex gap-4">
            <Form.Item name="irdNumber" label={et.irdNumber as string} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
            <Form.Item name="taxCode" label={et.taxCode as string} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </div>
          <div className="flex gap-4">
            <Form.Item name="kiwiSaverStatus" label={et.kiwiSaverStatus as string} style={{ flex: 1 }}>
              <Select>
                <Option value="Enrolled">{(et.kiwiSaverOptions as Record<string, string>).enrolled}</Option>
                <Option value="Non-enrolled">{(et.kiwiSaverOptions as Record<string, string>).nonEnrolled}</Option>
                <Option value="Opted Out">{(et.kiwiSaverOptions as Record<string, string>).optedOut}</Option>
                <Option value="Exempt">{(et.kiwiSaverOptions as Record<string, string>).exempt}</Option>
              </Select>
            </Form.Item>
            <Form.Item name="employeeContributionRate" label={et.employeeContributionRate as string} style={{ flex: 1 }}>
              <Select>
                {["3%", "4%", "6%", "8%", "10%"].map((r) => (
                  <Option key={r} value={r}>{r}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>
          <div className="flex gap-4">
            <Form.Item name="employerContributionRate" label={et.employerContributionRate as string} style={{ flex: 1 }}>
              <InputNumber min={0} max={100} step={0.5} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="esctRate" label={et.esctRate as string} style={{ flex: 1 }}>
              <InputNumber min={0} max={100} step={0.5} style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <Form.Item name="bankAccountNumber" label={et.bankAccountNumber as string}>
            <Input prefix={<Banknote size={13} />} />
          </Form.Item>
          <Form.Item name="payrollEmployeeId" label={et.payrollEmployeeId as string}>
            <Input />
          </Form.Item>
          <div className="flex gap-4">
            <Form.Item name="hourlyRate" label={et.hourlyRate as string} style={{ flex: 1 }}>
              <InputNumber min={0} step={0.5} style={{ width: "100%" }} addonAfter={et.nzd as string} />
            </Form.Item>
          </div>
        </div>
      ),
    },
    {
      key: "workdays",
      label: et.tabWorkDays as string,
      children: (
        <div className="flex flex-col gap-4">
          <Form.Item name="paidHoursPerDay" label={et.paidHoursPerDay as string}>
            <InputNumber min={0} max={24} step={0.5} style={{ width: 140 }} />
          </Form.Item>
          <Form.Item name="workDayPattern" label={et.workDayPattern as string}>
            <WorkDayEditor weekDays={et.weekDays as string[]} />
          </Form.Item>
        </div>
      ),
    },
    {
      key: "employment",
      label: et.tabEmployment as string,
      forceRender: true,
      children: (
        <div className="flex flex-col gap-0">
          <div className="flex gap-4">
            <Form.Item name="contractType" label={et.contractType as string} style={{ flex: 1 }}>
              <Select>
                {Object.entries((et.contractTypes as Record<string, string>)).map(([k, v]) => (
                  <Option key={k} value={k}>{v}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="endDate" label={et.endDate as string} style={{ flex: 1 }}>
              <DatePicker style={{ width: "100%" }} />
            </Form.Item>
          </div>
          <div className="flex gap-4">
            <Form.Item name="contractedHours" label={et.contractedHours as string} style={{ flex: 1 }}>
              <InputNumber min={0} max={168} step={0.5} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item name="annualSalary" label={et.annualSalary as string} style={{ flex: 1 }}>
              <InputNumber min={0} step={1000} style={{ width: "100%" }} addonAfter="$" />
            </Form.Item>
          </div>
          <Form.Item name="defaultHourlyRate" label={et.defaultHourlyRate as string}>
            <InputNumber min={0} step={0.5} style={{ width: "100%" }} addonAfter={et.nzd as string} />
          </Form.Item>
          <div className="flex gap-4">
            <Form.Item name="identityDocumentType" label={et.identityDocumentType as string} style={{ flex: 1 }}>
              <Select allowClear placeholder={t.selectPlaceholder}>
                {Object.entries(et.identityDocumentTypeOptions as Record<string, string>).map(([key, label]) => (
                  <Option key={key} value={key}>{label}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item name="identityDocumentNumber" label={et.identityDocumentNumber as string} style={{ flex: 1 }}>
              <Input />
            </Form.Item>
          </div>
          {visibleDocumentFields.length > 0 && (
            <div className="grid gap-4 md:grid-cols-2">
              {visibleDocumentFields.map((field) => renderDocumentUpload(field))}
            </div>
          )}
          <Form.Item
            name="contractDocumentKey"
            label={et.contractFile as string}
            rules={[{ required: true, message: contractRequiredMessage }]}
            extra={et.contractUploadHint as string}
          >
            <div className="flex flex-col gap-3">
              <Upload
                fileList={contractFileList}
                maxCount={1}
                beforeUpload={handleContractUpload}
                onRemove={() => {
                  handleRemoveContract();
                  return true;
                }}
                accept=".pdf,.doc,.docx,image/*"
                showUploadList={{
                  showPreviewIcon: !!contractFileList[0]?.url,
                  showRemoveIcon: true,
                }}
                onPreview={(file) => {
                  if (file.url) window.open(file.url, "_blank", "noopener,noreferrer");
                }}
              >
                <Button icon={<UploadIcon size={14} />} loading={uploadingContract}>
                  {contractUploadText}
                </Button>
              </Upload>
              {contractFileList[0]?.url && (
                <a
                  href={contractFileList[0].url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs"
                  style={{ color: "var(--primary)" }}
                >
                  <ExternalLink size={12} />
                  {et.contractView as string}
                </a>
              )}
            </div>
          </Form.Item>
        </div>
      ),
    },
  ];

  return (
    <Modal
      open={open}
      title={isEdit ? et.editEmployee as string : et.addEmployee as string}
      onOk={handleOk}
      onCancel={onCancel}
      okText={t.save}
      cancelText={t.cancel}
      width={680}
      destroyOnClose
    >
      <Form
        key={formInstanceKey}
        form={form}
        layout="vertical"
        initialValues={formInitialValues}
        preserve={false}
        size="small"
      >
        <Tabs activeKey={activeTabKey} onChange={setActiveTabKey} items={tabItems} />
      </Form>
    </Modal>
  );
}

// ─── Detail Panel ───
function DetailPanel({
  employee,
  stores = [],
  onEdit = () => {},
  onDelete = () => {},
  t,
}: {
  employee: Employee;
  stores?: { id: string; name: string }[];
  onEdit?: () => void;
  onDelete?: () => void;
  t: ReturnType<typeof useLocale>["t"];
}) {
  const et = t.employee as Record<string, unknown>;

  const assignedStoreNames = (employee.storeIds ?? [])
    .map((id) => stores.find((s) => s.id === id)?.name)
    .filter(Boolean) as string[];

  const workDays = employee.workDayPattern ?? defaultWorkDayPattern;
  const weekDays = et.weekDays as string[];

  const roleLabel =
    (et.roles as Record<string, string>)[employee.role] ?? employee.role;

  const contractTypeLabel =
    employee.contractType
      ? ((et.contractTypes as Record<string, string>)[employee.contractType] ?? employee.contractType)
      : "-";
  const contractFileName = employee.contractDocumentKey?.split("/").pop() || "";
  const avatarUrl = getEmployeeAvatarUrl(employee);
  const visibleDocumentFields = getEmployeeDocumentFieldsByType(employee.identityDocumentType);
  const getOptionLabel = (optionsKey: string, value?: string) => {
    if (!value) return "";
    return ((et[optionsKey] as Record<string, string> | undefined)?.[value] ?? value);
  };
  const documentLink = (url?: string, key?: string) => {
    if (!url) return "-";
    const fileName = key?.split("/").pop();
    return (
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center gap-1"
        style={{ color: "var(--primary)" }}
      >
        <ExternalLink size={12} />
        {fileName || et.documentView as string}
      </a>
    );
  };

  const tabItems = [
    {
      key: "general",
      label: et.tabGeneral as string,
      children: (
        <div className="flex flex-col">
          <InfoRow icon={<User size={13} />} label={et.fullName as string} value={`${employee.firstName} ${employee.lastName}`} />
          <InfoRow icon={<BadgeCheck size={13} />} label={et.employeeId as string} value={employee.employeeId} />
          <InfoRow icon={<Briefcase size={13} />} label={et.role as string} value={roleLabel} />
          <InfoRow icon={<Phone size={13} />} label={et.phone as string} value={employee.phone} />
          <InfoRow icon={<Mail size={13} />} label={et.email as string} value={employee.email} />
          <InfoRow icon={<CalendarDays size={13} />} label={et.startDate as string} value={employee.startDate} />
          <InfoRow icon={<Cake size={13} />} label={et.dateOfBirth as string} value={employee.dateOfBirth ?? ""} />
          <InfoRow icon={<User size={13} />} label={et.gender as string} value={getOptionLabel("genderOptions", employee.gender)} />
          <InfoRow icon={<BadgeCheck size={13} />} label={et.maritalStatus as string} value={getOptionLabel("maritalStatusOptions", employee.maritalStatus)} />
          <InfoRow icon={<MapPin size={13} />} label={et.address as string} value={employee.address ?? ""} />
          <InfoRow
            icon={<Building2 size={13} />}
            label={et.assignedStores as string}
            value={
              assignedStoreNames.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {assignedStoreNames.map((name) => (
                    <Tag key={name} style={{ fontSize: 11, margin: 0 }}>{name}</Tag>
                  ))}
                </div>
              ) : "-"
            }
          />
          {employee.notes && (
            <InfoRow icon={<FileText size={13} />} label={et.notes as string} value={employee.notes} />
          )}
        </div>
      ),
    },
    {
      key: "payroll",
      label: et.tabPayroll as string,
      children: (
        <div className="flex flex-col">
          <InfoRow icon={<BadgeCheck size={13} />} label={et.irdNumber as string} value={employee.irdNumber ?? ""} />
          <InfoRow icon={<FileText size={13} />} label={et.taxCode as string} value={employee.taxCode ?? ""} />
          <InfoRow icon={<BadgeCheck size={13} />} label={et.kiwiSaverStatus as string} value={employee.kiwiSaverStatus ?? ""} />
          <InfoRow icon={<DollarSign size={13} />} label={et.employeeContributionRate as string} value={employee.employeeContributionRate ?? ""} />
          <InfoRow icon={<DollarSign size={13} />} label={et.employerContributionRate as string} value={employee.employerContributionRate ? `${employee.employerContributionRate}%` : ""} />
          <InfoRow icon={<DollarSign size={13} />} label={et.esctRate as string} value={employee.esctRate ? `${employee.esctRate}%` : ""} />
          <InfoRow icon={<Banknote size={13} />} label={et.bankAccountNumber as string} value={employee.bankAccountNumber ?? ""} />
          <InfoRow icon={<BadgeCheck size={13} />} label={et.payrollEmployeeId as string} value={employee.payrollEmployeeId ?? ""} />
          <InfoRow icon={<DollarSign size={13} />} label={et.hourlyRate as string} value={employee.hourlyRate ? `$${employee.hourlyRate} ${et.nzd as string}` : ""} />
        </div>
      ),
    },
    {
      key: "workdays",
      label: et.tabWorkDays as string,
      children: (
        <div className="flex flex-col gap-0" style={{ margin: "-8px -8px 0" }}>
          <WorkDaysCalendar
            workDayPattern={workDays}
            onPatternChange={(newPattern) => {
              console.log("[WorkDaysCalendar] pattern changed:", newPattern);
              toast.info(et.workPatternUpdated as string);
            }}
          />
        </div>
      ),
    },
    {
      key: "employment",
      label: et.tabEmployment as string,
      children: (
        <div className="flex flex-col">
          <InfoRow icon={<FileText size={13} />} label={et.contractType as string} value={contractTypeLabel} />
          <InfoRow icon={<CalendarDays size={13} />} label={et.endDate as string} value={employee.endDate ?? ""} />
          <InfoRow icon={<Clock size={13} />} label={et.contractedHours as string} value={employee.contractedHours ? `${employee.contractedHours} ${t.hours}` : ""} />
          <InfoRow icon={<DollarSign size={13} />} label={et.annualSalary as string} value={employee.annualSalary ? `$${employee.annualSalary}` : ""} />
          <InfoRow icon={<DollarSign size={13} />} label={et.defaultHourlyRate as string} value={employee.defaultHourlyRate ? `$${employee.defaultHourlyRate} ${et.nzd as string}` : ""} />
          <InfoRow icon={<IdCard size={13} />} label={et.identityDocumentType as string} value={getOptionLabel("identityDocumentTypeOptions", employee.identityDocumentType)} />
          <InfoRow icon={<BadgeCheck size={13} />} label={et.identityDocumentNumber as string} value={employee.identityDocumentNumber ?? ""} />
          {visibleDocumentFields.map((field) => {
            const meta = EMPLOYEE_DOCUMENT_FIELDS[field];
            return (
              <InfoRow
                key={field}
                icon={<Paperclip size={13} />}
                label={et[meta.labelKey] as string}
                value={documentLink(
                  String(employee[meta.urlField] || ""),
                  String(employee[meta.keyField] || ""),
                )}
              />
            );
          })}
          <InfoRow
            icon={<Paperclip size={13} />}
            label={et.contractFile as string}
            value={employee.contractDocumentUrl ? (
              <a
                href={employee.contractDocumentUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1"
                style={{ color: "var(--primary)" }}
              >
                <ExternalLink size={12} />
                {contractFileName || et.contractView as string}
              </a>
            ) : "-"}
          />
        </div>
      ),
    },
  ];

  return (
    <div data-cmp="DetailPanel" className="flex flex-col h-full">
      {/* Header */}
      <div
        className="flex items-center gap-4 px-6 py-5"
        style={{ borderBottom: "1px solid var(--border)", background: "var(--card)" }}
      >
        <Avatar
          size={56}
          src={avatarUrl || undefined}
          style={{
            background: employee.employeeColor ?? "var(--primary)",
            fontSize: 20,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {getInitials(employee.firstName, employee.lastName)}
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="font-bold text-base leading-tight truncate" style={{ color: "var(--foreground)" }}>
            {employee.firstName} {employee.lastName}
          </div>
          <div className="text-sm mt-0.5" style={{ color: "var(--muted-foreground)" }}>
            {(et.roles as Record<string, string>)[employee.role] ?? employee.role} · {employee.employeeId}
          </div>
          <div className="mt-1.5">
            <Tag
              color={employee.status === "active" ? "success" : "default"}
              style={{ fontSize: 11 }}
            >
              {employee.status === "active" ? t.active : t.inactive}
            </Tag>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            type="default"
            size="small"
            icon={<Pencil size={13} />}
            onClick={onEdit}
          >
            {t.edit}
          </Button>
          <Popconfirm
            title={t.deleteConfirm}
            description={t.deleteWarning}
            onConfirm={onDelete}
            okText={t.yes}
            cancelText={t.no}
          >
            <Button type="default" size="small" danger icon={<Trash2 size={13} />}>
              {t.delete}
            </Button>
          </Popconfirm>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-1 overflow-auto px-4 py-2">
        <Tabs defaultActiveKey="general" items={tabItems} size="small" />
      </div>
    </div>
  );
}

// ─── Main Employees Page ───
export default function Employees() {
  const { employees, saveEmployee, deleteEmployee, stores } = useData();
  const { t, locale } = useLocale();
  const { selectedStoreId } = useStore();
  const et = t.employee as Record<string, unknown>;

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [selectedId, setSelectedId] = useState<string>(employees[0]?.id ?? "");
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);

  console.log("[Employees] selectedId:", selectedId, "total:", employees.length, "globalStore:", selectedStoreId);

  const filtered = useMemo(() => {
    return employees.filter((emp) => {
      const q = search.toLowerCase();
      const matchSearch =
        !q ||
        `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(q) ||
        emp.email.toLowerCase().includes(q) ||
        emp.employeeId.toLowerCase().includes(q);
      const matchStore = !selectedStoreId || emp.storeIds.includes(selectedStoreId);
      const matchStatus = !filterStatus || emp.status === filterStatus;
      return matchSearch && matchStore && matchStatus;
    });
  }, [employees, search, selectedStoreId, filterStatus]);

  const selectedEmployee = filtered.find((e) => e.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    const nextSelectedId = selectedEmployee?.id ?? "";
    if (selectedId !== nextSelectedId) {
      setSelectedId(nextSelectedId);
    }
  }, [selectedEmployee?.id, selectedId]);

  const handleAdd = () => {
    setEditingEmployee(null);
    setModalOpen(true);
  };

  const handleEdit = () => {
    if (!selectedEmployee) return;
    setEditingEmployee(selectedEmployee);
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedEmployee) return;
    try {
      await deleteEmployee(selectedEmployee.id);
      setSelectedId(filtered.find((e) => e.id !== selectedEmployee.id)?.id ?? "");
      toast.success(et.deleteSuccess as string);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : et.deleteFailed as string);
    }
  };

  const handleSave = async (emp: Employee) => {
    try {
      const saved = await saveEmployee(emp, editingEmployee?.id);
      setSelectedId(saved.id);
      setModalOpen(false);
      toast.success(et.saveSuccess as string);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : et.saveFailed as string);
    }
  };

  return (
    <div data-cmp="Employees" className="flex flex-col h-full" style={{ minHeight: "calc(100vh - 112px)" }}>
      {/* ─── Top bar ─── */}
      <div
        className="flex items-center justify-between px-0 pb-4"
        style={{ flexShrink: 0 }}
      >
        <div className="flex items-center gap-2 flex-1">
          <Input
            prefix={<Search size={14} style={{ color: "var(--muted-foreground)" }} />}
            placeholder={et.searchPlaceholder as string}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ width: 240 }}
            allowClear
          />
          <Select
            value={filterStatus || undefined}
            onChange={(v) => setFilterStatus(v ?? "")}
            placeholder={et.filterStatus as string}
            allowClear
            style={{ width: 140 }}
          >
            <Option value="active">{t.active}</Option>
            <Option value="inactive">{t.inactive}</Option>
          </Select>
          <span className="text-xs" style={{ color: "var(--muted-foreground)" }}>
            {t.total} {filtered.length} {t.items}
          </span>
        </div>
        <Button
          type="primary"
          icon={<Plus size={14} />}
          onClick={handleAdd}
        >
          {et.addEmployee as string}
        </Button>
      </div>

      {/* ─── Body: left list + right detail ─── */}
      <div className="flex flex-1 gap-4 overflow-hidden">
        {/* Left list */}
        <div
          className="flex flex-col overflow-auto rounded-xl"
          style={{
            width: 280,
            flexShrink: 0,
            background: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow)",
          }}
        >
          {filtered.length === 0 ? (
            <div className="flex items-center justify-center flex-1 text-sm" style={{ color: "var(--muted-foreground)", padding: 32 }}>
              {t.noData}
            </div>
          ) : (
            filtered.map((emp) => {
              const isActive = emp.id === selectedEmployee?.id;
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => setSelectedId(emp.id)}
                  className="flex items-center gap-3 px-4 py-3 text-left transition-all"
                  style={{
                    background: isActive ? "var(--muted)" : "transparent",
                    borderLeft: isActive ? `3px solid ${emp.employeeColor ?? "var(--primary)"}` : "3px solid transparent",
                    borderBottom: "1px solid var(--border)",
                    cursor: "pointer",
                    width: "100%",
                  }}
                >
                  <Avatar
                    size={38}
                    src={getEmployeeAvatarUrl(emp) || undefined}
                    style={{
                      background: emp.employeeColor ?? "var(--primary)",
                      fontSize: 13,
                      fontWeight: 700,
                      flexShrink: 0,
                    }}
                  >
                    {getInitials(emp.firstName, emp.lastName)}
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div
                      className="text-sm font-semibold truncate"
                      style={{ color: "var(--foreground)" }}
                    >
                      {emp.firstName} {emp.lastName}
                    </div>
                    <div className="text-xs truncate" style={{ color: "var(--muted-foreground)" }}>
                      {(et.roles as Record<string, string>)[emp.role] ?? emp.role}
                    </div>
                    <div className="mt-0.5">
                      <Tag
                        color={emp.status === "active" ? "success" : "default"}
                        style={{ fontSize: 10, padding: "0 4px", lineHeight: "16px" }}
                      >
                        {emp.status === "active" ? t.active : t.inactive}
                      </Tag>
                    </div>
                  </div>
                  <ChevronRight size={14} style={{ color: "var(--muted-foreground)", flexShrink: 0 }} />
                </button>
              );
            })
          )}
        </div>

        {/* Right detail */}
        <div
          className="flex-1 overflow-hidden rounded-xl"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            boxShadow: "var(--shadow)",
          }}
        >
          {selectedEmployee ? (
            <DetailPanel
              employee={selectedEmployee}
              stores={stores}
              onEdit={handleEdit}
              onDelete={handleDelete}
              t={t}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-sm" style={{ color: "var(--muted-foreground)" }}>
              {t.noData}
            </div>
          )}
        </div>
      </div>

      {/* ─── Add/Edit Modal ─── */}
      <EmployeeModal
        open={modalOpen}
        employee={editingEmployee}
        stores={stores}
        defaultStoreIds={selectedStoreId ? [selectedStoreId] : []}
        onSave={handleSave}
        onCancel={() => setModalOpen(false)}
        t={t}
        locale={locale}
      />
    </div>
  );
}
