"use client";

import { type GetUserResponseDTO, getCurrentUser } from "@/api/auth";
import { getAccessToken } from "@/api/token";
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

	const refreshUser = useCallback(async () => {
		const token = getAccessToken();
		setHasToken(!!token);
		if (!token) {
			setUser(null);
			setLoading(false);
			return;
		}
		setLoading(true);
		try {
			const me = await getCurrentUser();
			setUser(me);
		} catch {
			setUser(null);
		} finally {
			setLoading(false);
		}
	}, []);

	const forceAvatarRefresh = useCallback(() => {
		bumpAvatar(user?.id);
	}, [user?.id]);

	useEffect(() => {
		let active = true;

		const onTokenChange = () => {
			setHasToken(!!getAccessToken());
			refreshUser();
			bumpAvatar(user?.id);
		};

		refreshUser();

		if (typeof window !== "undefined") {
			window.addEventListener(
				"auth:token-changed",
				onTokenChange as EventListener,
			);
		}

		const unsubscribeAvatar = subscribeAvatar(() => {
			setAvatarSrc(getAvatarSrc(user?.id));
			setAvatarExists(getAvatarExists(user?.id));
		});

		return () => {
			active = false;
			if (typeof window !== "undefined") {
				window.removeEventListener(
					"auth:token-changed",
					onTokenChange as EventListener,
				);
			}
			unsubscribeAvatar();
		};
	}, [refreshUser, user?.id]);

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
