"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function AuthCallbackPage() {
  const router = useRouter();
  const params = useSearchParams();
  useEffect(() => {
    const token = params.get("token");
    if (token) { window.localStorage.setItem("connect-session", token); router.replace("/dashboard"); }
    else router.replace("/?auth=failed");
  }, [params, router]);
  return <main className="grid min-h-screen place-items-center bg-[#f3f1eb] text-[#183b31]">Signing you in…</main>;
}
