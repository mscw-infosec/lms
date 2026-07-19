"use client";

import {
	type CourseUserRating,
	type ExportFormat,
	type UserOverallRating,
	downloadMyCourseRatingExport,
	downloadMyOverallExport,
	downloadUserCourseRatingExport,
	downloadUserOverallExport,
	getMyCourseRating,
	getMyOverall,
	getUserCourseRating,
	getUserOverall,
} from "@/api/rating";
import ExportButtons, { fmtNum } from "@/components/rating/export-buttons";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronRight, Loader2, Trophy } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";

function pct(n: number): string {
	return `${fmtNum(n)}%`;
}

function ScoreBar({ percent }: { percent: number }) {
	const clamped = Math.max(0, Math.min(100, percent));
	return (
		<div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
			<div
				className="h-full rounded-full bg-red-600"
				style={{ width: `${clamped}%` }}
			/>
		</div>
	);
}

function CourseBreakdown({
	courseId,
	userId,
}: {
	courseId: number;
	userId?: string;
}) {
	const { t } = useTranslation("common");
	const query = useQuery<CourseUserRating>({
		queryKey: ["rating-course-user", courseId, userId ?? "me"],
		queryFn: () =>
			userId
				? getUserCourseRating(courseId, userId)
				: getMyCourseRating(courseId),
		retry: false,
	});

	if (query.isLoading) {
		return (
			<div className="flex items-center gap-2 px-4 py-3 text-slate-400 text-sm">
				<Loader2 className="h-4 w-4 animate-spin" />{" "}
				{t("loading") || "Loading…"}
			</div>
		);
	}
	if (query.isError || !query.data) {
		return (
			<div className="px-4 py-3 text-slate-400 text-sm">
				{t("rating_load_failed") || "Failed to load rating"}
			</div>
		);
	}

	const data = query.data;
	if (data.breakdown.length === 0) {
		return (
			<div className="px-4 py-3 text-slate-400 text-sm">
				{t("rating_no_items") || "No graded items yet."}
			</div>
		);
	}

	return (
		<table className="w-full text-sm">
			<thead>
				<tr className="text-left text-slate-400">
					<th className="px-4 py-2 font-medium">
						{t("rating_item") || "Item"}
					</th>
					<th className="px-4 py-2 font-medium">
						{t("rating_type") || "Type"}
					</th>
					<th className="px-4 py-2 text-right font-medium">
						{t("rating_score") || "Score"}
					</th>
				</tr>
			</thead>
			<tbody>
				{data.breakdown.map((item) => (
					<tr
						key={`${item.kind}-${item.id}`}
						className="border-slate-800 border-t"
					>
						<td className="px-4 py-2 text-slate-200">{item.title}</td>
						<td className="px-4 py-2 text-slate-400">
							{item.kind === "exam"
								? t("rating_kind_exam") || "Exam"
								: t("rating_kind_practice") || "Practice"}
						</td>
						<td className="px-4 py-2 text-right text-slate-200">
							{fmtNum(item.earned)} / {fmtNum(item.max)}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}

/**
 * A user's overall rating: total across all courses plus a per-course breakdown
 * with CSV/XLSX export. Pass `userId` to view another user (teacher/admin), or
 * omit it to view the authenticated user.
 */
export default function UserRating({ userId }: { userId?: string }) {
	const { t } = useTranslation("common");
	const [expanded, setExpanded] = useState<number | null>(null);

	const query = useQuery<UserOverallRating>({
		queryKey: ["rating-overall", userId ?? "me"],
		queryFn: () => (userId ? getUserOverall(userId) : getMyOverall()),
		retry: false,
	});

	const overallExport = (format: ExportFormat) =>
		userId
			? downloadUserOverallExport(userId, format)
			: downloadMyOverallExport(format);

	const courseExport = (courseId: number) => (format: ExportFormat) =>
		userId
			? downloadUserCourseRatingExport(courseId, userId, format)
			: downloadMyCourseRatingExport(courseId, format);

	if (query.isLoading) {
		return (
			<div className="flex items-center gap-2 text-slate-400 text-sm">
				<Loader2 className="h-4 w-4 animate-spin" />{" "}
				{t("loading") || "Loading…"}
			</div>
		);
	}
	if (query.isError || !query.data) {
		return (
			<div className="text-slate-400 text-sm">
				{t("rating_load_failed") || "Failed to load rating"}
			</div>
		);
	}

	const data = query.data;

	return (
		<div className="space-y-6">
			<Card className="border-slate-800 bg-slate-900">
				<CardHeader>
					<CardTitle className="flex flex-wrap items-center justify-between gap-3 text-white">
						<span className="flex items-center gap-2">
							<Trophy className="h-5 w-5 text-red-500" />
							{userId
								? t("rating_user_overall_title", { name: data.username }) ||
									`${data.username}'s rating`
								: t("rating_my_overall_title") || "My rating"}
						</span>
						<ExportButtons onExport={overallExport} />
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-3">
					<div className="flex items-end justify-between gap-3">
						<div>
							<div className="font-semibold text-3xl text-white">
								{fmtNum(data.total_earned)}
								<span className="ml-1 text-base text-slate-400">
									/ {fmtNum(data.total_max)}
								</span>
							</div>
							<div className="text-slate-400 text-sm">
								{t("rating_total") || "Total across all courses"}
							</div>
						</div>
						<div className="font-semibold text-red-400 text-xl">
							{pct(data.percent)}
						</div>
					</div>
					<ScoreBar percent={data.percent} />
				</CardContent>
			</Card>

			{data.courses.length === 0 ? (
				<div className="text-slate-400 text-sm">
					{t("rating_no_courses") || "No course activity yet."}
				</div>
			) : (
				<div className="space-y-3">
					{data.courses.map((course) => {
						const isOpen = expanded === course.course_id;
						return (
							<Card
								key={course.course_id}
								className="border-slate-800 bg-slate-900"
							>
								<CardContent className="p-4">
									<div className="flex flex-wrap items-center justify-between gap-3">
										<button
											type="button"
											onClick={() =>
												setExpanded(isOpen ? null : course.course_id)
											}
											className="flex flex-1 items-center gap-2 text-left"
										>
											{isOpen ? (
												<ChevronDown className="h-4 w-4 text-slate-400" />
											) : (
												<ChevronRight className="h-4 w-4 text-slate-400" />
											)}
											<Link
												href={`/course/${course.course_id}`}
												onClick={(e) => e.stopPropagation()}
												className="font-medium text-white hover:text-red-400"
											>
												{course.title}
											</Link>
										</button>
										<div className="flex items-center gap-4">
											<span className="text-slate-200 text-sm">
												{fmtNum(course.earned)} / {fmtNum(course.max)}
											</span>
											<span className="w-14 text-right font-medium text-red-400 text-sm">
												{pct(course.percent)}
											</span>
											<ExportButtons
												onExport={courseExport(course.course_id)}
											/>
										</div>
									</div>
									<div className="mt-3">
										<ScoreBar percent={course.percent} />
									</div>
									{isOpen ? (
										<div className="mt-3 overflow-hidden rounded-lg border border-slate-800 bg-slate-950">
											<CourseBreakdown
												courseId={course.course_id}
												userId={userId}
											/>
										</div>
									) : null}
								</CardContent>
							</Card>
						);
					})}
				</div>
			)}
		</div>
	);
}
