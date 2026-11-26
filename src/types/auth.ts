export type AuthRole = "admin" | "supervisor" | "operator";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
  role: AuthRole;
};

export type ManagedUser = {
  id: string;
  username: string;
  displayName: string;
  role: AuthRole | null;
  isActive: boolean;
  createdAt: string;
};
