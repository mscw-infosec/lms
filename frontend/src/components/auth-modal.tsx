"use client";

import type React from "react";

import {
	forgotPassword,
	getOAuthLoginUrl,
	isCaptchaError,
	login,
	register,
} from "@/api/auth";
import {
	SmartCaptcha,
	isSmartCaptchaEnabled,
} from "@/components/smart-captcha";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { z } from "zod";

interface AuthModalProps {
	type: "login" | "register" | null;
	onClose: () => void;
	onLoginSuccess?: () => void;
}

// Zod validation schemas
const loginSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	password: z.string().min(1, "Password is required"),
});

const registerSchema = z
	.object({
		lastName: z
			.string()
			.min(1, "Last name is required")
			.max(100, "Last name is too long"),
		firstName: z
			.string()
			.min(1, "First name is required")
			.max(100, "First name is too long"),
		patronymic: z.string().max(100, "Patronymic is too long").optional(),
		email: z.string().email("Please enter a valid email address"),
		password: z
			.string()
			.min(12, "Password must be at least 12 characters")
			.regex(/[A-Z]/, "Password must contain at least one uppercase letter")
			.regex(/[a-z]/, "Password must contain at least one lowercase letter")
			.regex(/[0-9]/, "Password must contain at least one number"),
		confirmPassword: z.string().min(1, "Please confirm your password"),
	})
	.refine((data) => data.password === data.confirmPassword, {
		message: "Passwords don't match",
		path: ["confirmPassword"],
	});

