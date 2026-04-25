# 商家端 API 梳理

来源：https://xzqfdfx6nx.apifox.cn/（Apifox 公开文档，projectId 8177166，latest 分支 7936336）

> 说明：本文档根据最新公开 Apifox 文档自动整理，未使用项目内 `docs.zip`。当前前端代码仍以 mock/localStorage 为主，尚未实际调用这些后端接口。

## 全局约定

- 文档未配置明确服务域名，接口路径按相对路径接入。
- 鉴权：Bearer Token。请求头：`Authorization: Bearer <token>`。
- 多数门店上下文接口需要请求头：`X-Store-Id`。
- 统一响应大多为 `ApiResultXxx`：`code`、`message`、`data`。

## 当前项目对接重点

- `src/context/AuthContext.tsx` 当前是 mock 登录，需替换为 `MerchantAuth` 的登录、激活、退出、当前用户接口。
- `src/context/DataContext.tsx` 当前从 localStorage 读写员工、门店、班次、区域、模板，需要改为按页面调用下方业务接口。
- 全局门店筛选应同步到 `X-Store-Id`；`selectedStoreId === "all"` 是前端状态，不能直接作为门店 ID 传给后端。
- 前端现有 `ScheduleShift` 与文档里的 `GlobalShift`、`ScheduleDraftCellItem`、`MerchantScheduleCellItem` 字段不完全相同，排班页接入时需要做适配层。

## 接口总览

### Health

| 方法 | 路径 | 名称 | 请求 | 响应 |
|---|---|---|---|---|
| GET | `/api/health` | Health check | - | 200: object |

### MerchantAuth

| 方法 | 路径 | 名称 | 请求 | 响应 |
|---|---|---|---|---|
| GET | `/api/v1/merchant/me` | 当前商户管理员会话 | - | 200: ApiResultMerchantMe |
| POST | `/api/v1/merchant/auth/login` | 商户端登录 | body: MerchantLoginRequest* | 200: ApiResultMerchantLoginResult |
| POST | `/api/v1/merchant/auth/activate` | 商户端激活并设置密码 | body: MerchantActivateRequest* | 200: ApiResultEmpty |
| POST | `/api/v1/merchant/auth/logout` | 商户端注销 | - | 200: ApiResultEmpty |
| GET | `/api/v1/merchant/auth/me` | 商户端当前登录信息 | - | 200: ApiResultMerchantAuthPrincipal |
| GET | `/api/v1/merchant/auth/permissions-tree` | 当前商户套餐功能权限树 | - | 200: ApiResultMerchantFeatureTree |

### Countries

| 方法 | 路径 | 名称 | 请求 | 响应 |
|---|---|---|---|---|
| GET | `/api/v1/merchant/countries` | 启用的国家/地区列表（商户） | - | 200: ApiResultCountryOptionList |

### MerchantStores

| 方法 | 路径 | 名称 | 请求 | 响应 |
|---|---|---|---|---|
| GET | `/api/v1/merchant/stores` | 当前商户门店列表 | - | 200: ApiResultMerchantStoreList |
| POST | `/api/v1/merchant/stores` | 创建门店 | body: MerchantStoreCreateRequest* | 201: ApiResultMerchantStore |
| GET | `/api/v1/merchant/stores/{id}` | 门店详情 | path: id* | 200: ApiResultMerchantStore |
| PATCH | `/api/v1/merchant/stores/{id}` | 更新门店（部分字段） | path: id*<br>body: MerchantStorePatchRequest* | 200: ApiResultMerchantStore |
| DELETE | `/api/v1/merchant/stores/{id}` | 删除门店 | path: id* | 200: ApiResultMerchantStoreDeleteResult |

### MerchantGlobalShifts

| 方法 | 路径 | 名称 | 请求 | 响应 |
|---|---|---|---|---|
| GET | `/api/v1/merchant/global-shifts` | 班次列表（按门店上下文） | header: X-Store-Id* | 200: ApiResultGlobalShiftList |
| POST | `/api/v1/merchant/global-shifts` | 创建班次 | body: GlobalShiftCreateRequest* | 201: ApiResultGlobalShift |
| PATCH | `/api/v1/merchant/global-shifts/{id}` | 更新班次（部分字段） | path: id*<br>body: GlobalShiftPatchRequest* | 200: ApiResultGlobalShift |
| DELETE | `/api/v1/merchant/global-shifts/{id}` | 删除班次 | path: id* | 200: ApiResultGlobalShiftDeleteResult |

### MerchantScheduleAreas

| 方法 | 路径 | 名称 | 请求 | 响应 |
|---|---|---|---|---|
| GET | `/api/v1/merchant/schedule-areas` | 排班区域列表（按门店上下文） | header: X-Store-Id* | 200: ApiResultScheduleAreaList |
| POST | `/api/v1/merchant/schedule-areas` | 创建排班区域 | header: X-Store-Id<br>body: ScheduleAreaCreateRequest* | 201: ApiResultScheduleArea |
| PATCH | `/api/v1/merchant/schedule-areas/{id}` | 更新排班区域（部分字段） | path: id*<br>body: ScheduleAreaPatchRequest* | 200: ApiResultScheduleArea |
| DELETE | `/api/v1/merchant/schedule-areas/{id}` | 删除排班区域 | path: id* | 200: ApiResultScheduleAreaDeleteResult |

### MerchantEmployees

| 方法 | 路径 | 名称 | 请求 | 响应 |
|---|---|---|---|---|
| GET | `/api/v1/merchant/employees` | 员工分页列表 | query: page, size, status, q<br>header: X-Store-Id* | 200: ApiResultMerchantEmployeePage |
| POST | `/api/v1/merchant/employees` | 创建员工（merchant_admin admin_type=2 + merchant_employee_profile） | body: EmployeeCreateRequest* | 201: ApiResultEmployee |
| GET | `/api/v1/merchant/employees/{id}` | 员工详情 | path: id* | 200: ApiResultEmployee |
| PATCH | `/api/v1/merchant/employees/{id}` | 更新员工 | path: id*<br>body: EmployeePatchRequest* | 200: ApiResultEmployee |
| DELETE | `/api/v1/merchant/employees/{id}` | 删除员工（软删 admin + profile，清理门店关联） | path: id* | 200: ApiResultEmployeeDeleteResult |

