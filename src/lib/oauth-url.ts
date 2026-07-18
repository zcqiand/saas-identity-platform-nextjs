/**
 * M01.F04.I01 构造授权 URL — client-safe (无 jose / 无 server-only)
 *
 * D14 决策：把 buildAuthorizeUrl 从 sso.ts（server-only）抽到这里，
 * 让 login-form.tsx（client 组件）能直接 import。
 */
export interface AuthorizeUrlInput {
  clientId: string;
  redirectUri: string;
  state: string;
  scope?: string;
}

export function buildAuthorizeUrl(input: AuthorizeUrlInput): string {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: input.clientId,
    redirect_uri: input.redirectUri,
    state: input.state,
  });
  if (input.scope) params.set("scope", input.scope);
  const base = "/api/sso/authorize";
  return `${base}?${params.toString()}`;
}