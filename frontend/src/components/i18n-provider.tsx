"use client";

import i18n from "@/lib/i18n";
import { I18nextProvider } from "react-i18next";

export function I18nProvider({ children }: { children: React.ReactNode }) {
	return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
