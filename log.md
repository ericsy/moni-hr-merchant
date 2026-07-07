## 2026-07-07

- **外勤改派/更换服务人员假成功**：指派名单未变化时跳过 API 仍提示成功；现提示「服务人员未变更」。移除派单弹层会静默清空已选员工的 effect；合并当前工单已分配员工进下拉；派单前校验请假/外勤冲突；`merchantAdminId` 以数字提交。涉及：`fieldJobAssignment.ts`、`fieldJobEmployees.ts`、`FieldJobs.tsx`、`FieldJobAssignModal.tsx`、`merchantApi.ts`、`locales.ts`。

- **外勤工单 · 已分配仅可更换员工**：编辑已分配员工的外勤工单时，客户信息、地址、时间、围栏等字段只读，仅可更换服务人员及店班同步设置；保存时只调用分配接口，不更新工单详情。
  - **`FieldJobFormModal.tsx`**、**`FieldJobs.tsx`**、**`locales.ts`**、**`fieldService.ts`**。

- **时间选择改为小时/分钟小框输入**：店铺每周营业时间、外勤工单开始/结束时间不再使用滚动 TimePicker，改为点击后弹出小框，分别输入 24 小时制「时」「分」并确定写入。
  - **`src/components/HourMinuteTimePicker.tsx`**：新增共用组件；外勤分钟按 5 分钟步长对齐。
  - **`Stores.tsx`**、**`FieldJobFormModal.tsx`**：接入新组件；移除 **`AutoCloseTimePicker.tsx`**。

## 2026-07-06

- **员工创建/重置 App 密码（商家端）**：创建员工不再传密码，由后端随机 **8 位数字**并邮件发送、默认已激活；员工详情增加 **「重置 App 密码」**（`POST .../employees/{id}/reset-password`）。**`merchantApi.ts`**、**`Employees.tsx`**、**`locales.ts`**。

- **外勤服务类型改为手动输入**：创建/编辑外勤工单时「服务类型」由固定下拉（保洁/维修等）改为文本输入（最长 64 字）；后端与员工 App 已支持自由文本（App 对未知值原样展示）。**`FieldJobFormModal.tsx`**、**`locales.ts`**。

## 2026-07-05

- **外勤工单 · 服务时段校验**：开始时间必须早于结束时间；修改任一时间后立即标红并提示，提交时拦截无效时段。
  - **`FieldJobFormModal.tsx`**：新增 **`isValidServiceTimeRange`** 与实时 **`timeRangeError`**。

- **外勤工单 · 新建默认开始时间**：创建外勤工单时，开始时间默认为当前时间（按 5 分钟对齐），结束时间默认为开始时间 +2 小时。
  - **`FieldJobFormModal.tsx`**：新增 **`getDefaultFieldJobStartTime`** / **`getDefaultFieldJobTimes`**。

- **外勤工单 · 创建/编辑时间选择**：开始/结束时间改用 **`AutoCloseTimePicker`**，选完分钟即写入并关闭弹层，无需点确认。
  - **`src/components/AutoCloseTimePicker.tsx`**：从店铺管理抽出共用组件（`needConfirm={false}` + 选分钟自动关闭）。
  - **`FieldJobFormModal.tsx`**、**`Stores.tsx`**：接入共用组件。

## 2026-07-04

- **独立外勤请假详情**：不再展示「外勤影响与处置」区块；取消/改派处置直接放在原因下方（店班连带外勤仍用合并区块）。
- **外勤改派留底**：原接单人分配记录保留并标记离岗（`leave_approval`/`reassign`），不删数据；须执行后端迁移。
- **申请详情外勤服务类型中文**：服务类型走 `fieldJobs.serviceTypes`（如 `cleaning` →「保洁」），不再直接显示英文 code。
- **店班请假无外勤重叠时商家端误显外勤**：与 App 对齐，仅展示 `overlapType` 为 `full`/`partial` 的外勤影响；后端不再落库/返回与请假时段无重叠的 impact。
- **请假审批改派进行中外勤**：后端 `reassignForLeaveApproval` 允许进行中工单改派（先重置为已分配），修复商家端审批时报「进行中的工单不支持改派」。
- **申请管理 · 店班请假外勤影响与处置合并**：
  - **`AttendanceRequests.tsx`**：外勤影响与处置合并为「外勤影响与处置」卡片，展示客户、工单号、服务日期/时段、服务类型、重叠说明、同步店班；待审且须处置时在同一卡片内选择取消/改派。
  - **改派接单人无数据**：原先用申请根上的 `scheduleDate/shiftStartTime/shiftEndTime`（店班请假常为空）查候选人；改为按外勤 `scheduledStart/End`（`resolveFieldImpactScheduleWindow`）查询。
  - **`attendanceRequestDisplay.ts`**：新增 `resolveDisplayFieldImpacts`、`resolveFieldImpactScheduleWindow`；外勤请假快照补全日期时间。
  - **`locales.ts`**：合并区块与外勤信息相关中英文案。

