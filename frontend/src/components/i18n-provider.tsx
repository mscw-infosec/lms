"use client";

import i18n from "@/lib/i18n";
import { I18nextProvider, useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";

function I18nGate({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {

  const { ready } = useTranslation("common");
  const isBrowser = typeof window !== "undefined";
  const canRender = isBrowser && ready && i18n.isInitialized;

  if (!canRender) {
    return (
      (fallback as React.ReactElement) ?? (
        <div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
          <Loader2 className="h-8 w-8 animate-spin text-slate-300" />
        </div>
      )
    );
  }
  return <>{children}</>;
}

export function I18nProvider({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  return (
    <I18nextProvider i18n={i18n}>
      <I18nGate fallback={fallback}>{children}</I18nGate>
    </I18nextProvider>
  );
}
