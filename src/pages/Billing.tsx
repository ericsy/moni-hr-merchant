import { useCallback, useEffect, useMemo, useState } from "react";
import { Alert, Button, Card, Form, InputNumber, Select, Space, Table, Tag, Typography } from "antd";
import { CreditCard, ExternalLink, FileText, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "../context/LocaleContext";
import { merchantApi, type MerchantInvoiceSummary, type MerchantSubscription } from "../lib/merchantApi";

const { Text } = Typography;

function formatAmount(value?: number | null, currency = "") {
  if (value === undefined || value === null) return "-";
  const amount = value / 100;
  return `${currency.toUpperCase()} ${amount.toFixed(2)}`.trim();
}

function statusColor(status?: string | null) {
  const normalized = String(status || "").toLowerCase();
  if (["active", "paid", "succeeded"].includes(normalized)) return "success";
  if (["open", "trialing", "pending"].includes(normalized)) return "processing";
  if (["past_due", "unpaid", "failed"].includes(normalized)) return "error";
  return "default";
}

export default function Billing() {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const [subscribeForm] = Form.useForm();
  const [quantityForm] = Form.useForm();
  const [subscription, setSubscription] = useState<MerchantSubscription | null>(null);
  const [invoices, setInvoices] = useState<MerchantInvoiceSummary[]>([]);
  const [invoiceStatus, setInvoiceStatus] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState("");

  const copy = useMemo(() => ({
    title: zh ? "账单订阅" : "Billing",
    current: zh ? "当前订阅" : "Current Subscription",
    subscribe: zh ? "首次购买" : "Subscribe",
    addQuantity: zh ? "追加数量" : "Add Quantity",
    invoices: zh ? "账单列表" : "Invoices",
    refresh: zh ? "刷新" : "Refresh",
    noSubscription: zh ? "暂无订阅信息" : "No subscription",
    planId: zh ? "套餐 ID" : "Plan ID",
    quantity: zh ? "购买数量" : "Quantity",
    add: zh ? "追加" : "Add",
    status: zh ? "状态" : "Status",
    periodEnd: zh ? "周期结束" : "Period End",
    cancelAtPeriodEnd: zh ? "到期取消" : "Cancel At Period End",
    invoiceNo: zh ? "账单号" : "Invoice",
    amount: zh ? "金额" : "Amount",
    created: zh ? "创建时间" : "Created",
    links: zh ? "链接" : "Links",
    checkout: zh ? "跳转结账" : "Go to Checkout",
    paid: zh ? "已支付" : "Paid",
    open: zh ? "待支付" : "Open",
    all: zh ? "全部状态" : "All Status",
  }), [zh]);

  const loadBilling = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [nextSubscription, invoiceList] = await Promise.all([
        merchantApi.getBillingSubscription().catch(() => null),
        merchantApi.listBillingInvoices({ limit: 20, status: invoiceStatus }),
      ]);
      setSubscription(nextSubscription);
      setInvoices(invoiceList.items || []);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Failed to load billing";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [invoiceStatus]);

  useEffect(() => {
    Promise.resolve().then(loadBilling);
  }, [loadBilling]);

  const handleSubscribe = async (values: { planId: number; quantity: number }) => {
    setActionLoading(true);
    try {
      const session = await merchantApi.subscribeBilling(values.planId, values.quantity);
      if (session.checkoutUrl) {
        window.location.assign(session.checkoutUrl);
        return;
      }
      toast.success(copy.checkout);
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Subscribe failed");
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddQuantity = async (values: { addQuantity: number }) => {
    setActionLoading(true);
    try {
      const nextSubscription = await merchantApi.addBillingQuantity(values.addQuantity);
      setSubscription(nextSubscription);
      quantityForm.resetFields();
      toast.success(zh ? "订阅数量已更新" : "Quantity updated");
    } catch (submitError) {
      toast.error(submitError instanceof Error ? submitError.message : "Update failed");
    } finally {
      setActionLoading(false);
    }
  };

  const invoiceColumns = [
    {
      title: copy.invoiceNo,
      dataIndex: "number",
      key: "number",
      render: (_: unknown, row: MerchantInvoiceSummary) => row.number || row.id || "-",
    },
    {
      title: copy.status,
      dataIndex: "status",
      key: "status",
      render: (status: string) => <Tag color={statusColor(status)}>{status || "-"}</Tag>,
    },
    {
      title: copy.amount,
      key: "amount",
      render: (_: unknown, row: MerchantInvoiceSummary) => formatAmount(row.total, row.currency || ""),
    },
    {
      title: copy.created,
      dataIndex: "created",
      key: "created",
      render: (created: string) => created || "-",
    },
    {
      title: copy.links,
      key: "links",
      render: (_: unknown, row: MerchantInvoiceSummary) => (
        <Space size="small">
          {row.hostedInvoiceUrl && (
            <Button type="link" size="small" href={row.hostedInvoiceUrl} target="_blank" icon={<ExternalLink size={13} />}>
              HTML
            </Button>
          )}
          {row.invoicePdf && (
            <Button type="link" size="small" href={row.invoicePdf} target="_blank" icon={<FileText size={13} />}>
              PDF
            </Button>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div data-cmp="Billing" className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CreditCard size={20} style={{ color: "var(--primary)" }} />
          <h1 className="text-lg font-semibold" style={{ color: "var(--foreground)" }}>{copy.title}</h1>
        </div>
        <Button icon={<RefreshCw size={14} />} loading={loading} onClick={loadBilling}>
          {copy.refresh}
        </Button>
      </div>

      {error && <Alert type="error" showIcon message={error} />}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <Card title={copy.current} loading={loading} style={{ borderColor: "var(--border)" }}>
          {subscription ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <Text type="secondary">Plan ID</Text>
                <div className="mt-1 text-xl font-semibold">{subscription.planId ?? "-"}</div>
              </div>
              <div>
                <Text type="secondary">{copy.quantity}</Text>
                <div className="mt-1 text-xl font-semibold">{subscription.quantity ?? "-"}</div>
              </div>
              <div>
                <Text type="secondary">{copy.status}</Text>
                <div className="mt-1">
                  <Tag color={statusColor(subscription.status)}>{subscription.status || "-"}</Tag>
                </div>
              </div>
              <div>
                <Text type="secondary">{copy.periodEnd}</Text>
                <div className="mt-1 text-sm">{subscription.currentPeriodEnd || "-"}</div>
              </div>
              <div>
                <Text type="secondary">{copy.cancelAtPeriodEnd}</Text>
                <div className="mt-1 text-sm">{subscription.cancelAtPeriodEnd ? (zh ? "是" : "Yes") : (zh ? "否" : "No")}</div>
              </div>
            </div>
          ) : (
            <Text type="secondary">{copy.noSubscription}</Text>
          )}
        </Card>

        <div className="flex flex-col gap-4">
          <Card title={copy.subscribe} style={{ borderColor: "var(--border)" }}>
            <Form form={subscribeForm} layout="vertical" onFinish={handleSubscribe} initialValues={{ quantity: 1 }}>
              <Form.Item name="planId" label={copy.planId} rules={[{ required: true }]}>
                <InputNumber min={1} precision={0} style={{ width: "100%" }} />
              </Form.Item>
              <Form.Item name="quantity" label={copy.quantity} rules={[{ required: true }]}>
                <InputNumber min={1} precision={0} style={{ width: "100%" }} />
              </Form.Item>
              <Button type="primary" htmlType="submit" loading={actionLoading} icon={<CreditCard size={14} />} block>
                {copy.checkout}
              </Button>
            </Form>
          </Card>

          <Card title={copy.addQuantity} style={{ borderColor: "var(--border)" }}>
            <Form form={quantityForm} layout="vertical" onFinish={handleAddQuantity} initialValues={{ addQuantity: 1 }}>
              <Form.Item name="addQuantity" label={copy.addQuantity} rules={[{ required: true }]}>
                <InputNumber min={1} precision={0} style={{ width: "100%" }} />
              </Form.Item>
              <Button htmlType="submit" loading={actionLoading} icon={<Plus size={14} />} block>
                {copy.add}
              </Button>
            </Form>
          </Card>
        </div>
      </div>

      <Card
        title={copy.invoices}
        style={{ borderColor: "var(--border)" }}
        extra={
          <Select
            allowClear
            placeholder={copy.all}
            value={invoiceStatus}
            onChange={(value) => setInvoiceStatus(value)}
            style={{ width: 140 }}
          >
            <Select.Option value="paid">{copy.paid}</Select.Option>
            <Select.Option value="open">{copy.open}</Select.Option>
          </Select>
        }
      >
        <Table
          rowKey={(row) => row.id || row.number || `${row.created}-${row.total}`}
          columns={invoiceColumns}
          dataSource={invoices}
          loading={loading}
          pagination={false}
          size="small"
        />
      </Card>
    </div>
  );
}
