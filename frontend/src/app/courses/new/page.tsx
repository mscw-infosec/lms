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

export default function NewCoursePage() {
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
			setError("Course name is required");
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
			setError((err as Error).message || "Failed to create course");
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
						Back to Courses
					</Link>

					<h1 className="mb-2 font-bold text-4xl text-white">
						Create New Course
					</h1>
					<p className="text-lg text-slate-300">
						Design and publish a new cybersecurity course for students.
					</p>
				</div>

				<div className="max-w-2xl">
					<Card className="border-slate-800 bg-slate-900">
						<CardHeader>
							<CardTitle className="text-white">Course Details</CardTitle>
							<CardDescription className="text-slate-400">
								Fill in the basic information for your new course.
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
										Course Name *
									</Label>
									<Input
										id="name"
										type="text"
										value={formData.name}
										onChange={(e) => handleInputChange("name", e.target.value)}
										placeholder="Enter course name..."
										className="border-slate-700 bg-slate-800 text-white placeholder:text-slate-400 focus:border-red-500"
										required
									/>
								</div>

								<div className="space-y-2">
									<Label htmlFor="description" className="text-white">
										Description
									</Label>
									<Textarea
										id="description"
										value={formData.description || ""}
										onChange={(e) =>
											handleInputChange("description", e.target.value)
										}
										placeholder="Enter course description..."
										className="min-h-[120px] border-slate-700 bg-slate-800 text-white placeholder:text-slate-400 focus:border-red-500"
										rows={5}
									/>
									<p className="text-slate-500 text-sm">
										Provide a brief overview of what students will learn in this
										course.
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
												Creating...
											</>
										) : (
											<>
												<Save className="mr-2 h-4 w-4" />
												Create Course
											</>
										)}
									</Button>

									<Link href="/">
										<Button
											type="button"
											variant="outline"
											className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
										>
											Cancel
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
