"use client";

import {
	type TopicResponseDTO,
	type UpsertCourseResponseDTO,
	deleteCourse,
	editCourse,
	getCourseById,
	getCourseTopics,
} from "@/api/courses";
import { getExamTasks, updateExamTasks } from "@/api/exam";
import type { components } from "@/api/schema/schema";
import { createTopic, deleteTopic, updateTopic } from "@/api/topics";
import { AuthModal } from "@/components/auth-modal";
import CourseHeaderActions from "@/components/course/course-header-actions";
import { Header } from "@/components/header";
import CreateTopicItemDialog from "@/components/topic/create-topic-item-dialog";
import TopicCreateForm from "@/components/topic/topic-create-form";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Collapsible,
	CollapsibleContent,
	CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useUserStore } from "@/store/user";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	BookOpen,
	CheckCircle2,
	ChevronDown,
	Clock,
	Edit,
	HelpCircle,
	Home,
	Loader2,
	Play,
	Plus,
	Save,
	Shield,
	Trash2,
	X,
} from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export default function CoursePage() {
	const { t } = useTranslation("common");
	const { user } = useUserStore();
	const { toast } = useToast();
	const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);
	const params = useParams<{ id: string }>();
	const router = useRouter();
	const courseId = Number.parseInt(String(params.id));

	const courseQuery = useQuery<UpsertCourseResponseDTO, Error>({
		queryKey: ["course", courseId],
		queryFn: () => getCourseById(courseId),
		enabled: Number.isFinite(courseId),
		retry: false,
	});

	const deleteMutation = useMutation({
		mutationFn: async () => deleteCourse(courseId),
		onSuccess: () => {
			toast({ description: t("deleted_successfully") || "Deleted" });

			router.push("/");
		},
		onError: () => {
			toast({ description: t("delete_failed") || "Failed to delete" });
		},
	});

	const topicsQuery = useQuery<TopicResponseDTO[], Error>({
		queryKey: ["course-topics", courseId],
		queryFn: async () => {
			const data = await getCourseTopics(courseId);
			return data.sort((a, b) => a.order_index - b.order_index);
		},
		enabled: courseQuery.isSuccess,
		retry: false,
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

	const courseImageClass = gradients[courseId % gradients.length];

	const canEdit = user?.role === "Teacher" || user?.role === "Admin";

	const [isEditing, setIsEditing] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState<string | null>("");

	// Topic create/edit state
	const nextOrderIndex = useMemo(() => {
		const list = topicsQuery.data ?? [];
		return list.length ? Math.max(...list.map((t) => t.order_index)) + 1 : 1;
	}, [topicsQuery.data]);
	const [newTopicTitle, setNewTopicTitle] = useState("");
	const [newTopicOrderIndex, setNewTopicOrderIndex] = useState<number>(1);
	useEffect(() => {
		setNewTopicOrderIndex(nextOrderIndex);
	}, [nextOrderIndex]);

	const [editingTopicId, setEditingTopicId] = useState<number | null>(null);
	const [editTopicTitle, setEditTopicTitle] = useState("");
	const [editTopicOrderIndex, setEditTopicOrderIndex] = useState<number>(1);

	type PublicTaskDTO = components["schemas"]["PublicTaskDTO"];
	type ExamLite = {
		id: string;
		type: components["schemas"]["UpsertExamRequestDTO"]["type"];
		duration: number;
		tries_count: number;
		tasks?: PublicTaskDTO[];
	};
	const [topicExams, setTopicExams] = useState<Record<number, ExamLite[]>>({});

	const attachTaskToExam = async (examId: string, newTaskId: number) => {
		try {
			const current = await getExamTasks(examId);
			const ids = [
				...new Set([...(current?.map((t) => t.id) ?? []), newTaskId]),
			];
			await updateExamTasks(examId, ids);
			const updated = await getExamTasks(examId);
			setTopicExams((prev) => {
				const copy: typeof prev = { ...prev };
				for (const [topicIdKey, exams] of Object.entries(copy)) {
					const idx = exams.findIndex((e) => e.id === examId);
					if (idx !== -1) {
						const next = [...exams];
						next[idx] = { ...next[idx], tasks: updated } as ExamLite;
						copy[Number(topicIdKey)] = next;
					}
				}
				return copy;
			});
		} catch (e) {
			// best-effort; toast already available at component level if needed
		}
	};

	useEffect(() => {
		if (courseQuery.data && !isEditing) {
			setName(courseQuery.data.name ?? "");
			setDescription(courseQuery.data.description ?? "");
		}
	}, [courseQuery.data, isEditing]);

	const saveMutation = useMutation({
		mutationFn: async () =>
			editCourse(courseId, {
				name: name.trim(),
				description: description?.trim() || undefined,
			}),
		onSuccess: async () => {
			toast({ description: t("saved_successfully") || "Saved" });
			await courseQuery.refetch();
			setIsEditing(false);
		},
		onError: (err: unknown) => {
			toast({ description: t("save_failed") || "Failed to save" });
			// keep editing state
		},
	});

	// Topic mutations
	const createTopicMutation = useMutation({
		mutationFn: async () =>
			createTopic({
				course_id: courseId,
				order_index: Number(newTopicOrderIndex) || nextOrderIndex,
				title: newTopicTitle.trim(),
			}),
		onSuccess: async () => {
			setNewTopicTitle("");
			setNewTopicOrderIndex(nextOrderIndex + 1);
			await topicsQuery.refetch();
			toast({ description: t("saved_successfully") || "Saved" });
		},
		onError: () => {
			toast({ description: t("save_failed") || "Failed to save" });
		},
	});

	const updateTopicMutation = useMutation({
		mutationFn: async () => {
			if (editingTopicId == null) return;
			return updateTopic(editingTopicId, {
				course_id: courseId,
				order_index: Number(editTopicOrderIndex) || 1,
				title: editTopicTitle.trim(),
			});
		},
		onSuccess: async () => {
			setEditingTopicId(null);
			setEditTopicTitle("");
			await topicsQuery.refetch();
			toast({ description: t("saved_successfully") || "Saved" });
		},
		onError: () => {
			toast({ description: t("save_failed") || "Failed to save" });
		},
	});

	const deleteTopicMutation = useMutation({
		mutationFn: async (id: number) => deleteTopic(id),
		onSuccess: async () => {
			await topicsQuery.refetch();
			toast({ description: t("deleted_successfully") || "Deleted" });
		},
		onError: () => {
			toast({ description: t("delete_failed") || "Failed to delete" });
		},
	});

	if (courseQuery.isLoading) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
				<Loader2 className="h-8 w-8 animate-spin text-slate-300" />
			</div>
		);
	}

	if (courseQuery.isError || !courseQuery.data) {
		return (
			<div className="flex min-h-screen items-center justify-center bg-slate-950 text-slate-300">
				{courseQuery.error?.message.includes("401")
					? t("course_login_prompt")
					: t("course_not_found")}
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
				<div className="mx-auto max-w-4xl">
					{/* Home Button */}
					<div className="mb-4">
						<Link href="/">
							<Button
								variant="outline"
								size="sm"
								className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
							>
								<Home className="mr-2 h-4 w-4" />
								<span className="hidden sm:inline">{t("back_to_courses")}</span>
								<span className="sm:hidden">{t("back")}</span>
							</Button>
						</Link>
					</div>
					{/* Course Header */}
					<div className="mb-6">
						<div className="flex flex-col gap-4">
							{/* Mobile: Image and basic info */}
							<div className="lg:hidden">
								<div
									className={`h-40 w-full rounded-lg ${courseImageClass} mb-4 flex items-center justify-center`}
								>
									<Shield className="h-12 w-12 text-white opacity-80" />
								</div>
								{isEditing ? (
									<Input
										value={name}
										onChange={(e) => setName(e.target.value)}
										placeholder={t("course_name_placeholder") ?? "Course name"}
										className="mb-3 border-slate-700 bg-slate-800 text-white"
									/>
								) : (
									<h1 className="mb-3 font-bold text-2xl text-white">
										{courseQuery.data.name}
									</h1>
								)}
								{canEdit && (
									<div className="mb-3">
										<CourseHeaderActions
											isEditing={isEditing}
											canEdit={canEdit}
											onEdit={() => setIsEditing(true)}
											onSave={() => saveMutation.mutate()}
											savePending={saveMutation.isPending}
											canSave={!!name.trim()}
											onCancel={() => {
												setIsEditing(false);
												setName(courseQuery.data?.name ?? "");
												setDescription(courseQuery.data?.description ?? "");
											}}
											onDelete={() => deleteMutation.mutate()}
											deletePending={deleteMutation.isPending}
										/>
									</div>
								)}
								<div className="mb-4 flex items-center gap-4 text-slate-400 text-sm">
									<div className="flex items-center">
										<Clock className="mr-1 h-3 w-3" />
										{new Date(courseQuery.data.created_at).toLocaleDateString()}
									</div>
								</div>
								<Link href={`/course/${courseId}/learn`}>
									<Button
										size="default"
										className="w-full bg-red-600 text-white hover:bg-red-700"
									>
										<Play className="mr-2 h-4 w-4" />
										{t("start_course")}
									</Button>
								</Link>
							</div>

							{/* Desktop: Side by side layout */}
							<div className="hidden lg:flex lg:gap-8">
								<div
									className={`h-48 w-80 rounded-lg ${courseImageClass} flex flex-shrink-0 items-center justify-center`}
								>
									<Shield className="h-16 w-16 text-white opacity-80" />
								</div>

								<div className="flex-1">
									<div className="mb-4 flex items-start justify-between gap-3">
										{isEditing ? (
											<Input
												value={name}
												onChange={(e) => setName(e.target.value)}
												placeholder={
													t("course_name_placeholder") ?? "Course name"
												}
												className="max-w-xl border-slate-700 bg-slate-800 text-white"
											/>
										) : (
											<h1 className="font-bold text-3xl text-white">
												{courseQuery.data.name}
											</h1>
										)}
										{canEdit && (
											<CourseHeaderActions
												isEditing={isEditing}
												canEdit={canEdit}
												onEdit={() => setIsEditing(true)}
												onSave={() => saveMutation.mutate()}
												savePending={saveMutation.isPending}
												canSave={!!name.trim()}
												onCancel={() => {
													setIsEditing(false);
													setName(courseQuery.data?.name ?? "");
													setDescription(courseQuery.data?.description ?? "");
												}}
												onDelete={() => deleteMutation.mutate()}
												deletePending={deleteMutation.isPending}
												className=""
											/>
										)}
									</div>
									<div className="mb-6 flex items-center gap-6 text-slate-400">
										<div className="flex items-center">
											<Clock className="mr-2 h-4 w-4" />
											{new Date(
												courseQuery.data.created_at,
											).toLocaleDateString()}
										</div>
									</div>

									<Link href={`/course/${courseId}/learn`}>
										<Button
											size="lg"
											className="bg-red-600 text-white hover:bg-red-700"
										>
											<Play className="mr-2 h-5 w-5" />
											{t("start_course")}
										</Button>
									</Link>
								</div>
							</div>
						</div>
					</div>

					{/* Course Description */}
					<Card className="mb-8 border-slate-800 bg-slate-900">
						<CardHeader>
							<CardTitle className="text-white">{t("about_course")}</CardTitle>
						</CardHeader>
						<CardContent>
							{isEditing ? (
								<Textarea
									value={description ?? ""}
									onChange={(e) => setDescription(e.target.value)}
									placeholder={
										t("course_description_placeholder") ?? "Description"
									}
									className="min-h-32 border-slate-700 bg-slate-800 text-white"
								/>
							) : (
								<div className="whitespace-pre-line text-slate-300">
									{courseQuery.data.description ?? t("no_description")}
								</div>
							)}
						</CardContent>
					</Card>

					{/* Course Structure */}
					<Card className="border-slate-800 bg-slate-900">
						<CardHeader>
							<CardTitle className="text-white">
								{t("course_structure")}
							</CardTitle>
							<CardDescription className="text-slate-400">
								{t("course_structure_modules_lessons", {
									modules: (topicsQuery.data ?? []).length,
									lessons: 0,
								})}
							</CardDescription>
						</CardHeader>
						<CardContent className="space-y-4">
							{canEdit && (
								<TopicCreateForm
									title={newTopicTitle}
									orderIndex={newTopicOrderIndex}
									onTitleChange={setNewTopicTitle}
									onOrderIndexChange={setNewTopicOrderIndex}
									onAdd={() => createTopicMutation.mutate()}
									pending={createTopicMutation.isPending}
								/>
							)}

							{(topicsQuery.data ?? []).map((topic) => (
								<Collapsible key={topic.id} defaultOpen>
									<CollapsibleTrigger className="group flex w-full items-center justify-between rounded-lg bg-slate-800 p-4 transition-colors hover:bg-slate-700">
										<div className="flex items-center gap-3">
											<BookOpen className="h-5 w-5 text-slate-400" />
											{editingTopicId === topic.id ? (
												<>
													<Input
														value={editTopicTitle}
														onChange={(e) => setEditTopicTitle(e.target.value)}
														className="max-w-xs border-slate-700 bg-slate-900 text-white"
													/>
													<Input
														type="number"
														value={editTopicOrderIndex}
														onChange={(e) =>
															setEditTopicOrderIndex(Number(e.target.value))
														}
														className="w-24 border-slate-700 bg-slate-900 text-white"
													/>
												</>
											) : (
												<span className="font-medium text-white">
													{topic.title}
												</span>
											)}
										</div>
										<div className="flex items-center gap-2">
											{canEdit &&
												(editingTopicId === topic.id ? (
													<>
														<Button
															size="icon"
															title={t("save") ?? "Save"}
															aria-label={t("save") ?? "Save"}
															onClick={() => updateTopicMutation.mutate()}
															disabled={
																updateTopicMutation.isPending ||
																!editTopicTitle.trim()
															}
															className="bg-red-600 text-white hover:bg-red-700"
														>
															{updateTopicMutation.isPending ? (
																<Loader2 className="h-4 w-4 animate-spin" />
															) : (
																<Save className="h-4 w-4" />
															)}
														</Button>
														<Button
															variant="ghost"
															size="icon"
															title={t("cancel") ?? "Cancel"}
															aria-label={t("cancel") ?? "Cancel"}
															onClick={() => {
																setEditingTopicId(null);
																setEditTopicTitle("");
															}}
															className="text-slate-300 hover:bg-slate-800"
														>
															<X className="h-4 w-4" />
														</Button>
													</>
												) : (
													<>
														<Button
															variant="ghost"
															size="icon"
															title={t("edit") ?? "Edit"}
															aria-label={t("edit") ?? "Edit"}
															onClick={() => {
																setEditingTopicId(topic.id);
																setEditTopicTitle(topic.title);
																setEditTopicOrderIndex(topic.order_index);
															}}
															className="bg-transparent hover:bg-transparent text-slate-300 hover:text-slate-400"
														>
															<Edit className="h-4 w-4" />
														</Button>
														<CreateTopicItemDialog
															topicId={topic.id}
															onCreatedExam={(exam) => {
																setTopicExams((prev) => ({
																	...prev,
																	[topic.id]: [...(prev[topic.id] ?? []), { ...exam }],
																}));
															}}
														/>
														<Button
															variant="ghost"
															size="icon"
															title={t("delete") ?? "Delete"}
															aria-label={t("delete") ?? "Delete"}
															onClick={() =>
																deleteTopicMutation.mutate(topic.id)
															}
															disabled={deleteTopicMutation.isPending}
															className="bg-transparent hover:bg-transparent text-red-400 hover:text-red-300"
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													</>
												))}
											<ChevronDown className="h-5 w-5 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
										</div>
									</CollapsibleTrigger>
									<CollapsibleContent className="mt-2 ml-8 space-y-2">
										{/* Exams list for this topic styled like reference rows */}
										{(topicExams[topic.id] ?? []).length === 0 ? (
											<div className="flex items-center rounded-lg bg-slate-800/50 p-3">
												<div className="mr-3 h-4 w-4 rounded-full border-2 border-slate-600" />
												<Play className="mr-3 h-4 w-4 text-blue-400" />
												<span className="text-slate-300 text-sm">{t("no_content_yet") ?? "No content yet"}</span>
											</div>
										) : (
											(topicExams[topic.id] ?? []).map((exam) => (
												<div key={exam.id} className="space-y-2">
													<div className="flex items-center rounded-lg bg-slate-800/50 p-3">
														<div className="mr-3 h-4 w-4 rounded-full border-2 border-slate-600" />
														<HelpCircle className="mr-3 h-4 w-4 text-orange-400" />
														<span className="text-slate-300 text-sm">
															Exam – {exam.type} · {exam.duration}m · {exam.tries_count}x
														</span>
													</div>
													{(exam.tasks ?? []).map((task) => (
														<div key={task.id} className="ml-6 flex items-center rounded-lg bg-slate-800/50 p-3">
															<CheckCircle2 className="mr-3 h-4 w-4 text-green-500" />
															<span className="text-slate-300 text-sm">
																{task.title} <span className="text-slate-400">· {task.task_type} · {task.points} {t("points") ?? "points"}</span>
															</span>
														</div>
													))}
													{(exam.tasks ?? []).length === 0 ? (
														<div className="ml-6 text-xs text-slate-400">{t("no_tasks_attached") ?? "No tasks attached yet."}</div>
													) : null}
												</div>
											))
										)}
									</CollapsibleContent>
								</Collapsible>
							))}
						</CardContent>
					</Card>
				</div>
			</main>

			<AuthModal type={authModal} onClose={() => setAuthModal(null)} />
		</div>
	);
}
