export type PlatformKind = "apple" | "other";

type NavigatorWithUAData = Navigator & { userAgentData?: { platform?: string } };
function hasUAData(n: Navigator): n is NavigatorWithUAData {
  return "userAgentData" in n;
}

export function detectPlatform(): PlatformKind {
  if (typeof navigator === "undefined") return "other";

  if (hasUAData(navigator)) {
    const plat = navigator.userAgentData?.platform?.toLowerCase() ?? "";
    if (plat.includes("mac") || plat.includes("ios")) return "apple";
  }

  const ua = navigator.userAgent || "";
  if (/\b(?:Mac|iPhone|iPad)\b/iu.test(ua)) return "apple";

  return "other";
}
