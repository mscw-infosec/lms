"use client";

import {
	type CreateSsoClientRequest,
	SSO_SCOPES,
	type SsoClient,
	createSsoClient,
	deleteSsoClient,
	getSsoMetadata,
	listSsoClients,
	rotateSsoClientSecret,
	updateSsoClient,
} from "@/api/sso";
import { AuthModal } from "@/components/auth-modal";
import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { Header } from "@/components/header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import { useUserStore } from "@/store/user";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import "@/lib/i18n";

const DEFAULT_SCOPES = ["openid", "profile", "email"];

interface ClientFormState {
	name: string;
	description: string;
	logoUrl: string;
	redirectUris: string;
	allowedScopes: string[];
	isPublic: boolean;
	skipConsent: boolean;
}

const EMPTY_FORM: ClientFormState = {
	name: "",
	description: "",
	logoUrl: "",
	redirectUris: "",
	allowedScopes: DEFAULT_SCOPES,
	isPublic: false,
	skipConsent: false,
};

/** Seeds the edit form from what the provider currently has on file. */
function clientToForm(client: SsoClient): ClientFormState {
	return {
		name: client.name,
		description: client.description ?? "",
		logoUrl: client.logo_url ?? "",
		redirectUris: client.redirect_uris.join("\n"),
		allowedScopes: client.allowed_scopes,
		isPublic: client.is_public,
		skipConsent: client.skip_consent,
	};
}

/** Which form is open, if any: the registration form or one client's editor. */
type Editor = { mode: "create" } | { mode: "edit"; clientId: string };

/** Splits a textarea of one-URI-per-line into a clean list. */
function parseLines(value: string): string[] {
	return value
		.split("\n")
		.map((line) => line.trim())
		.filter(Boolean);
}

function CopyField({ label, value }: { label: string; value: string }) {
	const { t } = useTranslation("common");

	const copy = () => {
		void navigator.clipboard?.writeText(value);
		toast({ title: label, description: t("copied") });
	};

	return (
		<div className="flex items-center justify-between gap-3 rounded-md border border-slate-800 bg-slate-950 px-3 py-2">
			<div className="min-w-0">
				<div className="text-slate-400 text-xs">{label}</div>
				<div className="truncate font-mono text-slate-200 text-sm">{value}</div>
			</div>
			<Button
				variant="outline"
				size="sm"
				className="shrink-0 border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
				onClick={copy}
			>
				<Copy className="h-4 w-4" />
			</Button>
		</div>
	);
}

interface ClientFormProps {
	mode: Editor["mode"];
	value: ClientFormState;
	onChange: (next: ClientFormState) => void;
	onSubmit: () => void;
	onCancel: () => void;
	submitting: boolean;
}

/**
 * Registration and editing use the same fields, except that a client's
 * confidential/public nature is fixed at creation - it decides whether the app
 * has a secret at all, so it cannot be flipped later.
 */
