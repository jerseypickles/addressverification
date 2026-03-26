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

  // Build formatted address from Google's response
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

  // Determine status based on verdict
  let status = "valid";
  if (verdict.hasUnconfirmedComponents || verdict.hasReplacedComponents) {
    status = "needs_review";
  }
  if (verdict.inputGranularity === "OTHER" || !verdict.addressComplete) {
    status = "invalid";
  }

  // Check if changes are minor (only capitalization, abbreviations, formatting)
  const isMinorChange = status === "needs_review" && isMinorDifference(address, validatedAddress);
  if (isMinorChange) {
    status = "auto_corrected";
  }

  return {
    status,
    validatedAddress,
    verdict,
    formattedAddress: googleAddress.formattedAddress,
    isMinorChange,
  };
}

// Detect if differences are only minor (capitalization, abbreviations, whitespace)
function isMinorDifference(original, validated) {
  const normalize = (s) => (s || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\./g, "")
    .replace(/,/g, "");

  // Common abbreviation mappings
  const abbreviations = {
    street: "st", avenue: "ave", boulevard: "blvd", drive: "dr",
    lane: "ln", road: "rd", court: "ct", place: "pl", circle: "cir",
    terrace: "ter", highway: "hwy", parkway: "pkwy", square: "sq",
    north: "n", south: "s", east: "e", west: "w",
    northeast: "ne", northwest: "nw", southeast: "se", southwest: "sw",
    apartment: "apt", suite: "ste", building: "bldg", floor: "fl",
  };

  const expandAbbreviations = (s) => {
    let result = normalize(s);
    for (const [full, abbr] of Object.entries(abbreviations)) {
      result = result.replace(new RegExp(`\\b${full}\\b`, "g"), abbr);
      result = result.replace(new RegExp(`\\b${abbr}\\b`, "g"), abbr);
    }
    return result;
  };

  const addr1Match = expandAbbreviations(original.address1) === expandAbbreviations(validated.address1);
  const cityMatch = normalize(original.city) === normalize(validated.city);
  const zipMatch = normalize(original.zip) === normalize(validated.zip).split("-")[0];

  // Province: compare normalized (e.g., "New York" vs "NY", "Florida" vs "FL")
  const stateAbbreviations = {
    alabama: "al", alaska: "ak", arizona: "az", arkansas: "ar", california: "ca",
    colorado: "co", connecticut: "ct", delaware: "de", florida: "fl", georgia: "ga",
    hawaii: "hi", idaho: "id", illinois: "il", indiana: "in", iowa: "ia",
    kansas: "ks", kentucky: "ky", louisiana: "la", maine: "me", maryland: "md",
    massachusetts: "ma", michigan: "mi", minnesota: "mn", mississippi: "ms",
    missouri: "mo", montana: "mt", nebraska: "ne", nevada: "nv",
    "new hampshire": "nh", "new jersey": "nj", "new mexico": "nm", "new york": "ny",
    "north carolina": "nc", "north dakota": "nd", ohio: "oh", oklahoma: "ok",
    oregon: "or", pennsylvania: "pa", "rhode island": "ri", "south carolina": "sc",
    "south dakota": "sd", tennessee: "tn", texas: "tx", utah: "ut", vermont: "vt",
    virginia: "va", washington: "wa", "west virginia": "wv", wisconsin: "wi", wyoming: "wy",
    "district of columbia": "dc",
  };

  const normalizeState = (s) => {
    const n = normalize(s);
    return stateAbbreviations[n] || n;
  };

  const provinceMatch = normalizeState(original.province) === normalizeState(validated.province);

  return addr1Match && cityMatch && provinceMatch && zipMatch;
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
