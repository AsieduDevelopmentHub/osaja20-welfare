"use client";

import { Suspense } from "react";
import { Skeleton } from "@osaja/ui";
import ComposeWizard from "./ComposeWizard";

export default function ComposePage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton variant="dark" className="h-8 w-48" />
          <Skeleton variant="dark" className="h-10 w-full rounded-xl" />
          <Skeleton variant="dark" className="h-64 rounded-2xl" />
        </div>
      }
    >
      <ComposeWizard />
    </Suspense>
  );
}
