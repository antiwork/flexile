"use client";

export default function OauthRedirect() {
  if (window.opener) (window.opener as WindowProxy).postMessage("oauth-complete");
  // This window will be closed automatically by startOauthRedirectChecker
  return null;
}
