import { NextResponse } from "next/server";
import { buildReportWorkbook } from "@/lib/report-excel";
import {
  fileResponse,
  reportFileName,
  reportForRequest,
} from "@/lib/report-file";

export async function GET(request: Request) {
  const report = await reportForRequest(request);
  if (report instanceof NextResponse) return report;
  const body = await buildReportWorkbook(report);
  return fileResponse(
    body,
    reportFileName(report, "xlsx"),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
