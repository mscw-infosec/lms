"use client";

import {
	type GetUserResponseDTO,
	getCurrentUser,
	restoreSession,
} from "@/api/auth";
import {
	ACCESS_TOKEN_STORAGE_KEY,
	accessTokenNeedsRefresh,
	getAccessToken,
} from "@/api/token";
import {
	bumpAvatar,
	ensureAvatarChecked,
	getAvatarExists,
	getAvatarSrc,
	subscribeAvatar,
} from "@/lib/avatar-cache";
import type React from "react";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

export interface UserStoreState {
	user: GetUserResponseDTO | null;
	hasToken: boolean;
	loading: boolean;
	avatarSrc?: string;
	avatarExists?: boolean;
	refreshUser: () => Promise<void>;
	forceAvatarRefresh: () => void;
}

const UserStoreContext = createContext<UserStoreState | undefined>(undefined);

export function UserProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<GetUserResponseDTO | null>(null);
	const [hasToken, setHasToken] = useState<boolean>(false);
	const [loading, setLoading] = useState<boolean>(true);

	const loadUser = useCallback(async () => {
		if (!getAccessToken() && !(await restoreSession())) {
			if (!getAccessToken()) {
				setHasToken(false);
				setUser(null);
				setLoading(false);
				return;
			}
		}

		setHasToken(true);
		setLoading(true);
		try {
			const me = await getCurrentUser();
			setUser(me);
		} catch {
			setUser(null);
		} finally {
			setHasToken(!!getAccessToken());
			setLoading(false);
		}
	}, []);

	const loadInFlight = useRef<Promise<void> | null>(null);
	const refreshUser = useCallback(() => {
		loadInFlight.current ??= loadUser().finally(() => {
			loadInFlight.current = null;
		});
		return loadInFlight.current;
	}, [loadUser]);

	const forceAvatarRefresh = useCallback(() => {
		bumpAvatar(user?.id);
	}, [user?.id]);

	const userIdRef = useRef<string | undefined>(undefined);
	userIdRef.current = user?.id;

	useEffect(() => {
		const onTokenChange = () => {
			refreshUser();
			bumpAvatar(userIdRef.current);
		};

		const onStorage = (e: StorageEvent) => {
			if (e.key === ACCESS_TOKEN_STORAGE_KEY) {
				onTokenChange();
			}
		};

		const onVisible = () => {
			if (document.visibilityState !== "visible") return;
			if (accessTokenNeedsRefresh()) refreshUser();
		};

		refreshUser();

		window.addEventListener(
			"auth:token-changed",
			onTokenChange as EventListener,
		);
		window.addEventListener("storage", onStorage);
		document.addEventListener("visibilitychange", onVisible);

		return () => {
			window.removeEventListener(
				"auth:token-changed",
				onTokenChange as EventListener,
			);
			window.removeEventListener("storage", onStorage);
			document.removeEventListener("visibilitychange", onVisible);
		};
	}, [refreshUser]);

	useEffect(() => {
		const unsubscribeAvatar = subscribeAvatar(() => {
			setAvatarSrc(getAvatarSrc(user?.id));
			setAvatarExists(getAvatarExists(user?.id));
		});
		return unsubscribeAvatar;
	}, [user?.id]);

	useEffect(() => {
		if (user?.id) {
			ensureAvatarChecked(user.id).catch(() => void 0);
		}
	}, [user?.id]);

	const [avatarSrc, setAvatarSrc] = useState<string | undefined>(undefined);
	const [avatarExists, setAvatarExists] = useState<boolean | undefined>(
		undefined,
	);

	useEffect(() => {
		setAvatarSrc(getAvatarSrc(user?.id));
		setAvatarExists(getAvatarExists(user?.id));
	}, [user?.id]);

	const value = useMemo<UserStoreState>(
		() => ({
			user,
			hasToken,
			loading,
			avatarSrc,
			avatarExists,
			refreshUser,
			forceAvatarRefresh,
		}),
		[
			user,
			hasToken,
			loading,
			avatarSrc,
			avatarExists,
			refreshUser,
			forceAvatarRefresh,
		],
	);

	return (
		<UserStoreContext.Provider value={value}>
			{children}
		</UserStoreContext.Provider>
	);
}

export function useUserStore(): UserStoreState {
	const ctx = useContext(UserStoreContext);
	if (!ctx) throw new Error("useUserStore must be used within a UserProvider");
	return ctx;
}
