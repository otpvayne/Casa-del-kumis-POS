import UserChip from "@/components/UserChip";

type PageShellProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
};

export default function PageShell({ title, subtitle, right, children }: PageShellProps) {
  return (
    <div className="page">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-2xl font-extrabold tracking-tight">{title}</div>

          {subtitle ? (
            <div className="mt-2 text-sm text-gray-600">{subtitle}</div>
          ) : null}
        </div>

        <div className="flex items-center gap-2">
          {right ? right : null}
          <UserChip />
        </div>
      </div>

      {children}
    </div>
  );
}