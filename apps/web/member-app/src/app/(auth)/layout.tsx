import { RecoveryRedirect } from "@/components/RecoveryRedirect";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <RecoveryRedirect />
      {children}
    </div>
  );
}