function ClientForm({
	mode,
	value,
	onChange,
	onSubmit,
	onCancel,
	submitting,
}: ClientFormProps) {
	const { t } = useTranslation("common");
	const idPrefix = mode === "create" ? "new" : "edit";

	return (
		<div className="space-y-4 rounded-lg border border-slate-800 bg-slate-950 p-4">
			<div className="grid gap-4 sm:grid-cols-2">
				<div className="space-y-2">
					<Label className="text-slate-300">
						{t("sso_field_name") || "Application name"}
					</Label>
					<Input
						value={value.name}
						onChange={(e) => onChange({ ...value, name: e.target.value })}
						placeholder="CTFd"
						className="border-slate-700 bg-slate-900 text-white"
					/>
				</div>
				<div className="space-y-2">
					<Label className="text-slate-300">
						{t("sso_field_logo") || "Logo URL (optional)"}
					</Label>
					<Input
						value={value.logoUrl}
						onChange={(e) => onChange({ ...value, logoUrl: e.target.value })}
						placeholder="https://..."
						className="border-slate-700 bg-slate-900 text-white"
					/>
				</div>
			</div>

			<div className="space-y-2">
				<Label className="text-slate-300">
					{t("sso_field_description") || "Description (optional)"}
				</Label>
				<Input
					value={value.description}
					onChange={(e) => onChange({ ...value, description: e.target.value })}
					className="border-slate-700 bg-slate-900 text-white"
				/>
			</div>

			<div className="space-y-2">
				<Label className="text-slate-300">
					{t("sso_field_redirects") || "Redirect URIs (one per line)"}
				</Label>
				<Textarea
					value={value.redirectUris}
					onChange={(e) => onChange({ ...value, redirectUris: e.target.value })}
					rows={3}
					placeholder={"https://ctf.example.com/oauth/callback"}
					className="border-slate-700 bg-slate-900 font-mono text-sm text-white"
				/>
			</div>

			<div className="space-y-2">
				<Label className="text-slate-300">
					{t("sso_field_scopes") || "Allowed scopes"}
				</Label>
				<div className="flex flex-wrap gap-3">
					{SSO_SCOPES.map((scope) => (
						<div key={scope} className="flex items-center gap-2">
							<Checkbox
								id={`${idPrefix}-scope-${scope}`}
								checked={value.allowedScopes.includes(scope)}
								onCheckedChange={(checked) =>
									onChange({
										...value,
										allowedScopes: checked
											? [...value.allowedScopes, scope]
											: value.allowedScopes.filter((s) => s !== scope),
									})
								}
							/>
							<Label
								htmlFor={`${idPrefix}-scope-${scope}`}
								className="font-mono text-slate-300 text-sm"
							>
								{scope}
							</Label>
						</div>
					))}
				</div>
			</div>

			<div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
				{mode === "create" ? (
					<div className="flex items-center gap-2">
						<Checkbox
							id="sso-public"
							checked={value.isPublic}
							onCheckedChange={(checked) =>
								onChange({ ...value, isPublic: checked === true })
							}
						/>
						<Label htmlFor="sso-public" className="text-slate-300 text-sm">
							{t("sso_field_public") ||
								"Public client (browser or mobile app, PKCE instead of a secret)"}
						</Label>
					</div>
				) : null}
				<div className="flex items-center gap-2">
					<Checkbox
						id={`${idPrefix}-sso-trusted`}
						checked={value.skipConsent}
						onCheckedChange={(checked) =>
							onChange({ ...value, skipConsent: checked === true })
						}
					/>
					<Label
						htmlFor={`${idPrefix}-sso-trusted`}
						className="text-slate-300 text-sm"
					>
						{t("sso_field_trusted") || "Trusted app (skip the consent screen)"}
					</Label>
				</div>
			</div>

			<div className="flex gap-2">
				<Button
					className="bg-red-600 text-white hover:bg-red-700"
					onClick={onSubmit}
					disabled={submitting}
				>
					{submitting ? (
						<Loader2 className="mr-2 h-4 w-4 animate-spin" />
					) : null}
					{mode === "create"
						? t("sso_create") || "Create"
						: t("sso_save") || "Save changes"}
				</Button>
				<Button
					variant="outline"
					className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
					onClick={onCancel}
				>
					{t("cancel") || "Cancel"}
				</Button>
			</div>
		</div>
	);
}

