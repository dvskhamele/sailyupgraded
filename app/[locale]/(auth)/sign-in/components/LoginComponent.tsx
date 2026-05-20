"use client";

import React, { useState } from "react";
import { authClient } from "@/lib/auth-client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { MailIcon } from "lucide-react";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";

type Step = "email" | "otp";
const DASHBOARD_PATH = "/crm/dashboard";
const bypassLogin = process.env.NEXT_PUBLIC_BYPASS_LOGIN === "true";

function getLocalizedPath(path: string, locale: string) {
  return locale ? `/${locale}${path}` : path;
}

type LoginComponentProps = {
  locale: string;
  googleAuthEnabled: boolean;
  googleClientId?: string;
};

export function LoginComponent({
  locale,
  googleAuthEnabled,
  googleClientId,
}: LoginComponentProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [otp, setOtp] = useState("");

  const validateEmail = (value: string) => {
    const regex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    return regex.test(value);
  };

  const sendOtp = async () => {
    if (bypassLogin) {
      window.location.href = getLocalizedPath(DASHBOARD_PATH, locale);
      return;
    }

    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }
    if (!validateEmail(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setIsLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      setOtp("");

      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: "sign-in",
      });

      if (error) {
        toast.error(error.message || "Failed to send verification code.");
        return;
      }

      setEmail(normalizedEmail);
      setStep("otp");
      toast.success("Verification code sent to your email.");
    } catch (error) {
      toast.error("Failed to send verification code.");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (bypassLogin) {
      window.location.href = getLocalizedPath(DASHBOARD_PATH, locale);
      return;
    }

    if (otp.length !== 6) {
      toast.error("Please enter the 6-digit code.");
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await authClient.signIn.emailOtp({
        email,
        otp,
      });
      if (error) {
        toast.error(error.message || "Invalid or expired code.");
        return;
      }
      toast.success("Login successful.");
      window.location.href = getLocalizedPath(DASHBOARD_PATH, locale);
    } catch (error) {
      toast.error("Verification failed.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOtpChange = (value: string) => {
    setOtp(value.replace(/\D/g, "").slice(0, 6));
  };

  return (
    <Card className="mx-auto w-full max-w-md rounded-2xl border bg-white/80 backdrop-blur shadow-xl">
      {/* HEADER */}
      <CardHeader className="space-y-2 text-center">
        <CardTitle className="text-3xl font-bold tracking-tight">
          Sign in
        </CardTitle>

        <CardDescription className="text-sm text-muted-foreground">
          Sign in to continue to your dashboard
        </CardDescription>
        
      </CardHeader>

      {/* CONTENT */}
      <CardContent className="grid gap-5">
        {/* GOOGLE LOGIN */}
        {googleAuthEnabled && googleClientId && (
          <GoogleLoginButton
            clientId={googleClientId}
            dashboardPath={getLocalizedPath(DASHBOARD_PATH, locale)}
          />
        )}

        {/* DIVIDER */}
        {googleAuthEnabled && googleClientId && (
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-3 text-muted-foreground">
                Or continue with email
              </span>
            </div>
          </div>
        )}

        {/* EMAIL STEP */}
        {step === "email" && (
          <div className="grid gap-4 animate-in fade-in-50">
            <div className="grid gap-2">
              <Label htmlFor="email">Email address</Label>

              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setEmailError("");
                }}
                onBlur={() => {
                  if (email && !validateEmail(email)) {
                    setEmailError("Please enter a valid email address.");
                  }
                }}
                disabled={isLoading}
                onKeyDown={(e) => e.key === "Enter" && sendOtp()}
                className="h-11 rounded-lg"
              />
              {emailError && (
                <p className="text-sm text-red-500">{emailError}</p>
              )}
            </div>

            <Button
              onClick={sendOtp}
              disabled={isLoading}
              className="h-11 rounded-lg font-semibold"
            >
              <MailIcon className="mr-2 h-4 w-4" />
              {bypassLogin ? "Continue to Dashboard" : "Send Verification Code"}
            </Button>
          </div>
        )}

        {/* OTP STEP */}
        {step === "otp" && (
          <div className="grid gap-4 animate-in fade-in-50">
            <p className="text-sm text-center text-muted-foreground">
              Enter the code sent to <br />
              <strong className="text-foreground">{email}</strong>
            </p>

            <div className="flex justify-center">
              <Input
                aria-label="Verification code"
                autoComplete="one-time-code"
                className="h-12 w-48 rounded-lg text-center font-mono text-xl tracking-[0.5em]"
                disabled={isLoading}
                inputMode="numeric"
                maxLength={6}
                onChange={(e) => handleOtpChange(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && verifyOtp()}
                pattern="[0-9]*"
                placeholder="000000"
                value={otp}
              />
            </div>

            <Button
              onClick={verifyOtp}
              disabled={isLoading || otp.length !== 6}
              className="h-11 rounded-lg font-semibold"
            >
              Verify & Sign In
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep("email");
                setOtp("");
              }}
              disabled={isLoading}
              className="text-muted-foreground"
            >
              Use different email
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
