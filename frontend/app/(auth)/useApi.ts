import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { getSession, signIn } from "next-auth/react";
import { z } from "zod";
import { useUserStore } from "@/global";
import { currentUserSchema } from "@/models/user";
import { request } from "@/utils/request";

export const useSendOtp = (url: string, data: { email: string; invitation_token?: string }) =>
  useMutation({
    mutationFn: async () => {
      const response = await request({
        url,
        method: "POST",
        accept: "json",
        jsonData: data,
      });

      if (!response.ok) {
        throw new Error(
          z.object({ error: z.string() }).safeParse(await response.json()).data?.error || "Failed to send OTP",
        );
      }
    },
  });

export const useVerifyOtp = (data: { email: string; otp_code: string }) => {
  const router = useRouter();
  const { login } = useUserStore();
  return useMutation({
    mutationFn: async () => {
      const result = await signIn("otp", {
        email: data.email,
        otp: data.otp_code,
        redirect: false,
      });

      if (result?.error) throw new Error(result.error);

      const session = await getSession();

      const userResponse = await request({
        url: "/api/user-data",
        method: "POST",
        accept: "json",
        jsonData: { jwt: session?.user.jwt },
      });

      if (userResponse.ok) {
        login(currentUserSchema.parse(await userResponse.json()));
      }

      // Handle redirect
      const redirectUrl =
        typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("redirect_url") : null;
      router.replace(
        // @ts-expect-error - Next currently does not allow checking this at runtime - the leading / ensures this is safe
        redirectUrl && redirectUrl.startsWith("/") && !redirectUrl.startsWith("//") ? redirectUrl : "/dashboard",
      );
    },
  });
};
