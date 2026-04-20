# MONI-HR 前端反向 API 接口文档

## 1. 文档说明

- 本文档根据当前前端代码反向整理，主要来源：
  - `src/context/DataContext.tsx`
  - `src/context/AuthContext.tsx`
  - `src/lib/shift.ts`
  - `src/pages/Employees.tsx`
  - `src/pages/Stores.tsx`
  - `src/pages/Areas.tsx`
  - `src/pages/Schedule.tsx`
  - `src/pages/RosterTemplate.tsx`
  - `src/pages/Rosters.tsx`
- 目标：供后端 AI 直接生成 DTO、Controller、Service、Repository、表结构和校验逻辑。
- 这不是现成后端契约，而是“基于当前前端使用方式推导出的推荐接口设计”。
- 如果后端希望快速落地，建议优先保证字段名和枚举值与前端现状一致，减少前端改动。

## 2. 全局约定

- Base URL：`/api/v1`
- 鉴权方式：建议 `Bearer Token` 或 `HttpOnly Session`
- 统一响应结构建议：

```ts
interface ApiResponse<T> {
  code: number; // 0 表示成功，其余为业务错误码
  message: string;
  data: T;
  requestId?: string;
}
```

- 当前前端列表页没有做分页，第一版后端可以直接返回全量数组。
- 如果后端要加分页，建议兼容以下结构：

```ts
interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}
```

- 日期格式：`YYYY-MM-DD`
- 时间格式：`HH:mm`
- 时区格式：IANA 时区字符串，例如 `Pacific/Auckland`
- 前端本地有一个特殊筛选值 `selectedStoreId === "all"`，这是 UI 状态，不建议入库；接口层应使用“缺省 storeId = 全部门店”的语义。

## 3. 核心数据模型

## 3.1 TypeScript 契约

```ts
type Country = "nz" | "au";
type EmployeeStatus = "active" | "inactive";
type StoreStatus = "enabled" | "disabled";
type ShiftStatus = "draft" | "published";
type ShiftType = "store" | "general";
type AreaType = "store" | "general";
type TemplateStatus = "enabled" | "disabled";
type WorkDayState = "on" | "off" | "none";

type TemplateConflictStrategy =
  | "overwrite_slot"
  | "merge_old"
  | "merge_new"
  | "replace_range";

interface WorkDayPattern {
  dayIndex: number; // 0=Mon, 1=Tue, ... 6=Sun
  state: WorkDayState;
  hours: number;
}

interface Employee {
  id: string;
  firstName: string;
  lastName: string;
  employeeId: string;
  role: string;
  phone: string;
  email: string;
  status: EmployeeStatus;
  startDate: string;
  storeIds: string[];
  assignedStores?: string[]; // 兼容字段，建议与 storeIds 保持一致
  hourlyRate: number;
  notes: string;
  avatar?: string;
  employeeColor?: string;
  address?: string;
  dateOfBirth?: string;
  irdNumber?: string;
  taxCode?: string;
  kiwiSaverStatus?: string;
  employeeContributionRate?: string;
  employerContributionRate?: string;
  esctRate?: string;
  bankAccountNumber?: string;
  payrollEmployeeId?: string;
  areaIds?: string[];
  positionIds?: string[];
  paidHoursPerDay?: number;
  workDayPattern?: WorkDayPattern[];
  contractType?: string;
  endDate?: string;
  contractedHours?: string;
  annualSalary?: string;
  defaultHourlyRate?: string;
}

interface Store {
  id: string;
  name: string;
  code: string;
  address: string;
  city: string;
  country: Country;
  phone: string;
  email: string;
  manager: string;
  openTime: string;
  closeTime: string;
  timezone: string;
  status: StoreStatus;
  latitude?: number;
  longitude?: number;
  geofenceRadius?: number;
}

interface Area {
  id: string;
  name: string;
  color: string;
  storeId: string; // general 区域可为空字符串或 null
  areaType?: AreaType; // 前端默认 store
  order: number;
}

interface ScheduleShift {
  id: string;
  employeeId: string; // 兼容旧字段，建议返回 employeeIds[0] 或空字符串
  employeeIds: string[];
  areaId: string;
  storeId: string;
  shiftType?: ShiftType;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  shiftName: string;
  color: string;
  note: string;
  status: ShiftStatus;
}

interface RosterTemplateCell {
  id: string;
  areaId: string;
  dayIndex: number;
  startTime: string;
  endTime: string;
  employeeIds: string[];
  color: string;
  label: string;
}

interface RosterTemplateShift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  color: string;
  days: number[];
}

interface RosterTemplate {
  id: string;
  name: string;
  storeId: string;
  totalDays: number;
  status?: TemplateStatus;
  cells: RosterTemplateCell[];
  shifts?: RosterTemplateShift[];
  areaIds: string[];
}

interface AuthUser {
  email: string;
  name: string;
}
```

