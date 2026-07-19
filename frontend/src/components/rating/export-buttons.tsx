"use client";

import type { ExportFormat } from "@/api/rating";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { Download, Loader2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";

/**
 * A CSV + XLSX download pair. `onExport` performs the actual download for the
 * chosen format; this component owns the per-format loading state and errors.
 */
export default function ExportButtons({
	onExport,
	disabled,
}: {
	onExport: (format: ExportFormat) => Promise<void>;
	disabled?: boolean;
}) {
	const { t } = useTranslation("common");
	const { toast } = useToast();
	const [exporting, setExporting] = useState<ExportFormat | null>(null);

	const handle = async (format: ExportFormat) => {
		try {
			setExporting(format);
			await onExport(format);
		} catch (e) {
			toast({
				title: t("export_failed") || "Export failed",
				description:
					e instanceof Error
						? e.message
						: t("export_failed") || "Export failed",
				variant: "destructive",
			});
		} finally {
			setExporting(null);
		}
	};

	return (
		<div className="flex items-center gap-2">
			<Button
				size="sm"
				variant="outline"
				className="border-slate-700 text-white hover:bg-slate-800"
				onClick={() => handle("csv")}
				disabled={disabled || !!exporting}
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
				onClick={() => handle("xlsx")}
				disabled={disabled || !!exporting}
			>
				{exporting === "xlsx" ? (
					<Loader2 className="mr-1 h-4 w-4 animate-spin" />
				) : (
					<Download className="mr-1 h-4 w-4" />
				)}
				XLSX
			</Button>
		</div>
	);
}

/** Formats a number for display: trims trailing zeros, max 2 decimals. */
export function fmtNum(n: number): string {
	const r = Math.round(n * 100) / 100;
	return Math.abs(r - Math.round(r)) < 1e-9
		? String(Math.round(r))
		: r.toFixed(2);
}
