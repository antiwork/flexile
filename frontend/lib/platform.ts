export type PlatformKind = "apple" | "other";

type NavigatorWithUAData = Navigator & { userAgentData?: { platform?: string } };
function hasUAData(n: Navigator): n is NavigatorWithUAData {
  return "userAgentData" in n;
}

export function detectPlatform(): PlatformKind {
  if (typeof navigator === "undefined") return "other";

  // In Chromium-based browsers navigator.userAgentData.platform is always available
  if (hasUAData(navigator)) {
    const plat = navigator.userAgentData?.platform?.toLowerCase() ?? "";
    if (plat.includes("mac") || plat.includes("ios")) return "apple";
  }

  // Firefox and Safari don’t support navigator.userAgentData (UA-CH).
  const ua = navigator.userAgent || "";
  // Covers macOS (incl. iPadOS desktop UA), iPhone, iPad
  if (/\b(?:Mac|iPhone|iPad)\b/iu.test(ua)) return "apple";

  return "other";
}
