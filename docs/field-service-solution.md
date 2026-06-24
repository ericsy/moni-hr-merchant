# MONI-HR 外勤（家政/上门服务）方案

> 版本：v1.0  
> 日期：2026-06-22  
> 状态：方案定稿（待评审 / 开发）

---

## 1. 背景与目标

### 1.1 现状

MONI-HR 当前面向 **固定门店** 场景（超市、餐厅等）：

- **排班**：门店 → 区域 → 周排班 / 模版
- **打卡**：门店经纬度 + 电子围栏（`geofenceRadius`）
- **员工 App**：按当日店班打卡

### 1.2 新需求

**家政 / 上门服务** 场景：

- 根据 **客户预约时间 + 地址** 安排员工
- 员工需在 **客户地址围栏内** 打卡
- 存在 **店班 + 外勤混合**：员工当日有门店排班，中间插入外勤任务

### 1.3 设计目标

| 目标 | 说明 |
|------|------|
| **模块隔离** | 门店排班与外勤派单在服务端、商家端按功能权限隔离，互不污染现有排班模型 |
| **底层共用** | 员工、组织、打卡引擎、请假/审批、异常检测共用 |
| **App 不混乱** | 员工端「今日」单一时间轴 + 单一主操作按钮，由服务端状态机驱动 |
| **派单时定规则** | 有店班时派外勤，由调度员选择是否同步店班上下班打卡，避免系统自动猜测 |

---

## 2. 总体架构

### 2.1 模块划分

```
                    ┌─────────────────────────┐
                    │      共用基础层          │
                    │  员工 / 门店组织 / 权限   │
                    │  请假审批 / 打卡引擎      │
                    │  设备指纹 / 代打卡检测    │
                    └───────────┬─────────────┘
                                │
              ┌─────────────────┴─────────────────┐
              ▼                                   ▼
    ┌─────────────────────┐           ┌─────────────────────┐
    │  门店排班模块         │           │  外勤工单模块         │
    │  store_roster       │           │  field_service        │
    │  ─────────────────  │           │  ─────────────────  │
    │  Area / Template    │           │  ServiceJob         │
    │  ScheduleShift      │           │  派单 / 地图调度      │
    │  区域周视图          │           │  客户地址围栏         │
    └──────────┬──────────┘           └──────────┬──────────┘
               │                                  │
               ▼                                  ▼
    refType: store_shift                 refType: field_job
    围栏: Store                          围栏: Job 地址
```

### 2.2 商家功能权限

按商家（Merchant）开通功能包，控制菜单与 API 访问：

| 功能码 | 名称 | 说明 |
|--------|------|------|
| `store_roster` | 门店排班 | 现有排班、模版、区域视图（默认已有） |
| `field_service` | 外勤工单 | 工单管理、派单、外勤调度视图 |

- 仅 `store_roster`：行为与现网一致
- 仅 `field_service`：纯外勤公司，无区域排班菜单
- 两者兼有：菜单分开展示，数据模型仍隔离

### 2.3 不改动原则

- **不扩展** `ScheduleShift` 外勤字段（不加 `jobId`、地址等到店班表）
- 店班与外勤通过 **派单关联表** + **打卡 `refType/refId`** 衔接
- 现有门店排班、模版、替班、发布流程 **零改动**

---

## 3. 数据模型

### 3.1 服务工单 `service_job`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 主键 |
| `merchantId` | string | 商家 |
| `storeId` | string | 归属门店/团队（权限、统计） |
| `customerName` | string | 客户姓名 |
| `customerPhone` | string | 客户电话 |
| `serviceAddress` | string | 服务地址（展示用） |
| `latitude` | number | 纬度 |
| `longitude` | number | 经度 |
| `geofenceRadius` | number | 打卡半径（米），建议 80–150 |
| `scheduledStart` | datetime | 预约开始 |
| `scheduledEnd` | datetime | 预约结束 |
| `serviceType` | string | 服务类型（保洁、维修等） |
| `status` | enum | `pending` / `assigned` / `in_progress` / `completed` / `cancelled` |
| `notes` | string | 备注 |

