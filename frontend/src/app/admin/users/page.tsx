"use client";

import type { PublicAccountDTO, UserRole } from "@/api/account";
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
import { Plus, Trash2, Users as UsersIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 20;

export default function AdminUsersPage() {
	const { t } = useTranslation("common");
	const { user } = useUserStore();
	const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);

	const isAdmin = user?.role === "Admin";

	const [users, setUsers] = useState<PublicAccountDTO[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [offset, setOffset] = useState(0);
	const [hasMore, setHasMore] = useState(false);

	// attribute editor state per user
	const [attrDrafts, setAttrDrafts] = useState<
		Record<string, { key: string; value: string }>
	>({});

	useEffect(() => {
		if (!isAdmin) return;
		let cancelled = false;
		const load = async () => {
			try {
				setLoading(true);
				setError(null);
				const data = await listAccounts(PAGE_SIZE, 0);
				if (cancelled) return;
				setUsers(data);
				setOffset(data.length);
				setHasMore(data.length === PAGE_SIZE);
			} catch (e) {
				setError((e as Error).message || "Failed to load users");
			} finally {
				setLoading(false);
			}
		};
		load();
		return () => {
			cancelled = true;
		};
	}, [isAdmin]);

	const loadMore = async () => {
		try {
			setLoading(true);
			const data = await listAccounts(PAGE_SIZE, offset);
			setUsers((prev) => [...prev, ...data]);
			setOffset((o) => o + data.length);
			setHasMore(data.length === PAGE_SIZE);
		} catch (e) {
			setError((e as Error).message || "Failed to load users");
		} finally {
			setLoading(false);
		}
	};

	const changeRole = async (id: string, role: UserRole) => {
		try {
			await updateUserRole(id, role);
			setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, role } : u)));
			toast({
				title: t("role_changed") || "Role changed",
				description: `${t("new_role") || "New role"}: ${role}`,
			});
		} catch (e) {
			setError((e as Error).message || "Failed to update role");
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
			setUsers((prev) =>
				prev.map((u) =>
					u.id === userId
						? {
								...u,
								attributes: { ...u.attributes, [draft.key]: draft.value },
							}
						: u,
				),
			);
			setAttrDrafts((prev) => ({ ...prev, [userId]: { key: "", value: "" } }));
		} catch (e) {
			setError((e as Error).message || "Failed to upsert attribute");
		}
	};

	const removeAttribute = async (userId: string, key: string) => {
		try {
			await deleteUserAttribute(userId, key);
			setUsers((prev) =>
				prev.map((u) => {
					if (u.id !== userId) return u;
					const { [key]: _removed, ...rest } = u.attributes || {};
					return { ...u, attributes: rest };
				}),
			);
		} catch (e) {
			setError((e as Error).message || "Failed to delete attribute");
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
						{error ? <div className="mb-4 text-red-400">{error}</div> : null}
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>{t("username") ?? "Username"}</TableHead>
									<TableHead>{t("email") ?? "Email"}</TableHead>
									<TableHead>{t("role") ?? "Role"}</TableHead>
									<TableHead>{t("attributes") ?? "Attributes"}</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{users.map((u) => (
									<TableRow key={u.id}>
										<TableCell className="font-medium">{u.username}</TableCell>
										<TableCell className="text-slate-400">{u.email}</TableCell>
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
									</TableRow>
								))}
							</TableBody>
						</Table>
						<div className="mt-4 flex items-center justify-between">
							<div className="text-slate-400 text-sm">
								{users.length} {t("of") || "of"} {offset}
							</div>
							<div className="flex gap-2">
								<Button
									variant="outline"
									disabled={offset <= PAGE_SIZE || loading}
									onClick={() => {
										// naive previous: reload from start to previous page
										const newOffset = Math.max(0, offset - PAGE_SIZE * 2);
										setOffset(newOffset);
										setUsers([]);
										setHasMore(false);
										listAccounts(PAGE_SIZE, newOffset)
											.then((data) => {
												setUsers(data);
												setOffset(newOffset + data.length);
												setHasMore(data.length === PAGE_SIZE);
											})
											.catch((e) => setError((e as Error).message || "Failed"));
									}}
								>
									{t("previous") || "Prev"}
								</Button>
								<Button
									variant="outline"
									disabled={!hasMore || loading}
									onClick={loadMore}
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
