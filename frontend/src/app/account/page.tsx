"use client";

import {
	type GetUserResponseDTO,
	type SessionInfo,
	getAvatarUpload,
	getCurrentUser,
	getSessions,
	logoutAllSessions,
	logoutSession,
} from "@/api/auth";
import { AuthModal } from "@/components/auth-modal";
import { Header } from "@/components/header";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import {
	bumpAvatar,
	ensureAvatarChecked,
	getAvatarExists,
	getAvatarSrc,
} from "@/lib/avatar-cache";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Home, Loader2, LogOut, Shield, Smartphone } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export default function AccountPage() {
	const { t } = useTranslation("common");
	const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);
	const [avatarFile, setAvatarFile] = useState<File | null>(null);
	const queryClient = useQueryClient();

	const meQuery = useQuery<GetUserResponseDTO, Error>({
		queryKey: ["me"],
		queryFn: getCurrentUser,
		retry: false,
	});

	const sessionsQuery = useQuery<SessionInfo[], Error>({
		queryKey: ["sessions"],
		queryFn: getSessions,
		enabled: !!meQuery.data, // only fetch sessions if user is loaded
	});

	const user = meQuery.data ?? null;
	const sessions = sessionsQuery.data ?? null;

	useEffect(() => {
		if (user?.id) {
			ensureAvatarChecked(user.id);
		}
	}, [user?.id]);

	const handleAvatarChange = (file: File | null) => {
		if (!file) {
			setAvatarFile(null);
			return;
		}
		if (!file.type.startsWith("image/")) {
			toast({
				title: t("invalid_file"),
				description: t("please_select_image"),
				variant: "destructive",
			});
			return;
		}
		const MAX_MB = 5;
		if (file.size > MAX_MB * 1024 * 1024) {
			toast({
				title: t("file_too_large"),
				description: t("max_size", { size: MAX_MB }),
				variant: "destructive",
			});
			return;
		}
		setAvatarFile(file);
	};

	const uploadAvatarMutation = useMutation<void, Error, void>({
		mutationFn: async () => {
			if (!avatarFile) return;
			const presign = await getAvatarUpload();
			const hasFormFields =
				presign?.fields && Object.keys(presign.fields).length > 0;
			let res: Response;
			if (hasFormFields) {
				const form = new FormData();
				for (const [k, v] of Object.entries(presign.fields || {})) {
					form.append(k, v);
				}
				if (
					avatarFile.type &&
					!(
						presign.fields &&
						Object.prototype.hasOwnProperty.call(presign.fields, "Content-Type")
					)
				) {
					form.append("Content-Type", avatarFile.type);
				}
				form.append("file", avatarFile);
				res = await fetch(presign.url, {
					method: "POST",
					body: form,
					cache: "no-store",
				});
			} else {
				res = await fetch(presign.url, {
					method: "PUT",
					headers: avatarFile.type
						? { "Content-Type": avatarFile.type }
						: undefined,
					body: avatarFile,
					cache: "no-store",
				});
			}
			if (!res.ok) {
				let detail = "";
				try {
					detail = await res.text();
				} catch {}
				const hint =
					res.status === 403
						? " Presigned URL may be expired or signature/headers mismatch."
						: "";
				throw new Error(
					`Upload failed (${res.status}). ${detail || ""}${hint}`.trim(),
				);
			}
		},
		onSuccess: async () => {
			toast({
				title: t("avatar_updated"),
				description: t("avatar_uploaded_successfully"),
			});
			bumpAvatar(user?.id);
			await queryClient.invalidateQueries({ queryKey: ["me"] });
			setAvatarFile(null);
		},
		onError: (e) => {
			toast({
				title: t("upload_error"),
				description: e.message,
				variant: "destructive",
			});
		},
	});

	const gradients = useMemo(
		() => [
			"bg-gradient-to-br from-red-500 to-orange-600",
			"bg-gradient-to-br from-blue-500 to-cyan-600",
			"bg-gradient-to-br from-purple-500 to-pink-600",
			"bg-gradient-to-br from-green-500 to-teal-600",
			"bg-gradient-to-br from-indigo-500 to-blue-600",
			"bg-gradient-to-br from-yellow-500 to-orange-600",
		],
		[],
	);

	const avatarColor = user
		? gradients[user.username.length % gradients.length]
		: gradients[0];

	const logoutAllMutation = useMutation<void, Error, void>({
		mutationFn: logoutAllSessions,
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({ queryKey: ["sessions"] }),
				queryClient.invalidateQueries({ queryKey: ["me"] }),
			]);
		},
	});

	const revokeSessionMutation = useMutation<void, Error, string>({
		mutationFn: (jti: string) => logoutSession(jti),
		onSuccess: async () => {
			await queryClient.invalidateQueries({ queryKey: ["sessions"] });
		},
	});

	const logoutMutation = useMutation<void, Error, void>({
		mutationFn: logoutAllSessions,
		onSuccess: async () => {
			queryClient.clear();

			toast({
				title: t("logged_out"),
				description: t("logged_out_successfully"),
			});
		},
	});

	if (meQuery.isLoading || sessionsQuery.isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
				<Loader2 className="h-8 w-8 animate-spin text-slate-300" />
			</div>
		);
	}

	if (meQuery.error || !user) {
		return (
			<div className="min-h-screen bg-slate-950">
				<Header
					onLogin={() => setAuthModal("login")}
					onRegister={() => setAuthModal("register")}
				/>
				<main className="container mx-auto px-4 py-8">
					<div className="mx-auto max-w-2xl">
						<Card className="border-slate-800 bg-slate-900">
							<CardHeader>
								<CardTitle className="text-white">
									{t("sign_in_required")}
								</CardTitle>
								<CardDescription className="text-slate-400">
									{String(meQuery.error?.message || "").includes("401")
										? t("please_login_to_view_account")
										: t("could_not_load_account")}
								</CardDescription>
							</CardHeader>
							<CardContent className="flex gap-3">
								<Button
									variant="outline"
									className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
									onClick={() => setAuthModal("login")}
								>
									{t("login")}
								</Button>
								<Button
									className="bg-red-600 text-white hover:bg-red-700"
									onClick={() => setAuthModal("register")}
								>
									{t("register")}
								</Button>
								<Link href="/">
									<Button
										variant="outline"
										className="ml-auto border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
									>
										<Home className="mr-2 h-4 w-4" />
										{t("home")}
									</Button>
								</Link>
							</CardContent>
						</Card>
					</div>
				</main>
				<AuthModal type={authModal} onClose={() => setAuthModal(null)} />
			</div>
		);
	}

	return (
		<div className="min-h-screen bg-slate-950">
			<Header
				onLogin={() => setAuthModal("login")}
				onRegister={() => setAuthModal("register")}
			/>

			<main className="container mx-auto px-4 py-8">
				<div className="mx-auto max-w-3xl space-y-6">
					{/* Breadcrumb/back and logout */}
					<div className="flex items-center justify-between">
						<Link href="/">
							<Button
								variant="outline"
								size="sm"
								className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
							>
								<Home className="mr-2 h-4 w-4" />
								{t("back_to_home")}
							</Button>
						</Link>
						<Button
							onClick={() => logoutMutation.mutate()}
							disabled={logoutMutation.isPending}
							className="bg-red-600 text-white hover:bg-red-700"
							size="sm"
						>
							<LogOut className="mr-2 h-4 w-4" />
							{logoutMutation.isPending ? t("logging_out") : t("logout")}
						</Button>
					</div>

					{/* Profile card */}
					<Card className="border-slate-800 bg-slate-900">
						<CardHeader>
							<CardTitle className="text-white">{t("account_title")}</CardTitle>
							<CardDescription className="text-slate-400">
								{t("account_subtitle")}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<div className="flex items-center gap-4">
								<Avatar className="h-16 w-16 ring-1 ring-slate-700">
									{user ? (
										<AvatarImage
											src={getAvatarSrc(user.id)}
											alt={user.username}
										/>
									) : null}
									{(() => {
										const exists = user ? getAvatarExists(user.id) : false;
										return (
											<AvatarFallback
												className={
													exists
														? `animate-pulse ${avatarColor}`
														: `text-white ${avatarColor}`
												}
											>
												{exists ? null : (
													<Shield className="h-8 w-8 text-white opacity-80" />
												)}
											</AvatarFallback>
										);
									})()}
								</Avatar>
								<div>
									<div className="font-semibold text-white">
										{user.username}
									</div>
									<div className="text-slate-400 text-sm">{user.email}</div>
									<div className="mt-1 text-slate-400 text-xs">
										Role: <span className="text-slate-300">{user.role}</span>
									</div>
								</div>
							</div>

							{/* Avatar upload */}
							<div className="mt-6 grid gap-2">
								<Label htmlFor="avatar" className="text-slate-300">
									{t("upload_avatar")}
								</Label>
								<Input
									id="avatar"
									type="file"
									accept="image/*"
									onChange={(e) =>
										handleAvatarChange(e.target.files?.[0] || null)
									}
									className="pb-12"
								/>
								<div className="flex items-center gap-2">
									<Button
										onClick={() => uploadAvatarMutation.mutate()}
										disabled={!avatarFile || uploadAvatarMutation.isPending}
										className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
									>
										{uploadAvatarMutation.isPending
											? t("uploading")
											: t("upload")}
									</Button>
									{avatarFile ? (
										<span className="text-slate-400 text-xs">
											{avatarFile.name} • {(avatarFile.size / 1024).toFixed(0)}{" "}
											KB
										</span>
									) : (
										<span className="text-slate-500 text-xs">
											{t("file_hint_png_jpg")}
										</span>
									)}
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Sessions card */}
					<Card className="border-slate-800 bg-slate-900">
						<CardHeader className="flex flex-row items-center justify-between space-y-0">
							<div>
								<CardTitle className="text-white">
									{t("active_sessions")}
								</CardTitle>
								<CardDescription className="text-slate-400">
									{t("manage_devices")}
								</CardDescription>
							</div>
							<Button
								onClick={() => logoutAllMutation.mutate()}
								disabled={logoutAllMutation.isPending}
								className="bg-red-600 text-white hover:bg-red-700"
							>
								<LogOut className="mr-2 h-4 w-4" />
								{logoutAllMutation.isPending
									? t("logging_out")
									: t("log_out_all")}
							</Button>
						</CardHeader>
						<CardContent>
							{sessions && sessions.length > 0 ? (
								<div className="divide-y divide-slate-800">
									{sessions.map((s) => (
										<div
											key={s.jti}
											className="flex items-center justify-between py-3"
										>
											<div className="flex items-center gap-3">
												<div className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-800">
													<Smartphone className="h-4 w-4 text-slate-300" />
												</div>
												<div>
													<div className="text-sm text-white">
														{t("device_label", { id: s.device_id })}
													</div>
													<div className="text-slate-400 text-xs">
														{t("issued_last_used", {
															issued: new Date(s.issued_at).toLocaleString(),
															lastUsed: new Date(s.last_used).toLocaleString(),
														})}
													</div>
												</div>
											</div>
											<Button
												variant="outline"
												size="sm"
												className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
												onClick={() => revokeSessionMutation.mutate(s.jti)}
												disabled={revokeSessionMutation.isPending}
											>
												{revokeSessionMutation.isPending
													? t("revoking")
													: t("revoke")}
											</Button>
										</div>
									))}
								</div>
							) : (
								<div className="text-slate-400 text-sm">
									{t("no_active_sessions")}
								</div>
							)}
						</CardContent>
					</Card>
				</div>
			</main>

			<AuthModal type={authModal} onClose={() => setAuthModal(null)} />
		</div>
	);
}