## 3.2 关键枚举

- `Employee.role`
  - 当前前端已出现：`manager` `staff` `supervisor` `partTime` `casual`
- `Employee.contractType`
  - 当前前端已出现：`permanent` `fixed-term` `part-time` `casual`
- `Employee.kiwiSaverStatus`
  - 当前前端已出现：`Enrolled` `Non-enrolled` `Opted Out` `Exempt`
- `Store.country`
  - `nz` `au`
- `Store.status`
  - `enabled` `disabled`
- `Area.areaType`
  - `store` `general`
- `ScheduleShift.status`
  - `draft` `published`
- `ScheduleShift.shiftType`
  - `store` `general`
- `RosterTemplate.status`
  - `enabled` `disabled`
- 颜色字段
  - 当前前端常用：`blue` `green` `purple` `orange` `red`
  - 同时允许十六进制颜色，例如 `#60a5fa`

## 3.3 当前前端的兼容字段说明

- `Employee.storeIds` 和 `Employee.assignedStores`
  - 当前前端编辑保存时会把这两个字段写成一样的数组。
  - 后端建议第一版都返回，后续可逐步收敛到一个字段。
- `ScheduleShift.employeeId` 和 `ScheduleShift.employeeIds`
  - 当前前端已经以 `employeeIds` 为主。
  - `employeeId` 仍被保留为兼容字段，建议后端返回 `employeeIds[0] ?? ""`。
- `ScheduleShift.areaId`
  - 在 `Schedule.tsx` 中，班次卡片是“独立班次”，`areaId` 可以为空字符串。
  - 在 `Rosters.tsx` 中，排班网格场景 `areaId` 必须有值。

## 4. 接口设计

## 4.1 Auth

### POST `/auth/login`

用途：

- 登录
- 如果账户未激活，前端需要进入激活流程

请求体：

```json
{
  "email": "admin@moni-hr.com",
  "password": "admin123"
}
```

响应体建议：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "success": true,
    "status": "authenticated",
    "token": "jwt-or-session-token",
    "user": {
      "email": "admin@moni-hr.com",
      "name": "Admin"
    }
  }
}
```

未激活账户响应建议：

```json
{
  "code": 0,
  "message": "needs activation",
  "data": {
    "success": true,
    "status": "needs_activation",
    "user": {
      "email": "new@moni-hr.com",
      "name": "New User"
    }
  }
}
```

### POST `/auth/activate`

用途：

- 首次激活账号
- 设置密码并直接登录

请求体：

```json
{
  "email": "new@moni-hr.com",
  "password": "Abc12345",
  "confirmPassword": "Abc12345"
}
```

返回：

```json
{
  "code": 0,
  "message": "activated",
  "data": {
    "success": true,
    "status": "authenticated",
    "token": "jwt-or-session-token",
    "user": {
      "email": "new@moni-hr.com",
      "name": "New User"
    }
  }
}
```

### GET `/auth/me`

用途：

- 页面刷新后恢复登录态

### POST `/auth/logout`

用途：

- 退出登录

## 4.2 Dashboard

当前前端只展示：

- 有效员工数
- 启用门店数
- 最近员工列表
- 门店概览

可选接口：

### GET `/dashboard/summary`

响应体建议：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "activeEmployeeCount": 5,
    "enabledStoreCount": 3,
    "recentEmployees": [],
    "storeOverview": []
  }
}
```

说明：

- 这部分也可以由 `employees + stores` 两个列表在前端自行聚合。
- 如果后端要快速落地，此接口不是必须。