export function AuthModal({ type, onClose, onLoginSuccess }: AuthModalProps) {
	const router = useRouter();
	const { t } = useTranslation("common");
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [firstName, setFirstName] = useState("");
	const [lastName, setLastName] = useState("");
	const [patronymic, setPatronymic] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const [captchaToken, setCaptchaToken] = useState("");
	const [captchaResetKey, setCaptchaResetKey] = useState(0);
	const resetCaptcha = useCallback(() => {
		setCaptchaToken("");
		setCaptchaResetKey((key) => key + 1);
	}, []);

	// The modal opens in the mode requested by the parent (`type`), but the user
	// can toggle between login, register and forgot-password within the dialog.
	const [mode, setMode] = useState<"login" | "register" | "forgot">(
		type ?? "login",
	);
	useEffect(() => {
		if (type) setMode(type);
	}, [type]);

	// Validation errors
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Validate form data in real-time
	useEffect(() => {
		// The forgot-password view manages its own state/validation.
		if (mode === "forgot") {
			setErrors({});
			return;
		}
		const formData =
			mode === "login"
				? { email, password }
				: {
						lastName,
						firstName,
						patronymic: patronymic || undefined,
						email,
						password,
						confirmPassword,
					};
		const schema = mode === "login" ? loginSchema : registerSchema;

		try {
			schema.parse(formData as unknown as Record<string, unknown>);
			setErrors({});
		} catch (error) {
			if (error instanceof z.ZodError) {
				const newErrors: Record<string, string> = {};
				for (const err of error.errors) {
					if (err.path[0]) {
						newErrors[err.path[0] as string] = err.message;
					}
				}
				setErrors(newErrors);
			}
		}
	}, [email, password, confirmPassword, firstName, lastName, patronymic, mode]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		const formData =
			mode === "login"
				? { email, password }
				: {
						lastName,
						firstName,
						patronymic: patronymic || undefined,
						email,
						password,
						confirmPassword,
					};
		const schema = mode === "login" ? loginSchema : registerSchema;

		try {
			schema.parse(formData as unknown as Record<string, unknown>);
		} catch (error) {
			if (error instanceof z.ZodError) {
				const newErrors: Record<string, string> = {};
				for (const err of error.errors) {
					if (err.path[0]) {
						newErrors[err.path[0] as string] = err.message;
					}
				}
				setErrors(newErrors);
				return;
			}
		}

		setSubmitting(true);
		try {
			if (mode === "login") {
				await login({ email, password, captcha_token: captchaToken });
				if (onLoginSuccess) {
					onLoginSuccess();
				} else {
					router.push("/");
				}
			} else {
				await register({
					last_name: lastName.trim(),
					first_name: firstName.trim(),
					patronymic: patronymic.trim() ? patronymic.trim() : null,
					email: email.trim(),
					password,
					captcha_token: captchaToken,
				});
			}
			onClose();
		} catch (err) {
			const message = String((err as Error)?.message ?? "");
			resetCaptcha();
			setErrors((prev) => ({
				...prev,
				root: isCaptchaError(err)
					? t("captcha_failed")
					: mode === "register" && message.includes("409")
						? t("email_taken")
						: t("auth_failed"),
			}));
		} finally {
			setSubmitting(false);
		}
	};

	const handleOAuth = (provider: string) => {
		const providerPath = getOAuthLoginUrl(provider as "github" | "yandex");
		window.location.href = providerPath;
	};

	const getInputBorderClass = (fieldName: string, value: string) => {
		if (errors[fieldName] && value) {
			return "border-red-500";
		}
		return "border-slate-700";
	};

	const isFormValid = () => {
		const hasErrors = Object.keys(errors).length > 0;
		const hasRequiredFields =
			mode === "login"
				? email && password
				: lastName && firstName && email && password && confirmPassword;
		const captchaSolved = !isSmartCaptchaEnabled() || Boolean(captchaToken);
		return hasRequiredFields && !hasErrors && captchaSolved;
	};

	if (!type) return null;

	const fieldError = (name: string, value: string) =>
		errors[name] && value ? (
			<p className="flex items-center text-red-400 text-sm">
				<AlertCircle className="mr-1 h-3 w-3" />
				{errors[name]}
			</p>
		) : null;

	return (
		<Dialog open={!!type} onOpenChange={() => onClose()}>
			<DialogContent className="max-w-md border-slate-800 bg-slate-900">
				<DialogHeader>
					<DialogTitle className="text-center text-white">
						{mode === "login"
							? t("welcome_back")
							: mode === "register"
								? t("create_account_title")
								: t("forgot_password_title")}
					</DialogTitle>
				</DialogHeader>

				{mode === "forgot" && (
					<ForgotPasswordView
						email={email}
						setEmail={setEmail}
						onBack={() => {
							setErrors({});
							setMode("login");
						}}
					/>
				)}

				{mode !== "forgot" && (
					<>
						<form onSubmit={handleSubmit} className="space-y-4">
							{mode === "register" && (
								<>
									<div className="space-y-2">
										<Label htmlFor="lastName" className="text-slate-300">
											{t("last_name")}
										</Label>
										<Input
											id="lastName"
											type="text"
											value={lastName}
											onChange={(e) => setLastName(e.target.value)}
											className={`bg-slate-800 text-white ${getInputBorderClass("lastName", lastName)}`}
											required
										/>
										{fieldError("lastName", lastName)}
									</div>

									<div className="space-y-2">
										<Label htmlFor="firstName" className="text-slate-300">
											{t("first_name")}
										</Label>
										<Input
											id="firstName"
											type="text"
											value={firstName}
											onChange={(e) => setFirstName(e.target.value)}
											className={`bg-slate-800 text-white ${getInputBorderClass("firstName", firstName)}`}
											required
										/>
										{fieldError("firstName", firstName)}
									</div>

									<div className="space-y-2">
										<Label htmlFor="patronymic" className="text-slate-300">
											{t("patronymic")}{" "}
											<span className="text-slate-500 text-xs">
												({t("if_exists_hint")})
											</span>
										</Label>
										<Input
											id="patronymic"
											type="text"
											value={patronymic}
											onChange={(e) => setPatronymic(e.target.value)}
											className={`bg-slate-800 text-white ${getInputBorderClass("patronymic", patronymic)}`}
										/>
										{fieldError("patronymic", patronymic)}
									</div>
								</>
							)}

							<div className="space-y-2">
								<Label htmlFor="email" className="text-slate-300">
									{t("email")}
								</Label>
								<Input
									id="email"
									type="email"
									value={email}
									onChange={(e) => setEmail(e.target.value)}
									className={`bg-slate-800 text-white ${getInputBorderClass("email", email)}`}
									required
								/>
								{fieldError("email", email)}
							</div>

							<div className="space-y-2">
								<Label htmlFor="password" className="text-slate-300">
									{t("password")}
								</Label>
								<Input
									id="password"
									type="password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									className={`bg-slate-800 text-white ${getInputBorderClass("password", password)}`}
									required
								/>
								{fieldError("password", password)}
							</div>

							{mode === "register" && (
								<div className="space-y-2">
									<Label htmlFor="confirmPassword" className="text-slate-300">
										{t("confirm_password")}
									</Label>
									<Input
										id="confirmPassword"
										type="password"
										value={confirmPassword}
										onChange={(e) => setConfirmPassword(e.target.value)}
										className={`bg-slate-800 text-white ${getInputBorderClass("confirmPassword", confirmPassword)}`}
										required
									/>
									{fieldError("confirmPassword", confirmPassword)}
								</div>
							)}

							<SmartCaptcha
								resetKey={captchaResetKey}
								onTokenChange={setCaptchaToken}
								onError={() =>
									setErrors((prev) => ({
										...prev,
										root: t("captcha_load_error"),
									}))
								}
							/>

							<Button
								type="submit"
								className="w-full bg-red-600 text-white hover:bg-red-700"
								disabled={!isFormValid() || submitting}
							>
								{mode === "login" ? t("sign_in") : t("create_account_action")}
							</Button>
							{errors.root && (
								<p className="mt-2 flex items-center text-red-400 text-sm">
									<AlertCircle className="mr-1 h-3 w-3" />
									{errors.root}
								</p>
							)}
						</form>

						{mode === "login" && (
							<button
								type="button"
								className="w-full text-center text-slate-400 text-sm hover:text-slate-200"
								onClick={() => {
									setErrors({});
									setMode("forgot");
								}}
							>
								{t("forgot_password_link")}
							</button>
						)}

						<div className="space-y-3">
							<div className="relative">
								<Separator className="bg-slate-700" />
								<span className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 bg-slate-900 px-2 text-slate-400 text-xs">
									{t("or")}
								</span>
							</div>

							<div className="grid grid-cols-1 gap-2 sm:grid-cols-1">
								<Button
									type="button"
									variant="outline"
									size="lg"
									className="border-slate-700 bg-transparent px-2 text-slate-300 hover:bg-slate-800 sm:px-3"
									onClick={() => handleOAuth("yandex")}
									title={t("sign_in_with_yandex")}
								>
									<svg
										className="h-4 w-4"
										viewBox="4 4 16 16"
										fill="currentColor"
										role="img"
										aria-labelledby="yandex-title"
										overflow={"visible"}
									>
										<title id="yandex-title">{t("sign_in_with_yandex")}</title>
										<path
											d="M2.04 12c0-5.523 4.476-10 10-10 5.522 0 10 4.477 10 10s-4.478 10-10 10c-5.524 0-10-4.477-10-10z"
											fill="#FC3F1D"
										/>
										<path
											d="M13.32 7.666h-.924c-1.694 0-2.585.858-2.585 2.123 0 1.43.616 2.1 1.881 2.959l1.045.704-3.003 4.487H7.49l2.695-4.014c-1.55-1.111-2.42-2.19-2.42-4.015 0-2.288 1.595-3.85 4.62-3.85h3.003v11.868H13.32V7.666z"
											fill="#fff"
										/>
									</svg>
								</Button>
							</div>

							<p className="text-center text-slate-400 text-sm">
								{mode === "login"
									? t("no_account_prompt")
									: t("have_account_prompt")}{" "}
								<button
									type="button"
									className="font-medium text-red-400 hover:text-red-300"
									onClick={() => {
										setErrors({});
										setMode(mode === "login" ? "register" : "login");
									}}
								>
									{mode === "login" ? t("create_account_action") : t("sign_in")}
								</button>
							</p>
						</div>
					</>
				)}
			</DialogContent>
		</Dialog>
	);
}

