"use client";

import {
	type TopicResponseDTO,
	type UpsertCourseResponseDTO,
	deleteCourse,
	editCourse,
	getCourseById,
	getCourseTopics,
} from "@/api/courses";
import {
	deleteExam,
	getExamTasks,
	getTopicExams,
	updateExam,
	updateExamTasks,
} from "@/api/exam";
import type { components } from "@/api/schema/schema";
import { createTopic, deleteTopic, updateTopic } from "@/api/topics";
import AttributeFilterEditor, {
	type AttributeFilter as LocalAttributeFilter,
} from "@/components/attribute-filter-editor";
import { AuthModal } from "@/components/auth-modal";
import ConfirmDialog from "@/components/common/confirm-dialog";
import CourseHeaderActions from "@/components/course/course-header-actions";
import { Header } from "@/components/header";
import Markdown from "@/components/markdown";
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
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useUserStore } from "@/store/user";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	ArrowLeft,
	BookOpen,
	ChevronDown,
	Edit,
	HelpCircle,
	Loader2,
	Play,
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
	const [accessFilter, setAccessFilter] = useState<LocalAttributeFilter | null>(
		null,
	);

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
		name: string;
		description?: string | null;
		type: components["schemas"]["UpsertExamRequestDTO"]["type"];
		duration: number;
		tries_count: number;
		topic_id: number;
		tasks?: PublicTaskDTO[];
	};
	const [topicExams, setTopicExams] = useState<Record<number, ExamLite[]>>({});
	const [deletingExamIds, setDeletingExamIds] = useState<Set<string>>(
		new Set(),
	);
	const [editingExamId, setEditingExamId] = useState<string | null>(null);
	const [editingExamTopicId, setEditingExamTopicId] = useState<number | null>(
		null,
	);
	const [editExamName, setEditExamName] = useState<string>("");
	const [editExamDescription, setEditExamDescription] = useState<string>("");
	const [editExamDuration, setEditExamDuration] = useState<number>(0);
	const [editExamTries, setEditExamTries] = useState<number>(1);

	useEffect(() => {
		async function loadExams() {
			if (!topicsQuery.isSuccess || !topicsQuery.data) return;
			try {
				const entries = await Promise.all(
					topicsQuery.data.map(async (topic) => {
						try {
							const exams = await getTopicExams(topic.id);
							const simplified = await Promise.all(
								exams.map(async (e) => ({
									id: e.id,
									name: e.name,
									description: e.description ?? null,
									type: e.type,
									duration: e.duration,
									tries_count: e.tries_count,
									topic_id: e.topic_id,
									tasks: await getExamTasks(e.id).catch(() => []),
								})),
							);
							return [topic.id, simplified] as const;
						} catch (_) {
							return [topic.id, []] as const;
						}
					}),
				);
				setTopicExams(Object.fromEntries(entries));
			} catch (_) {}
		}
		loadExams();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [topicsQuery.isSuccess, topicsQuery.data]);

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
		} catch (e) {}
	};

	useEffect(() => {
		if (courseQuery.data && !isEditing) {
			setName(courseQuery.data.name ?? "");
			setDescription(courseQuery.data.description ?? "");
			// Initialize access filter from server response if present
			setAccessFilter(
				((courseQuery.data as UpsertCourseResponseDTO)?.access_filter ??
					null) as LocalAttributeFilter | null,
			);
		}
	}, [courseQuery.data, isEditing]);

	const saveMutation = useMutation({
		mutationFn: async () =>
			editCourse(courseId, {
				name: name.trim(),
				description: description?.trim() || undefined,
				access_filter: accessFilter ?? null,
			}),
		onSuccess: async () => {
			toast({ description: t("saved_successfully") || "Saved" });
			await courseQuery.refetch();
			setIsEditing(false);
		},
		onError: (err: unknown) => {
			toast({ description: t("save_failed") || "Failed to save" });
		},
	});

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
								<ArrowLeft className="mr-2 h-4 w-4" />
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
												setAccessFilter(
													((courseQuery.data as UpsertCourseResponseDTO)
														?.access_filter ??
														null) as LocalAttributeFilter | null,
												);
											}}
											onDelete={() => deleteMutation.mutate()}
											deletePending={deleteMutation.isPending}
										/>
									</div>
								)}
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
											<h1 className="font-bold text-2xl text-white">
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
													setAccessFilter(
														((courseQuery.data as UpsertCourseResponseDTO)
															?.access_filter ??
															null) as LocalAttributeFilter | null,
													);
												}}
												onDelete={() => deleteMutation.mutate()}
												deletePending={deleteMutation.isPending}
												className=""
											/>
										)}
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
								<>
									<Textarea
										value={description ?? ""}
										onChange={(e) => setDescription(e.target.value)}
										placeholder={
											t("course_description_placeholder") ?? "Description"
										}
										className="min-h-32 border-slate-700 bg-slate-800 text-white"
									/>
									<AttributeFilterEditor
										value={accessFilter}
										onChange={setAccessFilter}
										className="mt-6"
									/>
								</>
							) : (
								<div className="text-slate-300">
									{courseQuery.data.description ? (
										<Markdown
											content={courseQuery.data.description}
											className="prose prose-invert max-w-none"
										/>
									) : (
										<span>{t("no_description")}</span>
									)}
								</div>
							)}
						</CardContent>
					</Card>

					{/* Course Structure */}
					{canEdit ? (
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
															onChange={(e) =>
																setEditTopicTitle(e.target.value)
															}
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
																className="bg-transparent text-slate-300 hover:bg-transparent hover:text-slate-400"
															>
																<Edit className="h-4 w-4" />
															</Button>
															<CreateTopicItemDialog
																topicId={topic.id}
																onCreatedExam={(exam) => {
																	setTopicExams((prev) => {
																		const list = prev[topic.id] ?? [];
																		const nextExam = {
																			id: exam.id,
																			name: exam.name,
																			description: exam.description ?? null,
																			type: exam.type,
																			duration: exam.duration,
																			tries_count: exam.tries_count,
																			topic_id: topic.id,
																		} as ExamLite;
																		return {
																			...prev,
																			[topic.id]: [...list, nextExam],
																		};
																	});
																}}
															/>
															<ConfirmDialog
																title={t("delete") || "Delete"}
																description={
																	t("confirm_delete_item") ||
																	"Are you sure you want to delete this item?"
																}
																confirmText={t("delete") || "Delete"}
																cancelText={t("cancel") || "Cancel"}
																onConfirm={() =>
																	deleteTopicMutation.mutate(topic.id)
																}
															>
																<Button
																	variant="ghost"
																	size="icon"
																	title={t("delete") ?? "Delete"}
																	aria-label={t("delete") ?? "Delete"}
																	disabled={deleteTopicMutation.isPending}
																	className="bg-transparent text-red-400 hover:bg-transparent hover:text-red-300"
																>
																	<Trash2 className="h-4 w-4" />
																</Button>
															</ConfirmDialog>
														</>
													))}
												<ChevronDown className="h-5 w-5 text-slate-400 transition-transform duration-200 group-data-[state=open]:rotate-180" />
											</div>
										</CollapsibleTrigger>
										<CollapsibleContent className="mt-2 ml-8 space-y-2">
											{(topicExams[topic.id] ?? []).map((exam) => (
												<div key={exam.id} className="space-y-2">
													<div className="flex items-center justify-between rounded-lg bg-slate-800/50 p-3">
														<div className="flex min-w-0 items-center gap-3">
															<HelpCircle className="mr-2 h-4 w-4 flex-shrink-0 text-orange-400" />
															<div className="min-w-0">
																<>
																	<div className="truncate font-medium text-slate-200">
																		{exam.name || t("exam")}
																	</div>
																	<div className="mt-1 hidden text-slate-500 text-xs sm:block">
																		{t("exam_card", {
																			type: t(
																				exam.type === "Instant"
																					? "exam_type_instant"
																					: "exam_type_delayed",
																			),
																			duration:
																				(exam.duration ?? 0) === 0
																					? t("no_timer") || "No timer"
																					: `${Math.ceil((exam.duration ?? 0) / 60)} ${t("minutes_short") || "min"}`,
																			tries:
																				(exam.tries_count ?? 0) === 0
																					? t("infty_attempts") ||
																						"Infinite attempts"
																					: `${exam.tries_count}`,
																		})}
																	</div>
																</>
															</div>
														</div>
														<div className="flex flex-shrink-0 items-center gap-2 whitespace-nowrap sm:gap-3">
															{user &&
															(user.role === "Teacher" ||
																user.role === "Admin") ? (
																<div className="hidden text-slate-400 text-xs sm:block">
																	ID: {exam.id}
																</div>
															) : null}
															{user &&
															(user.role === "Teacher" ||
																user.role === "Admin") ? (
																editingExamId === exam.id ? null : (
																	<>
																		<Button
																			variant="ghost"
																			size="icon"
																			title={t("edit") ?? "Edit"}
																			aria-label={t("edit") ?? "Edit"}
																			onClick={() => {
																				setEditingExamId(exam.id);
																				setEditingExamTopicId(topic.id);
																				setEditExamName(exam.name ?? "");
																				setEditExamDescription(
																					exam.description ?? "",
																				);
																				setEditExamDuration(exam.duration ?? 0);
																				setEditExamTries(exam.tries_count ?? 1);
																			}}
																			className="bg-transparent text-slate-300 hover:bg-transparent hover:text-slate-400"
																		>
																			<Edit className="h-4 w-4" />
																		</Button>
																	</>
																)
															) : null}
															{canEdit ? (
																<ConfirmDialog
																	title={t("delete") || "Delete"}
																	description={
																		t("confirm_delete_exam") ||
																		"Are you sure you want to delete this exam?"
																	}
																	confirmText={t("delete") || "Delete"}
																	cancelText={t("cancel") || "Cancel"}
																	onConfirm={async () => {
																		setDeletingExamIds((prev) =>
																			new Set(prev).add(exam.id),
																		);
																		try {
																			await deleteExam(exam.id);
																			setTopicExams((prev) => ({
																				...prev,
																				[topic.id]: (
																					prev[topic.id] ?? []
																				).filter((e) => e.id !== exam.id),
																			}));
																		} finally {
																			setDeletingExamIds((prev) => {
																				const next = new Set(prev);
																				next.delete(exam.id);
																				return next;
																			});
																		}
																	}}
																>
																	<Button
																		variant="ghost"
																		size="icon"
																		title={t("delete") ?? "Delete"}
																		aria-label={t("delete") ?? "Delete"}
																		disabled={deletingExamIds.has(exam.id)}
																		className="bg-transparent text-red-400 hover:bg-transparent hover:text-red-300"
																	>
																		{deletingExamIds.has(exam.id) ? (
																			<Loader2 className="h-4 w-4 animate-spin" />
																		) : (
																			<Trash2 className="h-4 w-4" />
																		)}
																	</Button>
																</ConfirmDialog>
															) : null}
														</div>
													</div>
												</div>
											))}
										</CollapsibleContent>
									</Collapsible>
								))}
							</CardContent>
						</Card>
					) : null}
				</div>
			</main>

			{/* Centralized Exam Edit Dialog */}
			<Dialog
				open={!!editingExamId}
				onOpenChange={(open) => {
					if (!open) {
						setEditingExamId(null);
						setEditingExamTopicId(null);
						setEditExamName("");
						setEditExamDescription("");
						setEditExamDuration(0);
						setEditExamTries(1);
					}
				}}
			>
				<DialogContent className="border-slate-800 bg-slate-900">
					<DialogHeader>
						<DialogTitle className="text-white">
							{t("edit_exam") || "Edit exam"}
						</DialogTitle>
					</DialogHeader>
					<div className="space-y-3 text-slate-200">
						<Input
							value={editExamName}
							onChange={(e) => setEditExamName(e.target.value)}
							placeholder={t("exam_name") || "Exam name"}
							className="border-slate-700 bg-slate-800 text-white"
						/>
						<Textarea
							value={editExamDescription}
							onChange={(e) => setEditExamDescription(e.target.value)}
							placeholder={t("exam_description") || "Description"}
							className="min-h-20 border-slate-700 bg-slate-800 text-white"
						/>
						<div className="mt-2 flex flex-wrap gap-3 text-slate-300">
							<div className="flex items-center gap-2">
								<label
									htmlFor="edit-exam-duration"
									className="text-sm opacity-80"
								>
									{t("exam_duration") || "Duration (seconds)"}
								</label>
								<Input
									id="edit-exam-duration"
									type="number"
									min={0}
									value={
										Number.isFinite(editExamDuration) ? editExamDuration : 0
									}
									onChange={(e) => setEditExamDuration(Number(e.target.value))}
									className="w-32 border-slate-700 bg-slate-800 text-white"
								/>
							</div>
							<div className="flex items-center gap-2">
								<label htmlFor="edit-exam-tries" className="text-sm opacity-80">
									{t("exam_tries") || "Attempts"}
								</label>
								<Input
									id="edit-exam-tries"
									type="number"
									min={0}
									value={Number.isFinite(editExamTries) ? editExamTries : 0}
									onChange={(e) => setEditExamTries(Number(e.target.value))}
									className="w-28 border-slate-700 bg-slate-800 text-white"
								/>
							</div>
						</div>
						<DialogFooter>
							<div className="flex w-full justify-end gap-2 pt-2">
								<Button
									variant="ghost"
									onClick={() => {
										setEditingExamId(null);
										setEditingExamTopicId(null);
										setEditExamName("");
										setEditExamDescription("");
										setEditExamDuration(0);
										setEditExamTries(1);
									}}
									className="text-slate-300 hover:bg-slate-800"
								>
									{t("cancel") ?? "Cancel"}
								</Button>
								<Button
									onClick={async () => {
										if (!editingExamId || editingExamTopicId == null) return;
										const list = topicExams[editingExamTopicId] ?? [];
										const prevExam = list.find((e) => e.id === editingExamId);
										if (!prevExam) return;
										const payload = {
											name: editExamName.trim(),
											description: editExamDescription.trim()
												? editExamDescription.trim()
												: undefined,
											type: prevExam.type,
											duration: Number(editExamDuration) || 0,
											tries_count: Number(editExamTries) || 0,
											topic_id: prevExam.topic_id,
										} as components["schemas"]["UpsertExamRequestDTO"];
										try {
											await updateExam(editingExamId, payload);
											setTopicExams((prev) => {
												const copy: typeof prev = { ...prev };
												const tl = copy[editingExamTopicId] ?? [];
												const idx = tl.findIndex((e) => e.id === editingExamId);
												if (idx !== -1) {
													const next = [...tl];
													const curr = next[idx];
													if (!curr) return copy;
													const updatedExam: ExamLite = {
														id: curr.id,
														name: payload.name,
														description: payload.description ?? null,
														type: curr.type,
														duration: payload.duration,
														tries_count: payload.tries_count,
														topic_id: curr.topic_id,
														tasks: curr.tasks,
													};
													next[idx] = updatedExam;
													copy[editingExamTopicId] = next;
												}
												return copy;
											});
											toast({
												description: t("saved_successfully") || "Saved",
											});
											setEditingExamId(null);
											setEditingExamTopicId(null);
											setEditExamName("");
											setEditExamDescription("");
											setEditExamDuration(0);
											setEditExamTries(1);
										} catch (_) {
											toast({
												description: t("save_failed") || "Failed to save",
											});
										}
									}}
									className="bg-red-600 text-white hover:bg-red-700"
								>
									{t("save") ?? "Save"}
								</Button>
							</div>
						</DialogFooter>
					</div>
				</DialogContent>
			</Dialog>

			{authModal ? (
				<AuthModal type={authModal} onClose={() => setAuthModal(null)} />
			) : null}
		</div>
	);
}
