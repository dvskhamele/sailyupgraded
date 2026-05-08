"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

type GoogleCredentialResponse = {
  credential?: string;
  select_by?: string;
};

type GoogleAccountsId = {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (
    element: HTMLElement,
    options: {
      theme?: "outline" | "filled_blue" | "filled_black";
      size?: "large" | "medium" | "small";
      width?: number;
      text?: "signin_with" | "signup_with" | "continue_with" | "signin";
      shape?: "rectangular" | "pill" | "circle" | "square";
    },
  ) => void;
};

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: GoogleAccountsId;
      };
    };
  }
}

type GoogleLoginButtonProps = {
  clientId: string;
  dashboardPath: string;
};

type GoogleLoginResponse = {
  success: boolean;
  error?: string;
};

const GOOGLE_SCRIPT_ID = "google-identity-services";

function loadGoogleIdentityScript() {
  return new Promise<void>((resolve, reject) => {
    if (window.google?.accounts?.id) {
      resolve();
      return;
    }

    const existingScript = document.getElementById(GOOGLE_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => reject(), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Sign-In."));
    document.head.appendChild(script);
  });
}

export function GoogleLoginButton({
  clientId,
  dashboardPath,
}: GoogleLoginButtonProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const initializedRef = useRef(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      if (!response.credential) {
        toast.error("Google did not return a login credential.");
        return;
      }

      setIsLoading(true);

      try {
        const apiResponse = await fetch("/api/auth/google-login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          credentials: "include",
          body: JSON.stringify({ credential: response.credential }),
        });

        const data = (await apiResponse.json()) as GoogleLoginResponse;

        if (!apiResponse.ok || !data.success) {
          toast.error(
            data.error ||
              "Your account is not registered. Please contact administrator or register first.",
          );
          return;
        }

        toast.success("Login successful.");
        window.location.href = dashboardPath;
      } catch {
        toast.error("Something went wrong with Google login.");
      } finally {
        setIsLoading(false);
      }
    },
    [dashboardPath],
  );

  useEffect(() => {
    let mounted = true;

    async function initializeGoogleButton() {
      try {
        await loadGoogleIdentityScript();

        if (!mounted || !buttonRef.current || initializedRef.current) return;

        window.google?.accounts?.id?.initialize({
          client_id: clientId,
          callback: handleGoogleCredential,
          auto_select: false,
          cancel_on_tap_outside: true,
        });

        window.google?.accounts?.id?.renderButton(buttonRef.current, {
          theme: "outline",
          size: "large",
          width: Math.min(buttonRef.current.clientWidth || 360, 360),
          text: "continue_with",
          shape: "rectangular",
        });

        initializedRef.current = true;
      } catch {
        toast.error("Google sign-in could not be loaded.");
      }
    }

    initializeGoogleButton();

    return () => {
      mounted = false;
    };
  }, [clientId, handleGoogleCredential]);

  return (
    <div className="relative flex min-h-11 w-full items-center justify-center">
      <div
        ref={buttonRef}
        className={isLoading ? "pointer-events-none opacity-50" : undefined}
      />
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-background/70">
          <Loader2 className="h-5 w-5 animate-spin" aria-label="Signing in" />
        </div>
      )}
    </div>
  );
}
