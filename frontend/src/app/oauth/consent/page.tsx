"use client";

import {
	type ConsentRequest,
	decideConsent,
	getConsentRequest,
} from "@/api/sso";
import { getAccessToken } from "@/api/token";
import { AuthModal } from "@/components/auth-modal";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import "@/lib/i18n";
import {
	AlertCircle,
	AppWindow,
	Check,
	Loader2,
	ShieldCheck,
} from "lucide-react";
import { useTranslation } from "react-i18next";

type Status = "loading" | "signin" | "ready" | "submitting" | "error";

/** Short, honest descriptions of what each scope actually hands over. */
const SCOPE_LABEL_KEYS: Record<string, string> = {
	openid: "sso_scope_openid",
	profile: "sso_scope_profile",
	email: "sso_scope_email",
	roles: "sso_scope_roles",
	attributes: "sso_scope_attributes",
	offline_access: "sso_scope_offline_access",
};

const SCOPE_FALLBACKS: Record<string, string> = {
	openid: "Confirm your identity",
	profile: "Your name and profile picture",
	email: "Your email address",
	roles: "Your role in the LMS",
	attributes: "Your account attributes (group, cohort, and similar)",
	offline_access: "Stay signed in when you are not using the app",
};

export default function SsoConsentPage() {
	const searchParams = useSearchParams();
	const { t, ready } = useTranslation("common");

	const requestId = searchParams.get("request_id");

	const [status, setStatus] = useState<Status>("loading");
	const [request, setRequest] = useState<ConsentRequest | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [authModalOpen, setAuthModalOpen] = useState(false);

	/** Leaves the SPA entirely: the relying party takes over from here. */
	const leaveTo = useCallback((url: string) => {
		window.location.replace(url);
	}, []);

	const submit = useCallback(
		async (approve: boolean) => {
			if (!requestId) return;
			setStatus("submitting");
			try {
				const { redirect_to } = await decideConsent(requestId, approve);
				leaveTo(redirect_to);
			} catch (err) {
				setError((err as Error)?.message ?? "");
				setStatus("error");
			}
		},
		[requestId, leaveTo],
	);

	const load = useCallback(async () => {
		if (!requestId) {
			setError(t("sso_missing_request") || "This link is missing a request.");
			setStatus("error");
			return;
		}

		if (!getAccessToken()) {
			setStatus("signin");
			setAuthModalOpen(true);
			return;
		}

		setStatus("loading");
		try {
			const data = await getConsentRequest(requestId);

			// Nothing new is being asked for - don't make the user click through
			// a screen that says "you already agreed to this".
			if (data.already_granted) {
				const { redirect_to } = await decideConsent(requestId, true);
				leaveTo(redirect_to);
				return;
			}

			setRequest(data);
			setStatus("ready");
		} catch (err) {
			const message = String((err as Error)?.message ?? "");
			// The session may have lapsed between the redirect and this fetch.
			if (message.includes("401") || message.includes("Unauthorized")) {
				setStatus("signin");
				setAuthModalOpen(true);
				return;
			}
			setError(message);
			setStatus("error");
		}
	}, [requestId, t, leaveTo]);

	useEffect(() => {
		if (!ready) return;
		void load();
	}, [ready, load]);

	if (!ready || status === "loading") {
		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-950">
				<Loader2 className="h-6 w-6 animate-spin text-slate-400" />
			</div>
		);
	}

	if (status === "signin") {
		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
				<Card className="w-full max-w-md border-slate-800 bg-slate-900">
					<CardHeader>
						<CardTitle className="text-white">
							{t("sso_sign_in_title") || "Sign in to continue"}
						</CardTitle>
						<CardDescription className="text-slate-400">
							{t("sso_sign_in_description") ||
								"An application is asking to use your LMS account."}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<Button
							className="w-full bg-red-600 text-white hover:bg-red-700"
							onClick={() => setAuthModalOpen(true)}
						>
							{t("login") || "Log in"}
						</Button>
					</CardContent>
				</Card>

				<AuthModal
					type={authModalOpen ? "login" : null}
					onClose={() => setAuthModalOpen(false)}
					onLoginSuccess={() => {
						setAuthModalOpen(false);
						void load();
					}}
				/>
			</div>
		);
	}

	if (status === "error" || !request) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
				<Card className="w-full max-w-md border-slate-800 bg-slate-900">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-white">
							<AlertCircle className="h-5 w-5 text-red-400" />
							{t("sso_request_failed") || "Request cannot be completed"}
						</CardTitle>
						<CardDescription className="text-slate-400">
							{error || t("sso_request_expired") || "This request has expired."}
						</CardDescription>
					</CardHeader>
					<CardContent>
						<p className="text-slate-400 text-sm">
							{t("sso_start_again") ||
								"Go back to the application and start signing in again."}
						</p>
					</CardContent>
				</Card>
			</div>
		);
	}

	const busy = status === "submitting";

	return (
		<div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10">
			<Card className="w-full max-w-lg border-slate-800 bg-slate-900">
				<CardHeader className="space-y-4">
					<div className="flex items-center gap-3">
						{request.client_logo_url ? (
							<img
								src={request.client_logo_url}
								alt=""
								className="h-12 w-12 rounded-lg object-contain"
							/>
						) : (
							<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-slate-800">
								<AppWindow className="h-6 w-6 text-slate-300" />
							</div>
						)}
						<div>
							<CardTitle className="text-white">
								{t("sso_consent_title", { app: request.client_name }) ||
									`${request.client_name} wants to use your LMS account`}
							</CardTitle>
							<CardDescription className="text-slate-400">
								{t("sso_consent_redirect", { host: request.redirect_host }) ||
									`You will be returned to ${request.redirect_host}`}
							</CardDescription>
						</div>
					</div>

					{request.client_description ? (
						<p className="text-slate-400 text-sm">
							{request.client_description}
						</p>
					) : null}
				</CardHeader>

				<CardContent className="space-y-6">
					<div>
						<div className="mb-3 font-medium text-sm text-white">
							{t("sso_will_be_able_to") || "This application will be able to:"}
						</div>
						<ul className="space-y-2">
							{request.scopes.map((scope) => (
								<li key={scope} className="flex items-start gap-2 text-sm">
									<Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
									<span className="text-slate-300">
										{t(SCOPE_LABEL_KEYS[scope] ?? "") ||
											SCOPE_FALLBACKS[scope] ||
											scope}
									</span>
								</li>
							))}
						</ul>
					</div>

					<div className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
						<ShieldCheck className="h-4 w-4 shrink-0 text-slate-400" />
						<span className="text-slate-300">
							{t("sso_signed_in_as", { email: request.user_email }) ||
								`Signed in as ${request.user_email}`}
						</span>
					</div>

					<div className="flex flex-col gap-2 sm:flex-row-reverse">
						<Button
							className="flex-1 bg-red-600 text-white hover:bg-red-700"
							disabled={busy}
							onClick={() => void submit(true)}
						>
							{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
							{t("sso_allow") || "Allow"}
						</Button>
						<Button
							variant="outline"
							className="flex-1 border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
							disabled={busy}
							onClick={() => void submit(false)}
						>
							{t("sso_deny") || "Cancel"}
						</Button>
					</div>

					<p className="text-slate-500 text-xs">
						{t("sso_revoke_hint") ||
							"You can disconnect this application at any time from your account page."}
					</p>
				</CardContent>
			</Card>
		</div>
	);
}
