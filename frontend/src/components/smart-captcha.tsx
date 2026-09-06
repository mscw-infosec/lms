"use client";

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";

const CLIENT_KEY = process.env.NEXT_PUBLIC_SMARTCAPTCHA_CLIENT_KEY ?? "";
const SCRIPT_SRC = "https://smartcaptcha.yandexcloud.net/captcha.js";
const ONLOAD_CALLBACK = "__onSmartCaptchaLoad";

type WidgetId = number;

type SmartCaptchaEvent =
	| "challenge-visible"
	| "challenge-hidden"
	| "network-error"
	| "javascript-error"
	| "success"
	| "token-expired";

interface RenderParams {
	sitekey: string;
	callback?: (token: string) => void;
	/** Widget interface language. */
	hl?: string;
	invisible?: boolean;
	test?: boolean;
}

interface SmartCaptchaApi {
	render: (container: HTMLElement | string, params: RenderParams) => WidgetId;
	reset: (widgetId?: WidgetId) => void;
	destroy: (widgetId?: WidgetId) => void;
	getResponse: (widgetId?: WidgetId) => string;
	subscribe: (
		widgetId: WidgetId,
		event: SmartCaptchaEvent,
		handler: () => void,
	) => () => void;
}

declare global {
	interface Window {
		smartCaptcha?: SmartCaptchaApi;
		[ONLOAD_CALLBACK]?: () => void;
	}
}

/** `true` when a client key is configured; otherwise the widget is a no-op. */
export function isSmartCaptchaEnabled(): boolean {
	return CLIENT_KEY.length > 0;
}

let loader: Promise<SmartCaptchaApi> | null = null;

function loadSmartCaptcha(): Promise<SmartCaptchaApi> {
	if (typeof window === "undefined") {
		return Promise.reject(new Error("SmartCaptcha requires a browser"));
	}
	if (window.smartCaptcha) return Promise.resolve(window.smartCaptcha);
	if (loader) return loader;

	loader = new Promise<SmartCaptchaApi>((resolve, reject) => {
		window[ONLOAD_CALLBACK] = () => {
			if (window.smartCaptcha) {
				resolve(window.smartCaptcha);
			} else {
				reject(new Error("SmartCaptcha loaded without exposing its API"));
			}
		};

		const script = document.createElement("script");
		script.src = `${SCRIPT_SRC}?render=onload&onload=${ONLOAD_CALLBACK}`;
		script.async = true;
		script.defer = true;
		script.onerror = () => {
			// Allow a later mount to retry (e.g. the user fixes their connection
			// and reopens the dialog).
			loader = null;
			script.remove();
			reject(new Error("Failed to load Yandex SmartCaptcha"));
		};
		document.head.appendChild(script);
	});

	return loader;
}

interface SmartCaptchaProps {
	/** Called with a fresh token, or `""` when the current one is no longer usable. */
	onTokenChange: (token: string) => void;
	/** Called when the widget could not be loaded or errored out. */
	onError?: () => void;
	resetKey?: number;
}

export function SmartCaptcha({
	onTokenChange,
	onError,
	resetKey = 0,
}: SmartCaptchaProps) {
	const { i18n } = useTranslation();
	const language = i18n.language?.startsWith("ru") ? "ru" : "en";

	const containerRef = useRef<HTMLDivElement>(null);
	const apiRef = useRef<SmartCaptchaApi | null>(null);
	const widgetIdRef = useRef<WidgetId | null>(null);

	// Held in refs so that a parent re-render (which recreates these callbacks)
	// never tears down and re-renders the widget mid-challenge.
	const onTokenChangeRef = useRef(onTokenChange);
	const onErrorRef = useRef(onError);
	useEffect(() => {
		onTokenChangeRef.current = onTokenChange;
		onErrorRef.current = onError;
	}, [onTokenChange, onError]);

	useEffect(() => {
		if (!isSmartCaptchaEnabled()) {
			console.warn(
				"[SmartCaptcha] NEXT_PUBLIC_SMARTCAPTCHA_CLIENT_KEY was not set when this " +
					"bundle was built, no challenge is shown.",
			);
			return;
		}

		let cancelled = false;
		const unsubscribes: Array<() => void> = [];

		loadSmartCaptcha()
			.then((api) => {
				const container = containerRef.current;
				if (cancelled || !container) return;

				apiRef.current = api;
				const widgetId = api.render(container, {
					sitekey: CLIENT_KEY,
					hl: language,
					callback: (token) => onTokenChangeRef.current(token),
				});
				widgetIdRef.current = widgetId;

				unsubscribes.push(
					api.subscribe(widgetId, "token-expired", () =>
						onTokenChangeRef.current(""),
					),
					api.subscribe(widgetId, "network-error", () =>
						onErrorRef.current?.(),
					),
					api.subscribe(widgetId, "javascript-error", () =>
						onErrorRef.current?.(),
					),
				);
			})
			.catch(() => {
				if (!cancelled) onErrorRef.current?.();
			});

		return () => {
			cancelled = true;
			for (const unsubscribe of unsubscribes) unsubscribe();
			const widgetId = widgetIdRef.current;
			if (widgetId !== null) {
				apiRef.current?.destroy(widgetId);
				widgetIdRef.current = null;
			}
			onTokenChangeRef.current("");
		};
	}, [language]);

	const lastResetKey = useRef(resetKey);
	useEffect(() => {
		if (lastResetKey.current === resetKey) return;
		lastResetKey.current = resetKey;

		const widgetId = widgetIdRef.current;
		if (widgetId !== null) apiRef.current?.reset(widgetId);
		onTokenChangeRef.current("");
	}, [resetKey]);

	if (!isSmartCaptchaEnabled()) return null;

	return <div ref={containerRef} className="flex justify-center" />;
}
