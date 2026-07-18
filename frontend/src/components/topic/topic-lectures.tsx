"use client";

import {
	type LectureSummaryDTO,
	deleteLecture,
	getLecture,
	getTopicLectures,
	updateLecture,
} from "@/api/lectures";
import ConfirmDialog from "@/components/common/confirm-dialog";
import VideoUploadField from "@/components/topic/video-upload-field";
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
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Loader2, Trash2, Video } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

export default function TopicLectures({
	topicId,
	canEdit,
}: {
	topicId: number;
	canEdit: boolean;
}) {
	const { t } = useTranslation("common");
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const [editingId, setEditingId] = useState<number | null>(null);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [content, setContent] = useState("");
	const [videoId, setVideoId] = useState("");
	const [order, setOrder] = useState(0);

	const lecturesQuery = useQuery<LectureSummaryDTO[]>({
		queryKey: ["topic-lectures", topicId],
		queryFn: () => getTopicLectures(topicId),
		retry: false,
	});

	const openEdit = async (id: number) => {
		try {
			const full = await getLecture(id);
			setEditingId(id);
			setTitle(full.title);
			setDescription(full.description ?? "");
			setContent(full.content ?? "");
			setVideoId(full.video_id ?? "");
			const summary = lecturesQuery.data?.find((l) => l.id === id);
			setOrder(summary?.order_index ?? 0);
		} catch (e) {
			toast({ description: t("load_failed") || "Failed to load lecture" });
		}
	};

	const saveMutation = useMutation({
		mutationFn: async () => {
			if (editingId == null) return;
			return updateLecture(editingId, {
				title: title.trim(),
				description: description.trim() || undefined,
				content: content.trim() || undefined,
				video_id: videoId.trim() || undefined,
				order_index: Number(order) || 0,
			});
		},
		onSuccess: async () => {
			toast({ description: t("saved_successfully") || "Saved" });
			await queryClient.invalidateQueries({
				queryKey: ["topic-lectures", topicId],
			});
			setEditingId(null);
		},
		onError: () => toast({ description: t("save_failed") || "Failed to save" }),
	});

	const deleteMutation = useMutation({
		mutationFn: (id: number) => deleteLecture(id),
		onSuccess: async () => {
			toast({ description: t("deleted_successfully") || "Deleted" });
			await queryClient.invalidateQueries({
				queryKey: ["topic-lectures", topicId],
			});
		},
		onError: () =>
			toast({ description: t("delete_failed") || "Failed to delete" }),
	});

	const lectures = lecturesQuery.data ?? [];
	if (lectures.length === 0) return null;

	return (
		<>
			{lectures.map((lecture) => (
				<div
					key={lecture.id}
					className="flex items-center justify-between rounded-lg bg-slate-800/50 p-3"
				>
					<div className="flex min-w-0 items-center gap-3">
						<Video className="mr-2 h-4 w-4 flex-shrink-0 text-sky-400" />
						<div className="min-w-0">
							<div className="truncate font-medium text-slate-200">
								{lecture.title}
							</div>
							{lecture.description ? (
								<div className="mt-1 hidden truncate text-slate-500 text-xs sm:block">
									{lecture.description}
								</div>
							) : null}
						</div>
					</div>
					{canEdit ? (
						<div className="flex flex-shrink-0 items-center gap-2">
							<Button
								variant="ghost"
								size="icon"
								title={t("edit") ?? "Edit"}
								aria-label={t("edit") ?? "Edit"}
								onClick={() => openEdit(lecture.id)}
								className="bg-transparent text-slate-300 hover:bg-transparent hover:text-slate-400"
							>
								<Edit className="h-4 w-4" />
							</Button>
							<ConfirmDialog
								title={t("delete") || "Delete"}
								description={
									t("confirm_delete_item") ||
									"Are you sure you want to delete this item?"
								}
								confirmText={t("delete") || "Delete"}
								cancelText={t("cancel") || "Cancel"}
								onConfirm={() => deleteMutation.mutate(lecture.id)}
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

			<Dialog
				open={editingId != null}
				onOpenChange={(open) => {
					if (!open) setEditingId(null);
				}}
			>
				<DialogContent className="max-h-[85vh] overflow-y-auto border-slate-800 bg-slate-900 text-slate-200">
					<DialogHeader>
						<DialogTitle>{t("edit_lecture") || "Edit lecture"}</DialogTitle>
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
								{t("lecture_content") || "Content (Markdown)"}
							</Label>
							<Textarea
								value={content}
								onChange={(e) => setContent(e.target.value)}
								className="min-h-32 border-slate-700 bg-slate-800 text-white"
							/>
						</div>
						<VideoUploadField value={videoId} onChange={setVideoId} />
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
							onClick={() => setEditingId(null)}
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
