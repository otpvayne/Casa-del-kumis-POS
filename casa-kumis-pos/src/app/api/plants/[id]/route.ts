import { supabase } from "@/lib/supabaseClient";
import { NextRequest, NextResponse } from "next/server";
import { deleteMockPlant } from "@/lib/mockPlants";

const USE_MOCK = process.env.NODE_ENV === "development";

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Plant ID is required" },
        { status: 400 }
      );
    }

    // En desarrollo, intentar Supabase primero, luego mock
    if (USE_MOCK) {
      try {
        const { error } = await supabase
          .from("plants")
          .delete()
          .eq("id", id);

        if (!error) {
          return NextResponse.json({ success: true });
        }
      } catch (err) {
        console.log("Supabase not available, using mock plants");
      }

      // Fallback a mock
      const success = deleteMockPlant(id);
      if (success) {
        return NextResponse.json({ success: true });
      } else {
        return NextResponse.json(
          { error: "Plant not found" },
          { status: 404 }
        );
      }
    }

    // En producción, solo usar Supabase
    const { error } = await supabase
      .from("plants")
      .delete()
      .eq("id", id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting plant:", error);
    return NextResponse.json(
      { error: "Failed to delete plant" },
      { status: 500 }
    );
  }
}
