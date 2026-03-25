import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { validateAddress } from "../services/google-address-validation.server";

export const action = async ({ request }) => {
  const { payload, topic } = await authenticate.webhook(request);

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
