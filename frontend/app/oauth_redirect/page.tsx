"use client";

import { useEffect } from "react";

export default function OauthRedirect() {
  // This window will be closed automatically by startOauthRedirectChecker
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- window.opener is not typed correctly
    if (window.opener) (window.opener as WindowProxy).postMessage("oauth-complete");
  }, []);

  return null;
}
