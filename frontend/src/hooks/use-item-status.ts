import { getUserExamAttempts } from "@/api/exam";
import { getTopicLectures } from "@/api/lectures";
import { listTopicPractices } from "@/api/practice";
import type { TopicContentItemDTO } from "@/api/topics";
import { useQueries } from "@tanstack/react-query";

export type ItemStatus = "completed" | "in_progress" | "not_started";

export function useItemStatus(
	topicIds: number[],
	contentByTopic: Record<number, TopicContentItemDTO[] | null> | undefined,
) {
	const lectureQueries = useQueries({
		queries: topicIds.map((topicId) => ({
			queryKey: ["topic-lectures", topicId],
			queryFn: () => getTopicLectures(topicId),
			retry: false,
		})),
	});

	const practiceQueries = useQueries({
		queries: topicIds.map((topicId) => ({
			queryKey: ["topic-practices", topicId],
			queryFn: () => listTopicPractices(topicId),
			retry: false,
		})),
	});

	const examIds = Object.values(contentByTopic ?? {})
		.flatMap((items) => items ?? [])
		.filter((item) => item.kind === "exam")
		.map((item) => item.id);

	const examQueries = useQueries({
		queries: examIds.map((examId) => ({
			queryKey: ["exam", examId, "attempts-list"],
			queryFn: () => getUserExamAttempts(examId),
			retry: false,
		})),
	});

	const lectures = new Map<number, boolean>();
	for (const q of lectureQueries) {
		for (const l of q.data ?? []) lectures.set(l.id, l.completed);
	}

	const practices = new Map<number, ItemStatus>();
	for (const q of practiceQueries) {
		for (const p of q.data ?? []) {
			if (p.task_count > 0 && p.solved_count >= p.task_count) {
				practices.set(p.id, "completed");
			} else if (p.solved_count > 0) {
				practices.set(p.id, "in_progress");
			}
		}
	}

	const exams = new Map<string, ItemStatus>();
	examIds.forEach((examId, i) => {
		const attempts = examQueries[i]?.data?.attempts ?? [];
		if (attempts.some((a) => a.active)) exams.set(examId, "in_progress");
		else if (attempts.length > 0) exams.set(examId, "completed");
	});

	return (item: TopicContentItemDTO): ItemStatus | null => {
		switch (item.kind) {
			case "lecture":
				return lectures.get(Number(item.id)) ? "completed" : "not_started";
			case "practice":
				return practices.get(Number(item.id)) ?? "not_started";
			case "exam":
				return exams.get(item.id) ?? "not_started";
			default:
				return null;
		}
	};
}
