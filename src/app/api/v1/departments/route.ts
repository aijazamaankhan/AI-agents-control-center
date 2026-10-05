import { errorResponse } from "@/lib/api/errors";
import { parseJsonBody, requireApiContext } from "@/lib/api/route-helpers";
import { getRequestMeta } from "@/lib/auth/request-meta";
import { assertSameOrigin } from "@/lib/security/origin";
import { departmentSchema } from "@/features/departments/schemas";
import {
  createDepartment,
  listDepartments,
} from "@/features/departments/server/department-service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const ctx = await requireApiContext();
    return Response.json({ data: await listDepartments(ctx) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    const input = await parseJsonBody(request, departmentSchema);
    const dep = await createDepartment(ctx, input, await getRequestMeta());
    return Response.json({ data: dep }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
