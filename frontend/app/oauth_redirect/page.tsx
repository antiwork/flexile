"use client";

export default function OauthRedirect() {
  // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- window.opener is not typed correctly
  if (window.opener) (window.opener as WindowProxy).postMessage("oauth-complete");
  // This window will be closed automatically by startOauthRedirectChecker
  return null;
}