## 2026-07-02

- **申请管理 · 详情门店显示名称**：`AttendanceRequests.tsx` 详情弹窗门店字段优先 `storeName`，否则从 `storeNameById` 解析，不再回退显示 `storeId`。

- **申请管理 · 外勤请假展示**：
  - **`src/lib/attendanceRequestDisplay.ts`**：新增 `isFieldLeaveRequest`、`fieldLeaveCustomerName`。
  - **`src/pages/AttendanceRequests.tsx`**：列表/详情展示外勤信息；外勤请假审批须选取消/改派，改派用候选人下拉。
  - **`src/i18n/locales.ts`**：`fieldLeaveDispositionHint`、`selectFieldAssignee` 等文案。

- **疑似代打卡移除新设备规则**：商家端概览去掉「新设备」统计；风险标签过滤 `new_device_id`。

- **商家端打卡记录展示任务类型**：
  - **`MerchantClockPunchVo`** / **`MerchantClockPunchService`**：返回 `refType`、`refId`、`syncEffect`、`customerName`（外勤批量补全客户名）。
  - **`src/lib/merchantApi.ts`**：类型与 `mapClockPunch` 映射新字段。
  - **`src/lib/punchTaskType.ts`**：任务类型解析（店班 / 外勤 / 外勤同步上下班）。
  - **`src/pages/ClockPunches.tsx`**：列表列与详情抽屉展示任务类型；外勤显示客户名。
  - **`src/i18n/locales.ts`**：相关中英文案。

- **外勤同步店班 1 小时窗口规则**（与后端 `FieldStoreSyncRules` 对齐）：
  - **`src/lib/fieldServiceAssign.ts`**：`canEnableSyncClockIn/Out`、`FIELD_STORE_SYNC_WINDOW_MINUTES`；`buildAssignPreview` / `validateAssignSyncOptions` 改用新规则。
  - **`FieldJobStoreSyncSection.tsx`**：超出窗口时 Checkbox 置灰并提示；提交前 `applyFieldJobStoreSyncForPreview` 过滤无效勾选。
  - **`FieldJobFormModal` / `FieldJobAssignModal`**：传入外勤时段用于窗口判断。
  - **`src/i18n/locales.ts`**：同步窗口说明文案。

## 2026-06-29

- **申请管理 · 按日期请假仅显示日期**：
  - **`src/lib/merchantApi.ts`**：`mapAttendanceRequest` 对 `leaveDateFrom`/`leaveDateTo`/`scheduleDate` 做 `normalizeApiLocalDate`；`resolveAttendanceLeaveMode` 与 App 一致（有起止日即按日期请假）；兼容 `leave_mode` snake_case。
  - **`src/pages/AttendanceRequests.tsx`**：列表摘要与详情弹窗用 `formatDateRangeLeave` 仅展示 `YYYY-MM-DD`，不显示时分；按班次请假的 `scheduleDate` 同样只显示日期。

- **外勤漏打卡 · 商家端申请管理**：
  - **`src/lib/merchantApi.ts`**：`MerchantAttendanceRequest` 增加 `fieldJobId`、`linkedStoreShiftId`、`syncStoreClockIn/Out`、`serviceAddress`、`areaName` 等字段映射。
  - **`src/lib/attendanceRequestDisplay.ts`**：外勤漏打卡识别与展示辅助函数。
  - **`src/pages/AttendanceRequests.tsx`**：列表类型标签区分「外勤漏打卡」；摘要展示客户/计划时段；详情展示客户、服务地址、计划时段、同步店班说明。
  - **`src/i18n/locales.ts`**：外勤漏打卡相关中英文案。

## 2026-06-26

- **排班编辑按环境区分当日是否可改**：**`src/lib/scheduleLock.ts`** + **`src/lib/appEnv.ts`**；**dev**（`VITE_APP_ENV=dev` 或 `pnpm dev`）允许编辑**当日**排班，**test/pro** 仍为仅明日及以后可编辑。环境变量见 **`.env.dev` / `.env.test` / `.env.production` / `.env.development`**。

