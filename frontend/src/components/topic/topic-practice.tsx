"use client";

import {
	type PracticeSummaryDTO,
	deletePractice,
	listTopicPractices,
	updatePractice,
} from "@/api/practice";
import ConfirmDialog from "@/components/common/confirm-dialog";
import PracticeEditor from "@/components/topic/practice-editor";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dumbbell, Edit, ListChecks, Loader2, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function TopicPractice({
	topicId,
	canEdit,
}: {
	topicId: number;
	canEdit: boolean;
}) {
	const { t } = useTranslation("common");
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const [managingId, setManagingId] = useState<number | null>(null);
	const [editing, setEditing] = useState<PracticeSummaryDTO | null>(null);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [order, setOrder] = useState(0);

	const practicesQuery = useQuery<PracticeSummaryDTO[]>({
		queryKey: ["topic-practices", topicId],
		queryFn: () => listTopicPractices(topicId),
		retry: false,
	});

	const saveMutation = useMutation({
		mutationFn: async () => {
			if (!editing) return;
			return updatePractice(editing.id, {
				title: title.trim(),
				description: description.trim() || undefined,
				order_index: Number(order) || 0,
			});
		},
		onSuccess: async () => {
			toast({ description: t("saved_successfully") || "Saved" });
			await queryClient.invalidateQueries({
				queryKey: ["topic-practices", topicId],
			});
			setEditing(null);
		},
		onError: () => toast({ description: t("save_failed") || "Failed to save" }),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: number) => deletePractice(id),
		onSuccess: async () => {
			toast({ description: t("deleted_successfully") || "Deleted" });
			await queryClient.invalidateQueries({
				queryKey: ["topic-practices", topicId],
			});
		},
		onError: () =>
			toast({ description: t("delete_failed") || "Failed to delete" }),
	});

	const practices = practicesQuery.data ?? [];
	if (practices.length === 0) return null;

	return (
		<>
			{practices.map((practice) => (
				<div
					key={practice.id}
					className="flex items-center justify-between rounded-lg bg-slate-800/50 p-3"
				>
					<div className="flex min-w-0 items-center gap-3">
						<Dumbbell className="mr-2 h-4 w-4 flex-shrink-0 text-emerald-400" />
						<div className="min-w-0">
							<div className="truncate font-medium text-slate-200">
								{practice.title}
							</div>
							<div className="mt-1 text-slate-500 text-xs">
								{t("practice") || "Practice"} · {practice.task_count}{" "}
								{t("tasks") || "tasks"}
							</div>
						</div>
					</div>
					{canEdit ? (
						<div className="flex flex-shrink-0 items-center gap-2">
							<Button
								variant="ghost"
								size="icon"
								title={t("manage_tasks") ?? "Manage tasks"}
								aria-label={t("manage_tasks") ?? "Manage tasks"}
								onClick={() => setManagingId(practice.id)}
								className="bg-transparent text-emerald-300 hover:bg-transparent hover:text-emerald-200"
							>
								<ListChecks className="h-4 w-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								title={t("edit") ?? "Edit"}
								aria-label={t("edit") ?? "Edit"}
								onClick={() => {
									setEditing(practice);
									setTitle(practice.title);
									setDescription(practice.description ?? "");
									setOrder(practice.order_index);
								}}
								className="bg-transparent text-slate-300 hover:bg-transparent hover:text-slate-400"
							>
								<Edit className="h-4 w-4" />
							</Button>
							<ConfirmDialog
								title={t("delete") || "Delete"}
								description={
									t("confirm_delete_practice") ||
									"Delete this practice and all its tasks?"
								}
								confirmText={t("delete") || "Delete"}
								cancelText={t("cancel") || "Cancel"}
								onConfirm={() => deleteMutation.mutate(practice.id)}
							>
								<Button
									variant="ghost"
									size="icon"
									title={t("delete") ?? "Delete"}
									aria-label={t("delete") ?? "Delete"}
									disabled={deleteMutation.isPending}
									className="bg-transparent text-red-400 hover:bg-transparent hover:text-red-300"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</ConfirmDialog>
						</div>
					) : null}
				</div>
			))}

			{managingId != null ? (
				<PracticeEditor
					practiceId={managingId}
					open={managingId != null}
					onOpenChange={(o) => {
						if (!o) setManagingId(null);
					}}
				/>
			) : null}

			<Dialog
				open={editing != null}
				onOpenChange={(o) => {
					if (!o) setEditing(null);
				}}
			>
				<DialogContent className="border-slate-800 bg-slate-900 text-slate-200">
					<DialogHeader>
						<DialogTitle>{t("edit_practice") || "Edit practice"}</DialogTitle>
					</DialogHeader>
					<div className="space-y-4">
						<div className="space-y-2">
							<Label className="text-slate-300">{t("title") || "Title"}</Label>
							<Input
								value={title}
								onChange={(e) => setTitle(e.target.value)}
								className="border-slate-700 bg-slate-800 text-white"
							/>
						</div>
						<div className="space-y-2">
							<Label className="text-slate-300">
								{t("description") || "Description"}
							</Label>
							<Input
								value={description}
								onChange={(e) => setDescription(e.target.value)}
								className="border-slate-700 bg-slate-800 text-white"
							/>
						</div>
						<div className="space-y-2">
							<Label className="text-slate-300">
								{t("order_index") || "Order"}
							</Label>
							<Input
								type="number"
								min={0}
								value={order}
								onChange={(e) => setOrder(Number(e.target.value))}
								className="w-32 border-slate-700 bg-slate-800 text-white"
							/>
						</div>
					</div>
					<DialogFooter>
						<Button
							variant="ghost"
							onClick={() => setEditing(null)}
							className="text-slate-300 hover:bg-slate-800"
						>
							{t("cancel") || "Cancel"}
						</Button>
						<Button
							onClick={() => saveMutation.mutate()}
							disabled={saveMutation.isPending || !title.trim()}
							className="bg-red-600 text-white hover:bg-red-700"
						>
							{saveMutation.isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : null}
							{t("save") || "Save"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
