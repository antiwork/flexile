import { useState } from "react";

export type OtpStep = "email" | "otp";

export interface OtpFlowState {
  step: OtpStep;
  email: string;
  otp: string;
  loading: boolean;
  error: string;
  success: string;
}

export interface OtpFlowActions {
  setStep: (step: OtpStep) => void;
  setEmail: (email: string) => void;
  setOtp: (otp: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string) => void;
  setSuccess: (success: string) => void;
  clearMessages: () => void;
  backToEmail: () => void;
}

export function useOtpFlowState(): [OtpFlowState, OtpFlowActions] {
  const [step, setStep] = useState<OtpStep>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const clearMessages = () => {
    setError("");
    setSuccess("");
  };

  const backToEmail = () => {
    setStep("email");
    setOtp("");
    setError("");
    setSuccess("");
  };

  const state: OtpFlowState = {
    step,
    email,
    otp,
    loading,
    error,
    success,
  };

  const actions: OtpFlowActions = {
    setStep,
    setEmail,
    setOtp,
    setLoading,
    setError,
    setSuccess,
    clearMessages,
    backToEmail,
  };

  return [state, actions];
}