## 4.3 基础字典数据

### GET `/meta/positions`

用途：

- 员工岗位下拉框

响应体建议：

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    { "id": "pos1", "name": "Cashier" },
    { "id": "pos2", "name": "Team Lead" },
    { "id": "pos3", "name": "Stock Controller" }
  ]
}
```

### GET `/meta/enums`

可选，用于下发：

- 员工角色
- 合同类型
- KiwiSaver 选项
- 支持时区
- 支持颜色

## 4.4 门店 Stores

### GET `/stores`

查询参数建议：

- `keyword`：按 `name/city/code` 搜索
- `country`：`nz|au`
- `status`：`enabled|disabled`

响应：

```json
{
  "code": 0,
  "message": "ok",
  "data": [
    {
      "id": "s1",
      "name": "Auckland CBD",
      "code": "AKL01",
      "address": "123 Queen Street",
      "city": "Auckland",
      "country": "nz",
      "phone": "+64 9 123 4567",
      "email": "auckland@example.com",
      "manager": "Emily Chen",
      "openTime": "08:00",
      "closeTime": "22:00",
      "timezone": "Pacific/Auckland",
      "status": "enabled",
      "latitude": -36.8485,
      "longitude": 174.7633,
      "geofenceRadius": 200
    }
  ]
}
```

### GET `/stores/{id}`

### POST `/stores`

请求体：

```json
{
  "name": "Auckland CBD",
  "code": "AKL01",
  "address": "123 Queen Street",
  "city": "Auckland",
  "country": "nz",
  "phone": "+64 9 123 4567",
  "email": "auckland@example.com",
  "manager": "Emily Chen",
  "openTime": "08:00",
  "closeTime": "22:00",
  "timezone": "Pacific/Auckland",
  "status": "enabled",
  "latitude": -36.8485,
  "longitude": 174.7633,
  "geofenceRadius": 200
}
```

### PATCH `/stores/{id}`

### DELETE `/stores/{id}`

建议校验：

- `name` 必填
- `code` 必填且唯一
- `country` 必填
- `timezone` 必填
- `status` 必填

建议可选增强：

- 删除门店时，如果仍被员工/区域/模版/排班引用，后端可以拒绝删除

## 4.5 区域 Areas

### GET `/areas`

查询参数建议：

- `keyword`
- `storeId`
- `includeGeneral=true|false`
- `areaType=store|general`

说明：

- 前端在门店筛选时，会同时显示：
  - 当前门店区域
  - `areaType=general` 的通用区域

### GET `/areas/{id}`

### POST `/areas`

请求体：

```json
{
  "name": "前台收银",
  "color": "blue",
  "storeId": "s1",
  "areaType": "store",
  "order": 0
}
```

通用区域示例：

```json
{
  "name": "全局支援",
  "color": "green",
  "storeId": "",
  "areaType": "general",
  "order": 0
}
```

### PATCH `/areas/{id}`

### DELETE `/areas/{id}`

删除限制：

- 如果区域被以下任何对象引用，前端当前逻辑不允许删除：
  - 员工 `employee.areaIds`
  - 模版 `rosterTemplate.areaIds`
  - 排班 `scheduleShift.areaId`

建议错误码：

- `AREA_REFERENCED`
- `AREA_DUPLICATE_NAME`

唯一性规则：

- 同一作用域内名称唯一
- 作用域定义：
  - `general` 区域共享一个全局作用域
  - `store` 区域按 `storeId` 分作用域

### POST `/areas/resequence`

可选接口，用于保存排序：

```json
{
  "scopeType": "store",
  "storeId": "s1",
  "items": [
    { "id": "area1", "order": 0 },
    { "id": "area2", "order": 1 }
  ]
}
```

说明：

- 当前 UI 还没有拖拽排序，但数据模型里有 `order`，后端最好支持。

## 4.6 员工 Employees

### GET `/employees`

查询参数建议：

- `keyword`
- `status=active|inactive`
- `storeId`
- `areaId`

前端当前筛选逻辑：

- 搜索字段：姓名、邮箱、员工编号
- 可按门店筛选
- 可按状态筛选

### GET `/employees/{id}`

### POST `/employees`

请求体示例：

```json
{
  "firstName": "Emily",
  "lastName": "Chen",
  "employeeId": "EMP001",
  "role": "manager",
  "phone": "+64 21 123 4567",
  "email": "emily.chen@example.com",
  "status": "active",
  "startDate": "2022-03-01",
  "storeIds": ["s1", "s2"],
  "assignedStores": ["s1", "s2"],
  "hourlyRate": 28,
  "notes": "Store manager for Auckland branch",
  "employeeColor": "#60a5fa",
  "address": "123 Queen Street, Auckland",
  "dateOfBirth": "1990-05-12",
  "irdNumber": "123-456-789",
  "taxCode": "M",
  "kiwiSaverStatus": "Enrolled",
  "employeeContributionRate": "3%",
  "employerContributionRate": "3",
  "esctRate": "10.5",
  "bankAccountNumber": "12-3456-7890123-00",
  "payrollEmployeeId": "PAY001",
  "areaIds": ["area1", "area4"],
  "positionIds": ["pos1", "pos2"],
  "paidHoursPerDay": 7.5,
  "workDayPattern": [
    { "dayIndex": 0, "state": "on", "hours": 7.5 },
    { "dayIndex": 1, "state": "on", "hours": 7.5 }
  ],
  "contractType": "permanent",
  "endDate": "",
  "contractedHours": "37.5",
  "annualSalary": "55000",
  "defaultHourlyRate": "28"
}
```

### PATCH `/employees/{id}`

### DELETE `/employees/{id}`

建议校验：

- `firstName` 必填
- `lastName` 必填
- `email` 格式校验
- `storeIds`、`areaIds`、`positionIds` 为数组
- `workDayPattern` 应包含 0~6 共 7 天配置

## 4.7 排班模板 Roster Templates

### GET `/roster-templates`

查询参数建议：

- `storeId`
- `status=enabled|disabled`
- `keyword`

### GET `/roster-templates/{id}`

建议直接返回完整模板：

```json
{
  "id": "rt1",
  "name": "标准周排班",
  "storeId": "s1",
  "totalDays": 7,
  "status": "enabled",
  "areaIds": ["area1", "area2"],
  "cells": [
    {
      "id": "rt1-c1",
      "areaId": "area1",
      "dayIndex": 0,
      "startTime": "08:00",
      "endTime": "16:00",
      "employeeIds": ["e1"],
      "color": "blue",
      "label": "早班"
    }
  ]
}
```

### POST `/roster-templates`

请求体：

```json
{
  "name": "新排班模版 1",
  "storeId": "s1",
  "totalDays": 7,
  "status": "enabled",
  "areaIds": ["area1"],
  "cells": []
}
```

### PATCH `/roster-templates/{id}`

用于修改：

- `name`
- `storeId`
- `totalDays`
- `status`
- `areaIds`

### DELETE `/roster-templates/{id}`

说明：

- 当前 UI 未提供删除模板入口，但后端建议保留。

### POST `/roster-templates/{id}/areas`

用途：

- 给模板挂接区域

请求体：

```json
{
  "areaId": "area3"
}
```

### DELETE `/roster-templates/{id}/areas/{areaId}`

说明：

- 删除模板区域时，应同时删除该区域下的模板单元格 `cells`

### POST `/roster-templates/{id}/cells`

请求体：

```json
{
  "areaId": "area1",
  "dayIndex": 0,
  "startTime": "08:00",
  "endTime": "16:00",
  "employeeIds": ["e1", "e2"],
  "color": "blue",
  "label": "早班"
}
```

### PATCH `/roster-templates/{id}/cells/{cellId}`

### DELETE `/roster-templates/{id}/cells/{cellId}`

模板单元格业务规则：

- 同一员工在同一个模板周期内不能有时间冲突
- 冲突检测要支持跨夜班次
- `dayIndex` 允许大于 6，表示多周模板

## 4.8 班次 Schedule Shifts

当前前端复用了同一个 `ScheduleShift` 资源，存在两种用法：

- `Schedule.tsx`
  - 作为“独立班次卡片”
  - 不绑定员工和区域也能创建
- `Rosters.tsx`
  - 作为“周排班网格内班次”
  - 需要绑定 `storeId + areaId + date + employeeIds`

### GET `/schedule-shifts`

查询参数建议：

- `storeId`
- `areaId`
- `employeeId`
- `status`
- `date`
- `dateFrom`
- `dateTo`
- `shiftType`

### GET `/schedule-shifts/{id}`

### POST `/schedule-shifts`

推荐请求体：

```json
{
  "employeeIds": ["e1"],
  "areaId": "area1",
  "storeId": "s1",
  "shiftType": "store",
  "date": "2026-04-20",
  "startTime": "08:00",
  "endTime": "16:00",
  "breakMinutes": 30,
  "shiftName": "早班",
  "color": "blue",
  "note": "来自模版: 标准周排班",
  "status": "draft"
}
```

兼容要求：

- 响应中建议补回 `employeeId`
- 取值为 `employeeIds[0] ?? ""`

### PATCH `/schedule-shifts/{id}`

### DELETE `/schedule-shifts/{id}`

### POST `/schedule-shifts/batch`

用途：

- 批量新增班次
- 批量更新班次
- 批量删除班次

建议请求体：

```json
{
  "create": [],
  "update": [],
  "deleteIds": []
}
```

### POST `/schedule-shifts/publish`

用途：

- 发布某一天的草稿班次
- 发布某一周的草稿班次
- 也可以按指定 ID 发布

建议请求体：

```json
{
  "storeId": "s1",
  "scopeType": "week",
  "date": null,
  "weekStart": "2026-04-20",
  "weekEnd": "2026-04-26",
  "ids": []
}
```

### POST `/schedule-shifts/delete-by-scope`

用途：

- 删除某一天某门店下的全部班次

请求体：

```json
{
  "storeId": "s1",
  "date": "2026-04-20"
}
```

建议错误码：

- `SHIFT_EMPLOYEE_CONFLICT`
- `SHIFT_AREA_REQUIRED`
- `SHIFT_STORE_REQUIRED`

## 4.9 周排班工作流 Roster Workflow

这部分是当前项目最值得后端承接的逻辑，因为前端已经有完整的冲突计算和覆盖策略。

### GET `/rosters/weekly`

用途：

- 一次性拉取周排班页所需数据

查询参数：

- `storeId`
- `weekStart`

建议响应体：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "weekStart": "2026-04-20",
    "weekEnd": "2026-04-26",
    "areas": [],
    "employees": [],
    "templates": [],
    "shifts": [],
    "draftCount": 0
  }
}
```

