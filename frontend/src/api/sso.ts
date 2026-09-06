import type { components } from "@/api/schema/schema";
import { http } from "./http";

export type ConsentRequest = components["schemas"]["ConsentRequestDTO"];
export type ConsentDecisionResponse =
	components["schemas"]["ConsentDecisionResponse"];
export type ConnectedApp = components["schemas"]["ConnectedAppDTO"];
export type SsoClient = components["schemas"]["SsoClientDTO"];
export type CreatedSsoClient = components["schemas"]["CreatedClientDTO"];
export type CreateSsoClientRequest =
	components["schemas"]["CreateClientRequest"];
export type UpdateSsoClientRequest =
	components["schemas"]["UpdateClientRequest"];
export type SsoMetadata = components["schemas"]["SsoMetadataDTO"];

/** Every scope the LMS can hand to a relying party. */
export const SSO_SCOPES = [
	"openid",
	"profile",
	"email",
	"roles",
	"attributes",
	"offline_access",
] as const;

export type SsoScope = (typeof SSO_SCOPES)[number];

/* -------------------------------------------------------------- consent flow */

/** Details of the authorization request the user landed on. */
export async function getConsentRequest(
	requestId: string,
): Promise<ConsentRequest> {
	return http<ConsentRequest>(
		`/api/sso/requests/${encodeURIComponent(requestId)}`,
		{ withAuth: true },
	);
}

/** Approve or decline; the response says where to send the browser next. */
export async function decideConsent(
	requestId: string,
	approve: boolean,
): Promise<ConsentDecisionResponse> {
	return http<ConsentDecisionResponse>(
		`/api/sso/requests/${encodeURIComponent(requestId)}`,
		{
			method: "POST",
			body: JSON.stringify({ approve }),
			withAuth: true,
		},
	);
}

/* --------------------------------------------------------- connected apps */

export async function listConnectedApps(): Promise<ConnectedApp[]> {
	return http<ConnectedApp[]>("/api/sso/connections", { withAuth: true });
}

export async function disconnectApp(clientId: string): Promise<void> {
	await http<void>(`/api/sso/connections/${encodeURIComponent(clientId)}`, {
		method: "DELETE",
		withAuth: true,
	});
}

/* ------------------------------------------------------- client management */

export async function getSsoMetadata(): Promise<SsoMetadata> {
	return http<SsoMetadata>("/api/sso/metadata", { withAuth: true });
}

export async function listSsoClients(): Promise<SsoClient[]> {
	return http<SsoClient[]>("/api/sso/clients", { withAuth: true });
}

/** The response carries the client secret; it is never retrievable again. */
export async function createSsoClient(
	data: CreateSsoClientRequest,
): Promise<CreatedSsoClient> {
	return http<CreatedSsoClient>("/api/sso/clients", {
		method: "POST",
		body: JSON.stringify(data),
		withAuth: true,
	});
}

export async function updateSsoClient(
	clientId: string,
	data: UpdateSsoClientRequest,
): Promise<SsoClient> {
	return http<SsoClient>(`/api/sso/clients/${encodeURIComponent(clientId)}`, {
		method: "PATCH",
		body: JSON.stringify(data),
		withAuth: true,
	});
}

export async function deleteSsoClient(clientId: string): Promise<void> {
	await http<void>(`/api/sso/clients/${encodeURIComponent(clientId)}`, {
		method: "DELETE",
		withAuth: true,
	});
}

/** Issues a new secret and invalidates the current one. */
export async function rotateSsoClientSecret(
	clientId: string,
): Promise<{ client_secret: string }> {
	return http<{ client_secret: string }>(
		`/api/sso/clients/${encodeURIComponent(clientId)}/secret`,
		{ method: "POST", withAuth: true },
	);
}
