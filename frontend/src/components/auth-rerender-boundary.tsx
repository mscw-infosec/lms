"use client";

import { useUserStore } from "@/store/user";
import React from "react";

/**
 * Forces a full subtree remount when auth state changes.
 * Remount triggers when either token presence or user id changes.
 */
export default function AuthRerenderBoundary({
	children,
}: {
	children: React.ReactNode;
}) {
	const { hasToken, user } = useUserStore();
	const key = `${hasToken ? "1" : "0"}-${user?.id ?? "anon"}`;
	return <React.Fragment key={key}>{children}</React.Fragment>;
}
