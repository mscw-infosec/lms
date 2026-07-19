"use client";

import {
	type CourseLeaderboard as CourseLeaderboardData,
	type CourseUserRating,
	type ExportFormat,
	downloadCourseLeaderboardExport,
	downloadUserCourseRatingExport,
	getCourseLeaderboard,
	getUserCourseRating,
} from "@/api/rating";
import ExportButtons, { fmtNum } from "@/components/rating/export-buttons";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
	ChevronDown,
	ChevronRight,
	Loader2,
	RefreshCw,
	Search,
	Trophy,
} from "lucide-react";
import { Fragment, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

const PAGE_SIZE = 20;

function ParticipantBreakdown({
	courseId,
	userId,
}: {
	courseId: number;
	userId: string;
}) {
	const { t } = useTranslation("common");
	const query = useQuery<CourseUserRating>({
		queryKey: ["rating-course-user", courseId, userId],
		queryFn: () => getUserCourseRating(courseId, userId),
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
	if (query.isError || !query.data || query.data.breakdown.length === 0) {
		return (
			<div className="px-4 py-3 text-slate-400 text-sm">
				{t("rating_no_items") || "No graded items yet."}
			</div>
		);
	}

	return (
		<div className="space-y-2 px-4 py-3">
			<div className="flex justify-end">
				<ExportButtons
					onExport={(format: ExportFormat) =>
						downloadUserCourseRatingExport(courseId, userId, format)
					}
				/>
			</div>
			<table className="w-full text-sm">
				<thead>
					<tr className="text-left text-slate-400">
						<th className="py-1 font-medium">{t("rating_item") || "Item"}</th>
						<th className="py-1 font-medium">{t("rating_type") || "Type"}</th>
						<th className="py-1 text-right font-medium">
							{t("rating_score") || "Score"}
						</th>
					</tr>
				</thead>
				<tbody>
					{query.data.breakdown.map((item) => (
						<tr
							key={`${item.kind}-${item.id}`}
							className="border-slate-800 border-t"
						>
							<td className="py-1 text-slate-200">{item.title}</td>
							<td className="py-1 text-slate-400">
								{item.kind === "exam"
									? t("rating_kind_exam") || "Exam"
									: t("rating_kind_practice") || "Practice"}
							</td>
							<td className="py-1 text-right text-slate-200">
								{fmtNum(item.earned)} / {fmtNum(item.max)}
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}

/**
 * Course leaderboard for teachers/admins: participants ranked by earned score,
 * server-paginated and searchable by username/email, each row expandable to a
 * per-item breakdown, with CSV/XLSX export of the full leaderboard.
 */
export default function CourseLeaderboard({ courseId }: { courseId: number }) {
	const { t } = useTranslation("common");
	const [expanded, setExpanded] = useState<string | null>(null);
	const [searchInput, setSearchInput] = useState("");
	const [search, setSearch] = useState("");
	const [offset, setOffset] = useState(0);

	// Debounce the search box; reset to the first page on a new query.
	useEffect(() => {
		const id = setTimeout(() => {
			setSearch(searchInput);
			setOffset(0);
		}, 350);
		return () => clearTimeout(id);
	}, [searchInput]);

	const query = useQuery<CourseLeaderboardData>({
		queryKey: ["rating-leaderboard", courseId, offset, search],
		queryFn: () =>
			getCourseLeaderboard(courseId, { limit: PAGE_SIZE, offset, search }),
		placeholderData: keepPreviousData,
		retry: false,
	});

	const board = query.data;
	const total = board?.total ?? 0;
	const from = total === 0 ? 0 : offset + 1;
	const to = Math.min(offset + PAGE_SIZE, total);
	const hasPrev = offset > 0;
	const hasNext = offset + PAGE_SIZE < total;

	return (
		<Card className="border-slate-800 bg-slate-900">
			<CardHeader>
				<CardTitle className="flex flex-wrap items-center justify-between gap-2 text-white">
					<span className="flex items-center gap-2">
						<Trophy className="h-5 w-5 text-red-500" />
						{t("rating_leaderboard") || "Leaderboard"}
					</span>
					<div className="flex items-center gap-2">
						<Button
							size="sm"
							variant="outline"
							className="border-slate-700 text-white hover:bg-slate-800"
							onClick={() => query.refetch()}
							disabled={query.isFetching}
						>
							<RefreshCw
								className={`mr-1 h-4 w-4 ${query.isFetching ? "animate-spin" : ""}`}
							/>
							{t("refresh") || "Refresh"}
						</Button>
						<ExportButtons
							onExport={(format: ExportFormat) =>
								downloadCourseLeaderboardExport(courseId, format)
							}
							disabled={!board || total === 0}
						/>
					</div>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-4">
				<div className="relative">
					<Search className="-translate-y-1/2 absolute top-1/2 left-3 h-4 w-4 text-slate-500" />
					<Input
						value={searchInput}
						onChange={(e) => setSearchInput(e.target.value)}
						placeholder={
							t("rating_search_placeholder") || "Search by username or email…"
						}
						className="border-slate-700 bg-slate-800 pl-9 text-white placeholder:text-slate-400"
					/>
				</div>

				{query.isLoading ? (
					<div className="flex items-center gap-2 text-slate-400 text-sm">
						<Loader2 className="h-4 w-4 animate-spin" />{" "}
						{t("loading") || "Loading…"}
					</div>
				) : query.isError || !board ? (
					<div className="text-slate-400 text-sm">
						{t("rating_load_failed") || "Failed to load rating"}
					</div>
				) : board.entries.length === 0 ? (
					<div className="text-slate-400 text-sm">
						{search
							? t("rating_no_matches") || "No matching participants."
							: t("rating_no_participants") || "No participants yet."}
					</div>
				) : (
					<>
						<div className="overflow-hidden rounded-lg border border-slate-800">
							<table className="w-full text-sm">
								<thead>
									<tr className="bg-slate-950 text-left text-slate-400">
										<th className="w-12 px-4 py-2 font-medium">#</th>
										<th className="px-4 py-2 font-medium">
											{t("rating_participant") || "Participant"}
										</th>
										<th className="px-4 py-2 text-right font-medium">
											{t("rating_score") || "Score"}
										</th>
										<th className="w-16 px-4 py-2 text-right font-medium">%</th>
									</tr>
								</thead>
								<tbody>
									{board.entries.map((entry) => {
										const isOpen = expanded === entry.user_id;
										return (
											<Fragment key={entry.user_id}>
												<tr
													className="cursor-pointer border-slate-800 border-t hover:bg-slate-800/50"
													onClick={() =>
														setExpanded(isOpen ? null : entry.user_id)
													}
													onKeyDown={(e) => {
														if (e.key === "Enter" || e.key === " ") {
															e.preventDefault();
															setExpanded(isOpen ? null : entry.user_id);
														}
													}}
													tabIndex={0}
													aria-expanded={isOpen}
												>
													<td className="px-4 py-2 text-slate-400">
														{entry.rank}
													</td>
													<td className="px-4 py-2">
														<div className="flex items-center gap-2">
															{isOpen ? (
																<ChevronDown className="h-4 w-4 text-slate-500" />
															) : (
																<ChevronRight className="h-4 w-4 text-slate-500" />
															)}
															<div>
																<div className="text-slate-200">
																	{entry.username}
																</div>
																<div className="text-slate-500 text-xs">
																	{entry.email}
																</div>
															</div>
														</div>
													</td>
													<td className="px-4 py-2 text-right text-slate-200">
														{fmtNum(entry.earned)} / {fmtNum(entry.max)}
													</td>
													<td className="px-4 py-2 text-right text-red-400">
														{fmtNum(entry.percent)}
													</td>
												</tr>
												{isOpen ? (
													<tr className="border-slate-800 border-t bg-slate-950">
														<td colSpan={4}>
															<ParticipantBreakdown
																courseId={courseId}
																userId={entry.user_id}
															/>
														</td>
													</tr>
												) : null}
											</Fragment>
										);
									})}
								</tbody>
							</table>
						</div>

						<div className="flex items-center justify-between gap-2">
							<div className="text-slate-400 text-sm">
								{t("rating_showing", { from, to, total }) ||
									`Showing ${from}–${to} of ${total}`}
							</div>
							<div className="flex items-center gap-2">
								<Button
									size="sm"
									variant="outline"
									className="border-slate-700 text-white hover:bg-slate-800"
									disabled={!hasPrev || query.isFetching}
									onClick={() => setOffset((o) => Math.max(0, o - PAGE_SIZE))}
								>
									{t("previous") || "Prev"}
								</Button>
								<Button
									size="sm"
									variant="outline"
									className="border-slate-700 text-white hover:bg-slate-800"
									disabled={!hasNext || query.isFetching}
									onClick={() => setOffset((o) => o + PAGE_SIZE)}
								>
									{t("next") || "Next"}
								</Button>
							</div>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
