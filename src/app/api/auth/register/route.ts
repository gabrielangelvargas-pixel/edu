import { z } from "zod";
import { registerUser } from "@/lib/auth";

const registerSchema = z.object({
  displayName: z.string().trim().min(2).max(120),
  username: z.string().trim().min(3).max(80).regex(/^[a-zA-Z0-9._-]+$/),
  password: z.string().min(8).max(200).regex(/[A-Za-z]/).regex(/[0-9]/),
});

export async function POST(request: Request) {
  const parsed = registerSchema.safeParse(await request.json());
  if (!parsed.success) {
    return Response.json({ error: "Revisá los datos. La contraseña debe tener al menos 8 caracteres, una letra y un número." }, { status: 400 });
  }

  try {
    const result = await registerUser(parsed.data);
    if (!result.created) {
      return Response.json({ error: "Ese nombre de usuario no está disponible." }, { status: 409 });
    }
    return Response.json({ message: "Cuenta creada. Un administrador debe asignarte un rol y activarla." }, { status: 201 });
  } catch (error) {
    console.error("No se pudo registrar el usuario:", error);
    return Response.json({ error: "No se pudo crear la cuenta. Intentá nuevamente." }, { status: 500 });
  }
}