### MerchantEmployeeDict

| 方法 | 路径 | 名称 | 请求 | 响应 |
|---|---|---|---|---|
| GET | `/api/v1/merchant/work-areas` | 工作区域字典（areaIds） | - | 200: ApiResultWorkAreaDictList |
| GET | `/api/v1/merchant/positions` | 岗位字典（positionIds） | - | 200: ApiResultPositionDictList |

### MerchantScheduleTemplates

| 方法 | 路径 | 名称 | 请求 | 响应 |
|---|---|---|---|---|
| GET | `/api/v1/merchant/schedule-templates` | 排班模版列表 | header: X-Store-Id* | 200: ApiResultScheduleTemplateList |
| POST | `/api/v1/merchant/schedule-templates` | 创建排班模版 | header: X-Store-Id*<br>body: ScheduleTemplateCreateRequest* | 201: ApiResultScheduleTemplateDetail |
| GET | `/api/v1/merchant/schedule-templates/{id}` | 排班模版详情 | path: id* | 200: ApiResultScheduleTemplateDetail |
| PATCH | `/api/v1/merchant/schedule-templates/{id}` | 更新排班模版（可仅改 name / totalDays / status，或替换 areas、cells） | path: id*<br>body: ScheduleTemplatePatchRequest* | 200: ApiResultScheduleTemplateDetail |
| DELETE | `/api/v1/merchant/schedule-templates/{id}` | 删除排班模版 | path: id* | 200: ApiResultEmpty |

### MerchantSchedule

| 方法 | 路径 | 名称 | 请求 | 响应 |
|---|---|---|---|---|
| GET | `/api/v1/merchant/schedule` | 排班查询（草稿优先，否则已发布） | header: X-Store-Id* | 200: ApiResultMerchantScheduleQuery |
| PUT | `/api/v1/merchant/schedule/draft` | 保存排班草稿（整单替换） | header: X-Store-Id*<br>body: ScheduleDraftSaveRequest* | 200: ApiResultEmpty |
| POST | `/api/v1/merchant/schedule/publish` | 发布排班（草稿→已发布并删草稿） | header: X-Store-Id* | 200: ApiResultEmpty |

### MerchantBilling

| 方法 | 路径 | 名称 | 请求 | 响应 |
|---|---|---|---|---|
| POST | `/api/v1/merchant/billing/subscribe` | Stripe 按月订阅（首次购买） | body: BillingSubscribeRequest* | 200: ApiResultMerchantCheckoutSession |
| POST | `/api/v1/merchant/billing/add-quantity` | 追加订阅数量（加购） | body: BillingAddQuantityRequest* | 200: ApiResultMerchantSubscription |
| GET | `/api/v1/merchant/billing/subscription` | 当前订阅信息 | - | 200: ApiResultMerchantSubscription |
| GET | `/api/v1/merchant/billing/invoices` | Stripe 订阅账单列表（Invoice，本地快照） | query: limit, startingAfter, status | 200: ApiResultMerchantInvoiceList |
| POST | `/api/v1/merchant/billing/stripe/webhook` | Stripe Webhook（回调） | body: object* | 200: ApiResultEmpty |

## 接口详情

### Health

#### GET `/api/health` Health check

- Apifox：https://xzqfdfx6nx.apifox.cn/449373306e0
- Response：
  - 200 application/json：object

### MerchantAuth

#### GET `/api/v1/merchant/me` 当前商户管理员会话

- Apifox：https://xzqfdfx6nx.apifox.cn/449373307e0
- Response：
  - 200 application/json：ApiResultMerchantMe

#### POST `/api/v1/merchant/auth/login` 商户端登录

- Apifox：https://xzqfdfx6nx.apifox.cn/449373308e0
- Body：application/json，必填，schema：MerchantLoginRequest

请求示例：
```json
{
    "email": "string",
    "password": "string"
}
```
- Response：
  - 200 application/json：ApiResultMerchantLoginResult

#### POST `/api/v1/merchant/auth/activate` 商户端激活并设置密码

- Apifox：https://xzqfdfx6nx.apifox.cn/449373309e0
- Body：application/json，必填，schema：MerchantActivateRequest

请求示例：
```json
{
    "token": "string",
    "newPassword": "string"
}
```
- Response：
  - 200 application/json：ApiResultEmpty

#### POST `/api/v1/merchant/auth/logout` 商户端注销

- Apifox：https://xzqfdfx6nx.apifox.cn/449373310e0
- Response：
  - 200 application/json：ApiResultEmpty

#### GET `/api/v1/merchant/auth/me` 商户端当前登录信息

- Apifox：https://xzqfdfx6nx.apifox.cn/449373311e0
- Response：
  - 200 application/json：ApiResultMerchantAuthPrincipal

#### GET `/api/v1/merchant/auth/permissions-tree` 当前商户套餐功能权限树

- Apifox：https://xzqfdfx6nx.apifox.cn/449373312e0
- 说明：根据 merchant.plan_id 与 saas_plan_feature 关联的 merchant_feature，补齐祖先节点；仅纳入套餐内且 status=1 的功能作为叶子来源。
- Response：
  - 200 application/json：ApiResultMerchantFeatureTree

### Countries

#### GET `/api/v1/merchant/countries` 启用的国家/地区列表（商户）

- Apifox：https://xzqfdfx6nx.apifox.cn/449373313e0
- Response：
  - 200 application/json：ApiResultCountryOptionList

### MerchantStores

#### GET `/api/v1/merchant/stores` 当前商户门店列表

- Apifox：https://xzqfdfx6nx.apifox.cn/449373314e0
- Response：
  - 200 application/json：ApiResultMerchantStoreList

#### POST `/api/v1/merchant/stores` 创建门店

- Apifox：https://xzqfdfx6nx.apifox.cn/449373315e0
- Body：application/json，必填，schema：MerchantStoreCreateRequest