interface ForgotPasswordViewProps {
	email: string;
	setEmail: (v: string) => void;
	onBack: () => void;
}

function ForgotPasswordView({
	email,
	setEmail,
	onBack,
}: ForgotPasswordViewProps) {
	const { t } = useTranslation("common");
	const [submitting, setSubmitting] = useState(false);
	const [sent, setSent] = useState(false);

	const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

	if (sent) {
		return (
			<div className="space-y-4 text-center">
				<CheckCircle2 className="mx-auto h-10 w-10 text-green-500" />
				<p className="text-slate-300 text-sm">
					{t("forgot_password_sent", { email })}
				</p>
				<Button
					variant="outline"
					className="w-full border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
					onClick={onBack}
				>
					{t("back_to_login")}
				</Button>
			</div>
		);
	}

	return (
		<form
			className="space-y-4"
			onSubmit={async (e) => {
				e.preventDefault();
				if (!valid) return;
				setSubmitting(true);
				try {
					// Always report success - the endpoint never reveals whether the
					// email is registered.
					await forgotPassword(email.trim().toLowerCase());
				} catch {
					// ignore
				} finally {
					setSubmitting(false);
					setSent(true);
				}
			}}
		>
			<p className="text-slate-400 text-sm">{t("forgot_password_desc")}</p>
			<div className="space-y-2">
				<Label htmlFor="forgot-email" className="text-slate-300">
					{t("email")}
				</Label>
				<Input
					id="forgot-email"
					type="email"
					value={email}
					onChange={(e) => setEmail(e.target.value)}
					className="border-slate-700 bg-slate-800 text-white"
					required
				/>
			</div>
			<Button
				type="submit"
				className="w-full bg-red-600 text-white hover:bg-red-700"
				disabled={!valid || submitting}
			>
				{submitting ? (
					<Loader2 className="h-4 w-4 animate-spin" />
				) : (
					t("forgot_password_submit")
				)}
			</Button>
			<button
				type="button"
				className="w-full text-center text-slate-400 text-sm hover:text-slate-200"
				onClick={onBack}
			>
				{t("back_to_login")}
			</button>
		</form>
	);
}
