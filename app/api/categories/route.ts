import { NextResponse } from "next/server";
import { sql, query } from "@/lib/db";
import { getCurrentUser, isOfficialUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const categories = await sql`
      SELECT
        c.id,
        c.name,
        c.description,
        c.color,
        COALESCE(c.allocated_budget, 0) AS allocated_budget,
        COALESCE(SUM(e.amount), 0)      AS total_spent,
        COUNT(e.id)                     AS expense_count
      FROM categories c
      LEFT JOIN expenses e ON e.category = c.name
      GROUP BY c.id
      ORDER BY c.name ASC
    `;
    return NextResponse.json({ success: true, categories });
  } catch (error) {
    console.error("Categories GET error:", error);
    return NextResponse.json({ error: "Failed to load categories." }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized access. Please log in." }, { status: 401 });
    if (!isOfficialUser(user)) return NextResponse.json({ error: "Forbidden: SK Officials only." }, { status: 403 });

    const body = await request.json();
    const name = body.name?.trim();
    const description = body.description?.trim() || "";
    const color = body.color?.trim() || "blue";
    const allocated_budget = parseFloat(body.allocated_budget) || 0;

    if (!name) return NextResponse.json({ error: "Category name is required." }, { status: 400 });

    const existing = await sql`SELECT id FROM categories WHERE LOWER(name) = LOWER(${name})`;
    if (existing.length > 0) return NextResponse.json({ error: "A category with this name already exists." }, { status: 400 });

    const result = await sql`
      INSERT INTO categories (name, description, color, allocated_budget)
      VALUES (${name}, ${description}, ${color}, ${allocated_budget})
      RETURNING *
    `;

    return NextResponse.json({ success: true, category: result[0], message: `Category "${name}" created successfully.` });
  } catch (error) {
    console.error("Categories POST error:", error);
    return NextResponse.json({ error: "Failed to create category." }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized access. Please log in." }, { status: 401 });
    if (!isOfficialUser(user)) return NextResponse.json({ error: "Forbidden: SK Officials only." }, { status: 403 });

    const body = await request.json();
    const id = Number(body.id);
    const newName = body.name?.trim();
    const description = body.description?.trim() || "";
    const color = body.color?.trim() || "blue";
    const allocated_budget = parseFloat(body.allocated_budget) || 0;

    if (!id || !newName) return NextResponse.json({ error: "Category ID and name are required." }, { status: 400 });

    const oldRows = await sql`SELECT id, name FROM categories WHERE id = ${id}`;
    if (oldRows.length === 0) return NextResponse.json({ error: "Category not found." }, { status: 404 });
    const oldCategory = oldRows[0] as { id: number; name: string };

    const conflict = await sql`SELECT id FROM categories WHERE LOWER(name) = LOWER(${newName}) AND id != ${id}`;
    if (conflict.length > 0) return NextResponse.json({ error: "Another category already exists with that name." }, { status: 400 });

    await sql`
      UPDATE categories SET name = ${newName}, description = ${description}, color = ${color}, allocated_budget = ${allocated_budget}
      WHERE id = ${id}
    `;

    if (oldCategory.name !== newName) {
      await sql`UPDATE expenses SET category = ${newName} WHERE category = ${oldCategory.name}`;
    }

    const updated = await sql`SELECT * FROM categories WHERE id = ${id}`;
    return NextResponse.json({ success: true, category: updated[0], message: `Category "${newName}" updated successfully.` });
  } catch (error) {
    console.error("Categories PUT error:", error);
    return NextResponse.json({ error: "Failed to update category." }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized access. Please log in." }, { status: 401 });
    if (!isOfficialUser(user)) return NextResponse.json({ error: "Forbidden: SK Officials only." }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get("id"));
    if (!id) return NextResponse.json({ error: "Category ID is required." }, { status: 400 });

    const catRows = await sql`SELECT id, name FROM categories WHERE id = ${id}`;
    if (catRows.length === 0) return NextResponse.json({ error: "Category not found." }, { status: 404 });
    const category = catRows[0] as { id: number; name: string };

    const usage = await sql`SELECT COUNT(*) AS count FROM expenses WHERE category = ${category.name}`;
    const count = Number((usage[0] as { count: number }).count);
    if (count > 0) {
      return NextResponse.json({
        error: `Cannot delete "${category.name}" because it has ${count} recorded expense(s). Please reassign or edit them first.`,
      }, { status: 400 });
    }

    await sql`DELETE FROM categories WHERE id = ${id}`;
    return NextResponse.json({ success: true, message: `Category "${category.name}" deleted successfully.` });
  } catch (error) {
    console.error("Categories DELETE error:", error);
    return NextResponse.json({ error: "Failed to delete category." }, { status: 500 });
  }
}
