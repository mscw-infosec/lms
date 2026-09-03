"use client";

import {
	logoutAllSessions,
	refreshAccessToken,
	resendVerification,
	updateProfile,
} from "@/api/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { useUserStore } from "@/store/user";
import { Loader2, LogOut, MailCheck, UserPen } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";

const BYPASS_PREFIXES = ["/verify", "/reset-password", "/oauth"];

export function AccountGate({ children }: { children: ReactNode }) {
	const { user, hasToken, loading, refreshUser } = useUserStore();
	const pathname = usePathname();

	const bypass = BYPASS_PREFIXES.some((p) => pathname?.startsWith(p));

	if (bypass || loading || !hasToken || !user) {
		return <>{children}</>;
	}

	if (!user.email_verified) {
		return <VerifyEmailWall />;
	}

	if (!user.profile_complete) {
		return <CompleteProfileWall onDone={refreshUser} />;
	}

	return <>{children}</>;
}

function GateShell({ children }: { children: ReactNode }) {
	return (
		<div className="flex min-h-screen items-center justify-center bg-slate-950 px-4">
			<div className="w-full max-w-md rounded-xl border border-slate-800 bg-slate-900 p-8">
				{children}
			</div>
		</div>
	);
}

function LogoutLink() {
	const { t } = useTranslation("common");
	const router = useRouter();
	const [loggingOut, setLoggingOut] = useState(false);

	return (
		<button
			type="button"
			className="mt-4 flex w-full items-center justify-center gap-2 text-slate-400 text-sm hover:text-slate-200 disabled:opacity-50"
			disabled={loggingOut}
			onClick={async () => {
				setLoggingOut(true);
				try {
					await logoutAllSessions();
				} finally {
					router.push("/");
				}
			}}
		>
			<LogOut className="h-4 w-4" />
			{loggingOut ? t("logging_out") : t("logout")}
		</button>
	);
}

function VerifyEmailWall() {
	const { t } = useTranslation("common");
	const { user, refreshUser } = useUserStore();
	const [sending, setSending] = useState(false);
	const [checking, setChecking] = useState(false);

	return (
		<GateShell>
			<div className="text-center">
				<MailCheck className="mx-auto h-10 w-10 text-red-500" />
				<h1 className="mt-4 font-semibold text-white text-xl">
					{t("gate_verify_title")}
				</h1>
				<p className="mt-2 text-slate-400 text-sm">
					{t("gate_verify_desc", { email: user?.email })}
				</p>
			</div>

			<div className="mt-6 space-y-2">
				<Button
					className="w-full bg-red-600 text-white hover:bg-red-700"
					disabled={sending}
					onClick={async () => {
						setSending(true);
						try {
							await resendVerification();
							toast({
								title: t("gate_verify_resent_title"),
								description: t("gate_verify_resent_desc"),
							});
						} catch (e) {
							toast({
								title: t("error"),
								description: String((e as Error)?.message ?? ""),
								variant: "destructive",
							});
						} finally {
							setSending(false);
						}
					}}
				>
					{sending ? t("sending") : t("gate_verify_resend")}
				</Button>

				<Button
					variant="outline"
					className="w-full border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
					disabled={checking}
					onClick={async () => {
						setChecking(true);
						try {
							await refreshAccessToken();
							await refreshUser();
						} finally {
							setChecking(false);
						}
					}}
				>
					{checking ? (
						<Loader2 className="h-4 w-4 animate-spin" />
					) : (
						t("gate_verify_check")
					)}
				</Button>

				<LogoutLink />
			</div>
		</GateShell>
	);
}

function CompleteProfileWall({ onDone }: { onDone: () => Promise<void> }) {
	const { t } = useTranslation("common");
	const { user } = useUserStore();
	const [lastName, setLastName] = useState(user?.last_name ?? "");
	const [firstName, setFirstName] = useState(user?.first_name ?? "");
	const [patronymic, setPatronymic] = useState(user?.patronymic ?? "");
	const [saving, setSaving] = useState(false);

	const valid = lastName.trim().length > 0 && firstName.trim().length > 0;

	return (
		<GateShell>
			<div className="text-center">
				<UserPen className="mx-auto h-10 w-10 text-red-500" />
				<h1 className="mt-4 font-semibold text-white text-xl">
					{t("gate_profile_title")}
				</h1>
				<p className="mt-2 text-slate-400 text-sm">{t("gate_profile_desc")}</p>
			</div>

			<form
				className="mt-6 space-y-4"
				onSubmit={async (e) => {
					e.preventDefault();
					if (!valid) return;
					setSaving(true);
					try {
						await updateProfile({
							last_name: lastName.trim(),
							first_name: firstName.trim(),
							patronymic: patronymic.trim() ? patronymic.trim() : null,
						});
						// Pick up the lifted gate flag, then re-fetch the profile.
						await refreshAccessToken();
						await onDone();
					} catch (err) {
						toast({
							title: t("error"),
							description: String((err as Error)?.message ?? ""),
							variant: "destructive",
						});
					} finally {
						setSaving(false);
					}
				}}
			>
				<div className="space-y-2">
					<Label htmlFor="gate-last" className="text-slate-300">
						{t("last_name")}
					</Label>
					<Input
						id="gate-last"
						value={lastName}
						onChange={(e) => setLastName(e.target.value)}
						className="border-slate-700 bg-slate-800 text-white"
						required
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="gate-first" className="text-slate-300">
						{t("first_name")}
					</Label>
					<Input
						id="gate-first"
						value={firstName}
						onChange={(e) => setFirstName(e.target.value)}
						className="border-slate-700 bg-slate-800 text-white"
						required
					/>
				</div>
				<div className="space-y-2">
					<Label htmlFor="gate-patronymic" className="text-slate-300">
						{t("patronymic")}{" "}
						<span className="text-slate-500 text-xs">
							({t("optional_hint")})
						</span>
					</Label>
					<Input
						id="gate-patronymic"
						value={patronymic}
						onChange={(e) => setPatronymic(e.target.value)}
						className="border-slate-700 bg-slate-800 text-white"
					/>
				</div>

				<Button
					type="submit"
					className="w-full bg-red-600 text-white hover:bg-red-700"
					disabled={!valid || saving}
				>
					{saving ? t("saving") : t("gate_profile_save")}
				</Button>
				<LogoutLink />
			</form>
		</GateShell>
	);
}
