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

export type GraphEvent = {
  id: string;
  subject: string;
  organizer: { emailAddress: { address: string; name: string } };
  start: { dateTime: string; timeZone: string };
  end: { dateTime: string; timeZone: string };
  isOnlineMeeting: boolean;
  onlineMeeting: { joinUrl: string } | null;
};

// plan-agentic.md §5 step 2 — a rolling window, not the admin's whole
// calendar history, and filtered to Teams online meetings only. Capped at
// `now` (not a forward-looking window) — a meeting that hasn't ended yet
// can never have a transcript, so there's no point surfacing it as linkable.
export async function listOnlineMeetings(accessToken: string): Promise<GraphEvent[]> {
  const now = new Date();
  const start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const end = now.toISOString();

  const params = new URLSearchParams({
    startDateTime: start,
    endDateTime: end,
    $select: "id,subject,organizer,start,end,isOnlineMeeting,onlineMeeting",
    $orderby: "start/dateTime",
    $top: "50",
  });

  const res = await fetch(`https://graph.microsoft.com/v1.0/me/calendarView?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Prefer: 'outlook.timezone="UTC"' },
  });
  if (!res.ok) {
    throw new Error(`Microsoft Graph /me/calendarView returned ${res.status}: ${await res.text()}`);
  }
  const body: { value: GraphEvent[] } = await res.json();
  return body.value.filter((e) => e.isOnlineMeeting);
}

// A calendar event only carries a joinUrl — the transcripts API needs the
// actual onlineMeeting ID, resolved via this documented lookup-by-joinUrl
// pattern (plan-agentic.md Phase 3).
export async function resolveOnlineMeetingId(accessToken: string, joinUrl: string): Promise<string | null> {
  // OData string literals escape a single quote by doubling it.
  const escapedJoinUrl = joinUrl.replace(/'/g, "''");
  const params = new URLSearchParams({ $filter: `JoinWebUrl eq '${escapedJoinUrl}'` });

  const res = await fetch(`https://graph.microsoft.com/v1.0/me/onlineMeetings?${params.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`Microsoft Graph /me/onlineMeetings returned ${res.status}: ${await res.text()}`);
  }
  const body: { value: { id: string }[] } = await res.json();
  return body.value[0]?.id ?? null;
}

export type TranscriptMetadata = { id: string; createdDateTime: string };

// Metadata only — no content download here on purpose (see the Phase 3
// scope note: raw transcript text is never persisted, only ever held in
// memory for the single request that extracts from it, which is Phase 4).
export async function listTranscripts(accessToken: string, onlineMeetingId: string): Promise<TranscriptMetadata[]> {
  const res = await fetch(`https://graph.microsoft.com/v1.0/me/onlineMeetings/${onlineMeetingId}/transcripts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (res.status === 404) return []; // no transcript generated (yet, or ever)
  if (!res.ok) {
    throw new Error(`Microsoft Graph transcripts endpoint returned ${res.status}: ${await res.text()}`);
  }
  const body: { value: TranscriptMetadata[] } = await res.json();
  return body.value;
}

// Content download deferred to Phase 4 by design — declared here so the
// contract is visible next to listTranscripts, not called yet.
export async function getTranscriptContent(
  accessToken: string,
  onlineMeetingId: string,
  transcriptId: string
): Promise<string> {
  const res = await fetch(
    `https://graph.microsoft.com/v1.0/me/onlineMeetings/${onlineMeetingId}/transcripts/${transcriptId}/content?$format=text/vtt`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!res.ok) {
    throw new Error(`Microsoft Graph transcript content endpoint returned ${res.status}: ${await res.text()}`);
  }
  return res.text();
}
