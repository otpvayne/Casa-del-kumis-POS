import UserChip from "@/components/UserChip";
import { PlantSelector } from "@/components/PlantSelector";

type PageShellProps = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  right?: React.ReactNode;
  children: React.ReactNode;
  hidePlantSelector?: boolean;
};

export default function PageShell({ title, subtitle, right, children, hidePlantSelector = false }: PageShellProps) {
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
          {!hidePlantSelector && <PlantSelector />}
          <UserChip />
        </div>
      </div>

      {children}
    </div>
  );
}