"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
	AlertTriangle,
	CheckCircle2,
	Clipboard,
	Eraser,
	HelpCircle,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

// Minimal local types mirroring backend
export type ConditionOp =
	| "eq"
	| "neq"
	| "gt"
	| "gte"
	| "lt"
	| "lte"
	| "in"
	| "nin";

export type AttributeFilter =
	| {
			type: "Condition";
			content: { key: string; op: ConditionOp; value: string };
	  }
	| { type: "And"; content: AttributeFilter[] }
	| { type: "Or"; content: AttributeFilter[] };

export interface AttributeFilterEditorProps {
	value: AttributeFilter | null | undefined;
	onChange: (value: AttributeFilter | null) => void;
	className?: string;
}

function isValidFilterShape(obj: AttributeFilter): obj is AttributeFilter {
	if (!obj || typeof obj !== "object") return false;
	if (obj.type === "Condition") {
		const c = obj.content;
		if (!c || typeof c !== "object") return false;
		const validOps = new Set([
			"eq",
			"neq",
			"gt",
			"gte",
			"lt",
			"lte",
			"in",
			"nin",
		]);
		return typeof c.key === "string" && validOps.has(c.op);
	}
	if (obj.type === "And" || obj.type === "Or") {
		return Array.isArray(obj.content) && obj.content.every(isValidFilterShape);
	}
	return false;
}

export default function AttributeFilterEditor({
	value,
	onChange,
	className,
}: AttributeFilterEditorProps) {
	const { t } = useTranslation("common");
	const [enabled, setEnabled] = useState<boolean>(!!value);
	const [json, setJson] = useState<string>("");
	const [error, setError] = useState<string | null>(null);
	const [valid, setValid] = useState<boolean>(false);

	useEffect(() => {
		if (value) {
			setEnabled(true);
			setJson(JSON.stringify(value, null, 2));
			setError(null);
			setValid(true);
		} else {
			setEnabled(false);
			setJson("");
			setError(null);
			setValid(false);
		}
	}, [value]);

	useEffect(() => {
		if (!enabled) return;
		try {
			const parsed = JSON.parse(json);
			if (isValidFilterShape(parsed)) {
				setError(null);
				setValid(true);
				onChange(parsed);
			} else {
				setError(
					t("access_filter_invalid_shape") ?? "Invalid filter structure",
				);
				setValid(false);
			}
		} catch (e) {
			setError(t("access_filter_invalid_json") || "Invalid JSON");
			setValid(false);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [json, enabled, onChange, t]);

	const example = useMemo<AttributeFilter>(
		() => ({
			type: "And",
			content: [
				{
					type: "Condition",
					content: { key: "enrollment_year", op: "eq", value: "2025" },
				},
				{
					type: "Or",
					content: [
						{
							type: "Condition",
							content: { key: "class", op: "gte", value: "10" },
						},
						{
							type: "Condition",
							content: { key: "foo", op: "eq", value: "bar" },
						},
					],
				},
			],
		}),
		[],
	);

	const copyExample = () => {
		setEnabled(true);
		setJson(JSON.stringify(example, null, 2));
	};

	return (
		<Card className={`border-slate-800 bg-slate-900 ${className ?? ""}`}>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-white">
					<HelpCircle className="h-5 w-5" />{" "}
					{t("access_filter_title") || "Access filter"}
				</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="mb-4 flex items-center justify-between gap-4">
					<div>
						<Label className="text-white">
							{t("access_filter_enable_label") || "Enable access filter"}
						</Label>
						<p className="text-slate-400 text-sm">
							{t("access_filter_help") ||
								"Define logical conditions to restrict course access by user attributes."}
						</p>
					</div>
					<Switch
						checked={enabled}
						onCheckedChange={(checked) => {
							setEnabled(checked);
							if (!checked) {
								onChange(null);
								setJson("");
								setError(null);
								setValid(false);
							} else {
								setJson(JSON.stringify(example, null, 2));
							}
						}}
					/>
				</div>

				{enabled && (
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<Label className="text-white">
								{t("access_filter_json_label") || "Filter JSON"}
							</Label>
							<div className="flex items-center gap-2">
								<Button
									type="button"
									variant="outline"
									className="border-slate-700 text-slate-300 hover:bg-slate-800"
									onClick={copyExample}
								>
									<Clipboard className="mr-2 h-4 w-4" />{" "}
									{t("access_use_example") || "Use example"}
								</Button>
								<Button
									type="button"
									variant="outline"
									className="border-slate-700 text-slate-300 hover:bg-slate-800"
									onClick={() => setJson("{}")}
								>
									<Eraser className="mr-2 h-4 w-4" /> {t("clear") || "Clear"}
								</Button>
							</div>
						</div>
						<Textarea
							value={json}
							onChange={(e) => setJson(e.target.value)}
							className="min-h-[180px] border-slate-700 bg-slate-800 font-mono text-sm text-white placeholder:text-slate-400 focus:border-red-500"
							placeholder={
								t("access_filter_json_placeholder") ||
								"Paste or type AttributeFilter JSON here"
							}
						/>
						{error ? (
							<p className="flex items-center gap-2 text-red-400 text-sm">
								<AlertTriangle className="h-4 w-4" /> {error}
							</p>
						) : valid ? (
							<p className="flex items-center gap-2 text-green-400 text-sm">
								<CheckCircle2 className="h-4 w-4" />{" "}
								{t("access_filter_valid") || "Filter is valid"}
							</p>
						) : null}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
