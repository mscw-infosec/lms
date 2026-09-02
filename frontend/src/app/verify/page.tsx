"use client";

import { refreshAccessToken, verifyEmail } from "@/api/auth";
import { getAccessToken } from "@/api/token";
import { Button } from "@/components/ui/button";
import { useUserStore } from "@/store/user";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import "@/lib/i18n";
import { useTranslation } from "react-i18next";

type Status = "verifying" | "success" | "error";

const verifyRequests = new Map<string, Promise<void>>();

function verifyTokenOnce(token: string): Promise<void> {
	let request = verifyRequests.get(token);
	if (!request) {
		request = (async () => {
			await verifyEmail(token);
			if (getAccessToken()) {
				try {
					await refreshAccessToken();
				} catch {}
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

	const token = useMemo(() => searchParams.get("token"), [searchParams]);

	useEffect(() => {
		if (!token) {
			setStatus("error");
			return;
		}

		let cancelled = false;
		verifyTokenOnce(token)
			.then(async () => {
				await refreshUser();
				if (!cancelled) setStatus("success");
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
							{t("verify_success_desc")}
						</p>
						<Button
							className="mt-6 w-full bg-red-600 text-white hover:bg-red-700"
							onClick={() => router.replace("/")}
						>
							{t("verify_continue")}
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