请求示例：
```json
{
    "name": "string",
    "code": "string",
    "address": "string",
    "city": "string",
    "country": "string",
    "phone": "string",
    "email": "string",
    "manager": "string",
    "openTime": "string",
    "closeTime": "string",
    "timezone": "string",
    "status": "string",
    "latitude": 0,
    "longitude": 0,
    "geofenceRadius": 0
}
```
- Response：
  - 201 application/json：ApiResultMerchantStore

#### GET `/api/v1/merchant/stores/{id}` 门店详情

- Apifox：https://xzqfdfx6nx.apifox.cn/449373316e0
- Path：id*: integer(int64)
- Response：
  - 200 application/json：ApiResultMerchantStore

#### PATCH `/api/v1/merchant/stores/{id}` 更新门店（部分字段）

- Apifox：https://xzqfdfx6nx.apifox.cn/449373317e0
- Path：id*: integer(int64)
- Body：application/json，必填，schema：MerchantStorePatchRequest

请求示例：
```json
{
    "name": "string",
    "code": "string",
    "address": "string",
    "city": "string",
    "country": "string",
    "phone": "string",
    "email": "string",
    "manager": "string",
    "openTime": "string",
    "closeTime": "string",
    "timezone": "string",
    "status": "string",
    "latitude": 0,
    "longitude": 0,
    "geofenceRadius": 0
}
```
- Response：
  - 200 application/json：ApiResultMerchantStore

#### DELETE `/api/v1/merchant/stores/{id}` 删除门店

- Apifox：https://xzqfdfx6nx.apifox.cn/449373318e0
- Path：id*: integer(int64)
- Response：
  - 200 application/json：ApiResultMerchantStoreDeleteResult

### MerchantGlobalShifts

#### GET `/api/v1/merchant/global-shifts` 班次列表（按门店上下文）

- Apifox：https://xzqfdfx6nx.apifox.cn/449373319e0
- 说明：须携带 **X-Store-Id**：`all` 返回当前商户下全部班次；具体门店 id 返回该店专属班次 + 全商户通用班次（响应中 storeId 为 `all` 表示通用）。 
- Header：X-Store-Id*: string (`all` 或门店 id（数字字符串）)
- Response：
  - 200 application/json：ApiResultGlobalShiftList

#### POST `/api/v1/merchant/global-shifts` 创建班次

- Apifox：https://xzqfdfx6nx.apifox.cn/449373320e0
- Body：application/json，必填，schema：GlobalShiftCreateRequest

请求示例：
```json
{
    "name": "string",
    "startTime": "string",
    "endTime": "string",
    "breakMinutes": 0,
    "color": "string",
    "days": "string",
    "storeId": "string"
}
```
- Response：
  - 201 application/json：ApiResultGlobalShift

#### PATCH `/api/v1/merchant/global-shifts/{id}` 更新班次（部分字段）

- Apifox：https://xzqfdfx6nx.apifox.cn/449373321e0
- Path：id*: integer(int64)
- Body：application/json，必填，schema：GlobalShiftPatchRequest

请求示例：
```json
{
    "name": "string",
    "startTime": "string",
    "endTime": "string",
    "breakMinutes": 0,
    "color": "string",
    "days": "string",
    "storeId": "string"
}
```
- Response：
  - 200 application/json：ApiResultGlobalShift

#### DELETE `/api/v1/merchant/global-shifts/{id}` 删除班次

- Apifox：https://xzqfdfx6nx.apifox.cn/449373322e0
- Path：id*: integer(int64)
- Response：
  - 200 application/json：ApiResultGlobalShiftDeleteResult

### MerchantScheduleAreas

#### GET `/api/v1/merchant/schedule-areas` 排班区域列表（按门店上下文）

- Apifox：https://xzqfdfx6nx.apifox.cn/449373323e0
- 说明：须携带 **X-Store-Id**：`all` 返回当前商户下全部区域；具体门店 id 返回该店专属 + 全商户通用区域。按 **order** 升序。 
- Header：X-Store-Id*: string (`all` 或门店 id（数字字符串）)
- Response：
  - 200 application/json：ApiResultScheduleAreaList

#### POST `/api/v1/merchant/schedule-areas` 创建排班区域

- Apifox：https://xzqfdfx6nx.apifox.cn/449373324e0
- 说明：请求体可省略 **storeId**，此时按 **X-Store-Id** 推导：`all` 为全商户通用；数字为对应门店。若请求体显式传 **storeId** 则以请求体为准。须至少具备 **X-Store-Id** 或 **storeId** 之一可确定归属（创建时若两者均无法确定则 400）。 
- Header：X-Store-Id: string
- Body：application/json，必填，schema：ScheduleAreaCreateRequest

请求示例：
```json
{
    "name": "string",
    "color": "string",
    "order": 0,
    "storeId": "string"
}
```
- Response：
  - 201 application/json：ApiResultScheduleArea

#### PATCH `/api/v1/merchant/schedule-areas/{id}` 更新排班区域（部分字段）

- Apifox：https://xzqfdfx6nx.apifox.cn/449373325e0
- Path：id*: integer(int64)
- Body：application/json，必填，schema：ScheduleAreaPatchRequest

请求示例：
```json
{
    "name": "string",
    "color": "string",
    "order": 0,
    "storeId": "string"
}
```
- Response：
  - 200 application/json：ApiResultScheduleArea

#### DELETE `/api/v1/merchant/schedule-areas/{id}` 删除排班区域

- Apifox：https://xzqfdfx6nx.apifox.cn/449373326e0
- Path：id*: integer(int64)
- Response：
  - 200 application/json：ApiResultScheduleAreaDeleteResult

### MerchantEmployees

#### GET `/api/v1/merchant/employees` 员工分页列表

- Apifox：https://xzqfdfx6nx.apifox.cn/449373327e0
- Query：page: integer<br>size: integer<br>status: string enum(active | inactive)<br>q: string (姓名/工号/email 模糊)
- Header：X-Store-Id*: string
- Response：
  - 200 application/json：ApiResultMerchantEmployeePage

#### POST `/api/v1/merchant/employees` 创建员工（merchant_admin admin_type=2 + merchant_employee_profile）

- Apifox：https://xzqfdfx6nx.apifox.cn/449373328e0
- Body：application/json，必填，schema：EmployeeCreateRequest