export default function AdminSsoPage() {
	const { t } = useTranslation("common");
	const { user } = useUserStore();
	const queryClient = useQueryClient();
	const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);

	const isAdmin = user?.role === "Admin";

	const metadata = useQuery({
		queryKey: ["sso-metadata"],
		queryFn: getSsoMetadata,
		enabled: isAdmin,
		retry: false,
	});

	const clients = useQuery({
		queryKey: ["sso-clients"],
		queryFn: listSsoClients,
		enabled: isAdmin,
		retry: false,
	});

	// The plaintext secret exists only in this response - show it until the
	// admin dismisses it, and never fetch it again.
	const [issuedSecret, setIssuedSecret] = useState<{
		clientId: string;
		secret: string;
	} | null>(null);

	const [editor, setEditor] = useState<Editor | null>(null);
	const [form, setForm] = useState<ClientFormState>(EMPTY_FORM);

	const closeEditor = () => {
		setEditor(null);
		setForm(EMPTY_FORM);
	};

	const openCreate = () => {
		if (editor?.mode === "create") {
			closeEditor();
			return;
		}
		setEditor({ mode: "create" });
		setForm(EMPTY_FORM);
	};

	const openEdit = (client: SsoClient) => {
		setEditor({ mode: "edit", clientId: client.client_id });
		setForm(clientToForm(client));
	};

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["sso-clients"] });

	const createMutation = useMutation({
		mutationFn: (payload: CreateSsoClientRequest) => createSsoClient(payload),
		onSuccess: (created) => {
			if (created.client_secret) {
				setIssuedSecret({
					clientId: created.client_id,
					secret: created.client_secret,
				});
			}
			closeEditor();
			void invalidate();
		},
		onError: (error) =>
			toast({
				title: t("sso_client_create_failed") || "Could not register the app",
				description: String((error as Error)?.message ?? ""),
			}),
	});

	const editMutation = useMutation({
		mutationFn: ({
			clientId,
			payload,
		}: { clientId: string; payload: ClientFormState }) =>
			updateSsoClient(clientId, {
				name: payload.name.trim(),
				// The backend reads "" as "clear this field", so an emptied box
				// actually removes the value instead of silently keeping it.
				description: payload.description.trim(),
				logo_url: payload.logoUrl.trim(),
				redirect_uris: parseLines(payload.redirectUris),
				allowed_scopes: payload.allowedScopes,
				skip_consent: payload.skipConsent,
			}),
		onSuccess: () => {
			closeEditor();
			void invalidate();
			toast({ title: t("sso_client_saved") || "Application updated" });
		},
		onError: (error) =>
			toast({
				title: t("sso_client_save_failed") || "Could not save the changes",
				description: String((error as Error)?.message ?? ""),
			}),
	});

	const rotateMutation = useMutation({
		mutationFn: (clientId: string) => rotateSsoClientSecret(clientId),
		onSuccess: (result, clientId) =>
			setIssuedSecret({ clientId, secret: result.client_secret }),
		onError: (error) =>
			toast({
				title: t("sso_rotate_failed") || "Could not issue a new secret",
				description: String((error as Error)?.message ?? ""),
			}),
	});

	const toggleMutation = useMutation({
		mutationFn: ({
			clientId,
			enabled,
		}: { clientId: string; enabled: boolean }) =>
			updateSsoClient(clientId, { enabled }),
		onSuccess: invalidate,
	});

	const deleteMutation = useMutation({
		mutationFn: (clientId: string) => deleteSsoClient(clientId),
		onSuccess: invalidate,
	});

	const submit = () => {
		if (!editor) return;

		const redirectUris = parseLines(form.redirectUris);
		if (!form.name.trim() || redirectUris.length === 0) {
			toast({
				title:
					t("sso_client_form_incomplete") ||
					"A name and at least one redirect URI are required",
			});
			return;
		}

		if (editor.mode === "edit") {
			editMutation.mutate({ clientId: editor.clientId, payload: form });
			return;
		}

		createMutation.mutate({
			name: form.name.trim(),
			description: form.description.trim() || null,
			logo_url: form.logoUrl.trim() || null,
			redirect_uris: redirectUris,
			post_logout_redirect_uris: [],
			allowed_scopes: form.allowedScopes,
			is_public: form.isPublic,
			skip_consent: form.skipConsent,
		});
	};

	if (!isAdmin) {
		return (
			<div className="min-h-screen bg-slate-950">
				<Header
					onLogin={() => setAuthModal("login")}
					onRegister={() => setAuthModal("register")}
				/>
				<main className="container mx-auto px-4 py-10">
					<Card className="border-slate-800 bg-slate-900">
						<CardHeader>
							<CardTitle className="text-white">
								{t("access_denied") || "Access denied"}
							</CardTitle>
							<CardDescription className="text-slate-400">
								{t("sso_admin_only") ||
									"Only admins can manage single sign-on applications."}
							</CardDescription>
						</CardHeader>
					</Card>
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

			<main className="container mx-auto space-y-6 px-4 py-10">
				<div>
					<h1 className="font-bold text-2xl text-white">
						{t("sso_admin_title") || "Single sign-on"}
					</h1>
					<p className="text-slate-400 text-sm">
						{t("sso_admin_subtitle") ||
							"Applications that can authenticate users with their LMS account."}
					</p>
				</div>

				{/* Everything a relying party needs to configure itself. */}
				<Card className="border-slate-800 bg-slate-900">
					<CardHeader>
						<CardTitle className="text-white">
							{t("sso_endpoints") || "Provider endpoints"}
						</CardTitle>
					</CardHeader>
					<CardContent className="space-y-2">
						{metadata.isLoading ? (
							<Loader2 className="h-5 w-5 animate-spin text-slate-400" />
						) : metadata.data ? (
							<>
								<CopyField
									label={t("sso_discovery_url") || "Discovery URL"}
									value={metadata.data.discovery_url}
								/>
								<CopyField label="Issuer" value={metadata.data.issuer} />
								<CopyField
									label={t("sso_authorization_endpoint") || "Authorization URL"}
									value={metadata.data.authorization_endpoint}
								/>
								<CopyField
									label={t("sso_token_endpoint") || "Token URL"}
									value={metadata.data.token_endpoint}
								/>
								<CopyField
									label={t("sso_userinfo_endpoint") || "Userinfo URL"}
									value={metadata.data.userinfo_endpoint}
								/>
								<CopyField label="JWKS" value={metadata.data.jwks_uri} />
							</>
						) : null}
					</CardContent>
				</Card>

				{issuedSecret ? (
					<Card className="border-emerald-800 bg-emerald-950/40">
						<CardHeader>
							<CardTitle className="text-white">
								{t("sso_secret_title") || "Client secret"}
							</CardTitle>
							<CardDescription className="text-emerald-200/80">
								{t("sso_secret_warning") ||
									"Copy it now - it is not stored and cannot be shown again."}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-2">
							<CopyField label="client_id" value={issuedSecret.clientId} />
							<CopyField label="client_secret" value={issuedSecret.secret} />
							<Button
								variant="outline"
								size="sm"
								className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
								onClick={() => setIssuedSecret(null)}
							>
								{t("sso_secret_saved") || "I saved it"}
							</Button>
						</CardContent>
					</Card>
				) : null}

				<Card className="border-slate-800 bg-slate-900">
					<CardHeader className="flex flex-col space-y-3 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
						<div>
							<CardTitle className="text-white">
								{t("sso_registered_apps") || "Registered applications"}
							</CardTitle>
						</div>
						<Button
							size="sm"
							className="bg-red-600 text-white hover:bg-red-700"
							onClick={openCreate}
						>
							<Plus className="mr-2 h-4 w-4" />
							{t("sso_register_app") || "Register application"}
						</Button>
					</CardHeader>

					<CardContent className="space-y-6">
						{editor?.mode === "create" ? (
							<ClientForm
								mode="create"
								value={form}
								onChange={setForm}
								onSubmit={submit}
								onCancel={closeEditor}
								submitting={createMutation.isPending}
							/>
						) : null}

						{clients.isLoading ? (
							<Loader2 className="h-5 w-5 animate-spin text-slate-400" />
						) : clients.data && clients.data.length > 0 ? (
							<div className="divide-y divide-slate-800">
								{clients.data.map((client: SsoClient) => {
									const isEditing =
										editor?.mode === "edit" &&
										editor.clientId === client.client_id;

									return (
										<div key={client.client_id} className="space-y-3 py-4">
											<div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
												<div className="min-w-0 space-y-1">
													<div className="flex flex-wrap items-center gap-2">
														<span className="font-medium text-white">
															{client.name}
														</span>
														{client.enabled ? null : (
															<Badge className="bg-slate-700 text-slate-200">
																{t("sso_disabled") || "Disabled"}
															</Badge>
														)}
														{client.is_public ? (
															<Badge className="bg-sky-900 text-sky-200">
																{t("sso_public") || "Public"}
															</Badge>
														) : null}
														{client.skip_consent ? (
															<Badge className="bg-amber-900 text-amber-200">
																{t("sso_trusted") || "Trusted"}
															</Badge>
														) : null}
													</div>
													<div className="truncate font-mono text-slate-400 text-xs">
														{client.client_id}
													</div>
													<div className="truncate text-slate-500 text-xs">
														{client.redirect_uris.join(", ")}
													</div>
													<div className="font-mono text-slate-500 text-xs">
														{client.allowed_scopes.join(" ")}
													</div>
												</div>

												<div className="flex shrink-0 flex-wrap gap-2">
													<Button
														variant="outline"
														size="sm"
														className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
														onClick={() =>
															isEditing ? closeEditor() : openEdit(client)
														}
													>
														<Pencil className="mr-2 h-4 w-4" />
														{t("sso_edit") || "Edit"}
													</Button>

													<Button
														variant="outline"
														size="sm"
														className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
														onClick={() =>
															toggleMutation.mutate({
																clientId: client.client_id,
																enabled: !client.enabled,
															})
														}
														disabled={toggleMutation.isPending}
													>
														{client.enabled
															? t("sso_disable") || "Disable"
															: t("sso_enable") || "Enable"}
													</Button>

													{client.is_public ? null : (
														<ConfirmDialog
															title={
																t("sso_rotate_title") || "Issue a new secret?"
															}
															description={
																t("sso_rotate_description") ||
																"The current secret stops working immediately."
															}
															confirmText={t("sso_rotate") || "Rotate"}
															cancelText={t("cancel") || "Cancel"}
															onConfirm={() =>
																rotateMutation.mutate(client.client_id)
															}
														>
															<Button
																variant="outline"
																size="sm"
																className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
															>
																<KeyRound className="mr-2 h-4 w-4" />
																{t("sso_rotate") || "Rotate"}
															</Button>
														</ConfirmDialog>
													)}

													<ConfirmDialog
														title={t("sso_delete_title") || "Delete this app?"}
														description={
															t("sso_delete_description") ||
															"Its users are disconnected and its tokens stop working."
														}
														confirmText={t("delete") || "Delete"}
														cancelText={t("cancel") || "Cancel"}
														onConfirm={() =>
															deleteMutation.mutate(client.client_id)
														}
													>
														<Button
															variant="outline"
															size="sm"
															className="border-red-900 bg-transparent text-red-300 hover:bg-red-950"
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													</ConfirmDialog>
												</div>
											</div>

											{isEditing ? (
												<ClientForm
													mode="edit"
													value={form}
													onChange={setForm}
													onSubmit={submit}
													onCancel={closeEditor}
													submitting={editMutation.isPending}
												/>
											) : null}
										</div>
									);
								})}
							</div>
						) : (
							<div className="text-slate-400 text-sm">
								{t("sso_no_apps") || "No applications are registered yet."}
							</div>
						)}
					</CardContent>
				</Card>
			</main>

			<AuthModal type={authModal} onClose={() => setAuthModal(null)} />
		</div>
	);
}
