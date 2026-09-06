"use client";

import i18n from "@/lib/i18n";
import { Loader2 } from "lucide-react";
import { useEffect } from "react";
import { I18nextProvider, useTranslation } from "react-i18next";

function I18nGate({
	children,
	fallback,
}: {
	children: React.ReactNode;
	fallback?: React.ReactNode;
}) {
	const { ready, i18n: instance } = useTranslation("common");
	const isBrowser = typeof window !== "undefined";
	const canRender = isBrowser && ready && i18n.isInitialized;

	useEffect(() => {
		const lng = instance.resolvedLanguage;
		if (lng) document.documentElement.lang = lng;
	}, [instance.resolvedLanguage]);

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
