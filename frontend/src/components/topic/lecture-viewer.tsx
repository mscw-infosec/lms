"use client";

import {
	type LectureResponseDTO,
	completeLecture,
	getLecture,
	uncompleteLecture,
} from "@/api/lectures";
import { getVideoUrl } from "@/api/video";
import AttachmentList from "@/components/attachments/attachment-list";
import Markdown from "@/components/markdown";
import LectureNotes from "@/components/topic/lecture-notes";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useVideoPlayer } from "@/hooks/use-video-player";
import { formatTimecode } from "@/lib/timecode";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2, Undo2 } from "lucide-react";
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
	const player = useVideoPlayer(lectureId);

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

	const uncompleteMutation = useMutation({
		mutationFn: () => uncompleteLecture(lectureId),
		onSuccess: async () => {
			toast({ description: t("lecture_uncompleted") });
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

					{lecture.video_id && videoQuery.data && player.resumeAt > 0 ? (
						<div className="flex items-center justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm">
							<span className="text-slate-300">
								{t("video_resume_from", {
									time: formatTimecode(player.resumeAt),
								})}
							</span>
							<span className="flex items-center gap-1">
								<Button
									size="sm"
									className="bg-sky-600 text-white hover:bg-sky-700"
									onClick={() => {
										player.seekTo(player.resumeAt);
										player.dismissResume();
									}}
								>
									{t("video_resume")}
								</Button>
								<Button
									size="sm"
									variant="ghost"
									className="text-slate-400 hover:text-white"
									aria-label={t("close")}
									onClick={player.dismissResume}
								>
									×
								</Button>
							</span>
						</div>
					) : null}

					{lecture.video_id ? (
						<div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
							{videoQuery.isLoading ? (
								<div className="flex h-full items-center justify-center text-slate-400">
									<Loader2 className="h-6 w-6 animate-spin" />
								</div>
							) : videoQuery.data ? (
								<iframe
									ref={player.iframeRef}
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

					<AttachmentList owner={{ kind: "lecture", id: lectureId }} />

					<div className="flex justify-end pt-2">
						<Button
							onClick={() => {
								if (lecture.completed) {
									uncompleteMutation.mutate();
								} else {
									completeMutation.mutate();
								}
							}}
							disabled={
								completeMutation.isPending || uncompleteMutation.isPending
							}
							variant={lecture.completed ? "outline" : "default"}
							className={
								lecture.completed
									? "border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-white disabled:opacity-60"
									: "bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
							}
						>
							{completeMutation.isPending || uncompleteMutation.isPending ? (
								<Loader2 className="mr-2 h-4 w-4 animate-spin" />
							) : lecture.completed ? (
								<Undo2 className="mr-2 h-4 w-4" />
							) : (
								<CheckCircle2 className="mr-2 h-4 w-4" />
							)}
							{lecture.completed
								? t("unmark_complete")
								: t("mark_complete") || "Mark as completed"}
						</Button>
					</div>
				</CardContent>
			</Card>
			<LectureNotes
				key={lectureId}
				lectureId={lectureId}
				canSeek={!!videoQuery.data}
				onSeek={player.seekTo}
				getTime={player.getTime}
				duration={player.duration}
			/>
		</div>
	);
}