请求示例：
```json
{
    "firstName": "string",
    "lastName": "string",
    "employeeId": "string",
    "role": "string",
    "phone": "string",
    "email": "string",
    "password": "stringst",
    "status": "string",
    "startDate": "string",
    "storeIds": [
        0
    ],
    "hourlyRate": 0,
    "notes": "string",
    "avatar": "string",
    "employeeColor": "string",
    "address": "string",
    "dateOfBirth": "string",
    "irdNumber": "string",
    "taxCode": "string",
    "kiwiSaverStatus": "string",
    "employeeContributionRate": "string",
    "employerContributionRate": "string",
    "esctRate": "string",
    "bankAccountNumber": "string",
    "payrollEmployeeId": "string",
    "paidHoursPerDay": 0,
    "workDayPattern": [
        {
            "dayIndex": 0,
            "state": true,
            "hours": 0
        }
    ],
    "contractType": "string",
    "endDate": "string",
    "con
...
```
- Response：
  - 201 application/json：ApiResultEmployee

#### GET `/api/v1/merchant/employees/{id}` 员工详情

- Apifox：https://xzqfdfx6nx.apifox.cn/449373329e0
- Path：id*: integer(int64)
- Response：
  - 200 application/json：ApiResultEmployee

#### PATCH `/api/v1/merchant/employees/{id}` 更新员工

- Apifox：https://xzqfdfx6nx.apifox.cn/449373330e0
- Path：id*: integer(int64)
- Body：application/json，必填，schema：EmployeePatchRequest

请求示例：
```json
{
    "firstName": "string",
    "lastName": "string",
    "employeeId": "string",
    "role": "string",
    "phone": "string",
    "email": "string",
    "password": "stringst",
    "status": "string",
    "startDate": "string",
    "storeIds": [
        0
    ],
    "hourlyRate": 0,
    "notes": "string",
    "avatar": "string",
    "employeeColor": "string",
    "address": "string",
    "dateOfBirth": "string",
    "irdNumber": "string",
    "taxCode": "string",
    "kiwiSaverStatus": "string",
    "employeeContributionRate": "string",
    "employerContributionRate": "string",
    "esctRate": "string",
    "bankAccountNumber": "string",
    "payrollEmployeeId": "string",
    "paidHoursPerDay": 0,
    "workDayPattern": [
        {
            "dayIndex": 0,
            "state": true,
            "hours": 0
        }
    ],
    "contractType": "string",
    "endDate": "string",
    "con
...
```
- Response：
  - 200 application/json：ApiResultEmployee

#### DELETE `/api/v1/merchant/employees/{id}` 删除员工（软删 admin + profile，清理门店关联）

- Apifox：https://xzqfdfx6nx.apifox.cn/449373331e0
- Path：id*: integer(int64)
- Response：
  - 200 application/json：ApiResultEmployeeDeleteResult

### MerchantEmployeeDict

#### GET `/api/v1/merchant/work-areas` 工作区域字典（areaIds）

- Apifox：https://xzqfdfx6nx.apifox.cn/449373332e0
- Response：
  - 200 application/json：ApiResultWorkAreaDictList

#### GET `/api/v1/merchant/positions` 岗位字典（positionIds）

- Apifox：https://xzqfdfx6nx.apifox.cn/449373333e0
- Response：
  - 200 application/json：ApiResultPositionDictList

### MerchantScheduleTemplates

#### GET `/api/v1/merchant/schedule-templates` 排班模版列表

- Apifox：https://xzqfdfx6nx.apifox.cn/449373334e0
- 说明：须 **X-Store-Id**：`all` 为当前商户全部模版；门店 id 返回 `store_id` 为空（全商户）或等于该店的模版。
- Header：X-Store-Id*: string
- Response：
  - 200 application/json：ApiResultScheduleTemplateList

#### POST `/api/v1/merchant/schedule-templates` 创建排班模版

- Apifox：https://xzqfdfx6nx.apifox.cn/449373335e0
- Header：X-Store-Id*: string (`all` 为全商户模版（`store_id` 空）；数字为门店专属)
- Body：application/json，必填，schema：ScheduleTemplateCreateRequest

请求示例：
```json
{
    "name": "string",
    "totalDays": 0,
    "areas": [
        {
            "id": 0,
            "orderSort": 0
        }
    ],
    "cells": [
        {
            "areaId": 0,
            "shiftsId": 0,
            "weekDay": 0,
            "startTime": "string",
            "endTime": "string",
            "employeeIds": [
                0
            ],
            "color": "string"
        }
    ]
}
```
- Response：
  - 201 application/json：ApiResultScheduleTemplateDetail

#### GET `/api/v1/merchant/schedule-templates/{id}` 排班模版详情

- Apifox：https://xzqfdfx6nx.apifox.cn/449373336e0
- Path：id*: integer(int64)
- Response：
  - 200 application/json：ApiResultScheduleTemplateDetail

#### PATCH `/api/v1/merchant/schedule-templates/{id}` 更新排班模版（可仅改 name / totalDays / status，或替换 areas、cells）

- Apifox：https://xzqfdfx6nx.apifox.cn/449373337e0
- Path：id*: integer(int64)
- Body：application/json，必填，schema：ScheduleTemplatePatchRequest

请求示例：
```json
{
    "name": "string",
    "totalDays": 0,
    "status": 0,
    "areas": [
        {
            "id": 0,
            "orderSort": 0
        }
    ],
    "cells": [
        {
            "areaId": 0,
            "shiftsId": 0,
            "weekDay": 0,
            "startTime": "string",
            "endTime": "string",
            "employeeIds": [
                0
            ],
            "color": "string"
        }
    ]
}
```
- Response：
  - 200 application/json：ApiResultScheduleTemplateDetail

#### DELETE `/api/v1/merchant/schedule-templates/{id}` 删除排班模版

- Apifox：https://xzqfdfx6nx.apifox.cn/449373338e0
- Path：id*: integer(int64)
- Response：
  - 200 application/json：ApiResultEmpty

### MerchantSchedule

#### GET `/api/v1/merchant/schedule` 排班查询（草稿优先，否则已发布）