- **外勤工单取消 1 小时间隔限制**：**`src/lib/employeeLeave.ts`** 中 **`fieldJobTimeWindowsConflict`** 仅检测时段重叠，不再要求同一员工相邻两单首尾间隔 ≥1 小时；**`locales.ts`** 相关提示文案已同步。

## 2026-06-24

- 更新 `src/lib/employeeApi.ts`：员工外勤接口路径从 `/api/v1/employee/today-work-summary`、`/api/v1/employee/punch` 对齐为 `/api/v1/app/today-work-summary`、`/api/v1/app/work/punch`，与后端 App 路由保持一致。

## 2026-06-29

- **外勤派单 · 同步店班打卡**：派单弹窗与新建/编辑工单表单支持勾选「外勤到岗同步门店上班」「外勤完工同步门店下班」；按员工店班与外勤时段重叠预览店班并校验 R1/R2；改派时保留已有同步配置；多人派单时同步默认关闭并提示仅选一名员工可配置。
  - **`FieldJobStoreSyncSection.tsx`**（预览 hook + 勾选 UI）、**`FieldJobAssignModal.tsx`**、**`FieldJobFormModal.tsx`**、**`fieldServiceAssign.ts`**（按时段重叠匹配店班）。

- **店铺管理 · 营业时间选择器**：选择具体时间后自动关闭弹层并写入表单，无需再点确认或点击外部关闭；选完「分钟」后立即收起（改小时时不关闭，便于继续选分钟）。
  - **`src/pages/Stores.tsx`**：新增 **`AutoCloseTimePicker`**（`needConfirm={false}` + 选值后关闭）。

- **员工管理 · 添加员工工作日默认与店铺营业时间一致**：新增员工时，工作日模式默认取自所选店铺（多选时取第一个）的每周营业时间；切换所属店铺时同步更新默认工作日与每日付薪工时。
  - **`src/lib/storeHours.ts`**：新增 **`workDayPatternFromStore`**、**`getDefaultWorkDayPatternForStores`**、**`getPrimaryPaidHoursFromWorkDayPattern`** 等工具函数。
  - **`src/pages/Employees.tsx`**：**`getEmptyEmployeeFormValues`** 与 **`EmployeeModal`** 新建流程接入上述逻辑；切换第一个所属店铺时，若用户未修改默认工作时间则跟随新店铺营业时间，已手动编辑则保留。

## 2026-06-24

- **跨商户兼职（方案 A）**：店长/副店长登录后 **`GET /merchant/me`** 返回跨商户 **`managedStores`**；门店下拉显示 **`商户名 / 门店名`**，切换门店时请求带 **`X-Store-Id`**（店主逻辑不变）。
  - **`src/lib/merchantApi.ts`**：新增 **`ManagedStoreBrief`**、**`mapMerchantPrincipal`**；**`merchantMe`/`authMe`** 走 mapper；员工 **`storeDetails`** 显示商户名。
  - **`src/context/DataContext.tsx`**：店长用 **`managedStores`** 构建门店切换列表（**`buildStoresForSwitcher`**）；**`Store`** 增加 **`merchantName`/`merchantId`**。

## 2026-05-27

- 更新 `AttendanceRequests.tsx`：在考勤申请审核（特别是带替班的请假）提交成功后，触发排班数据刷新，使从考勤审核返回排班管理页面时能看到最新的替班排班数据，无需手动 F5 刷新。

## 2026-05-28

- **排班页按日期请假提示**：此前「已请假」仅在有班次的员工 pill 上通过 `getAvailabilityWarning` 展示，左侧员工列表无提示。现对 **`employeeDateLeaves` 按当前门店过滤**，并在左侧员工卡片上：若**当前周**与某员工的按日期请假区间重叠，则红框 + **Tooltip** 说明（待审批/已批准）。**`Rosters.tsx`**；**`merchantApi`** 的 **`EmployeeDateLeave`** 补充 **`storeId`**。

- **排班请假数据与拖入提示**：后端 `MerchantScheduleService.wrapWithDateLeaves` 原先仅用已有格子日期区间查请假，与当前浏览周无交集时接口返回空 `employeeDateLeaves`，导致列表/格子均无提示。现改为「格子日期 ∪ 门店今天前 120 天～后 730 天」再查重叠请假。**`EmployeeDateLeaveVo`** 为请假起止日增加 **`@JSONField(format = "yyyy-MM-dd")`**。**`merchantApi.getSchedule`** 对请假日期做 **`normalizeApiLocalDate`** 并兼容 snake_case 字段。拖入已有班次时：按日期请假仅 **`toast.warning`** 仍允许加入；与周模板冲突等仍 **`toast.error`** 拦截。

