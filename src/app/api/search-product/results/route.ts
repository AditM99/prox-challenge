import { NextResponse } from "next/server";
import { searchForManual } from "@/lib/web-scraper";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const { productName } = await request.json();

    if (!productName || typeof productName !== "string") {
      return NextResponse.json(
        { error: "Product name is required" },
        { status: 400 }
      );
    }

    const trimmed = productName.trim();
    if (trimmed.length < 2 || trimmed.length > 200) {
      return NextResponse.json(
        { error: "Product name must be between 2 and 200 characters" },
        { status: 400 }
      );
    }

    const results = await searchForManual(trimmed);

    if (results.length === 0) {
      return NextResponse.json(
        { error: `Couldn't find any manuals for "${trimmed}". Try uploading the manual directly.` },
        { status: 422 }
      );
    }

    return NextResponse.json({
      results: results.slice(0, 5),
      productName: trimmed,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Failed to search for manual";
    return NextResponse.json({ error: message }, { status: 422 });
  }
}
