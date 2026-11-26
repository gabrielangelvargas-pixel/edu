import { z } from "zod";
import { getCurrentUser, updateManagedUser } from "@/lib/auth";

const updateSchema = z.object({
  role: z.enum(["admin", "supervisor", "operator"]).nullable(),
  isActive: z.boolean(),
}).refine((input) => !input.isActive || input.role !== null, {
  message: "Una cuenta activa debe tener un rol.",
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const currentUser = await getCurrentUser();
  if (!currentUser) return Response.json({ error: "No autorizado." }, { status: 401 });
  if (currentUser.role !== "admin") return Response.json({ error: "Acceso restringido a administradores." }, { status: 403 });

  const { id } = await params;
  if (!/^\d+$/.test(id)) return Response.json({ error: "Usuario inválido." }, { status: 400 });
  if (id === currentUser.id) {
    return Response.json({ error: "No podés modificar tu propio rol o estado desde esta pantalla." }, { status: 409 });
  }

  const parsed = updateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Revisá los datos del usuario." }, { status: 400 });
  }

  await updateManagedUser(id, parsed.data);
  return Response.json({ ok: true });
}