- Apifox：https://xzqfdfx6nx.apifox.cn/449373339e0
- 说明：须 **X-Store-Id** 为**具体门店 id**（不支持 `all`）。
- Header：X-Store-Id*: string
- Response：
  - 200 application/json：ApiResultMerchantScheduleQuery

#### PUT `/api/v1/merchant/schedule/draft` 保存排班草稿（整单替换）

- Apifox：https://xzqfdfx6nx.apifox.cn/449373340e0
- Header：X-Store-Id*: string (具体门店 id)
- Body：application/json，必填，schema：ScheduleDraftSaveRequest

请求示例：
```json
{
    "areas": [
        {
            "id": 0,
            "orderSort": 0
        }
    ],
    "cells": [
        {
            "areaId": 0,
            "shiftId": 0,
            "date_str": "2019-08-24",
            "startTime": "string",
            "endTime": "string",
            "employeesIds": [
                0
            ],
            "color": "string"
        }
    ]
}
```
- Response：
  - 200 application/json：ApiResultEmpty

#### POST `/api/v1/merchant/schedule/publish` 发布排班（草稿→已发布并删草稿）

- Apifox：https://xzqfdfx6nx.apifox.cn/449373341e0
- Header：X-Store-Id*: string (具体门店 id)
- Response：
  - 200 application/json：ApiResultEmpty

### MerchantBilling

#### POST `/api/v1/merchant/billing/subscribe` Stripe 按月订阅（首次购买）

- Apifox：https://xzqfdfx6nx.apifox.cn/449373342e0
- 说明：返回 Stripe Checkout URL。首次购买数量需 >= 套餐 minQuantity。需配置 `saas_plan_stripe_price`。
- Body：application/json，必填，schema：BillingSubscribeRequest

请求示例：
```json
{
    "planId": 0,
    "quantity": 0
}
```
- Response：
  - 200 application/json：ApiResultMerchantCheckoutSession

#### POST `/api/v1/merchant/billing/add-quantity` 追加订阅数量（加购）

- Apifox：https://xzqfdfx6nx.apifox.cn/449373343e0
- 说明：仅支持 addQuantity>0（增加），会产生 proration。
- Body：application/json，必填，schema：BillingAddQuantityRequest

请求示例：
```json
{
    "addQuantity": 0
}
```
- Response：
  - 200 application/json：ApiResultMerchantSubscription

#### GET `/api/v1/merchant/billing/subscription` 当前订阅信息

- Apifox：https://xzqfdfx6nx.apifox.cn/449373344e0
- Response：
  - 200 application/json：ApiResultMerchantSubscription

#### GET `/api/v1/merchant/billing/invoices` Stripe 订阅账单列表（Invoice，本地快照）

- Apifox：https://xzqfdfx6nx.apifox.cn/449373345e0
- 说明：读本地表 `merchant_stripe_invoice`（由 Stripe Webhook 的 `invoice.*` 事件写入/更新），**不调用 Stripe API**。 金额字段为 Stripe 最小货币单位。`startingAfter` 填上一页返回的 `nextStartingAfter`。 须在 Stripe Dashboard 为 Webhook 勾选相关 `invoice.*` 事件。 
- Query：limit: integer<br>startingAfter: string (上一页最后一条 invoice 的 id（如 in_xxx）)<br>status: string enum(draft | open | paid | uncollectible | void) (按账单状态过滤；不传则返回全部状态)
- Response：
  - 200 application/json：ApiResultMerchantInvoiceList

#### POST `/api/v1/merchant/billing/stripe/webhook` Stripe Webhook（回调）

- Apifox：https://xzqfdfx6nx.apifox.cn/449373346e0
- Body：application/json，必填，schema：object

请求示例：
```json
{}
```
- Response：
  - 200 application/json：ApiResultEmpty

## 数据模型

### ApiResultCountryOptionList

- Schema ID：268425390

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | CountryOption[] | 否 | - |

### ApiResultEmployee

- Schema ID：268425343

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | Employee | 否 | - |

### ApiResultEmployeeDeleteResult

- Schema ID：268425347

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | EmployeeDeletePayload | 否 | - |

### ApiResultEmpty

- Schema ID：268425416

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | object \| null | 否 | Often null on delete success |

### ApiResultGlobalShift

- Schema ID：268425384

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | GlobalShift | 否 | - |

### ApiResultGlobalShiftDeleteResult

- Schema ID：268425388

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | GlobalShiftDeletePayload | 否 | - |

### ApiResultGlobalShiftList

- Schema ID：268425383

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | GlobalShiftList | 否 | - |

### ApiResultMerchantAuthPrincipal

- Schema ID：268425321

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | MerchantAuthPrincipal | 否 | - |

### ApiResultMerchantCheckoutSession

- Schema ID：268425372

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | MerchantCheckoutSession | 否 | - |

### ApiResultMerchantEmployeePage

- Schema ID：268425342

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | EmployeePagePayload | 否 | - |

### ApiResultMerchantFeatureTree

- Schema ID：268425401

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | MerchantFeatureTreeNode[] | 否 | - |

### ApiResultMerchantInvoiceList

- Schema ID：268425377

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | MerchantInvoiceList | 否 | - |

### ApiResultMerchantLoginResult

- Schema ID：268425319

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | MerchantLoginResult | 否 | - |

### ApiResultMerchantMe

- Schema ID：268425391

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | MerchantMe | 否 | - |

### ApiResultMerchantScheduleQuery

- Schema ID：268425365

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | MerchantScheduleQuery | 否 | - |

### ApiResultMerchantStore

- Schema ID：268425327

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | MerchantStore | 否 | - |

### ApiResultMerchantStoreDeleteResult

- Schema ID：268425329

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | MerchantStoreDeletePayload | 否 | - |

### ApiResultMerchantStoreList

- Schema ID：268425326

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | MerchantStoreList | 否 | - |

### ApiResultMerchantSubscription

- Schema ID：268425374

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | MerchantSubscription | 否 | - |

### ApiResultPositionDictList

- Schema ID：268425353

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | PositionDictListPayload | 否 | - |

### ApiResultScheduleArea

- Schema ID：268425334

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | ScheduleArea | 否 | - |

