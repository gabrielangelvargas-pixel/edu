import { z } from "zod";
import { authenticateUser, createSession } from "@/lib/auth";

const credentialsSchema = z.object({
  username: z.string().trim().min(1).max(80),
  password: z.string().min(1).max(200),
});

export async function POST(request: Request) {
  const parsed = credentialsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Ingresá tu usuario y contraseña." }, { status: 400 });
  }

  try {
    const user = await authenticateUser(parsed.data.username, parsed.data.password);
    if (!user) {
      return Response.json({ error: "Usuario o contraseña incorrectos." }, { status: 401 });
    }

    await createSession(user.id);
    return Response.json({ user: { username: user.username, displayName: user.displayName, role: user.role } });
  } catch (error) {
    console.error("No se pudo iniciar sesión:", error);
    return Response.json({ error: "No se pudo iniciar sesión. Intentá nuevamente." }, { status: 500 });
  }
}
