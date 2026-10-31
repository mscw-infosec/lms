import { useCallback, useEffect, useRef, useState } from "react";

const SAVE_STEP_SECONDS = 5;
const MIN_RESUME_SECONDS = 10;

const storageKey = (lectureId: number) => `lecture-position:${lectureId}`;
const durationKey = (lectureId: number) => `lecture-duration:${lectureId}`;

function readDuration(lectureId: number): number | null {
	try {
		const value = Number(window.localStorage.getItem(durationKey(lectureId)));
		return Number.isFinite(value) && value > 0 ? value : null;
	} catch {
		return null;
	}
}

function writeDuration(lectureId: number, seconds: number) {
	try {
		window.localStorage.setItem(durationKey(lectureId), String(seconds));
	} catch {}
}

function readPosition(lectureId: number): number {
	try {
		const value = Number(window.localStorage.getItem(storageKey(lectureId)));
		return Number.isFinite(value) ? value : 0;
	} catch {
		return 0;
	}
}

function writePosition(lectureId: number, seconds: number | null) {
	try {
		if (seconds === null) {
			window.localStorage.removeItem(storageKey(lectureId));
		} else {
			window.localStorage.setItem(storageKey(lectureId), String(seconds));
		}
	} catch {}
}

function parsePlayerMessage(data: unknown): Record<string, unknown> | null {
	if (typeof data === "string") {
		try {
			return parsePlayerMessage(JSON.parse(data));
		} catch {
			return null;
		}
	}
	return data && typeof data === "object"
		? (data as Record<string, unknown>)
		: null;
}

function playerOrigin(iframe: HTMLIFrameElement | null): string | null {
	try {
		return iframe ? new URL(iframe.src).origin : null;
	} catch {
		return null;
	}
}

export function useVideoPlayer(lectureId: number) {
	const iframeRef = useRef<HTMLIFrameElement>(null);
	const currentTime = useRef(0);
	const lastSaved = useRef(0);
	const [resumeAt, setResumeAt] = useState(0);
	const [duration, setDuration] = useState<number | null>(null);

	useEffect(() => {
		setDuration(readDuration(lectureId));
		const saved = readPosition(lectureId);
		setResumeAt(saved >= MIN_RESUME_SECONDS ? saved : 0);
		currentTime.current = 0;
		lastSaved.current = 0;
	}, [lectureId]);

	useEffect(() => {
		const onMessage = (event: MessageEvent) => {
			const iframe = iframeRef.current;
			if (event.source !== iframe?.contentWindow) return;
			if (event.origin !== playerOrigin(iframe)) return;
			const data = parsePlayerMessage(event.data);
			if (!data) return;

			const time = data.time;
			const length = data.duration;
			if (typeof length === "number" && Number.isFinite(length) && length > 0) {
				setDuration((current) => {
					if (current !== length) writeDuration(lectureId, length);
					return length;
				});
			}
			if (
				data.event === "timeupdate" &&
				typeof time === "number" &&
				Number.isFinite(time) &&
				time >= 0
			) {
				currentTime.current = time;
				if (Math.abs(time - lastSaved.current) >= SAVE_STEP_SECONDS) {
					lastSaved.current = time;
					writePosition(lectureId, Math.floor(time));
				}
			} else if (data.event === "ended") {
				writePosition(lectureId, null);
			}
		};

		window.addEventListener("message", onMessage);
		return () => window.removeEventListener("message", onMessage);
	}, [lectureId]);

	const seekTo = useCallback(
		(seconds: number) => {
			const iframe = iframeRef.current;
			const origin = playerOrigin(iframe);
			const player = iframe?.contentWindow;
			if (!player || !origin || !Number.isFinite(seconds) || seconds < 0)
				return;
			if (duration !== null && seconds > duration) return;
			player.postMessage({ method: "seek", time: seconds }, origin);
			player.postMessage({ method: "play" }, origin);
		},
		[duration],
	);

	const getTime = useCallback(() => currentTime.current, []);
	const dismissResume = useCallback(() => setResumeAt(0), []);

	return { iframeRef, seekTo, getTime, resumeAt, dismissResume, duration };
}
