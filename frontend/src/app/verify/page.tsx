"use client";

import { refreshAccessToken, verifyEmail } from "@/api/auth";
import { getAccessToken, setAccessToken } from "@/api/token";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/store/user";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import "@/lib/i18n";
import { useTranslation } from "react-i18next";

type Status = "verifying" | "success" | "error";

const verifyRequests = new Map<string, Promise<boolean>>();

function verifyTokenOnce(token: string): Promise<boolean> {
	let request = verifyRequests.get(token);
	if (!request) {
		request = (async () => {
			await verifyEmail(token);

			// The verification link is often opened in a different browser or
			// device from the one that registered. Only report "you're signed
			// in" when we can actually refresh this browser's session into a
			// verified access token.
			if (!getAccessToken()) {
				return false;
			}
			try {
				await refreshAccessToken();
				return true;
			} catch {
				// The stored token can't be refreshed (no/expired refresh
				// cookie): it's stale and, worse, still carries the old
				// unverified claim. Drop it so the user signs in cleanly rather
				// than being stuck behind the gate with a false "logged in".
				setAccessToken(null);
				return false;
			}
		})();
		verifyRequests.set(token, request);
	}
	return request;
}

export default function VerifyEmailPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { t, ready } = useTranslation("common");
	const { refreshUser } = useUserStore();
	const [status, setStatus] = useState<Status>("verifying");
	const [authed, setAuthed] = useState(false);

	const token = useMemo(() => searchParams.get("token"), [searchParams]);

	useEffect(() => {
		if (!token) {
			setStatus("error");
			return;
		}

		let cancelled = false;
		verifyTokenOnce(token)
			.then(async (isAuthed) => {
				await refreshUser();
				if (cancelled) return;
				setAuthed(isAuthed);
				setStatus("success");
			})
			.catch(() => {
				if (!cancelled) setStatus("error");
			});

		return () => {
			cancelled = true;
		};
	}, [token, refreshUser]);

	if (!ready) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
				<Loader2 className="h-8 w-8 animate-spin" />
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
			<div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-8 text-center">
				{status === "verifying" && (
					<>
						<Loader2 className="mx-auto h-10 w-10 animate-spin text-slate-300" />
						<h1 className="mt-4 font-semibold text-white text-xl">
							{t("verify_in_progress")}
						</h1>
					</>
				)}

				{status === "success" && (
					<>
						<CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
						<h1 className="mt-4 font-semibold text-white text-xl">
							{t("verify_success_title")}
						</h1>
						<p className="mt-2 text-slate-400 text-sm">
							{authed
								? t("verify_success_desc")
								: t("verify_success_login_prompt")}
						</p>
						<Button
							className="mt-6 w-full bg-red-600 text-white hover:bg-red-700"
							onClick={() => router.replace("/")}
						>
							{authed ? t("verify_continue") : t("sign_in")}
						</Button>
					</>
				)}

				{status === "error" && (
					<>
						<XCircle className="mx-auto h-10 w-10 text-red-500" />
						<h1 className="mt-4 font-semibold text-white text-xl">
							{t("verify_error_title")}
						</h1>
						<p className="mt-2 text-slate-400 text-sm">
							{t("verify_error_desc")}
						</p>
						<Link href="/">
							<Button
								variant="outline"
								className="mt-6 w-full border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
							>
								{t("home")}
							</Button>
						</Link>
					</>
				)}
			</div>
		</div>
	);
}
