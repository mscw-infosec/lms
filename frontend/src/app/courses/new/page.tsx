"use client";

import { type UpsertCourseRequestDTO, createCourse } from "@/api/courses";
import { Header } from "@/components/header";
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
import { Textarea } from "@/components/ui/textarea";
import { useUserStore } from "@/store/user";
import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function NewCoursePage() {
	const { t } = useTranslation('common');
	const { user } = useUserStore();
	const router = useRouter();
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [formData, setFormData] = useState<UpsertCourseRequestDTO>({
		name: "",
		description: "",
	});

	const canCreateCourse = user?.role === "Teacher" || user?.role === "Admin";

	if (user && !canCreateCourse) {
		router.push("/");
		return null;
	}

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!formData.name.trim()) {
			setError(t('course_name_required'));
			return;
		}

		setLoading(true);
		setError(null);

		try {
			const newCourse = await createCourse({
				name: formData.name.trim(),
				description: formData.description?.trim() || null,
			});

			router.push(`/course/${newCourse.id}`);
		} catch (err) {
			setError((err as Error).message || t('failed_create_course'));
		} finally {
			setLoading(false);
		}
	};

	const handleInputChange = (
		field: keyof UpsertCourseRequestDTO,
		value: string,
	) => {
		setFormData((prev) => ({
			...prev,
			[field]: value,
		}));
	};

	return (
		<div className="min-h-screen bg-slate-950">
			<Header onLogin={() => {}} onRegister={() => {}} />

			<main className="container mx-auto px-4 py-8">
				<div className="mb-8">
					<Link
						href="/"
						className="mb-4 inline-flex items-center text-slate-300 transition-colors hover:text-white"
					>
						<ArrowLeft className="mr-2 h-4 w-4" />
						{t('back_to_courses')}
					</Link>

					<h1 className="mb-2 font-bold text-4xl text-white">
						{t('create_new_course')}
					</h1>
					<p className="text-lg text-slate-300">
						{t('new_course_intro')}
					</p>
				</div>

				<div className="max-w-2xl">
					<Card className="border-slate-800 bg-slate-900">
						<CardHeader>
							<CardTitle className="text-white">{t('course_details')}</CardTitle>
							<CardDescription className="text-slate-400">
								{t('course_details_help')}
							</CardDescription>
						</CardHeader>
						<CardContent>
							<form onSubmit={handleSubmit} className="space-y-6">
								{error && (
									<div className="rounded-md border border-red-800 bg-red-900/20 p-4 text-red-300">
										{error}
									</div>
								)}

								<div className="space-y-2">
									<Label htmlFor="name" className="text-white">
										{t('course_name_label')}
									</Label>
									<Input
										id="name"
										type="text"
										value={formData.name}
										onChange={(e) => handleInputChange("name", e.target.value)}
										placeholder={t('course_name_placeholder')}
										className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-400 focus:border-red-500"
										required
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="description" className="text-white">
										{t('description_label')}
									</Label>
									<Textarea
										id="description"
										value={formData.description || ""}
										onChange={(e) =>
											handleInputChange("description", e.target.value)
										}
										placeholder={t('course_description_placeholder')}
										className="min-h-[120px] border-slate-700 bg-slate-800 text-white placeholder:text-slate-400 focus:border-red-500"
										rows={5}
									/>
									<p className="text-slate-500 text-sm">
										{t('course_description_help')}
									</p>
								</div>

								<div className="flex gap-4 pt-4">
									<Button
										type="submit"
										disabled={loading || !formData.name.trim()}
										className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
									>
										{loading ? (
											<>
												<div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
												{t('creating')}
											</>
										) : (
											<>
												<Save className="mr-2 h-4 w-4" />
												{t('create_course')}
											</>
										)}
									</Button>

									<Link href="/">
										<Button
											type="button"
											variant="outline"
											className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
										>
											{t('cancel')}
										</Button>
									</Link>
								</div>
							</form>
						</CardContent>
					</Card>
				</div>
			</main>
		</div>
	);
}
