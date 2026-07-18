"use client";

import {
	type LectureResponseDTO,
	completeLecture,
	getLecture,
} from "@/api/lectures";
import { getVideoUrl } from "@/api/video";
import Markdown from "@/components/markdown";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function LectureViewer({
	lectureId,
	topicId,
}: {
	lectureId: number;
	topicId?: number;
}) {
	const { t } = useTranslation("common");
	const { toast } = useToast();
	const queryClient = useQueryClient();

	const lectureQuery = useQuery<LectureResponseDTO>({
		queryKey: ["lecture", lectureId],
		queryFn: () => getLecture(lectureId),
		retry: false,
	});

	const lecture = lectureQuery.data;

	const videoQuery = useQuery({
		queryKey: ["video-url", lecture?.video_id],
		queryFn: () => getVideoUrl(String(lecture?.video_id)),
		enabled: !!lecture?.video_id,
		retry: false,
	});

	const completeMutation = useMutation({
		mutationFn: () => completeLecture(lectureId),
		onSuccess: async () => {
			toast({ description: t("lecture_completed") || "Marked as completed" });
			await queryClient.invalidateQueries({ queryKey: ["lecture", lectureId] });
			if (topicId != null) {
				await queryClient.invalidateQueries({
					queryKey: ["topic-lectures", topicId],
				});
			}
		},
		onError: () => toast({ description: t("save_failed") || "Failed" }),
	});

	if (lectureQuery.isLoading) {
		return (
			<Card className="border-slate-800 bg-slate-900">
				<CardContent className="flex items-center gap-2 p-6 text-slate-400 text-sm">
					<Loader2 className="h-4 w-4 animate-spin" />{" "}
					{t("loading") || "Loading…"}
				</CardContent>
			</Card>
		);
	}

	if (lectureQuery.isError || !lecture) {
		return (
			<Card className="border-slate-800 bg-slate-900">
				<CardContent className="p-6 text-slate-400 text-sm">
					{t("lecture_not_found") || "Lecture not found"}
				</CardContent>
			</Card>
		);
	}

	return (
		<div className="mx-auto w-full max-w-4xl space-y-4">
			<Card className="border-slate-800 bg-slate-900">
				<CardHeader>
					<CardTitle className="flex items-center justify-between gap-2 text-2xl text-white">
						<span>{lecture.title}</span>
						{lecture.completed ? (
							<span className="flex items-center gap-1 text-green-400 text-sm">
								<CheckCircle2 className="h-4 w-4" />
								{t("completed") || "Completed"}
							</span>
						) : null}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4">
					{lecture.description ? (
						<p className="text-slate-400">{lecture.description}</p>
					) : null}

					{lecture.video_id ? (
						<div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
							{videoQuery.isLoading ? (
								<div className="flex h-full items-center justify-center text-slate-400">
									<Loader2 className="h-6 w-6 animate-spin" />
								</div>
							) : videoQuery.data ? (
								<iframe
									title={lecture.title}
									src={videoQuery.data}
									className="h-full w-full"
									allow="autoplay; fullscreen; picture-in-picture"
									allowFullScreen
								/>
							) : (
								<div className="flex h-full items-center justify-center text-slate-500 text-sm">
									{t("video_unavailable") || "Video unavailable"}
								</div>
							)}
						</div>
					) : null}

					{lecture.content ? (
						<Markdown
							content={lecture.content}
							className="markdown-body max-w-none text-slate-200"
						/>
					) : null}

					<div className="flex justify-end pt-2">
						<Button
							onClick={() => completeMutation.mutate()}
							disabled={completeMutation.isPending || lecture.completed}
							className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
						>
							{completeMutation.isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : (
								<CheckCircle2 className="mr-2 h-4 w-4" />
							)}
							{lecture.completed
								? t("completed") || "Completed"
								: t("mark_complete") || "Mark as completed"}
						</Button>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
