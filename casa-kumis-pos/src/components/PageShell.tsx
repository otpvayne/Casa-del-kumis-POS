"use client";

import React from "react";

export default function PageShell({
  title,
  subtitle,
  right,
  children,
}: {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="page">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="min-w-0">{title}</div>

          {subtitle ? (
            <div className="page-subtitle mt-2">{subtitle}</div>
          ) : null}
        </div>

        {right ? <div className="shrink-0">{right}</div> : null}
      </div>

      <div>{children}</div>
    </div>
  );
}
