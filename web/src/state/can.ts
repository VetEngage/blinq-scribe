import { useApp } from "./app";

/** Whether the signed-in person may do this ("letter.write"). The server decides too; this only hides what it would refuse. */
export function useCan(permission: string): boolean {
  const perms = useApp((s) => s.me?.permissions);
  return Array.isArray(perms) ? perms.includes(permission) : true;
}
