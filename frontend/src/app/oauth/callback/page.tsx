"use client";

import { setAccessToken } from "@/api/token";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import "@/lib/i18n";
import { useTranslation } from "react-i18next";

export default function OAuthCallbackPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { t, ready } = useTranslation();
	const [isClient, setIsClient] = useState(false);

	const accessToken = useMemo(
		() => searchParams.get("access_token"),
		[searchParams],
	);
	const error = useMemo(() => searchParams.get("error"), [searchParams]);
	const redirectTo = useMemo(
		() => searchParams.get("redirect") || "/",
		[searchParams],
	);

	useEffect(() => {
		setIsClient(true);
	}, []);

	useEffect(() => {
		if (!isClient || !ready || error) return;

		if (!accessToken) {
			router.replace("/");
			return;
		}

		setAccessToken(accessToken);

		router.replace(redirectTo);
	}, [accessToken, error, redirectTo, router, isClient, ready]);

	if (!isClient || !ready) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center text-slate-300">
				<div className="flex items-center gap-3">
					<div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-transparent" />
					<span>Loading...</span>
				</div>
			</div>
		);
	}

	if (error) {
		return (
			<div className="flex min-h-[60vh] items-center justify-center px-4 text-slate-300">
				<div className="max-w-md space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-6 text-center">
					<h1 className="font-semibold text-lg text-white">
						{t("oauth_sign_in_failed")}
					</h1>
					<p className="text-slate-400 text-sm">
						{error === "email_missing"
							? t("oauth_email_missing")
							: t("oauth_sign_in_failed_generic")}
					</p>
					<Link
						href="/"
						className="inline-block text-red-400 text-sm underline hover:text-red-300"
					>
						{t("back_to_home")}
					</Link>
				</div>
			</div>
		);
	}

	return (
		<div className="flex min-h-[60vh] items-center justify-center text-slate-300">
			<div className="flex items-center gap-3">
				<div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-600 border-t-transparent" />
				<span>{t("completing_sign_in")}</span>
			</div>
		</div>
	);
}
