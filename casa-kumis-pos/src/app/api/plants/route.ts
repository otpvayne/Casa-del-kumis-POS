import { supabase } from "@/lib/supabaseClient";
import { NextRequest, NextResponse } from "next/server";
import { getMockPlants, createMockPlant } from "@/lib/mockPlants";

const USE_MOCK = process.env.NODE_ENV === "development";

export async function GET(request: NextRequest) {
  try {
    // En desarrollo, intentar Supabase primero, luego mock
    if (USE_MOCK) {
      try {
        const { data, error } = await supabase
          .from("plants")
          .select("id, name, is_active")
          .eq("is_active", true)
          .order("name");

        if (!error) {
          return NextResponse.json(data || []);
        }
      } catch (err) {
        console.log("Supabase not available, using mock plants");
      }

      // Fallback a mock
      const mockPlants = getMockPlants();
      return NextResponse.json(mockPlants);
    }

    // En producción, solo usar Supabase
    const { data, error } = await supabase
      .from("plants")
      .select("id, name, is_active")
      .eq("is_active", true)
      .order("name");

    if (error) throw error;

    return NextResponse.json(data || []);
  } catch (error) {
    console.error("Error fetching plants:", error);
    return NextResponse.json(
      { error: "Failed to fetch plants" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== "string" || name.trim() === "") {
      return NextResponse.json(
        { error: "Plant name is required and must be a non-empty string" },
        { status: 400 }
      );
    }

    // En desarrollo, intentar Supabase primero, luego mock
    if (USE_MOCK) {
      try {
        const { data, error } = await supabase
          .from("plants")
          .insert([{ name: name.trim(), is_active: true }])
          .select();

        if (!error && data) {
          return NextResponse.json(data[0], { status: 201 });
        }
      } catch (err) {
        console.log("Supabase not available, using mock plants");
      }

      // Fallback a mock
      const newPlant = createMockPlant(name.trim());
      return NextResponse.json(newPlant, { status: 201 });
    }

    // En producción, solo usar Supabase
    const { data, error } = await supabase
      .from("plants")
      .insert([{ name: name.trim(), is_active: true }])
      .select();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json(
          { error: "Plant with this name already exists" },
          { status: 409 }
        );
      }
      throw error;
    }

    return NextResponse.json(data[0], { status: 201 });
  } catch (error) {
    console.error("Error creating plant:", error);
    return NextResponse.json(
      { error: "Failed to create plant" },
      { status: 500 }
    );
  }
}