说明：

- 如果不想做聚合接口，也可以分别调用：
  - `/areas`
  - `/employees`
  - `/roster-templates`
  - `/schedule-shifts`

### POST `/rosters/template-apply-preview`

用途：

- 在真正写入排班前，先返回冲突分析结果
- 这与当前前端里的 `TemplateApplyPlan` 一一对应

请求体：

```json
{
  "templateId": "rt5",
  "startDate": "2026-04-20",
  "targetAreaId": null,
  "storeId": "s1"
}
```

建议响应体：

```ts
interface TemplateCandidateShift {
  candidateKey: string;
  slotKey: string; // `${areaId}::${date}`
  employeeId: string;
  employeeIds: string[];
  areaId: string;
  storeId: string;
  shiftType: "store" | "general";
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  shiftName: string;
  color: string;
  note: string;
}

interface TemplateApplyPreview {
  templateId: string;
  templateName: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  storeId: string;
  coveredAreaIds: string[];
  coveredDates: string[];
  touchedSlotKeys: string[];
  occupiedSlotKeys: string[];
  rangeExistingShiftIds: string[];
  overlapExistingShiftIds: string[];
  candidateShifts: TemplateCandidateShift[];
}
```

### POST `/rosters/template-apply`

用途：

- 按指定策略把模板写入实际排班

