import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { LoginForm } from "@/components/admin/LoginForm";
import { LogoGlyph } from "@/components/admin/icons";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  if (await isAdmin()) redirect("/admin");
  return (
    <div className="animate-rise mx-auto flex min-h-[70dvh] max-w-xs flex-col items-center justify-center gap-6 text-center">
      <LogoGlyph size={72} />
      <div>
        <h1 className="text-title-1">AppDrop Admin</h1>
        <p className="text-subhead mt-1 text-label-2">Enter your password to continue.</p>
      </div>
      <LoginForm />
    </div>
  );
}