### 3.2 外勤派单 `service_job_assignment`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 主键 |
| `jobId` | string | 工单 ID |
| `merchantAdminId` | string | 员工 ID |
| `linkedStoreShiftId` | string? | 关联当日店班（有店班且重叠时填写） |
| `syncStoreClockIn` | boolean | 外勤上班是否同步店班上班 |
| `syncStoreClockOut` | boolean | 外勤下班是否同步店班下班 |
| `assignedAt` | datetime | 分配时间 |
| `assignedBy` | string | 分配人 |

**同步标记由派单时用户选择写入，App 与打卡服务只读执行。**

### 3.3 打卡记录扩展（共用 `clock_punch` 表）

在现有打卡记录上增加（或复用）：

| 字段 | 说明 |
|------|------|
| `refType` | `store_shift` \| `field_job` |
| `refId` | 店班 publishedCellId 或 jobId |
| `punchType` | `clock_in` / `clock_out`（外勤可扩展 `field_start` / `field_complete`，或映射为 in/out） |
| `latitude` / `longitude` | 打卡坐标 |
| `distanceMeters` | 距围栏中心距离 |
| `withinGeofence` | 是否在围栏内 |
| `linkedStoreShiftId` | 外勤打卡同步店班时关联 |
| `syncEffect` | `none` / `store_clock_in` / `store_clock_out` |

---

## 4. 商家端功能

### 4.1 外勤工单管理（`field_service`）

- 工单列表：待分配 / 已分配 / 进行中 / 已完成
- 地图视图：工单点位 + 员工位置（二期）
- 创建/编辑工单：地址选点复用 `GeoFenceMapPicker`
- 派单、改派、取消

### 4.2 派单流程（核心）

```
选择员工 → 检测当日店班 → 展示同步选项 → 校验 → 确认分配
```

#### 4.2.1 店班检测

派单时查询该员工当日 **已发布** 店班 `schedule_shift`，判断与外勤时间是否重叠：

```
重叠条件：
  job.scheduledStart < shift.end
  AND job.scheduledEnd > shift.start
```

#### 4.2.2 同步选项 UI

当 **有店班且时间重叠** 时，派单确认弹窗展示：

```
该员工今日有店班：08:00–16:00（XX 门店）
外勤时间：12:00–14:00（张女士家 · 保洁）

店班打卡同步：
☐ 外勤到岗时，同步记为门店上班
☐ 外勤完工时，同步记为门店下班

[取消]  [确认分配]
```

#### 4.2.3 默认勾选建议

| 场景 | 默认「同步上班」 | 默认「同步下班」 |
|------|:----------------:|:----------------:|
| 外勤开始时间 = 店班开始 | ✅ | — |
| 外勤结束时间 = 店班结束 | — | ✅ |
| 外勤插在店班中间 | ❌ | ❌ |
| 外勤时段覆盖全天店班 | ✅ | ✅ |

默认值可修改，**以用户最终选择为准**。

#### 4.2.4 派单校验规则

| 规则 | 说明 |
|------|------|
| R1 | 勾选「同步上班」时，外勤 `scheduledStart` 应 ≤ 店班开始时刻（或相等） |
| R2 | 勾选「同步下班」时，外勤 `scheduledEnd` 应 ≥ 店班结束时刻（或相等） |
| R3 | 两个都勾选时，外勤时段应覆盖或首尾对齐店班 |
| R4 | 同一员工、同一店班日，最多 **1 条** 派单可勾「同步上班」，最多 **1 条** 可勾「同步下班」 |
| R5 | 改派 / 改时间后重新校验，必要时要求用户重新确认同步选项 |

### 4.3 门店排班模块（`store_roster`）

保持现有能力，不做外勤相关改动。派单时只 **读取** 店班数据用于检测与关联。

---

## 5. 员工 App

