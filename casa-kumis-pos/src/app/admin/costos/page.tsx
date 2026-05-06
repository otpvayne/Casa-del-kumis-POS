"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { requireRole } from "@/lib/requireRole";
import PageShell from "@/components/PageShell";
import LoadingCard from "@/components/LoadingCard";
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

type Tab = "materias-primas" | "produccion" | "formulas" | "reportes" | "alertas";

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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("materias-primas");
  const [err, setErr] = useState<string | null>(null);

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
  const [wasteType, setWasteType] = useState("");
  const [wasteQty, setWasteQty] = useState("");
  const [wasteReason, setWasteReason] = useState("");
  const [savingWaste, setSavingWaste] = useState(false);
  const [wasteTypes, setWasteTypes] = useState<Array<{ id: string; name: string; code: string }>>([]);

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

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: "materias-primas", label: "Materias Primas", icon: "📦" },
    { id: "produccion", label: "Producción", icon: "🏭" },
    { id: "formulas", label: "Fórmulas", icon: "📋" },
    { id: "reportes", label: "Reportes", icon: "📊" },
    { id: "alertas", label: "Alertas", icon: "🔔" },
  ];

  useEffect(() => {
    const run = async () => {
      const role = await requireRole("ADMIN");
      if (!role.ok) return router.replace("/admin");

      await cargarMaterialesPrimas();
      setLoading(false);
    };
    run().catch((e: any) => {
      setErr(e?.message ?? "Error cargando datos.");
      setLoading(false);
    });
  }, [router]);

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

  // Cargar tipos de merma y productos
  const cargarDatosProduccion = async () => {
    try {
      const { data: types } = await supabase.from("waste_types").select("*").eq("is_active", true);
      setWasteTypes(types ?? []);

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
    }
    if (activeTab === "formulas") {
      cargarFormulas();
    }
  }, [activeTab]);

  // REGISTRAR ENTRADA INICIAL
  const registrarEntrada = async () => {
    if (!selectedMaterial || !selectedState || !entradaCantidad) {
      setErr("Selecciona material, estado y cantidad.");
      return;
    }

    const qty = parseFloat(entradaCantidad);
    const cost = entradaCosto ? parseFloat(entradaCosto) : null;

    if (isNaN(qty) || qty <= 0) {
      setErr("Cantidad debe ser mayor a 0.");
      return;
    }

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
            batch_date: new Date().toISOString().split("T")[0],
            supplier_name: entradaProveedor || null,
            lot_code: entradaLote || null,
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
        await supabase
          .from("raw_material_inventory")
          .update({ quantity: (invData[0].quantity || 0) + qty, last_updated: new Date().toISOString() })
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
      setErr(null);
    } catch (e: any) {
      setErr(e.message ?? "Error registrando entrada.");
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
      setErr(null);
    } catch (e: any) {
      setErr(e.message ?? "Error registrando transformación.");
    } finally {
      setSavingTransform(false);
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
    } catch (e: any) {
      setErr(e.message ?? "Error cargando fórmulas.");
    }
  };

  // Crear nueva fórmula
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
          <CostsTabs tabs={TABS} activeTab={activeTab} onTabChange={(tab) => setActiveTab(tab as Tab)} />
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

            {/* Materias primas list */}
            <CostsCard
              title="Materias Primas"
              subtitle={`${materialesPrimas.length} materia(s) prima(s) registrada(s)`}
              action={
                <button className="btn btn-primary" onClick={() => setShowAddMaterial(true)}>
                  + Crear
                </button>
              }
            >
              {materialesPrimas.length === 0 ? (
                <EmptyState
                  icon="📦"
                  title="Sin materias primas"
                  description="Crea tu primera materia prima para comenzar."
                  action={<button className="btn btn-primary" onClick={() => setShowAddMaterial(true)}>+ Crear materia prima</button>}
                />
              ) : (
                <div className="space-y-2">
                  {materialesPrimas.map((mat) => (
                    <div key={mat.id} className="rounded-2xl border border-gray-200 p-4">
                      <div className="flex items-start justify-between gap-4 mb-3">
                        <div>
                          <div className="font-extrabold text-gray-900">{mat.name}</div>
                          <div className="text-sm text-gray-500 mt-1">{mat.description || "Sin descripción"}</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge label={mat.unit} color="blue" size="sm" />
                          <button
                            className="btn text-sm"
                            onClick={() => abrirEditarMaterial(mat)}
                          >
                            Editar
                          </button>
                          <button
                            className="btn text-sm text-red-600"
                            onClick={() => eliminarMaterial(mat.id)}
                          >
                            Eliminar
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
                            className="btn btn-primary text-sm w-full"
                            onClick={() => {
                              setSelectedMaterialForStates(mat.id);
                              setShowAddState(true);
                            }}
                          >
                            + Agregar estado
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
                        <div className="flex gap-2">
                          <button className="btn text-sm" onClick={() => abrirEditarEstado(state)}>
                            Editar
                          </button>
                          <button
                            className="btn text-sm text-red-600"
                            onClick={() => eliminarEstado(state.id, selectedMaterialForStates)}
                          >
                            Eliminar
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
            {/* Selector de tipo de registro */}
            <CostsCard>
              <div className="flex flex-wrap gap-2">
                {[
                  { id: "entrada", label: "📥 Entrada Inicial", color: "bg-blue-50 border-blue-200" },
                  { id: "transformacion", label: "🔄 Transformación", color: "bg-purple-50 border-purple-200" },
                  { id: "merma", label: "⚠️ Merma Adicional", color: "bg-red-50 border-red-200" },
                  { id: "produccion", label: "🏭 Producción", color: "bg-emerald-50 border-emerald-200" },
                ].map((tipo) => (
                  <button
                    key={tipo.id}
                    onClick={() => setTipoRegistro(tipo.id as any)}
                    className={`px-4 py-2 rounded-2xl border font-semibold text-sm transition ${
                      tipoRegistro === tipo.id
                        ? `${tipo.color} border-current`
                        : "bg-white border-gray-200 text-gray-600 hover:border-gray-300"
                    }`}
                  >
                    {tipo.label}
                  </button>
                ))}
              </div>
            </CostsCard>

            {/* ENTRADA INICIAL */}
            {tipoRegistro === "entrada" && (
              <CostsCard title="Registrar Entrada Inicial" subtitle="Agrega una nueva cantidad de materia prima recibida">
                <div className="space-y-4">
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

                  <FormInput
                    label="Cantidad"
                    value={entradaCantidad}
                    onChange={setEntradaCantidad}
                    type="number"
                    placeholder="0"
                    disabled={savingEntrada}
                  />

                  <FormInput
                    label="Costo Total (opcional)"
                    value={entradaCosto}
                    onChange={setEntradaCosto}
                    type="number"
                    placeholder="$0"
                    disabled={savingEntrada}
                  />

                  <FormInput
                    label="Proveedor (opcional)"
                    value={entradaProveedor}
                    onChange={setEntradaProveedor}
                    placeholder="Nombre del proveedor"
                    disabled={savingEntrada}
                  />

                  <FormInput
                    label="Código de Lote (opcional)"
                    value={entradaLote}
                    onChange={setEntradaLote}
                    placeholder="Ej: LOTE-001"
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
              <CostsCard title="Registrar Merma Adicional" subtitle="Registra pérdidas no esperadas (daño, desperdicio, etc.)">
                <div className="space-y-4">
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3">
                    <p className="text-sm text-blue-700">
                      <strong>Nota:</strong> Esto descuenta cantidad del inventario. Usa esto para ajustar cuando se pierde producto
                      durante la producción.
                    </p>
                  </div>

                  <FormSelect
                    label="Tipo de Merma"
                    value={wasteType}
                    onChange={setWasteType}
                    options={wasteTypes.map((w) => ({ value: w.id, label: `${w.name} (${w.code})` }))}
                    disabled={savingWaste}
                  />

                  <FormInput
                    label="Cantidad Pérdida"
                    value={wasteQty}
                    onChange={setWasteQty}
                    type="number"
                    placeholder="0"
                    disabled={savingWaste}
                  />

                  <FormInput
                    label="Razón / Observaciones"
                    value={wasteReason}
                    onChange={setWasteReason}
                    placeholder="¿Por qué se perdió?"
                    disabled={savingWaste}
                  />

                  <button
                    className="btn btn-primary w-full"
                    onClick={() => setErr("Funcionalidad en desarrollo")}
                    disabled={savingWaste}
                  >
                    {savingWaste ? "Registrando..." : "Registrar Merma"}
                  </button>
                </div>
              </CostsCard>
            )}

            {/* PRODUCCIÓN */}
            {tipoRegistro === "produccion" && (
              <CostsCard title="Registrar Producción" subtitle="Registra cuántos productos se hicieron">
                <div className="space-y-4">
                  <FormSelect
                    label="Producto"
                    value={produceProduct}
                    onChange={setProduceProduct}
                    options={products.map((p) => ({ value: p.id, label: p.name }))}
                    disabled={savingProduce}
                  />

                  <FormInput
                    label="Cantidad Producida"
                    value={produceQty}
                    onChange={setProduceQty}
                    type="number"
                    placeholder="0"
                    disabled={savingProduce}
                  />

                  <FormInput
                    label="Observaciones (opcional)"
                    value={produceObservations}
                    onChange={setProduceObservations}
                    placeholder="Notas sobre esta producción..."
                    disabled={savingProduce}
                  />

                  <button
                    className="btn btn-primary w-full"
                    onClick={() => setErr("Funcionalidad en desarrollo")}
                    disabled={savingProduce}
                  >
                    {savingProduce ? "Registrando..." : "Registrar Producción"}
                  </button>
                </div>
              </CostsCard>
            )}
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

            <div className="grid grid-cols-3 gap-6">
              {/* LISTA DE FÓRMULAS */}
              <div className="col-span-1">
                <CostsCard
                  title="Fórmulas"
                  subtitle={`${formulas.length} producto(s)`}
                  action={
                    <button className="btn btn-primary" onClick={() => setShowCreateFormula(true)}>
                      + Crear
                    </button>
                  }
                >
                  {formulas.length === 0 ? (
                    <EmptyState
                      icon="📋"
                      title="Sin fórmulas"
                      description="Crea tu primer producto para comenzar."
                      action={
                        <button className="btn btn-primary" onClick={() => setShowCreateFormula(true)}>
                          + Crear fórmula
                        </button>
                      }
                    />
                  ) : (
                    <div className="space-y-2">
                      {formulas.map((formula) => (
                        <button
                          key={formula.id}
                          onClick={() => setSelectedFormula(formula)}
                          className={`w-full text-left rounded-2xl border p-3 transition ${
                            selectedFormula?.id === formula.id
                              ? "border-blue-600 bg-blue-50"
                              : "border-gray-200 bg-white hover:border-gray-300"
                          }`}
                        >
                          <div className="font-semibold text-gray-900">{formula.name}</div>
                          <div className="text-xs text-gray-500 mt-1">
                            {formula.ingredients.length} ingrediente(s)
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </CostsCard>
              </div>

              {/* DETALLES DE FÓRMULA SELECCIONADA */}
              <div className="col-span-2">
                {selectedFormula ? (
                  <CostsCard
                    title={selectedFormula.name}
                    subtitle={selectedFormula.description || "Sin descripción"}
                    action={
                      <button
                        className="btn text-sm text-red-600"
                        onClick={() => eliminarFormula(selectedFormula.id)}
                      >
                        Eliminar
                      </button>
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
                            className="btn btn-primary text-sm"
                            onClick={() => setShowAddIngredient(true)}
                          >
                            + Agregar
                          </button>
                        </div>

                        {selectedFormula.ingredients.length === 0 ? (
                          <div className="bg-gray-50 rounded-2xl p-4 border border-dashed border-gray-300 text-center">
                            <p className="text-sm text-gray-500">Sin ingredientes definidos</p>
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
                                    {ing.quantity} {ing.unit}
                                    <span className="mx-1">•</span>
                                    <Badge
                                      label={ing.ingredient_type === "RAW_MATERIAL" ? "Materia Prima" : "Producto"}
                                      color={ing.ingredient_type === "RAW_MATERIAL" ? "blue" : "purple"}
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
                          className="w-full bg-amber-50 border border-amber-200 rounded-2xl p-4 text-left hover:bg-amber-100 transition"
                          onClick={abrirAnalisis}
                        >
                          <div className="text-sm font-semibold text-amber-900 mb-2">📊 Calcular Análisis de Producción</div>
                          <p className="text-xs text-amber-700">
                            ¿Cuántos productos puedes hacer? ¿Qué ingrediente te limita? Haz clic para saber.
                          </p>
                        </button>
                      )}
                    </div>
                  </CostsCard>
                ) : (
                  <CostsCard>
                    <EmptyState
                      icon="📋"
                      title="Selecciona una fórmula"
                      description="Elige una fórmula de la lista para ver y editar sus ingredientes."
                    />
                  </CostsCard>
                )}
              </div>
            </div>

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
                  <FormInput
                    label="¿Cuántos productos quieres producir?"
                    value={analisisQty}
                    onChange={setAnalisisQty}
                    type="number"
                    placeholder="100"
                  />
                  <div className="bg-blue-50 border border-blue-200 rounded-2xl p-3">
                    <p className="text-xs text-blue-700">
                      Ingresa la cantidad y te mostraré cuántos puedes hacer realmente basado en tu stock actual.
                    </p>
                  </div>
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

        {/* ────── TAB: REPORTES ────── */}
        {activeTab === "reportes" && (
          <EmptyState
            icon="📊"
            title="Reportes"
            description="Consulta gráficos de merma, rendimiento y costos de producción."
          />
        )}

        {/* ────── TAB: ALERTAS ────── */}
        {activeTab === "alertas" && (
          <EmptyState
            icon="🔔"
            title="Alertas"
            description="Aquí aparecerán alertas de stock bajo, mermas anormales y variancies."
          />
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