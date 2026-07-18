import { WorkerStateRepository, getPrisma } from "@achadinhos/database";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getAuthenticatedAdmin } from "@/lib/auth/session";
import { hasValidRequestOrigin } from "@/lib/auth/request";
export async function GET() {
  if (!(await getAuthenticatedAdmin()))
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  const behavior = await new WorkerStateRepository(
    getPrisma(),
  ).getDemoBehavior();
  return NextResponse.json({
    enabled: process.env.DEMO_MODE === "true",
    behavior,
    sendLive: false,
  });
}
export async function PUT(request: Request) {
  if (!(await getAuthenticatedAdmin()))
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!hasValidRequestOrigin(request))
    return NextResponse.json({ error: "Origem inválida." }, { status: 403 });
  if (process.env.DEMO_MODE !== "true")
    return NextResponse.json(
      { error: "Modo demonstração não está ativo." },
      { status: 409 },
    );
  const { behavior } = z
    .object({ behavior: z.enum(["SUCCESS", "FAILURE", "TIMEOUT"]) })
    .parse(await request.json());
  await new WorkerStateRepository(getPrisma()).setDemoBehavior(behavior);
  return NextResponse.json({ ok: true, behavior, sendLive: false });
}
