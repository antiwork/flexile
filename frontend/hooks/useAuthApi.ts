import { getSession, signIn } from "next-auth/react";
import { useUserStore } from "../global";
import type { OtpFlowActions, OtpFlowState } from "./useOtpFlowState";

export interface AuthApiConfig {
  type: "login" | "signup";
  sendOtpEndpoint: string;
  invitationToken?: string;
  onSuccess?: () => void;
}

export function useAuthApi(config: AuthApiConfig, state: OtpFlowState, actions: OtpFlowActions) {
  const { login } = useUserStore();

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    actions.setLoading(true);
    actions.clearMessages();

    try {
      const requestBody: Record<string, string> = { email: state.email };

      // Add invitation token if provided (for signup only)
      if (config.type === "signup" && config.invitationToken) {
        requestBody.invitation_token = config.invitationToken;
      }

      const response = await fetch(config.sendOtpEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const data = await response.json();

      if (!response.ok) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        throw new Error(data.error || "Failed to send OTP");
      }

      actions.setStep("otp");
    } catch (error) {
      actions.setError(error instanceof Error ? error.message : "Failed to send OTP");
    } finally {
      actions.setLoading(false);
    }
  };

  const handleAuthenticate = async (e: React.FormEvent) => {
    e.preventDefault();
    actions.setLoading(true);
    actions.setError("");

    try {
      if (config.type === "signup") {
        // Handle signup verification first
        const response = await fetch("/api/signup-verify", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: state.email,
            otp_code: state.otp,
          }),
        });

        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data = await response.json();

        if (!response.ok) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
          throw new Error(data.error || "Signup failed");
        }
      }

      // For both login and signup, sign in with OTP
      console.log('1. OTP submitted, calling signIn...');
      const result = await signIn("otp", {
        email: state.email,
        otp: state.otp,
        redirect: false,
      });
      console.log('2. signIn result:', result);

      if (result?.error) {
        throw new Error("Invalid verification code, please try again.");
      }

      // Get the session to access the JWT
      const session = await getSession();
      console.log('3. session after getSession:', session);
      const sessionUser = session?.user;

      if (sessionUser && "jwt" in sessionUser && typeof sessionUser.jwt === "string") {
        // Fetch user data from backend using the JWT
        const userResponse = await fetch("/api/user-data", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ jwt: sessionUser.jwt }),
        });

        if (userResponse.ok) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          const userData = await userResponse.json();
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          login(userData);
        }
      }

      // Handle redirect
      const redirectUrl =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("redirect_url") : null;
      const targetUrl =
        redirectUrl && redirectUrl.startsWith("/") && !redirectUrl.startsWith("//") ? redirectUrl : "/dashboard";

      console.log('4. About to redirect to:', targetUrl);

      // Check browser storage
      console.log('localStorage:', localStorage.getItem('next-auth.session-token'));
      console.log('document.cookie:', document.cookie);

      window.location.href = targetUrl;
    } catch (error) {
      actions.setError(
        error instanceof Error ? error.message : `${config.type === "signup" ? "Signup" : "Login"} failed`,
      );
    } finally {
      actions.setLoading(false);
    }
  };

  return {
    handleSendOtp,
    handleAuthenticate,
  };
}