### ApiResultScheduleAreaDeleteResult

- Schema ID：268425338

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | ScheduleAreaDeletePayload | 否 | - |

### ApiResultScheduleAreaList

- Schema ID：268425333

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | ScheduleAreaList | 否 | - |

### ApiResultScheduleTemplateDetail

- Schema ID：268425361

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | ScheduleTemplateDetail | 否 | - |

### ApiResultScheduleTemplateList

- Schema ID：268425356

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | ScheduleTemplateListPayload | 否 | - |

### ApiResultWorkAreaDictList

- Schema ID：268425350

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | integer | 否 | - |
| message | string | 否 | - |
| data | WorkAreaDictListPayload | 否 | - |

### BillingAddQuantityRequest

- Schema ID：268425370

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| addQuantity | integer | 是 | 追加数量（>0） |

### BillingSubscribeRequest

- Schema ID：268425369

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| planId | integer(int64) | 是 | - |
| quantity | integer | 是 | 首次购买数量（>= minQuantity） |

### CountryOption

- Schema ID：268425389

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| code | string | 否 | ISO 3166-1 alpha-2 大写 |
| nameZh | string | 否 | - |
| nameEn | string | 否 | - |
| dialCode | string | 否 | 国际电话区号，不含 +（E.164 国家呼叫码） |

### Employee

- Schema ID：268425340

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | integer(int64) | 否 | 等同 merchant_admin.id（员工账号） |
| firstName | string | 否 | - |
| lastName | string | 否 | - |
| employeeId | string | 否 | 工号 |
| role | string | 否 | - |
| phone | string | 否 | - |
| email | string | 否 | - |
| status | string enum(active \| inactive) | 否 | - |
| startDate | string | 否 | YYYY-MM-DD |
| storeIds | integer(int64)[] | 否 | - |
| assignedStores | integer(int64)[] | 否 | - |
| hourlyRate | number | 否 | - |
| notes | string | 否 | - |
| avatar | string | 否 | - |
| employeeColor | string | 否 | - |
| address | string | 否 | - |
| dateOfBirth | string | 否 | - |
| irdNumber | string | 否 | - |
| taxCode | string | 否 | - |
| kiwiSaverStatus | string | 否 | - |
| employeeContributionRate | string | 否 | - |
| employerContributionRate | string | 否 | - |
| esctRate | string | 否 | - |
| bankAccountNumber | string | 否 | - |
| payrollEmployeeId | string | 否 | - |
| areaIds | string[] | 否 | - |
| positionIds | string[] | 否 | - |
| paidHoursPerDay | number | 否 | - |
| workDayPattern | WorkDayPattern[] | 否 | - |
| contractType | string | 否 | - |
| endDate | string | 否 | - |
| contractedHours | string | 否 | - |
| annualSalary | string | 否 | - |
| defaultHourlyRate | string | 否 | - |

### EmployeeCreateRequest

- Schema ID：268425344

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| firstName | string | 是 | - |
| lastName | string | 是 | - |
| employeeId | string | 是 | - |
| role | string | 否 | - |
| phone | string | 否 | - |
| email | string | 是 | - |
| password | string | 是 | - |
| status | string | 否 | - |
| startDate | string | 否 | - |
| storeIds | integer(int64)[] | 否 | - |
| hourlyRate | number | 否 | - |
| notes | string | 否 | - |
| avatar | string | 否 | - |
| employeeColor | string | 否 | - |
| address | string | 否 | - |
| dateOfBirth | string | 否 | - |
| irdNumber | string | 否 | - |
| taxCode | string | 否 | - |
| kiwiSaverStatus | string | 否 | - |
| employeeContributionRate | string | 否 | - |
| employerContributionRate | string | 否 | - |
| esctRate | string | 否 | - |
| bankAccountNumber | string | 否 | - |
| payrollEmployeeId | string | 否 | - |
| paidHoursPerDay | number | 否 | - |
| workDayPattern | WorkDayPattern[] | 否 | - |
| contractType | string | 否 | - |
| endDate | string | 否 | - |
| contractedHours | string | 否 | - |
| annualSalary | string | 否 | - |
| defaultHourlyRate | string | 否 | - |
| areaIds | string[] | 否 | - |
| positionIds | string[] | 否 | - |

### EmployeeDeletePayload

- Schema ID：268425346

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | integer(int64) | 否 | - |
| deleted | boolean | 否 | - |

### EmployeePagePayload

- Schema ID：268425341

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| items | Employee[] | 否 | - |
| page | object | 否 | - |

### EmployeePatchRequest

- Schema ID：268425345

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| firstName | string | 否 | - |
| lastName | string | 否 | - |
| employeeId | string | 否 | - |
| role | string | 否 | - |
| phone | string | 否 | - |
| email | string | 否 | - |
| password | string | 否 | - |
| status | string | 否 | - |
| startDate | string | 否 | - |
| storeIds | integer(int64)[] | 否 | - |
| hourlyRate | number | 否 | - |
| notes | string | 否 | - |
| avatar | string | 否 | - |
| employeeColor | string | 否 | - |
| address | string | 否 | - |
| dateOfBirth | string | 否 | - |
| irdNumber | string | 否 | - |
| taxCode | string | 否 | - |
| kiwiSaverStatus | string | 否 | - |
| employeeContributionRate | string | 否 | - |
| employerContributionRate | string | 否 | - |
| esctRate | string | 否 | - |
| bankAccountNumber | string | 否 | - |
| payrollEmployeeId | string | 否 | - |
| paidHoursPerDay | number | 否 | - |
| workDayPattern | WorkDayPattern[] | 否 | - |
| contractType | string | 否 | - |
| endDate | string | 否 | - |
| contractedHours | string | 否 | - |
| annualSalary | string | 否 | - |
| defaultHourlyRate | string | 否 | - |
| areaIds | string[] | 否 | - |
| positionIds | string[] | 否 | - |

### GlobalShift

