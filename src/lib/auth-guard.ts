import type { UserRole } from "@prisma/client";
import { auth } from "@/lib/auth";

export async function requireUser(roles?: UserRole[]) {
  const session = await auth();
  const user = session?.user;

  if (!user?.id) {
    return { response: Response.json({ error: "Authentication required." }, { status: 401 }) } as const;
  }

  if (roles && !roles.includes(user.role)) {
    return { response: Response.json({ error: "You do not have access to this resource." }, { status: 403 }) } as const;
  }

  return { user } as const;
}