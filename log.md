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
