"use client";

import {
	type ExportFormat,
	type Gradebook,
	downloadExamExport,
	getExamGradebook,
} from "@/api/report";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Download, Loader2, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";

function fmt(n: number): string {
	const r = Math.round(n * 100) / 100;
	return Math.abs(r - Math.round(r)) < 1e-9
		? String(Math.round(r))
		: r.toFixed(2);
}

function StatCard({ label, value }: { label: string; value: string | number }) {
	return (
		<div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
			<div className="text-slate-400 text-xs">{label}</div>
			<div className="mt-1 font-semibold text-white text-xl">{value}</div>
		</div>
	);
}

function buildHistogram(gb: Gradebook) {
	// Group finished attempts into 5 score buckets by % of max score.
	const buckets = [
		{ name: "0–20%", count: 0, fill: "#ef4444" },
		{ name: "20–40%", count: 0, fill: "#f97316" },
		{ name: "40–60%", count: 0, fill: "#eab308" },
		{ name: "60–80%", count: 0, fill: "#84cc16" },
		{ name: "80–100%", count: 0, fill: "#22c55e" },
	];
	const max = gb.max_score || 0;
	for (const row of gb.rows) {
		if (row.status === "in_progress") continue;
		const pct = max > 0 ? (row.score / max) * 100 : 0;
		const idx = Math.min(4, Math.floor(pct / 20));
		const bucket = buckets[idx];
		if (bucket) bucket.count += 1;
	}
	return buckets;
}

export default function ExamGradebook({ examId }: { examId: string }) {
	const { toast } = useToast();
	const [exporting, setExporting] = useState<ExportFormat | null>(null);

	const query = useQuery<Gradebook>({
		queryKey: ["exam-gradebook", examId],
		queryFn: () => getExamGradebook(examId),
		retry: false,
	});

	const histogram = useMemo(
		() => (query.data ? buildHistogram(query.data) : []),
		[query.data],
	);

	const handleExport = async (format: ExportFormat) => {
		try {
			setExporting(format);
			await downloadExamExport(examId, format);
		} catch (e) {
			toast({
				title: "Export failed",
				description:
					e instanceof Error ? e.message : "Could not export results",
				variant: "destructive",
			});
		} finally {
			setExporting(null);
		}
	};

	const gb = query.data;

	return (
		<Card className="border-slate-800 bg-slate-900">
			<CardHeader>
				<CardTitle className="flex flex-wrap items-center justify-between gap-2 text-white">
					<span>Results dashboard</span>
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
							Refresh
						</Button>
						<Button
							size="sm"
							variant="outline"
							className="border-slate-700 text-white hover:bg-slate-800"
							onClick={() => handleExport("csv")}
							disabled={!!exporting || !gb || gb.rows.length === 0}
						>
							{exporting === "csv" ? (
								<Loader2 className="mr-1 h-4 w-4 animate-spin" />
							) : (
								<Download className="mr-1 h-4 w-4" />
							)}
							CSV
						</Button>
						<Button
							size="sm"
							className="bg-red-600 text-white hover:bg-red-700"
							onClick={() => handleExport("xlsx")}
							disabled={!!exporting || !gb || gb.rows.length === 0}
						>
							{exporting === "xlsx" ? (
								<Loader2 className="mr-1 h-4 w-4 animate-spin" />
							) : (
								<Download className="mr-1 h-4 w-4" />
							)}
							XLSX
						</Button>
					</div>
				</CardTitle>
			</CardHeader>
			<CardContent className="space-y-5">
				{query.isLoading ? (
					<div className="flex items-center gap-2 text-slate-400 text-sm">
						<Loader2 className="h-4 w-4 animate-spin" /> Loading dashboard…
					</div>
				) : query.isError || !gb ? (
					<div className="text-slate-400 text-sm">
						{query.error instanceof Error
							? query.error.message
							: "Failed to load results"}
					</div>
				) : gb.rows.length === 0 ? (
					<div className="text-slate-400 text-sm">No attempts yet.</div>
				) : (
					<>
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
							<StatCard label="Participants" value={gb.summary.participants} />
							<StatCard label="Attempts" value={gb.summary.total_attempts} />
							<StatCard
								label="Avg score"
								value={`${fmt(gb.summary.average_score)} / ${gb.max_score}`}
							/>
							<StatCard label="Highest" value={fmt(gb.summary.highest_score)} />
							<StatCard label="Lowest" value={fmt(gb.summary.lowest_score)} />
							<StatCard label="Awaiting review" value={gb.summary.on_review} />
						</div>

						<div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
							<div className="mb-2 text-slate-300 text-sm">
								Score distribution
							</div>
							<div className="h-56 w-full">
								<ResponsiveContainer width="100%" height="100%">
									<BarChart data={histogram}>
										<CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
										<XAxis dataKey="name" stroke="#94a3b8" fontSize={12} />
										<YAxis
											allowDecimals={false}
											stroke="#94a3b8"
											fontSize={12}
										/>
										<Tooltip
											contentStyle={{
												background: "#0f172a",
												border: "1px solid #334155",
												borderRadius: 8,
												color: "#ffffff",
											}}
											labelStyle={{ color: "#ffffff" }}
											itemStyle={{ color: "#ffffff" }}
											cursor={{ fill: "#1e293b55" }}
										/>
										<Bar dataKey="count" radius={[4, 4, 0, 0]}>
											{histogram.map((b) => (
												<Cell key={b.name} fill={b.fill} />
											))}
										</Bar>
									</BarChart>
								</ResponsiveContainer>
							</div>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
