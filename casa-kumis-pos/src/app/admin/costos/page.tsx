"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { requireRole } from "@/lib/requireRole";
import { usePlant } from "@/contexts/PlantContext";
import { calculateProductCost, calculateCostVariance, type MaterialBatch } from "@/utils/costCalculations";
import PageShell from "@/components/PageShell";
import LoadingCard from "@/components/LoadingCard";
import { BatchLotSelector } from "@/components/BatchLotSelector";
import { CostBreakdown } from "@/components/CostBreakdown";
import {
  CostsTabs,
  CostsCard,
  AlertBox,
  CostsLoading,
  EmptyState,
  FormInput,
  FormSelect,
  Badge,
  CostsTable,
  CostsModal,
} from "@/components/costos-components";
import {
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  ArrowRightLeft,
  Download,
  Zap,
  Info,
  TrendingDown,
  Package,
  Factory,
  ListChecks,
  BarChart3,
  Bell,
} from "lucide-react";

type Tab = "materias-primas" | "produccion" | "formulas" | "reportes" | "historial" | "alertas";

type RawMaterial = {
  id: string;
  name: string;
  unit: string;
  description: string;
  is_active: boolean;
};

type RawMaterialState = {
  id: string;
  raw_material_id: string;
  name: string;
  order_num: number;
};

type RawMaterialInventory = {
  id: string;
  raw_material_id: string;
  state_id: string;
  quantity: number;
  state_name?: string;
};

type FormulaIngredient = {
  id: string;
  product_id: string;
  ingredient_id: string;
  ingredient_type: "RAW_MATERIAL" | "PRODUCT";
  quantity: number;
  unit: string;
  ingredient_name?: string;
  ingredient_state_id?: string; // NUEVO - para seleccionar estado
  ingredient_state_name?: string; // NUEVO - nombre del estado
};

type ProductFormula = {
  id: string;
  name: string;
  unit: string;
  description?: string;
  ingredients: FormulaIngredient[];
};

