import { useLoaderData, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const url = new URL(request.url);
  const statusFilter = url.searchParams.get("status") || "all";

  const where = statusFilter !== "all" ? { status: statusFilter } : {};

  const [validations, stats] = await Promise.all([
    prisma.addressValidation.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.addressValidation.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
  ]);

  const total = stats.reduce((acc, s) => acc + s._count.status, 0);
  const valid = stats.find((s) => s.status === "valid")?._count.status || 0;
  const needsReview = stats.find((s) => s.status === "needs_review")?._count.status || 0;
  const invalid = stats.find((s) => s.status === "invalid")?._count.status || 0;
  const pending = stats.find((s) => s.status === "pending")?._count.status || 0;

  return {
    validations,
    stats: { total, valid, needsReview, invalid, pending },
    currentFilter: statusFilter,
  };
};

const STATUS_CONFIG = {
  valid: { tone: "success", label: "Valid", icon: "✓" },
  needs_review: { tone: "warning", label: "Needs Review", icon: "!" },
  invalid: { tone: "critical", label: "Invalid", icon: "✕" },
  pending: { tone: "info", label: "Pending", icon: "…" },
};

const FILTER_LABELS = {
  all: "All",
  needs_review: "Needs Review",
  invalid: "Invalid",
  valid: "Valid",
  pending: "Pending",
};

function StatCard({ label, value, tone, active, onClick }) {
  const colors = {
    default: { bg: "#f6f6f7", border: "#e1e3e5", text: "#6d7175" },
    success: { bg: "#f1f8f5", border: "#95c9b4", text: "#008060" },
    warning: { bg: "#fef8f0", border: "#e5b87b", text: "#b98900" },
    critical: { bg: "#fef6f6", border: "#e0a5a5", text: "#d72c0d" },
    info: { bg: "#f0f5ff", border: "#a4c8f0", text: "#2c6ecb" },
  };
  const c = colors[tone] || colors.default;

  return (
    <div
      onClick={onClick}
      style={{
        flex: 1,
        padding: "16px 20px",
        borderRadius: "12px",
        background: active ? c.bg : "#ffffff",
        border: `2px solid ${active ? c.border : "#e1e3e5"}`,
        cursor: "pointer",
        transition: "all 0.2s ease",
        minWidth: "120px",
      }}
    >
      <div style={{ fontSize: "12px", fontWeight: 600, color: c.text, textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
        {label}
      </div>
      <div style={{ fontSize: "28px", fontWeight: 700, color: active ? c.text : "#202223", lineHeight: 1.2 }}>
        {value}
      </div>
    </div>
  );
}

function OrderRow({ validation, onClick }) {
  const original = JSON.parse(validation.originalAddress);
  const config = STATUS_CONFIG[validation.status] || STATUS_CONFIG.pending;
  const date = new Date(validation.createdAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        padding: "14px 16px",
        borderBottom: "1px solid #f1f1f1",
        cursor: "pointer",
        transition: "background 0.15s",
        gap: "12px",
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = "#f9fafb"}
      onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
    >
      <div style={{
        width: "36px",
        height: "36px",
        borderRadius: "8px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "14px",
        fontWeight: 700,
        flexShrink: 0,
        background: config.tone === "success" ? "#f1f8f5" : config.tone === "warning" ? "#fef8f0" : config.tone === "critical" ? "#fef6f6" : "#f0f5ff",
        color: config.tone === "success" ? "#008060" : config.tone === "warning" ? "#b98900" : config.tone === "critical" ? "#d72c0d" : "#2c6ecb",
      }}>
        {config.icon}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "2px" }}>
          <span style={{ fontWeight: 600, fontSize: "13px", color: "#202223" }}>
            {validation.orderNumber}
          </span>
          <span style={{ color: "#6d7175", fontSize: "13px" }}>
            {validation.customerName}
          </span>
        </div>
        <div style={{ fontSize: "12px", color: "#8c9196", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {original.address1}, {original.city}, {original.province} {original.zip}
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        {validation.updatedInShopify && (
          <span style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "#008060",
            background: "#f1f8f5",
            padding: "2px 8px",
            borderRadius: "4px",
          }}>
            Synced
          </span>
        )}
        <s-badge tone={config.tone}>{config.label}</s-badge>
        <span style={{ fontSize: "11px", color: "#8c9196", minWidth: "80px", textAlign: "right" }}>
          {date}
        </span>
      </div>
    </div>
  );
}

