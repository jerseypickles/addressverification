import { useState } from "react";
import { useLoaderData, useFetcher, useNavigate } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { validateAddress } from "../services/google-address-validation.server";

export const loader = async ({ request, params }) => {
  await authenticate.admin(request);

  const validation = await prisma.addressValidation.findUnique({
    where: { id: params.id },
  });

  if (!validation) {
    throw new Response("Not found", { status: 404 });
  }

  return {
    validation: {
      ...validation,
      originalAddress: JSON.parse(validation.originalAddress),
      validatedAddress: validation.validatedAddress ? JSON.parse(validation.validatedAddress) : null,
      verdict: validation.verdict ? JSON.parse(validation.verdict) : null,
      correctedAddress: validation.correctedAddress ? JSON.parse(validation.correctedAddress) : null,
    },
  };
};

export const action = async ({ request, params }) => {
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const intent = formData.get("intent");
  const id = params.id;

  if (intent === "accept_suggestion") {
    const validation = await prisma.addressValidation.findUnique({ where: { id } });
    const validatedAddress = JSON.parse(validation.validatedAddress);

    const response = await admin.graphql(
      `#graphql
      mutation orderUpdate($input: OrderInput!) {
        orderUpdate(input: $input) {
          order { id }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          input: {
            id: validation.orderId,
            shippingAddress: {
              address1: validatedAddress.address1,
              city: validatedAddress.city,
              provinceCode: validatedAddress.province,
              zip: validatedAddress.zip,
              countryCode: "US",
            },
          },
        },
      }
    );

    const result = await response.json();
    if (result.data?.orderUpdate?.userErrors?.length > 0) {
      return { error: result.data.orderUpdate.userErrors[0].message };
    }

    await prisma.addressValidation.update({
      where: { id },
      data: {
        correctedAddress: validation.validatedAddress,
        status: "valid",
        updatedInShopify: true,
      },
    });

    return { success: true, message: "Address updated in Shopify" };
  }

  if (intent === "manual_update") {
    const address = {
      address1: formData.get("address1"),
      address2: formData.get("address2") || "",
      city: formData.get("city"),
      province: formData.get("province"),
      zip: formData.get("zip"),
    };

    const validation = await prisma.addressValidation.findUnique({ where: { id } });

    const response = await admin.graphql(
      `#graphql
      mutation orderUpdate($input: OrderInput!) {
        orderUpdate(input: $input) {
          order { id }
          userErrors { field message }
        }
      }`,
      {
        variables: {
          input: {
            id: validation.orderId,
            shippingAddress: {
              address1: address.address1,
              address2: address.address2,
              city: address.city,
              provinceCode: address.province,
              zip: address.zip,
              countryCode: "US",
            },
          },
        },
      }
    );

    const result = await response.json();
    if (result.data?.orderUpdate?.userErrors?.length > 0) {
      return { error: result.data.orderUpdate.userErrors[0].message };
    }

    await prisma.addressValidation.update({
      where: { id },
      data: {
        correctedAddress: JSON.stringify(address),
        status: "valid",
        updatedInShopify: true,
      },
    });

    return { success: true, message: "Address manually updated in Shopify" };
  }

  if (intent === "mark_valid") {
    await prisma.addressValidation.update({
      where: { id },
      data: { status: "valid" },
    });
    return { success: true, message: "Marked as valid" };
  }

  if (intent === "revalidate") {
    const validation = await prisma.addressValidation.findUnique({ where: { id } });
    const original = JSON.parse(validation.originalAddress);

    const result = await validateAddress(original);

    await prisma.addressValidation.update({
      where: { id },
      data: {
        validatedAddress: JSON.stringify(result.validatedAddress),
        status: result.status,
        verdict: JSON.stringify(result.verdict),
      },
    });

    return { success: true, message: "Address re-validated" };
  }

  return { error: "Unknown action" };
};

const STATUS_CONFIG = {
  valid: { tone: "success", label: "Valid", color: "#008060", bg: "#f1f8f5" },
  needs_review: { tone: "warning", label: "Needs Review", color: "#b98900", bg: "#fef8f0" },
  invalid: { tone: "critical", label: "Invalid", color: "#d72c0d", bg: "#fef6f6" },
  pending: { tone: "info", label: "Pending", color: "#2c6ecb", bg: "#f0f5ff" },
};

function AddressCard({ title, address, icon, highlight, fields }) {
  if (!address) return null;

  return (
    <div style={{
      flex: 1,
      background: highlight ? "#fffbf5" : "#ffffff",
      border: `1px solid ${highlight ? "#e5b87b" : "#e1e3e5"}`,
      borderRadius: "12px",
      overflow: "hidden",
      minWidth: "220px",
    }}>
      <div style={{
        padding: "12px 16px",
        background: highlight ? "#fef8f0" : "#f9fafb",
        borderBottom: `1px solid ${highlight ? "#e5b87b" : "#e1e3e5"}`,
        display: "flex",
        alignItems: "center",
        gap: "8px",
      }}>
        <span style={{ fontSize: "16px" }}>{icon}</span>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#202223" }}>{title}</span>
      </div>
      <div style={{ padding: "16px" }}>
        <div style={{ marginBottom: "12px" }}>
          <div style={{ fontSize: "11px", fontWeight: 600, color: "#8c9196", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
            Street
          </div>
          <div style={{
            fontSize: "14px",
            color: "#202223",
            fontWeight: 500,
            background: fields?.address1 ? "#fff3cd" : "transparent",
            padding: fields?.address1 ? "2px 4px" : 0,
            borderRadius: "3px",
          }}>
            {address.address1}
          </div>
          {address.address2 && (
            <div style={{ fontSize: "13px", color: "#6d7175", marginTop: "2px" }}>{address.address2}</div>
          )}
        </div>
        <div style={{ display: "flex", gap: "16px" }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#8c9196", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
              City
            </div>
            <div style={{
              fontSize: "14px",
              color: "#202223",
              background: fields?.city ? "#fff3cd" : "transparent",
              padding: fields?.city ? "2px 4px" : 0,
              borderRadius: "3px",
            }}>
              {address.city}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#8c9196", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
              State
            </div>
            <div style={{
              fontSize: "14px",
              color: "#202223",
              background: fields?.province ? "#fff3cd" : "transparent",
              padding: fields?.province ? "2px 4px" : 0,
              borderRadius: "3px",
            }}>
              {address.province}
            </div>
          </div>
          <div>
            <div style={{ fontSize: "11px", fontWeight: 600, color: "#8c9196", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
              ZIP
            </div>
            <div style={{
              fontSize: "14px",
              color: "#202223",
              background: fields?.zip ? "#fff3cd" : "transparent",
              padding: fields?.zip ? "2px 4px" : 0,
              borderRadius: "3px",
            }}>
              {address.zip}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getDiffFields(original, validated) {
  if (!original || !validated) return {};
  const diff = {};
  if (original.address1 !== validated.address1) diff.address1 = true;
  if (original.city !== validated.city) diff.city = true;
  if (original.province !== validated.province) diff.province = true;
  if (original.zip !== validated.zip) diff.zip = true;
  return diff;
}

export default function OrderDetail() {
  const { validation } = useLoaderData();
  const fetcher = useFetcher();
  const navigate = useNavigate();
  const [editing, setEditing] = useState(false);
  const [manualAddress, setManualAddress] = useState({
    address1: validation.originalAddress.address1 || "",
    address2: validation.originalAddress.address2 || "",
    city: validation.originalAddress.city || "",
    province: validation.originalAddress.province || "",
    zip: validation.originalAddress.zip || "",
  });

  const isLoading = fetcher.state !== "idle";
  const actionData = fetcher.data;
  const config = STATUS_CONFIG[validation.status] || STATUS_CONFIG.pending;
  const diffFields = getDiffFields(validation.originalAddress, validation.validatedAddress);
  const hasDiffs = Object.keys(diffFields).length > 0;
  const date = new Date(validation.createdAt).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <s-page
      heading={`${validation.orderNumber} — ${validation.customerName}`}
      backAction={{ onAction: () => navigate("/app") }}
    >
      {/* Status Header */}
      <s-section>
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          background: config.bg,
          borderRadius: "12px",
          border: `1px solid ${config.color}30`,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              background: "#ffffff",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              border: `1px solid ${config.color}30`,
            }}>
              <span style={{ fontSize: "18px" }}>
                {validation.status === "valid" ? "✓" : validation.status === "needs_review" ? "!" : validation.status === "invalid" ? "✕" : "…"}
              </span>
            </div>
            <div>
              <div style={{ fontSize: "15px", fontWeight: 600, color: config.color }}>
                {config.label}
              </div>
              <div style={{ fontSize: "12px", color: "#6d7175" }}>
                Validated on {date}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            {validation.updatedInShopify && (
              <span style={{
                fontSize: "12px",
                fontWeight: 600,
                color: "#008060",
                background: "#ffffff",
                padding: "4px 12px",
                borderRadius: "6px",
                border: "1px solid #95c9b4",
              }}>
                Synced to Shopify
              </span>
            )}
          </div>
        </div>
      </s-section>

      {/* Banners */}
      {actionData?.error && (
        <s-section>
          <s-banner tone="critical">{actionData.error}</s-banner>
        </s-section>
      )}
      {actionData?.success && (
        <s-section>
          <s-banner tone="success">{actionData.message}</s-banner>
        </s-section>
      )}

      {/* Address Comparison */}
      <s-section heading="Address Comparison">
        {hasDiffs && (
          <div style={{
            padding: "10px 14px",
            background: "#fef8f0",
            border: "1px solid #e5b87b",
            borderRadius: "8px",
            marginBottom: "16px",
            fontSize: "13px",
            color: "#6d5300",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <span>⚠</span>
            <span>Differences detected — highlighted fields differ between original and suggested address.</span>
          </div>
        )}

        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <AddressCard
            title="Original Address"
            icon="📍"
            address={validation.originalAddress}
          />
          <AddressCard
            title="Google Suggestion"
            icon="🔍"
            address={validation.validatedAddress}
            highlight={hasDiffs}
            fields={diffFields}
          />
          {validation.correctedAddress && (
            <AddressCard
              title="Corrected Address"
              icon="✅"
              address={validation.correctedAddress}
            />
          )}
        </div>
      </s-section>

      {/* Actions */}
      {!validation.updatedInShopify && (
        <s-section heading="Actions">
          <div style={{
            display: "flex",
            gap: "10px",
            flexWrap: "wrap",
            padding: "16px 20px",
            background: "#f9fafb",
            borderRadius: "12px",
            border: "1px solid #e1e3e5",
          }}>
            {validation.validatedAddress && (
              <fetcher.Form method="post">
                <input type="hidden" name="intent" value="accept_suggestion" />
                <s-button variant="primary" type="submit" {...(isLoading ? { loading: true } : {})}>
                  Accept Suggestion
                </s-button>
              </fetcher.Form>
            )}
            <s-button variant="secondary" onClick={() => setEditing(!editing)}>
              {editing ? "Cancel" : "Edit Manually"}
            </s-button>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="mark_valid" />
              <s-button variant="tertiary" type="submit">
                Mark as Valid
              </s-button>
            </fetcher.Form>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="revalidate" />
              <s-button variant="tertiary" type="submit">
                Re-validate
              </s-button>
            </fetcher.Form>
          </div>
        </s-section>
      )}

      {/* Manual Edit Form */}
      {editing && (
        <s-section heading="Edit Address Manually">
          <div style={{
            padding: "20px",
            background: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #e1e3e5",
          }}>
            <fetcher.Form method="post">
              <input type="hidden" name="intent" value="manual_update" />
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <s-text-field
                  label="Address Line 1"
                  name="address1"
                  value={manualAddress.address1}
                  onChange={(e) => setManualAddress({ ...manualAddress, address1: e.target.value })}
                />
                <s-text-field
                  label="Address Line 2 (Optional)"
                  name="address2"
                  value={manualAddress.address2}
                  onChange={(e) => setManualAddress({ ...manualAddress, address2: e.target.value })}
                />
                <div style={{ display: "flex", gap: "12px" }}>
                  <div style={{ flex: 2 }}>
                    <s-text-field
                      label="City"
                      name="city"
                      value={manualAddress.city}
                      onChange={(e) => setManualAddress({ ...manualAddress, city: e.target.value })}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <s-text-field
                      label="State"
                      name="province"
                      value={manualAddress.province}
                      onChange={(e) => setManualAddress({ ...manualAddress, province: e.target.value })}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <s-text-field
                      label="ZIP Code"
                      name="zip"
                      value={manualAddress.zip}
                      onChange={(e) => setManualAddress({ ...manualAddress, zip: e.target.value })}
                    />
                  </div>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px" }}>
                  <s-button variant="tertiary" onClick={() => setEditing(false)}>
                    Cancel
                  </s-button>
                  <s-button variant="primary" type="submit" {...(isLoading ? { loading: true } : {})}>
                    Update in Shopify
                  </s-button>
                </div>
              </div>
            </fetcher.Form>
          </div>
        </s-section>
      )}

      {/* Validation Details (collapsible) */}
      {validation.verdict && (
        <s-section heading="Validation Details (Raw)">
          <div style={{
            background: "#1e1e1e",
            borderRadius: "10px",
            padding: "16px",
            overflow: "auto",
            maxHeight: "300px",
          }}>
            <pre style={{
              margin: 0,
              whiteSpace: "pre-wrap",
              fontSize: "12px",
              lineHeight: 1.6,
              color: "#d4d4d4",
              fontFamily: "'SF Mono', 'Fira Code', monospace",
            }}>
              {JSON.stringify(validation.verdict, null, 2)}
            </pre>
          </div>
        </s-section>
      )}
    </s-page>
  );
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