- 更新 `Rosters.tsx`：如果当前门店某天为 **公共假期**（`selectedStore.publicHolidays` 命中），则在日历表头显示 **“公假/Holiday”** 标识，并将该日期整列背景色与普通日期/周末区分开。

- 更新 `Rosters.tsx`：将公共假期标识与星期文本放在同一行显示（更紧凑，便于快速识别）。

- 更新 `Rosters.tsx`、`RosterTemplate.tsx`：在“设置班次”弹层的员工选择下拉中，若员工已有排班/模版班次与当前弹层时间段冲突，则**不显示**该员工；并在时间变更后自动移除已选中的冲突员工。

- 更新 `Rosters.tsx`、`RosterTemplate.tsx`：调整日历班次卡片内容布局：**固定信息（班次名/时间/工时/操作）置顶**，**动态员工列表置底**，提升可读性。

- 更新 `Rosters.tsx`：将“替班”标识移动到班次名称右侧显示（从时间行挪至标题行）。

- 更新 `Rosters.tsx`、`RosterTemplate.tsx`：对调班次卡片中“班次名称”和“时间/工时”两行的位置：时间/工时置顶，班次名称下移，信息层级更清晰。

- 更新 `Rosters.tsx`、`RosterTemplate.tsx`：将班次卡片中的“添加员工/选择员工”按钮上移到员工列表上方，层级更直观。

- 更新 `Rosters.tsx`：排班管理中拖拽员工到班次时：**时间冲突直接拦截**；请假/可用性等仅 **warning 提示不阻断**；并改为打开同一编辑弹层预选该员工（与“添加员工”一致），不再直接写入排班数据。

- 更新 `Rosters.tsx`：调整为“拖拽员工到班次后**直接生效并保存到当前草稿数据**”，不再弹出弹层确认；仍保持 **时间冲突拦截**、其他提示仅 **warning**。

- 更新 `Rosters.tsx`：排班管理中 **替班班次（`isSubstitution`）锁定不可编辑**：隐藏编辑/删除按钮、隐藏添加员工按钮、禁止移除员工与拖拽修改。

- 更新 `Rosters.tsx`：应用排班模版时，同一模版格子内的多名员工合并为 **一条班次**（`employeeIds` 多人），不再按员工拆成多个班次卡片。

- 更新 `routes.tsx`、`Layout.tsx`、`EmployeeStats.tsx`：员工统计菜单与页面标题改为优先使用权限接口返回的 `nameZh`/`nameEn`；移除对员工统计等页面强制使用本地 `t.nav` 文案的特殊逻辑；Layout 顶部标题也统一从权限树解析。

- 更新 `Rosters.tsx`、`DataContext.tsx`：保存排班草稿时提交当前周 `overlayDates`，修复删除已发布班次后保存草稿、再次进入仍显示被删班次的问题。

- 更新 `Rosters.tsx`：发布按钮显示逻辑——当前门店存在可编辑草稿时显示；有未保存改动（dirty）时禁用并 Tooltip「请先保存后再发布」；保存/发布成功后同步基线视为已保存；切换门店或数据加载中重置基线。

- 修复 `Rosters.tsx`：新增班次保存后误报「已移除时间冲突员工」——原因为保存成功后新班次写入 `scheduleShifts` 而弹层 `employeeIds` 未清空，自动冲突检测误判；移除该自动移除 `useEffect`，关闭弹层时重置编辑状态。

## 2026-05-29

- **排班管理 / 排班模版：区域视图与员工视图切换（B 方案）**：新增 `src/lib/rosterGridIndex.ts`（按员工×日期索引班次/模版格子，不改接口）；`Rosters.tsx`、`RosterTemplate.tsx` 工具栏增加「区域 | 员工」切换（`localStorage` 记忆）；员工视图行主体为在职员工（沿用左侧搜索过滤），列仍为日期；班次卡片在员工视图显示区域名、隐藏员工列表；无员工班次显示「未分配」行；保存草稿/发布/模版保存仍写回同一套 `scheduleShifts` / `template.cells`。

## 2026-05-29

