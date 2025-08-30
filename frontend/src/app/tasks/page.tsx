"use client";

import { type ExamDTO, getAllExams, updateExamTasks } from "@/api/exam";
import type { TaskDTO, TaskType } from "@/api/tasks";
import { deleteTask as deleteTaskApi, listTasks } from "@/api/tasks";
import { AuthModal } from "@/components/auth-modal";
import { Header } from "@/components/header";
import CreateTaskDialog from "@/components/tasks/create-task-dialog";
import EditTaskDialog from "@/components/tasks/edit-task-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useUserStore } from "@/store/user";
import {
	ArrowLeft,
	CheckSquare,
	CircleDot,
	Edit,
	FileText,
	Flag,
	Link2,
	ListChecks,
	ListOrdered,
	Plus,
	Trash2,
	Type as TypeIcon,
	Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

function getTaskIcon(type: TaskType) {
	const common = "mr-3 h-4 w-4 text-purple-400";
	switch (type) {
		case "SingleChoice":
			return <CircleDot className={common} />;
		case "MultipleChoice":
			return <CheckSquare className={common} />;
		case "ShortText":
			return <TypeIcon className={common} />;
		case "LongText":
			return <FileText className={common} />;
		case "Ordering":
			return <ListOrdered className={common} />;
		case "FileUpload":
			return <Upload className={common} />;
		case "ctfd":
			return <Flag className={common} />;
		default:
			return <ListChecks className={common} />;
	}
}

export default function TasksPage() {
	const { t } = useTranslation("common");
	const { user } = useUserStore();
	const [authModal, setAuthModal] = useState<"login" | "register" | null>(null);

	const authorized = user?.role === "Teacher" || user?.role === "Admin";

	const searchParams = useSearchParams();
	const router = useRouter();
	const [query, setQuery] = useState("");
	const [filterType, setFilterType] = useState<TaskType | "all">("all");
	const [tasks, setTasks] = useState<TaskDTO[]>([]);
	const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
	const [showLinkModal, setShowLinkModal] = useState(false);
	const [showDeleteModal, setShowDeleteModal] = useState(false);
	const [examId, setExamId] = useState("");
	const [exams, setExams] = useState<ExamDTO[]>([]);
	const [loadingExams, setLoadingExams] = useState(false);
	const [busy, setBusy] = useState<null | "link" | "delete">(null);
	const [loading, setLoading] = useState(false);
	const [hasMore, setHasMore] = useState(false);
	const [offset, setOffset] = useState(0);
	const PAGE_SIZE = 20;

	useEffect(() => {
		if (!authorized) return;
		let cancelled = false;

		setTasks([]);
		setOffset(0);
		setHasMore(false);
		const loadFirst = async () => {
			try {
				setLoading(true);
				const data = await listTasks(PAGE_SIZE, 0);
				if (cancelled) return;
				setTasks(data as TaskDTO[]);
				setOffset(data.length);
				setHasMore(data.length === PAGE_SIZE);
			} catch (e) {
				console.error(e);
			} finally {
				if (!cancelled) setLoading(false);
			}
		};
		void loadFirst();
		return () => {
			cancelled = true;
		};
	}, [authorized]);

	const loadMore = async () => {
		if (loading || !hasMore) return;
		setLoading(true);
		try {
			const data = await listTasks(PAGE_SIZE, offset);
			setTasks((prev) => [...prev, ...(data as TaskDTO[])]);
			setOffset((prev) => prev + data.length);
			setHasMore(data.length === PAGE_SIZE);
		} catch (e) {
			console.error(e);
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		const q = searchParams.get("q") || "";
		setQuery(q);
	}, [searchParams]);

	const filtered = useMemo(() => {
		const base =
			filterType === "all"
				? tasks
				: tasks.filter((t) => t.task_type === filterType);
		const q = query.trim().toLowerCase();
		if (!q) return base;
		return base.filter((t) => t.title?.toLowerCase().includes(q));
	}, [tasks, filterType, query]);

	const toggleSelected = (id: number, checked: boolean | "indeterminate") => {
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (checked) next.add(id);
			else next.delete(id);
			return next;
		});
	};

	const clearSelection = () => setSelectedIds(new Set());

	const loadExams = async () => {
		setLoadingExams(true);
		try {
			const examsList = await getAllExams();
			setExams(examsList);
		} catch (e) {
			console.error("Failed to load exams:", e);
		} finally {
			setLoadingExams(false);
		}
	};

	const onConfirmLink = async () => {
		if (selectedIds.size === 0 || !examId) return;
		setBusy("link");
		try {
			const taskIds = Array.from(selectedIds);
			await updateExamTasks(examId, taskIds);
			setShowLinkModal(false);
			clearSelection();
			setExamId("");
		} catch (e) {
			console.error(e);
			// eslint-disable-next-line no-alert
			alert(t("failed_operation") ?? "Operation failed");
		} finally {
			setBusy(null);
		}
	};

	const onConfirmDelete = async () => {
		if (selectedIds.size === 0) return;
		setBusy("delete");
		try {
			const ids = Array.from(selectedIds);
			const results = await Promise.allSettled(
				ids.map((id) => deleteTaskApi(id)),
			);
			const succeeded = new Set<number>();
			results.forEach((r, idx) => {
				if (r.status === "fulfilled") {
					const idVal = ids[idx];
					if (typeof idVal === "number") succeeded.add(idVal);
				}
			});
			if (succeeded.size > 0) {
				setTasks((prev) => prev.filter((t) => !succeeded.has(t.id)));
			}
			setShowDeleteModal(false);
			clearSelection();
		} catch (e) {
			console.error(e);
			// eslint-disable-next-line no-alert
			alert(t("failed_operation") ?? "Operation failed");
		} finally {
			setBusy(null);
		}
	};

	return (
		<div className="min-h-screen bg-slate-950 text-slate-200">
			<Header
				onLogin={() => setAuthModal("login")}
				onRegister={() => setAuthModal("register")}
			/>
			{authModal ? (
				<AuthModal type={authModal} onClose={() => setAuthModal(null)} />
			) : null}
			<div className="container mx-auto max-w-5xl px-4 py-8">
				{!authorized ? (
					<div className="flex min-h-[40vh] items-center justify-center text-slate-300">
						{t("sign_in_required")}
					</div>
				) : (
					<>
						<div className="mb-6 flex items-center justify-between">
							<h1 className="font-bold text-2xl text-white">
								{t("task_management")}
							</h1>
							<div className="flex items-center gap-2">
								<CreateTaskDialog
									onCreated={async (created: TaskDTO) => {
										if (created.task_type === "ctfd") {
											try {
												setLoading(true);
												const data = await listTasks(PAGE_SIZE, 0);
												setTasks(data as TaskDTO[]);
												setOffset(data.length);
												setHasMore(data.length === PAGE_SIZE);
											} catch (e) {
												console.error(e);
											} finally {
												setLoading(false);
											}
										} else {
											setTasks((prev) => [created, ...prev]);
										}
									}}
								>
									<Button
										size="sm"
										className="bg-red-600 px-2 text-white hover:bg-red-700 sm:px-3"
										title={t("create_task")}
									>
										<Plus className="h-4 w-4 sm:mr-2" />
										<span className="hidden sm:inline">{t("create_task")}</span>
									</Button>
								</CreateTaskDialog>
								<Link href="/">
									<Button
										variant="outline"
										size="sm"
										className="border-slate-700 bg-transparent px-2 text-slate-300 hover:bg-slate-800 sm:px-3"
										title={t("back")}
									>
										<ArrowLeft className="h-4 w-4 sm:mr-2" />
										<span className="hidden sm:inline">{t("back")}</span>
									</Button>
								</Link>
							</div>
						</div>

						<Card className="mb-6 border-slate-800 bg-slate-900">
							<CardContent className="flex flex-col gap-3 pt-4 md:flex-row md:items-end">
								<div className="flex-1">
									<label
										htmlFor="task-search"
										className="mb-1 block text-slate-400 text-sm"
									>
										{t("search")}
									</label>
									<div className="flex gap-2">
										<Input
											id="task-search"
											value={query}
											onChange={(e) => {
												const next = e.target.value;
												setQuery(next);
												const params = new URLSearchParams(
													Array.from(searchParams.entries()),
												);
												if (next) {
													params.set("q", next);
												} else {
													params.delete("q");
												}
												router.replace(`?${params.toString()}`);
											}}
											placeholder={t("search") ?? "Search"}
											className="border-slate-700 bg-slate-800 text-white"
										/>
									</div>
								</div>

								<div className="w-full md:w-64">
									<span className="mb-1 block text-slate-400 text-sm">
										{t("filter_type")}
									</span>
									<Select
										value={filterType}
										onValueChange={(v: TaskType | "all") => setFilterType(v)}
									>
										<SelectTrigger className="border-slate-700 bg-slate-800 text-white">
											<SelectValue placeholder={t("select_type")} />
										</SelectTrigger>
										<SelectContent className="border-slate-700 bg-slate-800 text-white">
											<SelectItem value="all">{t("all")}</SelectItem>
											<SelectItem value="SingleChoice">
												{t("single_choice")}
											</SelectItem>
											<SelectItem value="MultipleChoice">
												{t("multiple_choice")}
											</SelectItem>
											<SelectItem value="ShortText">
												{t("short_text")}
											</SelectItem>
											<SelectItem value="LongText">{t("long_text")}</SelectItem>
											<SelectItem value="Ordering">{t("ordering")}</SelectItem>
											<SelectItem value="FileUpload">
												{t("file_upload")}
											</SelectItem>
											<SelectItem value="ctfd">CTFd</SelectItem>
										</SelectContent>
									</Select>
								</div>
							</CardContent>
						</Card>

						<Card className="border-slate-800 bg-slate-900">
							<CardHeader>
								<CardTitle className="text-lg text-white">
									{t("tasks")}
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-2">
								<div className="mb-2 flex items-center justify-between rounded-md border border-slate-700 bg-slate-800/70 p-3">
									<div className="text-slate-300 text-sm">
										{selectedIds.size > 0
											? t("selected_count", { count: selectedIds.size })
											: (t("no_tasks_selected") ?? "No tasks selected")}
									</div>
									<div className="flex gap-1 sm:gap-2">
										<Button
											size="sm"
											className="bg-red-600 px-2 text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-400 sm:px-3"
											disabled={selectedIds.size === 0}
											onClick={() => {
												setShowLinkModal(true);
												loadExams();
											}}
											title={t("link_to_exam")}
										>
											<Link2 className="h-4 w-4 sm:mr-2" />
											<span className="hidden sm:inline">
												{t("link_to_exam")}
											</span>
										</Button>
										<Button
											size="sm"
											variant="ghost"
											className="bg-transparent px-2 text-red-400 hover:bg-transparent hover:text-red-300 disabled:cursor-not-allowed disabled:text-slate-500 sm:px-3"
											disabled={selectedIds.size === 0}
											onClick={() => setShowDeleteModal(true)}
											title={t("delete_selected")}
										>
											<Trash2 className="h-4 w-4 sm:mr-2" />
											<span className="hidden sm:inline">
												{t("delete_selected")}
											</span>
										</Button>
									</div>
								</div>
								{filtered.length === 0 ? (
									<div className="text-slate-400 text-sm">
										{t("no_results")}
									</div>
								) : (
									filtered.map((task) => (
										<div
											key={task.id}
											className="flex items-center justify-between rounded-lg bg-slate-800/50 p-3"
										>
											<div className="flex items-center">
												<Checkbox
													checked={selectedIds.has(task.id)}
													onCheckedChange={(checked) =>
														toggleSelected(task.id, checked)
													}
													className="mr-3 border-slate-200 hover:cursor-pointer data-[state=checked]:bg-red-600"
												/>
												{getTaskIcon(task.task_type)}
												<div>
													<div className="font-medium text-white">
														{task.title}
													</div>
													<div className="text-slate-400 text-xs">
														{t("points_other")}: {task.points} · {t("type")}:{" "}
														{task.task_type}
													</div>
												</div>
											</div>
											<div className="flex items-center gap-3">
												<div className="text-slate-400 text-xs">
													ID: {task.id}
												</div>
												{user &&
												(user.role === "Teacher" || user.role === "Admin") ? (
													<EditTaskDialog
														task={task}
														onUpdated={(updated) => {
															setTasks((prev) =>
																prev.map((t) =>
																	t.id === updated.id ? updated : t,
																),
															);
														}}
													>
														<Button
															variant="ghost"
															size="icon"
															className="bg-transparent text-slate-300 hover:bg-transparent hover:text-slate-400"
														>
															<Edit className="h-4 w-4" />
														</Button>
													</EditTaskDialog>
												) : null}
											</div>
										</div>
									))
								)}
								{/* Pagination */}
								<div className="pt-2">
									{hasMore ? (
										<Button
											onClick={loadMore}
											disabled={loading}
											className="bg-red-600 text-white hover:bg-red-700"
										>
											{loading
												? (t("loading") ?? "Loading...")
												: (t("load_more") ?? "Load more")}
										</Button>
									) : filtered.length > 0 ? (
										<div className="text-slate-500 text-xs">
											{t("no_more_results") ?? "No more results"}
										</div>
									) : null}
								</div>
							</CardContent>
						</Card>

						{/* Link to Exam Dialog */}
						<Dialog
							open={showLinkModal}
							onOpenChange={(o) => {
								if (!o) setShowLinkModal(false);
							}}
						>
							<DialogContent className="border border-slate-800 bg-slate-900 text-slate-200">
								<DialogHeader>
									<DialogTitle>{t("link_to_exam")}</DialogTitle>
									<DialogDescription>
										{t("link_to_exam_help") ??
											"Choose exam and how to link selected tasks."}
									</DialogDescription>
								</DialogHeader>
								<div className="space-y-3">
									<div>
										<label
											htmlFor="exam-select"
											className="mb-1 block text-slate-400 text-sm"
										>
											{t("select_exam") ?? "Select Exam"}
										</label>
										<Select value={examId} onValueChange={setExamId}>
											<SelectTrigger className="border-slate-700 bg-slate-800 text-white">
												<SelectValue
													placeholder={
														loadingExams
															? (t("loading") ?? "Loading...")
															: (t("select_exam") ?? "Select an exam")
													}
												/>
											</SelectTrigger>
											<SelectContent className="border-slate-700 bg-slate-800">
												{loadingExams ? (
													<SelectItem value="loading" disabled>
														{t("loading") ?? "Loading..."}
													</SelectItem>
												) : exams.length === 0 ? (
													<SelectItem value="no_exams" disabled>
														{t("no_exams_found") ?? "No exams found"}
													</SelectItem>
												) : (
													exams.map((exam) => (
														<SelectItem
															key={exam.id}
															value={exam.id}
															className="text-white hover:bg-slate-700 hover:text-slate-100 focus:bg-slate-700 focus:text-slate-100"
														>
															<div className="flex w-full flex-col items-start justify-center">
																<span className="text-left font-medium">
																	{exam.name}
																</span>
																<span className="text-left text-slate-400 text-xs">
																	ID: {exam.id}
																</span>
															</div>
														</SelectItem>
													))
												)}
											</SelectContent>
										</Select>
									</div>
								</div>
								<DialogFooter>
									<Button
										variant="outline"
										className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
										onClick={() => setShowLinkModal(false)}
									>
										{t("cancel")}
									</Button>
									<Button
										onClick={onConfirmLink}
										disabled={!examId || busy === "link"}
										className="bg-red-600 text-white hover:bg-red-700"
									>
										{busy === "link"
											? (t("linking") ?? "Linking...")
											: t("link_to_exam")}
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>

						{/* Delete Selected Dialog */}
						<Dialog
							open={showDeleteModal}
							onOpenChange={(o) => {
								if (!o) setShowDeleteModal(false);
							}}
						>
							<DialogContent className="border border-slate-800 bg-slate-900 text-slate-200">
								<DialogHeader>
									<DialogTitle>{t("are_you_sure")}</DialogTitle>
									<DialogDescription>
										{t("confirm_delete_tasks") ??
											"Delete selected tasks? This action cannot be undone."}
									</DialogDescription>
								</DialogHeader>
								<DialogFooter>
									<Button
										variant="outline"
										className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
										onClick={() => setShowDeleteModal(false)}
									>
										{t("cancel")}
									</Button>
									<Button
										onClick={onConfirmDelete}
										disabled={busy === "delete"}
										className="bg-red-600 text-white hover:bg-red-700"
									>
										{busy === "delete"
											? (t("deleting_selected") ?? "Deleting...")
											: t("delete_selected")}
									</Button>
								</DialogFooter>
							</DialogContent>
						</Dialog>
					</>
				)}
			</div>
		</div>
	);
}
