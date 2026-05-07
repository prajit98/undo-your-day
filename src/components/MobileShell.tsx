import { ReactNode } from "react";
import { BottomNav } from "./BottomNav";

interface MobileShellProps {
  children: ReactNode;
}

export function MobileShell({ children }: MobileShellProps) {
  return (
    <div className="min-h-screen w-full bg-background">
      <div className="mx-auto flex min-h-screen max-w-md flex-col">
        <main className="flex-1 pb-[calc(11rem+env(safe-area-inset-bottom))]">{children}</main>
        <BottomNav />
      </div>
    </div>
  );
}