- 修复 `Stores.tsx` 店铺管理公共假期日历：月末最后一行不足 7 格时补空位，日期与上方星期列左对齐，不再整行居中（编辑与只读日历均已修复）。

- 更新 `Stores.tsx` 公共假期日历：已设置名称的假期在日期下方显示简称（过长截断），并保留鼠标悬浮 Tooltip 显示完整名称。

- 更新 `Stores.tsx` 公共假期日历：每个日期格内（日期 + 假期名）垂直居中对齐。

- 修复 `Stores.tsx` 公共假期日历列对齐：改用 `grid-cols-7` 统一星期表头与日期格布局，移除 flex + 外边距导致的列宽不一致；Tooltip 外层补全宽容器。

- **员工视图排班/模版优化**：`Rosters.tsx`、`RosterTemplate.tsx` 员工视图下添加/编辑班次使用精简弹层（班次+区域+颜色，日期/员工只读）；新增同 slot（区域+日期/星期+时间段+班次）写入时合并 `employeeIds` 为一条记录；区域视图新增多人也合并为一条；员工视图删除优先从班次移除当前员工（多人时保留班次）；`rosterGridIndex.ts` 增加 slot key 与合并工具函数。

## 2026-06-15

- 更新 `RosterTemplate.tsx` 排班模版员工视图：左侧列表仅展示尚未加入模版的员工（可拖拽到下方添加行）；右侧网格仅展示已在模版中的员工；员工被加入模版后自动从左侧列表移除；模版尚无排班员工时底部显示「从左侧拖入员工」占位行以接收拖拽。

- 更新排班模版员工视图拖拽逻辑：拖拽员工到模版**仅加入员工、不创建班次**；班次需在各员工行的「+」按钮单独编辑添加。新增模版级 `employeeIds` 字段（`DataContext`、`merchantApi`、`rosterGridIndex`）追踪成员；底部常驻拖入行；员工行支持 hover 移除出模版。

- 更新 `RosterTemplate.tsx` 员工视图拖拽范围：左侧员工可拖到模版表格**任意位置**（表头、员工行、日期格、班次格等）加入模版；拖到已有班次格时**不会**把员工加入该班次；`ShiftCell` 在员工视图下不再拦截拖放，由外层格子统一处理。

- 修复 `RosterTemplate.tsx` 员工视图拖拽失效：浏览器 `dragover` 阶段无法读取自定义 `employeeId` 类型，改为用 `dragEmpId` 状态判断；统一 `EmployeeCard` 设置拖放数据并移除嵌套 `draggable`；补全各日期格的 `onAddEmployeeToTemplate` 回调。

- 更新 `RosterTemplate.tsx` 员工视图行顺序：拖拽加入模版的员工按加入顺序**追加到表格最后一行**（不再按姓名 A-Z 排序）；`employeeIds` 维护成员顺序，`gridEmployees` 按该顺序渲染。

- 更新 `App.tsx`：全局 Sonner toast 自动消失时间由默认 4 秒改为 **2 秒**（`duration={2000}`）。

- 更新 `Rosters.tsx` 排班管理员工视图：与排班模版一致，左侧仅显示未加入排班表的员工，右侧网格仅显示已在排班表中的员工；拖拽加入排班表**不创建班次**，按加入顺序追加到最后一行；底部常驻拖入行；员工行 hover 可移出排班表；`rosterGridIndex.ts` 新增 `getWeekScheduleMemberEmployeeIds`。

- 更新 `RosterTemplate.tsx`、`Rosters.tsx`：个人视图下新增班次与现有班次合并时，不再提示「已合并到现有班次」，改为与普通保存一致（模版：「班次已保存」；排班管理：「已添加 N 名员工到班次」/「班次已更新」）。

- 修复 `RosterTemplate.tsx`、`Rosters.tsx` 个人视图合并班次编辑：修改某一员工的区域/班次时，从原班次拆出该员工并写入新 slot，不再连带修改同班次其他员工。

- 修复 `Rosters.tsx` 排班管理个人视图拖拽模版：拖入任意日期格/表头时，以该日期所在周的**周一**为模版锚点，模版 dayIndex 0→周一、1→周二……，不再把模版第 1 天偏移到拖放列。

- 更新 `Layout.tsx`：移除商家端右上角用户菜单中的「个人资料」入口。

- 更新 `Rosters.tsx` 排班管理个人视图：班次格内显示当前员工 chip，与区域视图一致展示请假（「假」）、替班（「替」）、工作时段不匹配（警告三角）标识及 Tooltip；复用 `findApprovedLeaveHint` 与 `findPatternAvailabilityWarning` 逻辑。