- Schema ID：268425330

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | integer(int64) | 否 | - |
| name | string | 否 | - |
| startTime | string | 否 | HH:mm |
| endTime | string | 否 | HH:mm |
| breakMinutes | integer | 否 | - |
| color | string | 否 | - |
| days | string | 否 | 可选，产品约定格式（如 JSON 数组） |
| storeId | string | 否 | 全商户通用为 `all`，否则为门店 id 数字字符串 |
| scope | integer enum(0 \| 1) | 否 | 与 MerchantResourceScope 一致：0=MERCHANT_WIDE 全商户通用；1=STORE 门店专属 |

### GlobalShiftCreateRequest

- Schema ID：268425385

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | - |
| startTime | string | 是 | - |
| endTime | string | 是 | - |
| breakMinutes | integer | 否 | - |
| color | string | 否 | - |
| days | string | 否 | - |
| storeId | string | 否 | 省略或 all 表示全商户通用 |

### GlobalShiftDeletePayload

- Schema ID：268425387

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | integer(int64) | 否 | - |
| deleted | boolean | 否 | - |

### GlobalShiftList

- Schema ID：268425382

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| items | GlobalShift[] | 否 | - |

### GlobalShiftPatchRequest

- Schema ID：268425386

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 否 | - |
| startTime | string | 否 | - |
| endTime | string | 否 | - |
| breakMinutes | integer | 否 | - |
| color | string | 否 | - |
| days | string | 否 | - |
| storeId | string | 否 | - |

### MerchantActivateRequest

- Schema ID：268425316

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| token | string | 是 | - |
| newPassword | string | 是 | - |

### MerchantAuthPrincipal

- Schema ID：268425320

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| merchantAdminId | integer(int64) | 否 | - |
| merchantId | integer(int64) | 否 | - |
| adminName | string | 否 | - |

### MerchantCheckoutSession

- Schema ID：268425371

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| checkoutUrl | string | 否 | - |

### MerchantFeatureTreeNode

- Schema ID：268425400

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | integer(int64) | 否 | - |
| nameZh | string | 否 | - |
| nameEn | string | 否 | - |
| url | string | 否 | - |
| status | integer | 否 | 1 启用 0 停用 |
| sortOrder | integer | 否 | 同级排序，越大越靠前 |
| children | MerchantFeatureTreeNode[] | 否 | - |

### MerchantInvoiceList

- Schema ID：268425376

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| items | MerchantInvoiceSummary[] | 否 | - |
| hasMore | boolean | 否 | - |
| nextStartingAfter | string \| null | 否 | - |

### MerchantInvoiceSummary

- Schema ID：268425375
- 说明：Stripe Invoice 摘要；金额单位为最小货币单位

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | string | 否 | - |
| number | string \| null | 否 | - |
| status | string | 否 | - |
| currency | string | 否 | - |
| total | integer(int64) \| null | 否 | - |
| amountPaid | integer(int64) \| null | 否 | - |
| amountDue | integer(int64) \| null | 否 | - |
| created | string | 否 | UTC，格式 yyyy-MM-dd HH:mm:ss |
| periodStart | string \| null | 否 | - |
| periodEnd | string \| null | 否 | - |
| hostedInvoiceUrl | string \| null | 否 | - |
| invoicePdf | string \| null | 否 | - |
| billingReason | string \| null | 否 | - |
| description | string \| null | 否 | - |

### MerchantLoginRequest

- Schema ID：268425315

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| email | string | 是 | - |
| password | string | 否 | - |

### MerchantLoginResult

- Schema ID：268425318

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| accessToken | string \| null | 否 | - |
| expiresIn | integer(int64) \| null | 否 | - |
| user | MerchantUserBrief | 否 | - |
| status | string \| null | 否 | needs_activation（未激活） |

### MerchantMe

- Schema ID：268425314

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| merchantId | integer(int64) | 否 | - |
| merchantAdminId | integer(int64) | 否 | - |
| adminName | string | 否 | - |

### MerchantScheduleAreaItem

- Schema ID：268425362

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | integer(int64) | 否 | - |
| name | string | 否 | - |
| orderSort | integer | 否 | - |

### MerchantScheduleCellItem

- Schema ID：268425363

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | integer(int64) | 否 | - |
| areaId | integer(int64) | 否 | - |
| areaName | string | 否 | - |
| shiftId | integer(int64) | 否 | - |
| shiftsname | string | 否 | - |
| date_str | string | 否 | - |
| startTime | string | 否 | - |
| endTime | string | 否 | - |
| employees | ScheduleTemplateEmployeeBrief[] | 否 | - |
| color | string | 否 | - |

### MerchantScheduleQuery

- Schema ID：268425364

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| areas | MerchantScheduleAreaItem[] | 否 | - |
| cells | MerchantScheduleCellItem[] | 否 | - |

### MerchantStore

- Schema ID：268425322

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | integer(int64) | 否 | - |
| name | string | 否 | - |
| code | string | 否 | - |
| address | string | 否 | - |
| city | string | 否 | - |
| country | string | 否 | ISO 3166-1 alpha-2，须为 sys_country 中已启用项 |
| phone | string | 否 | - |
| email | string | 否 | - |
| manager | string | 否 | - |
| openTime | string | 否 | HH:mm |
| closeTime | string | 否 | HH:mm |
| timezone | string | 否 | - |
| status | string | 否 | enabled 或 disabled |
| latitude | number(double) | 否 | - |
| longitude | number(double) | 否 | - |
| geofenceRadius | integer | 否 | 米 |

### MerchantStoreCreateRequest

- Schema ID：268425324

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | - |
| code | string | 是 | - |
| address | string | 否 | - |
| city | string | 否 | - |
| country | string | 是 | ISO 3166-1 alpha-2，须为 sys_country 已启用项 |
| phone | string | 否 | - |
| email | string | 否 | - |
| manager | string | 否 | - |
| openTime | string | 否 | - |
| closeTime | string | 否 | - |
| timezone | string | 否 | - |
| status | string | 否 | - |
| latitude | number(double) | 否 | - |
| longitude | number(double) | 否 | - |
| geofenceRadius | integer | 否 | - |

### MerchantStoreDeletePayload

- Schema ID：268425328

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | integer(int64) | 否 | - |
| deleted | boolean | 否 | - |

### MerchantStoreList

- Schema ID：268425323

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| items | MerchantStore[] | 否 | - |

### MerchantStorePatchRequest