export default function Index() {
  const { validations, stats, currentFilter } = useLoaderData();
  const navigate = useNavigate();

  const successRate = stats.total > 0 ? Math.round((stats.valid / stats.total) * 100) : 0;

  return (
    <s-page heading="Address Verification">
      <s-section>
        {/* Stats Cards */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "24px", flexWrap: "wrap" }}>
          <StatCard
            label="Total Orders"
            value={stats.total}
            tone="default"
            active={currentFilter === "all"}
            onClick={() => navigate("/app?status=all")}
          />
          <StatCard
            label="Valid"
            value={stats.valid}
            tone="success"
            active={currentFilter === "valid"}
            onClick={() => navigate("/app?status=valid")}
          />
          <StatCard
            label="Needs Review"
            value={stats.needsReview}
            tone="warning"
            active={currentFilter === "needs_review"}
            onClick={() => navigate("/app?status=needs_review")}
          />
          <StatCard
            label="Invalid"
            value={stats.invalid}
            tone="critical"
            active={currentFilter === "invalid"}
            onClick={() => navigate("/app?status=invalid")}
          />
        </div>

        {/* Success Rate Bar */}
        {stats.total > 0 && (
          <div style={{
            background: "#ffffff",
            border: "1px solid #e1e3e5",
            borderRadius: "10px",
            padding: "14px 18px",
            marginBottom: "24px",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#202223" }}>
                Validation Success Rate
              </span>
              <span style={{ fontSize: "13px", fontWeight: 700, color: "#008060" }}>
                {successRate}%
              </span>
            </div>
            <div style={{ width: "100%", height: "8px", background: "#f1f1f1", borderRadius: "4px", overflow: "hidden" }}>
              <div style={{
                width: `${successRate}%`,
                height: "100%",
                background: successRate > 80 ? "linear-gradient(90deg, #008060, #00a67e)" : successRate > 50 ? "linear-gradient(90deg, #b98900, #e0b000)" : "linear-gradient(90deg, #d72c0d, #e85b3a)",
                borderRadius: "4px",
                transition: "width 0.5s ease",
              }} />
            </div>
          </div>
        )}

        {/* Filter Tabs */}
        <div style={{
          display: "flex",
          gap: "4px",
          borderBottom: "1px solid #e1e3e5",
          marginBottom: "4px",
        }}>
          {Object.entries(FILTER_LABELS).map(([key, label]) => {
            const isActive = currentFilter === key;
            const count = key === "all" ? stats.total : key === "needs_review" ? stats.needsReview : stats[key] || 0;
            return (
              <div
                key={key}
                onClick={() => navigate(`/app?status=${key}`)}
                style={{
                  padding: "10px 16px",
                  fontSize: "13px",
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? "#202223" : "#6d7175",
                  borderBottom: isActive ? "2px solid #202223" : "2px solid transparent",
                  cursor: "pointer",
                  transition: "all 0.15s",
                  display: "flex",
                  gap: "6px",
                  alignItems: "center",
                }}
              >
                {label}
                {count > 0 && (
                  <span style={{
                    fontSize: "11px",
                    background: isActive ? "#202223" : "#e1e3e5",
                    color: isActive ? "#ffffff" : "#6d7175",
                    borderRadius: "10px",
                    padding: "1px 7px",
                    fontWeight: 600,
                  }}>
                    {count}
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Orders List */}
        {validations.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "48px 24px",
            color: "#8c9196",
          }}>
            <div style={{ fontSize: "40px", marginBottom: "12px", opacity: 0.5 }}>
              {currentFilter === "all" ? "📦" : currentFilter === "needs_review" ? "🔍" : currentFilter === "invalid" ? "❌" : currentFilter === "valid" ? "✅" : "⏳"}
            </div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "#6d7175", marginBottom: "4px" }}>
              No {currentFilter === "all" ? "" : FILTER_LABELS[currentFilter].toLowerCase() + " "}orders found
            </div>
            <div style={{ fontSize: "13px" }}>
              {currentFilter === "all"
                ? "Orders will appear here automatically after they are placed."
                : "Try a different filter or wait for new orders."}
            </div>
          </div>
        ) : (
          <div style={{
            background: "#ffffff",
            border: "1px solid #e1e3e5",
            borderRadius: "10px",
            overflow: "hidden",
          }}>
            {validations.map((v) => (
              <OrderRow
                key={v.id}
                validation={v}
                onClick={() => navigate(`/app/orders/${v.id}`)}
              />
            ))}
          </div>
        )}
      </s-section>
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
