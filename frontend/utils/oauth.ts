export const getOauthCode = (url: string) =>
  new Promise<{ code: string; params: URLSearchParams }>((resolve, reject) => {
    const popup = window.open(url, undefined, "popup=yes");
    if (!popup) return reject(new Error("Popup not opened"));
    const onMessage = (event: MessageEvent) => {
      if (event.source === popup && event.origin === window.location.origin && event.data === "oauth-complete") {
        popup.close();
        cleanup();
        const searchParams = new URL(popup.location.href).searchParams;
        const code = searchParams.get("code");
        const error = searchParams.get("error");
        if (code) resolve({ code, params: searchParams });
        else reject(new Error(error ?? "No code received"));
      }
    };
    window.addEventListener("message", onMessage);
    const oauthRedirectChecker = setInterval(() => {
      if (popup.closed) {
        cleanup();
        reject(new Error("Popup closed"));
      }
    }, 500);
    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearInterval(oauthRedirectChecker);
    };
  });