- Schema ID：268425325

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 否 | - |
| code | string | 否 | - |
| address | string | 否 | - |
| city | string | 否 | - |
| country | string | 否 | - |
| phone | string | 否 | - |
| email | string | 否 | - |
| manager | string | 否 | - |
| openTime | string | 否 | - |
| closeTime | string | 否 | - |
| timezone | string | 否 | - |
| status | string | 否 | - |
| latitude | number(double) | 否 | - |
| longitude | number(double) | 否 | - |
| geofenceRadius | integer | 否 | - |

### MerchantSubscription

- Schema ID：268425373

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| merchantId | integer(int64) | 否 | - |
| planId | integer(int64) | 否 | - |
| quantity | integer | 否 | - |
| status | string | 否 | - |
| cancelAtPeriodEnd | integer | 否 | - |
| currentPeriodEnd | string | 否 | - |

### MerchantUserBrief

- Schema ID：268425317

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| email | string | 否 | - |
| name | string | 否 | - |

### PositionDictItem

- Schema ID：268425351

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | integer(int64) | 否 | - |
| name | string | 否 | - |

### PositionDictListPayload

- Schema ID：268425352

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| items | PositionDictItem[] | 否 | - |

### ScheduleArea

- Schema ID：268425331

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | integer(int64) | 否 | - |
| name | string | 否 | - |
| color | string | 否 | - |
| storeId | string | 否 | 全商户通用为 `all`，否则为门店 id 数字字符串 |
| order | integer | 否 | 展示排序，越小越靠前 |
| scope | integer enum(0 \| 1) | 否 | 与 MerchantResourceScope 一致 |

### ScheduleAreaCreateRequest

- Schema ID：268425335

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | - |
| color | string | 否 | - |
| order | integer | 否 | - |
| storeId | string | 否 | 省略时由 X-Store-Id 推导；all 表示全商户通用 |

### ScheduleAreaDeletePayload

- Schema ID：268425337

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | integer(int64) | 否 | - |
| deleted | boolean | 否 | - |

### ScheduleAreaList

- Schema ID：268425332

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| items | ScheduleArea[] | 否 | - |

### ScheduleAreaPatchRequest

- Schema ID：268425336

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 否 | - |
| color | string | 否 | - |
| order | integer | 否 | - |
| storeId | string | 否 | - |

### ScheduleDraftAreaItem

- Schema ID：268425366

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | integer(int64) | 是 | - |
| orderSort | integer | 是 | - |

### ScheduleDraftCellItem

- Schema ID：268425367

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| areaId | integer(int64) | 是 | - |
| shiftId | integer(int64) | 是 | - |
| date_str | string | 是 | - |
| startTime | string | 是 | - |
| endTime | string | 是 | - |
| employeesIds | integer(int64)[] | 否 | - |
| color | string | 否 | - |

### ScheduleDraftSaveRequest

- Schema ID：268425368

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| areas | ScheduleDraftAreaItem[] | 是 | - |
| cells | ScheduleDraftCellItem[] | 是 | - |

### ScheduleTemplateAreaDetail

- Schema ID：268425357

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | integer(int64) | 否 | - |
| name | string | 否 | - |
| orderSort | integer | 否 | - |

### ScheduleTemplateAreaItem

- Schema ID：268425378

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | integer(int64) | 是 | - |
| orderSort | integer | 是 | - |

### ScheduleTemplateCellDetail

- Schema ID：268425359

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | integer(int64) | 否 | - |
| areaId | integer(int64) | 否 | - |
| areaName | string | 否 | - |
| shiftsId | integer(int64) | 否 | - |
| shiftsName | string | 否 | - |
| weekDay | integer | 否 | 1～7 周一至周日 |
| startTime | string | 否 | - |
| endTime | string | 否 | - |
| employees | ScheduleTemplateEmployeeBrief[] | 否 | - |
| color | string | 否 | - |

### ScheduleTemplateCellItem

- Schema ID：268425379

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| areaId | integer(int64) | 是 | - |
| shiftsId | integer(int64) | 是 | - |
| weekDay | integer | 是 | - |
| startTime | string | 是 | - |
| endTime | string | 是 | - |
| employeeIds | integer(int64)[] | 否 | - |
| color | string | 否 | - |

### ScheduleTemplateCreateRequest

- Schema ID：268425380

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 是 | - |
| totalDays | integer | 否 | - |
| areas | ScheduleTemplateAreaItem[] | 是 | - |
| cells | ScheduleTemplateCellItem[] | 是 | - |

### ScheduleTemplateDetail

- Schema ID：268425360

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | integer(int64) | 否 | - |
| merchantId | integer(int64) | 否 | - |
| storeId | integer(int64) \| null | 否 | - |
| name | string | 否 | - |
| totalDays | integer | 否 | - |
| status | integer | 否 | 1 启用 0 停用 |
| areas | ScheduleTemplateAreaDetail[] | 否 | - |
| cells | ScheduleTemplateCellDetail[] | 否 | - |

### ScheduleTemplateEmployeeBrief

- Schema ID：268425358

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | integer(int64) | 否 | - |
| name | string | 否 | - |

### ScheduleTemplateListItem

- Schema ID：268425354

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | integer(int64) | 否 | - |
| name | string | 否 | - |

### ScheduleTemplateListPayload

- Schema ID：268425355

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| items | ScheduleTemplateListItem[] | 否 | - |

### ScheduleTemplatePatchRequest

- Schema ID：268425381

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| name | string | 否 | - |
| totalDays | integer | 否 | - |
| status | integer | 否 | - |
| areas | ScheduleTemplateAreaItem[] | 否 | - |
| cells | ScheduleTemplateCellItem[] | 否 | - |

### WorkAreaDictItem

- Schema ID：268425348

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| id | integer(int64) | 否 | - |
| name | string | 否 | - |

### WorkAreaDictListPayload

- Schema ID：268425349

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| items | WorkAreaDictItem[] | 否 | - |

### WorkDayPattern

- Schema ID：268425339

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| dayIndex | integer | 否 | 0=周一 … 6=周日 |
| state | string enum(true \| false \| none) | 否 | - |
| hours | number | 否 | - |