export default function AdminCostosPage() {
  const router = useRouter();
  const { selectedPlantId } = usePlant();
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("materias-primas");
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const detallesRef = useRef<HTMLDivElement>(null);

  // Materias Primas
  const [materialesPrimas, setMaterialesPrimas] = useState<RawMaterial[]>([]);
  const [statesByMaterial, setStatesByMaterial] = useState<Record<string, RawMaterialState[]>>({});
  const [inventoryByMaterial, setInventoryByMaterial] = useState<Record<string, RawMaterialInventory[]>>({});
  const [showAddMaterial, setShowAddMaterial] = useState(false);
  const [newMaterialName, setNewMaterialName] = useState("");
  const [newMaterialUnit, setNewMaterialUnit] = useState("kg");
  const [newMaterialDesc, setNewMaterialDesc] = useState("");
  const [newMaterialInitialState, setNewMaterialInitialState] = useState("Cruda");
  const [savingMaterial, setSavingMaterial] = useState(false);

  // Materias Primas - Estados
  const [selectedMaterialForStates, setSelectedMaterialForStates] = useState<string | null>(null);
  const [showAddState, setShowAddState] = useState(false);
  const [newStateName, setNewStateName] = useState("");
  const [savingState, setSavingState] = useState(false);

  // Edit Material
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null);
  const [editMaterialName, setEditMaterialName] = useState("");
  const [editMaterialUnit, setEditMaterialUnit] = useState("");
  const [editMaterialDesc, setEditMaterialDesc] = useState("");
  const [savingEditMaterial, setSavingEditMaterial] = useState(false);

  // Edit State
  const [editingState, setEditingState] = useState<RawMaterialState | null>(null);
  const [editStateName, setEditStateName] = useState("");
  const [savingEditState, setSavingEditState] = useState(false);

  // PRODUCCIÓN
  const [tipoRegistro, setTipoRegistro] = useState<"entrada" | "transformacion" | "merma" | "produccion">("entrada");

  // ENTRADA INICIAL
  const [selectedMaterial, setSelectedMaterial] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [entradaCantidad, setEntradaCantidad] = useState("");
  const [entradaCosto, setEntradaCosto] = useState("");
  const [entradaProveedor, setEntradaProveedor] = useState("");
  const [entradaLote, setEntradaLote] = useState("");
  const [entradaObservaciones, setEntradaObservaciones] = useState("");
  const [savingEntrada, setSavingEntrada] = useState(false);

  // TRANSFORMACIÓN
  const [transformMaterial, setTransformMaterial] = useState("");
  const [transformFromState, setTransformFromState] = useState("");
  const [transformToState, setTransformToState] = useState("");
  const [transformQtyIn, setTransformQtyIn] = useState("");
  const [transformQtyOut, setTransformQtyOut] = useState("");
  const [transformObservaciones, setTransformObservaciones] = useState("");
  const [savingTransform, setSavingTransform] = useState(false);

  // MERMA ADICIONAL
  const [batchSelect, setBatchSelect] = useState("");
  const [wasteQty, setWasteQty] = useState("");
  const [wasteReason, setWasteReason] = useState("");
  const [savingWaste, setSavingWaste] = useState(false);
  const [batches, setBatches] = useState<Array<any>>([]); // Lotes disponibles
  const [loadingBatches, setLoadingBatches] = useState(false);

  // PRODUCCIÓN
  const [produceProduct, setProduceProduct] = useState("");
  const [produceQty, setProduceQty] = useState("");
  const [produceObservations, setProduceObservations] = useState("");
  const [savingProduce, setSavingProduce] = useState(false);
  const [products, setProducts] = useState<Array<{ id: string; name: string }>>([]);

  // FÓRMULAS
  const [formulas, setFormulas] = useState<ProductFormula[]>([]);
  const [selectedFormula, setSelectedFormula] = useState<ProductFormula | null>(null);
  const [showCreateFormula, setShowCreateFormula] = useState(false);
  const [showEditFormula, setShowEditFormula] = useState(false);
  const [showAddIngredient, setShowAddIngredient] = useState(false);

  // EDITAR CANTIDAD DE INGREDIENTE
  const [editingIngredientId, setEditingIngredientId] = useState("");
  const [editingIngredientQty, setEditingIngredientQty] = useState("");
  const [showEditIngredient, setShowEditIngredient] = useState(false);
  const [savingEditIngredient, setSavingEditIngredient] = useState(false);

  // DUPLICAR PRODUCTO
  const [duplicatingProductId, setDuplicatingProductId] = useState("");
  const [duplicatingProductName, setDuplicatingProductName] = useState("");
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [savingDuplicate, setSavingDuplicate] = useState(false);

  // REPORTES
  const [reportesTab, setReportesTab] = useState<"resumen" | "merma" | "produccion" | "variancia" | "costos">("resumen");
  const [reportesCostosFiltroProducto, setReportesCostosFiltroProducto] = useState("");
  const [reportesCostosFiltroDesde, setReportesCostosFiltroDesde] = useState("");
  const [reportesCostosFiltroHasta, setReportesCostosFiltroHasta] = useState("");
  const [dataMerma, setDataMerma] = useState<any[]>([]);
  const [dataProduccion, setDataProduccion] = useState<any[]>([]);
  const [dataVariancia, setDataVariancia] = useState<any[]>([]);
  const [loadingReportes, setLoadingReportes] = useState(false);

  // HISTORIAL DE COSTOS (Opción D)
  const [historialTab, setHistorialTab] = useState<"por-producto" | "variancia-acumulada" | "tendencias">("por-producto");
  const [historialData, setHistorialData] = useState<any[]>([]);
  const [historialProductoFiltro, setHistorialProductoFiltro] = useState<string>("");
  const [loadingHistorialCostos, setLoadingHistorialCostos] = useState(false);

  // ALERTAS
  const [alertas, setAlertas] = useState<any[]>([]);
  const [alertasNoLeidas, setAlertasNoLeidas] = useState(0);
  const [filtroAlertas, setFiltroAlertas] = useState<"todas" | "red" | "yellow">("todas");
  const [loadingAlertas, setLoadingAlertas] = useState(false);

  // ALERTAS PERSONALIZADAS (umbrales)
  const [alertasTab, setAlertasTab] = useState<"notificaciones" | "configurar">("notificaciones");
  const [thresholds, setThresholds] = useState<any[]>([]);
  const [loadingThresholds, setLoadingThresholds] = useState(false);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [showAddThreshold, setShowAddThreshold] = useState(false);
  const [thresholdMaterial, setThresholdMaterial] = useState("");
  const [thresholdState, setThresholdState] = useState("");
  const [thresholdMinStock, setThresholdMinStock] = useState("");
  const [thresholdMaxCost, setThresholdMaxCost] = useState("");
  const [thresholdMaxWaste, setThresholdMaxWaste] = useState("");

  // BÚSQUEDA E HISTORIAL
  const [materialesSearchTerm, setMaterialesSearchTerm] = useState("");
  const [historialMateria, setHistorialMateria] = useState<any[]>([]);
  const [historialFormula, setHistorialFormula] = useState<any[]>([]);
  const [loadingHistorial, setLoadingHistorial] = useState(false);
  const [mostrarHistorialMateria, setMostrarHistorialMateria] = useState(false);
  const [mostrarHistorialFormula, setMostrarHistorialFormula] = useState(false);

  // ANÁLISIS DE VARIANCIA (Costos)
  const [mostrarAnalisisVariancia, setMostrarAnalisisVariancia] = useState(false);
  const [productoVariancia, setProductoVariancia] = useState("");
  const [cantidadProducida, setCantidadProducida] = useState("");
  const [ingredienteLotes, setIngredienteLotes] = useState<Record<string, Array<{batchId: string; quantity: number}>>>({}); // ingrediente_id -> [{batchId, quantity}]
  const [rawQtyText, setRawQtyText] = useState<Record<string, string>>({}); // texto raw del input de cantidad (ingId -> texto)
  const [varianciaResultado, setVarianciaResultado] = useState<any>(null);
  const [savingVariancia, setSavingVariancia] = useState(false);

  // Antiguo (mantener por compatibilidad)
  const [productoAnalisis, setProductoAnalisis] = useState("");
  const [teoricoAnalisis, setTeoricoAnalisis] = useState(0);
  const [realAnalisis, setRealAnalisis] = useState("");
  const [ingredientesReales, setIngredientesReales] = useState<Record<string, string>>({});
  const [varianciaCalculada, setVarianciaCalculada] = useState<any>(null);

  // Crear nueva fórmula
  const [newFormulaName, setNewFormulaName] = useState("");
  const [newFormulaUnit, setNewFormulaUnit] = useState("u");
  const [newFormulaDesc, setNewFormulaDesc] = useState("");
  const [savingNewFormula, setSavingNewFormula] = useState(false);

  // Agregar ingrediente
  const [ingredientType, setIngredientType] = useState<"RAW_MATERIAL" | "PRODUCT">("RAW_MATERIAL");
  const [selectedIngredient, setSelectedIngredient] = useState("");
  const [selectedMaterialState, setSelectedMaterialState] = useState(""); // NUEVO: Estado de la materia prima
  const [ingredientQty, setIngredientQty] = useState("");
  const [savingIngredient, setSavingIngredient] = useState(false);

  // ANÁLISIS DE PRODUCCIÓN
  const [showAnalisisModal, setShowAnalisisModal] = useState(false);
  const [analisisQty, setAnalisisQty] = useState("");
  const [analisisResults, setAnalisisResults] = useState<any>(null);

  // Fórmulas - Búsqueda y filtro
  const [formulasSearchTerm, setFormulasSearchTerm] = useState("");
  const [formulasOrderBy, setFormulasOrderBy] = useState<"name" | "ingredients" | "recent">("ingredients");

  const TABS = [
    { id: "materias-primas" as Tab, label: "Materias Primas" },
    { id: "produccion" as Tab, label: "Producción" },
    { id: "formulas" as Tab, label: "Fórmulas" },
    { id: "reportes" as Tab, label: "Reportes" },
    { id: "historial" as Tab, label: "Historial de Costos" },
    { id: "alertas" as Tab, label: "Alertas" },
  ];

  // Función para obtener el icono según el tab
  const getTabIcon = (tabId: string) => {
    switch (tabId) {
      case "materias-primas":
        return <Package size={18} className="inline mr-2" />;
      case "produccion":
        return <Factory size={18} className="inline mr-2" />;
      case "formulas":
        return <ListChecks size={18} className="inline mr-2" />;
      case "reportes":
        return <BarChart3 size={18} className="inline mr-2" />;
      case "historial":
        return <TrendingDown size={18} className="inline mr-2" />;
      case "alertas":
        return (
          <div className="inline-flex items-center gap-2">
            <Bell size={18} />
            {alertasNoLeidas > 0 && (
              <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full font-bold">
                {alertasNoLeidas}
              </span>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  // Filtrar y ordenar fórmulas
  const filteredAndSortedFormulas = useMemo(() => {
    let result = [...formulas];

    // Filtrar por búsqueda
    if (formulasSearchTerm.trim()) {
      result = result.filter((f) =>
        f.name.toLowerCase().includes(formulasSearchTerm.toLowerCase())
      );
    }

    // Ordenar
    switch (formulasOrderBy) {
      case "name":
        result.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "ingredients":
        result.sort((a, b) => b.ingredients.length - a.ingredients.length);
        break;
      case "recent":
        result.reverse();
        break;
    }

    return result;
  }, [formulas, formulasSearchTerm, formulasOrderBy]);

  useEffect(() => {
    const run = async () => {
      const role = await requireRole("ADMIN");
      if (!role.ok) return router.replace("/admin");

      await cargarMaterialesPrimas();
      await obtenerAlertas();
      setLoading(false);
    };
    run().catch((e: any) => {
      setErr(e?.message ?? "Error cargando datos.");
      setLoading(false);
    });
  }, [router]);

  // Scroll automático a detalles cuando se selecciona una fórmula
  useEffect(() => {
    if (selectedFormula && detallesRef.current && activeTab === "formulas") {
      setTimeout(() => {
        detallesRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 100);
    }
  }, [selectedFormula, activeTab]);

  // Cargar fórmulas cuando se abre el modal de variancia
  useEffect(() => {
    if (mostrarAnalisisVariancia && formulas.length === 0) {
      cargarFormulas();
    }
  }, [mostrarAnalisisVariancia]);

  // Cargar reportes automáticamente cuando se abre el tab de reportes
  useEffect(() => {
    if (activeTab === "reportes" && dataMerma.length === 0 && dataProduccion.length === 0) {
      setReportesTab("resumen");
      cargarReportes();
    }
  }, [activeTab]);

  const cargarMaterialesPrimas = async () => {
    try {
      // Cargar materias primas
      const { data: materials, error: matsError } = await supabase
        .from("raw_materials")
        .select("*")
        .eq("is_active", true)
        .order("name");

      if (matsError) throw new Error(matsError.message);
      setMaterialesPrimas(materials ?? []);

      // Cargar estados por material
      const { data: allStates, error: statesError } = await supabase
        .from("raw_material_states")
        .select("*")
        .eq("is_active", true)
        .order("order_num");

      if (statesError) throw new Error(statesError.message);

      const statesMap: Record<string, RawMaterialState[]> = {};
      for (const mat of materials ?? []) {
        statesMap[mat.id] = (allStates ?? []).filter((s) => s.raw_material_id === mat.id);
      }
      setStatesByMaterial(statesMap);

      // Cargar inventario
      const { data: inventory } = await supabase.from("raw_material_inventory").select("*");
      const invMap: Record<string, RawMaterialInventory[]> = {};
      for (const mat of materials ?? []) {
        invMap[mat.id] = (inventory ?? []).filter((i) => i.raw_material_id === mat.id);
      }
      setInventoryByMaterial(invMap);
    } catch (e: any) {
      throw e;
    }
  };

  const crearMaterial = async () => {
    if (!newMaterialName.trim()) {
      setErr("El nombre de la materia prima es requerido.");
      return;
    }
    if (!newMaterialInitialState.trim()) {
      setErr("El estado inicial es requerido.");
      return;
    }
    setSavingMaterial(true);
    try {
      // 1. Crear la materia prima
      const { data: matData, error: matError } = await supabase
        .from("raw_materials")
        .insert([{ name: newMaterialName.trim(), unit: newMaterialUnit, description: newMaterialDesc }])
        .select();

      if (matError) throw new Error(matError.message);
      if (!matData || !matData[0]) throw new Error("No se creó la materia prima");

      const materialId = matData[0].id;

      // 2. Crear estado inicial con el nombre que puso el usuario
      const { data: stateData, error: stateError } = await supabase
        .from("raw_material_states")
        .insert([
          {
            raw_material_id: materialId,
            name: newMaterialInitialState.trim(),
            order_num: 1,
          },
        ])
        .select();

      if (stateError) throw new Error(stateError.message);
      if (!stateData || !stateData[0]) throw new Error("No se creó el estado");

      const stateId = stateData[0].id;

      // 3. Crear inventario para este estado (vacío por ahora)
      const { error: invError } = await supabase.from("raw_material_inventory").insert([
        {
          raw_material_id: materialId,
          state_id: stateId,
          quantity: 0,
        },
      ]);

      if (invError) throw new Error(invError.message);

      // Actualizar estado local
      setMaterialesPrimas([...materialesPrimas, matData[0]]);
      setStatesByMaterial({
        ...statesByMaterial,
        [materialId]: [stateData[0]],
      });

      setNewMaterialName("");
      setNewMaterialUnit("kg");
      setNewMaterialDesc("");
      setNewMaterialInitialState("Cruda");
      setShowAddMaterial(false);
      setErr(null);
    } catch (e: any) {
      setErr(e.message ?? "Error creando material.");
    } finally {
      setSavingMaterial(false);
    }
  };

  const crearEstado = async () => {
    if (!selectedMaterialForStates || !newStateName.trim()) {
      setErr("Selecciona material y nombre de estado.");
      return;
    }

    setSavingState(true);
    try {
      const maxOrder = Math.max(0, ...(statesByMaterial[selectedMaterialForStates]?.map((s) => s.order_num) ?? [0]));

      const { data, error } = await supabase
        .from("raw_material_states")
        .insert([
          {
            raw_material_id: selectedMaterialForStates,
            name: newStateName.trim(),
            order_num: maxOrder + 1,
          },
        ])
        .select();

      if (error) throw new Error(error.message);

      setStatesByMaterial({
        ...statesByMaterial,
        [selectedMaterialForStates]: [...(statesByMaterial[selectedMaterialForStates] ?? []), ...(data ?? [])],
      });

      if (data && data[0]) {
        await supabase.from("raw_material_inventory").insert([
          {
            raw_material_id: selectedMaterialForStates,
            state_id: data[0].id,
            quantity: 0,
          },
        ]);
      }

      setNewStateName("");
      setShowAddState(false);
      setErr(null);
    } catch (e: any) {
      setErr(e.message ?? "Error creando estado.");
    } finally {
      setSavingState(false);
    }
  };

  // EDITAR MATERIA PRIMA
  const abrirEditarMaterial = (mat: RawMaterial) => {
    setEditingMaterial(mat);
    setEditMaterialName(mat.name);
    setEditMaterialUnit(mat.unit);
    setEditMaterialDesc(mat.description ?? "");
  };

  const guardarEditarMaterial = async () => {
    if (!editingMaterial || !editMaterialName.trim()) {
      setErr("El nombre es requerido.");
      return;
    }
    setSavingEditMaterial(true);
    try {
      const { error } = await supabase
        .from("raw_materials")
        .update({
          name: editMaterialName.trim(),
          unit: editMaterialUnit,
          description: editMaterialDesc,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingMaterial.id);

      if (error) throw new Error(error.message);

      setMaterialesPrimas(
        materialesPrimas.map((m) =>
          m.id === editingMaterial.id
            ? { ...m, name: editMaterialName, unit: editMaterialUnit, description: editMaterialDesc }
            : m
        )
      );
      setEditingMaterial(null);
      setErr(null);
    } catch (e: any) {
      setErr(e.message ?? "Error editando material.");
    } finally {
      setSavingEditMaterial(false);
    }
  };

  const eliminarMaterial = async (id: string) => {
    if (!confirm("¿Eliminar esta materia prima? Esto no se puede deshacer.")) return;
    try {
      const { error } = await supabase.from("raw_materials").update({ is_active: false }).eq("id", id);

      if (error) throw new Error(error.message);

      // Actualizar estado local
      const nuevosMateriales = materialesPrimas.filter((m) => m.id !== id);
      setMaterialesPrimas(nuevosMateriales);
      
      // Remover los estados de esta materia prima
      const nuevosStates = { ...statesByMaterial };
      delete nuevosStates[id];
      setStatesByMaterial(nuevosStates);
      
      if (selectedMaterialForStates === id) setSelectedMaterialForStates(null);
      setErr(null);
    } catch (e: any) {
      setErr(e.message ?? "Error eliminando material.");
    }
  };

  // EDITAR ESTADO
  const abrirEditarEstado = (state: RawMaterialState) => {
    setEditingState(state);
    setEditStateName(state.name);
  };

  const guardarEditarEstado = async () => {
    if (!editingState || !editStateName.trim()) {
      setErr("El nombre del estado es requerido.");
      return;
    }
    setSavingEditState(true);
    try {
      const { error } = await supabase
        .from("raw_material_states")
        .update({ name: editStateName.trim() })
        .eq("id", editingState.id);

      if (error) throw new Error(error.message);

      const matId = editingState.raw_material_id;
      setStatesByMaterial({
        ...statesByMaterial,
        [matId]: (statesByMaterial[matId] ?? []).map((s) =>
          s.id === editingState.id ? { ...s, name: editStateName } : s
        ),
      });
      setEditingState(null);
      setErr(null);
    } catch (e: any) {
      setErr(e.message ?? "Error editando estado.");
    } finally {
      setSavingEditState(false);
    }
  };

  const eliminarEstado = async (stateId: string, matId: string) => {
    if (!confirm("¿Eliminar este estado? Esto no se puede deshacer.")) return;
    try {
      // 1. Eliminar el estado
      const { error } = await supabase.from("raw_material_states").update({ is_active: false }).eq("id", stateId);

      if (error) throw new Error(error.message);

      // 2. Obtener los estados restantes ordenados
      const statesRestantes = (statesByMaterial[matId] ?? [])
        .filter((s) => s.id !== stateId)
        .sort((a, b) => a.order_num - b.order_num);

      // 3. Reordenar los estados restantes (empezar desde 1)
      for (let i = 0; i < statesRestantes.length; i++) {
        const newOrder = i + 1;
        if (statesRestantes[i].order_num !== newOrder) {
          await supabase
            .from("raw_material_states")
            .update({ order_num: newOrder })
            .eq("id", statesRestantes[i].id);
        }
      }

      // 4. Actualizar estado local con órdenes nuevos
      const statesActualizados = statesRestantes.map((s, i) => ({
        ...s,
        order_num: i + 1,
      }));

      setStatesByMaterial({
        ...statesByMaterial,
        [matId]: statesActualizados,
      });

      setErr(null);
    } catch (e: any) {
      setErr(e.message ?? "Error eliminando estado.");
    }
  };

  // ============================================================================
  // FUNCIONES PARA PRODUCCIÓN
  // ============================================================================

  // Cargar productos
  const cargarDatosProduccion = async () => {
    try {
      const { data: prods } = await supabase.from("products").select("id, name");
      setProducts(prods ?? []);
    } catch (e) {
      console.error("Error cargando datos producción:", e);
    }
  };

  // Efecto para recargar datos cuando cambias de tab
  useEffect(() => {
    if (activeTab === "materias-primas") {
      cargarMaterialesPrimas();
    }
    if (activeTab === "produccion") {
      cargarDatosProduccion();
      cargarLotes();
    }
    if (activeTab === "formulas") {
      cargarFormulas();
    }
    if (activeTab === "historial") {
      cargarHistorial();
    }
    if (activeTab === "alertas") {
      cargarThresholds();
    }
  }, [activeTab, selectedPlantId]);

  // FUNCIÓN HELPER: Obtener todos los ingredientes recursivamente (incluyendo anidados)
  const obtenerTodosLosIngredientes = (
    ingredientes: any[],
    prefix: string = ""
  ): Array<{ id: string; name: string; type: string; parentId?: string; stateId?: string; stateName?: string; level: number }> => {
    let resultado: any[] = [];

    for (const ing of ingredientes) {
      const ingId = prefix ? `${prefix}.${ing.ingredient_id}` : ing.ingredient_id;
      resultado.push({
        id: ingId,
        name: ing.ingredient_name,
        type: ing.ingredient_type,
        parentId: ing.ingredient_id,
        stateId: ing.ingredient_state_id || null,
        stateName: ing.ingredient_state_name || null,
        level: prefix ? (prefix.match(/\./g)?.length || 0) + 1 : 0,
      });

      // Si es un producto anidado, obtener sus ingredientes recursivamente
      if (ing.ingredient_type === "PRODUCT") {
        const formulaAnidada = formulas.find((f) => f.id === ing.ingredient_id);
        if (formulaAnidada) {
          const subIngredientes = obtenerTodosLosIngredientes(
            formulaAnidada.ingredients,
            ingId
          );
          resultado = [...resultado, ...subIngredientes];
        }
      }
    }

    return resultado;
  };

  // Extraer el ID original de un ID aplanado (ej: "masa-id.harina-id" -> "harina-id")
  const getOriginalIngredientId = (flatId: string): string => {
    const parts = flatId.split(".");
    return parts[parts.length - 1];
  };

  // Generar código de lote único automáticamente
  const generateLotCode = (materialName: string): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = String(today.getDate()).padStart(2, "0");
    const randomNum = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");

    // Tomar primeras 3 letras del material (en mayúscula)
    const materialCode = materialName.substring(0, 3).toUpperCase();

    return `${materialCode}-${year}${month}${day}-${randomNum}`;
  };

  // Obtener cantidad requerida de un ingrediente flattened
  const getRequiredQuantity = (flatIngredient: any): number => {
    const selectedFormula = formulas.find((f) => f.id === productoVariancia);
    if (!selectedFormula) return 0;

    // Para ingredientes de nivel 0, buscar directamente
    if (flatIngredient.level === 0) {
      const ing = selectedFormula.ingredients.find((i) => i.ingredient_id === flatIngredient.parentId);
      return ing?.quantity || 0;
    }

    // Para ingredientes anidados, recurrir en la estructura
    const parts = flatIngredient.id.split(".");
    let currentIngredients = selectedFormula.ingredients;

    for (let i = 0; i < parts.length - 1; i++) {
      const parentId = parts[i];
      const currentIng = currentIngredients.find((ing) => ing.ingredient_id === parentId);
      if (!currentIng || currentIng.ingredient_type !== "PRODUCT") return 0;

      const subFormula = formulas.find((f) => f.id === currentIng.ingredient_id);
      if (!subFormula) return 0;

      currentIngredients = subFormula.ingredients;
    }

    const finalIng = currentIngredients.find((i) => i.ingredient_id === flatIngredient.parentId);
    return finalIng?.quantity || 0;
  };

  // Calcular cantidad total requerida considerando toda la cadena de padres
  const getTotalRequiredQuantity = (flatIngredient: any, quantity: number = 1): number => {
    const selectedFormula = formulas.find((f) => f.id === productoVariancia);
    if (!selectedFormula) return 0;

    const parts = flatIngredient.id.split(".");
    let currentIngredients = selectedFormula.ingredients;
    let totalQty = quantity;

    // Para cada parte del ID, obtener la cantidad del padre
    for (let i = 0; i < parts.length; i++) {
      const currentId = parts[i];
      const currentIng = currentIngredients.find((ing) => ing.ingredient_id === currentId);

      if (!currentIng) {
        console.warn(`getTotalRequiredQuantity: No encontrado ${currentId}`, { flatIngredient, parts });
        return 0;
      }

      totalQty *= currentIng.quantity || 0;

      // Si no es el último elemento, cargar los ingredientes del siguiente nivel
      if (i < parts.length - 1) {
        if (currentIng.ingredient_type !== "PRODUCT") return 0;
        const subFormula = formulas.find((f) => f.id === currentIng.ingredient_id);
        if (!subFormula) return 0;
        currentIngredients = subFormula.ingredients;
      }
    }

    console.log(`getTotalRequiredQuantity(${flatIngredient.id}, qty=${quantity}) = ${totalQty} | name=${flatIngredient.name}`);
    return totalQty;
  };


  // CALCULAR VARIANCIA DE COSTOS
  const calcularVarianciaCostos = async () => {
    if (!productoVariancia || !cantidadProducida) {
      setErr("Selecciona producto y cantidad producida.");
      return;
    }

    const selectedFormula = formulas.find((f) => f.id === productoVariancia);
    if (!selectedFormula) {
      setErr("Fórmula no encontrada.");
      return;
    }

    // Verificar que todos los ingredientes (incluyendo anidados) tengan lotes y cantidad seleccionados
    const allIngredients = obtenerTodosLosIngredientes(selectedFormula.ingredients);
    const rawMaterialIngredients = allIngredients.filter((ing) => ing.type === "RAW_MATERIAL");

    for (const ingredient of rawMaterialIngredients) {
      const selections = ingredienteLotes[ingredient.id];
      if (!selections || selections.length === 0) {
        setErr(`Selecciona al menos un lote para ${ingredient.name}.`);
        return;
      }

      const totalQty = selections.reduce((sum, sel) => sum + (sel.quantity || 0), 0);
      if (totalQty <= 0) {
        setErr(`Ingresa cantidad para ${ingredient.name}.`);
        return;
      }

      // Validar que no se exceda la cantidad requerida
      const required = getTotalRequiredQuantity(ingredient, parseFloat(cantidadProducida) || 0);
      if (totalQty > required) {
        setErr(
          `${ingredient.name}: ${totalQty.toFixed(2)} excede lo requerido (${required.toFixed(2)}). ` +
            `Por favor reduce la cantidad.`
        );
        return;
      }
    }

    try {
      // Convertir batches al formato correcto
      const batchesFormato = batches.map((b) => ({
        id: b.id,
        raw_material_id: b.raw_material_id,
        quantity_in: parseFloat(b.quantity_in),
        quantity_out: parseFloat(b.quantity_out),
        cost: parseFloat(b.cost) || 0,
        cost_per_unit: parseFloat(b.cost_per_unit) || 0,
        batch_date: b.batch_date,
        lot_code: b.lot_code,
      }));

      // Crear mapa de fórmulas
      const formulasMap = new Map(
        formulas.map((f) => [
          f.id,
          f.ingredients.map((ing) => ({
            ingredient_id: ing.ingredient_id,
            ingredient_name: ing.ingredient_name || "Ingrediente",
            ingredient_type: ing.ingredient_type,
            quantity: ing.quantity,
            unit: ing.unit,
            state_id: ing.ingredient_state_id,
          })),
        ])
      ) as any;

      // Convertir las selecciones de múltiples lotes a un lote ponderado
      const batchSelections: Record<string, string> = {};
      const virtualBatches: Record<string, MaterialBatch> = {};

      Object.entries(ingredienteLotes).forEach(([flatId, selections]) => {
        const originalId = getOriginalIngredientId(flatId);

        if (selections.length === 1) {
          // Un solo lote: usar directamente
          batchSelections[originalId] = selections[0].batchId;
        } else {
          // Múltiples lotes: crear lote virtual con costo promedio ponderado
          const totalQty = selections.reduce((sum, sel) => sum + sel.quantity, 0);
          let totalCost = 0;

          selections.forEach((sel) => {
            const batch = batchesFormato.find((b) => b.id === sel.batchId);
            if (batch) {
              const costPerUnit = batch.cost_per_unit || 0;
              totalCost += costPerUnit * sel.quantity;
            }
          });

          const weightedCostPerUnit = totalQty > 0 ? totalCost / totalQty : 0;

          const virtualBatchId = `VIRTUAL-${originalId}`;
          virtualBatches[virtualBatchId] = {
            id: virtualBatchId,
            raw_material_id: originalId,
            quantity_in: totalQty,
            quantity_out: totalQty,
            cost: totalCost,
            cost_per_unit: weightedCostPerUnit,
            batch_date: new Date().toISOString().split("T")[0],
            lot_code: `Mezcla (${selections.length} lotes)`,
          };

          batchSelections[originalId] = virtualBatchId;
        }
      });

      // Agregar lotes virtuales a la lista de batches
      const batchesConVirtual = [...batchesFormato, ...Object.values(virtualBatches)];


      // Calcular costo del producto
      const cantProducida = parseFloat(cantidadProducida);
      const ingredientsFormatted = selectedFormula.ingredients.map((ing) => ({
        ingredient_id: ing.ingredient_id,
        ingredient_name: ing.ingredient_name || "Ingrediente",
        ingredient_type: ing.ingredient_type,
        quantity: ing.quantity,
        unit: ing.unit,
        state_id: ing.ingredient_state_id,
      })) as any;

      const { totalCost, breakdown } = calculateProductCost(
        productoVariancia,
        ingredientsFormatted,
        batchSelections,
        batchesConVirtual,
        formulasMap
      );

      // totalCost ya es el costo de 1 unidad (calculateProductCost trabaja con cantidades de la fórmula por unidad)
      const costPorUnidad = totalCost;
      const costTotalProduccion = totalCost * cantProducida;

      setVarianciaResultado({
        producto_id: productoVariancia,
        producto_nombre: selectedFormula.name,
        cantidad_producida: cantProducida,
        cost_estimated: costTotalProduccion,
        cost_per_unit: costPorUnidad,
        cost_breakdown: breakdown,
        breakdown_json: JSON.stringify(breakdown),
      });

      setErr(null);
    } catch (e: any) {
      console.error("Error calculando variancia:", e);
      setErr(e.message || "Error calculando variancia.");
    }
  };

  // GUARDAR VARIANCIA
  const guardarVariancia = async () => {
    if (!varianciaResultado) {
      setErr("Calcula variancia primero.");
      return;
    }

    setSavingVariancia(true);
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;

      // 1. Guardar registro en production_variance_log
      const { error } = await supabase
        .from("production_variance_log")
        .insert([
          {
            product_id: varianciaResultado.producto_id,
            quantity_produced: varianciaResultado.cantidad_producida,
            cost_estimated: varianciaResultado.cost_estimated,
            cost_per_unit: varianciaResultado.cost_per_unit,
            cost_breakdown: varianciaResultado.breakdown_json,
            plant_id: selectedPlantId,
            created_by: userId,
            variance_date: new Date().toISOString().split("T")[0],
          },
        ]);

      if (error) throw error;

      // 2. Descontar de los lotes específicos seleccionados
      // Agrupar cantidades por batchId (por si el mismo lote aparece en dos ingredientes)
      const batchDeductions: Record<string, number> = {};
      for (const selections of Object.values(ingredienteLotes)) {
        for (const sel of selections) {
          if (!sel.batchId || sel.quantity <= 0) continue;
          batchDeductions[sel.batchId] = (batchDeductions[sel.batchId] || 0) + sel.quantity;
        }
      }

      // Agrupar descuentos de inventario por (raw_material_id + to_state_id)
      const inventoryDeductions: Record<string, { rawMaterialId: string; stateId: string; qty: number }> = {};

      for (const [batchId, qtyUsed] of Object.entries(batchDeductions)) {
        const batch = batches.find((b) => b.id === batchId);
        if (!batch) continue;

        // Actualizar quantity_out del lote específico
        const newQtyOut = Math.max(0, batch.quantity_out - qtyUsed);
        await supabase
          .from("raw_material_batches")
          .update({ quantity_out: newQtyOut })
          .eq("id", batchId);

        // Acumular descuento de inventario
        const invKey = `${batch.raw_material_id}-${batch.to_state_id}`;
        if (!inventoryDeductions[invKey]) {
          inventoryDeductions[invKey] = {
            rawMaterialId: batch.raw_material_id,
            stateId: batch.to_state_id,
            qty: 0,
          };
        }
        inventoryDeductions[invKey].qty += qtyUsed;
      }

      // Actualizar inventario agregado (raw_material_inventory)
      const inventoryUpdateErrors: string[] = [];
      for (const { rawMaterialId, stateId, qty } of Object.values(inventoryDeductions)) {
        console.log(`Descontando inventario: material=${rawMaterialId}, state=${stateId}, qty=${qty}`);

        const { data: invData, error: invError } = await supabase
          .from("raw_material_inventory")
          .select("id, quantity, plant_id")
          .eq("raw_material_id", rawMaterialId)
          .eq("state_id", stateId)
          .eq("plant_id", selectedPlantId)
          .limit(1);

        if (invError) {
          const msg = `Error consultando inventario (mat=${rawMaterialId}, state=${stateId}): ${invError.message}`;
          console.error(msg);
          inventoryUpdateErrors.push(msg);
          continue;
        }

        if (invData && invData.length > 0) {
          const inv = invData[0];
          const newQty = Math.max(0, (inv.quantity || 0) - qty);
          console.log(`Actualizando inventario ID ${inv.id}: ${inv.quantity} - ${qty} = ${newQty}`);

          const { error: updateError } = await supabase
            .from("raw_material_inventory")
            .update({ quantity: newQty })
            .eq("id", inv.id);

          if (updateError) {
            const msg = `Error actualizando inventario ID ${inv.id}: ${updateError.message}`;
            console.error(msg);
            inventoryUpdateErrors.push(msg);
          } else {
            // Verify the update actually happened
            const { data: verifyData } = await supabase
              .from("raw_material_inventory")
              .select("quantity")
              .eq("id", inv.id)
              .single();

            if (verifyData && verifyData.quantity === newQty) {
              console.log(`✓ Inventario actualizado correctamente a ${newQty}`);
            } else {
              const msg = `Inventario no se actualizó. ID ${inv.id}: esperado=${newQty}, actual=${verifyData?.quantity || 'desconocido'}`;
              console.warn(msg);
              inventoryUpdateErrors.push(msg);
            }
          }
        } else {
          const msg = `No se encontró inventario para material=${rawMaterialId}, state=${stateId}`;
          console.warn(msg);
          inventoryUpdateErrors.push(msg);
        }
      }

      if (inventoryUpdateErrors.length > 0) {
        console.error("Errores al descontar inventario:", inventoryUpdateErrors);
      }

      // 3. Recargar datos actualizados
      await cargarLotes();
      await cargarMaterialesPrimas();
      verificarThresholds(); // verificar stock tras producción

      setSuccess("✓ Producción registrada. Stock y lotes actualizados.");
      setTimeout(() => {
        setSuccess(null);
        setMostrarAnalisisVariancia(false);
        setProductoVariancia("");
        setCantidadProducida("");
        setIngredienteLotes({});
        setVarianciaResultado(null);
      }, 2500);
    } catch (e: any) {
      setErr(e.message || "Error guardando variancia.");
      setSuccess(null);
    } finally {
      setSavingVariancia(false);
    }
  };

  // CARGAR LOTES DISPONIBLES
  const cargarLotes = async () => {
    try {
      setLoadingBatches(true);
      const { data, error } = await supabase
        .from("raw_material_batches")
        .select("id, lot_code, raw_material_id, to_state_id, quantity_out, cost_per_unit, batch_date, raw_materials(name, unit), raw_material_states!to_state_id(name)")
        .gt("quantity_out", 0)
        .eq("plant_id", selectedPlantId)
        .order("batch_date", { ascending: false });

      if (error) throw error;

      const formattedBatches = (data ?? []).map((batch: any) => ({
        id: batch.id,
        lot_code: batch.lot_code,
        raw_material_id: batch.raw_material_id,
        to_state_id: batch.to_state_id,
        state_name: batch.raw_material_states?.name || null,
        raw_material_name: batch.raw_materials?.name || "Material",
        quantity_out: parseFloat(batch.quantity_out),
        cost_per_unit: parseFloat(batch.cost_per_unit) || 0,
        unit: batch.raw_materials?.unit || "unidad",
        batch_date: batch.batch_date,
      }));

      setBatches(formattedBatches);
    } catch (e: any) {
      console.error("Error cargando lotes:", e);
      setErr("Error cargando lotes disponibles");
    } finally {
      setLoadingBatches(false);
    }
  };

  // REGISTRAR MERMA
  const registrarMerma = async () => {
    if (!batchSelect || !wasteQty) {
      setErr("Selecciona lote y cantidad de merma.");
      return;
    }

    const selectedBatch = batches.find((b) => b.id === batchSelect);
    if (!selectedBatch) {
      setErr("Lote no encontrado.");
      return;
    }

    const wasteQuantity = parseFloat(wasteQty);

    if (isNaN(wasteQuantity) || wasteQuantity <= 0) {
      setErr("Cantidad de merma debe ser mayor a 0.");
      return;
    }

    if (wasteQuantity > selectedBatch.quantity_out) {
      setErr(`No puedes descartar más de ${selectedBatch.quantity_out} ${selectedBatch.unit}.`);
      return;
    }

    setSavingWaste(true);
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;

      // Calcular nuevo costo unitario
      const costAffected = wasteQuantity * selectedBatch.cost_per_unit;
      const newQuantity = selectedBatch.quantity_out - wasteQuantity;
      const newCostPerUnit = newQuantity > 0 ? selectedBatch.cost_per_unit : 0;

      // Registrar merma en batch_merma_history
      const { error: mermaError } = await supabase
        .from("batch_merma_history")
        .insert([
          {
            batch_id: batchSelect,
            quantity_waste: wasteQuantity,
            waste_reason: wasteReason || null,
            cost_affected: costAffected,
            created_by: userId,
            plant_id: selectedPlantId,
          },
        ]);

      if (mermaError) throw mermaError;

      // Actualizar el lote (restar cantidad y mantener cost_per_unit igual)
      const { error: updateError } = await supabase
        .from("raw_material_batches")
        .update({
          quantity_out: newQuantity,
          updated_at: new Date().toISOString(),
        })
        .eq("id", batchSelect);

      if (updateError) throw updateError;

      // Actualizar inventario (raw_material_inventory)
      const { data: invData } = await supabase
        .from("raw_material_inventory")
        .select("*")
        .eq("raw_material_id", selectedBatch.raw_material_id);

      if (invData && invData[0]) {
        const currentQty = parseFloat(invData[0].quantity) || 0;
        const updatedQty = Math.max(0, currentQty - wasteQuantity);

        await supabase
          .from("raw_material_inventory")
          .update({ quantity: updatedQty, last_updated: new Date().toISOString() })
          .eq("id", invData[0].id);
      }

      // Registrar audit log
      await supabase.from("raw_material_inventory_audit_logs").insert([
        {
          raw_material_id: selectedBatch.raw_material_id,
          quantity_before: invData?.[0]?.quantity || 0,
          quantity_after: Math.max(0, (invData?.[0]?.quantity || 0) - wasteQuantity),
          reason: `Merma: ${wasteReason || "Sin especificar"}`,
          related_id: batchSelect,
        },
      ]);

      // Limpiar formulario
      setBatchSelect("");
      setWasteQty("");
      setWasteReason("");
      await cargarLotes();
      await cargarMaterialesPrimas();
      setErr(null);
      setSuccess("✓ Merma registrada exitosamente");
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) {
      setErr(e.message ?? "Error registrando merma.");
      setSuccess(null);
    } finally {
      setSavingWaste(false);
    }
  };

  // REGISTRAR ENTRADA INICIAL
  const registrarEntrada = async () => {
    if (!selectedMaterial || !selectedState || !entradaCantidad) {
      setErr("Selecciona material, estado y cantidad.");
      return;
    }

    if (!entradaCosto || entradaCosto.trim() === "") {
      setErr("El costo total es obligatorio.");
      return;
    }

    const qty = parseFloat(entradaCantidad);
    const cost = parseFloat(entradaCosto);

    if (isNaN(qty) || qty <= 0) {
      setErr("Cantidad debe ser mayor a 0.");
      return;
    }

    if (isNaN(cost) || cost <= 0) {
      setErr("Costo debe ser mayor a 0.");
      return;
    }

    // Calcular costo por unidad
    const costPerUnit = cost / qty;

    // Generar código de lote si no lo proporciona el usuario
    const materialName = materialesPrimas.find((m) => m.id === selectedMaterial)?.name || "MAT";
    const lotCode = entradaLote?.trim() ? entradaLote.trim() : generateLotCode(materialName);

    setSavingEntrada(true);
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;

      // Registrar batch
      const { data: batchData, error: batchError } = await supabase
        .from("raw_material_batches")
        .insert([
          {
            raw_material_id: selectedMaterial,
            from_state_id: null,
            to_state_id: selectedState,
            quantity_in: qty,
            quantity_out: qty,
            cost: cost,
            cost_per_unit: costPerUnit,
            plant_id: selectedPlantId,
            batch_date: new Date().toISOString().split("T")[0],
            supplier_name: entradaProveedor || null,
            lot_code: lotCode,
            observations: entradaObservaciones || null,
            created_by: userId,
          },
        ])
        .select();

      if (batchError) throw new Error(batchError.message);

      // Actualizar inventario
      const { data: invData } = await supabase
        .from("raw_material_inventory")
        .select("*")
        .eq("raw_material_id", selectedMaterial)
        .eq("state_id", selectedState);

      if (invData && invData[0]) {
        // Convertir quantity a número (Supabase retorna como string)
        const currentQty = parseFloat(invData[0].quantity) || 0;
        const newQty = currentQty + qty;

        await supabase
          .from("raw_material_inventory")
          .update({ quantity: newQty, last_updated: new Date().toISOString() })
          .eq("id", invData[0].id);
      } else {
        await supabase.from("raw_material_inventory").insert([
          {
            raw_material_id: selectedMaterial,
            state_id: selectedState,
            quantity: qty,
          },
        ]);
      }

      // Registrar audit log
      await supabase.from("raw_material_inventory_audit_logs").insert([
        {
          raw_material_id: selectedMaterial,
          state_id: selectedState,
          quantity_before: invData?.[0]?.quantity || 0,
          quantity_after: (invData?.[0]?.quantity || 0) + qty,
          reason: "Entrada inicial",
          related_id: batchData?.[0]?.id,
        },
      ]);

      setSelectedMaterial("");
      setSelectedState("");
      setEntradaCantidad("");
      setEntradaCosto("");
      setEntradaProveedor("");
      setEntradaLote("");
      setEntradaObservaciones("");
      await cargarMaterialesPrimas();
      verificarThresholds(); // verificar stock y costos tras nueva entrada
      setErr(null);
      const lotMessage = entradaLote?.trim() ? "" : ` (Lote generado: ${lotCode})`;
      setSuccess(`✓ Entrada registrada exitosamente${lotMessage}`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (e: any) {
      setErr(e.message ?? "Error registrando entrada.");
      setSuccess(null);
    } finally {
      setSavingEntrada(false);
    }
  };

  // REGISTRAR TRANSFORMACIÓN
  const registrarTransformacion = async () => {
    if (!transformMaterial || !transformFromState || !transformToState || !transformQtyIn || !transformQtyOut) {
      setErr("Completa todos los campos de transformación.");
      return;
    }

    const qtyIn = parseFloat(transformQtyIn);
    const qtyOut = parseFloat(transformQtyOut);

    if (isNaN(qtyIn) || isNaN(qtyOut) || qtyIn <= 0 || qtyOut < 0) {
      setErr("Cantidades inválidas.");
      return;
    }

    setSavingTransform(true);
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;

      // Obtener el costo del lote origen para heredarlo al lote destino
      const { data: sourceBatches } = await supabase
        .from("raw_material_batches")
        .select("cost_per_unit, quantity_out")
        .eq("raw_material_id", transformMaterial)
        .eq("to_state_id", transformFromState)
        .eq("plant_id", selectedPlantId)
        .gt("quantity_out", 0)
        .order("batch_date", { ascending: false })
        .limit(1);

      // Calcular costo heredado: misma plata, menos cantidad → mayor costo/unidad
      const sourceCostPerUnit = sourceBatches?.[0]?.cost_per_unit ?? 0;
      const totalCostFromSource = sourceCostPerUnit * qtyIn;
      const inheritedCostPerUnit = qtyOut > 0 ? totalCostFromSource / qtyOut : 0;

      // Auto-generar código de lote para el batch transformado
      const materialObj = materialesPrimas.find((m) => m.id === transformMaterial);
      const materialName = materialObj?.name ?? "TRF";
      const lotCode = generateLotCode(materialName);

      // Registrar batch de transformación
      const { data: batchData, error: batchError } = await supabase
        .from("raw_material_batches")
        .insert([
          {
            raw_material_id: transformMaterial,
            from_state_id: transformFromState,
            to_state_id: transformToState,
            quantity_in: qtyIn,
            quantity_out: qtyOut,
            cost_per_unit: inheritedCostPerUnit,
            lot_code: lotCode,
            plant_id: selectedPlantId,
            batch_date: new Date().toISOString().split("T")[0],
            observations: transformObservaciones || null,
            created_by: userId,
          },
        ])
        .select();

      if (batchError) throw new Error(batchError.message);

      // Obtener cantidad actual del estado origen
      const { data: originData } = await supabase
        .from("raw_material_inventory")
        .select("*")
        .eq("raw_material_id", transformMaterial)
        .eq("state_id", transformFromState);

      if (originData && originData[0]) {
        const newQty = (originData[0].quantity || 0) - qtyIn;
        await supabase
          .from("raw_material_inventory")
          .update({ quantity: newQty, last_updated: new Date().toISOString() })
          .eq("id", originData[0].id);

        // Audit log origen
        await supabase.from("raw_material_inventory_audit_logs").insert([
          {
            raw_material_id: transformMaterial,
            state_id: transformFromState,
            quantity_before: originData[0].quantity || 0,
            quantity_after: newQty,
            reason: "Transformación",
            related_id: batchData?.[0]?.id,
          },
        ]);
      }

      // Obtener cantidad actual del estado destino
      const { data: destData } = await supabase
        .from("raw_material_inventory")
        .select("*")
        .eq("raw_material_id", transformMaterial)
        .eq("state_id", transformToState);

      if (destData && destData[0]) {
        const newQty = (destData[0].quantity || 0) + qtyOut;
        await supabase
          .from("raw_material_inventory")
          .update({ quantity: newQty, last_updated: new Date().toISOString() })
          .eq("id", destData[0].id);

        // Audit log destino
        await supabase.from("raw_material_inventory_audit_logs").insert([
          {
            raw_material_id: transformMaterial,
            state_id: transformToState,
            quantity_before: destData[0].quantity || 0,
            quantity_after: newQty,
            reason: "Transformación",
            related_id: batchData?.[0]?.id,
          },
        ]);
      } else {
        await supabase.from("raw_material_inventory").insert([
          {
            raw_material_id: transformMaterial,
            state_id: transformToState,
            quantity: qtyOut,
          },
        ]);

        // Audit log destino (nuevo)
        await supabase.from("raw_material_inventory_audit_logs").insert([
          {
            raw_material_id: transformMaterial,
            state_id: transformToState,
            quantity_before: 0,
            quantity_after: qtyOut,
            reason: "Transformación",
            related_id: batchData?.[0]?.id,
          },
        ]);
      }

      setTransformMaterial("");
      setTransformFromState("");
      setTransformToState("");
      setTransformQtyIn("");
      setTransformQtyOut("");
      setTransformObservaciones("");
      await cargarMaterialesPrimas();
      await cargarLotes();
      verificarThresholds(); // verificar stock tras transformación
      setErr(null);
      setSuccess(`✓ Transformación registrada. Nuevo lote con ${qtyOut} ${materialObj?.unit ?? "unidades"} creado.`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (e: any) {
      setErr(e.message ?? "Error registrando transformación.");
      setSuccess(null);
    } finally {
      setSavingTransform(false);
    }
  };

  // Registrar Merma Adicional
  const registrarMermaAdicional = async () => {
    if (!transformMaterial || !transformFromState || !wasteQty) {
      setErr("Selecciona materia prima, estado y cantidad.");
      return;
    }

    const qty = parseFloat(wasteQty);
    if (isNaN(qty) || qty <= 0) {
      setErr("La cantidad debe ser mayor a 0.");
      return;
    }

    setSavingWaste(true);
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;

      // Obtener unidad de la materia prima TEMPRANO
      const materialObj = materialesPrimas.find((m) => m.id === transformMaterial);
      const unit = materialObj?.unit || "unidades";

      // Registrar batch de merma adicional
      const { data: batchData, error: batchError } = await supabase
        .from("raw_material_batches")
        .insert([
          {
            raw_material_id: transformMaterial,
            from_state_id: transformFromState,
            to_state_id: transformFromState, // Mismo estado (merma no cambia estado)
            quantity_in: qty,
            quantity_out: 0,
            batch_date: new Date().toISOString().split("T")[0],
            observations: wasteReason || null,
            created_by: userId,
          },
        ])
        .select();

      if (batchError) throw new Error(batchError.message);

      // Obtener cantidad actual
      const { data: inventoryData } = await supabase
        .from("raw_material_inventory")
        .select("*")
        .eq("raw_material_id", transformMaterial)
        .eq("state_id", transformFromState);

      if (inventoryData && inventoryData[0]) {
        const newQty = (inventoryData[0].quantity || 0) - qty;
        const { error: updateError } = await supabase
          .from("raw_material_inventory")
          .update({ quantity: newQty, last_updated: new Date().toISOString() })
          .eq("id", inventoryData[0].id);

        if (updateError) throw new Error(updateError.message);

        // Audit log
        await supabase.from("raw_material_inventory_audit_logs").insert([
          {
            raw_material_id: transformMaterial,
            state_id: transformFromState,
            quantity_before: inventoryData[0].quantity || 0,
            quantity_after: newQty,
            reason: "Merma Adicional",
            related_id: batchData?.[0]?.id,
          },
        ]);

        // Verificar si la merma es anormal (> 10%)
        const stockAnterior = inventoryData[0].quantity || 0;
        const porcentajeMerma = stockAnterior > 0 ? (qty / stockAnterior) * 100 : 0;
        
        if (porcentajeMerma > 10) {
          await crearAlerta(
            "merma_anormal",
            "red",
            `Merma anormal en ${materialObj?.name}: ${porcentajeMerma.toFixed(1)}%`,
            transformMaterial,
            "raw_material"
          );
        }
      }

      // Mensaje de éxito con unidad correcta
      setErr(null);
      alert(`✓ Merma registrada: ${qty} ${unit} descuentadas`);
      
      // Recargar datos
      await cargarMaterialesPrimas();
      
      // Limpiar formulario
      setTransformMaterial("");
      setTransformFromState("");
      setWasteQty("");
      setWasteReason("");
    } catch (e: any) {
      setErr(e.message ?? "Error registrando merma.");
      console.error("Error en merma:", e);
    } finally {
      setSavingWaste(false);
    }
  };

  // Función recursiva para descontar ingredientes anidados
  const descontarIngredientesRecursivos = async (
    productId: string,
    qtyProduce: number
  ) => {
    // Obtener los ingredientes del producto
    const { data: ingredientsData, error: ingredientsError } = await supabase
      .from("product_ingredients")
      .select("*")
      .eq("product_id", productId);

    if (ingredientsError) throw new Error(ingredientsError.message);

    // Para cada ingrediente
    for (const ingredient of ingredientsData || []) {
      const qtyNeeded = (ingredient.quantity || 0) * qtyProduce;

      if (ingredient.ingredient_type === "RAW_MATERIAL") {
        // Es materia prima - descontar directamente
        const { data: invData } = await supabase
          .from("raw_material_inventory")
          .select("*")
          .eq("raw_material_id", ingredient.ingredient_id)
          .eq("state_id", ingredient.state_id);

        if (invData && invData[0]) {
          const newQty = (invData[0].quantity || 0) - qtyNeeded;
          const { error: updateError } = await supabase
            .from("raw_material_inventory")
            .update({ quantity: newQty, last_updated: new Date().toISOString() })
            .eq("id", invData[0].id);

          if (updateError) throw new Error(updateError.message);

          // Audit
          await supabase.from("raw_material_inventory_audit_logs").insert([
            {
              raw_material_id: ingredient.ingredient_id,
              state_id: ingredient.state_id,
              quantity_before: invData[0].quantity || 0,
              quantity_after: newQty,
              reason: "Producción",
            },
          ]);

          // Verificar si stock quedó bajo (< 20% del promedio teórico)
          // Promedio teórico = 30 unidades (ajustable)
          const promedioTeorico = 30;
          const umbralBajo = (promedioTeorico * 20) / 100;
          
          if (newQty > 0 && newQty < umbralBajo) {
            const mat = materialesPrimas.find((m) => m.id === ingredient.ingredient_id);
            await crearAlerta(
              "stock_bajo",
              "yellow",
              `Stock bajo en ${mat?.name}: ${newQty} ${mat?.unit}`,
              ingredient.ingredient_id,
              "raw_material"
            );
          }
        }
      } else if (ingredient.ingredient_type === "PRODUCT") {
        // Es un producto - descontar recursivamente sus ingredientes
        await descontarIngredientesRecursivos(ingredient.ingredient_id, qtyNeeded);
      }
    }
  };

  // Registrar Producción
  const registrarProduccion = async () => {
    if (!produceProduct || !produceQty) {
      setErr("Selecciona producto y cantidad.");
      return;
    }

    const qty = parseFloat(produceQty);
    if (isNaN(qty) || qty <= 0) {
      setErr("La cantidad debe ser mayor a 0.");
      return;
    }

    setSavingProduce(true);
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;

      // Obtener la fórmula del producto
      const { data: formulaData, error: formulaError } = await supabase
        .from("products")
        .select("*")
        .eq("id", produceProduct)
        .single();

      if (formulaError) throw new Error("Producto no encontrado.");

      const formula = formulaData as ProductFormula;

      // Obtener ingredientes
      const { data: ingredientsData, error: ingredientsError } = await supabase
        .from("product_ingredients")
        .select("*")
        .eq("product_id", produceProduct);

      if (ingredientsError) throw new Error(ingredientsError.message);

      // Descontar ingredientes del inventario
      for (const ingredient of ingredientsData || []) {
        const qtyNeeded = (ingredient.quantity || 0) * qty;

        if (ingredient.ingredient_type === "RAW_MATERIAL") {
          // Descontar materia prima
          const { data: invData } = await supabase
            .from("raw_material_inventory")
            .select("*")
            .eq("raw_material_id", ingredient.ingredient_id)
            .eq("state_id", ingredient.state_id);

          if (invData && invData[0]) {
            const newQty = (invData[0].quantity || 0) - qtyNeeded;
            const { error: updateError } = await supabase
              .from("raw_material_inventory")
              .update({ quantity: newQty, last_updated: new Date().toISOString() })
              .eq("id", invData[0].id);

            if (updateError) throw new Error(updateError.message);

            // Audit
            await supabase.from("raw_material_inventory_audit_logs").insert([
              {
                raw_material_id: ingredient.ingredient_id,
                state_id: ingredient.state_id,
                quantity_before: invData[0].quantity || 0,
                quantity_after: newQty,
                reason: "Producción",
              },
            ]);
          }
        } else if (ingredient.ingredient_type === "PRODUCT") {
          // Es un producto - descontar recursivamente sus ingredientes
          await descontarIngredientesRecursivos(ingredient.ingredient_id, qtyNeeded);
        }
      }

      // Mensaje de éxito
      setErr(null);
      alert(`✓ Producción registrada: ${qty} unidades fabricadas`);
      
      // Recargar datos para refrescar
      await cargarMaterialesPrimas();
      
      setProduceProduct("");
      setProduceQty("");
      setProduceObservations("");
    } catch (e: any) {
      setErr(e.message ?? "Error registrando producción.");
      console.error("Error en producción:", e);
    } finally {
      setSavingProduce(false);
    }
  };

  // ============================================================================
  // FUNCIONES PARA FÓRMULAS
  // ============================================================================

  // Cargar todas las fórmulas
  const cargarFormulas = async () => {
    try {
      const { data: productsData, error } = await supabase
        .from("products")
        .select("*")
        .order("name");

      if (error) throw new Error(error.message);

      // Para cada producto, cargar sus ingredientes
      const formulasData = await Promise.all(
        (productsData ?? []).map(async (prod) => {
          const { data: ingredients } = await supabase
            .from("product_ingredients")
            .select("*")
            .eq("product_id", prod.id);

          // Enriquecer ingredientes con nombres y estado
          const enriched = await Promise.all(
            (ingredients ?? []).map(async (ing) => {
              let name = "";
              let stateName = "";
              
              if (ing.ingredient_type === "RAW_MATERIAL") {
                const { data: mat } = await supabase
                  .from("raw_materials")
                  .select("name")
                  .eq("id", ing.ingredient_id)
                  .single();
                name = mat?.name ?? "Desconocido";

                // Si tiene state_id, obtener el nombre del estado
                if (ing.state_id) {
                  const { data: state } = await supabase
                    .from("raw_material_states")
                    .select("name")
                    .eq("id", ing.state_id)
                    .single();
                  stateName = state?.name ?? "";
                }
              } else {
                const { data: prodIng } = await supabase
                  .from("products")
                  .select("name")
                  .eq("id", ing.ingredient_id)
                  .single();
                name = prodIng?.name ?? "Desconocido";
              }
              return { 
                ...ing, 
                ingredient_name: name,
                ingredient_state_id: ing.state_id,
                ingredient_state_name: stateName,
              };
            })
          );

          return {
            ...prod,
            ingredients: enriched,
          };
        })
      );

      setFormulas(formulasData);
      // También guardar lista simple de productos para dropdown
      setProducts((productsData ?? []).map(p => ({ id: p.id, name: p.name })));
    } catch (e: any) {
      setErr(e.message ?? "Error cargando fórmulas.");
    }
  };

  // Cargar datos para reportes
  const cargarReportes = async () => {
    setLoadingReportes(true);
    try {
      // Primero asegurarse que formulas está cargado
      if (formulas.length === 0) {
        await cargarFormulas();
      }

      // Cargar merma
      const { data: mermaData } = await supabase
        .from("raw_material_inventory_audit_logs")
        .select(`
          id,
          created_at,
          quantity_before,
          quantity_after,
          reason,
          raw_material_id,
          state_id
        `)
        .eq("reason", "Merma Adicional")
        .order("created_at", { ascending: false });

      if (mermaData) {
        // Enriquecer con nombres
        const enrichedMerma = await Promise.all(
          (mermaData || []).map(async (item: any) => {
            const mat = materialesPrimas.find((m) => m.id === item.raw_material_id);
            const state = statesByMaterial[item.raw_material_id]?.find(
              (s: any) => s.id === item.state_id
            );
            return {
              ...item,
              material_name: mat?.name ?? "Desconocido",
              state_name: state?.name ?? "Desconocido",
              unit: mat?.unit ?? "u",
              cantidad_merma: item.quantity_before - item.quantity_after,
            };
          })
        );
        setDataMerma(enrichedMerma);
      }

      // Cargar producción - obtener productos actualizados
      const { data: productsData } = await supabase
        .from("products")
        .select("id, name");

      // Obtener ingredientes para cada producto
      if (productsData) {
        const prodMap: Record<string, any> = {};
        for (const prod of productsData) {
          const { data: ingredients } = await supabase
            .from("product_ingredients")
            .select("*")
            .eq("product_id", prod.id);

          prodMap[prod.id] = {
            product_id: prod.id,
            product_name: prod.name,
            total_ingredientes: ingredients?.length || 0,
          };
        }
        setDataProduccion(Object.values(prodMap));
      }

      // Cargar variancia
      const { data: varianciaData, error: varianciaError } = await supabase
        .from("production_variance_log")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);

      if (!varianciaError && varianciaData) {
        // Enriquecer con nombres de productos
        const enrichedVariancia = await Promise.all(
          (varianciaData || []).map(async (item: any) => {
            const prod = formulas.find((f) => f.id === item.product_id);
            return {
              ...item,
              product_name: prod?.name ?? "Desconocido",
              fecha: new Date(item.created_at).toLocaleDateString(),
              hora: new Date(item.created_at).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              }),
            };
          })
        );
        setDataVariancia(enrichedVariancia);
      } else {
        setDataVariancia([]);
      }
    } catch (e: any) {
      console.error("Error cargando reportes:", e);
    } finally {
      setLoadingReportes(false);
    }
  };

  // CARGAR HISTORIAL DE COSTOS (Opción D)
  const cargarHistorial = async () => {
    setLoadingHistorialCostos(true);
    try {
      if (formulas.length === 0) await cargarFormulas();

      const { data, error } = await supabase
        .from("production_variance_log")
        .select("*")
        .eq("plant_id", selectedPlantId)
        .order("variance_date", { ascending: false })
        .limit(500);

      if (error) throw error;

      const enriched = (data ?? []).map((item: any) => {
        const prod = formulas.find((f) => f.id === item.product_id);
        const costPorUnidad = item.cost_per_unit ??
          (item.quantity_produced > 0 ? item.cost_estimated / item.quantity_produced : 0);
        return {
          ...item,
          product_name: prod?.name ?? "Desconocido",
          cost_per_unit: costPorUnidad,
          fecha_display: new Date(item.variance_date ?? item.created_at).toLocaleDateString("es-CO"),
        };
      });

      setHistorialData(enriched);
    } catch (e: any) {
      console.error("Error cargando historial:", e);
    } finally {
      setLoadingHistorialCostos(false);
    }
  };

  // CARGAR UMBRALES PERSONALIZADOS
  const cargarThresholds = async () => {
    setLoadingThresholds(true);
    try {
      const { data, error } = await supabase
        .from("material_alert_thresholds")
        .select("*, raw_materials(name, unit), raw_material_states!state_id(name)")
        .eq("plant_id", selectedPlantId)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) {
        // Tabla puede no existir aún
        if (error.code === "42P01") {
          setThresholds([]);
          return;
        }
        throw error;
      }

      setThresholds((data ?? []).map((t: any) => ({
        ...t,
        material_name: t.raw_materials?.name ?? "Desconocido",
        material_unit: t.raw_materials?.unit ?? "u",
        state_name: t.raw_material_states?.name ?? null,
      })));
    } catch (e: any) {
      console.error("Error cargando umbrales:", e);
    } finally {
      setLoadingThresholds(false);
    }
  };

  // GUARDAR UMBRAL
  const guardarThreshold = async () => {
    if (!thresholdMaterial) {
      setErr("Selecciona una materia prima.");
      return;
    }
    if (!thresholdMinStock && !thresholdMaxCost && !thresholdMaxWaste) {
      setErr("Define al menos un umbral (stock mínimo, costo máximo o merma máxima).");
      return;
    }

    setSavingThreshold(true);
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;

      const payload: any = {
        plant_id: selectedPlantId,
        raw_material_id: thresholdMaterial,
        state_id: thresholdState || null,
        is_active: true,
        created_by: userId,
      };
      if (thresholdMinStock) payload.min_stock = parseFloat(thresholdMinStock);
      if (thresholdMaxCost) payload.max_cost_per_unit = parseFloat(thresholdMaxCost);
      if (thresholdMaxWaste) payload.max_waste_pct = parseFloat(thresholdMaxWaste);

      const { error } = await supabase
        .from("material_alert_thresholds")
        .upsert([payload], { onConflict: "plant_id,raw_material_id,state_id" });

      if (error) throw error;

      setThresholdMaterial("");
      setThresholdState("");
      setThresholdMinStock("");
      setThresholdMaxCost("");
      setThresholdMaxWaste("");
      setShowAddThreshold(false);
      await cargarThresholds();
      setErr(null);
    } catch (e: any) {
      setErr(e.message ?? "Error guardando umbral.");
    } finally {
      setSavingThreshold(false);
    }
  };

  // ELIMINAR UMBRAL
  const eliminarThreshold = async (id: string) => {
    try {
      await supabase
        .from("material_alert_thresholds")
        .update({ is_active: false })
        .eq("id", id);
      await cargarThresholds();
    } catch (e: any) {
      console.error("Error eliminando umbral:", e);
    }
  };

  // VERIFICAR UMBRALES CONTRA INVENTARIO ACTUAL
  const verificarThresholds = async () => {
    try {
      const { data: thresh } = await supabase
        .from("material_alert_thresholds")
        .select("*, raw_materials(name, unit)")
        .eq("plant_id", selectedPlantId)
        .eq("is_active", true);

      if (!thresh || thresh.length === 0) return;

      for (const t of thresh) {
        const materialName = t.raw_materials?.name ?? "Material";
        const unit = t.raw_materials?.unit ?? "u";

        // ── 1. Verificar stock mínimo ──
        if (t.min_stock != null) {
          const invQuery = supabase
            .from("raw_material_inventory")
            .select("quantity")
            .eq("raw_material_id", t.raw_material_id);

          if (t.state_id) invQuery.eq("state_id", t.state_id);

          const { data: inv } = await invQuery;
          const totalStock = (inv ?? []).reduce((s: number, r: any) => s + (r.quantity || 0), 0);

          if (totalStock < t.min_stock) {
            await crearAlerta(
              "stock_bajo",
              "red",
              `Stock bajo: ${materialName}${t.state_id ? "" : ""} tiene ${totalStock.toFixed(2)} ${unit} — mínimo configurado: ${t.min_stock} ${unit}`,
              t.raw_material_id,
              "raw_material"
            );
          }
        }

        // ── 2. Verificar costo máximo por unidad ──
        if (t.max_cost_per_unit != null) {
          const batchQuery = supabase
            .from("raw_material_batches")
            .select("cost_per_unit, lot_code")
            .eq("raw_material_id", t.raw_material_id)
            .eq("plant_id", selectedPlantId)
            .gt("quantity_out", 0)
            .order("batch_date", { ascending: false })
            .limit(5);

          if (t.state_id) batchQuery.eq("to_state_id", t.state_id);

          const { data: lotes } = await batchQuery;
          const loteCaro = (lotes ?? []).find((b: any) => (b.cost_per_unit ?? 0) > t.max_cost_per_unit);

          if (loteCaro) {
            await crearAlerta(
              "umbral_costo",
              "yellow",
              `Costo alto: ${materialName} — lote ${loteCaro.lot_code} tiene costo $${(loteCaro.cost_per_unit ?? 0).toLocaleString("es-CO")}/${unit}, máximo configurado: $${t.max_cost_per_unit.toLocaleString("es-CO")}/${unit}`,
              t.raw_material_id,
              "raw_material"
            );
          }
        }

        // ── 3. Verificar merma máxima (%) ──
        if (t.max_waste_pct != null) {
          // Revisar los últimos lotes de transformación (tienen from_state_id → to_state_id)
          const { data: transformaciones } = await supabase
            .from("raw_material_batches")
            .select("quantity_in, quantity_out, lot_code, batch_date")
            .eq("raw_material_id", t.raw_material_id)
            .eq("plant_id", selectedPlantId)
            .not("from_state_id", "is", null)         // solo transformaciones
            .gt("quantity_in", 0)
            .order("batch_date", { ascending: false })
            .limit(5);

          for (const tr of transformaciones ?? []) {
            const merma = tr.quantity_in > 0
              ? ((tr.quantity_in - tr.quantity_out) / tr.quantity_in) * 100
              : 0;

            if (merma > t.max_waste_pct) {
              await crearAlerta(
                "merma_anormal",
                "yellow",
                `Merma alta: ${materialName} — lote ${tr.lot_code} tuvo ${merma.toFixed(1)}% de merma (${(tr.quantity_in - tr.quantity_out).toFixed(2)} ${unit} perdidos), máximo configurado: ${t.max_waste_pct}%`,
                t.raw_material_id,
                "raw_material"
              );
              break; // una alerta por material es suficiente
            }
          }
        }
      }
    } catch (e: any) {
      console.error("Error verificando umbrales:", e);
    }
  };

  // Crear alerta
  const crearAlerta = async (
    type: string,
    severity: "red" | "yellow",
    message: string,
    relatedId: string,
    relatedType: "raw_material" | "product"
  ) => {
    try {
      // Verificar si ya existe una alerta similar del mismo día
      const hoy = new Date().toISOString().split("T")[0];
      const { data: existentes, error: checkError } = await supabase
        .from("alerts")
        .select("id")
        .eq("type", type)
        .eq("related_id", relatedId)
        .gte("created_at", `${hoy}T00:00:00`)
        .lte("created_at", `${hoy}T23:59:59`);

      if (checkError) {
        // Si tabla no existe, ignorar
        console.warn("Tabla alerts no existe. Por favor crea la tabla con SQL.");
        return;
      }

      if (existentes && existentes.length > 0) {
        return; // No crear duplicada
      }

      const { error: insertError } = await supabase.from("alerts").insert([
        {
          type,
          severity,
          message,
          related_id: relatedId,
          related_type: relatedType,
          is_read: false,
        },
      ]);

      if (insertError) {
        console.warn("Error creando alerta:", insertError);
        return;
      }

      // Recargar alertas
      await obtenerAlertas();
    } catch (e: any) {
      console.error("Error en crearAlerta:", e);
    }
  };

  // Obtener alertas
  const obtenerAlertas = async () => {
    setLoadingAlertas(true);
    try {
      const { data: alertasData, error } = await supabase
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) {
        // Si la tabla no existe, ignorar error pero avisar en consola
        console.warn("Tabla de alertas no existe aún. Crea la tabla con SQL primero.");
        setAlertas([]);
        setAlertasNoLeidas(0);
        return;
      }

      setAlertas(alertasData || []);

      // Contar no leídas
      const noLeidas = (alertasData || []).filter((a: any) => !a.is_read).length;
      setAlertasNoLeidas(noLeidas);
    } catch (e: any) {
      console.error("Error obteniendo alertas:", e);
      setAlertas([]);
      setAlertasNoLeidas(0);
    } finally {
      setLoadingAlertas(false);
    }
  };

  // Marcar alerta como leída
  const marcarAlertaLeida = async (alertId: string) => {
    try {
      const { error } = await supabase
        .from("alerts")
        .update({ is_read: true })
        .eq("id", alertId);

      if (error) {
        console.warn("Error marcando alerta leída:", error);
        return;
      }

      await obtenerAlertas();
    } catch (e: any) {
      console.error("Error marcando alerta leída:", e);
    }
  };

  // Eliminar alerta
  const eliminarAlerta = async (alertId: string) => {
    try {
      const { error } = await supabase.from("alerts").delete().eq("id", alertId);

      if (error) {
        console.warn("Error eliminando alerta:", error);
        return;
      }

      await obtenerAlertas();
    } catch (e: any) {
      console.error("Error eliminando alerta:", e);
    }
  };

  // Obtener historial de movimientos de una materia prima
  const obtenerHistorialMateria = async (materialId: string) => {
    setLoadingHistorial(true);
    try {
      const { data: historialData } = await supabase
        .from("raw_material_inventory_audit_logs")
        .select("*")
        .eq("raw_material_id", materialId)
        .order("created_at", { ascending: false })
        .limit(50);

      setHistorialMateria(historialData || []);
      setMostrarHistorialMateria(true);
    } catch (e: any) {
      console.error("Error obteniendo historial materia:", e);
    } finally {
      setLoadingHistorial(false);
    }
  };

  // Obtener historial de cambios de una fórmula
  const obtenerHistorialFormula = async (productId: string) => {
    setLoadingHistorial(true);
    try {
      const { data: historialData, error } = await supabase
        .from("product_changes_log")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) {
        console.warn("Tabla product_changes_log no existe aún");
        setHistorialFormula([]);
        return;
      }

      setHistorialFormula(historialData || []);
      setMostrarHistorialFormula(true);
    } catch (e: any) {
      console.error("Error obteniendo historial fórmula:", e);
    } finally {
      setLoadingHistorial(false);
    }
  };

  // Registrar cambio en fórmula
  const registrarCambioFormula = async (
    productId: string,
    changeType: string,
    changeDetail: string
  ) => {
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;

      const { error } = await supabase.from("product_changes_log").insert([
        {
          product_id: productId,
          change_type: changeType,
          change_detail: changeDetail,
          created_by: userId,
        },
      ]);

      if (error) {
        console.warn("Error registrando cambio de fórmula:", error);
        // No lanzar error, la tabla podría no existir aún
      }
    } catch (e: any) {
      console.error("Error en registrarCambioFormula:", e);
    }
  };

  // Componente Tooltip
  const Tooltip = ({ text }: { text: string }) => (
    <span
      className="inline-flex items-center justify-center w-5 h-5 ml-1 text-xs font-bold text-white bg-blue-500 rounded-full cursor-help hover:bg-blue-600"
      title={text}
    >
      i
    </span>
  );

  // Construir árbol jerárquico de ingredientes
  const construirArbolIngredientes = (
    productId: string,
    cantidadProducto: number = 1,
    nivel: number = 0,
    visitados = new Set<string>()
  ): React.ReactNode[] => {
    if (visitados.has(productId)) return [];
    visitados.add(productId);

    const formula = formulas.find((f) => f.id === productId);
    if (!formula) return [];

    const elementos: React.ReactNode[] = [];
    const indent = nivel * 20;

    for (const ing of formula.ingredients) {
      const cantidadNecesaria = (ing.quantity || 0) * cantidadProducto;

      if (ing.ingredient_type === "RAW_MATERIAL") {
        const realUsed = ingredientesReales[ing.ingredient_id]
          ? parseFloat(ingredientesReales[ing.ingredient_id])
          : cantidadNecesaria;
        const variancia = realUsed - cantidadNecesaria;
        const varianciaColor = variancia > 0 ? "text-red-600" : variancia < 0 ? "text-green-600" : "text-gray-600";

        elementos.push(
          <div key={`${ing.ingredient_id}-${nivel}`} style={{ marginLeft: `${indent}px` }} className="py-2 text-sm border-b border-gray-200">
            <div className="flex justify-between items-start gap-2">
              <div className="flex-1">
                <div className="font-medium text-gray-900">{ing.ingredient_name}</div>
                <div className="text-xs text-gray-600">
                  Planeado: {cantidadNecesaria.toFixed(2)} {ing.unit}
                </div>
              </div>
              <div className={`text-xs font-semibold ${varianciaColor}`}>
                Usado: {realUsed.toFixed(2)} {ing.unit}
                {variancia !== 0 && ` (${variancia > 0 ? '+' : ''}${variancia.toFixed(2)})`}
              </div>
            </div>
          </div>
        );
      } else {
        const subFormula = formulas.find((f) => f.id === ing.ingredient_id);
        elementos.push(
          <div key={`${ing.ingredient_id}-${nivel}`} style={{ marginLeft: `${indent}px` }} className="py-2">
            <div className="font-semibold text-gray-900 bg-gray-100 px-2 py-1 rounded flex items-center gap-2">
              📦 {subFormula?.name || ing.ingredient_name} (x{cantidadNecesaria.toFixed(2)})
            </div>
            {construirArbolIngredientes(ing.ingredient_id, cantidadNecesaria, nivel + 1, new Set(visitados))}
          </div>
        );
      }
    }

    return elementos;
  };

  // Calcular máximo de unidades producibles (recursivo para productos anidados)
  const calcularMaximoProducible = (productId: string, visitados = new Set<string>()): number => {
    if (visitados.has(productId)) return 0;
    visitados.add(productId);

    const formula = formulas.find((f) => f.id === productId);
    if (!formula || formula.ingredients.length === 0) return Infinity;

    let maximos: number[] = [];

    for (const ing of formula.ingredients) {
      if (ing.ingredient_type === "RAW_MATERIAL") {
        const stock = (inventoryByMaterial[ing.ingredient_id] || []).find(
          (i: any) => i.state_id === ing.ingredient_state_id
        )?.quantity || 0;
        maximos.push(Math.floor(stock / (ing.quantity || 1)));
      } else {
        const subMaximo = calcularMaximoProducible(ing.ingredient_id, visitados);
        maximos.push(Math.floor(subMaximo / (ing.quantity || 1)));
      }
    }

    return maximos.length > 0 ? Math.min(...maximos) : 0;
  };

  // Calcular variancia de producción
  const calcularVariancia = (productId: string, cantidadReal: number) => {
    const formula = formulas.find((f) => f.id === productId);
    if (!formula) return;

    // Calcular ingredientes planeados vs lo que se usaría teóricamente
    const ingredientsVariance: Record<string, any> = {};
    let totalVariancia = 0;
    let totalPlaneado = 0;

    for (const ing of formula.ingredients) {
      const cantidadNecesaria = ing.quantity || 0;
      const cantidadPlaneada = cantidadNecesaria * cantidadReal;

      ingredientsVariance[ing.ingredient_id] = {
        name: ing.ingredient_name,
        planned: cantidadPlaneada,
        unit: ing.unit,
      };

      totalPlaneado += cantidadPlaneada;
    }

    // Calcular máximo que se puede producir basado en stock
    const quantityTeoricamente = calcularMaximoProducible(productId);

    // La variancia es: (real - teórico máximo) / teórico máximo * 100
    // Si real > teórico máximo = variancia positiva (desperdicio)
    // Si real < teórico máximo = variancia negativa (ahorro)
    const varianciaQty = cantidadReal - quantityTeoricamente;
    const varianciaPercentaje =
      quantityTeoricamente > 0
        ? (varianciaQty / quantityTeoricamente) * 100
        : 0;

    setTeoricoAnalisis(quantityTeoricamente);
    setVarianciaCalculada({
      teórico: quantityTeoricamente,
      real: cantidadReal,
      cantidad_variancia: varianciaQty,
      porcentaje_variancia: varianciaPercentaje.toFixed(2),
      ingredientes: ingredientsVariance,
    });
  };

  // Deducir ingredientes del stock cuando se registra variancia
  const deductarIngredientes = async (
    ingredientsList: any[],
    realAmounts: Record<string, number>,
    userId: string
  ) => {
    for (const ing of ingredientsList) {
      const realUsed = realAmounts[ing.ingredient_id] || 0;

      if (ing.ingredient_type === "RAW_MATERIAL") {
        const inventoryRecords = (inventoryByMaterial[ing.ingredient_id] || []).filter(
          (i: any) => i.state_id === ing.ingredient_state_id
        );

        if (inventoryRecords.length > 0) {
          const inv = inventoryRecords[0];
          const newQuantity = (inv.quantity || 0) - realUsed;

          const { error } = await supabase
            .from("raw_material_inventory")
            .update({
              quantity: Math.max(0, newQuantity),
            })
            .eq("id", inv.id);

          if (error) throw new Error(`Error deducting ${ing.ingredient_name}: ${error.message}`);
        }
      } else if (ing.ingredient_type === "PRODUCT") {
        const subFormula = formulas.find((f) => f.id === ing.ingredient_id);
        if (subFormula) {
          for (const subIng of subFormula.ingredients) {
            const subRealAmounts: Record<string, number> = {};
            subRealAmounts[subIng.ingredient_id] = (subIng.quantity || 0) * realUsed;
            await deductarIngredientes([subIng], subRealAmounts, userId);
          }
        }
      }
    }
  };

  // Registrar variancia
  const registrarVariancia = async () => {
    if (!productoAnalisis || !realAnalisis || !varianciaCalculada) {
      setErr("Completa todos los campos");
      return;
    }

    const cantidadReal = parseInt(realAnalisis);
    if (isNaN(cantidadReal) || cantidadReal <= 0) {
      setErr("Cantidad real debe ser mayor a 0");
      return;
    }

    setSavingVariancia(true);
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id || "";

      // Calcular variancia de ingredientes basado en input del usuario
      const ingredientesVarianceDetallado: Record<string, any> = {};
      const formula = formulas.find((f) => f.id === productoAnalisis);

      for (const ing of formula?.ingredients || []) {
        const realUsed = parseFloat(ingredientesReales[ing.ingredient_id] || "0");
        const planned = (ing.quantity || 0) * cantidadReal;

        ingredientesVarianceDetallado[ing.ingredient_id] = {
          name: ing.ingredient_name,
          planned,
          real: realUsed,
          variance: realUsed - planned,
          variance_percentage:
            planned > 0 ? (((realUsed - planned) / planned) * 100).toFixed(2) : 0,
          unit: ing.unit,
        };
      }

      const { error } = await supabase.from("production_variance_log").insert([
        {
          product_id: productoAnalisis,
          quantity_planned: varianciaCalculada.teórico,
          quantity_real: cantidadReal,
          variance_quantity: cantidadReal - varianciaCalculada.teórico,
          variance_percentage: parseFloat(varianciaCalculada.porcentaje_variancia),
          ingredients_variance: ingredientesVarianceDetallado,
          created_by: userId,
        },
      ]);

      if (error) throw new Error(error.message);

      // Deduct real ingredient amounts from inventory
      const realAmountsNumeric: Record<string, number> = {};
      for (const [id, value] of Object.entries(ingredientesReales)) {
        realAmountsNumeric[id] = parseFloat(value as string);
      }
      await deductarIngredientes(formula?.ingredients || [], realAmountsNumeric, userId);

      setErr(null);
      alert(`✓ Variancia registrada y stock actualizado`);

      // Limpiar y recargar
      setMostrarAnalisisVariancia(false);
      setProductoAnalisis("");
      setRealAnalisis("");
      setIngredientesReales({});
      setVarianciaCalculada(null);
      cargarMaterialesPrimas();
    } catch (e: any) {
      setErr(e.message ?? "Error registrando variancia");
    } finally {
      setSavingVariancia(false);
    }
  };
  const crearFormula = async () => {
    if (!newFormulaName.trim()) {
      setErr("El nombre del producto es requerido.");
      return;
    }

    setSavingNewFormula(true);
    try {
      const { data, error } = await supabase
        .from("products")
        .insert([
          {
            name: newFormulaName.trim(),
            unit: newFormulaUnit,
          },
        ])
        .select();

      if (error) throw new Error(error.message);

      setFormulas([
        ...formulas,
        {
          id: data[0].id,
          name: data[0].name,
          unit: data[0].unit,
          description: data[0].description,
          ingredients: [],
        },
      ]);

      await registrarCambioFormula(
        data[0].id,
        "created",
        `Fórmula creada: ${newFormulaName.trim()}`
      );

      setNewFormulaName("");
      setNewFormulaUnit("u");
      setNewFormulaDesc("");
      setShowCreateFormula(false);
      setErr(null);
    } catch (e: any) {
      setErr(e.message ?? "Error creando fórmula.");
    } finally {
      setSavingNewFormula(false);
    }
  };

  // Agregar ingrediente
  const agregarIngrediente = async () => {
    if (!selectedFormula || !selectedIngredient || !ingredientQty) {
      setErr("Selecciona ingrediente y cantidad.");
      return;
    }

    // Si es materia prima, validar que haya estado seleccionado
    if (ingredientType === "RAW_MATERIAL" && !selectedMaterialState) {
      setErr("Selecciona el estado de la materia prima.");
      return;
    }

    // Validar que no sea ingrediente duplicado (considerando el estado)
    const ingredienteDuplicado = selectedFormula.ingredients.some(
      (ing) => 
        ing.ingredient_id === selectedIngredient && 
        ing.ingredient_type === ingredientType &&
        ing.ingredient_state_id === selectedMaterialState
    );

    if (ingredienteDuplicado) {
      setErr("Este ingrediente en este estado ya está en la fórmula. Elimínalo primero si quieres agregarlo de nuevo.");
      return;
    }

    const qty = parseFloat(ingredientQty);
    if (isNaN(qty) || qty <= 0) {
      setErr("Cantidad debe ser mayor a 0.");
      return;
    }

    setSavingIngredient(true);
    try {
      let ingredientUnit = "";
      if (ingredientType === "RAW_MATERIAL") {
        const mat = materialesPrimas.find((m) => m.id === selectedIngredient);
        ingredientUnit = mat?.unit ?? "u";
      } else {
        const prod = formulas.find((f) => f.id === selectedIngredient);
        ingredientUnit = prod?.unit ?? "u";
      }

      const { data, error } = await supabase
        .from("product_ingredients")
        .insert([
          {
            product_id: selectedFormula.id,
            ingredient_id: selectedIngredient,
            ingredient_type: ingredientType,
            quantity: qty,
            unit: ingredientUnit,
            state_id: ingredientType === "RAW_MATERIAL" ? selectedMaterialState : null,
          },
        ])
        .select();

      if (error) throw new Error(error.message);

      let ingredientName = "";
      let ingredientStateName = "";
      
      if (ingredientType === "RAW_MATERIAL") {
        const mat = materialesPrimas.find((m) => m.id === selectedIngredient);
        ingredientName = mat?.name ?? "Desconocido";
        
        // Obtener nombre del estado
        const state = statesByMaterial[selectedIngredient]?.find((s) => s.id === selectedMaterialState);
        ingredientStateName = state?.name ?? "";
      } else {
        const prod = formulas.find((f) => f.id === selectedIngredient);
        ingredientName = prod?.name ?? "Desconocido";
      }

      const updatedFormula = {
        ...selectedFormula,
        ingredients: [
          ...selectedFormula.ingredients,
          {
            ...data[0],
            ingredient_name: ingredientName,
            ingredient_state_id: selectedMaterialState,
            ingredient_state_name: ingredientStateName,
          },
        ],
      };

      setSelectedFormula(updatedFormula);
      setFormulas(
        formulas.map((f) => (f.id === selectedFormula.id ? updatedFormula : f))
      );

      setIngredientType("RAW_MATERIAL");
      setSelectedIngredient("");
      setSelectedMaterialState("");
      setIngredientQty("");
      setShowAddIngredient(false);
      
      // Registrar en historial
      await registrarCambioFormula(
        selectedFormula.id,
        "ingredient_added",
        `Ingrediente agregado: ${ingredientName} (${qty} ${ingredientUnit})`
      );
      
      await cargarFormulas();
      setErr(null);
    } catch (e: any) {
      setErr(e.message ?? "Error agregando ingrediente.");
    } finally {
      setSavingIngredient(false);
    }
  };

  // Eliminar ingrediente
  const eliminarIngrediente = async (ingredientId: string) => {
    if (!selectedFormula || !confirm("¿Eliminar este ingrediente?")) return;

    try {
      // Obtener nombre del ingrediente antes de eliminar
      const ingredAEliminar = selectedFormula.ingredients.find(
        (i) => i.id === ingredientId
      );

      const { error } = await supabase
        .from("product_ingredients")
        .delete()
        .eq("id", ingredientId);

      if (error) throw new Error(error.message);

      const updatedFormula = {
        ...selectedFormula,
        ingredients: selectedFormula.ingredients.filter((i) => i.id !== ingredientId),
      };

      setSelectedFormula(updatedFormula);
      setFormulas(
        formulas.map((f) => (f.id === selectedFormula.id ? updatedFormula : f))
      );

      // Registrar en historial
      await registrarCambioFormula(
        selectedFormula.id,
        "ingredient_removed",
        `Ingrediente eliminado: ${ingredAEliminar?.ingredient_name}`
      );

      setErr(null);
    } catch (e: any) {
      setErr(e.message ?? "Error eliminando ingrediente.");
    }
  };

  // Eliminar fórmula
  const eliminarFormula = async (id: string) => {
    if (!confirm("¿Eliminar esta fórmula?")) return;

    try {
      const { error } = await supabase
        .from("products")
        .delete()
        .eq("id", id);

      if (error) throw new Error(error.message);

      setFormulas(formulas.filter((f) => f.id !== id));
      setSelectedFormula(null);
      setErr(null);
    } catch (e: any) {
      setErr(e.message ?? "Error eliminando fórmula.");
    }
  };

  // Editar cantidad de ingrediente
  const editarCantidadIngrediente = async () => {
    if (!selectedFormula || !editingIngredientId || !editingIngredientQty) {
      setErr("Completa los campos.");
      return;
    }

    const newQty = parseFloat(editingIngredientQty);
    if (isNaN(newQty) || newQty <= 0) {
      setErr("Cantidad debe ser mayor a 0.");
      return;
    }

    setSavingEditIngredient(true);
    try {
      // Obtener datos del ingrediente antes de actualizar
      const ingredActual = selectedFormula.ingredients.find(
        (i) => i.id === editingIngredientId
      );

      const { error } = await supabase
        .from("product_ingredients")
        .update({ quantity: newQty })
        .eq("id", editingIngredientId);

      if (error) throw new Error(error.message);

      // Actualizar estado local
      const updatedFormula = {
        ...selectedFormula,
        ingredients: selectedFormula.ingredients.map((ing) =>
          ing.id === editingIngredientId
            ? { ...ing, quantity: newQty }
            : ing
        ),
      };

      setSelectedFormula(updatedFormula);
      setFormulas(
        formulas.map((f) => (f.id === selectedFormula.id ? updatedFormula : f))
      );

      // Registrar en historial
      await registrarCambioFormula(
        selectedFormula.id,
        "ingredient_modified",
        `${ingredActual?.ingredient_name}: ${ingredActual?.quantity} ${ingredActual?.unit} → ${newQty} ${ingredActual?.unit}`
      );

      setErr(null);
      setShowEditIngredient(false);
      setEditingIngredientId("");
      setEditingIngredientQty("");
      alert(`✓ Cantidad actualizada`);
    } catch (e: any) {
      setErr(e.message ?? "Error editando cantidad.");
    } finally {
      setSavingEditIngredient(false);
    }
  };

  // Duplicar producto
  const duplicarProducto = async () => {
    if (!duplicatingProductName.trim()) {
      setErr("El nombre del nuevo producto es requerido.");
      return;
    }

    setSavingDuplicate(true);
    try {
      const session = await supabase.auth.getSession();
      const userId = session.data.session?.user.id;

      // Obtener producto original
      const productoOriginal = formulas.find((f) => f.id === duplicatingProductId);
      if (!productoOriginal) throw new Error("Producto original no encontrado.");

      // Crear nuevo producto
      const { data: newProductData, error: createError } = await supabase
        .from("products")
        .insert([
          {
            name: duplicatingProductName,
            unit: productoOriginal.unit,
          },
        ])
        .select();

      if (createError) throw new Error(createError.message);

      const newProductId = newProductData[0].id;

      // Copiar todos los ingredientes
      const { data: ingredientesOriginales } = await supabase
        .from("product_ingredients")
        .select("*")
        .eq("product_id", duplicatingProductId);

      if (ingredientesOriginales && ingredientesOriginales.length > 0) {
        const ingredientesCopia = ingredientesOriginales.map((ing) => ({
          product_id: newProductId,
          ingredient_id: ing.ingredient_id,
          ingredient_type: ing.ingredient_type,
          quantity: ing.quantity,
          unit: ing.unit,
          state_id: ing.state_id,
        }));

        const { error: ingError } = await supabase
          .from("product_ingredients")
          .insert(ingredientesCopia);

        if (ingError) throw new Error(ingError.message);
      }

      // Recargar fórmulas
      await cargarFormulas();

      setErr(null);
      setShowDuplicateModal(false);
      setDuplicatingProductId("");
      setDuplicatingProductName("");
      alert(`✓ Producto duplicado: "${duplicatingProductName}"`);
    } catch (e: any) {
      setErr(e.message ?? "Error duplicando producto.");
    } finally {
      setSavingDuplicate(false);
    }
  };

  // ============================================================================
  // FUNCIÓN DE ANÁLISIS DE PRODUCCIÓN
  // ============================================================================

  type RequisitoDesglosado = {
    material_id: string;
    material_name: string;
    material_type: "RAW_MATERIAL" | "PRODUCT";
    quantity_needed: number;
    unit: string;
    stock_available: number;
    can_make: number; // Cuántos productos puedes hacer con este ingrediente
    es_cuello_botella: boolean;
  };

  // Función recursiva para calcular requisitos
  const calcularRequisitosRecursivos = (
    productId: string,
    cantidad: number,
    visitados = new Set<string>()
  ): Map<string, RequisitoDesglosado> => {
    const requisitos = new Map<string, RequisitoDesglosado>();

    // Evitar loops infinitos
    if (visitados.has(productId)) {
      return requisitos;
    }
    visitados.add(productId);

    // Obtener fórmula del producto
    const formula = formulas.find((f) => f.id === productId);
    if (!formula || formula.ingredients.length === 0) {
      return requisitos;
    }

    // Para cada ingrediente
    formula.ingredients.forEach((ing) => {
      const cantidadNecesaria = ing.quantity * cantidad;

      if (ing.ingredient_type === "RAW_MATERIAL") {
        // Es materia prima - obtener stock FILTRANDO POR ESTADO
        let stockDisponible = 0;
        
        if (ing.ingredient_state_id) {
          // Si tiene estado específico, solo contar ese estado
          stockDisponible = inventoryByMaterial[ing.ingredient_id]
            ?.filter((inv) => inv.state_id === ing.ingredient_state_id)
            ?.reduce((sum, inv) => sum + (inv.quantity || 0), 0) ?? 0;
        } else {
          // Si no tiene estado, sumar todos los estados
          stockDisponible = inventoryByMaterial[ing.ingredient_id]?.reduce(
            (sum, inv) => sum + (inv.quantity || 0),
            0
          ) ?? 0;
        }

        const key = `RAW_${ing.ingredient_id}_${ing.ingredient_state_id || "ALL"}`;
        requisitos.set(key, {
          material_id: ing.ingredient_id,
          material_name: ing.ingredient_state_name 
            ? `${ing.ingredient_name} (${ing.ingredient_state_name})`
            : (ing.ingredient_name ?? "Desconocido"),
          material_type: "RAW_MATERIAL",
          quantity_needed: cantidadNecesaria,
          unit: ing.unit,
          stock_available: stockDisponible,
          can_make: Math.floor(stockDisponible / cantidadNecesaria),
          es_cuello_botella: false,
        });
      } else {
        // Es producto - PRIMERO verificar su stock
        const productFormula = formulas.find((f) => f.id === ing.ingredient_id);
        
        if (productFormula) {
          // El producto existe - verificar si tiene stock como "producto" independiente
          // (esto sería si se registrara como inventario de producto, lo cual no hacemos por ahora)
          
          // Por ahora, descender recursivamente a sus ingredientes
          const subRequisitos = calcularRequisitosRecursivos(ing.ingredient_id, cantidadNecesaria, visitados);
          subRequisitos.forEach((req, key) => {
            if (requisitos.has(key)) {
              // Sumar si ya existe
              const existing = requisitos.get(key)!;
              existing.quantity_needed += req.quantity_needed;
              existing.can_make = Math.floor(existing.stock_available / existing.quantity_needed);
            } else {
              requisitos.set(key, req);
            }
          });
        }
      }
    });

    return requisitos;
  };

  // Abrir modal de análisis
  const abrirAnalisis = () => {
    setAnalisisQty("");
    setAnalisisResults(null);
    setShowAnalisisModal(true);
  };

  // Calcular análisis
  const calcularAnalisis = async () => {
    if (!selectedFormula || !analisisQty) {
      setErr("Ingresa cantidad a producir.");
      return;
    }

    const cantidad = parseFloat(analisisQty);
    if (isNaN(cantidad) || cantidad <= 0) {
      setErr("Cantidad debe ser mayor a 0.");
      return;
    }

    try {
      // Calcular requisitos POR UNIDAD (cantidad = 1)
      const requisitosPorUnidad = calcularRequisitosRecursivos(selectedFormula.id, 1);

      // Ahora multiplicar por la cantidad deseada
      const requisitos = Array.from(requisitosPorUnidad.values()).map((req) => {
        // Cantidad necesaria total
        const cantidadNecesaria = req.quantity_needed * cantidad;
        
        // Cuántos productos puedo hacer con el stock disponible
        const puedesHacer = Math.floor(req.stock_available / req.quantity_needed);
        
        return {
          ...req,
          quantity_needed: cantidadNecesaria,
          can_make: puedesHacer, // Cuántos productos puedo hacer (no cuántos de la cantidad solicitada)
        };
      });

      // Encontrar cuello de botella - el mínimo de lo que puedo hacer
      const minCanMake = Math.min(...requisitos.map((r) => r.can_make));

      requisitos.forEach((req) => {
        req.es_cuello_botella = req.can_make === minCanMake;
      });

      setAnalisisResults({
        cantidad_deseada: cantidad,
        cantidad_posible: Math.min(minCanMake, cantidad), // No puedo hacer más que lo que pedí
        requisitos: requisitos,
      });
    } catch (e: any) {
      setErr(e.message ?? "Error en análisis.");
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) return <LoadingCard title="Cargando módulo de costos..." />;

  return (
    <div className="container py-8">
      <PageShell
        title="Control de Costos"
        subtitle="Gestiona materias primas, producción, fórmulas y reportes."
        right={
          <div className="flex gap-2">
            <button className="btn" onClick={async () => await cargarMaterialesPrimas()}>
              Refrescar
            </button>
            <button className="btn" onClick={() => router.push("/admin")}>
              Volver
            </button>
          </div>
        }
      >
        {err && <AlertBox type="error" message={err} onDismiss={() => setErr(null)} />}

        {/* Tabs Navigation */}
        <div className="overflow-x-auto -mx-8 px-8 mb-6">
          <div className="flex gap-1 border-b border-gray-200 pb-0 mb-6 overflow-x-auto scrollbar-hide">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-sm font-semibold whitespace-nowrap border-b-2 transition -mb-px flex items-center gap-1 ${
                  activeTab === tab.id
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                {getTabIcon(tab.id)}
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* ────── TAB: MATERIAS PRIMAS ────── */}
        {activeTab === "materias-primas" && (
          <div className="space-y-6">
            {/* Resumen rápido */}
            <div className="grid gap-3 grid-cols-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center text-emerald-700">
                <div className="text-2xl font-black">{materialesPrimas.length}</div>
                <div className="text-xs font-semibold mt-1">Materias Primas</div>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center text-blue-700">
                <div className="text-2xl font-black">
                  {Object.values(statesByMaterial).reduce((a, b) => a + b.length, 0)}
                </div>
                <div className="text-xs font-semibold mt-1">Estados Totales</div>
              </div>
              <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 text-center text-purple-700">
                <div className="text-2xl font-black">0</div>
                <div className="text-xs font-semibold mt-1">Con Stock Bajo</div>
              </div>
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-center text-amber-700">
                <div className="text-2xl font-black">0</div>
                <div className="text-xs font-semibold mt-1">Sin Stock</div>
              </div>
            </div>

            {/* Guía de uso */}
            <div className="bg-blue-100 border border-blue-300 rounded-lg p-4 text-sm text-blue-900">
              <div className="font-semibold mb-2 flex items-center gap-2">
                <Info size={18} />
                Como usar esta sección
              </div>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Crea nuevas materias primas usando el botón "Crear"</li>
                <li>Cada materia prima debe tener al menos un estado (Cruda, Cocida, etc.)</li>
                <li>Registra el inventario disponible de cada materia en cada estado</li>
                <li>Usa el historial para ver todos los movimientos de inventario</li>
              </ol>
            </div>

            {/* Materias primas list */}
            <CostsCard
              title="Materias Primas"
              subtitle={`${materialesPrimas.length} materia(s) prima(s) registrada(s)`}
              action={
                <button 
                  className="btn btn-primary flex items-center gap-2"
                  onClick={() => setShowAddMaterial(true)}
                  title="Crea una nueva materia prima. Necesitarás asignarle al menos un estado inicial."
                >
                  <Plus size={18} />
                  Crear
                </button>
              }
            >
              {/* Input de búsqueda */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="🔍 Buscar materia prima o estado..."
                  value={materialesSearchTerm}
                  onChange={(e) => setMaterialesSearchTerm(e.target.value)}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {materialesPrimas.length === 0 ? (
                <div className="rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center bg-gray-50">
                  <Package size={64} className="mx-auto mb-4 text-gray-300" strokeWidth={1.5} />
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    No hay materias primas registradas
                  </h3>
                  <p className="text-gray-600 mb-6 max-w-md mx-auto">
                    Comienza creando tu primera materia prima (ej: Carne, Papa, Harina).
                    Luego podrás agregar estados y registrar su inventario.
                  </p>
                  <button 
                    className="btn btn-primary inline-flex items-center gap-2"
                    onClick={() => setShowAddMaterial(true)}
                  >
                    <Plus size={20} />
                    Crear Primera Materia Prima
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {materialesPrimas
                    .filter((mat) => {
                      const searchLower = materialesSearchTerm.toLowerCase();
                      const matchName = mat.name.toLowerCase().includes(searchLower);
                      const matchState = (statesByMaterial[mat.id] || []).some((s: any) =>
                        s.name.toLowerCase().includes(searchLower)
                      );
                      return matchName || matchState;
                    })
                    .map((mat) => (
                    <div key={mat.id} className="rounded-2xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <div className="font-extrabold text-gray-900">{mat.name}</div>
                          <div className="text-sm text-gray-500 mt-1">{mat.description || "Sin descripción"}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge label={mat.unit} color="blue" size="sm" />
                          <button
                            className="p-2 hover:bg-blue-50 rounded-lg transition"
                            onClick={() => obtenerHistorialMateria(mat.id)}
                            title="Ver historial de movimientos de esta materia prima."
                          >
                            📜
                          </button>
                          <button
                            className="p-2 hover:bg-gray-100 rounded-lg transition"
                            onClick={() => abrirEditarMaterial(mat)}
                            title="Edita el nombre, unidad o descripción de esta materia prima."
                          >
                            <Edit2 size={16} className="text-gray-700" />
                          </button>
                          <button
                            className="p-2 hover:bg-red-50 rounded-lg transition"
                            onClick={() => eliminarMaterial(mat.id)}
                            title="Elimina esta materia prima y todos sus estados. Esta acción no se puede deshacer."
                          >
                            <Trash2 size={16} className="text-red-600" />
                          </button>
                        </div>
                      </div>

                      {/* Estados de esta materia con inventario */}
                      {statesByMaterial[mat.id] && statesByMaterial[mat.id].length > 0 ? (
                        <div className="bg-gray-50 rounded-xl p-3 border border-gray-200 space-y-3">
                          <div className="text-xs font-semibold text-gray-600 uppercase tracking-wider">Estados e Inventario</div>
                          <div className="space-y-2">
                            {statesByMaterial[mat.id].map((state) => {
                              const stateInventory = inventoryByMaterial[mat.id]?.find((inv) => inv.state_id === state.id);
                              const qty = stateInventory?.quantity ?? 0;
                              const stockColor =
                                qty <= 0
                                  ? "text-red-600 bg-red-50 border-red-200"
                                  : qty <= 5
                                    ? "text-amber-600 bg-amber-50 border-amber-200"
                                    : "text-emerald-700 bg-emerald-50 border-emerald-200";

                              return (
                                <div
                                  key={state.id}
                                  className="flex items-center justify-between p-2 bg-white rounded-lg border border-gray-200"
                                >
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-semibold text-gray-900">{state.name}</span>
                                    <span className="text-xs text-gray-500">({state.order_num})</span>
                                  </div>
                                  <span className={`rounded-full border px-3 py-1 text-xs font-extrabold ${stockColor}`}>
                                    {qty <= 0 ? "Sin stock" : `${qty} ${mat.unit}`}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                          <button
                            className="btn btn-primary text-sm w-full flex items-center justify-center gap-2"
                            onClick={() => {
                              setSelectedMaterialForStates(mat.id);
                              setShowAddState(true);
                            }}
                            title="Agrega un nuevo estado para esta materia prima (ej: Cocinada, Molida)."
                          >
                            <Plus size={16} />
                            Agregar Estado
                          </button>
                        </div>
                      ) : (
                        <div className="bg-gray-50 rounded-xl p-3 border border-dashed border-gray-300 text-center">
                          <p className="text-xs text-gray-500 mb-2">Sin estados creados</p>
                          <button
                            className="btn btn-primary text-sm w-full"
                            onClick={() => {
                              setSelectedMaterialForStates(mat.id);
                              setShowAddState(true);
                            }}
                          >
                            + Crear primer estado
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CostsCard>

            {/* Estados de Material Seleccionado */}
            {selectedMaterialForStates && (
              <CostsCard
                title={`Estados: ${materialesPrimas.find((m) => m.id === selectedMaterialForStates)?.name}`}
                action={
                  <button className="btn btn-primary" onClick={() => setShowAddState(true)}>
                    + Agregar estado
                  </button>
                }
              >
                {(statesByMaterial[selectedMaterialForStates] ?? []).length === 0 ? (
                  <EmptyState
                    icon="📋"
                    title="Sin estados"
                    description="Crea el primer estado para esta materia prima."
                    action={
                      <button className="btn btn-primary" onClick={() => setShowAddState(true)}>
                        + Crear estado
                      </button>
                    }
                  />
                ) : (
                  <div className="space-y-2">
                    {(statesByMaterial[selectedMaterialForStates] ?? []).map((state) => (
                      <div key={state.id} className="rounded-2xl border border-gray-200 p-3 flex items-center justify-between">
                        <div>
                          <div className="font-semibold text-gray-900">{state.name}</div>
                          <div className="text-xs text-gray-500">Orden: {state.order_num}</div>
                        </div>
                        <div className="flex gap-1">
                          <button 
                            className="p-2 hover:bg-gray-100 rounded-lg transition"
                            onClick={() => abrirEditarEstado(state)}
                            title="Edita el nombre de este estado."
                          >
                            <Edit2 size={14} className="text-gray-700" />
                          </button>
                          <button
                            className="p-2 hover:bg-red-50 rounded-lg transition"
                            onClick={() => eliminarEstado(state.id, selectedMaterialForStates)}
                            title="Elimina este estado. Los otros se renumerarán automáticamente."
                          >
                            <Trash2 size={14} className="text-red-600" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CostsCard>
            )}
          </div>
        )}

        {/* ────── TAB: PRODUCCIÓN ────── */}
        {activeTab === "produccion" && (
          <div className="space-y-6">
            {/* Guía de uso */}
            <div className="bg-blue-100 border border-blue-300 rounded-lg p-4 text-sm text-blue-900">
              <div className="font-semibold mb-2 flex items-center gap-2">
                <Info size={18} />
                Como usar esta sección
              </div>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Selecciona el tipo de registro que quieres hacer (abajo)</li>
                <li>Completa los campos solicitados</li>
                <li>Haz click en "Guardar" para registrar el movimiento</li>
                <li>Los datos se guardan automáticamente en el historial</li>
              </ol>
            </div>

            {/* Selector de tipo de registro */}
            <CostsCard>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "entrada", label: "Entrada Inicial", icon: Download },
                  { id: "transformacion", label: "Transformación", icon: ArrowRightLeft },
                  { id: "merma", label: "Merma Adicional", icon: AlertTriangle },
                  { id: "variancia", label: "Analizar Variancia", icon: TrendingDown },
                ].map((tipo) => {
                  const Icon = tipo.icon;
                  return (
                    <button
                      key={tipo.id}
                      onClick={() => {
                        if (tipo.id === "variancia") {
                          setMostrarAnalisisVariancia(true);
                        } else {
                          setTipoRegistro(tipo.id as any);
                        }
                      }}
                      className={`px-4 py-2 rounded-2xl border font-semibold text-sm transition inline-flex items-center gap-2 ${
                        tipoRegistro === tipo.id
                          ? "bg-blue-50 border-blue-300 text-blue-700"
                          : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                      }`}
                    >
                      <Icon size={18} />
                      {tipo.label}
                    </button>
                  );
                })}
              </div>
            </CostsCard>

            {/* ENTRADA INICIAL */}
            {tipoRegistro === "entrada" && (
              <CostsCard title="Registrar Entrada Inicial" subtitle="Agrega una nueva cantidad de materia prima recibida">
                <div className="space-y-4">
                  {err && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                      <div className="font-semibold flex items-center gap-2">
                        <AlertTriangle size={16} />
                        Error
                      </div>
                      <p className="mt-1">{err}</p>
                    </div>
                  )}

                  {success && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                      <div className="font-semibold flex items-center gap-2">
                        <span>✓ Éxito</span>
                      </div>
                      <p className="mt-1">{success}</p>
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
                    <div className="font-semibold mb-1 flex items-center gap-2">
                      <Info size={16} />
                      Información
                    </div>
                    <p>Registra cada vez que recibes materia prima del proveedor. Especifica la cantidad, estado (cruda, cocida, etc.), costo y lote. Esto actualiza tu inventario disponible.</p>
                  </div>

                  <FormSelect
                    label="Materia Prima"
                    value={selectedMaterial}
                    onChange={setSelectedMaterial}
                    options={materialesPrimas.map((m) => ({ value: m.id, label: m.name }))}
                    disabled={savingEntrada}
                  />

                  {selectedMaterial && (
                    <FormSelect
                      label="Estado"
                      value={selectedState}
                      onChange={setSelectedState}
                      options={(statesByMaterial[selectedMaterial] ?? []).map((s) => ({ value: s.id, label: s.name }))}
                      disabled={savingEntrada}
                    />
                  )}

                  <div className="space-y-2">
                    <label className="text-sm font-semibold text-gray-700">
                      Cantidad {selectedMaterial && <span className="text-gray-600">({materialesPrimas.find(m => m.id === selectedMaterial)?.unit})</span>}
                    </label>
                    <input
                      type="number"
                      value={entradaCantidad}
                      onChange={(e) => setEntradaCantidad(e.target.value)}
                      placeholder="0"
                      disabled={savingEntrada}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>

                  <FormInput
                    label="Costo Total *"
                    value={entradaCosto}
                    onChange={setEntradaCosto}
                    type="number"
                    placeholder="$0"
                    disabled={savingEntrada}
                  />

                  {entradaCantidad && entradaCosto && !isNaN(parseFloat(entradaCantidad)) && !isNaN(parseFloat(entradaCosto)) && parseFloat(entradaCantidad) > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm">
                      <div className="text-gray-700">
                        <span className="font-semibold">Costo Unitario:</span>
                        <span className="ml-2 text-green-700 font-bold">
                          ${(parseFloat(entradaCosto) / parseFloat(entradaCantidad)).toFixed(2)}
                        </span>
                        {selectedMaterial && <span className="text-gray-600 ml-1">por {materialesPrimas.find(m => m.id === selectedMaterial)?.unit}</span>}
                      </div>
                    </div>
                  )}

                  <FormInput
                    label="Proveedor (opcional)"
                    value={entradaProveedor}
                    onChange={setEntradaProveedor}
                    placeholder="Nombre del proveedor"
                    disabled={savingEntrada}
                  />

                  <FormInput
                    label="Código de Lote (opcional - se genera automáticamente)"
                    value={entradaLote}
                    onChange={setEntradaLote}
                    placeholder="Dejar vacío para generar automáticamente"
                    disabled={savingEntrada}
                  />

                  <FormInput
                    label="Observaciones (opcional)"
                    value={entradaObservaciones}
                    onChange={setEntradaObservaciones}
                    placeholder="Notas sobre esta entrada..."
                    disabled={savingEntrada}
                  />

                  <button
                    className="btn btn-primary w-full"
                    onClick={registrarEntrada}
                    disabled={savingEntrada}
                  >
                    {savingEntrada ? "Registrando..." : "Registrar Entrada"}
                  </button>
                </div>
              </CostsCard>
            )}

            {/* TRANSFORMACIÓN */}
            {tipoRegistro === "transformacion" && (
              <CostsCard
                title="Registrar Transformación"
                subtitle="Registra cambios de estado (Ej: cruda → cocinada)"
              >
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
                    <div className="font-semibold mb-1 flex items-center gap-2">
                      <Info size={16} />
                      Información
                    </div>
                    <p>Registra cuando transformas materia prima de un estado a otro. Por ejemplo: cambiar carne cruda a cocida, papa pelada a cortada. Especifica cantidades entrada/salida (puede haber pérdida por procesamiento).</p>
                  </div>

                  <FormSelect
                    label="Materia Prima"
                    value={transformMaterial}
                    onChange={setTransformMaterial}
                    options={materialesPrimas.map((m) => ({ value: m.id, label: m.name }))}
                    disabled={savingTransform}
                  />

                  {transformMaterial && (
                    <>
                      <FormSelect
                        label="Estado Origen"
                        value={transformFromState}
                        onChange={setTransformFromState}
                        options={(statesByMaterial[transformMaterial] ?? []).map((s) => ({ value: s.id, label: s.name }))}
                        disabled={savingTransform}
                      />

                      <FormSelect
                        label="Estado Destino"
                        value={transformToState}
                        onChange={setTransformToState}
                        options={(statesByMaterial[transformMaterial] ?? [])
                          .filter((s) => s.id !== transformFromState)
                          .map((s) => ({ value: s.id, label: s.name }))}
                        disabled={savingTransform}
                      />
                    </>
                  )}

                  <div className="grid grid-cols-2 gap-3">
                    <FormInput
                      label="Cantidad Entrada"
                      value={transformQtyIn}
                      onChange={setTransformQtyIn}
                      type="number"
                      placeholder="0"
                      disabled={savingTransform}
                    />
                    <FormInput
                      label="Cantidad Salida"
                      value={transformQtyOut}
                      onChange={setTransformQtyOut}
                      type="number"
                      placeholder="0"
                      disabled={savingTransform}
                    />
                  </div>

                  {transformQtyIn && transformQtyOut && (
                    <div className="bg-amber-50 border border-amber-200 rounded-2xl p-3">
                      <div className="text-sm text-amber-700">
                        <strong>Merma calculada:</strong> {(parseFloat(transformQtyIn) - parseFloat(transformQtyOut)).toFixed(2)} (
                        {(((parseFloat(transformQtyIn) - parseFloat(transformQtyOut)) / parseFloat(transformQtyIn)) * 100).toFixed(1)}%)
                      </div>
                    </div>
                  )}

                  <FormInput
                    label="Observaciones (opcional)"
                    value={transformObservaciones}
                    onChange={setTransformObservaciones}
                    placeholder="Notas sobre esta transformación..."
                    disabled={savingTransform}
                  />

                  <button
                    className="btn btn-primary w-full"
                    onClick={registrarTransformacion}
                    disabled={savingTransform}
                  >
                    {savingTransform ? "Registrando..." : "Registrar Transformación"}
                  </button>
                </div>
              </CostsCard>
            )}

            {/* MERMA ADICIONAL */}
            {tipoRegistro === "merma" && (
              <CostsCard title="Registrar Merma Adicional" subtitle="Registra pérdidas de materia prima de un lote específico">
                <div className="space-y-4">
                  {err && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                      <div className="font-semibold flex items-center gap-2">
                        <AlertTriangle size={16} />
                        Error
                      </div>
                      <p className="mt-1">{err}</p>
                    </div>
                  )}

                  {success && (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                      <div className="font-semibold flex items-center gap-2">
                        <span>✓ Éxito</span>
                      </div>
                      <p className="mt-1">{success}</p>
                    </div>
                  )}

                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
                    <div className="font-semibold mb-1 flex items-center gap-2">
                      <Info size={16} />
                      Información
                    </div>
                    <p>Selecciona un lote específico de materia prima y registra la cantidad que se perdió por daño, desperdicio, etc. Esto restará automáticamente del inventario disponible del lote.</p>
                  </div>

                  {loadingBatches ? (
                    <div className="p-3 bg-gray-50 rounded-lg text-center text-gray-600 text-sm">
                      Cargando lotes...
                    </div>
                  ) : (
                    <>
                      <BatchLotSelector
                        batches={batches}
                        selectedBatchId={batchSelect}
                        onSelectBatch={setBatchSelect}
                        label="Seleccionar Lote a Descartar"
                      />

                      {batchSelect && (
                        <>
                          <FormInput
                            label="Cantidad a Descartar *"
                            value={wasteQty}
                            onChange={setWasteQty}
                            type="number"
                            placeholder="0"
                            disabled={savingWaste}
                          />

                          {wasteQty && !isNaN(parseFloat(wasteQty)) && parseFloat(wasteQty) > 0 && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm">
                              <div className="text-gray-700">
                                <span className="font-semibold">Costo afectado:</span>
                                <span className="ml-2 text-yellow-700 font-bold">
                                  ${(parseFloat(wasteQty) * (batches.find((b) => b.id === batchSelect)?.cost_per_unit || 0)).toFixed(2)}
                                </span>
                              </div>
                            </div>
                          )}

                          <FormInput
                            label="Razón / Observaciones"
                            value={wasteReason}
                            onChange={setWasteReason}
                            placeholder="¿Por qué se descartó? (daño, vencimiento, etc.)"
                            disabled={savingWaste}
                          />
                        </>
                      )}

                      <button
                        className="btn btn-primary w-full"
                        onClick={registrarMerma}
                        disabled={savingWaste || !batchSelect || !wasteQty}
                      >
                        {savingWaste ? "Registrando..." : "Registrar Merma"}
                      </button>
                    </>
                  )}
                </div>
              </CostsCard>
            )}

            {/* PRODUCCIÓN */}
          </div>
        )}

        {/* ────── TAB: FÓRMULAS ────── */}
        {activeTab === "formulas" && (
          <div className="space-y-6">
            {/* Resumen rápido */}
            <div className="grid gap-3 grid-cols-3">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center text-emerald-700">
                <div className="text-2xl font-black">{formulas.length}</div>
                <div className="text-xs font-semibold mt-1">Productos/Fórmulas</div>
              </div>
              <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-center text-blue-700">
                <div className="text-2xl font-black">
                  {formulas.reduce((a, b) => a + b.ingredients.length, 0)}
                </div>
                <div className="text-xs font-semibold mt-1">Ingredientes Totales</div>
              </div>
              <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 text-center text-purple-700">
                <div className="text-2xl font-black">
                  {formulas.filter((f) => f.ingredients.length === 0).length}
                </div>
                <div className="text-xs font-semibold mt-1">Sin Ingredientes</div>
              </div>
            </div>

            {/* Guía de uso */}
            <div className="bg-blue-100 border border-blue-300 rounded-lg p-4 text-sm text-blue-900">
              <div className="font-semibold mb-2 flex items-center gap-2">
                <Info size={18} />
                Como usar esta sección
              </div>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Crea un nuevo producto usando el botón "Crear Producto"</li>
                <li>Agrega ingredientes al producto (pueden ser materias primas u otros productos)</li>
                <li>Define la cantidad de cada ingrediente que necesitas por unidad producida</li>
                <li>Usa estos productos para registrar producción y analizar variancia</li>
              </ol>
            </div>

            {/* Búsqueda y filtros */}
            <CostsCard>
              <div className="space-y-3">
                {/* Búsqueda */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="🔍 Buscar producto por nombre..."
                    value={formulasSearchTerm}
                    onChange={(e) => setFormulasSearchTerm(e.target.value)}
                    className="w-full rounded-2xl border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                  {formulasSearchTerm && (
                    <button
                      onClick={() => setFormulasSearchTerm("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      ✕
                    </button>
                  )}
                </div>

                {/* Ordenamiento */}
                <div className="flex gap-3">
                  <select
                    value={formulasOrderBy}
                    onChange={(e) => setFormulasOrderBy(e.target.value as any)}
                    className="flex-1 rounded-2xl border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  >
                    <option value="name">Ordenar: A-Z</option>
                    <option value="ingredients">Ordenar: Por ingredientes (más primero)</option>
                    <option value="recent">Ordenar: Más recientes primero</option>
                  </select>

                  <button 
                    className="btn btn-primary inline-flex items-center gap-2 flex-shrink-0"
                    onClick={() => setShowCreateFormula(true)}
                    title="Crea un nuevo producto o fórmula. Luego podrás agregarle ingredientes."
                  >
                    <Plus size={18} />
                    Crear Producto
                  </button>
                </div>
              </div>
            </CostsCard>

            {/* Grid de productos */}
            {formulas.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-300 p-12 text-center bg-gray-50">
                <ListChecks size={64} className="mx-auto mb-4 text-gray-300" strokeWidth={1.5} />
                <h3 className="text-xl font-bold text-gray-900 mb-2">
                  No hay productos registrados
                </h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Los productos son fórmulas que definen qué ingredientes necesitas.
                  Pueden usar materias primas o incluso otros productos (anidados).
                </p>
                <button 
                  className="btn btn-primary inline-flex items-center gap-2"
                  onClick={() => setShowCreateFormula(true)}
                >
                  <Plus size={20} />
                  Crear Primer Producto
                </button>
              </div>
            ) : filteredAndSortedFormulas.length === 0 ? (
              <div className="rounded-2xl border-2 border-dashed border-yellow-300 bg-yellow-50 p-8 text-center">
                <p className="text-yellow-800 font-semibold mb-2">
                  No se encontraron productos
                </p>
                <p className="text-sm text-yellow-700">
                  No hay coincidencias para "{formulasSearchTerm}". Intenta con otro nombre.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredAndSortedFormulas.map((formula) => (
                  <button
                    key={formula.id}
                    onClick={() => setSelectedFormula(formula)}
                    className={`text-left rounded-2xl border-2 p-4 transition hover:shadow-md ${
                      selectedFormula?.id === formula.id
                        ? "border-blue-600 bg-blue-50 shadow-md"
                        : "border-gray-200 bg-white hover:border-blue-300"
                    }`}
                  >
                    {/* Encabezado */}
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="font-bold text-gray-900 flex-1">{formula.name}</h3>
                      <span className="text-xs font-semibold text-green-700 bg-green-50 px-2 py-1 rounded-lg ml-2">
                        Activo
                      </span>
                    </div>

                    {/* Descripción */}
                    {formula.description && (
                      <p className="text-xs text-gray-600 mb-3 line-clamp-2">
                        {formula.description}
                      </p>
                    )}

                    {/* Información */}
                    <div className="grid grid-cols-2 gap-2 bg-gray-50 rounded-lg p-2 mb-3">
                      <div>
                        <span className="text-xs text-gray-500">Ingredientes</span>
                        <p className="text-sm font-bold text-gray-900">
                          {formula.ingredients.length}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500">Unidad</span>
                        <p className="text-sm font-bold text-gray-900">
                          {formula.unit}
                        </p>
                      </div>
                    </div>

                    {/* Indicador de selección */}
                    {selectedFormula?.id === formula.id && (
                      <div className="text-xs text-blue-700 font-semibold">
                        ✓ Seleccionado
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* DETALLES DE FÓRMULA SELECCIONADA */}
            {selectedFormula && (
              <div className="mt-8" ref={detallesRef}>
                <CostsCard
                  title={selectedFormula.name}
                  subtitle={selectedFormula.description || "Sin descripción"}
                  action={
                    <div className="flex gap-2">
                      <button
                        className="p-2 hover:bg-blue-50 rounded-lg transition inline-flex items-center gap-2 text-blue-600"
                        onClick={() => obtenerHistorialFormula(selectedFormula.id)}
                        title="Ver historial de cambios en esta fórmula."
                      >
                        📜
                        Historial
                      </button>
                      <button
                        className="p-2 hover:bg-blue-50 rounded-lg transition inline-flex items-center gap-2 text-blue-600"
                        onClick={() => {
                          setDuplicatingProductId(selectedFormula.id);
                          setDuplicatingProductName(`${selectedFormula.name} (copia)`);
                          setShowDuplicateModal(true);
                        }}
                        title="Duplica este producto con todos sus ingredientes."
                      >
                        📋
                        Duplicar
                      </button>
                      <button
                        className="p-2 hover:bg-red-50 rounded-lg transition inline-flex items-center gap-2 text-red-600"
                        onClick={() => eliminarFormula(selectedFormula.id)}
                        title="Elimina este producto y todos sus ingredientes. Esta acción no se puede deshacer."
                      >
                        <Trash2 size={18} />
                        Eliminar
                      </button>
                    </div>
                  }
                >
                  <div className="space-y-4">
                    {/* Datos del producto */}
                    <div className="bg-gray-50 rounded-2xl p-4 border border-gray-200">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-xs font-semibold text-gray-600 uppercase">Tipo</div>
                          <div className="text-sm font-bold text-gray-900 mt-1">
                            Producto
                          </div>
                        </div>
                        <div>
                          <div className="text-xs font-semibold text-gray-600 uppercase">Ingredientes</div>
                          <div className="text-sm font-bold text-gray-900 mt-1">
                            {selectedFormula.ingredients.length}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Ingredientes */}
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900">Ingredientes</h3>
                        <button
                          className="btn btn-primary text-sm inline-flex items-center gap-2"
                          onClick={() => setShowAddIngredient(true)}
                          title="Agrega un nuevo ingrediente (materia prima o producto anidado)."
                        >
                          <Plus size={16} />
                          Agregar
                        </button>
                      </div>

                      {selectedFormula.ingredients.length === 0 ? (
                        <div className="bg-gray-50 rounded-2xl p-6 border-2 border-dashed border-gray-300 text-center">
                          <p className="text-sm text-gray-600 mb-3">
                            No hay ingredientes asignados.
                          </p>
                          <p className="text-xs text-gray-500">
                            Presiona "+ Agregar" para definir qué necesitas para este producto.
                          </p>
                        </div>
                      ) : (
                          <div className="space-y-2">
                            {selectedFormula.ingredients.map((ing) => (
                              <div
                                key={ing.id}
                                className="flex items-center justify-between p-3 bg-white rounded-2xl border border-gray-200"
                              >
                                <div>
                                  <div className="font-semibold text-gray-900">
                                    {ing.ingredient_name}
                                    {ing.ingredient_state_name && (
                                      <span className="text-gray-500 font-normal"> ({ing.ingredient_state_name})</span>
                                    )}
                                  </div>
                                  <div className="text-xs text-gray-500 mt-1">
                                    <button
                                      className="hover:text-blue-600 hover:underline transition cursor-pointer"
                                      onClick={() => {
                                        setEditingIngredientId(ing.id);
                                        setEditingIngredientQty(ing.quantity.toString());
                                        setShowEditIngredient(true);
                                      }}
                                      title="Click para editar cantidad"
                                    >
                                      {ing.quantity} {ing.unit}
                                    </button>
                                    <span className="mx-1">•</span>
                                    <Badge
                                      label={ing.ingredient_type === "RAW_MATERIAL" ? "Materia Prima" : "Producto"}
                                      color={ing.ingredient_type === "RAW_MATERIAL" ? "blue" : "red"}
                                      size="sm"
                                    />
                                  </div>
                                </div>
                                <button
                                  className="btn text-sm text-red-600"
                                  onClick={() => eliminarIngrediente(ing.id)}
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Cuello de botella */}
                      {selectedFormula.ingredients.length > 0 && (
                        <button
                          className="w-full bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 rounded-2xl p-4 text-left hover:shadow-md transition-all group"
                          onClick={abrirAnalisis}
                        >
                          <div className="flex items-center gap-2 text-sm font-semibold text-amber-900 mb-2">
                            <TrendingDown size={20} className="text-amber-600 group-hover:scale-110 transition-transform" />
                            Calcular Análisis de Producción
                          </div>
                          <p className="text-xs text-amber-700">
                            Descubre cuántos productos puedes hacer con tu inventario actual y qué ingrediente te limita.
                          </p>
                        </button>
                      )}
                    </div>
                  </CostsCard>
                </div>
              )}

            {/* MODAL: ANÁLISIS DE PRODUCCIÓN */}
            <CostsModal
              isOpen={showAnalisisModal}
              title={`Análisis: ${selectedFormula?.name}`}
              onClose={() => {
                setShowAnalisisModal(false);
                setAnalisisQty("");
                setAnalisisResults(null);
              }}
              actions={
                !analisisResults
                  ? [
                      {
                        label: "Cancelar",
                        onClick: () => {
                          setShowAnalisisModal(false);
                          setAnalisisQty("");
                        },
                        variant: "secondary",
                      },
                      {
                        label: "Calcular",
                        onClick: calcularAnalisis,
                        variant: "primary",
                        disabled: !analisisQty,
                      },
                    ]
                  : [
                      {
                        label: "Nueva búsqueda",
                        onClick: () => {
                          setAnalisisQty("");
                          setAnalisisResults(null);
                        },
                        variant: "secondary",
                      },
                    ]
              }
            >
              {!analisisResults ? (
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
                    <div className="font-semibold mb-1 flex items-center gap-2">
                      <Info size={16} />
                      Información
                    </div>
                    <p>Ingresa la cantidad que deseas producir y te mostraré cuántas unidades realmente puedes hacer basado en tu stock disponible. Identifica qué ingrediente es el cuello de botella.</p>
                  </div>

                  <FormInput
                    label="¿Cuántos productos quieres producir?"
                    value={analisisQty}
                    onChange={setAnalisisQty}
                    type="number"
                    placeholder="100"
                  />
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Resumen */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 rounded-2xl p-3 text-center border border-blue-200">
                      <div className="text-xs text-blue-600 font-semibold">Quieres hacer</div>
                      <div className="text-2xl font-black text-blue-700">{analisisResults.cantidad_deseada}</div>
                    </div>
                    <div
                      className={`rounded-2xl p-3 text-center border font-semibold ${
                        analisisResults.cantidad_posible === analisisResults.cantidad_deseada
                          ? "bg-emerald-50 border-emerald-200"
                          : "bg-red-50 border-red-200"
                      }`}
                    >
                      <div className={`text-xs ${analisisResults.cantidad_posible === analisisResults.cantidad_deseada ? "text-emerald-600" : "text-red-600"}`}>
                        Puedes hacer
                      </div>
                      <div className={`text-2xl font-black ${analisisResults.cantidad_posible === analisisResults.cantidad_deseada ? "text-emerald-700" : "text-red-700"}`}>
                        {analisisResults.cantidad_posible}
                      </div>
                    </div>
                  </div>

                  {/* Tabla de requisitos */}
                  <div className="border-t border-gray-200 pt-3">
                    <div className="text-sm font-semibold text-gray-900 mb-2">Ingredientes Necesarios</div>
                    <div className="space-y-2 max-h-80 overflow-y-auto">
                      {analisisResults.requisitos.map((req: RequisitoDesglosado, idx: number) => (
                        <div
                          key={idx}
                          className={`rounded-lg p-3 border ${
                            req.es_cuello_botella
                              ? "bg-red-50 border-red-300"
                              : req.stock_available >= req.quantity_needed
                                ? "bg-emerald-50 border-emerald-200"
                                : "bg-amber-50 border-amber-200"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <div className="font-semibold text-gray-900">{req.material_name}</div>
                              <div className="text-xs text-gray-500">
                                {req.material_type === "RAW_MATERIAL" ? "Materia Prima" : "Producto"}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-gray-900">
                                {req.quantity_needed.toFixed(2)} {req.unit}
                              </div>
                              <div className={`text-xs font-semibold ${
                                req.stock_available >= req.quantity_needed ? "text-emerald-700" : "text-red-700"
                              }`}>
                                (Stock: {req.stock_available.toFixed(2)})
                              </div>
                            </div>
                          </div>

                          {req.es_cuello_botella && (
                            <div className="mt-2 text-xs bg-red-100 text-red-700 rounded px-2 py-1 font-semibold">
                              ⚠️ CUELLO DE BOTELLA - Te limita a {req.can_make} productos
                            </div>
                          )}

                          {req.stock_available < req.quantity_needed && !req.es_cuello_botella && (
                            <div className="mt-2 text-xs bg-amber-100 text-amber-700 rounded px-2 py-1 font-semibold">
                              ❌ Faltante: {(req.quantity_needed - req.stock_available).toFixed(2)} {req.unit}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recomendación */}
                  {analisisResults.cantidad_posible < analisisResults.cantidad_deseada && (
                    <div className="bg-amber-50 border border-amber-300 rounded-2xl p-3">
                      <div className="text-sm font-semibold text-amber-900">💡 Recomendación</div>
                      <div className="text-xs text-amber-700 mt-1">
                        Primero produce más {analisisResults.requisitos.find((r: RequisitoDesglosado) => r.es_cuello_botella)?.material_name}
                        , o reduce la cantidad a {analisisResults.cantidad_posible} productos.
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CostsModal>

            {/* MODAL: Crear Fórmula */}
            <CostsModal
              isOpen={showCreateFormula}
              title="Crear Fórmula (Producto)"
              onClose={() => {
                setShowCreateFormula(false);
                setNewFormulaName("");
                setNewFormulaUnit("u");
                setNewFormulaDesc("");
              }}
              actions={[
                {
                  label: "Cancelar",
                  onClick: () => {
                    setShowCreateFormula(false);
                    setNewFormulaName("");
                    setNewFormulaUnit("u");
                    setNewFormulaDesc("");
                  },
                  variant: "secondary",
                },
                {
                  label: savingNewFormula ? "Creando..." : "Crear",
                  onClick: crearFormula,
                  variant: "primary",
                  disabled: savingNewFormula,
                },
              ]}
            >
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 mb-4">
                <div className="font-semibold mb-1 flex items-center gap-2">
                  <Info size={16} />
                  Información
                </div>
                <p>Crea un nuevo producto (fórmula). Luego agregarás los ingredientes que necesita. Puedes usar materias primas u otros productos.</p>
              </div>

              <FormInput
                label="Nombre del Producto"
                value={newFormulaName}
                onChange={setNewFormulaName}
                placeholder="Ej: Empanada de carne"
                disabled={savingNewFormula}
              />
              <FormSelect
                label="Unidad de Medida"
                value={newFormulaUnit}
                onChange={setNewFormulaUnit}
                options={[
                  { value: "u", label: "Unidades (u)" },
                  { value: "kg", label: "Kilogramos (kg)" },
                  { value: "g", label: "Gramos (g)" },
                  { value: "l", label: "Litros (l)" },
                  { value: "ml", label: "Mililitros (ml)" },
                ]}
                disabled={savingNewFormula}
              />
            </CostsModal>

            {/* MODAL: Agregar Ingrediente */}
            <CostsModal
              isOpen={showAddIngredient}
              title={`Agregar Ingrediente a ${selectedFormula?.name}`}
              onClose={() => {
                setShowAddIngredient(false);
                setIngredientType("RAW_MATERIAL");
                setSelectedIngredient("");
                setIngredientQty("");
              }}
              actions={[
                {
                  label: "Cancelar",
                  onClick: () => {
                    setShowAddIngredient(false);
                    setIngredientType("RAW_MATERIAL");
                    setSelectedIngredient("");
                    setIngredientQty("");
                  },
                  variant: "secondary",
                },
                {
                  label: savingIngredient ? "Agregando..." : "Agregar",
                  onClick: agregarIngrediente,
                  variant: "primary",
                  disabled: savingIngredient,
                },
              ]}
            >
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 mb-4">
                <div className="font-semibold mb-1 flex items-center gap-2">
                  <Info size={16} />
                  Información
                </div>
                <p>Agrega ingredientes a este producto. Selecciona si es una materia prima o un producto anidado, luego indica la cantidad que necesitas por unidad producida.</p>
              </div>

              <FormSelect
                label="Tipo de Ingrediente"
                value={ingredientType}
                onChange={(val) => {
                  setIngredientType(val as any);
                  setSelectedIngredient("");
                }}
                options={[
                  { value: "RAW_MATERIAL", label: "Materia Prima" },
                  { value: "PRODUCT", label: "Producto (anidado)" },
                ]}
                disabled={savingIngredient}
              />

              <FormSelect
                label={ingredientType === "RAW_MATERIAL" ? "Materia Prima" : "Producto"}
                value={selectedIngredient}
                onChange={setSelectedIngredient}
                options={
                  ingredientType === "RAW_MATERIAL"
                    ? materialesPrimas.map((m) => ({ value: m.id, label: m.name }))
                    : formulas
                        .filter((f) => f.id !== selectedFormula?.id)
                        .map((f) => ({ value: f.id, label: f.name }))
                }
                disabled={savingIngredient}
              />

              {/* Dropdown de Estados - Solo si es Materia Prima */}
              {ingredientType === "RAW_MATERIAL" && selectedIngredient && (
                <FormSelect
                  label="Estado de la Materia Prima"
                  value={selectedMaterialState}
                  onChange={setSelectedMaterialState}
                  options={
                    statesByMaterial[selectedIngredient]?.map((state) => ({
                      value: state.id,
                      label: state.name,
                    })) || []
                  }
                  disabled={savingIngredient}
                />
              )}

              <FormInput
                label="Cantidad Necesaria"
                value={ingredientQty}
                onChange={setIngredientQty}
                type="number"
                placeholder="0"
                disabled={savingIngredient}
              />
            </CostsModal>
          </div>
        )}

        {/* MODAL: Editar Cantidad de Ingrediente */}
        <CostsModal
          isOpen={showEditIngredient}
          title="Editar Cantidad"
          onClose={() => {
            setShowEditIngredient(false);
            setEditingIngredientId("");
            setEditingIngredientQty("");
          }}
        >
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 mb-4">
            <div className="font-semibold mb-1 flex items-center gap-2">
              <Info size={16} />
              Información
            </div>
            <p>Modifica la cantidad de este ingrediente que necesitas. El cambio se aplicará a todos los cálculos futuros.</p>
          </div>

          <div className="space-y-4">
            <FormInput
              label="Nueva Cantidad"
              value={editingIngredientQty}
              onChange={setEditingIngredientQty}
              type="number"
              placeholder="0"
              disabled={savingEditIngredient}
            />

            <button
              className="btn btn-primary w-full"
              onClick={editarCantidadIngrediente}
              disabled={savingEditIngredient}
            >
              {savingEditIngredient ? "Guardando..." : "Guardar Cantidad"}
            </button>
          </div>
        </CostsModal>

        {/* MODAL: Duplicar Producto */}
        <CostsModal
          isOpen={showDuplicateModal}
          title="Duplicar Producto"
          onClose={() => {
            setShowDuplicateModal(false);
            setDuplicatingProductId("");
            setDuplicatingProductName("");
          }}
        >
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 mb-4">
            <div className="font-semibold mb-1 flex items-center gap-2">
              <Info size={16} />
              Información
            </div>
            <p>Crea una copia de este producto con todos sus ingredientes. Ideal para crear variantes similares rápidamente.</p>
          </div>

          <div className="space-y-4">
            <FormInput
              label="Nombre del Nuevo Producto"
              value={duplicatingProductName}
              onChange={setDuplicatingProductName}
              placeholder="Ej: Empanada de Carne (copia)"
              disabled={savingDuplicate}
            />

            <button
              className="btn btn-primary w-full"
              onClick={duplicarProducto}
              disabled={savingDuplicate}
            >
              {savingDuplicate ? "Duplicando..." : "Duplicar Producto"}
            </button>
          </div>
        </CostsModal>

        {/* MODAL: Historial de Materia Prima */}
        <CostsModal
          isOpen={mostrarHistorialMateria}
          title="Historial de Movimientos"
          onClose={() => {
            setMostrarHistorialMateria(false);
            setHistorialMateria([]);
          }}
        >
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
              <div className="font-semibold mb-1 flex items-center gap-2">
                <Info size={16} />
                Información
              </div>
              <p>Aquí ves todos los movimientos de esta materia prima. Cada fila muestra la fecha, tipo de movimiento, cantidad antes y después. Úsalo para auditar y entender los cambios de inventario.</p>
            </div>

            {loadingHistorial ? (
              <p className="text-gray-500">Cargando historial...</p>
            ) : historialMateria.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No hay movimientos registrados</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Fecha</th>
                      <th className="px-3 py-2 text-left font-semibold">Tipo</th>
                      <th className="px-3 py-2 text-right font-semibold">Antes</th>
                      <th className="px-3 py-2 text-right font-semibold">Después</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historialMateria.map((item: any, idx: number) => (
                      <tr key={item.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                        <td className="px-3 py-2 text-gray-900">
                          {new Date(item.created_at).toLocaleDateString()} <br />
                          <span className="text-xs text-gray-500">
                            {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-gray-700 font-medium">{item.reason}</td>
                        <td className="px-3 py-2 text-right text-gray-900">{item.quantity_before}</td>
                        <td className="px-3 py-2 text-right text-gray-900">{item.quantity_after}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </CostsModal>

        {/* MODAL: Historial de Fórmula */}
        <CostsModal
          isOpen={mostrarHistorialFormula}
          title="Historial de Cambios"
          onClose={() => {
            setMostrarHistorialFormula(false);
            setHistorialFormula([]);
          }}
        >
          <div className="space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
              <div className="font-semibold mb-1 flex items-center gap-2">
                <Info size={16} />
                Información
              </div>
              <p>Aquí ves todos los cambios realizados a este producto/fórmula. Incluye creación, ingredientes agregados, modificados o eliminados. Úsalo para auditar la evolución de tus fórmulas.</p>
            </div>

            {loadingHistorial ? (
              <p className="text-gray-500">Cargando historial...</p>
            ) : historialFormula.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No hay cambios registrados</p>
            ) : (
              <div className="space-y-2">
                {historialFormula.map((item: any) => (
                  <div key={item.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <div className="font-semibold text-gray-900">
                        {item.change_type === "created"
                          ? "📝 Creada"
                          : item.change_type === "ingredient_added"
                          ? "➕ Ingrediente agregado"
                          : item.change_type === "ingredient_removed"
                          ? "➖ Ingrediente eliminado"
                          : "✏️ Ingrediente modificado"}
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(item.created_at).toLocaleDateString()} {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    <div className="text-sm text-gray-700">{item.change_detail}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CostsModal>

        {/* MODAL: Análisis de Variancia */}
        <CostsModal
          isOpen={mostrarAnalisisVariancia}
          title="Análisis de Variancia de Producción"
          maxWidth="2xl"
          onClose={() => {
            setMostrarAnalisisVariancia(false);
            setProductoAnalisis("");
            setRealAnalisis("");
            setIngredientesReales({});
            setVarianciaCalculada(null);
          }}
        >
          <div className="space-y-6">
            {/* Guía inicial */}
            <div className="bg-blue-100 border border-blue-300 rounded-lg p-3 text-sm text-blue-900">
              <div className="font-semibold mb-1">📋 Cómo usar este análisis:</div>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Selecciona el producto que produciste</li>
                <li>Ingresa la cantidad que produjiste (cantidad real)</li>
                <li>Ingresa cuánto de cada ingrediente usaste realmente</li>
                <li>Registra para guardar el análisis</li>
              </ol>
            </div>

            {/* Selector de producto */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                Selecciona Producto
                <Tooltip text="Elige el producto que quieres analizar. Si tiene ingredientes anidados (productos dentro de productos), verás el desglose completo." />
              </label>
              <FormSelect
                label=""
                value={productoAnalisis}
                onChange={(val) => {
                  setProductoAnalisis(val);
                  setVarianciaCalculada(null);
                }}
                options={
                  formulas.length === 0
                    ? [{ value: "", label: "Cargando productos..." }]
                    : formulas.map((f) => ({ value: f.id, label: f.name }))
                }
              />
            </div>

            {/* Si hay producto seleccionado, mostrar guía y máximo */}
            {productoAnalisis && !varianciaCalculada && (
              <>
                <div className="bg-blue-50 rounded-2xl p-4 border border-blue-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="font-semibold text-blue-900">CAPACIDAD MÁXIMA</div>
                    <Tooltip text="Es la cantidad máxima de este producto que puedes hacer con el stock disponible. Se basa en el ingrediente que escasea (cuello de botella)." />
                  </div>
                  <div className="text-2xl font-bold text-blue-700">
                    Máximo: {calcularMaximoProducible(productoAnalisis)} unidades
                  </div>
                </div>

                <div className="bg-green-100 border border-green-300 rounded-lg p-3 text-sm text-green-900">
                  <div className="font-semibold">✓ Ahora ingresa la cantidad real que produjiste</div>
                </div>
              </>
            )}

            {/* Input cantidad real */}
            <div>
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
                Cantidad Real Producida
                <Tooltip text="Ingresa exactamente cuántas unidades del producto lograste producir." />
              </label>
              <FormInput
                label=""
                type="number"
                value={realAnalisis}
                onChange={(val) => {
                  setRealAnalisis(val);
                  if (val && productoAnalisis) {
                    calcularVariancia(productoAnalisis, parseInt(val));
                  }
                }}
                placeholder={`Máximo: ${calcularMaximoProducible(productoAnalisis)} unidades`}
              />
            </div>

            {/* Si hay variancia calculada, mostrar árbol de ingredientes y inputs */}
            {varianciaCalculada && (
              <>
                {/* Árbol de ingredientes */}
                <div className="bg-green-50 rounded-2xl p-4 border border-green-200 space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="font-semibold text-green-900">🌳 DESGLOSE DE INGREDIENTES</div>
                    <Tooltip text="Aquí ves todos los ingredientes que necesitas (planeados) y cuánto realmente usaste. Verde = menos de lo planeado (ahorro), Rojo = más de lo planeado (desperdicio)." />
                  </div>
                  <div className="text-xs text-gray-700 bg-white bg-opacity-50 rounded p-2 mb-3">
                    <strong>Nota:</strong> La estructura muestra ingredientes en cascada. Productos con 📦 contienen otros ingredientes dentro.
                  </div>
                  <div className="space-y-0 border border-gray-200 rounded-lg overflow-hidden">
                    {construirArbolIngredientes(productoAnalisis, parseInt(realAnalisis))}
                  </div>
                </div>

                {/* Inputs de cantidad real */}
                <div className="bg-amber-50 rounded-2xl p-4 border border-amber-200 space-y-3">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="font-semibold text-amber-900">📝 INGREDIENTES USADOS</div>
                    <Tooltip text="Ingresa la cantidad REAL de cada ingrediente que usaste. El sistema comparará con lo planeado para calcular la variancia." />
                  </div>
                  <div className="text-xs text-gray-700 bg-white bg-opacity-50 rounded p-2 mb-3">
                    ⬇️ <strong>Completa estos campos</strong> con los valores reales que usaste de cada ingrediente. Si no ingresamos valores, usaremos los valores teóricos.
                  </div>
                  <div className="space-y-2">
                    {Object.entries(varianciaCalculada.ingredientes).map(
                      ([ingId, ingData]: [string, any]) => (
                        <div key={ingId}>
                          <label className="text-xs font-semibold text-gray-600 uppercase flex items-center gap-2">
                            {ingData.name}
                            <span className="font-normal text-gray-500">(Teórico: {ingData.planned.toFixed(2)} {ingData.unit})</span>
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            value={ingredientesReales[ingId] || ""}
                            onChange={(e) =>
                              setIngredientesReales({
                                ...ingredientesReales,
                                [ingId]: e.target.value,
                              })
                            }
                            placeholder={`${ingData.planned.toFixed(2)} ${ingData.unit}`}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                          />
                        </div>
                      )
                    )}
                  </div>
                </div>

                {/* Mostrar resumen de variancia */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-gray-700">RESULTADO DE VARIANCIA</div>
                    <Tooltip text="Positivo (%) = Produjiste MÁS de lo máximo posible (revisa ingredientes). Negativo (%) = Produjiste MENOS de lo máximo (ahorro)." />
                  </div>
                  <div
                    className={`p-4 rounded-lg ${
                      varianciaCalculada.porcentaje_variancia > 0
                        ? "bg-red-50 border border-red-200"
                        : "bg-green-50 border border-green-200"
                    }`}
                  >
                    <div className="text-sm mb-2">
                      {varianciaCalculada.real}/{varianciaCalculada.teórico} = <span className="font-bold text-lg">{varianciaCalculada.porcentaje_variancia}%</span>
                    </div>
                    <div className="text-xs text-gray-700">
                      {varianciaCalculada.porcentaje_variancia > 0
                        ? "⚠️ Variancia POSITIVA: Usaste más ingredientes de lo planeado"
                        : varianciaCalculada.porcentaje_variancia < 0
                        ? "✓ Variancia NEGATIVA: Ahorro en ingredientes"
                        : "= Variancia CERO: Exactamente como se planeó"}
                    </div>
                  </div>
                </div>

                {/* Botón registrar */}
                <button
                  className="btn btn-primary w-full"
                  onClick={registrarVariancia}
                  disabled={savingVariancia}
                >
                  {savingVariancia ? "Guardando..." : "✓ Registrar Variancia"}
                </button>
              </>
            )}
          </div>
        </CostsModal>

        {/* MODAL: Análisis de Variancia (Costos) */}
        <CostsModal
          isOpen={mostrarAnalisisVariancia}
          title="Análisis de Variancia - Costos de Producción"
          maxWidth="2xl"
          onClose={() => {
            setMostrarAnalisisVariancia(false);
            setProductoVariancia("");
            setCantidadProducida("");
            setIngredienteLotes({});
            setRawQtyText({});
            setVarianciaResultado(null);
            setErr(null);
            setSuccess(null);
          }}
        >
          <div className="space-y-6">
            {err && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">
                <div className="font-semibold flex items-center gap-2">
                  <AlertTriangle size={16} />
                  Error
                </div>
                <p className="mt-1">{err}</p>
              </div>
            )}

            {success && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                <div className="font-semibold">{success}</div>
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900">
              <div className="font-semibold mb-1 flex items-center gap-2">
                <Info size={16} />
                Cómo usar
              </div>
              <ol className="list-decimal list-inside space-y-1">
                <li>Selecciona el producto que produciste</li>
                <li>Ingresa la cantidad que produjiste</li>
                <li>Para cada ingrediente, selecciona el lote que usaste</li>
                <li>Revisa el desglose de costos y registra</li>
              </ol>
            </div>

            {!varianciaResultado ? (
              <>
                <div>
                  <label className="text-sm font-semibold text-gray-700 mb-2 block">Selecciona Producto *</label>
                  <FormSelect
                    label=""
                    value={productoVariancia}
                    onChange={setProductoVariancia}
                    options={formulas.map((f) => ({ value: f.id, label: f.name }))}
                  />
                </div>

                {productoVariancia && (
                  <>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 mb-2 block">Cantidad Producida *</label>
                      <FormInput
                        label=""
                        type="number"
                        value={cantidadProducida}
                        onChange={setCantidadProducida}
                        placeholder="Unidades"
                      />
                    </div>

                    {cantidadProducida && (
                      <>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm">
                          <div className="font-semibold text-blue-900 mb-2">Ingredientes requeridos:</div>
                          <div className="space-y-2 text-xs text-blue-800">
                            {formulas
                              .find((f) => f.id === productoVariancia)
                              ?.ingredients.map((ing) => (
                                <div key={ing.ingredient_id}>
                                  {ing.ingredient_name}: {(ing.quantity * parseFloat(cantidadProducida)).toFixed(2)} {ing.unit}
                                </div>
                              ))}
                          </div>
                        </div>

                        <div className="border-t pt-4">
                          <label className="text-sm font-semibold text-gray-700 mb-3 block">Selecciona lote para cada ingrediente *</label>
                          <div className="space-y-3">
                            {obtenerTodosLosIngredientes(
                              formulas.find((f) => f.id === productoVariancia)?.ingredients || []
                            ).map((ing) => (
                              <div
                                key={ing.id}
                                style={{ marginLeft: `${ing.level * 20}px` }}
                                className="space-y-2"
                              >
                                {ing.type === "RAW_MATERIAL" ? (
                                  <div className="space-y-2">
                                    <label className="text-sm font-semibold text-gray-700">
                                      {ing.name}
                                      {ing.stateName && (
                                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                                          Estado: {ing.stateName}
                                        </span>
                                      )}
                                      <span className="text-xs text-gray-500 ml-2">
                                        ({(getTotalRequiredQuantity(ing, parseFloat(cantidadProducida) || 0)).toFixed(2)} {batches.find((b) => b.id === ingredienteLotes[ing.id]?.[0]?.batchId)?.unit || "unidad"} requerido)
                                      </span>
                                    </label>

                                    {/* Lista de lotes seleccionados */}
                                    {ingredienteLotes[ing.id] && ingredienteLotes[ing.id].length > 0 && (
                                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 space-y-2 text-sm">
                                        <div className="font-semibold text-blue-900">
                                          Lotes seleccionados ({ingredienteLotes[ing.id].length})
                                        </div>
                                        {ingredienteLotes[ing.id].map((selection, idx) => {
                                          const batch = batches.find((b) => b.id === selection.batchId);
                                          return (
                                            <div key={idx} className="bg-white rounded p-2 border border-blue-200 flex justify-between items-center">
                                              <div className="flex-1">
                                                <div className="font-semibold text-gray-900">{batch?.lot_code}</div>
                                                <div className="text-xs text-gray-600 space-y-1">
                                                  <div>
                                                    📦 <span className="font-semibold">Stock:</span> {batch?.quantity_out.toFixed(2)} {batch?.unit}
                                                  </div>
                                                  <div>
                                                    💾 <span className="font-semibold">Usando:</span> {selection.quantity.toFixed(2)} {batch?.unit} × ${batch?.cost_per_unit.toFixed(2)}/u = $
                                                    {(selection.quantity * (batch?.cost_per_unit || 0)).toFixed(2)}
                                                  </div>
                                                </div>
                                              </div>
                                              <button
                                                onClick={() => {
                                                  const updated = ingredienteLotes[ing.id].filter((_, i) => i !== idx);
                                                  if (updated.length === 0) {
                                                    const newLotes = { ...ingredienteLotes };
                                                    delete newLotes[ing.id];
                                                    setIngredienteLotes(newLotes);
                                                  } else {
                                                    setIngredienteLotes({
                                                      ...ingredienteLotes,
                                                      [ing.id]: updated,
                                                    });
                                                  }
                                                }}
                                                className="text-red-600 hover:text-red-800 font-semibold text-sm ml-2"
                                              >
                                                ✕
                                              </button>
                                            </div>
                                          );
                                        })}
                                        {(() => {
                                          const total = ingredienteLotes[ing.id].reduce((sum, s) => sum + s.quantity, 0);
                                          const required = getTotalRequiredQuantity(ing, parseFloat(cantidadProducida) || 0);
                                          const unit = batches.find((b) => b.id === ingredienteLotes[ing.id][0]?.batchId)?.unit || "unidad";
                                          const percentage = required > 0 ? (total / required) * 100 : 0;
                                          const isExcess = total > required;
                                          const isComplete = total >= required;

                                          return (
                                            <div className="border-t border-blue-200 pt-2 space-y-2">
                                              <div className="flex justify-between items-center text-sm">
                                                <span className="font-semibold text-blue-900">
                                                  Total: {total.toFixed(2)} / {required.toFixed(2)} {unit}
                                                </span>
                                                <span
                                                  className={`text-xs font-semibold px-2 py-1 rounded ${
                                                    isExcess
                                                      ? "bg-red-100 text-red-800"
                                                      : isComplete
                                                      ? "bg-green-100 text-green-800"
                                                      : "bg-yellow-100 text-yellow-800"
                                                  }`}
                                                >
                                                  {isExcess ? "⚠️ Exceso" : isComplete ? "✓ Completo" : `${Math.round(percentage)}%`}
                                                </span>
                                              </div>
                                              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                                                <div
                                                  className={`h-full transition-all ${
                                                    isExcess ? "bg-red-500" : isComplete ? "bg-green-500" : "bg-blue-500"
                                                  }`}
                                                  style={{ width: `${Math.min(percentage, 100)}%` }}
                                                />
                                              </div>
                                              {isExcess && (
                                                <div className="text-xs text-red-700 bg-red-50 p-2 rounded">
                                                  ⚠️ Exceeds required by {(total - required).toFixed(2)} {unit}
                                                </div>
                                              )}
                                            </div>
                                          );
                                        })()}
                                      </div>
                                    )}

                                    {/* Selector para agregar más lotes */}
                                    <div className="space-y-2">
                                      <label className="text-xs font-semibold text-gray-600">Agregar lote</label>
                                      <select
                                        onChange={(e) => {
                                          if (e.target.value) {
                                            const newSelection = { batchId: e.target.value, quantity: 0 };
                                            setIngredienteLotes({
                                              ...ingredienteLotes,
                                              [ing.id]: [...(ingredienteLotes[ing.id] || []), newSelection],
                                            });
                                            e.target.value = "";
                                          }
                                        }}
                                        value=""
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                      >
                                        <option value="">Selecciona un lote...</option>
                                        {(() => {
                                          const filtered = batches
                                            .filter((b) => b.raw_material_id === ing.parentId && b.quantity_out > 0)
                                            .filter((b) => !ing.stateId || b.to_state_id === ing.stateId)
                                            .filter((b) => !ingredienteLotes[ing.id]?.some((sel) => sel.batchId === b.id));

                                          if (filtered.length === 0) {
                                            return (
                                              <option value="" disabled>
                                                ⚠️ No hay lotes disponibles{ing.stateName ? ` en estado "${ing.stateName}"` : ""}
                                              </option>
                                            );
                                          }

                                          return filtered.map((batch) => (
                                            <option key={batch.id} value={batch.id}>
                                              📦 {batch.lot_code} | 📊 {batch.quantity_out.toFixed(2)} {batch.unit} | 💵 ${batch.cost_per_unit.toFixed(2)}/u {batch.state_name ? `| ${batch.state_name}` : ""}
                                            </option>
                                          ));
                                        })()}
                                      </select>
                                    </div>

                                    {/* Input de cantidad para el último lote agregado */}
                                    {ingredienteLotes[ing.id] && ingredienteLotes[ing.id].length > 0 && (
                                      <div className="space-y-1">
                                        <label className="text-xs font-semibold text-gray-600">
                                          Cantidad del último lote
                                        </label>
                                        <div className="flex gap-2">
                                          <input
                                            type="text"
                                            inputMode="decimal"
                                            value={rawQtyText[ing.id] ?? (ingredienteLotes[ing.id][ingredienteLotes[ing.id].length - 1].quantity === 0 ? "" : String(ingredienteLotes[ing.id][ingredienteLotes[ing.id].length - 1].quantity))}
                                            onChange={(e) => {
                                              const lastIdx = ingredienteLotes[ing.id].length - 1;
                                              const rawValue = e.target.value;

                                              // Solo permitir dígitos, punto y coma
                                              if (!/^[\d.,]*$/.test(rawValue)) return;
                                              // No más de un separador decimal
                                              const normalized = rawValue.replace(",", ".");
                                              if ((normalized.match(/\./g) || []).length > 1) return;

                                              // Guardar el texto tal cual (permite "0.", "0.0", etc.)
                                              setRawQtyText({ ...rawQtyText, [ing.id]: rawValue });

                                              // Solo actualizar el número cuando sea parseable
                                              const numValue = parseFloat(normalized);
                                              if (!isNaN(numValue)) {
                                                const updated = [...ingredienteLotes[ing.id]];
                                                updated[lastIdx].quantity = numValue;
                                                setIngredienteLotes({ ...ingredienteLotes, [ing.id]: updated });
                                              }
                                            }}
                                            onBlur={() => {
                                              // Al salir, limpiar el texto raw para que muestre el número final
                                              setRawQtyText((prev) => {
                                                const next = { ...prev };
                                                delete next[ing.id];
                                                return next;
                                              });
                                            }}
                                            placeholder="0.00"
                                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                          />
                                          <div className="text-xs text-gray-600 bg-gray-50 rounded px-2 py-2 whitespace-nowrap">
                                            {(() => {
                                              const lastIdx = ingredienteLotes[ing.id].length - 1;
                                              const batch = batches.find(
                                                (b) => b.id === ingredienteLotes[ing.id][lastIdx].batchId
                                              );
                                              const qtyInOtherBatches = ingredienteLotes[ing.id]
                                                .slice(0, lastIdx)
                                                .reduce((sum, sel) => sum + sel.quantity, 0);
                                              const required = getTotalRequiredQuantity(ing, parseFloat(cantidadProducida) || 0);
                                              const maxByFormula = required - qtyInOtherBatches;
                                              const maxByBatch = batch?.quantity_out || 0;
                                              const maxQty = Math.min(maxByFormula, maxByBatch);
                                              return `Máx: ${maxQty.toFixed(2)}`;
                                            })()}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div className="p-2 bg-blue-50 border-l-4 border-blue-300 rounded text-sm text-blue-900">
                                    <div className="font-semibold">📦 {ing.name}</div>
                                    <div className="text-xs text-blue-700">
                                      {ing.level === 0 ? "Producto principal" : "Producto anidado"}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>

                        <button
                          className="btn btn-primary w-full"
                          onClick={calcularVarianciaCostos}
                          disabled={
                            !Object.keys(ingredienteLotes).length ||
                            Object.keys(ingredienteLotes).length !==
                              obtenerTodosLosIngredientes(
                                formulas.find((f) => f.id === productoVariancia)?.ingredients || []
                              ).filter((ing) => ing.type === "RAW_MATERIAL").length ||
                            Object.values(ingredienteLotes).some(
                              (selections) =>
                                selections.length === 0 ||
                                selections.some((sel) => !sel.batchId || !sel.quantity || sel.quantity <= 0)
                            )
                          }
                        >
                          Calcular Costos
                        </button>
                      </>
                    )}
                  </>
                )}
              </>
            ) : (
              <>
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="font-semibold text-green-900 mb-2">✓ Desglose de Costos</div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Producto:</span>
                      <div className="font-semibold">{varianciaResultado.producto_nombre}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Cantidad:</span>
                      <div className="font-semibold">{varianciaResultado.cantidad_producida} unidades</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Costo Total:</span>
                      <div className="font-semibold text-green-700">${varianciaResultado.cost_estimated.toFixed(2)}</div>
                    </div>
                    <div>
                      <span className="text-gray-600">Costo/Unidad:</span>
                      <div className="font-semibold text-green-700">${varianciaResultado.cost_per_unit.toFixed(2)}</div>
                    </div>
                  </div>
                </div>

                <div>
                  <CostBreakdown
                    breakdown={varianciaResultado.cost_breakdown}
                    totalCost={varianciaResultado.cost_estimated}
                    costPerUnit={varianciaResultado.cost_per_unit}
                    unit="unidad"
                    showVariance={false}
                  />
                </div>

                <div className="flex gap-2">
                  <button
                    className="btn btn-primary flex-1"
                    onClick={guardarVariancia}
                    disabled={savingVariancia}
                  >
                    {savingVariancia ? "Guardando..." : "✓ Registrar Variancia"}
                  </button>
                  <button
                    className="btn btn-secondary flex-1"
                    onClick={() => {
                      setVarianciaResultado(null);
                      setIngredienteLotes({});
                    }}
                    disabled={savingVariancia}
                  >
                    Modificar
                  </button>
                </div>
              </>
            )}
          </div>
        </CostsModal>

        {/* ────── TAB: REPORTES ────── */}
        {activeTab === "reportes" && (
          <div className="space-y-6">
            {/* Guía de uso */}
            <div className="bg-blue-100 border border-blue-300 rounded-lg p-4 text-sm text-blue-900">
              <div className="font-semibold mb-2 flex items-center gap-2">
                <Info size={18} />
                Como usar esta sección
              </div>
              <ol className="list-decimal list-inside space-y-1 text-xs">
                <li>Selecciona una pestaña para ver un tipo de análisis diferente</li>
                <li>Resumen: Vista general de merma y producción</li>
                <li>Merma: Detalle de todas las pérdidas registradas</li>
                <li>Producción: Historial de productos fabricados</li>
                <li>Variancia: Análisis de diferencias entre lo planeado y lo real</li>
              </ol>
            </div>

            {/* Sub-tabs de Reportes */}
            <div className="flex gap-2 border-b border-gray-200 pb-4">
              <button
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  reportesTab === "resumen"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                onClick={() => {
                  setReportesTab("resumen");
                  if (dataMerma.length === 0 && dataProduccion.length === 0) {
                    cargarReportes();
                  }
                }}
              >
                📊 Resumen
              </button>
              <button
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  reportesTab === "merma"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                onClick={() => {
                  setReportesTab("merma");
                  if (dataMerma.length === 0) {
                    cargarReportes();
                  }
                }}
              >
                ⚠️ Merma
              </button>
              <button
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  reportesTab === "produccion"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                onClick={() => {
                  setReportesTab("produccion");
                  if (dataProduccion.length === 0) {
                    cargarReportes();
                  }
                }}
              >
                🏭 Producción
              </button>
              <button
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  reportesTab === "variancia"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                onClick={() => {
                  setReportesTab("variancia");
                  if (dataProduccion.length === 0) {
                    cargarReportes();
                  }
                }}
              >
                📈 Variancia
              </button>
              <button
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  reportesTab === "costos"
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-600 hover:bg-gray-100"
                }`}
                onClick={() => {
                  setReportesTab("costos");
                  if (dataVariancia.length === 0) {
                    cargarReportes();
                  }
                }}
              >
                💰 Costos
              </button>
            </div>

            {/* RESUMEN */}
            {reportesTab === "resumen" && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900">Resumen General</h3>
                
                {loadingReportes ? (
                  <p className="text-gray-500">Cargando datos...</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Total Merma */}
                    <div className="bg-gradient-to-br from-red-50 to-orange-50 rounded-2xl p-4 border border-red-200">
                      <div className="text-sm text-red-700 font-medium mb-2">Total Merma</div>
                      <div className="text-2xl font-bold text-red-900">
                        {dataMerma.reduce((sum: number, item: any) => sum + item.cantidad_merma, 0).toFixed(2)}
                      </div>
                      <div className="text-xs text-red-600 mt-2">
                        {dataMerma.length} registros
                      </div>
                    </div>

                    {/* Materia Prima Más Mermada */}
                    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-4 border border-amber-200">
                      <div className="text-sm text-amber-700 font-medium mb-2">Más Mermada</div>
                      <div className="text-lg font-bold text-amber-900 truncate">
                        {dataMerma.length > 0
                          ? dataMerma.reduce((max: any, item: any) =>
                              item.cantidad_merma > (max?.cantidad_merma || 0) ? item : max
                            )?.material_name
                          : "N/A"}
                      </div>
                    </div>

                    {/* Total Productos */}
                    <div className="bg-gradient-to-br from-blue-50 to-cyan-50 rounded-2xl p-4 border border-blue-200">
                      <div className="text-sm text-blue-700 font-medium mb-2">Total Productos</div>
                      <div className="text-2xl font-bold text-blue-900">
                        {dataProduccion.length}
                      </div>
                      <div className="text-xs text-blue-600 mt-2">fórmulas registradas</div>
                    </div>

                    {/* Producto con Más Ingredientes */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-4 border border-green-200">
                      <div className="text-sm text-green-700 font-medium mb-2">Más Ingredientes</div>
                      <div className="text-lg font-bold text-green-900 truncate">
                        {dataProduccion.length > 0
                          ? dataProduccion.reduce((max: any, item: any) =>
                              item.total_ingredientes > (max?.total_ingredientes || 0) ? item : max
                            )?.product_name
                          : "N/A"}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* MERMA */}
            {reportesTab === "merma" && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900">Análisis de Merma</h3>

                {loadingReportes ? (
                  <p className="text-gray-500">Cargando datos...</p>
                ) : dataMerma.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay registros de merma aún.
                  </div>
                ) : (
                  <>
                    {/* Tabla de Mermas */}
                    <div className="overflow-x-auto rounded-2xl border border-gray-200">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold text-gray-900">Fecha</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-900">Materia Prima</th>
                            <th className="px-4 py-3 text-left font-semibold text-gray-900">Estado</th>
                            <th className="px-4 py-3 text-right font-semibold text-gray-900">Cantidad</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dataMerma.slice(0, 10).map((item: any, idx: number) => (
                            <tr
                              key={item.id}
                              className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                            >
                              <td className="px-4 py-3 text-gray-900">
                                {new Date(item.created_at).toLocaleDateString()}
                              </td>
                              <td className="px-4 py-3 text-gray-900 font-medium">
                                {item.material_name}
                              </td>
                              <td className="px-4 py-3 text-gray-600">{item.state_name}</td>
                              <td className="px-4 py-3 text-right font-semibold text-red-600">
                                {item.cantidad_merma} {item.unit}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {dataMerma.length > 10 && (
                      <p className="text-sm text-gray-500 text-center">
                        Mostrando 10 de {dataMerma.length} registros
                      </p>
                    )}
                  </>
                )}
              </div>
            )}

            {/* PRODUCCIÓN */}
            {reportesTab === "produccion" && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900">Análisis de Producción</h3>

                {loadingReportes ? (
                  <p className="text-gray-500">Cargando datos...</p>
                ) : dataProduccion.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay productos registrados aún.
                  </div>
                ) : (
                  <>
                    {/* Tabla de Productos */}
                    <div className="overflow-x-auto rounded-2xl border border-gray-200">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 border-b border-gray-200">
                          <tr>
                            <th className="px-4 py-3 text-left font-semibold text-gray-900">Producto</th>
                            <th className="px-4 py-3 text-right font-semibold text-gray-900">Ingredientes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {dataProduccion
                            .sort((a: any, b: any) => b.total_ingredientes - a.total_ingredientes)
                            .map((item: any, idx: number) => (
                              <tr
                                key={item.product_id}
                                className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}
                              >
                                <td className="px-4 py-3 text-gray-900 font-medium">
                                  {item.product_name}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold">
                                    {item.total_ingredientes}
                                  </span>
                                </td>
                              </tr>
                            ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* VARIANCIA */}
            {/* ── REPORTE DE COSTOS ── */}
            {reportesTab === "costos" && (() => {
              // Filtrar dataVariancia por producto y fechas
              const base = dataVariancia.filter((row: any) => {
                if (reportesCostosFiltroProducto && row.product_id !== reportesCostosFiltroProducto) return false;
                if (reportesCostosFiltroDesde) {
                  const rowDate = new Date(row.variance_date ?? row.created_at);
                  if (rowDate < new Date(reportesCostosFiltroDesde)) return false;
                }
                if (reportesCostosFiltroHasta) {
                  const rowDate = new Date(row.variance_date ?? row.created_at);
                  if (rowDate > new Date(reportesCostosFiltroHasta + "T23:59:59")) return false;
                }
                return true;
              });

              // KPIs por producto
              const byProduct: Record<string, { name: string; rows: any[] }> = {};
              for (const row of base) {
                if (!byProduct[row.product_id]) byProduct[row.product_id] = { name: row.product_name, rows: [] };
                byProduct[row.product_id].rows.push(row);
              }
              const productStats = Object.entries(byProduct).map(([pid, { name, rows }]) => {
                const costos = rows.map((r: any) => r.cost_per_unit ?? (r.quantity_produced > 0 ? r.cost_estimated / r.quantity_produced : 0));
                const avg = costos.length > 0 ? costos.reduce((a, b) => a + b, 0) / costos.length : 0;
                const min = costos.length > 0 ? Math.min(...costos) : 0;
                const max = costos.length > 0 ? Math.max(...costos) : 0;
                const totalUnidades = rows.reduce((s: number, r: any) => s + (r.quantity_produced ?? 0), 0);
                const totalCosto = rows.reduce((s: number, r: any) => s + (r.cost_estimated ?? 0), 0);
                return { pid, name, avg, min, max, totalUnidades, totalCosto, count: rows.length };
              }).sort((a, b) => b.avg - a.avg);

              const masCaros = productStats.slice(0, 3);
              const masBaratos = [...productStats].sort((a, b) => a.avg - b.avg).slice(0, 3);
              const totalGlobalCosto = base.reduce((s: number, r: any) => s + (r.cost_estimated ?? 0), 0);
              const totalGlobalUnidades = base.reduce((s: number, r: any) => s + (r.quantity_produced ?? 0), 0);

              return (
                <div className="space-y-6">
                  <h3 className="text-xl font-bold text-gray-900">💰 Reporte de Costos de Producción</h3>

                  {/* Filtros */}
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3">
                    <div className="text-sm font-semibold text-gray-700">Filtros</div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Producto</label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={reportesCostosFiltroProducto}
                          onChange={(e) => setReportesCostosFiltroProducto(e.target.value)}
                        >
                          <option value="">— Todos —</option>
                          {Array.from(new Set(dataVariancia.map((r: any) => r.product_id))).map((pid: any) => {
                            const name = dataVariancia.find((r: any) => r.product_id === pid)?.product_name ?? pid;
                            return <option key={pid} value={pid}>{name}</option>;
                          })}
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Desde</label>
                        <input
                          type="date"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={reportesCostosFiltroDesde}
                          onChange={(e) => setReportesCostosFiltroDesde(e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600 mb-1 block">Hasta</label>
                        <input
                          type="date"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={reportesCostosFiltroHasta}
                          onChange={(e) => setReportesCostosFiltroHasta(e.target.value)}
                        />
                      </div>
                    </div>
                    {(reportesCostosFiltroProducto || reportesCostosFiltroDesde || reportesCostosFiltroHasta) && (
                      <button
                        className="text-xs text-blue-600 hover:underline"
                        onClick={() => { setReportesCostosFiltroProducto(""); setReportesCostosFiltroDesde(""); setReportesCostosFiltroHasta(""); }}
                      >
                        Limpiar filtros
                      </button>
                    )}
                  </div>

                  {loadingReportes ? (
                    <p className="text-gray-500">Cargando...</p>
                  ) : base.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                      <div className="text-4xl mb-2">📭</div>
                      <p>Sin datos para el filtro seleccionado</p>
                    </div>
                  ) : (
                    <>
                      {/* KPIs globales */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
                          <div className="text-xs text-gray-500 mb-1">Producciones</div>
                          <div className="text-2xl font-bold text-blue-700">{base.length}</div>
                        </div>
                        <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
                          <div className="text-xs text-gray-500 mb-1">Unidades producidas</div>
                          <div className="text-2xl font-bold text-green-700">{totalGlobalUnidades}</div>
                        </div>
                        <div className="bg-purple-50 border border-purple-200 rounded-xl p-4 text-center">
                          <div className="text-xs text-gray-500 mb-1">Costo total</div>
                          <div className="text-lg font-bold text-purple-700">
                            ${totalGlobalCosto.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                          </div>
                        </div>
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
                          <div className="text-xs text-gray-500 mb-1">Costo/unidad prom.</div>
                          <div className="text-lg font-bold text-amber-700">
                            ${totalGlobalUnidades > 0
                              ? (totalGlobalCosto / totalGlobalUnidades).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                              : "—"}
                          </div>
                        </div>
                      </div>

                      {/* Más caros / más baratos */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="bg-white border border-gray-200 rounded-xl p-4">
                          <div className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            🔴 Productos con mayor costo/unidad
                          </div>
                          <div className="space-y-2">
                            {masCaros.map((p, i) => (
                              <div key={p.pid} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-400 font-mono w-4">{i + 1}.</span>
                                  <span className="font-medium text-gray-900 truncate max-w-[140px]">{p.name}</span>
                                </div>
                                <span className="font-bold text-red-700">
                                  ${p.avg.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                            {masCaros.length === 0 && <p className="text-xs text-gray-400">Sin datos</p>}
                          </div>
                        </div>

                        <div className="bg-white border border-gray-200 rounded-xl p-4">
                          <div className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                            🟢 Productos con menor costo/unidad
                          </div>
                          <div className="space-y-2">
                            {masBaratos.map((p, i) => (
                              <div key={p.pid} className="flex items-center justify-between text-sm">
                                <div className="flex items-center gap-2">
                                  <span className="text-gray-400 font-mono w-4">{i + 1}.</span>
                                  <span className="font-medium text-gray-900 truncate max-w-[140px]">{p.name}</span>
                                </div>
                                <span className="font-bold text-green-700">
                                  ${p.avg.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                              </div>
                            ))}
                            {masBaratos.length === 0 && <p className="text-xs text-gray-400">Sin datos</p>}
                          </div>
                        </div>
                      </div>

                      {/* Tabla completa por producto */}
                      <div>
                        <div className="font-semibold text-gray-700 mb-3">Detalle por producto</div>
                        <div className="overflow-x-auto rounded-xl border border-gray-200">
                          <table className="w-full text-sm">
                            <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                              <tr>
                                <th className="px-4 py-3 text-left">Producto</th>
                                <th className="px-4 py-3 text-right">Producciones</th>
                                <th className="px-4 py-3 text-right">Unidades</th>
                                <th className="px-4 py-3 text-right">Costo/ud mín</th>
                                <th className="px-4 py-3 text-right">Costo/ud prom</th>
                                <th className="px-4 py-3 text-right">Costo/ud máx</th>
                                <th className="px-4 py-3 text-right">Costo total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {productStats.map((p) => (
                                <tr key={p.pid} className="hover:bg-gray-50">
                                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                                  <td className="px-4 py-3 text-right text-gray-600">{p.count}</td>
                                  <td className="px-4 py-3 text-right text-gray-600">{p.totalUnidades}</td>
                                  <td className="px-4 py-3 text-right text-green-700">
                                    ${p.min.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-4 py-3 text-right font-bold text-blue-700">
                                    ${p.avg.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-4 py-3 text-right text-red-700">
                                    ${p.max.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  </td>
                                  <td className="px-4 py-3 text-right font-bold text-gray-900">
                                    ${p.totalCosto.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              );
            })()}

            {reportesTab === "variancia" && (
              <div className="space-y-6">
                <h3 className="text-xl font-bold text-gray-900">Análisis de Variancia</h3>

                {loadingReportes ? (
                  <p className="text-gray-500">Cargando datos...</p>
                ) : dataVariancia.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No hay registros de variancia aún. Comienza en tab Producción → "Analizar Variancia"
                  </div>
                ) : (
                  <div className="space-y-4">
                    {dataVariancia.map((item: any) => (
                      <div
                        key={item.id}
                        className={`rounded-2xl border p-4 ${
                          item.variance_percentage > 0
                            ? "bg-red-50 border-red-200"
                            : item.variance_percentage < -5
                            ? "bg-green-50 border-green-200"
                            : "bg-blue-50 border-blue-200"
                        }`}
                      >
                        {/* Header */}
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <div className="font-bold text-gray-900">
                              {item.product_name}
                            </div>
                            <div className="text-xs text-gray-600 mt-1">
                              {item.fecha} {item.hora}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold">
                              {item.variance_percentage > 0 ? "+" : ""}
                              {item.variance_percentage}%
                            </div>
                            <div className="text-xs text-gray-600">
                              {item.quantity_real}/{item.quantity_planned} unidades
                            </div>
                          </div>
                        </div>

                        {/* Variancia por ingrediente */}
                        {item.ingredients_variance && (
                          <div className="mt-3 pt-3 border-t border-gray-300/30">
                            <div className="text-xs font-semibold text-gray-700 mb-2">
                              Ingredientes:
                            </div>
                            <div className="space-y-1">
                              {Object.entries(item.ingredients_variance).map(
                                ([ingId, ingData]: [string, any]) => (
                                  <div
                                    key={ingId}
                                    className="flex justify-between items-center text-xs bg-white/50 rounded px-2 py-1"
                                  >
                                    <div className="font-medium">{ingData.name}</div>
                                    <div className="text-right">
                                      <div className="font-semibold">
                                        {ingData.real.toFixed(2)} / {ingData.planned.toFixed(2)} {ingData.unit}
                                      </div>
                                      <div
                                        className={`text-xs font-bold ${
                                          parseFloat(ingData.variance_percentage) > 0
                                            ? "text-red-600"
                                            : "text-green-600"
                                        }`}
                                      >
                                        {parseFloat(ingData.variance_percentage) > 0 ? "+" : ""}
                                        {ingData.variance_percentage}%
                                      </div>
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        {/* ────── TAB: HISTORIAL DE COSTOS (Opción D) ────── */}
        {activeTab === "historial" && (
          <div className="space-y-6">
            {/* Encabezado */}
            <div className="flex justify-between items-center">
              <div>
                <h3 className="text-xl font-bold text-gray-900">📊 Historial de Costos</h3>
                <p className="text-sm text-gray-500 mt-1">Consulta el costo de producción por producto a lo largo del tiempo</p>
              </div>
              <button
                className="btn btn-primary text-sm"
                onClick={cargarHistorial}
                disabled={loadingHistorialCostos}
              >
                {loadingHistorialCostos ? "Cargando..." : "🔄 Actualizar"}
              </button>
            </div>

            {/* Sub-tabs */}
            <div className="flex gap-2 border-b border-gray-200">
              {([
                { id: "por-producto", label: "📋 Por Producto" },
                { id: "variancia-acumulada", label: "📉 Variancia Acumulada" },
                { id: "tendencias", label: "📈 Tendencias" },
              ] as const).map((t) => (
                <button
                  key={t.id}
                  className={`px-4 py-2 rounded-t-lg font-medium text-sm transition -mb-px border-b-2 ${
                    historialTab === t.id
                      ? "border-blue-600 text-blue-700"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                  onClick={() => setHistorialTab(t.id)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Filtro de producto (compartido entre sub-tabs) */}
            <div className="flex gap-3 items-center">
              <label className="text-sm font-semibold text-gray-700 whitespace-nowrap">Filtrar por producto:</label>
              <select
                className="flex-1 max-w-xs px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={historialProductoFiltro}
                onChange={(e) => setHistorialProductoFiltro(e.target.value)}
              >
                <option value="">— Todos los productos —</option>
                {Array.from(new Set(historialData.map((d) => d.product_id))).map((pid) => {
                  const name = historialData.find((d) => d.product_id === pid)?.product_name ?? pid;
                  return <option key={pid as string} value={pid as string}>{name}</option>;
                })}
              </select>
              {historialProductoFiltro && (
                <button
                  className="text-xs text-gray-500 hover:text-gray-700 underline"
                  onClick={() => setHistorialProductoFiltro("")}
                >
                  Limpiar
                </button>
              )}
            </div>

            {loadingHistorialCostos ? (
              <div className="text-center py-12 text-gray-500">Cargando historial...</div>
            ) : historialData.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <div className="text-4xl mb-3">📭</div>
                <p className="font-semibold">Sin registros</p>
                <p className="text-sm mt-1">Registra una producción en Opción C para ver el historial aquí</p>
              </div>
            ) : (
              <>
                {/* ── SUB-TAB: POR PRODUCTO ── */}
                {historialTab === "por-producto" && (() => {
                  const filtrado = historialProductoFiltro
                    ? historialData.filter((d) => d.product_id === historialProductoFiltro)
                    : historialData;

                  return (
                    <div className="space-y-4">
                      <p className="text-xs text-gray-500">{filtrado.length} registros encontrados</p>
                      <div className="overflow-x-auto rounded-xl border border-gray-200">
                        <table className="w-full text-sm">
                          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                            <tr>
                              <th className="px-4 py-3 text-left">Fecha</th>
                              <th className="px-4 py-3 text-left">Producto</th>
                              <th className="px-4 py-3 text-right">Cantidad</th>
                              <th className="px-4 py-3 text-right">Costo/Unidad</th>
                              <th className="px-4 py-3 text-right">Costo Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {filtrado.map((row: any, idx: number) => (
                              <tr key={row.id ?? idx} className="hover:bg-gray-50">
                                <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{row.fecha_display}</td>
                                <td className="px-4 py-3 font-medium text-gray-900">{row.product_name}</td>
                                <td className="px-4 py-3 text-right text-gray-700">{row.quantity_produced}</td>
                                <td className="px-4 py-3 text-right font-semibold text-blue-700">
                                  ${(row.cost_per_unit ?? 0).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                                <td className="px-4 py-3 text-right font-bold text-green-700">
                                  ${(row.cost_estimated ?? 0).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-gray-50 border-t-2 border-gray-200">
                            <tr>
                              <td colSpan={2} className="px-4 py-3 font-bold text-gray-700">Total</td>
                              <td className="px-4 py-3 text-right font-bold text-gray-900">
                                {filtrado.reduce((s: number, r: any) => s + (r.quantity_produced ?? 0), 0)} uds
                              </td>
                              <td className="px-4 py-3 text-right text-gray-500 text-xs">
                                Prom: ${filtrado.length > 0
                                  ? (filtrado.reduce((s: number, r: any) => s + (r.cost_per_unit ?? 0), 0) / filtrado.length).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                  : "0.00"}
                              </td>
                              <td className="px-4 py-3 text-right font-bold text-green-700">
                                ${filtrado.reduce((s: number, r: any) => s + (r.cost_estimated ?? 0), 0).toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  );
                })()}

                {/* ── SUB-TAB: VARIANCIA ACUMULADA ── */}
                {historialTab === "variancia-acumulada" && (() => {
                  // Agrupar por producto
                  const byProduct: Record<string, any[]> = {};
                  for (const row of historialData) {
                    if (historialProductoFiltro && row.product_id !== historialProductoFiltro) continue;
                    if (!byProduct[row.product_id]) byProduct[row.product_id] = [];
                    byProduct[row.product_id].push(row);
                  }

                  return (
                    <div className="space-y-4">
                      {Object.entries(byProduct).map(([pid, rows]) => {
                        const nombre = rows[0]?.product_name ?? pid;
                        const totalUnidades = rows.reduce((s, r) => s + (r.quantity_produced ?? 0), 0);
                        const totalCosto = rows.reduce((s, r) => s + (r.cost_estimated ?? 0), 0);
                        const costos = rows.map((r) => r.cost_per_unit ?? 0).filter((c) => c > 0);
                        const costoMin = costos.length > 0 ? Math.min(...costos) : 0;
                        const costoMax = costos.length > 0 ? Math.max(...costos) : 0;
                        const costoPromedio = costos.length > 0 ? costos.reduce((a, b) => a + b, 0) / costos.length : 0;
                        const variacionPct = costoMin > 0 ? ((costoMax - costoMin) / costoMin * 100) : 0;

                        return (
                          <div key={pid} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-gray-900 text-lg">{nombre}</h4>
                              <span className="text-xs text-gray-500">{rows.length} producciones registradas</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                              <div className="bg-blue-50 rounded-lg p-3 text-center">
                                <div className="text-xs text-gray-500 mb-1">Total unidades</div>
                                <div className="text-xl font-bold text-blue-700">{totalUnidades}</div>
                              </div>
                              <div className="bg-green-50 rounded-lg p-3 text-center">
                                <div className="text-xs text-gray-500 mb-1">Costo total</div>
                                <div className="text-lg font-bold text-green-700">
                                  ${totalCosto.toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                </div>
                              </div>
                              <div className="bg-purple-50 rounded-lg p-3 text-center">
                                <div className="text-xs text-gray-500 mb-1">Costo/unidad prom.</div>
                                <div className="text-lg font-bold text-purple-700">
                                  ${costoPromedio.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </div>
                              </div>
                              <div className={`rounded-lg p-3 text-center ${variacionPct > 15 ? "bg-red-50" : "bg-emerald-50"}`}>
                                <div className="text-xs text-gray-500 mb-1">Variación de costo</div>
                                <div className={`text-lg font-bold ${variacionPct > 15 ? "text-red-700" : "text-emerald-700"}`}>
                                  {variacionPct.toFixed(1)}%
                                </div>
                              </div>
                            </div>

                            <div className="flex gap-4 text-sm text-gray-600">
                              <span>Costo mín: <strong className="text-gray-900">${costoMin.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                              <span>Costo máx: <strong className="text-gray-900">${costoMax.toLocaleString("es-CO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                            </div>

                            {variacionPct > 15 && (
                              <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
                                ⚠️ Variación alta ({variacionPct.toFixed(1)}%): Los costos de este producto fluctúan significativamente. Revisa los precios de las materias primas.
                              </div>
                            )}
                          </div>
                        );
                      })}

                      {Object.keys(byProduct).length === 0 && (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          No hay datos para el filtro seleccionado
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* ── SUB-TAB: TENDENCIAS ── */}
                {historialTab === "tendencias" && (() => {
                  const byProduct: Record<string, any[]> = {};
                  for (const row of [...historialData].reverse()) {
                    if (historialProductoFiltro && row.product_id !== historialProductoFiltro) continue;
                    if (!byProduct[row.product_id]) byProduct[row.product_id] = [];
                    byProduct[row.product_id].push(row);
                  }

                  return (
                    <div className="space-y-6">
                      {Object.entries(byProduct).map(([pid, rows]) => {
                        const nombre = rows[0]?.product_name ?? pid;
                        const costos = rows.map((r) => r.cost_per_unit ?? 0);
                        const maxCosto = Math.max(...costos, 1);

                        // Tendencia: comparar primera mitad vs segunda mitad
                        const mitad = Math.floor(rows.length / 2);
                        const promPrimera = mitad > 0
                          ? costos.slice(0, mitad).reduce((a, b) => a + b, 0) / mitad
                          : costos[0] ?? 0;
                        const promSegunda = costos.length - mitad > 0
                          ? costos.slice(mitad).reduce((a, b) => a + b, 0) / (costos.length - mitad)
                          : costos[costos.length - 1] ?? 0;
                        const tendencia = promSegunda - promPrimera;

                        return (
                          <div key={pid} className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="font-bold text-gray-900">{nombre}</h4>
                              <span className={`text-sm font-semibold px-3 py-1 rounded-full ${
                                tendencia < -0.5 ? "bg-green-100 text-green-700"
                                : tendencia > 0.5 ? "bg-red-100 text-red-700"
                                : "bg-gray-100 text-gray-600"
                              }`}>
                                {tendencia < -0.5 ? "↓ Bajando" : tendencia > 0.5 ? "↑ Subiendo" : "→ Estable"}
                              </span>
                            </div>

                            {/* Mini gráfico de barras */}
                            <div className="space-y-1">
                              <div className="text-xs text-gray-500 mb-2">Costo por unidad — evolución cronológica</div>
                              <div className="flex items-end gap-1 h-24">
                                {rows.map((row, idx) => {
                                  const pct = maxCosto > 0 ? (row.cost_per_unit ?? 0) / maxCosto : 0;
                                  const height = Math.max(4, Math.round(pct * 96));
                                  const isLast = idx === rows.length - 1;
                                  return (
                                    <div
                                      key={row.id ?? idx}
                                      className="flex-1 flex flex-col items-center justify-end group relative"
                                      title={`${row.fecha_display}: $${(row.cost_per_unit ?? 0).toLocaleString("es-CO", { minimumFractionDigits: 2 })}`}
                                    >
                                      <div
                                        className={`w-full rounded-t transition-all ${
                                          isLast ? "bg-blue-500" : pct > 0.85 ? "bg-red-400" : pct < 0.5 ? "bg-green-400" : "bg-blue-300"
                                        }`}
                                        style={{ height: `${height}px` }}
                                      />
                                      <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 whitespace-nowrap z-10">
                                        ${(row.cost_per_unit ?? 0).toLocaleString("es-CO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                              <div className="flex justify-between text-xs text-gray-400">
                                <span>{rows[0]?.fecha_display}</span>
                                <span>{rows[rows.length - 1]?.fecha_display}</span>
                              </div>
                            </div>

                            {rows.length < 3 && (
                              <p className="text-xs text-gray-400 italic">
                                💡 Se necesitan al menos 3 producciones para ver una tendencia clara
                              </p>
                            )}
                          </div>
                        );
                      })}

                      {Object.keys(byProduct).length === 0 && (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          No hay datos para el filtro seleccionado
                        </div>
                      )}
                    </div>
                  );
                })()}
              </>
            )}
          </div>
        )}

        {activeTab === "alertas" && (
          <div className="space-y-6">
            {/* Sub-tabs */}
            <div className="flex gap-2 border-b border-gray-200">
              <button
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition -mb-px ${
                  alertasTab === "notificaciones" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => setAlertasTab("notificaciones")}
              >
                🔔 Notificaciones {alertasNoLeidas > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs px-1.5 py-0.5 rounded-full">{alertasNoLeidas}</span>
                )}
              </button>
              <button
                className={`px-4 py-2 text-sm font-semibold border-b-2 transition -mb-px ${
                  alertasTab === "configurar" ? "border-blue-600 text-blue-700" : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
                onClick={() => { setAlertasTab("configurar"); if (thresholds.length === 0) cargarThresholds(); }}
              >
                ⚙️ Configurar Umbrales
              </button>
            </div>

            {/* ── SUB-TAB: NOTIFICACIONES ── */}
            {alertasTab === "notificaciones" && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-xl font-bold text-gray-900">
                    Alertas {alertasNoLeidas > 0 && (
                      <span className="ml-2 inline-block bg-red-100 text-red-700 px-3 py-1 rounded-full text-sm font-semibold">
                        {alertasNoLeidas} nuevas
                      </span>
                    )}
                  </h3>
                  <button className="btn btn-primary text-sm" onClick={obtenerAlertas} disabled={loadingAlertas}>
                    {loadingAlertas ? "Cargando..." : "🔄 Recargar"}
                  </button>
                </div>

                <div className="flex gap-2">
                  {(["todas", "red", "yellow"] as const).map((f) => (
                    <button
                      key={f}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        filtroAlertas === f ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                      }`}
                      onClick={() => setFiltroAlertas(f)}
                    >
                      {f === "todas" ? "Todas" : f === "red" ? "🔴 Críticas" : "🟡 Advertencias"}
                    </button>
                  ))}
                </div>

                {loadingAlertas ? (
                  <p className="text-gray-500">Cargando alertas...</p>
                ) : alertas.filter((a) => filtroAlertas === "todas" || a.severity === filtroAlertas).length === 0 ? (
                  <div className="rounded-2xl border-2 border-dashed border-green-300 p-12 text-center bg-green-50">
                    <Bell size={60} className="mx-auto mb-4 text-green-300" strokeWidth={1.5} />
                    <h3 className="text-xl font-bold text-green-900 mb-2">Sin alertas activas</h3>
                    <p className="text-green-700">Todo está bajo control ✓</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-gray-200">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-4 py-3 text-left font-semibold text-gray-900">Severidad</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-900">Tipo</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-900">Mensaje</th>
                          <th className="px-4 py-3 text-left font-semibold text-gray-900">Fecha</th>
                          <th className="px-4 py-3 text-center font-semibold text-gray-900">Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {alertas
                          .filter((a) => filtroAlertas === "todas" || a.severity === filtroAlertas)
                          .map((alerta: any, idx: number) => (
                            <tr
                              key={alerta.id}
                              className={`${idx % 2 === 0 ? "bg-white" : "bg-gray-50"} ${!alerta.is_read ? "border-l-4 border-l-blue-500" : ""}`}
                            >
                              <td className="px-4 py-3">
                                {alerta.severity === "red" ? <span className="text-2xl">🔴</span> : <span className="text-2xl">🟡</span>}
                              </td>
                              <td className="px-4 py-3 font-medium text-gray-900">
                                {alerta.type === "merma_anormal" ? "Merma Anormal"
                                  : alerta.type === "stock_bajo" ? "Stock Bajo"
                                  : alerta.type === "umbral_costo" ? "Costo Alto"
                                  : "Sin Stock"}
                              </td>
                              <td className="px-4 py-3 text-gray-700">{alerta.message}</td>
                              <td className="px-4 py-3 text-gray-600 text-xs">
                                {new Date(alerta.created_at).toLocaleDateString("es-CO")}<br />
                                {new Date(alerta.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </td>
                              <td className="px-4 py-3 text-center space-x-2">
                                {!alerta.is_read && (
                                  <button className="text-blue-600 hover:text-blue-800 font-medium text-xs" onClick={() => marcarAlertaLeida(alerta.id)} title="Marcar como leída">✓</button>
                                )}
                                <button className="text-red-600 hover:text-red-800 font-medium text-xs" onClick={() => eliminarAlerta(alerta.id)} title="Eliminar">✕</button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ── SUB-TAB: CONFIGURAR UMBRALES ── */}
            {alertasTab === "configurar" && (
              <div className="space-y-5">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">Umbrales de Alerta</h3>
                    <p className="text-sm text-gray-500 mt-1">El sistema generará alertas automáticamente cuando se superen estos límites</p>
                  </div>
                  <button
                    className="btn btn-primary text-sm"
                    onClick={() => setShowAddThreshold(!showAddThreshold)}
                  >
                    {showAddThreshold ? "Cancelar" : "+ Nuevo Umbral"}
                  </button>
                </div>

                {/* Nota SQL */}
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
                  <strong>⚠️ Prerequisito:</strong> Ejecuta la migración <code>003_create_alert_thresholds.sql</code> en Supabase SQL Editor antes de usar esta función.
                </div>

                {err && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-800">{err}</div>
                )}

                {/* Formulario nuevo umbral */}
                {showAddThreshold && (
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 space-y-4">
                    <div className="font-semibold text-blue-900">Configurar nuevo umbral</div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">Materia Prima *</label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={thresholdMaterial}
                          onChange={(e) => { setThresholdMaterial(e.target.value); setThresholdState(""); }}
                        >
                          <option value="">— Seleccionar —</option>
                          {materialesPrimas.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">Estado (opcional)</label>
                        <select
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={thresholdState}
                          onChange={(e) => setThresholdState(e.target.value)}
                          disabled={!thresholdMaterial}
                        >
                          <option value="">— Todos los estados —</option>
                          {(statesByMaterial[thresholdMaterial] ?? []).map((s: any) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">
                          Stock mínimo ({thresholdMaterial ? (materialesPrimas.find(m => m.id === thresholdMaterial)?.unit ?? "u") : "u"})
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="ej: 5"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={thresholdMinStock}
                          onChange={(e) => setThresholdMinStock(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">Alerta si stock baja de este valor</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">Costo máximo por unidad ($)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="ej: 5000"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={thresholdMaxCost}
                          onChange={(e) => setThresholdMaxCost(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">Alerta si el costo supera este valor</p>
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-gray-700 mb-1 block">Merma máxima (%)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="ej: 20"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                          value={thresholdMaxWaste}
                          onChange={(e) => setThresholdMaxWaste(e.target.value)}
                        />
                        <p className="text-xs text-gray-500 mt-1">Alerta si la merma supera este %</p>
                      </div>
                    </div>

                    <button
                      className="btn btn-primary w-full"
                      onClick={guardarThreshold}
                      disabled={savingThreshold}
                    >
                      {savingThreshold ? "Guardando..." : "💾 Guardar Umbral"}
                    </button>
                  </div>
                )}

                {/* Lista de umbrales */}
                {loadingThresholds ? (
                  <p className="text-gray-500 text-sm">Cargando umbrales...</p>
                ) : thresholds.length === 0 ? (
                  <div className="text-center py-10 border-2 border-dashed border-gray-200 rounded-xl text-gray-400">
                    <div className="text-3xl mb-2">⚙️</div>
                    <p className="font-semibold">Sin umbrales configurados</p>
                    <p className="text-sm mt-1">Agrega umbrales para recibir alertas automáticas</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {thresholds.map((t: any) => (
                      <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-4 flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <div className="font-semibold text-gray-900">
                            {t.material_name}
                            {t.state_name && <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{t.state_name}</span>}
                          </div>
                          <div className="flex flex-wrap gap-3 text-xs text-gray-600">
                            {t.min_stock != null && (
                              <span className="bg-red-50 border border-red-200 rounded px-2 py-1">
                                📉 Stock mín: <strong>{t.min_stock} {t.material_unit}</strong>
                              </span>
                            )}
                            {t.max_cost_per_unit != null && (
                              <span className="bg-amber-50 border border-amber-200 rounded px-2 py-1">
                                💰 Costo máx: <strong>${t.max_cost_per_unit.toLocaleString("es-CO")}/{t.material_unit}</strong>
                              </span>
                            )}
                            {t.max_waste_pct != null && (
                              <span className="bg-orange-50 border border-orange-200 rounded px-2 py-1">
                                ⚠️ Merma máx: <strong>{t.max_waste_pct}%</strong>
                              </span>
                            )}
                          </div>
                        </div>
                        <button
                          className="text-red-500 hover:text-red-700 text-sm font-medium shrink-0"
                          onClick={() => eliminarThreshold(t.id)}
                          title="Eliminar umbral"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </PageShell>

      {/* MODAL: Crear Materia Prima */}
      <CostsModal
        isOpen={showAddMaterial}
        title="Crear Materia Prima"
        onClose={() => {
          setShowAddMaterial(false);
          setNewMaterialName("");
          setNewMaterialUnit("kg");
          setNewMaterialDesc("");
          setNewMaterialInitialState("Cruda");
        }}
        actions={[
          {
            label: "Cancelar",
            onClick: () => {
              setShowAddMaterial(false);
              setNewMaterialName("");
              setNewMaterialUnit("kg");
              setNewMaterialDesc("");
              setNewMaterialInitialState("Cruda");
            },
            variant: "secondary",
          },
          {
            label: savingMaterial ? "Creando..." : "Crear",
            onClick: crearMaterial,
            variant: "primary",
            disabled: savingMaterial,
          },
        ]}
      >
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 mb-4">
          <div className="font-semibold mb-1 flex items-center gap-2">
            <Info size={16} />
            Información
          </div>
          <p>Crea una nueva materia prima que necesitas para producir. Luego podrás registrar su inventario y estados.</p>
        </div>

        <FormInput
          label="Nombre"
          value={newMaterialName}
          onChange={setNewMaterialName}
          placeholder="Ej: Carne cruda"
          disabled={savingMaterial}
        />
        <FormSelect
          label="Unidad de medida"
          value={newMaterialUnit}
          onChange={setNewMaterialUnit}
          options={[
            { value: "kg", label: "Kilogramos (kg)" },
            { value: "g", label: "Gramos (g)" },
            { value: "l", label: "Litros (l)" },
            { value: "ml", label: "Mililitros (ml)" },
            { value: "u", label: "Unidades (u)" },
          ]}
          disabled={savingMaterial}
        />
        <FormInput
          label="Descripción (opcional)"
          value={newMaterialDesc}
          onChange={setNewMaterialDesc}
          placeholder="Notas sobre esta materia prima..."
          disabled={savingMaterial}
        />
        <div className="border-t border-gray-200 pt-4">
          <FormInput
            label="Estado inicial"
            value={newMaterialInitialState}
            onChange={setNewMaterialInitialState}
            placeholder="Ej: Cruda, Fresca, Congelada"
            disabled={savingMaterial}
          />
          <div className="text-xs text-gray-500 mt-1">
            Este será el primer estado de la materia prima al recibirla.
          </div>
        </div>
      </CostsModal>

      {/* MODAL: Crear Estado */}
      <CostsModal
        isOpen={showAddState}
        title="Crear Estado"
        onClose={() => {
          setShowAddState(false);
          setNewStateName("");
        }}
        actions={[
          {
            label: "Cancelar",
            onClick: () => {
              setShowAddState(false);
              setNewStateName("");
            },
            variant: "secondary",
          },
          {
            label: savingState ? "Creando..." : "Crear",
            onClick: crearEstado,
            variant: "primary",
            disabled: savingState,
          },
        ]}
      >
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 mb-4">
          <div className="font-semibold mb-1 flex items-center gap-2">
            <Info size={16} />
            Información
          </div>
          <p>Crea nuevos estados para una materia prima. Por ejemplo: Cruda, Cocida, Molida. Podrás registrar inventario en cada estado.</p>
        </div>

        <FormInput
          label="Nombre del Estado"
          value={newStateName}
          onChange={setNewStateName}
          placeholder="Ej: Cruda, Cocinada, Molida"
          disabled={savingState}
        />
        <div className="text-xs text-gray-500">
          El orden se asignará automáticamente al final de la secuencia.
        </div>
      </CostsModal>

      {/* MODAL: Editar Materia Prima */}
      <CostsModal
        isOpen={editingMaterial !== null}
        title={`Editar: ${editingMaterial?.name}`}
        onClose={() => {
          setEditingMaterial(null);
          setEditMaterialName("");
          setEditMaterialUnit("");
          setEditMaterialDesc("");
        }}
        actions={[
          {
            label: "Cancelar",
            onClick: () => {
              setEditingMaterial(null);
              setEditMaterialName("");
              setEditMaterialUnit("");
              setEditMaterialDesc("");
            },
            variant: "secondary",
          },
          {
            label: savingEditMaterial ? "Guardando..." : "Guardar",
            onClick: guardarEditarMaterial,
            variant: "primary",
            disabled: savingEditMaterial,
          },
        ]}
      >
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 mb-4">
          <div className="font-semibold mb-1 flex items-center gap-2">
            <Info size={16} />
            Información
          </div>
          <p>Modifica los detalles básicos de esta materia prima. Los cambios se aplican a todos los registros existentes.</p>
        </div>

        <FormInput
          label="Nombre"
          value={editMaterialName}
          onChange={setEditMaterialName}
          disabled={savingEditMaterial}
        />
        <FormSelect
          label="Unidad de medida"
          value={editMaterialUnit}
          onChange={setEditMaterialUnit}
          options={[
            { value: "kg", label: "Kilogramos (kg)" },
            { value: "g", label: "Gramos (g)" },
            { value: "l", label: "Litros (l)" },
            { value: "ml", label: "Mililitros (ml)" },
            { value: "u", label: "Unidades (u)" },
          ]}
          disabled={savingEditMaterial}
        />
        <FormInput
          label="Descripción"
          value={editMaterialDesc}
          onChange={setEditMaterialDesc}
          placeholder="Notas sobre esta materia prima..."
          disabled={savingEditMaterial}
        />
      </CostsModal>

      {/* MODAL: Editar Estado */}
      <CostsModal
        isOpen={editingState !== null}
        title={`Editar Estado: ${editingState?.name}`}
        onClose={() => {
          setEditingState(null);
          setEditStateName("");
        }}
        actions={[
          {
            label: "Cancelar",
            onClick: () => {
              setEditingState(null);
              setEditStateName("");
            },
            variant: "secondary",
          },
          {
            label: savingEditState ? "Guardando..." : "Guardar",
            onClick: guardarEditarEstado,
            variant: "primary",
            disabled: savingEditState,
          },
        ]}
      >
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-900 mb-4">
          <div className="font-semibold mb-1 flex items-center gap-2">
            <Info size={16} />
            Información
          </div>
          <p>Modifica el nombre de este estado. El cambio se aplicará a todos los registros que usan este estado.</p>
        </div>

        <FormInput
          label="Nombre del Estado"
          value={editStateName}
          onChange={setEditStateName}
          disabled={savingEditState}
        />
      </CostsModal>
    </div>
  );
}
