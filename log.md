## 2026-05-27

- 更新 `AttendanceRequests.tsx`：在考勤申请审核（特别是带替班的请假）提交成功后，触发排班数据刷新，使从考勤审核返回排班管理页面时能看到最新的替班排班数据，无需手动 F5 刷新。

## 2026-05-28

- **排班页按日期请假提示**：此前「已请假」仅在有班次的员工 pill 上通过 `getAvailabilityWarning` 展示，左侧员工列表无提示。现对 **`employeeDateLeaves` 按当前门店过滤**，并在左侧员工卡片上：若**当前周**与某员工的按日期请假区间重叠，则红框 + **Tooltip** 说明（待审批/已批准）。**`Rosters.tsx`**；**`merchantApi`** 的 **`EmployeeDateLeave`** 补充 **`storeId`**。
