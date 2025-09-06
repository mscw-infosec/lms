"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslation } from "react-i18next";

export default function PendingResultsPage() {
	const { t } = useTranslation("common");
	const params = useParams<{ id: string }>();
	const courseId = String(params.id ?? "");

	return (
		<div className="mx-auto w-full max-w-3xl p-4 sm:p-6">
			<Card className="border-slate-800 bg-slate-900">
				<CardHeader>
					<CardTitle className="text-2xl text-white">
						{t("results_pending_title") || "Results will be available soon"}
					</CardTitle>
				</CardHeader>
				<CardContent className="space-y-4 text-slate-300">
					<p>
						{t("results_pending_desc") ||
							"Your attempt has been submitted. Once grading is completed, results will appear here."}
					</p>
					<div>
						<Link href={`/course/${courseId}/learn`}>
							<Button
								variant="outline"
								className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
							>
								{t("back") || "Back"}
							</Button>
						</Link>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}
