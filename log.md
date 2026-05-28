## 2026-05-27

- 更新 `AttendanceRequests.tsx`：在考勤申请审核（特别是带替班的请假）提交成功后，触发排班数据刷新，使从考勤审核返回排班管理页面时能看到最新的替班排班数据，无需手动 F5 刷新。

## 2026-05-28

- **排班页按日期请假提示**：此前「已请假」仅在有班次的员工 pill 上通过 `getAvailabilityWarning` 展示，左侧员工列表无提示。现对 **`employeeDateLeaves` 按当前门店过滤**，并在左侧员工卡片上：若**当前周**与某员工的按日期请假区间重叠，则红框 + **Tooltip** 说明（待审批/已批准）。**`Rosters.tsx`**；**`merchantApi`** 的 **`EmployeeDateLeave`** 补充 **`storeId`**。

- **排班请假数据与拖入提示**：后端 `MerchantScheduleService.wrapWithDateLeaves` 原先仅用已有格子日期区间查请假，与当前浏览周无交集时接口返回空 `employeeDateLeaves`，导致列表/格子均无提示。现改为「格子日期 ∪ 门店今天前 120 天～后 730 天」再查重叠请假。**`EmployeeDateLeaveVo`** 为请假起止日增加 **`@JSONField(format = "yyyy-MM-dd")`**。**`merchantApi.getSchedule`** 对请假日期做 **`normalizeApiLocalDate`** 并兼容 snake_case 字段。拖入已有班次时：按日期请假仅 **`toast.warning`** 仍允许加入；与周模板冲突等仍 **`toast.error`** 拦截。

- 更新 `Rosters.tsx`：如果当前门店某天为 **公共假期**（`selectedStore.publicHolidays` 命中），则在日历表头显示 **“公假/Holiday”** 标识，并将该日期整列背景色与普通日期/周末区分开。

- 更新 `Rosters.tsx`：将公共假期标识与星期文本放在同一行显示（更紧凑，便于快速识别）。

- 更新 `Rosters.tsx`、`RosterTemplate.tsx`：在“设置班次”弹层的员工选择下拉中，若员工已有排班/模版班次与当前弹层时间段冲突，则**不显示**该员工；并在时间变更后自动移除已选中的冲突员工。

- 更新 `Rosters.tsx`、`RosterTemplate.tsx`：调整日历班次卡片内容布局：**固定信息（班次名/时间/工时/操作）置顶**，**动态员工列表置底**，提升可读性。