请求体：

```json
{
  "templateId": "rt5",
  "startDate": "2026-04-20",
  "targetAreaId": null,
  "storeId": "s1",
  "strategy": "merge_old"
}
```

建议响应体：

```json
{
  "code": 0,
  "message": "ok",
  "data": {
    "added": 12,
    "removed": 3,
    "skipped": 2,
    "templateName": "四周循环排班"
  }
}
```

### POST `/rosters/weekly/publish`

用途：

- 发布一周内所有草稿班次

请求体：

```json
{
  "storeId": "s1",
  "weekStart": "2026-04-20",
  "weekEnd": "2026-04-26"
}
```

## 5. 关键业务规则

## 5.1 班次冲突检测

规则来源：`src/lib/shift.ts`

- 如果 `endTime <= startTime`，表示跨夜班次，结束时间自动加一天
- 员工冲突判断：
  - 同一员工的两个班次时间区间有重叠，则冲突
- 模板单元格冲突判断：
  - 同一员工在同一模板周期内，任意两个模板班次重叠，则冲突

建议后端统一实现以下能力：

- `datedShiftsOverlap`
- `indexedShiftsOverlap`
- 支持跨夜班次

## 5.2 模板应用冲突策略

### `overwrite_slot`

- 仅清理“模板自身命中的格子”
- 格子定义：`areaId + date`
- 其他区域/日期数据保留