- 修复 `Rosters.tsx` 排班管理个人视图 chip：合并班次仅显示当前行员工自己的头像与姓名，不再展示同班次其他员工；替班/请假/工作时段不匹配仍通过 chip 标识。

- 更新 `Rosters.tsx` 排班管理个人视图：移除班次格内员工 chip；替班/请假/工作时段不匹配标识移至工作时长（Xh）badge 前，悬停 Tooltip 展示详情。

## 2026-06-22

- 更新 `RosterTemplate.tsx`、`Rosters.tsx`：排班模版与排班管理的班次列表（区域模式/员工模式）中，班次名称与时间改为固定主题色（`var(--foreground)` / `var(--muted-foreground)`），不再随班次背景色变化。

- 更新 `RosterTemplate.tsx`、`Rosters.tsx`：班次格内员工 chip 及员工模式状态 badge（替/假）文字字号各加大 2px（如 10→12、8→10）。

- 更新 `RosterTemplate.tsx`、`Rosters.tsx`：班次格内班次名称（10→12）与时间（9→11）字号各加大 2px。

- 更新 `RosterTemplate.tsx`、`Rosters.tsx`：班次格内时间文字由灰色（`var(--muted-foreground)`）改为主题黑色（`var(--foreground)`），与班次名称一致。

- 更新 `RosterTemplate.tsx`、`Rosters.tsx`：班次格内全部文字（班次名、时间、工时、员工 chip、状态 badge、区域名等）字号再加大 2px。

- 更新 `RosterTemplate.tsx`、`Rosters.tsx`：班次格内时间文字字号缩小 2px（13→11），时钟图标同步缩小。

- 更新 `RosterTemplate.tsx`：顶部模版时长选择由按钮组改为下拉列表（1–4 周预设选项），自定义天数整合至下拉面板底部。

- 更新 `RosterTemplate.tsx`：模版时长下拉面板中的自定义天数输入框加大（默认尺寸、宽度 120px、高度 36px），标签与按钮同步放大。

- 更新 `RosterTemplate.tsx`：自定义天数从下拉面板内移出，改为 Select 旁独立区域（标签 + 输入框 + 「应用」按钮），修复下拉宽度不足导致输入框与按钮被挤压的问题。

- 更新 `RosterTemplate.tsx`：自定义天数重新合并至模版时长下拉列表底部，设置 `popupMatchSelectWidth={false}` 与最小宽度 280px，并阻止点击输入区时关闭下拉。

- 更新 `RosterTemplate.tsx`：缩小模版时长下拉宽度（280→210/230px）并收紧内边距，减少右侧留白。

- 更新 `RosterTemplate.tsx`：模版表头在周几前增加「第 N 周」标识（如「第1周 周一」「第2周 周四」）。

- 更新 `RosterTemplate.tsx`：多周模版表头周次改为日历图标 badge（如「1周」/「W1」），悬停显示完整「第 N 周」；单周模版仅显示周几。

- 更新 `RosterTemplate.tsx`：中文周次 badge 文字由「1周」改为「第1周」。

- 修复 `Rosters.tsx` 排班管理个人视图：编辑多人共用班次时仅修改颜色等属性（slot 不变）会提前返回且不写入状态，导致背景色不更新；现改为原地更新班次属性并保留全部员工。
- 修复 `Rosters.tsx` 个人视图合并 slot 时同步写入颜色等班次属性。
- 同步修复 `RosterTemplate.tsx` 个人视图相同问题。

- 调整 `Rosters.tsx`、`RosterTemplate.tsx` 个人视图：多人共用班次仅改颜色/备注等时，从原班次拆出当前员工并单独保存，不影响同班次其他员工。

- 更新 `RosterTemplate.tsx`、`Rosters.tsx`：个人视图排班表左侧员工列文字加大 2px（姓名 14、角色/工时 11、表头/拖入提示 14、未分配 16）。

- 更新 `RosterTemplate.tsx`、`Rosters.tsx`：区域视图班次格内「添加员工/选择员工」文字固定为主题黑色（`var(--foreground)`），不再随班次背景色变化。

- 更新 `RosterTemplate.tsx`、`Rosters.tsx`：个人视图排班表员工列中岗位文字加大 2px（11→13）；排班管理周工时同步加大 2px（11→13）。

- 更新 `Rosters.tsx`：员工模式表头日期下方不再显示班次数量 badge。

