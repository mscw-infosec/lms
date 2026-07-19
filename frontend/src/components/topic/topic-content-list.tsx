"use client";

import { deleteExam, getExamEntities } from "@/api/exam";
import { deleteLecture } from "@/api/lectures";
import { deletePractice } from "@/api/practice";
import {
	type TopicContentItemDTO,
	deleteTopicText,
	getTopicContent,
	reorderTopicContent,
} from "@/api/topics";
import ConfirmDialog from "@/components/common/confirm-dialog";
import EditExamDialog from "@/components/exam/edit-exam-dialog";
import CreateTopicItemDialog from "@/components/topic/create-topic-item-dialog";
import ExamMetaDialog from "@/components/topic/exam-meta-dialog";
import LectureEditDialog from "@/components/topic/lecture-edit-dialog";
import PracticeEditor from "@/components/topic/practice-editor";
import TextEditDialog from "@/components/topic/text-edit-dialog";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ArrowDown,
	ArrowUp,
	Dumbbell,
	Edit,
	FileText,
	HelpCircle,
	ListChecks,
	Settings,
	Trash2,
	Video,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

function kindIcon(kind: string) {
	switch (kind) {
		case "lecture":
			return <Video className="h-4 w-4 flex-shrink-0 text-sky-400" />;
		case "practice":
			return <Dumbbell className="h-4 w-4 flex-shrink-0 text-emerald-400" />;
		case "exam":
			return <HelpCircle className="h-4 w-4 flex-shrink-0 text-orange-400" />;
		default:
			return <FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />;
	}
}

