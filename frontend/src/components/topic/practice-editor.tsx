"use client";

import {
	type PracticeAdminDTO,
	createPracticeTask,
	getPracticeAdmin,
	removePracticeTask,
	updatePracticeTask,
} from "@/api/practice";
import type { TaskDTO, TaskType } from "@/api/tasks";
import ConfirmDialog from "@/components/common/confirm-dialog";
import CreateTaskDialog from "@/components/tasks/create-task-dialog";
import EditTaskDialog from "@/components/tasks/edit-task-dialog";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, ListChecks, Loader2, Plus, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";

// Practice is auto-graded, so only objectively-checkable task types are allowed.
const PRACTICE_TASK_TYPES: TaskType[] = [
	"SingleChoice",
	"MultipleChoice",
	"ShortText",
	"Ordering",
];

export default function PracticeEditor({
	practiceId,
	open,
	onOpenChange,
}: {
	practiceId: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	const { t } = useTranslation("common");
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const query = useQuery<PracticeAdminDTO>({
		queryKey: ["practice-admin", practiceId],
		queryFn: () => getPracticeAdmin(practiceId),
		enabled: open,
		retry: false,
	});

	const invalidate = async () => {
		await queryClient.invalidateQueries({
			queryKey: ["practice-admin", practiceId],
		});
		await queryClient.invalidateQueries({ queryKey: ["topic-practices"] });
	};

	const deleteMutation = useMutation({
		mutationFn: (taskId: number) => removePracticeTask(practiceId, taskId),
		onSuccess: async () => {
			toast({ description: t("deleted_successfully") || "Deleted" });
			await invalidate();
		},
		onError: () => toast({ description: t("delete_failed") || "Failed" }),
	});

	const tasks = query.data?.tasks ?? [];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-y-auto border-slate-800 bg-slate-900 text-slate-200 sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						{query.data?.title ?? t("practice") ?? "Practice"}
					</DialogTitle>
				</DialogHeader>

				<div className="space-y-3 py-2">
					{query.isLoading ? (
						<div className="flex items-center gap-2 text-slate-400 text-sm">
							<Loader2 className="h-4 w-4 animate-spin" />{" "}
							{t("loading") || "Loading…"}
						</div>
					) : tasks.length === 0 ? (
						<div className="text-slate-400 text-sm">
							{t("no_practice_tasks") || "No tasks yet."}
						</div>
					) : (
						tasks.map((task, idx) => (
							<div
								key={task.id}
								className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-800/50 p-3"
							>
								<div className="flex min-w-0 items-center gap-2">
									<ListChecks className="h-4 w-4 flex-shrink-0 text-emerald-400" />
									<div className="min-w-0">
										<div className="truncate font-medium text-white">
											{idx + 1}. {task.title}
										</div>
										<div className="text-slate-400 text-xs">
											{t(
												task.task_type === "SingleChoice"
													? "single_choice"
													: task.task_type === "MultipleChoice"
														? "multiple_choice"
														: task.task_type === "ShortText"
															? "short_text"
															: "ordering",
											)}{" "}
											· {task.points} {t("points_other") || "pts"}
										</div>
									</div>
								</div>
								<div className="flex flex-shrink-0 items-center gap-1">
									<EditTaskDialog
										task={task as unknown as TaskDTO}
										submitUpdate={(taskId, payload) =>
											updatePracticeTask(practiceId, taskId, payload)
										}
										onUpdated={() => invalidate()}
									>
										<Button
											variant="ghost"
											size="icon"
											className="text-slate-300 hover:bg-transparent hover:text-slate-400"
											title={t("edit") ?? "Edit"}
										>
											<Edit className="h-4 w-4" />
										</Button>
									</EditTaskDialog>
									<ConfirmDialog
										title={t("delete") || "Delete"}
										description={
											t("confirm_delete_item") ||
											"Are you sure you want to delete this item?"
										}
										confirmText={t("delete") || "Delete"}
										cancelText={t("cancel") || "Cancel"}
										onConfirm={() => deleteMutation.mutate(task.id)}
									>
										<Button
											variant="ghost"
											size="icon"
											disabled={deleteMutation.isPending}
											className="text-red-400 hover:bg-transparent hover:text-red-300"
											title={t("delete") ?? "Delete"}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</ConfirmDialog>
								</div>
							</div>
						))
					)}
				</div>

				<div className="flex justify-end border-slate-800 border-t pt-3">
					<CreateTaskDialog
						allowedTypes={PRACTICE_TASK_TYPES}
						submitTask={(payload) => createPracticeTask(practiceId, payload)}
						onCreated={() => invalidate()}
					>
						<Button className="bg-red-600 text-white hover:bg-red-700">
							<Plus className="mr-1 h-4 w-4" />
							{t("add_task") || "Add task"}
						</Button>
					</CreateTaskDialog>
				</div>
			</DialogContent>
		</Dialog>
	);
}
