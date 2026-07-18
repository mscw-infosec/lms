"use client";

import { uploadVideoFile } from "@/api/video";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, Loader2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export default function VideoUploadField({
	value,
	onChange,
}: {
	value: string;
	onChange: (videoId: string) => void;
}) {
	const { t } = useTranslation("common");
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [uploading, setUploading] = useState(false);
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const [manual, setManual] = useState(false);

	const handleFile = async (file: File | undefined) => {
		if (!file) return;
		setError(null);
		setUploading(true);
		setProgress(0);
		try {
			const id = await uploadVideoFile(file, setProgress);
			onChange(id);
		} catch (e) {
			setError(
				e instanceof Error
					? e.message
					: t("video_upload_failed") || "Upload failed",
			);
		} finally {
			setUploading(false);
			if (fileInputRef.current) fileInputRef.current.value = "";
		}
	};

	return (
		<div className="space-y-2">
			<Label className="text-slate-300">
				{t("video") || "Video (optional)"}
			</Label>

			{value && !uploading ? (
				<div className="flex items-center justify-between rounded-md border border-slate-700 bg-slate-800 p-2">
					<div className="flex min-w-0 items-center gap-2 text-slate-200 text-sm">
						<CheckCircle2 className="h-4 w-4 flex-shrink-0 text-green-400" />
						<span className="truncate">
							{t("video_attached") || "Video attached"}: {value}
						</span>
					</div>
					<Button
						type="button"
						variant="ghost"
						size="icon"
						onClick={() => onChange("")}
						className="h-7 w-7 flex-shrink-0 text-red-400 hover:bg-transparent hover:text-red-300"
						aria-label={t("remove") || "Remove"}
					>
						<X className="h-4 w-4" />
					</Button>
				</div>
			) : uploading ? (
				<div className="space-y-2 rounded-md border border-slate-700 bg-slate-800 p-3">
					<div className="flex items-center gap-2 text-slate-200 text-sm">
						<Loader2 className="h-4 w-4 animate-spin" />
						{t("uploading") || "Uploading"}… {progress}%
					</div>
					<div className="h-2 w-full overflow-hidden rounded-full bg-slate-700">
						<div
							className="h-full rounded-full bg-red-600 transition-all"
							style={{ width: `${progress}%` }}
						/>
					</div>
				</div>
			) : (
				<div className="flex items-center gap-2">
					<input
						ref={fileInputRef}
						type="file"
						accept="video/*"
						className="hidden"
						onChange={(e) => handleFile(e.target.files?.[0])}
					/>
					<Button
						type="button"
						variant="outline"
						onClick={() => fileInputRef.current?.click()}
						className="border-slate-700 bg-slate-800 text-slate-200 hover:bg-slate-700"
					>
						<Upload className="mr-2 h-4 w-4" />
						{t("upload_video") || "Upload video"}
					</Button>
					<button
						type="button"
						onClick={() => setManual((m) => !m)}
						className="text-slate-400 text-xs underline hover:text-slate-300"
					>
						{t("enter_id_manually") || "or enter ID manually"}
					</button>
				</div>
			)}

			{manual && !uploading ? (
				<Input
					value={value ?? ""}
					onChange={(e) => onChange(e.target.value)}
					placeholder="vplc…"
					className="border-slate-700 bg-slate-800 text-white"
				/>
			) : null}

			{error ? <p className="text-red-400 text-xs">{error}</p> : null}
			<p className="text-slate-500 text-xs">
				{t("video_upload_hint") ||
					"After upload, Yandex Cloud needs a little time to transcode before the video plays."}
			</p>
		</div>
	);
}