### 5.1 页面结构

| 模块 | 说明 |
|------|------|
| **今日**（主入口） | 时间轴 + 当前操作按钮，90% 场景 |
| 门店排班 | 可选 Tab，仅 `store_roster` 或混合模式 |
| 我的工单 | 可选 Tab，仅 `field_service` |

**禁止**将「店班列表」与「工单列表」平铺在同一屏。

### 5.2 今日时间轴（展示层合并）

服务端返回 `timeline`，App 渲染为一条时间线：

```
今天 · 6月22日 周日

08:00–16:00  门店班 · XX 超市
  ├─ 12:00–14:00  外勤 · 张女士家保洁  [导航]
  └─ ...

──────── 当前 12:05 ────────
[ 开始服务 ]   ← 唯一主按钮
```

### 5.3 打卡状态机

服务端计算 `currentPunchAction`，App **同一时刻只展示一个主按钮**。

#### 5.3.1 动作类型

| currentPunchAction | 按钮文案（示例） | 围栏 |
|--------------------|------------------|------|
| `STORE_CLOCK_IN` | 到店上班 | 门店 |
| `FIELD_CLOCK_IN` | 开始服务 | 客户地址 |
| `FIELD_CLOCK_IN_SYNC_STORE` | 开始服务（计入今日上班） | 客户地址 |
| `FIELD_CLOCK_OUT` | 完成服务 | 客户地址 |
| `FIELD_CLOCK_OUT_SYNC_STORE` | 完成服务（今日下班） | 客户地址 |
| `STORE_CLOCK_OUT` | 离店下班 | 门店 |
| `WAITING` | 等待 / 倒计时提示 | — |
| `DONE` | 今日已完成 | — |

#### 5.3.2 标准流程：店班中间插入外勤（不同步）

店班 08:00–16:00，外勤 12:00–14:00，`syncStoreClockIn=false`，`syncStoreClockOut=false`：

```
08:00  STORE_CLOCK_IN     （门店围栏）
12:00  FIELD_CLOCK_IN     （客户围栏）
14:00  FIELD_CLOCK_OUT    （客户围栏）
16:00  STORE_CLOCK_OUT    （门店围栏）
```

**约束**：未打完外勤上下班前，不可打 `STORE_CLOCK_OUT`。

#### 5.3.3 外勤上班同步店班上班

`syncStoreClockIn=true`：

```
外勤 FIELD_CLOCK_IN 成功
  → 记 field_job 上班打卡
  → 自动记 store_shift 上班（syncEffect: store_clock_in）
  → App 不再展示「门店上班」
```

#### 5.3.4 外勤下班同步店班下班

`syncStoreClockOut=true`：

```
外勤 FIELD_CLOCK_OUT 成功
  → 记 field_job 下班打卡
  → 自动记 store_shift 下班（syncEffect: store_clock_out）
  → App 不再要求回店打「门店下班」
```

#### 5.3.5 全天外勤（两端同步）

`syncStoreClockIn=true` 且 `syncStoreClockOut=true`：

```
仅两张卡：外勤上班 → 外勤下班
店班上下班由同步自动带出
App 标题：「今日外勤（全天）」
```

#### 5.3.6 纯店班（无外勤）

与现网一致：

```
STORE_CLOCK_IN → STORE_CLOCK_OUT
```

#### 5.3.7 纯外勤（无店班）

```
FIELD_CLOCK_IN → FIELD_CLOCK_OUT
不出现门店打卡按钮
```

### 5.4 时间与围栏缓冲

| 规则 | 建议值 |
|------|--------|
| 外勤打卡提前窗口 | 预约开始前 15 分钟 |
| 外勤打卡延后窗口 | 预约结束后 30 分钟 |
| 围栏外 | 不允许打卡，提示前往正确地点 |
| 代打卡检测 | 复用现有设备 ID、GPS、共享设备逻辑 |

---

## 6. 服务端接口

