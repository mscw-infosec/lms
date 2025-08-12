"use client";

import { useEffect, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { setAccessToken } from "@/api/token";
import "@/lib/i18n";
import { useTranslation } from "react-i18next";

export default function OAuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();

  const accessToken = useMemo(() => searchParams.get("access_token"), [searchParams]);
  const redirectTo = useMemo(() => searchParams.get("redirect") || "/", [searchParams]);

  useEffect(() => {
    if (!accessToken) {
      router.replace("/");
      return;
    }

    setAccessToken(accessToken);

    router.replace(redirectTo);
  }, [accessToken, redirectTo, router]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center text-slate-300">
      <div className="flex items-center gap-3">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-transparent" />
        <span>{t("completing_sign_in")}</span>
      </div>
    </div>
  );
}
