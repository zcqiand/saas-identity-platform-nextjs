// M96.F03.I01 目标端口声明 — health probe (CI + 本机 start-family.sh 复用)
// 镜像 saas-identity-platform-{aspnetcore,springboot,msw} 的 healthz 约定。
// contract-test 仓 fnReporter v7 + ci.yml + start-family.sh 三处共享同一份真相源,
// 改路径必须同步 (注释钉死)。
export async function GET(): Promise<Response> {
  return Response.json({ status: "ok" });
}