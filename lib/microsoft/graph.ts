// Microsoft identity platform (v2.0 endpoint) + Graph API helpers for the
// Agentify Outlook/Teams integration (plan-agentic.md §3).

const SCOPES = [
  "offline_access",
  "User.Read",
  "Calendars.Read",
  "OnlineMeetings.Read",
  "OnlineMeetingTranscript.Read.All",
].join(" ");

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

function authority(): string {
  return `https://login.microsoftonline.com/${requiredEnv("MICROSOFT_TENANT_ID")}`;
}

export function buildAuthorizationUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: requiredEnv("MICROSOFT_CLIENT_ID"),
    response_type: "code",
    redirect_uri: requiredEnv("MICROSOFT_REDIRECT_URI"),
    response_mode: "query",
    scope: SCOPES,
    state,
    prompt: "consent",
  });
  return `${authority()}/oauth2/v2.0/authorize?${params.toString()}`;
}

export type TokenResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  scope: string;
};

async function tokenRequest(body: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${authority()}/oauth2/v2.0/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("MICROSOFT_CLIENT_ID"),
      client_secret: requiredEnv("MICROSOFT_CLIENT_SECRET"),
      ...body,
    }),
  });
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Microsoft token endpoint returned ${res.status}: ${detail}`);
  }
  return res.json();
}

export function exchangeCodeForTokens(code: string): Promise<TokenResponse> {
  return tokenRequest({
    grant_type: "authorization_code",
    code,
    redirect_uri: requiredEnv("MICROSOFT_REDIRECT_URI"),
  });
}

export function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return tokenRequest({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

export type MicrosoftProfile = {
  id: string;
  mail: string | null;
  userPrincipalName: string;
};

export async function getMe(accessToken: string): Promise<MicrosoftProfile> {
  const res = await fetch("https://graph.microsoft.com/v1.0/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Microsoft Graph /me returned ${res.status}: ${await res.text()}`);
  }
  return res.json();
}