- 更新 `RosterTemplate.tsx`、`Rosters.tsx`：班次格内异常提示图标（可用性警告、个人视图替/假标识）移至班次名称同一行；区域视图员工 chip 上不再重复显示警告三角图标。

- 新增 `Landing.tsx` 产品介绍主页（参考 RosterMate 风格）：未登录访问 `/` 展示功能介绍、流程与行业场景，右上角「登录」进入 `/login`。
- 更新 `App.tsx`：未登录路由拆分为首页与登录页；`Login.tsx` 增加返回首页链接。

- 更新 `Landing.tsx`：适用场景改为 6 张配图卡片（零售、餐饮、医疗、制造、活动、清洁），含场景描述与要点列表。

- 修复 `Landing.tsx`：活动与场馆、清洁与后勤配图外链 404，改为本地资源 `public/landing/events.jpg`、`public/landing/cleaning.jpg`。

- 更新 `Landing.tsx`：适用场景全部 6 张配图下载至 `public/landing/`（retail、hospitality、healthcare、manufacturing、events、cleaning），移除对 Unsplash 外链依赖。

- 新增 `public/moni-hr-logo.png`、`MoniHrLogo` 组件；替换产品介绍页、登录页、激活页、重置密码页及后台侧栏中的占位图标为 MONI-HR 官方 Logo，并更新站点 favicon。

- 调整 `Landing.tsx`：首页导航栏左上角 Logo 尺寸由 36px 增大至 48px。

- 调整 `Landing.tsx`：首页导航栏左上角 Logo 恢复为替换前占位图标尺寸（36px，`h-9 w-9`）。

- 调整 `Landing.tsx`：首页导航栏 Logo 放大至 72px，顶栏高度由 `h-16` 增至 `h-20`，以适配横向 Logo 在正方形容器内的实际显示尺寸。

- 优化 `Landing.tsx` 顶栏布局：改为三栏网格（左 Logo / 中导航 / 右操作），导航链接放入居中胶囊条，消除中间大块空白。

- 调整 `Landing.tsx`：页眉高度由 `h-20` 降至 `h-16`，Logo 同步由 72px 调整为 56px。

- 调整 `Landing.tsx`：首页 Logo 尺寸改为 60px。

- 调整 `Landing.tsx`：首页 Logo 尺寸改为 64px，与页眉高度 `h-16` 对齐。

- 调整 `Landing.tsx`：首页 Logo 尺寸改为 70px。

## 2026-06-22

- 新增 `docs/field-service-solution.md`：外勤（家政/上门服务）产品技术方案，含模块隔离、工单/派单模型、店班打卡同步配置、员工 App 状态机、API 与实施阶段。

- 实现外勤工单模块（商家端 P0/P1）：
  - 类型与工具：`src/types/fieldService.ts`、`fieldServiceAssign.ts`（派单预览/校验）、`fieldServicePunchState.ts`（打卡状态机）、`employeeApi.ts`（员工端今日聚合/打卡 API，路径 `/api/v1/app/*`）
  - API：`merchantEndpoints.fieldJobs`、`merchantApi` 工单 CRUD / 派单 / 派单预览
  - 页面：`FieldJobs.tsx`（列表、新建/编辑、派单弹窗含店班同步选项）
  - 组件：`FieldJobFormModal`、`FieldJobAssignModal`
  - 路由/菜单/i18n：`fieldJobs` 页面注册

- 服务端 `moni-hr` 外勤模块：
  - 数据库：`migrate-merchant_service_job.sql`、`migrate-merchant_employee_clock_punch-field_service.sql`
  - 实体/服务：`MerchantFieldJobService`、`AppTodayWorkService`
  - 接口：`/api/v1/merchant/field-jobs/*`、`GET /api/v1/app/today-work-summary`、`POST /api/v1/app/work/punch`
  - 店班打卡 `AppClockPunchService` 补充 `refType/refId` 以兼容新唯一索引

- 员工 App `moni-hr-app`：
  - 新增「今日」Tab（`today.tsx`）、时间轴与单一打卡按钮
  - API：`src/api/todayWork.ts`；默认入口改为 `/today`

- 修复 `FieldJobFormModal`：外勤时间改为「服务日期 + 开始/结束时间」同日选择；修复 RangePicker 修改时间后未写入表单导致提交不传 `scheduledStart/End` 的问题。

