"use client";

import { createTopicText, updateTopicText } from "@/api/topics";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export default function TextEditDialog({
	topicId,
	textId,
	initialContent,
	open,
	onOpenChange,
	onSaved,
}: {
	topicId: number;
	/** null to create a new text item. */
	textId: number | null;
	initialContent?: string;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSaved?: () => void;
}) {
	const { t } = useTranslation("common");
	const { toast } = useToast();
	const [content, setContent] = useState("");

	useEffect(() => {
		if (open) setContent(initialContent ?? "");
	}, [open, initialContent]);

	const saveMutation = useMutation({
		mutationFn: () =>
			textId == null
				? createTopicText(topicId, content.trim()).then(() => undefined)
				: updateTopicText(topicId, textId, content.trim()),
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
					<DialogTitle>
						{textId == null
							? t("add_text") || "Add text"
							: t("edit_text") || "Edit text"}
					</DialogTitle>
				</DialogHeader>
				<div className="space-y-2">
					<Label className="text-slate-300">
						{t("lecture_content") || "Content (Markdown)"}
					</Label>
					<Textarea
						value={content}
						onChange={(e) => setContent(e.target.value)}
						placeholder={t("enter_text") || "Enter text…"}
						className="min-h-40 border-slate-700 bg-slate-800 text-white"
					/>
				</div>
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
						disabled={saveMutation.isPending || !content.trim()}
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
