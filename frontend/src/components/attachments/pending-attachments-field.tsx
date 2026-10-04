"use client";

import { formatFileSize } from "@/api/attachments";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileText, Paperclip, X } from "lucide-react";
import { useRef } from "react";
import { useTranslation } from "react-i18next";

/**
 * Collects files for a lecture/task that doesn't exist yet. The parent uploads
 * them (see `uploadAttachments`) once the item has been created.
 */
export default function PendingAttachmentsField({
	files,
	onChange,
}: {
	files: File[];
	onChange: (files: File[]) => void;
}) {
	const { t } = useTranslation("common");
	const fileInputRef = useRef<HTMLInputElement>(null);

	return (
		<div className="space-y-2">
			<Label className="flex items-center gap-1.5 text-slate-300">
				<Paperclip className="h-4 w-4" />
				{t("additional_materials") || "Additional materials"}
			</Label>

			{files.length > 0 ? (
				<ul className="divide-y divide-slate-800 rounded-md border border-slate-700 bg-slate-800/50">
					{files.map((file, i) => (
						<li
							key={`${i}-${file.name}-${file.size}`}
							className="flex items-center gap-2 px-3 py-2 text-sm"
						>
							<FileText className="h-4 w-4 flex-shrink-0 text-slate-400" />
							<span className="min-w-0 flex-1 truncate text-slate-200">
								{file.name}
							</span>
							<span className="flex-shrink-0 text-slate-500 text-xs">
								{formatFileSize(file.size)}
							</span>
							<Button
								type="button"
								variant="ghost"
								size="icon"
								onClick={() => onChange(files.filter((_, j) => j !== i))}
								className="h-7 w-7 flex-shrink-0 text-red-400 hover:bg-transparent hover:text-red-300"
								aria-label={t("remove") || "Remove"}
							>
								<X className="h-4 w-4" />
							</Button>
						</li>
					))}
				</ul>
			) : null}

			<input
				ref={fileInputRef}
				type="file"
				multiple
				className="hidden"
				onChange={(e) => {
					onChange([...files, ...Array.from(e.target.files ?? [])]);
					e.target.value = "";
				}}
			/>
			<Button
				type="button"
				variant="outline"
				onClick={() => fileInputRef.current?.click()}
				className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
			>
				<Paperclip className="mr-2 h-4 w-4" />
				{t("attach_files") || "Attach files"}
			</Button>
			<p className="text-slate-500 text-xs">
				{t("attachments_upload_after_create") ||
					"Files are uploaded once you click Create."}
			</p>
		</div>
	);
}
