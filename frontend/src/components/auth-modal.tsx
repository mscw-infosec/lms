"use client";

import type React from "react";

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
import { AlertCircle, CheckCircle2, Key } from "lucide-react";
import { useEffect, useState } from "react";
import { z } from "zod";

interface AuthModalProps {
	type: "login" | "register" | null;
	onClose: () => void;
}

// Zod validation schemas
const loginSchema = z.object({
	email: z.string().email("Please enter a valid email address"),
	password: z.string().min(1, "Password is required"),
});

const registerSchema = z
	.object({
		name: z
			.string()
			.min(2, "Username must be at least 2 characters")
			.max(20, "Username must be less than 20 characters")
			.regex(
				/^[a-zA-Z0-9_-]+$/,
				"Username can only contain letters, numbers, hyphens, and underscores",
			),
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

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;

// Mock function to simulate checking email availability
const checkEmailAvailability = async (email: string): Promise<boolean> => {
	// Simulate API delay
	await new Promise((resolve) => setTimeout(resolve, 500));

	// Mock logic: these emails are "taken"
	const takenEmails = [
		"admin@infosec.moscow",
		"test@example.com",
		"user@gmail.com",
		"john@infosec.moscow",
	];

	return !takenEmails.includes(email.toLowerCase());
};

// Mock function to simulate checking username availability
const checkUsernameAvailability = async (
	username: string,
): Promise<boolean> => {
	// Simulate API delay
	await new Promise((resolve) => setTimeout(resolve, 500));

	// Mock logic: these usernames are "taken"
	const takenUsernames = ["admin", "test", "user", "john", "infosec"];

	return !takenUsernames.includes(username.toLowerCase());
};

export function AuthModal({ type, onClose }: AuthModalProps) {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [confirmPassword, setConfirmPassword] = useState("");
	const [name, setName] = useState("");

	// Validation errors
	const [errors, setErrors] = useState<Record<string, string>>({});

	// Availability checking states
	const [emailAvailable, setEmailAvailable] = useState<boolean | null>(null);
	const [nameAvailable, setNameAvailable] = useState<boolean | null>(null);
	const [emailChecking, setEmailChecking] = useState(false);
	const [nameChecking, setNameChecking] = useState(false);

	// Validate form data in real-time
	useEffect(() => {
		const formData = { email, password, confirmPassword, name };
		const schema = type === "login" ? loginSchema : registerSchema;

		try {
			schema.parse(formData);
			setErrors({});
		} catch (error) {
			if (error instanceof z.ZodError) {
				const newErrors: Record<string, string> = {};
				error.errors.forEach((err) => {
					if (err.path[0]) {
						newErrors[err.path[0] as string] = err.message;
					}
				});
				setErrors(newErrors);
			}
		}
	}, [email, password, confirmPassword, name, type]);

	// Debounced availability checking for email
	useEffect(() => {
		if (type !== "register" || !email || email.length < 3 || errors.email) {
			setEmailAvailable(null);
			return;
		}

		const timeoutId = setTimeout(async () => {
			setEmailChecking(true);
			try {
				const available = await checkEmailAvailability(email);
				setEmailAvailable(available);
			} catch (error) {
				setEmailAvailable(null);
			} finally {
				setEmailChecking(false);
			}
		}, 800);

		return () => clearTimeout(timeoutId);
	}, [email, type, errors.email]);

	// Debounced availability checking for username
	useEffect(() => {
		if (type !== "register" || !name || name.length < 2 || errors.name) {
			setNameAvailable(null);
			return;
		}

		const timeoutId = setTimeout(async () => {
			setNameChecking(true);
			try {
				const available = await checkUsernameAvailability(name);
				setNameAvailable(available);
			} catch (error) {
				setNameAvailable(null);
			} finally {
				setNameChecking(false);
			}
		}, 800);

		return () => clearTimeout(timeoutId);
	}, [name, type, errors.name]);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();

		const formData = { email, password, confirmPassword, name };
		const schema = type === "login" ? loginSchema : registerSchema;

		try {
			schema.parse(formData);
		} catch (error) {
			if (error instanceof z.ZodError) {
				const newErrors: Record<string, string> = {};
				error.errors.forEach((err) => {
					if (err.path[0]) {
						newErrors[err.path[0] as string] = err.message;
					}
				});
				setErrors(newErrors);
				return;
			}
		}

		// Check availability before submitting
		if (type === "register") {
			if (emailAvailable === false || nameAvailable === false) {
				return;
			}
		}

		// Handle authentication logic here
		console.log("Auth submitted:", { type, email, password, name });
		onClose();
	};

	const handleOAuth = (provider: string) => {
		console.log("OAuth login with:", provider);
		onClose();
	};

	const handlePasskey = () => {
		console.log("Passkey login");
		onClose();
	};

	const getEmailValidationIcon = () => {
		if (emailChecking) {
			return (
				<div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
			);
		}
		if (emailAvailable === true) {
			return <CheckCircle2 className="h-4 w-4 text-green-500" />;
		}
		if (emailAvailable === false) {
			return <AlertCircle className="h-4 w-4 text-red-500" />;
		}
		return null;
	};

	const getNameValidationIcon = () => {
		if (nameChecking) {
			return (
				<div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-transparent" />
			);
		}
		if (nameAvailable === true) {
			return <CheckCircle2 className="h-4 w-4 text-green-500" />;
		}
		if (nameAvailable === false) {
			return <AlertCircle className="h-4 w-4 text-red-500" />;
		}
		return null;
	};

	const getInputBorderClass = (
		fieldName: string,
		available?: boolean | null,
	) => {
		// Only show red if there's an actual error AND the field has been interacted with
		if (
			errors[fieldName] &&
			(fieldName === "email"
				? email
				: fieldName === "name"
					? name
					: fieldName === "password"
						? password
						: confirmPassword)
		) {
			return "border-red-500";
		}
		if (type === "register" && available === true) {
			return "border-green-500";
		}
		if (type === "register" && available === false) {
			return "border-red-500";
		}
		return "border-slate-700";
	};

	const isFormValid = () => {
		const hasErrors = Object.keys(errors).length > 0;
		const hasRequiredFields =
			type === "login"
				? email && password
				: email && password && confirmPassword && name;

		if (type === "register") {
			return (
				hasRequiredFields &&
				!hasErrors &&
				emailAvailable !== false &&
				nameAvailable !== false &&
				!emailChecking &&
				!nameChecking
			);
		}

		return hasRequiredFields && !hasErrors;
	};

	if (!type) return null;

	return (
		<Dialog open={!!type} onOpenChange={() => onClose()}>
			<DialogContent className="border-slate-800 bg-slate-900 sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="text-center text-white">
						{type === "login" ? "Welcome Back" : "Create Account"}
					</DialogTitle>
				</DialogHeader>

				<form onSubmit={handleSubmit} className="space-y-4">
					{type === "register" && (
						<div className="space-y-2">
							<Label htmlFor="name" className="text-slate-300">
								Username
							</Label>
							<div className="relative">
								<Input
									id="name"
									type="text"
									value={name}
									onChange={(e) => setName(e.target.value)}
									className={`bg-slate-800 pr-10 text-white ${getInputBorderClass("name", nameAvailable)}`}
									required
								/>
								<div className="-translate-y-1/2 absolute top-1/2 right-3">
									{getNameValidationIcon()}
								</div>
							</div>
							{errors.name && name && (
								<p className="flex items-center text-red-400 text-sm">
									<AlertCircle className="mr-1 h-3 w-3" />
									{errors.name}
								</p>
							)}
							{nameAvailable === false && !errors.name && (
								<p className="flex items-center text-red-400 text-sm">
									<AlertCircle className="mr-1 h-3 w-3" />
									This username is already taken
								</p>
							)}
						</div>
					)}

					<div className="space-y-2">
						<Label htmlFor="email" className="text-slate-300">
							Email
						</Label>
						<div className="relative">
							<Input
								id="email"
								type="email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								className={`bg-slate-800 pr-10 text-white ${getInputBorderClass("email", emailAvailable)}`}
								required
							/>
							{type === "register" && (
								<div className="-translate-y-1/2 absolute top-1/2 right-3">
									{getEmailValidationIcon()}
								</div>
							)}
						</div>
						{errors.email && email && (
							<p className="flex items-center text-red-400 text-sm">
								<AlertCircle className="mr-1 h-3 w-3" />
								{errors.email}
							</p>
						)}
						{type === "register" &&
							emailAvailable === false &&
							!errors.email && (
								<p className="flex items-center text-red-400 text-sm">
									<AlertCircle className="mr-1 h-3 w-3" />
									This email is already registered
								</p>
							)}
					</div>

					<div className="space-y-2">
						<Label htmlFor="password" className="text-slate-300">
							Password
						</Label>
						<Input
							id="password"
							type="password"
							value={password}
							onChange={(e) => setPassword(e.target.value)}
							className={`bg-slate-800 text-white ${getInputBorderClass("password")}`}
							required
						/>
						{errors.password && password && (
							<p className="flex items-center text-red-400 text-sm">
								<AlertCircle className="mr-1 h-3 w-3" />
								{errors.password}
							</p>
						)}
					</div>

					{type === "register" && (
						<div className="space-y-2">
							<Label htmlFor="confirmPassword" className="text-slate-300">
								Confirm Password
							</Label>
							<Input
								id="confirmPassword"
								type="password"
								value={confirmPassword}
								onChange={(e) => setConfirmPassword(e.target.value)}
								className={`bg-slate-800 text-white ${getInputBorderClass("confirmPassword")}`}
								required
							/>
							{errors.confirmPassword && confirmPassword && (
								<p className="flex items-center text-red-400 text-sm">
									<AlertCircle className="mr-1 h-3 w-3" />
									{errors.confirmPassword}
								</p>
							)}
						</div>
					)}

					<Button
						type="submit"
						className="w-full bg-red-600 hover:bg-red-700"
						disabled={!isFormValid()}
					>
						{type === "login" ? "Sign In" : "Create Account"}
					</Button>
				</form>

				<div className="space-y-3">
					<div className="relative">
						<Separator className="bg-slate-700" />
						<span className="-translate-x-1/2 -translate-y-1/2 absolute top-1/2 left-1/2 bg-slate-900 px-2 text-slate-400 text-xs">
							OR
						</span>
					</div>

					<div className="grid grid-cols-3 gap-2">
						<Button
							type="button"
							variant="outline"
							className="col-span-1 border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
							onClick={handlePasskey}
						>
							<Key className="mr-1 h-4 w-4" />
							<span className="text-xs">Passkey</span>
						</Button>

						<Button
							type="button"
							variant="outline"
							className="border-slate-700 bg-transparent hover:bg-slate-800"
							onClick={() => handleOAuth("google")}
						>
							<svg className="h-4 w-4" viewBox="0 0 24 24">
								<path
									fill="#4285F4"
									d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
								/>
								<path
									fill="#34A853"
									d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
								/>
								<path
									fill="#FBBC05"
									d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
								/>
								<path
									fill="#EA4335"
									d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
								/>
							</svg>
						</Button>

						<Button
							type="button"
							variant="outline"
							className="border-slate-700 bg-transparent hover:bg-slate-800"
							onClick={() => handleOAuth("github")}
						>
							<svg className="h-4 w-4" viewBox="0 0 24 24" fill="#ffffff">
								<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
							</svg>
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
