"use client";

import { getLecture, updateLecture } from "@/api/lectures";
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
import { useMutation, useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export default function LectureEditDialog({
	lectureId,
	open,
	onOpenChange,
	onSaved,
}: {
	lectureId: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSaved?: () => void;
}) {
	const { t } = useTranslation("common");
	const { toast } = useToast();

	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [content, setContent] = useState("");
	const [videoId, setVideoId] = useState("");

	const lectureQuery = useQuery({
		queryKey: ["lecture", lectureId],
		queryFn: () => getLecture(lectureId),
		enabled: open,
		retry: false,
	});

	useEffect(() => {
		if (lectureQuery.data) {
			setTitle(lectureQuery.data.title);
			setDescription(lectureQuery.data.description ?? "");
			setContent(lectureQuery.data.content ?? "");
			setVideoId(lectureQuery.data.video_id ?? "");
		}
	}, [lectureQuery.data]);

	const saveMutation = useMutation({
		mutationFn: () =>
			updateLecture(lectureId, {
				title: title.trim(),
				description: description.trim() || undefined,
				content: content.trim() || undefined,
				video_id: videoId.trim() || undefined,
				order_index: 0,
			}),
		onSuccess: () => {
			toast({ description: t("saved_successfully") || "Saved" });
			onSaved?.();
			onOpenChange(false);
		},
		onError: () => toast({ description: t("save_failed") || "Failed to save" }),
	});

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[85vh] overflow-y-auto border-slate-800 bg-slate-900 text-slate-200">
				<DialogHeader>
					<DialogTitle>{t("edit_lecture") || "Edit lecture"}</DialogTitle>
				</DialogHeader>
				{lectureQuery.isLoading ? (
					<div className="flex items-center gap-2 p-4 text-slate-400 text-sm">
						<Loader2 className="h-4 w-4 animate-spin" />{" "}
						{t("loading") || "Loading…"}
					</div>
				) : (
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
					</div>
				)}
				<DialogFooter>
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
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
	);
}
