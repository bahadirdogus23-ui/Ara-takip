import path from "node:path";
import {
  Document,
  Font,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";
import { formatDateTR, formatTL, isoDateTR } from "@/lib/format";
import { formatTrNumber } from "@/lib/number";
import { unitLabel, type Report } from "@/lib/report";

// PDF'in standart fontları ş, ğ, ı, İ harflerini içermez; Noto Sans gömülür (OFL lisanslı).
const fontDir = path.join(process.cwd(), "assets", "fonts");
Font.register({
  family: "NotoSans",
  fonts: [
    { src: path.join(fontDir, "NotoSans-Regular.ttf") },
    { src: path.join(fontDir, "NotoSans-Bold.ttf"), fontWeight: "bold" },
  ],
});

const BRAND = "#b45309";
const MUTED = "#6b665e";
const LINE = "#dcd8cf";

const s = StyleSheet.create({
  page: { fontFamily: "NotoSans", fontSize: 9, padding: 36, color: "#1c1a17" },
  brand: { fontSize: 16, fontWeight: "bold" },
  muted: { color: MUTED },
  h1: { fontSize: 13, fontWeight: "bold", marginTop: 10 },
  h2: { fontSize: 11, fontWeight: "bold", marginTop: 16, marginBottom: 6 },
  stats: { flexDirection: "row", gap: 8, marginTop: 12 },
  stat: { flex: 1, border: `1pt solid ${LINE}`, borderRadius: 4, padding: 8 },
  statValue: { fontSize: 12, fontWeight: "bold", marginTop: 2 },
  table: { borderTop: `1pt solid ${LINE}` },
  row: {
    flexDirection: "row",
    borderBottom: `0.5pt solid ${LINE}`,
    paddingVertical: 4,
  },
  head: { backgroundColor: "#f3e8d6", fontWeight: "bold" },
  total: { fontWeight: "bold", borderBottom: `1pt solid #1c1a17` },
  right: { textAlign: "right" },
  note: { marginTop: 18, fontSize: 8, color: "#8a5a00" },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 36,
    right: 36,
    fontSize: 7,
    color: MUTED,
    flexDirection: "row",
    justifyContent: "space-between",
  },
});

type Col = { title: string; width: string; right?: boolean };

function Table({
  cols,
  rows,
  total,
}: {
  cols: Col[];
  rows: string[][];
  total?: string[];
}) {
  const cells = (values: string[]) =>
    cols.map((c, i) => (
      <Text
        key={i}
        style={[
          { width: c.width, paddingHorizontal: 3 },
          c.right ? s.right : {},
        ]}
      >
        {values[i]}
      </Text>
    ));
  return (
    <View style={s.table}>
      <View style={[s.row, s.head]} fixed>
        {cells(cols.map((c) => c.title))}
      </View>
      {rows.map((r, i) => (
        <View key={i} style={s.row} wrap={false}>
          {cells(r)}
        </View>
      ))}
      {total && <View style={[s.row, s.total]}>{cells(total)}</View>}
    </View>
  );
}

function Stat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <View style={s.stat}>
      <Text style={s.muted}>{label}</Text>
      <Text style={s.statValue}>{value}</Text>
      <Text style={[s.muted, { fontSize: 7, marginTop: 2 }]}>{hint}</Text>
    </View>
  );
}

