import { errorResponse } from "@/lib/api/errors";
import { parseJsonBody, requireApiContext } from "@/lib/api/route-helpers";
import { getRequestMeta } from "@/lib/auth/request-meta";
import { assertSameOrigin } from "@/lib/security/origin";
import { departmentUpdateSchema } from "@/features/departments/schemas";
import {
  deleteDepartment,
  getDepartment,
  updateDepartment,
} from "@/features/departments/server/department-service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const ctx = await requireApiContext();
    return Response.json({ data: await getDepartment(ctx, (await params).id) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    const input = await parseJsonBody(request, departmentUpdateSchema);
    return Response.json({
      data: await updateDepartment(ctx, (await params).id, input, await getRequestMeta()),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    assertSameOrigin(request);
    const ctx = await requireApiContext();
    await deleteDepartment(ctx, (await params).id, await getRequestMeta());
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
