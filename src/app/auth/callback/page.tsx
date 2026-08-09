"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function AuthCallbackInner() {
  const router = useRouter();
  const params = useSearchParams();

  useEffect(() => {
    const token = params.get("token");
    if (token) {
      window.localStorage.setItem("connect-session", token);
      // Send new users to profile setup, returning users straight to dashboard
      const isNew = params.get("new") === "1";
      router.replace(isNew ? "/profile/setup" : "/dashboard");
    } else {
      router.replace("/?auth=failed");
    }
  }, [params, router]);

  return (
    <main className="grid min-h-screen place-items-center bg-[#f3f1eb] text-[#183b31]">
      Signing you in…
    </main>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense
      fallback={
        <main className="grid min-h-screen place-items-center bg-[#f3f1eb] text-[#183b31]">
          Signing you in…
        </main>
      }
    >
      <AuthCallbackInner />
    </Suspense>
  );
}
