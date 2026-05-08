"use client";

import { ReactNode } from "react";

// ============================================================================
// COMPONENTES REUTILIZABLES PARA MÓDULO COSTOS
// ============================================================================

// Tab Navigation
export function CostsTabs({
  tabs,
  activeTab,
  onTabChange,
}: {
  tabs: { id: string; label: string; icon: string }[];
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  return (
    <div className="flex gap-1 border-b border-gray-200 pb-0 mb-6 overflow-x-auto scrollbar-hide">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition -mb-px ${
            activeTab === tab.id
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <span className="mr-2">{tab.icon}</span>
          {tab.label}
        </button>
      ))}
    </div>
  );
}

// Card Container
export function CostsCard({
  children,
  title,
  subtitle,
  action,
}: {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card">
      {(title || action) && (
        <div className="card-h flex items-center justify-between">
          <div>
            {title && <div className="text-lg font-extrabold">{title}</div>}
            {subtitle && <div className="text-sm text-gray-500">{subtitle}</div>}
          </div>
          {action}
        </div>
      )}
      <div className="card-b">{children}</div>
    </div>
  );
}

// Alert Box
export function AlertBox({
  type,
  message,
  onDismiss,
}: {
  type: "success" | "error" | "warning" | "info";
  message: string;
  onDismiss?: () => void;
}) {
  const colors = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    error: "border-red-200 bg-red-50 text-red-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    info: "border-blue-200 bg-blue-50 text-blue-700",
  };

  const icons = {
    success: "✓",
    error: "✕",
    warning: "⚠",
    info: "ℹ",
  };

  return (
    <div className={`rounded-2xl border p-4 flex items-start justify-between ${colors[type]}`}>
      <div className="flex items-start gap-3">
        <span className="text-lg font-bold">{icons[type]}</span>
        <span className="text-sm font-semibold">{message}</span>
      </div>
      {onDismiss && (
        <button onClick={onDismiss} className="text-lg opacity-50 hover:opacity-100 ml-3">
          ✕
        </button>
      )}
    </div>
  );
}

// Loading State
export function CostsLoading({ message = "Cargando..." }: { message?: string }) {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <div className="inline-block w-8 h-8 border-4 border-gray-200 border-t-blue-600 rounded-full animate-spin mb-3"></div>
        <p className="text-sm text-gray-500 font-semibold">{message}</p>
      </div>
    </div>
  );
}

// Empty State
export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <h3 className="text-lg font-extrabold mb-1">{title}</h3>
      <p className="text-sm text-gray-500 mb-4">{description}</p>
      {action}
    </div>
  );
}

// Form Input
export function FormInput({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
  error,
}: {
  label?: string;
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
  error?: string;
}) {
  return (
    <label className="grid gap-1">
      {label && <span className="label">{label}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className={`input ${error ? "border-red-300" : ""}`}
      />
      {error && <span className="text-xs text-red-600 font-semibold">{error}</span>}
    </label>
  );
}

// Form Select
export function FormSelect({
  label,
  value,
  onChange,
  options,
  disabled = false,
}: {
  label?: string;
  value: string | number;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  disabled?: boolean;
}) {
  return (
    <label className="grid gap-1">
      {label && <span className="label">{label}</span>}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="input"
      >
        <option value="">Seleccionar...</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  );
}

// Badge
export function Badge({
  label,
  color = "gray",
  size = "md",
}: {
  label: string;
  color?: "gray" | "blue" | "emerald" | "red" | "amber";
  size?: "sm" | "md" | "lg";
}) {
  const colors = {
    gray: "bg-gray-100 text-gray-700",
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    red: "bg-red-100 text-red-700",
    amber: "bg-amber-100 text-amber-700",
  };

  const sizes = {
    sm: "px-2 py-1 text-xs",
    md: "px-3 py-1.5 text-sm",
    lg: "px-4 py-2 text-base",
  };

  return <span className={`rounded-full font-semibold ${colors[color]} ${sizes[size]}`}>{label}</span>;
}

// Stats Grid
export function StatsGrid({
  stats,
}: {
  stats: { label: string; value: string | number; color: string }[];
}) {
  return (
    <div className="grid gap-3 grid-cols-2 sm:grid-cols-4">
      {stats.map((stat, i) => (
        <div key={i} className={`rounded-2xl border p-4 text-center ${stat.color}`}>
          <div className="text-2xl font-black">{stat.value}</div>
          <div className="text-xs font-semibold mt-1">{stat.label}</div>
        </div>
      ))}
    </div>
  );
}

// Table
export function CostsTable({
  columns,
  rows,
  emptyMessage = "Sin datos",
}: {
  columns: { key: string; label: string; align?: "left" | "right" | "center" }[];
  rows: Record<string, ReactNode>[];
  emptyMessage?: string;
}) {
  if (rows.length === 0) {
    return <div className="text-center py-8 text-sm text-gray-500">{emptyMessage}</div>;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-gray-200">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-gray-50">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-4 py-3 text-xs font-bold text-gray-600 text-${col.align || "left"}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => (
            <tr key={idx} className="border-t border-gray-200 hover:bg-gray-50">
              {columns.map((col) => (
                <td
                  key={col.key}
                  className={`px-4 py-3 text-${col.align || "left"}`}
                >
                  {row[col.key] || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Modal
export function CostsModal({
  isOpen,
  title,
  children,
  onClose,
  actions,
  maxWidth = "md",
}: {
  isOpen: boolean;
  title: string;
  children: ReactNode;
  onClose: () => void;
  actions?: { label: string; onClick: () => void; variant?: "primary" | "secondary"; disabled?: boolean }[];
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}) {
  if (!isOpen) return null;

  const maxWidthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  }[maxWidth];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className={`card w-full ${maxWidthClass} max-h-[90vh] overflow-auto`}>
        <div className="card-h flex items-center justify-between sticky top-0">
          <div className="text-lg font-extrabold">{title}</div>
          <button onClick={onClose} className="btn text-lg">
            ✕
          </button>
        </div>
        <div className="card-b space-y-4">{children}</div>
        {actions && (
          <div className="card-b border-t border-gray-200 pt-4 flex gap-2">
            {actions.map((action, i) => (
              <button
                key={i}
                onClick={action.onClick}
                disabled={action.disabled}
                className={`btn flex-1 ${action.variant === "primary" ? "btn-primary" : ""}`}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}