"use client";

import React, { useState } from "react";
import { authClient } from "@/lib/auth-client";

import { Icons } from "@/components/ui/icons";
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
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

type Step = "email" | "otp";
const allowDevOtpPreview =
  process.env.NODE_ENV !== "production" ||
  process.env.NEXT_PUBLIC_VERCEL_ENV === "preview" ||
  process.env.NEXT_PUBLIC_ENABLE_OTP_PREVIEW === "true";

export function LoginComponent() {
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState("");

  const loginWithGoogle = async () => {
    setIsLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (error: any) {
      console.error("Google sign-in error:", error);
      if (error?.message?.includes("provider not found") || error?.message?.includes("google")) {
        toast.error("Google sign-in is not configured. Please use email sign-in instead.");
      } else {
        toast.error("Something went wrong with Google sign-in.");
      }
    } finally {
      setIsLoading(false);
    }
  };

  const sendOtp = async () => {
    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }
    setIsLoading(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      setDevOtp("");

      const { error } = await authClient.emailOtp.sendVerificationOtp({
        email: normalizedEmail,
        type: "sign-in",
      });

      let usedDevFallback = false;

      if (allowDevOtpPreview) {
        try {
          const response = await fetch(
            `/api/auth/test-otp?email=${encodeURIComponent(normalizedEmail)}`
          );
          if (response.ok) {
            const data = await response.json();
            if (data?.otp) {
              setEmail(normalizedEmail);
              setStep("otp");
              setDevOtp(data.otp);
              toast.success(
                data.source === "fallback"
                  ? `Email unavailable. Use code: ${data.otp}`
                  : `Development OTP: ${data.otp}`
              );
              return;
            }
          }
        } catch {
          // Ignore OTP preview failures and fall back to the generic message.
        }
      }

      if (error) {
        if (allowDevOtpPreview) {
          const fallbackResponse = await fetch("/api/auth/dev-send-otp", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ email: normalizedEmail }),
          });

          if (fallbackResponse.ok) {
            const fallbackData = await fallbackResponse.json();
            setEmail(normalizedEmail);
            setStep("otp");
            setDevOtp(fallbackData.otp);
            usedDevFallback = true;
            toast.success(`Development OTP: ${fallbackData.otp}`);
          } else {
            toast.error(error.message || "Failed to send verification code.");
            return;
          }
        } else {
          toast.error(error.message || "Failed to send verification code.");
          return;
        }
      }

      if (usedDevFallback) {
        return;
      }

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
      window.location.href = "/";
    } catch (error) {
      toast.error("Verification failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="shadow-lg my-5">
      <CardHeader className="space-y-1">
        <CardTitle className="text-2xl">Login</CardTitle>
        <CardDescription>Choose your sign-in method</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {/* Google sign-in button */}
        <Button
          variant="outline"
          onClick={loginWithGoogle}
          disabled={isLoading}
          className="w-full"
        >
          <Icons.google className="mr-2 h-4 w-4" />
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              Sign in with email
            </span>
          </div>
        </div>

        {step === "email" && (
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="name@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading}
                onKeyDown={(e) => e.key === "Enter" && sendOtp()}
              />
            </div>
            <Button onClick={sendOtp} disabled={isLoading || !email}>
              <MailIcon className="mr-2 h-4 w-4" />
              Send verification code
            </Button>
          </div>
        )}

        {step === "otp" && (
          <div className="grid gap-3">
            <p className="text-sm text-muted-foreground">
              Enter the 6-digit code sent to <strong>{email}</strong>
            </p>
            {devOtp ? (
              <p className="text-sm text-amber-600">
                Use this verification code: <strong>{devOtp}</strong>
              </p>
            ) : null}
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={setOtp}
                disabled={isLoading}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} />
                  <InputOTPSlot index={1} />
                  <InputOTPSlot index={2} />
                  <InputOTPSlot index={3} />
                  <InputOTPSlot index={4} />
                  <InputOTPSlot index={5} />
                </InputOTPGroup>
              </InputOTP>
            </div>
            <Button onClick={verifyOtp} disabled={isLoading || otp.length !== 6}>
              Verify and sign in
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setStep("email");
                setOtp("");
              }}
              disabled={isLoading}
            >
              Use a different email
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