export default function TopicContentList({
	topicId,
	canEdit,
}: {
	topicId: number;
	canEdit: boolean;
}) {
	const { t } = useTranslation("common");
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const [editLectureId, setEditLectureId] = useState<number | null>(null);
	const [editPracticeId, setEditPracticeId] = useState<number | null>(null);
	const [examMetaId, setExamMetaId] = useState<string | null>(null);
	const [examTasksId, setExamTasksId] = useState<string | null>(null);
	const [editText, setEditText] = useState<TopicContentItemDTO | null>(null);

	const contentQuery = useQuery<TopicContentItemDTO[]>({
		queryKey: ["topic-content", topicId],
		queryFn: () => getTopicContent(topicId),
		retry: false,
	});

	const examEntitiesQuery = useQuery({
		queryKey: ["exam-entities", examTasksId],
		queryFn: () => getExamEntities(String(examTasksId)),
		enabled: examTasksId != null,
		retry: false,
	});

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: ["topic-content", topicId] });

	const reorderMutation = useMutation({
		mutationFn: (items: TopicContentItemDTO[]) =>
			reorderTopicContent(
				topicId,
				items.map((i) => ({ kind: i.kind, id: i.id })),
			),
		onSuccess: invalidate,
		onError: () => toast({ description: t("save_failed") || "Failed" }),
	});

	const deleteMutation = useMutation({
		mutationFn: (item: TopicContentItemDTO) => {
			switch (item.kind) {
				case "lecture":
					return deleteLecture(Number(item.id));
				case "practice":
					return deletePractice(Number(item.id));
				case "exam":
					return deleteExam(item.id);
				default:
					return deleteTopicText(topicId, Number(item.id));
			}
		},
		onSuccess: async () => {
			toast({ description: t("deleted_successfully") || "Deleted" });
			await invalidate();
		},
		onError: () => toast({ description: t("delete_failed") || "Failed" }),
	});

	const items = contentQuery.data ?? [];

	const move = (index: number, dir: -1 | 1) => {
		const next = [...items];
		const j = index + dir;
		if (j < 0 || j >= next.length) return;
		const a = next[index];
		const b = next[j];
		if (!a || !b) return;
		next[index] = b;
		next[j] = a;
		reorderMutation.mutate(next);
	};

	return (
		<div className="space-y-2">
			{items.map((item, idx) => (
				<div
					key={`${item.kind}-${item.id}`}
					className="flex items-center justify-between rounded-lg bg-slate-800/50 p-3"
				>
					<div className="flex min-w-0 items-center gap-3">
						{kindIcon(item.kind)}
						<div className="min-w-0">
							<div className="truncate font-medium text-slate-200">
								{item.title || t(item.kind) || item.kind}
							</div>
							<div className="mt-1 text-slate-500 text-xs capitalize">
								{t(item.kind) || item.kind}
							</div>
						</div>
					</div>
					{canEdit ? (
						<div className="flex flex-shrink-0 items-center gap-1">
							<Button
								variant="ghost"
								size="icon"
								title={t("move_up") ?? "Move up"}
								onClick={() => move(idx, -1)}
								disabled={idx === 0 || reorderMutation.isPending}
								className="h-8 w-8 text-slate-300 hover:bg-transparent hover:text-slate-100"
							>
								<ArrowUp className="h-4 w-4" />
							</Button>
							<Button
								variant="ghost"
								size="icon"
								title={t("move_down") ?? "Move down"}
								onClick={() => move(idx, 1)}
								disabled={idx === items.length - 1 || reorderMutation.isPending}
								className="h-8 w-8 text-slate-300 hover:bg-transparent hover:text-slate-100"
							>
								<ArrowDown className="h-4 w-4" />
							</Button>

							{item.kind === "exam" ? (
								<Button
									variant="ghost"
									size="icon"
									title={t("manage_tasks") ?? "Manage tasks"}
									onClick={() => setExamTasksId(item.id)}
									className="h-8 w-8 text-emerald-300 hover:bg-transparent hover:text-emerald-200"
								>
									<ListChecks className="h-4 w-4" />
								</Button>
							) : null}
							{item.kind === "practice" ? (
								<Button
									variant="ghost"
									size="icon"
									title={t("manage_tasks") ?? "Manage tasks"}
									onClick={() => setEditPracticeId(Number(item.id))}
									className="h-8 w-8 text-emerald-300 hover:bg-transparent hover:text-emerald-200"
								>
									<ListChecks className="h-4 w-4" />
								</Button>
							) : null}

							<Button
								variant="ghost"
								size="icon"
								title={t("edit") ?? "Edit"}
								onClick={() => {
									if (item.kind === "lecture")
										setEditLectureId(Number(item.id));
									else if (item.kind === "exam") setExamMetaId(item.id);
									else if (item.kind === "text") setEditText(item);
									else if (item.kind === "practice")
										setEditPracticeId(Number(item.id));
								}}
								className="h-8 w-8 text-slate-300 hover:bg-transparent hover:text-slate-100"
							>
								{item.kind === "exam" ? (
									<Settings className="h-4 w-4" />
								) : (
									<Edit className="h-4 w-4" />
								)}
							</Button>

							<ConfirmDialog
								title={t("delete") || "Delete"}
								description={
									t("confirm_delete_item") ||
									"Are you sure you want to delete this item?"
								}
								confirmText={t("delete") || "Delete"}
								cancelText={t("cancel") || "Cancel"}
								onConfirm={() => deleteMutation.mutate(item)}
							>
								<Button
									variant="ghost"
									size="icon"
									title={t("delete") ?? "Delete"}
									disabled={deleteMutation.isPending}
									className="h-8 w-8 text-red-400 hover:bg-transparent hover:text-red-300"
								>
									<Trash2 className="h-4 w-4" />
								</Button>
							</ConfirmDialog>
						</div>
					) : null}
				</div>
			))}

			{canEdit ? (
				<div className="pt-1">
					<CreateTopicItemDialog
						topicId={topicId}
						onChanged={invalidate}
						triggerClassName="w-full justify-start border border-slate-700 border-dashed bg-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200"
					/>
				</div>
			) : null}

			{/* Edit dialogs */}
			{editLectureId != null ? (
				<LectureEditDialog
					lectureId={editLectureId}
					open={editLectureId != null}
					onOpenChange={(o) => {
						if (!o) setEditLectureId(null);
					}}
					onSaved={invalidate}
				/>
			) : null}

			{editPracticeId != null ? (
				<PracticeEditor
					practiceId={editPracticeId}
					open={editPracticeId != null}
					onOpenChange={(o) => {
						if (!o) {
							setEditPracticeId(null);
							invalidate();
						}
					}}
				/>
			) : null}

			{examMetaId != null ? (
				<ExamMetaDialog
					examId={examMetaId}
					open={examMetaId != null}
					onOpenChange={(o) => {
						if (!o) setExamMetaId(null);
					}}
					onSaved={invalidate}
				/>
			) : null}

			{examTasksId != null && examEntitiesQuery.data ? (
				<EditExamDialog
					examId={examTasksId}
					open={examTasksId != null}
					onOpenChange={(o) => {
						if (!o) setExamTasksId(null);
					}}
					entities={examEntitiesQuery.data}
					onSaved={invalidate}
				/>
			) : null}

			{editText != null ? (
				<TextEditDialog
					topicId={topicId}
					textId={Number(editText.id)}
					initialTitle={editText.title ?? ""}
					initialContent={editText.content ?? ""}
					open={editText != null}
					onOpenChange={(o) => {
						if (!o) setEditText(null);
					}}
					onSaved={invalidate}
				/>
			) : null}
		</div>
	);
}
