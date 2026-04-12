import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const FILE_MAP: Record<string, string> = {
  "owner-manual": "owner-manual.pdf",
  "quick-start-guide": "quick-start-guide.pdf",
  "selection-chart": "selection-chart.pdf",
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const file = searchParams.get("file");
  const page = searchParams.get("page");

  if (!file || !page || !FILE_MAP[file]) {
    return NextResponse.json({ error: "Invalid parameters" }, { status: 400 });
  }

  const filePath = path.join(process.cwd(), "files", FILE_MAP[file]);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  // Serve the raw PDF with a page hint — the frontend will render it with PDF.js
  const pdfBuffer = fs.readFileSync(filePath);

  return new NextResponse(pdfBuffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${FILE_MAP[file]}"`,
      "X-PDF-Page": page,
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