### 6.1 商家端 — 外勤

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/merchant/field-jobs` | 工单列表 |
| POST | `/api/v1/merchant/field-jobs` | 创建工单 |
| PATCH | `/api/v1/merchant/field-jobs/{id}` | 更新工单 |
| POST | `/api/v1/merchant/field-jobs/{id}/assign` | 派单（含同步选项） |
| GET | `/api/v1/merchant/field-jobs/assign-preview` | 派单预览：店班检测 + 默认同步建议 |

**派单请求体示例：**

```json
{
  "merchantAdminId": "emp_001",
  "syncStoreClockIn": false,
  "syncStoreClockOut": false
}
```

**派单预览响应示例：**

```json
{
  "hasStoreShift": true,
  "storeShift": {
    "id": "cell_123",
    "storeName": "XX 超市",
    "start": "2026-06-22T08:00:00",
    "end": "2026-06-22T16:00:00"
  },
  "overlap": true,
  "suggestedSyncStoreClockIn": false,
  "suggestedSyncStoreClockOut": false,
  "validationWarnings": []
}
```

### 6.2 员工端 — 今日聚合（核心）

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/employee/today-work-summary` | 今日时间轴 + 当前打卡动作 |
| POST | `/api/v1/employee/punch` | 统一打卡 |

**today-work-summary 响应示例：**

```json
{
  "date": "2026-06-22",
  "timeline": [
    {
      "type": "store_shift",
      "id": "cell_123",
      "start": "08:00",
      "end": "16:00",
      "storeName": "XX 超市",
      "storeClockInAt": "08:02",
      "storeClockOutAt": null
    },
    {
      "type": "field_job",
      "id": "job_456",
      "start": "12:00",
      "end": "14:00",
      "customerName": "张女士",
      "serviceAddress": "上海市…",
      "latitude": 31.23,
      "longitude": 121.47,
      "geofenceRadius": 100,
      "syncStoreClockIn": false,
      "syncStoreClockOut": false,
      "fieldClockInAt": null,
      "fieldClockOutAt": null
    }
  ],
  "currentPunchAction": {
    "action": "FIELD_CLOCK_IN",
    "refType": "field_job",
    "refId": "job_456",
    "geofence": { "lat": 31.23, "lng": 121.47, "radius": 100 },
    "hint": "请在客户地址附近开始服务",
    "buttonLabel": "开始服务"
  },
  "dayStatus": "in_progress"
}
```

**打卡请求体示例：**

```json
{
  "refType": "field_job",
  "refId": "job_456",
  "punchType": "clock_in",
  "latitude": 31.2301,
  "longitude": 121.4702,
  "deviceId": "..."
}
```

**打卡服务逻辑（伪代码）：**

```
1. 加载 assignment / job / 关联店班
2. 校验 currentPunchAction 与请求一致
3. 计算距离，校验 withinGeofence
4. 写入 clock_punch（refType, refId）
5. 若 syncStoreClockIn && punchType=clock_in：
     写入 store_shift 上班打卡（syncEffect=store_clock_in）
6. 若 syncStoreClockOut && punchType=clock_out：
     写入 store_shift 下班打卡（syncEffect=store_clock_out）
7. 更新 job.status
8. 返回最新 today-work-summary
```

---

## 7. 状态机判定（服务端）

### 7.1 输入

- 当日店班列表（已发布）
- 当日外勤派单列表（含 sync 标记）
- 当日已有打卡记录

### 7.2 判定优先级

```
1. 若 dayStatus == DONE → DONE
2. 若未店班上班 且 无 syncStoreClockIn 的外勤待开始 → STORE_CLOCK_IN
3. 若外勤时段内 且 未外勤上班 → FIELD_CLOCK_IN（或 _SYNC_STORE 变体）
4. 若外勤上班已打 且 未外勤下班 → FIELD_CLOCK_OUT（或 _SYNC_STORE 变体）
5. 若外勤未完成（非同步下班场景）→ WAITING
6. 若店班已上班 且 外勤均完成 且 未店班下班 → STORE_CLOCK_OUT
7. 若 sync 已覆盖店班下班 → DONE
```

