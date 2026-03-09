"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { requireRole } from "@/lib/requireRole";
import PageShell from "@/components/PageShell";
import LoadingCard from "@/components/LoadingCard";

type Branch = { id: string; name: string };

type ShiftRow = {
  id: string;
  branch_id: string;
  branch_name: string;
  status: "OPEN" | "CLOSED";
  opened_at: string;
  closed_at: string | null;
  opening_cash: number;
  confirmed_total: number | null;
  expected_total: number | null;
  verification: {
    verified_at: string;
    verified_by_name: string;
    opening_cash: number;
    sales_total: number;
    expected_total: number;
    sales_count: number;
  } | null;
};

export default function AdminShiftsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [branches, setBranches] = useState<Branch[]>([]);
  const [shifts, setShifts] = useState<ShiftRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Filtros
  const [filterBranch, setFilterBranch] = useState<string>("");
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [filterVerif, setFilterVerif] = useState<string>("");
  const [filterDateFrom, setFilterDateFrom] = useState<string>("");
  const [filterDateTo, setFilterDateTo] = useState<string>("");

  const loadData = async () => {
    setErr(null);
    setLoading(true);

    const role = await requireRole("ADMIN");
    if (!role.ok) return router.replace("/pos");

    const { data: branchRows, error: bErr } = await supabase
      .from("branches")
      .select("id, name")
      .order("name");
    if (bErr) throw new Error(bErr.message);
    setBranches(branchRows ?? []);

    const { data: shiftRows, error: sErr } = await supabase
      .from("shifts")
      .select(`
        id, branch_id, status, opened_at, closed_at,
        opening_cash, confirmed_total, expected_total,
        branches(name),
        shift_verifications(
          verified_at, verified_by_name,
          opening_cash, sales_total, expected_total, sales_count
        )
      `)
      .order("opened_at", { ascending: false })
      .limit(200);

    if (sErr) throw new Error(sErr.message);

    const mapped: ShiftRow[] = (shiftRows ?? []).map((s: any) => {
      const verif = Array.isArray(s.shift_verifications)
        ? s.shift_verifications[0] ?? null
        : s.shift_verifications ?? null;

      return {
        id: String(s.id),
        branch_id: String(s.branch_id),
        branch_name: s.branches?.name ?? "Sucursal",
        status: s.status as "OPEN" | "CLOSED",
        opened_at: String(s.opened_at),
        closed_at: s.closed_at ? String(s.closed_at) : null,
        opening_cash: Number(s.opening_cash ?? 0),
        confirmed_total: s.confirmed_total != null ? Number(s.confirmed_total) : null,
        expected_total: s.expected_total != null ? Number(s.expected_total) : null,
        verification: verif ? {
          verified_at: String(verif.verified_at),
          verified_by_name: String(verif.verified_by_name),
          opening_cash: Number(verif.opening_cash ?? 0),
          sales_total: Number(verif.sales_total ?? 0),
          expected_total: Number(verif.expected_total ?? 0),
          sales_count: Number(verif.sales_count ?? 0),
        } : null,
      };
    });

    setShifts(mapped);
    setLoading(false);
  };

  useEffect(() => {
    loadData().catch((e) => {
      setErr(e.message ?? "Error cargando turnos.");
      setLoading(false);
    });
  }, []);

  const filtered = useMemo(() => {
    return shifts.filter((s) => {
      if (filterBranch && s.branch_id !== filterBranch) return false;
      if (filterStatus && s.status !== filterStatus) return false;
      if (filterVerif === "yes" && !s.verification) return false;
      if (filterVerif === "no" && s.verification) return false;
      if (filterDateFrom) {
        const from = new Date(filterDateFrom);
        if (new Date(s.opened_at) < from) return false;
      }
      if (filterDateTo) {
        const to = new Date(filterDateTo);
        to.setHours(23, 59, 59);
        if (new Date(s.opened_at) > to) return false;
      }
      return true;
    });
  }, [shifts, filterBranch, filterStatus, filterVerif, filterDateFrom, filterDateTo]);

  const fmt = (iso: string) =>
    new Date(iso).toLocaleString("es-CO", {
      day: "2-digit", month: "2-digit", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  const fmtMoney = (n: number) => `$${n.toLocaleString("es-CO")}`;

  const diff = (s: ShiftRow) => {
    if (s.confirmed_total == null || s.expected_total == null) return null;
    return Math.round((s.confirmed_total - s.expected_total) * 100) / 100;
  };

  if (loading) return <LoadingCard title="Cargando turnos..." />;

  return (
    <div className="container py-8">
      <PageShell
        title="Auditoría de turnos"
        subtitle="Consulta el estado de todos los turnos, verificaciones de entrega y cierres de caja."
        right={
          <div className="flex gap-2">
            <button className="btn" onClick={() => loadData().catch(() => {})}>
              Refrescar
            </button>
            <button className="btn" onClick={() => router.push("/admin")}>
              Volver
            </button>
          </div>
        }
      >
        {err && <div className="alert-err mb-4">{err}</div>}

        {/* FILTROS */}
        <div className="card mb-4">
          <div className="card-h">
            <div className="text-sm font-extrabold">Filtros</div>
          </div>
          <div className="card-b">
            <div className="flex flex-wrap gap-3">
              {/* Sucursal */}
              <label className="grid gap-1 min-w-[160px]">
                <span className="label">Sucursal</span>
                <select className="input" value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}>
                  <option value="">Todas</option>
                  {branches.map((b) => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </label>

              {/* Estado */}
              <label className="grid gap-1 min-w-[140px]">
                <span className="label">Estado</span>
                <select className="input" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                  <option value="">Todos</option>
                  <option value="OPEN">Abierto</option>
                  <option value="CLOSED">Cerrado</option>
                </select>
              </label>

              {/* Verificación */}
              <label className="grid gap-1 min-w-[160px]">
                <span className="label">Verificación de entrega</span>
                <select className="input" value={filterVerif} onChange={(e) => setFilterVerif(e.target.value)}>
                  <option value="">Todas</option>
                  <option value="yes">Con verificación</option>
                  <option value="no">Sin verificación</option>
                </select>
              </label>

              {/* Fecha desde */}
              <label className="grid gap-1 min-w-[150px]">
                <span className="label">Desde</span>
                <input type="date" className="input" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} />
              </label>

              {/* Fecha hasta */}
              <label className="grid gap-1 min-w-[150px]">
                <span className="label">Hasta</span>
                <input type="date" className="input" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} />
              </label>

              <div className="flex items-end">
                <button
                  className="btn"
                  onClick={() => {
                    setFilterBranch("");
                    setFilterStatus("");
                    setFilterVerif("");
                    setFilterDateFrom("");
                    setFilterDateTo("");
                  }}
                >
                  Limpiar
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* CONTEO */}
        <div className="mb-3 text-sm text-gray-500">
          Mostrando <span className="font-extrabold text-gray-900">{filtered.length}</span> turnos
        </div>

        {/* LISTA DE TURNOS */}
        {filtered.length === 0 ? (
          <div className="card">
            <div className="card-b text-sm text-gray-500">No hay turnos con esos filtros.</div>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((s) => {
              const isExpanded = expandedId === s.id;
              const d = diff(s);
              const hasVerif = !!s.verification;

              return (
                <div key={s.id} className="card">
                  {/* CABECERA del turno */}
                  <button
                    className="card-h w-full text-left"
                    onClick={() => setExpandedId(isExpanded ? null : s.id)}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        {/* Sucursal + estado */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-extrabold text-gray-900">{s.branch_name}</span>
                          <span className={`badge ${s.status === "OPEN" ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-gray-200 bg-gray-50 text-gray-600"}`}>
                            {s.status === "OPEN" ? "Abierto" : "Cerrado"}
                          </span>
                          {hasVerif ? (
                            <span className="badge border-emerald-200 bg-emerald-50 text-emerald-700">
                              ✓ Entrega verificada
                            </span>
                          ) : (
                            <span className="badge border-amber-200 bg-amber-50 text-amber-700">
                              Sin verificación
                            </span>
                          )}
                          {s.status === "CLOSED" && d !== null && (
                            <span className={`badge ${d === 0 ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-red-200 bg-red-50 text-red-700"}`}>
                              {d === 0 ? "Cuadra" : d > 0 ? `Sobra $${d.toLocaleString("es-CO")}` : `Falta $${Math.abs(d).toLocaleString("es-CO")}`}
                            </span>
                          )}
                        </div>

                        {/* Fechas */}
                        <div className="mt-1 text-xs text-gray-500">
                          Abierto: {fmt(s.opened_at)}
                          {s.closed_at && <span> • Cerrado: {fmt(s.closed_at)}</span>}
                        </div>
                      </div>

                      {/* Base + expand */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-xs text-gray-500">Base</div>
                          <div className="text-sm font-extrabold">{fmtMoney(s.opening_cash)}</div>
                        </div>
                        {s.expected_total != null && (
                          <div className="text-right">
                            <div className="text-xs text-gray-500">Esperado</div>
                            <div className="text-sm font-extrabold">{fmtMoney(s.expected_total)}</div>
                          </div>
                        )}
                        <span className="text-gray-400 text-xs">{isExpanded ? "▲" : "▼"}</span>
                      </div>
                    </div>
                  </button>

                  {/* DETALLE expandido */}
                  {isExpanded && (
                    <div className="card-b space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

                        {/* Apertura */}
                        <DetailCard title="Apertura de turno" color="blue">
                          <DetailRow label="Fecha" value={fmt(s.opened_at)} />
                          <DetailRow label="Base de caja" value={fmtMoney(s.opening_cash)} />
                        </DetailCard>

                        {/* Verificación de entrega */}
                        <DetailCard
                          title="Verificación de entrega"
                          color={hasVerif ? "emerald" : "amber"}
                          badge={hasVerif ? "✓ Realizada" : "Pendiente"}
                        >
                          {hasVerif && s.verification ? (
                            <>
                              <DetailRow label="Cajero" value={s.verification.verified_by_name} />
                              <DetailRow label="Hora" value={fmt(s.verification.verified_at)} />
                              <DetailRow label="Base verificada" value={fmtMoney(s.verification.opening_cash)} />
                              <DetailRow label="Ventas al verificar" value={fmtMoney(s.verification.sales_total)} />
                              <DetailRow label="Total verificado" value={fmtMoney(s.verification.expected_total)} bold />
                              <DetailRow label="Ventas registradas" value={String(s.verification.sales_count)} />
                            </>
                          ) : (
                            <div className="text-sm text-amber-600">
                              No se realizó verificación de entrega en este turno.
                            </div>
                          )}
                        </DetailCard>

                        {/* Cierre */}
                        <DetailCard
                          title="Cierre de turno"
                          color={s.status === "CLOSED" ? (d === 0 ? "emerald" : "red") : "gray"}
                          badge={s.status === "CLOSED" ? "Cerrado" : "Abierto"}
                        >
                          {s.status === "CLOSED" && s.closed_at ? (
                            <>
                              <DetailRow label="Fecha cierre" value={fmt(s.closed_at)} />
                              <DetailRow label="Total esperado" value={fmtMoney(s.expected_total ?? 0)} />
                              <DetailRow label="Total confirmado" value={s.confirmed_total != null ? fmtMoney(s.confirmed_total) : "—"} />
                              {d !== null && (
                                <DetailRow
                                  label="Diferencia"
                                  value={d === 0 ? "Cuadra ✓" : `${d > 0 ? "+" : ""}${fmtMoney(d)}`}
                                  bold
                                  highlight={d === 0 ? "green" : "red"}
                                />
                              )}
                            </>
                          ) : (
                            <div className="text-sm text-gray-500">
                              El turno aún está abierto.
                            </div>
                          )}
                        </DetailCard>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </PageShell>
    </div>
  );
}

// ── Sub-componentes ──────────────────────────────────────────

function DetailCard({
  title,
  color = "gray",
  badge,
  children,
}: {
  title: string;
  color?: "blue" | "emerald" | "amber" | "red" | "gray";
  badge?: string;
  children: React.ReactNode;
}) {
  const borderColor = {
    blue: "border-blue-200",
    emerald: "border-emerald-200",
    amber: "border-amber-200",
    red: "border-red-200",
    gray: "border-gray-200",
  }[color];

  const headerColor = {
    blue: "bg-blue-50 text-blue-700",
    emerald: "bg-emerald-50 text-emerald-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
    gray: "bg-gray-50 text-gray-700",
  }[color];

  return (
    <div className={`rounded-2xl border ${borderColor} overflow-hidden`}>
      <div className={`px-3 py-2 flex items-center justify-between ${headerColor}`}>
        <span className="text-xs font-extrabold">{title}</span>
        {badge && <span className="text-xs font-semibold opacity-75">{badge}</span>}
      </div>
      <div className="p-3 space-y-2">{children}</div>
    </div>
  );
}

function DetailRow({
  label,
  value,
  bold = false,
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: "green" | "red";
}) {
  const valueColor = highlight === "green"
    ? "text-emerald-600"
    : highlight === "red"
    ? "text-red-600"
    : "text-gray-900";

  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-gray-500 shrink-0">{label}</span>
      <span className={`text-xs text-right ${bold ? "font-extrabold" : "font-semibold"} ${valueColor}`}>
        {value}
      </span>
    </div>
  );
}