import { NextResponse } from "next/server";
import { buildReportPdf } from "@/lib/report-pdf";
import { fileResponse, reportFileName, reportForRequest } from "@/lib/report-file";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const report = await reportForRequest(request);
  if (report instanceof NextResponse) return report;
  const body = await buildReportPdf(report);
  return fileResponse(body, reportFileName(report, "pdf"), "application/pdf");
}