### 7.3 边界对齐处理

**不在运行时自动猜测**；完全依赖派单时的 `syncStoreClockIn` / `syncStoreClockOut`。

---

## 8. 实施阶段

| 阶段 | 范围 | 预估 |
|------|------|------|
| **P0** | `service_job` + 派单 API；派单预览与同步选项；员工 `today-work-summary` + 打卡状态机；App 今日页 | 3–4 周 |
| **P1** | 商家端工单管理页、地图视图、派单弹窗 UI | 2–3 周 |
| **P2** | 功能权限 `field_service`；纯外勤 / 混合商家配置 | 1 周 |
| **P3** | 智能派单推荐（距离、技能、冲突）；预约 API 对接 | 按需 |

### P0 交付清单

- [ ] 数据库：`service_job`、`service_job_assignment`、打卡表扩展
- [ ] 派单 API + 校验规则 R1–R5
- [ ] 派单预览 API（店班检测 + 默认同步建议）
- [ ] 员工 `today-work-summary` API
- [ ] 统一打卡 API（含 sync 联动）
- [ ] 员工 App：今日时间轴 + 单按钮打卡
- [ ] 商家端：派单弹窗（可先用现有员工/排班数据联调）

---

## 9. 场景速查表

| # | 店班 | 外勤 | 同步上班 | 同步下班 | App 打卡序列 |
|---|------|------|:--------:|:--------:|--------------|
| 1 | 8–16 | 无 | — | — | 门店上 → 门店下 |
| 2 | 8–16 | 12–14 插入 | ❌ | ❌ | 门店上 → 外勤上 → 外勤下 → 门店下 |
| 3 | 8–16 | 8–12 | ✅ | ❌ | 外勤上(同步门店上) → 外勤下 → 门店下 |
| 4 | 8–16 | 12–16 | ❌ | ✅ | 门店上 → 外勤上 → 外勤下(同步门店下) |
| 5 | 8–16 | 8–16 | ✅ | ✅ | 外勤上(同步上) → 外勤下(同步下) |
| 6 | 无 | 9–11 | — | — | 外勤上 → 外勤下 |

---

## 10. 风险与待定项

| 项 | 说明 | 建议 |
|----|------|------|
| 一单多人 | 同一工单派多名员工 | P0 先支持一人；多人时各记各的打卡 |
| 外勤取消 | 已同步店班上班后取消 | 需主管审批 + 回滚同步打卡 |
| 工单改址 | 服务中改地址 | 重算围栏；已打卡记录保留审计 |
| 薪资口径 | 店班工时 vs 外勤单量 | 与薪资模块单独对齐，本方案只保证考勤事实 |
| 历史兼容 | 现网纯店班商家 | 无 `field_service` 权限时零影响 |

---

## 11. 结论

本方案采用 **「模块隔离 + 派单时配置同步 + App 聚合状态机」** 三步策略：

1. **门店排班与外勤工单分模块**，不修改 `ScheduleShift` 结构  
2. **派外勤时检测店班**，由调度员选择 `syncStoreClockIn` / `syncStoreClockOut`  
3. **员工 App 只展示「今日时间轴 + 一个主按钮」**，服务端 `currentPunchAction` 驱动全流程  

该方案覆盖：中间插入外勤、首尾时间对齐、全天外勤、纯店班、纯外勤五类场景，且与现有门店围栏打卡能力兼容。

---

## 附录：名词对照

| 中文 | 英文 / 代码 |
|------|-------------|
| 店班 | store_shift / ScheduleShift (published) |
| 外勤 / 工单 | field_job / ServiceJob |
| 派单 | assignment / ServiceJobAssignment |
| 同步店班上班 | syncStoreClockIn |
| 同步店班下班 | syncStoreClockOut |
| 当前打卡动作 | currentPunchAction |
