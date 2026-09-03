"use client";

import { resetPassword } from "@/api/auth";
import { setAccessToken } from "@/api/token";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertCircle, CheckCircle2, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import "@/lib/i18n";
import { useTranslation } from "react-i18next";

type Status = "form" | "success";

const resetRequests = new Map<string, Promise<void>>();

function resetPasswordOnce(token: string, password: string): Promise<void> {
	let request = resetRequests.get(token);
	if (!request) {
		request = resetPassword(token, password).catch((err) => {
			resetRequests.delete(token);
			throw err;
		});
		resetRequests.set(token, request);
	}
	return request;
}

export default function ResetPasswordPage() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const { t, ready } = useTranslation("common");

	const token = useMemo(() => searchParams.get("token"), [searchParams]);
	const [password, setPassword] = useState("");
	const [confirm, setConfirm] = useState("");
	const [submitting, setSubmitting] = useState(false);
	const [status, setStatus] = useState<Status>("form");
	const [error, setError] = useState<string | null>(null);

	const passwordValid =
		password.length >= 12 &&
		/[A-Z]/.test(password) &&
		/[a-z]/.test(password) &&
		/[0-9]/.test(password);
	const matches = password === confirm;
	const valid = passwordValid && matches;

	if (!ready) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
				<Loader2 className="h-8 w-8 animate-spin" />
			</div>
		);
	}

	return (
		<div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
			<div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-8">
				{!token ? (
					<div className="text-center">
						<XCircle className="mx-auto h-10 w-10 text-red-500" />
						<h1 className="mt-4 font-semibold text-white text-xl">
							{t("reset_invalid_title")}
						</h1>
						<p className="mt-2 text-slate-400 text-sm">
							{t("reset_invalid_desc")}
						</p>
						<Link href="/">
							<Button
								variant="outline"
								className="mt-6 w-full border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
							>
								{t("home")}
							</Button>
						</Link>
					</div>
				) : status === "success" ? (
					<div className="text-center">
						<CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
						<h1 className="mt-4 font-semibold text-white text-xl">
							{t("reset_success_title")}
						</h1>
						<p className="mt-2 text-slate-400 text-sm">
							{t("reset_success_desc")}
						</p>
						<Button
							className="mt-6 w-full bg-red-600 text-white hover:bg-red-700"
							onClick={() => router.replace("/")}
						>
							{t("back_to_login")}
						</Button>
					</div>
				) : (
					<>
						<div className="text-center">
							<h1 className="font-semibold text-white text-xl">
								{t("reset_title")}
							</h1>
							<p className="mt-2 text-slate-400 text-sm">{t("reset_desc")}</p>
						</div>
						<form
							className="mt-6 space-y-4"
							onSubmit={async (e) => {
								e.preventDefault();
								if (!valid || !token) return;
								setSubmitting(true);
								setError(null);
								try {
									await resetPasswordOnce(token, password);
									// Sessions were revoked server-side; drop any stale local
									// token so the user signs in fresh with the new password.
									setAccessToken(null);
									setStatus("success");
								} catch (err) {
									const message = String((err as Error)?.message ?? "");
									setError(
										message.includes("404")
											? t("reset_invalid_desc")
											: t("reset_failed"),
									);
								} finally {
									setSubmitting(false);
								}
							}}
						>
							<div className="space-y-2">
								<Label htmlFor="new-password" className="text-slate-300">
									{t("new_password")}
								</Label>
								<Input
									id="new-password"
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className="border-slate-700 bg-slate-800 text-white"
									required
								/>
								{password && !passwordValid && (
									<p className="flex items-center text-red-400 text-sm">
										<AlertCircle className="mr-1 h-3 w-3" />
										{t("password_requirements")}
									</p>
								)}
							</div>
							<div className="space-y-2">
								<Label htmlFor="confirm-password" className="text-slate-300">
									{t("confirm_password")}
								</Label>
								<Input
									id="confirm-password"
									type="password"
									value={confirm}
									onChange={(e) => setConfirm(e.target.value)}
									className="border-slate-700 bg-slate-800 text-white"
									required
								/>
								{confirm && !matches && (
									<p className="flex items-center text-red-400 text-sm">
										<AlertCircle className="mr-1 h-3 w-3" />
										{t("passwords_dont_match")}
									</p>
								)}
							</div>
							<Button
								type="submit"
								className="w-full bg-red-600 text-white hover:bg-red-700"
								disabled={!valid || submitting}
							>
								{submitting ? (
									<Loader2 className="h-4 w-4 animate-spin" />
								) : (
									t("reset_submit")
								)}
							</Button>
							{error && (
								<p className="flex items-center text-red-400 text-sm">
									<AlertCircle className="mr-1 h-3 w-3" />
									{error}
								</p>
							)}
						</form>
					</>
				)}
			</div>
		</div>
	);
}
