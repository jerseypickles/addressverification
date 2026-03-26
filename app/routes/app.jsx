import { Outlet, useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  await authenticate.admin(request);

  const alertCount = await prisma.addressValidation.count({
    where: {
      status: { in: ["needs_review", "invalid"] },
      updatedInShopify: false,
    },
  });

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    alertCount,
  };
};

export default function App() {
  const { apiKey, alertCount } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-app-nav>
        <s-link href="/app">
          Address Verification{alertCount > 0 ? ` (${alertCount})` : ""}
        </s-link>
      </s-app-nav>
      <Outlet />
    </AppProvider>
  );
}

// Shopify needs React Router to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