function ReportDocument({ r }: { r: Report }) {
  const { totals } = r;
  return (
    <Document
      title={`${r.site.name} dönem raporu`}
      author={r.tenantName}
      creator="Hafriyol"
      language="tr"
    >
      <Page size="A4" style={s.page}>
        <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
          <Text style={s.brand}>
            Hafri<Text style={{ color: BRAND }}>yol</Text>
          </Text>
          <Text style={s.muted}>{r.tenantName}</Text>
        </View>

        <Text style={s.h1}>{r.site.name} · Dönem raporu</Text>
        <Text style={s.muted}>
          {[r.site.code, r.site.employer].filter(Boolean).join(" · ")}
          {(r.site.code || r.site.employer) && " · "}
          {formatDateTR(r.from)} – {formatDateTR(r.to)}
        </Text>

        <View style={s.stats}>
          <Stat
            label="İmalat tutarı"
            value={formatTL(totals.amount)}
            hint="Sözleşme birim fiyatıyla, KDV hariç"
          />
          <Stat
            label="Gider"
            value={formatTL(totals.expenseNet)}
            hint={`KDV hariç · KDV ${formatTL(totals.expenseVat)}`}
          />
          <Stat
            label="Tutar − gider"
            value={formatTL(totals.difference)}
            hint="KDV hariç, kesintiler düşülmeden"
          />
        </View>

        <Text style={s.h2}>İmalat</Text>
        <Table
          cols={[
            { title: "Poz / iş kalemi", width: "30%" },
            { title: "Miktar", width: "13%", right: true },
            { title: "Birim fiyat", width: "13%", right: true },
            { title: "Tutar", width: "15%", right: true },
            { title: "Gerçekleşme", width: "14%", right: true },
            { title: "Birim maliyet", width: "15%", right: true },
          ]}
          rows={r.items.map((i) => [
            [i.code, i.name].filter(Boolean).join("  "),
            `${formatTrNumber(i.quantity)} ${unitLabel(i.unit)}`,
            i.unitPrice === null ? "—" : formatTL(i.unitPrice),
            formatTL(i.amount),
            i.progressPercent === null
              ? "—"
              : `%${formatTrNumber(i.progressPercent, 2)}`,
            i.unitCost === null ? "—" : formatTL(i.unitCost),
          ])}
          total={["Toplam", "", "", formatTL(totals.amount), "", ""]}
        />

        <Text style={s.h2}>Giderler</Text>
        {r.expenses.length === 0 ? (
          <Text style={s.muted}>Bu dönemde gider yok.</Text>
        ) : (
          <Table
            cols={[
              { title: "Gider türü", width: "40%" },
              { title: "Kayıt", width: "12%", right: true },
              { title: "KDV hariç", width: "16%", right: true },
              { title: "KDV", width: "16%", right: true },
              { title: "Toplam", width: "16%", right: true },
            ]}
            rows={r.expenses.map((e) => [
              e.label,
              String(e.count),
              formatTL(e.amount),
              formatTL(e.vat),
              formatTL(e.total),
            ])}
            total={[
              "Toplam",
              "",
              formatTL(totals.expenseNet),
              formatTL(totals.expenseVat),
              formatTL(
                Math.round((totals.expenseNet + totals.expenseVat) * 100) / 100,
              ),
            ]}
          />
        )}
        {r.expenses.length > 0 && (
          <Text style={[s.muted, { marginTop: 4 }]}>
            İş kalemlerine bağlı: {formatTL(totals.directCost)} · Genel gider:{" "}
            {formatTL(totals.generalExpense)}
          </Text>
        )}

        <Text style={s.h2}>Seferler</Text>
        {r.trips.length === 0 ? (
          <Text style={s.muted}>Bu dönemde sefer yok.</Text>
        ) : (
          <Table
            cols={[
              { title: "Plaka", width: "25%" },
              { title: "Araç türü", width: "35%" },
              { title: "Sefer", width: "20%", right: true },
              { title: "Tonaj", width: "20%", right: true },
            ]}
            rows={r.trips.map((t) => [
              t.plate,
              t.vehicleType,
              String(t.trips),
              t.tonnage > 0 ? formatTrNumber(t.tonnage) : "—",
            ])}
            total={[
              "Toplam",
              "",
              String(totals.trips),
              totals.tonnage > 0 ? formatTrNumber(totals.tonnage) : "—",
            ]}
          />
        )}

        {r.machines.length > 0 && (
          <>
            <Text style={s.h2}>Makineler</Text>
            <Table
              cols={[
                { title: "Plaka / makine", width: "26%" },
                { title: "Tür", width: "22%" },
                { title: "Saat", width: "13%", right: true },
                { title: "Mazot (L)", width: "13%", right: true },
                { title: "L/saat", width: "13%", right: true },
                { title: "Norm", width: "13%", right: true },
              ]}
              rows={r.machines.map((m) => [
                m.plate,
                m.vehicleType,
                formatTrNumber(m.hours, 2),
                formatTrNumber(m.fuel, 0),
                m.lph === null
                  ? "—"
                  : `${formatTrNumber(m.lph, 1)}${m.over ? " !" : ""}`,
                m.normLph === null ? "—" : formatTrNumber(m.normLph, 1),
              ])}
              total={[
                "Toplam",
                "",
                formatTrNumber(totals.machineHours, 2),
                formatTrNumber(totals.fuelLiters, 0),
                "",
                "",
              ]}
            />
            {r.machines.some((m) => m.over) && (
              <Text style={[s.muted, { marginTop: 4, color: "#b91c1c" }]}>
                {"! işaretli makineler yakıt normunu %20'den fazla aştı."}
              </Text>
            )}
          </>
        )}

        <View style={s.note}>
          <Text>
            Bu rapor iç takip içindir, resmî hakediş yerine geçmez. Fiyat farkı,
            kesintiler, teminat ve vergiler hesaba katılmaz.
          </Text>
          <Text>Gerçekleşme = dönem miktarı ÷ planlanan miktar.</Text>
          <Text>
            Birim maliyet = iş kalemine bağlanmış gider ÷ dönem miktarı.
          </Text>
        </View>

        <View style={s.footer} fixed>
          <Text>
            Hafriyol · {formatDateTR(isoDateTR())} tarihinde oluşturuldu
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `${pageNumber} / ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function buildReportPdf(r: Report): Promise<Uint8Array> {
  return new Uint8Array(await renderToBuffer(<ReportDocument r={r} />));
}