### `merge_old`

- 老数据优先
- 只往空白格写新模板
- 已占用格子直接跳过

### `merge_new`

- 新数据优先，但只替换“直接冲突”的旧班次
- 不会清空整个范围

### `replace_range`

- 清空模板覆盖周期内、覆盖区域内的旧班次
- 再按照模板重新生成

## 5.3 区域删除限制

- 区域被员工、模板或班次引用时不允许删除

## 5.4 区域命名唯一性

- `general` 区域在全局作用域内唯一
- `store` 区域在同一 `storeId` 下唯一

## 5.5 模板可选区域

- 当前模板可关联：
  - `areaType=general` 的区域
  - 当前模板所属门店 `storeId` 的区域

## 5.6 模板可选员工

- 只展示 `status=active` 的员工

## 5.7 班次发布规则

- 当前 UI 只会把 `status=draft` 改成 `status=published`
- 已发布班次可继续编辑，但编辑后前端通常会重新写回 `draft`

## 5.8 独立班次与网格排班共用一个资源

这一点必须提醒后端 AI：

- `Schedule.tsx` 的班次卡片不依赖区域和员工
- `Rosters.tsx` 的周排班依赖区域和员工
- 第一版接口建议继续复用 `schedule_shifts`
- 后续如果业务变复杂，可拆分为：
  - `shift_presets`
  - `roster_shifts`

## 6. 建议错误码

```ts
type ErrorCode =
  | "INVALID_CREDENTIALS"
  | "ACCOUNT_NEEDS_ACTIVATION"
  | "PASSWORD_TOO_SHORT"
  | "PASSWORD_CONFIRM_MISMATCH"
  | "STORE_NOT_FOUND"
  | "AREA_NOT_FOUND"
  | "AREA_REFERENCED"
  | "AREA_DUPLICATE_NAME"
  | "EMPLOYEE_NOT_FOUND"
  | "TEMPLATE_NOT_FOUND"
  | "TEMPLATE_AREA_NOT_VISIBLE"
  | "SHIFT_NOT_FOUND"
  | "SHIFT_EMPLOYEE_CONFLICT"
  | "SHIFT_STORE_REQUIRED"
  | "TEMPLATE_CONFLICT_FOUND";
```

## 7. 推荐落地顺序

1. `auth`
2. `stores`
3. `areas`
4. `employees`
5. `roster-templates`
6. `schedule-shifts`
7. `rosters/template-apply-preview`
8. `rosters/template-apply`
9. `dashboard/summary`

## 8. 给后端 AI 的实现提示

- 优先保证返回字段名与前端当前接口文档一致，不要擅自重命名。
- `employeeId`、`assignedStores` 这类兼容字段第一版保留，避免前端同步改动。
- 时间冲突逻辑不要只按同一天判断，必须支持跨夜。
- `storeId=""` 的 `general area` 场景不要漏掉。
- 模板应用建议先做 preview，再做 apply。
- 如果要做数据库设计，建议至少拆成以下实体：
  - `users`
  - `stores`
  - `areas`
  - `employees`
  - `employee_store_rel`
  - `employee_area_rel`
  - `employee_position_rel`
  - `roster_templates`
  - `roster_template_cells`
  - `schedule_shifts`
  - `schedule_shift_employees`

