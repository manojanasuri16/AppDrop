import { logout } from "@/app/admin/actions";

export function SignOutButton({ className = "" }: { className?: string }) {
  return (
    <form action={logout}>
      <button type="submit" className={`pressable text-subhead min-h-11 rounded-full px-3 font-medium text-tint hover:bg-fill ${className}`}>Sign out</button>
    </form>
  );
}
