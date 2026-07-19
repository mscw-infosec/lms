"use client";

import type { UserRole } from "@/api/account";
import {
	deleteUserAttribute,
	listAccounts,
	updateUserRole,
	upsertUserAttributes,
} from "@/api/account";
import { AuthModal } from "@/components/auth-modal";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { useUserStore } from "@/store/user";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
	Loader2,
	Plus,
	Search,
	Trash2,
	Trophy,
	Users as UsersIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
	const { t } = useTranslation("common");
	const { user } = useUserStore();
	const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);

	const isAdmin = user?.role === "Admin";

	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");
	const [offset, setOffset] = useState(0);

	// Debounce the search box; reset to the first page on a new query.
	useEffect(() => {
		const id = setTimeout(() => {
			setSearch(searchInput);
			setOffset(0);
		}, 350);
		return () => clearTimeout(id);
	}, [searchInput]);

	const query = useQuery({
		queryKey: ["admin-users", offset, search],
		queryFn: () => listAccounts(PAGE_SIZE, offset, search),
		enabled: isAdmin,
		placeholderData: keepPreviousData,
		retry: false,
	});

	const users = query.data?.users ?? [];
	const total = query.data?.total ?? 0;
	const from = total === 0 ? 0 : offset + 1;
	const to = Math.min(offset + PAGE_SIZE, total);
	const hasPrev = offset > 0;
	const hasNext = offset + PAGE_SIZE < total;

	// attribute editor state per user
	const [attrDrafts, setAttrDrafts] = useState<
		Record<string, { key: string; value: string }>
	>({});

	const changeRole = async (id: string, role: UserRole) => {
		try {
			await updateUserRole(id, role);
			await query.refetch();
			toast({
				title: t("role_changed") || "Role changed",
				description: `${t("new_role") || "New role"}: ${role}`,
			});
		} catch (e) {
			toast({
				title: t("save_failed") || "Failed",
				description: (e as Error).message || "Failed to update role",
				variant: "destructive",
			});
		}
	};

	const onAttrInputChange = (
		userId: string,
		field: "key" | "value",
		value: string,
	) => {
		setAttrDrafts((prev) => ({
			...prev,
			[userId]: { ...(prev[userId] || { key: "", value: "" }), [field]: value },
		}));
	};

	const addOrUpdateAttribute = async (userId: string) => {
		const draft = attrDrafts[userId];
		if (!draft || !draft.key) return;
		try {
			await upsertUserAttributes(userId, { [draft.key]: draft.value });
			setAttrDrafts((prev) => ({ ...prev, [userId]: { key: "", value: "" } }));
			await query.refetch();
		} catch (e) {
			toast({
				title: t("save_failed") || "Failed",
				description: (e as Error).message || "Failed to upsert attribute",
				variant: "destructive",
			});
		}
	};

	const removeAttribute = async (userId: string, key: string) => {
		try {
			await deleteUserAttribute(userId, key);
			await query.refetch();
		} catch (e) {
			toast({
				title: t("save_failed") || "Failed",
				description: (e as Error).message || "Failed to delete attribute",
				variant: "destructive",
			});
		}
	};

	if (!user) {
		return (
			<>
				<Header
					onLogin={() => setAuthModal("login")}
					onRegister={() => setAuthModal("register")}
				/>
				<div className="container mx-auto px-4 py-6 text-slate-300">
					{t("please_login_to_view_account") ||
						"Please log in to access this page."}
				</div>
				{authModal ? (
					<AuthModal type={authModal} onClose={() => setAuthModal(null)} />
				) : null}
			</>
		);
	}

	if (!isAdmin) {
		return (
			<>
				<Header
					onLogin={() => setAuthModal("login")}
					onRegister={() => setAuthModal("register")}
				/>
				<div className="container mx-auto px-4 py-6 text-slate-300">
					{t("not_authorized") || "You are not authorized to view this page."}
				</div>
			</>
		);
	}

	return (
		<>
			<Header
				onLogin={() => setAuthModal("login")}
				onRegister={() => setAuthModal("register")}
			/>
			<div className="container mx-auto px-4 py-6">
				<Card className="border-slate-800 bg-slate-900/50">
					<CardHeader>
						<CardTitle className="flex items-center gap-2 text-white">
							<UsersIcon className="h-5 w-5 text-blue-400" />
							{t("users") || "Users"}
						</CardTitle>
					</CardHeader>
					<CardContent className="text-slate-300">
						<div className="relative mb-4">
							<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-slate-500" />
							<Input
								value={searchInput}
								onChange={(e) => setSearchInput(e.target.value)}
								placeholder={
									t("user_search_placeholder") || "Search by username or email…"
								}
								className="border-slate-700 bg-slate-800 pl-9 text-white placeholder:text-slate-400"
							/>
						</div>

						{query.isError ? (
							<div className="mb-4 text-red-400">
								{(query.error as Error)?.message || "Failed to load users"}
							</div>
						) : null}

						{query.isLoading ? (
							<div className="flex items-center gap-2 py-6 text-slate-400 text-sm">
								<Loader2 className="h-4 w-4 animate-spin" />{" "}
								{t("loading") || "Loading…"}
							</div>
						) : users.length === 0 ? (
							<div className="py-6 text-slate-400 text-sm">
								{search
									? t("user_no_matches") || "No matching users."
									: t("user_no_results") || "No users."}
							</div>
						) : (
							<Table>
								<TableHeader>
									<TableRow>
										<TableHead>{t("username") ?? "Username"}</TableHead>
										<TableHead>{t("email") ?? "Email"}</TableHead>
										<TableHead>{t("role") ?? "Role"}</TableHead>
										<TableHead>{t("attributes") ?? "Attributes"}</TableHead>
										<TableHead className="text-right">
											{t("rating_score") ?? "Rating"}
										</TableHead>
									</TableRow>
								</TableHeader>
								<TableBody>
									{users.map((u) => (
										<TableRow key={u.id}>
											<TableCell className="font-medium">
												{u.username}
											</TableCell>
											<TableCell className="text-slate-400">
												{u.email}
											</TableCell>
											<TableCell>
												<Select
													defaultValue={u.role}
													onValueChange={(val) =>
														changeRole(u.id, val as UserRole)
													}
												>
													<SelectTrigger className="w-[160px] border-slate-700 bg-slate-800 text-white">
														<SelectValue placeholder={u.role} />
													</SelectTrigger>
													<SelectContent className="border-slate-700 bg-slate-800 text-white">
														<SelectItem value="Student">Student</SelectItem>
														<SelectItem value="Teacher">Teacher</SelectItem>
														<SelectItem value="Admin">Admin</SelectItem>
													</SelectContent>
												</Select>
											</TableCell>
											<TableCell>
												<div className="flex flex-wrap items-center gap-2">
													{Object.entries(u.attributes || {}).map(([k, v]) => (
														<span
															key={k}
															className="inline-flex items-center gap-1 rounded bg-slate-800 px-2 py-1 text-xs"
														>
															<Badge
																variant="secondary"
																className="bg-slate-700 text-slate-200"
															>
																{k}: {v}
															</Badge>
															<Button
																title="Delete attribute"
																className="h-6 w-6 text-red-400 hover:text-red-300"
																variant="outline"
																onClick={() => removeAttribute(u.id, k)}
															>
																<Trash2 className="h-3 w-3" />
															</Button>
														</span>
													))}
												</div>
												<div className="mt-2 flex items-center gap-2">
													<Input
														placeholder={t("attribute_key") || "key"}
														value={attrDrafts[u.id]?.key || ""}
														onChange={(e) =>
															onAttrInputChange(u.id, "key", e.target.value)
														}
														className="h-8 w-40 border-slate-700 bg-slate-800 text-white placeholder:text-slate-400"
													/>
													<Input
														placeholder={t("attribute_value") || "value"}
														value={attrDrafts[u.id]?.value || ""}
														onChange={(e) =>
															onAttrInputChange(u.id, "value", e.target.value)
														}
														className="h-8 w-56 border-slate-700 bg-slate-800 text-white placeholder:text-slate-400"
													/>
													<Button
														size="sm"
														variant="outline"
														className="h-8"
														onClick={() => addOrUpdateAttribute(u.id)}
													>
														<Plus className="mr-1 h-3 w-3" />
														{t("add_update") || "Add/Update"}
													</Button>
												</div>
											</TableCell>
											<TableCell className="text-right">
												<Link href={`/rating/user/${u.id}`}>
													<Button
														size="sm"
														variant="outline"
														className="border-slate-700 text-white hover:bg-slate-800"
													>
														<Trophy className="mr-1 h-4 w-4 text-red-500" />
														{t("rating_view") || "Rating"}
													</Button>
												</Link>
											</TableCell>
										</TableRow>
									))}
								</TableBody>
							</Table>
						)}

						<div className="mt-4 flex items-center justify-between">
							<div className="text-slate-400 text-sm">
								{t("rating_showing", { from, to, total }) ||
									`Showing ${from}–${to} of ${total}`}
							</div>
							<div className="flex gap-2">
								<Button
									variant="outline"
									className="border-slate-700 text-white hover:bg-slate-800"
									disabled={!hasPrev || query.isFetching}
									onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
								>
									{t("previous") || "Prev"}
								</Button>
								<Button
									variant="outline"
									className="border-slate-700 text-white hover:bg-slate-800"
									disabled={!hasNext || query.isFetching}
									onClick={() => setOffset((o) => o + PAGE_SIZE)}
								>
									{t("next") || "Next"}
								</Button>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
			{authModal ? (
				<AuthModal type={authModal} onClose={() => setAuthModal(null)} />
			) : null}
		</>
	);
}