- 优化外勤工单地址：服务地址改用 `GoogleAddressAutocompleteInput`（输入联想）；粘贴/失焦立即定位；修复默认坐标误判为已定位导致粘贴不更新地图的问题。
- 外勤派单过滤请假员工：按天请假、整班次请假、班次内时段请假（晚到/早退）与外勤时段重叠时，不显示在选择列表中；新增 `employeeLeave.ts`。
- 外勤工单页去掉页面内重复标题与说明，与考勤/打卡等页面统一，仅保留 Layout 顶栏标题。
- 修复外勤工单表单开始/结束时间选择不生效：TimePicker 改为受控组件（与排班页一致），并在 `onChange` / `onCalendarChange` / `onOk` 同步；提交使用本地时间格式 `YYYY-MM-DDTHH:mm:ss`；API 同时发送 camelCase / snake_case 时间字段。
- 外勤工单页新增列表/日历双视图：顶部一周日期条，点选日期展示当日工单；日历模式前端按周过滤。
- 外勤日历视图：周范围与「上一周 / 今天 / 下一周」同一行，按钮靠右；下方为一周日期条。
- 外勤工单页默认视图为日历模式。

## 2026-06-22

- 外勤工单新建/编辑表单支持选择服务人员：与派单一致，按服务时段过滤请假员工（不显示在下拉框）；编辑时已分配员工若请假仍保留显示。
- 保存时若选择了员工，创建/更新后自动调用派单接口，工单状态变为「已分配」。
- 涉及：`FieldJobFormModal.tsx`、`FieldJobs.tsx`、`employeeLeave.ts`（`includeEmployeeId`）、`fieldService.ts`（`FieldJobFormSubmitPayload`）、`locales.ts`。

- 外勤员工筛选增加时间冲突规则：若员工已有外勤单与当前时段重叠，或首尾间隔不足 1 小时，则不显示在选择列表（派单与新建/编辑表单均生效）；编辑时排除当前工单自身。

- 外勤工单编辑/新建：修改服务时间后若已选员工请假或与已有外勤单冲突，表单顶部与员工字段显示明确错误提示，并阻止保存（不再静默清空员工或直接报「保存失败」）。

- 修复已派单工单编辑保存：员工未变时不再重复调用派单接口；换人时走 `reassign` 改派接口。列表/日历已派单按钮文案改为「改派」；错误提示展示后端返回的具体原因。

- 服务端 `moni-hr` 新增外勤改派：`POST /api/v1/merchant/field-jobs/{id}/reassign`，更新 `merchant_service_job_assignment` 的员工与店班同步配置；进行中/已完成/已取消工单不允许改派。

- 外勤工单支持多人执行：数据库去掉「一单一员工」唯一约束，改为 `(job_id, merchant_admin_id)` 唯一；API 返回 `assignments` 列表；新增 `POST /field-jobs/{id}/assignments/sync` 同步派单名单。商家端表单/派单弹窗改为多选员工，列表与日历展示多名员工。

## 2026-06-22

- 新增 Moni HR 员工 App 隐私政策页（App Store 提交用）：React 页面 `/privacy`、`/privacy-policy`（中英文切换）；静态备用 `public/privacy/index.html`；激活/重置密码页隐私链接指向该页；联系邮箱 `Jerry.d@gpos.co.nz`。

- 商家端登录：未激活账户不再跳转激活页，在登录页显示「账户尚未激活」提示；激活仍通过邮件链接 `/activate?token=...` 完成。

## 2026-07-07

- **外勤改派/更换服务人员假成功**：指派未变化时 `applyFieldJobAssignments` 跳过 API 仍 toast 成功；现未变更时提示「服务人员未变更」。移除派单弹层静默清空已选员工的 effect；`buildFieldJobEmployeeOptions` 合并当前工单已分配员工；派单前校验请假/外勤冲突；`merchantAdminId` 以数字提交。
- **修复改派已选员工但提交 assignments 为空**：Ant Design 多选可能回传 number，与选项 string id 严格相等失败导致选项被丢弃、表单 `merchantAdminIds` 为空，仅更新工单不调 `assignments/sync`，响应仍为 `status: pending`、`assignments: []`。现统一 `normalizeEmployeeAdminId(s)`；请假过滤保留已选员工用字符串比较；`syncFieldJobAssignments` 校验无效 id；派单提交前拦截空 assignments。`getValueFromEvent` 挂在 `Form.Item` 上（非 `Select`）；`ApiError` 参数顺序修正。

- **外勤员工下拉与排班对齐**：改用 `DataContext` 在职员工，不再依赖 `active-brief` 的已激活限制。


