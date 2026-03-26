const GOOGLE_API_URL = "https://addressvalidation.googleapis.com/v1:validateAddress";

export async function validateAddress(address) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    throw new Error("GOOGLE_MAPS_API_KEY is not set");
  }

  const requestBody = {
    address: {
      regionCode: "US",
      addressLines: [
        address.address1,
        address.address2 || "",
      ].filter(Boolean),
      locality: address.city,
      administrativeArea: address.province,
      postalCode: address.zip,
    },
  };

  const response = await fetch(`${GOOGLE_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Google Address Validation API error: ${error}`);
  }

  const data = await response.json();
  const result = data.result;
  const verdict = result.verdict;
  const googleAddress = result.address;

  // Determine status based on verdict
  let status = "valid";
  if (verdict.hasUnconfirmedComponents || verdict.hasReplacedComponents) {
    status = "needs_review";
  }
  if (verdict.inputGranularity === "OTHER" || !verdict.addressComplete) {
    status = "invalid";
  }

  // Build formatted address from Google's response
  // For city: try locality first, then sublocality_level_1, then neighborhood
  const city = getComponent(googleAddress, "locality")
    || getComponent(googleAddress, "sublocality_level_1")
    || getComponent(googleAddress, "sublocality")
    || getComponent(googleAddress, "neighborhood")
    || getComponent(googleAddress, "postal_town");

  const validatedAddress = {
    address1: formatAddressLine(googleAddress),
    city: city,
    province: getComponent(googleAddress, "administrative_area_level_1"),
    zip: getComponent(googleAddress, "postal_code"),
    country: "US",
  };

  return {
    status,
    validatedAddress,
    verdict,
    formattedAddress: googleAddress.formattedAddress,
  };
}

function getComponent(address, type) {
  if (!address.addressComponents) return "";
  const component = address.addressComponents.find(
    (c) => c.componentType === type
  );
  return component ? component.componentName.text : "";
}

function formatAddressLine(address) {
  if (!address.addressComponents) return "";
  const streetNumber = address.addressComponents.find(
    (c) => c.componentType === "street_number"
  );
  const route = address.addressComponents.find(
    (c) => c.componentType === "route"
  );
  const subpremise = address.addressComponents.find(
    (c) => c.componentType === "subpremise"
  );

  let line = "";
  if (streetNumber) line += streetNumber.componentName.text;
  if (route) line += ` ${route.componentName.text}`;
  if (subpremise) line += ` ${subpremise.componentName.text}`;
  return line.trim();
}
