import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { validateAddress } from "../services/google-address-validation.server";

export const action = async ({ request }) => {
  const { payload, topic, admin } = await authenticate.webhook(request);

  if (topic !== "ORDERS_CREATE") {
    return new Response("Invalid topic", { status: 400 });
  }

  const order = payload;
  const shippingAddress = order.shipping_address;

  if (!shippingAddress) {
    return new Response("No shipping address", { status: 200 });
  }

  try {
    const result = await validateAddress({
      address1: shippingAddress.address1,
      address2: shippingAddress.address2,
      city: shippingAddress.city,
      province: shippingAddress.province,
      zip: shippingAddress.zip,
    });

    const orderId = `gid://shopify/Order/${order.id}`;
    const originalAddress = {
      address1: shippingAddress.address1,
      address2: shippingAddress.address2,
      city: shippingAddress.city,
      province: shippingAddress.province,
      zip: shippingAddress.zip,
      country: shippingAddress.country,
    };

    // Auto-correct minor changes (capitalization, abbreviations)
    if (result.isMinorChange && admin) {
      try {
        await admin.graphql(
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
                id: orderId,
                shippingAddress: {
                  address1: result.validatedAddress.address1,
                  address2: shippingAddress.address2 || "",
                  city: result.validatedAddress.city,
                  provinceCode: result.validatedAddress.province,
                  zip: result.validatedAddress.zip,
                  countryCode: "US",
                },
              },
            },
          }
        );

        await prisma.addressValidation.create({
          data: {
            orderId,
            orderNumber: `#${order.order_number}`,
            customerName: `${shippingAddress.first_name || ""} ${shippingAddress.last_name || ""}`.trim(),
            originalAddress: JSON.stringify(originalAddress),
            validatedAddress: JSON.stringify(result.validatedAddress),
            correctedAddress: JSON.stringify(result.validatedAddress),
            status: "auto_corrected",
            verdict: JSON.stringify(result.verdict),
            updatedInShopify: true,
          },
        });

        console.log(`Auto-corrected address for order #${order.order_number}`);
        return new Response("OK", { status: 200 });
      } catch (updateError) {
        console.error("Auto-correction failed, saving as needs_review:", updateError);
        // Fall through to save as needs_review
        result.status = "needs_review";
      }
    }

    await prisma.addressValidation.create({
      data: {
        orderId,
        orderNumber: `#${order.order_number}`,
        customerName: `${shippingAddress.first_name || ""} ${shippingAddress.last_name || ""}`.trim(),
        originalAddress: JSON.stringify(originalAddress),
        validatedAddress: JSON.stringify(result.validatedAddress),
        status: result.status,
        verdict: JSON.stringify(result.verdict),
      },
    });
  } catch (error) {
    console.error("Address validation error:", error);
    await prisma.addressValidation.create({
      data: {
        orderId: `gid://shopify/Order/${order.id}`,
        orderNumber: `#${order.order_number}`,
        customerName: `${shippingAddress.first_name || ""} ${shippingAddress.last_name || ""}`.trim(),
        originalAddress: JSON.stringify({
          address1: shippingAddress.address1,
          address2: shippingAddress.address2,
          city: shippingAddress.city,
          province: shippingAddress.province,
          zip: shippingAddress.zip,
          country: shippingAddress.country,
        }),
        status: "pending",
      },
    });
  }

  return new Response("OK", { status: 200 });
};
