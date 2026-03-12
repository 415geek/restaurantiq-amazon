import type { UploadedOpsDocument } from '@/lib/types';

const TEXT_LIKE_MIME_PREFIXES = ['text/'];
const TEXT_LIKE_MIME_TYPES = new Set([
  'application/json',
  'application/ld+json',
  'application/xml',
  'application/javascript',
  'application/x-javascript',
  'application/csv',
  'text/csv',
]);
const SPREADSHEET_MIME_TYPES = new Set([
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.macroenabled.12',
  'application/vnd.ms-excel.sheet.binary.macroenabled.12',
]);

type RowRecord = Record<string, string>;
type StructuredPreview = NonNullable<UploadedOpsDocument['structuredPreview']>;
type StructuredFormat = StructuredPreview['format'];
type TimeGrain = StructuredPreview['inferredTimeGrain'];
type SourceType = NonNullable<StructuredPreview['sourceType']>;
type Category = UploadedOpsDocument['category'];
type ColumnProfile = { raw: string; normalized: string };

type BusinessMetrics = NonNullable<StructuredPreview['businessMetrics']>;
type MetricDetection = {
  sourceType: SourceType;
  category: Category;
  businessMetrics: BusinessMetrics;
  canonicalMetrics: Record<string, number>;
  platformBreakdown: NonNullable<StructuredPreview['platformBreakdown']>;
  orderTypeBreakdown: NonNullable<StructuredPreview['orderTypeBreakdown']>;
  dateStats: NonNullable<StructuredPreview['dateStats']>;
  detectedKeywords: string[];
  datasetHints: string[];
  qualityFlags: string[];
  dateRange?: { start?: string; end?: string };
};

const ORDER_DETAIL_PATTERNS = [/账单明细/u, /订单明细/u, /order_details?/i, /交易明细/u];
const ITEM_SUMMARY_PATTERNS = [/菜品汇总/u, /商品汇总/u, /item_summary/i, /菜单汇总/u, /菜品销售/u];
const ID_COLUMN_PATTERNS = [/订单号/u, /流水号/u, /取餐号/u, /编号/u, /编码/u, /标识/u, /\bid\b/i, /pos[_ ]?id/i];
const MONEY_ACTUAL_PATTERNS = [/实收金额/u, /实收/u, /支付金额/u, /paid/i, /net[_ ]?sales/i];
const MONEY_GROSS_PATTERNS = [/应收金额/u, /营业额/u, /原价金额/u, /gross[_ ]?sales/i, /subtotal/i, /消费金额/u];
const DISCOUNT_PATTERNS = [/优惠金额/u, /折扣金额/u, /折让金额/u, /promotion/i, /discount/i, /优惠/u];
const TIP_PATTERNS = [/小费/u, /tips?/i];
const REFUND_COUNT_PATTERNS = [/退菜数量/u, /退款单数/u, /退单数量/u, /refund[_ ]?count/i, /void[_ ]?count/i];
const REFUND_AMOUNT_PATTERNS = [/退菜金额/u, /退款金额/u, /退单金额/u, /refund[_ ]?amount/i, /void[_ ]?amount/i];
const QUANTITY_PATTERNS = [/销售数量/u, /数量/u, /份数/u, /单数/u, /qty/i, /quantity/i];
const DATE_PATTERNS = [/营业日期/u, /日期/u, /下单时间/u, /订单时间/u, /交易时间/u, /开台时间/u, /date/i, /time/i];
const PLATFORM_PATTERNS = [/来源/u, /平台/u, /渠道/u, /订单来源/u, /平台来源/u, /source/i, /channel/i, /marketplace/i];
const ORDER_TYPE_PATTERNS = [/就餐方式/u, /订单类型/u, /类型/u, /用餐方式/u, /服务方式/u, /order[_ ]?type/i, /service[_ ]?type/i];
const RESTAURANT_NAME_PATTERNS = [/门店/u, /店铺/u, /餐厅/u, /brand/i, /store/i, /restaurant/i];
const PLATFORM_VALUE_PATTERNS: Array<[RegExp, string]> = [
  [/doordash/i, 'DoorDash'],
  [/uber/i, 'Uber Eats'],
  [/grubhub/i, 'Grubhub'],
  [/熊猫/u, 'Hungry Panda'],
  [/饭团/u, 'Fantuan'],
  [/小红书/u, 'Xiaohongshu'],
  [/instagram/i, 'Instagram'],
  [/facebook/i, 'Facebook'],
  [/美团/u, 'Meituan'],
  [/饿了么/u, 'Ele.me'],
  [/堂食/u, 'Dine-in'],
  [/自提/u, 'Pickup'],
  [/外卖/u, 'Delivery'],
];

function normalizeText(input: string) {
  return input.replace(/\u0000/g, ' ').replace(/\r/g, '\n').replace(/\t/g, ' ').replace(/[ ]+/g, ' ').trim();
}

function normalizeHeader(input: string) {
  return input
    .replace(/\u3000/g, ' ')
    .trim()
    .replace(/[（）()【】\[\]{}]/g, ' ')
    .replace(/[：:]/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

function isTextLike(file: File) {
  if (TEXT_LIKE_MIME_PREFIXES.some((prefix) => file.type.startsWith(prefix))) return true;
  if (TEXT_LIKE_MIME_TYPES.has(file.type)) return true;
  return /\.(txt|csv|json|md|log|xml|html|htm|tsv)$/i.test(file.name);
}

function isSpreadsheetFile(file: File) {
  if (SPREADSHEET_MIME_TYPES.has(file.type)) return true;
  return /\.(xlsx|xls|xlsm|xlsb)$/i.test(file.name);
}

function splitDelimitedLine(line: string, delimiter: ',' | '\t') {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && char === delimiter) {
      values.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function buildColumnProfiles(headers: string[]) {
  return headers.map((header, index) => ({
    raw: header.trim() || `Column ${index + 1}`,
    normalized: normalizeHeader(header) || `column_${index + 1}`,
  }));
}

function parseDelimited(text: string, delimiter: ',' | '\t') {
  const rawLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (rawLines.length === 0) {
    return { rows: [] as RowRecord[], columns: [] as string[], columnProfiles: [] as ColumnProfile[] };
  }

  const headerValues = splitDelimitedLine(rawLines[0], delimiter);
  const columnProfiles = buildColumnProfiles(headerValues);
  const columns = columnProfiles.map((column) => column.normalized);
  const rows = rawLines.slice(1).map((line) => {
    const values = splitDelimitedLine(line, delimiter);
    return columns.reduce<RowRecord>((record, column, index) => {
      record[column] = values[index]?.trim() ?? '';
      return record;
    }, {});
  });

  return { rows: rows.filter((row) => Object.values(row).some(Boolean)), columns, columnProfiles };
}

function parseJsonText(text: string) {
  const parsed = JSON.parse(text) as unknown;
  if (Array.isArray(parsed)) {
    const objects = parsed.filter((item): item is Record<string, unknown> => typeof item === 'object' && item !== null);
    const rawHeaders = Array.from(new Set(objects.flatMap((item) => Object.keys(item))));
    const columnProfiles = buildColumnProfiles(rawHeaders);
    const rows = objects.map((item) =>
      Object.entries(item).reduce<RowRecord>((record, [key, value]) => {
        record[normalizeHeader(key)] = typeof value === 'string' ? value : JSON.stringify(value);
        return record;
      }, {})
    );
    return { rows, columns: columnProfiles.map((column) => column.normalized), columnProfiles };
  }

  if (typeof parsed === 'object' && parsed !== null) {
    const rawHeaders = ['field', 'value'];
    const columnProfiles = buildColumnProfiles(rawHeaders);
    const rows = Object.entries(parsed).map(([key, value]) => ({
      field: key,
      value: typeof value === 'string' ? value : JSON.stringify(value),
    }));
    return { rows, columns: columnProfiles.map((column) => column.normalized), columnProfiles };
  }

  const columnProfiles = buildColumnProfiles(['value']);
  return { rows: [{ value: String(parsed) }], columns: ['value'], columnProfiles };
}

function toNumber(value: string) {
  const cleaned = value.replace(/[$,%￥¥]/g, '').replace(/,/g, '').trim();
  if (!cleaned) return null;
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : null;
}

function isSummaryMarker(value: string) {
  return /^(总计|合计|total)$/iu.test(value.trim());
}

function splitSummaryRows(rows: RowRecord[], columnProfiles: ColumnProfile[]) {
  if (!rows.length) {
    return { detailRows: rows, summaryRow: null as RowRecord | null };
  }

  const firstColumns = columnProfiles.slice(0, 3).map((column) => column.normalized);
  let summaryRow: RowRecord | null = null;
  const detailRows = rows.filter((row) => {
    const isSummary = firstColumns.some((column) => {
      const value = row[column];
      return typeof value === 'string' && isSummaryMarker(value);
    });

    if (isSummary) {
      summaryRow = row;
      return false;
    }

    return true;
  });

  return { detailRows, summaryRow };
}

function looksLikeDate(value: string) {
  return /\d{4}[-/]\d{1,2}[-/]\d{1,2}/.test(value) || /\d{1,2}[-/]\d{1,2}[-/]\d{2,4}/.test(value);
}

function formatIsoDate(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function isIdColumn(column: ColumnProfile) {
  return ID_COLUMN_PATTERNS.some((pattern) => pattern.test(column.raw) || pattern.test(column.normalized));
}

function findColumn(columnProfiles: ColumnProfile[], patterns: RegExp[]) {
  return columnProfiles.find((column) => !isIdColumn(column) && patterns.some((pattern) => pattern.test(column.raw) || pattern.test(column.normalized)));
}

function findColumns(columnProfiles: ColumnProfile[], patterns: RegExp[]) {
  return columnProfiles.filter((column) => !isIdColumn(column) && patterns.some((pattern) => pattern.test(column.raw) || pattern.test(column.normalized)));
}

function sumColumn(rows: RowRecord[], column?: ColumnProfile | null) {
  if (!column) return 0;
  return Number(rows.reduce((sum, row) => sum + (toNumber(row[column.normalized]) ?? 0), 0).toFixed(2));
}

function countPositive(rows: RowRecord[], column?: ColumnProfile | null) {
  if (!column) return 0;
  return rows.reduce((count, row) => count + ((toNumber(row[column.normalized]) ?? 0) > 0 ? 1 : 0), 0);
}

function extractUniqueDates(rows: RowRecord[], column?: ColumnProfile | null) {
  if (!column) return [] as string[];
  return Array.from(
    new Set(
      rows
        .map((row) => row[column.normalized])
        .filter(Boolean)
        .map(formatIsoDate)
        .filter((value): value is string => Boolean(value))
        .map((value) => value.slice(0, 10))
    )
  ).sort();
}

function detectRestaurantName(rows: RowRecord[], columnProfiles: ColumnProfile[], fileName: string) {
  const nameColumn = findColumn(columnProfiles, RESTAURANT_NAME_PATTERNS);
  if (nameColumn) {
    const value = rows.map((row) => row[nameColumn.normalized]).find(Boolean);
    if (value) return value;
  }

  const match = fileName.match(/^[^_\-\s]+/u);
  return match?.[0] ?? '';
}

function detectSourceType(fileName: string, columnProfiles: ColumnProfile[], extractedText: string): SourceType {
  const haystack = `${fileName} ${columnProfiles.map((column) => column.raw).join(' ')} ${extractedText}`;
  if (ORDER_DETAIL_PATTERNS.some((pattern) => pattern.test(haystack))) return 'order_details';
  if (ITEM_SUMMARY_PATTERNS.some((pattern) => pattern.test(haystack))) return 'item_summary';
  if (findColumn(columnProfiles, PLATFORM_PATTERNS) && findColumn(columnProfiles, MONEY_ACTUAL_PATTERNS)) return 'order_details';
  if (findColumn(columnProfiles, QUANTITY_PATTERNS) && findColumn(columnProfiles, MONEY_ACTUAL_PATTERNS)) return 'item_summary';
  return 'generic';
}

function inferCategory(fileName: string, extractedText: string, columnProfiles: ColumnProfile[], sourceType: SourceType): Category {
  const haystack = `${fileName} ${extractedText} ${columnProfiles.map((column) => column.raw).join(' ')}`;
  const matches: Category[] = [];
  if (/doordash|ubereats|grubhub|饭团|熊猫|delivery|外卖/iu.test(haystack)) matches.push('delivery');
  if (/labor|排班|员工|班次|工资|工时/iu.test(haystack)) matches.push('staffing');
  if (/库存|采购|食材|inventory|vendor|sku|waste/iu.test(haystack)) matches.push('inventory');
  if (/pos|账单|菜品|营业额|订单|堂食|收银/iu.test(haystack)) matches.push('pos');
  if (!matches.length) return sourceType === 'generic' ? 'unknown' : 'pos';
  return new Set(matches).size > 1 ? 'mixed' : matches[0];
}

function canonicalizeDimension(value: string) {
  if (!value) return 'Unknown';
  for (const [pattern, normalized] of PLATFORM_VALUE_PATTERNS) {
    if (pattern.test(value)) return normalized;
  }
  return value.trim();
}

function incrementBreakdown(
  breakdown: Record<string, { orders: number; revenue: number }>,
  key: string,
  revenue: number
) {
  const entry = breakdown[key] ?? { orders: 0, revenue: 0 };
  entry.orders += 1;
  entry.revenue = Number((entry.revenue + revenue).toFixed(2));
  breakdown[key] = entry;
}

function finalizeBreakdown(breakdown: Record<string, { orders: number; revenue: number }>) {
  const totalOrders = Object.values(breakdown).reduce((sum, item) => sum + item.orders, 0);
  const totalRevenue = Object.values(breakdown).reduce((sum, item) => sum + item.revenue, 0);
  return Object.fromEntries(
    Object.entries(breakdown).map(([key, value]) => [
      key,
      {
        orders: value.orders,
        revenue: Number(value.revenue.toFixed(2)),
        share_pct: totalOrders > 0 ? Number(((value.orders / totalOrders) * 100).toFixed(2)) : totalRevenue > 0 ? Number(((value.revenue / totalRevenue) * 100).toFixed(2)) : 0,
      },
    ])
  );
}

function deriveDatasetHints(sourceType: SourceType, category: Category, platformBreakdown: Record<string, { orders: number; revenue: number }>, orderTypeBreakdown: Record<string, { orders: number; revenue: number }>) {
  const hints = new Set<string>();
  if (sourceType === 'order_details') hints.add('sales_performance');
  if (sourceType === 'item_summary') hints.add('menu_mix');
  if (category === 'delivery' || Object.keys(platformBreakdown).some((key) => /door|uber|grub|fantuan|panda/i.test(key))) hints.add('channel_mix');
  if (Object.keys(orderTypeBreakdown).some((key) => /dine|pickup|delivery/i.test(key))) hints.add('service_mix');
  if (category === 'staffing') hints.add('labor_efficiency');
  if (category === 'inventory') hints.add('inventory_health');
  return Array.from(hints);
}

function deriveDetectedKeywords(sourceType: SourceType, businessMetrics: BusinessMetrics, platformBreakdown: Record<string, { orders: number; revenue: number }>, orderTypeBreakdown: Record<string, { orders: number; revenue: number }>) {
  const keywords = new Set<string>();
  if (sourceType === 'order_details') keywords.add('order_details');
  if (sourceType === 'item_summary') keywords.add('item_summary');
  if ((businessMetrics.actualRevenue ?? 0) > 0) keywords.add('actual_revenue');
  if ((businessMetrics.grossRevenue ?? 0) > 0) keywords.add('gross_revenue');
  if ((businessMetrics.discountTotal ?? 0) > 0) keywords.add('discounts');
  if ((businessMetrics.itemsSold ?? 0) > 0) keywords.add('items_sold');
  if (Object.keys(platformBreakdown).length > 1) keywords.add('platform_breakdown');
  if (Object.keys(orderTypeBreakdown).length > 1) keywords.add('order_type_breakdown');
  return Array.from(keywords);
}

function inferTimeGrain(rowCount: number, uniqueDays: number, dateRange?: { start?: string; end?: string }): TimeGrain {
  if (uniqueDays > 0 && uniqueDays <= 2) return 'daily';
  if (uniqueDays > 2 && uniqueDays <= 14) return 'weekly';
  if (uniqueDays > 14) return 'monthly';
  if (!dateRange?.start || !dateRange?.end || rowCount <= 1) return 'unknown';
  return 'unknown';
}

function detectBusinessMetrics(
  fileName: string,
  rows: RowRecord[],
  columnProfiles: ColumnProfile[],
  extractedText: string
): MetricDetection {
  const sourceType = detectSourceType(fileName, columnProfiles, extractedText);
  const actualRevenueColumn = findColumn(columnProfiles, MONEY_ACTUAL_PATTERNS);
  const grossRevenueColumn = findColumn(columnProfiles, MONEY_GROSS_PATTERNS);
  const discountColumn = findColumn(columnProfiles, DISCOUNT_PATTERNS);
  const tipColumn = findColumn(columnProfiles, TIP_PATTERNS);
  const refundCountColumn = findColumn(columnProfiles, REFUND_COUNT_PATTERNS);
  const refundAmountColumn = findColumn(columnProfiles, REFUND_AMOUNT_PATTERNS);
  const quantityColumn = findColumn(columnProfiles, QUANTITY_PATTERNS);
  const dateColumn = findColumn(columnProfiles, DATE_PATTERNS);
  const platformColumn = findColumn(columnProfiles, PLATFORM_PATTERNS);
  const orderTypeColumn = findColumn(columnProfiles, ORDER_TYPE_PATTERNS);
  const avgOrderValueColumn = findColumn(columnProfiles, [/单均实收/u, /客单价/u, /avg[_ ]?order[_ ]?value/i]);
  const billCountColumn = findColumn(columnProfiles, [/账单数/u, /订单数/u, /bill[_ ]?count/i]);

  const { detailRows, summaryRow } = splitSummaryRows(rows, columnProfiles);
  const workingRows = detailRows.length ? detailRows : rows;
  const summaryValue = (column?: ColumnProfile | null) =>
    column && summaryRow ? toNumber(summaryRow[column.normalized] ?? '') : null;
  const isSalesSummaryWorkbook = Boolean(
    summaryRow
    && billCountColumn
    && actualRevenueColumn
    && avgOrderValueColumn
  );

  const uniqueDays = extractUniqueDates(workingRows, dateColumn);
  const actualRevenue = isSalesSummaryWorkbook
    ? (summaryValue(actualRevenueColumn) ?? summaryValue(grossRevenueColumn) ?? 0) * 2
    : sumColumn(workingRows, actualRevenueColumn || grossRevenueColumn);
  const grossRevenue = isSalesSummaryWorkbook
    ? (summaryValue(grossRevenueColumn) ?? summaryValue(actualRevenueColumn) ?? 0) * 2
    : sumColumn(workingRows, grossRevenueColumn || actualRevenueColumn);
  const discountTotal = isSalesSummaryWorkbook
    ? (summaryValue(discountColumn) ?? 0) * 2
    : sumColumn(workingRows, discountColumn);
  const tipsTotal = sumColumn(workingRows, tipColumn);
  const refundCountByQty = isSalesSummaryWorkbook
    ? (summaryValue(refundCountColumn) ?? 0) * 2
    : sumColumn(workingRows, refundCountColumn || undefined);
  const refundCountPositive = countPositive(workingRows, refundAmountColumn || undefined);
  const refundAmount = isSalesSummaryWorkbook
    ? (summaryValue(refundAmountColumn) ?? 0) * 2
    : sumColumn(workingRows, refundAmountColumn);
  const itemsSold = sourceType === 'item_summary' ? sumColumn(workingRows, quantityColumn) : 0;
  const totalOrders = isSalesSummaryWorkbook
    ? Math.round((summaryValue(billCountColumn) ?? 0) * 2)
    : sourceType === 'order_details'
      ? workingRows.length
      : 0;
  const daysWithData = isSalesSummaryWorkbook
    ? uniqueDays.length + (summaryRow ? 1 : 0)
    : uniqueDays.length;
  const avgOrderValue = isSalesSummaryWorkbook
    ? summaryValue(avgOrderValueColumn)
    : totalOrders > 0 && actualRevenue > 0
      ? actualRevenue / totalOrders
      : null;
  const discountRate = discountTotal > 0 && grossRevenue > 0
    ? Number(((discountTotal / grossRevenue) * 100).toFixed(2))
    : null;
  const dailyOrders = totalOrders > 0 && daysWithData > 0
    ? Number((totalOrders / daysWithData).toFixed(2))
    : null;

  const actualRevenueValue = actualRevenue > 0 ? actualRevenue : null;
  const grossRevenueValue = grossRevenue > 0 ? grossRevenue : actualRevenueValue;
  const discountTotalValue = discountTotal > 0 ? discountTotal : null;
  const tipTotalValue = tipsTotal > 0 ? tipsTotal : null;
  const refundCountValue = refundCountByQty > 0 ? refundCountByQty : refundCountPositive > 0 ? refundCountPositive : null;
  const refundAmountValue = refundAmount > 0 ? refundAmount : null;
  const itemsSoldValue = itemsSold > 0 ? itemsSold : null;
  const ordersValue = totalOrders > 0 ? totalOrders : null;

  const platformBreakdown: Record<string, { orders: number; revenue: number }> = {};
  const orderTypeBreakdown: Record<string, { orders: number; revenue: number }> = {};
  for (const row of workingRows) {
    const revenue = toNumber(
      row[(actualRevenueColumn || grossRevenueColumn)?.normalized ?? '']
      || row[grossRevenueColumn?.normalized ?? '']
      || row[actualRevenueColumn?.normalized ?? '']
      || '0'
    ) ?? 0;
    if (platformColumn) {
      incrementBreakdown(platformBreakdown, canonicalizeDimension(row[platformColumn.normalized]), revenue);
    }
    if (orderTypeColumn) {
      incrementBreakdown(orderTypeBreakdown, canonicalizeDimension(row[orderTypeColumn.normalized]), revenue);
    }
  }

  const businessMetrics: BusinessMetrics = {
    totalOrders: ordersValue ?? undefined,
    daysWithData: daysWithData || undefined,
    actualRevenue: actualRevenueValue ?? undefined,
    grossRevenue: grossRevenueValue ?? undefined,
    discountTotal: discountTotalValue ?? undefined,
    tipsTotal: tipTotalValue ?? undefined,
    refundCount: refundCountValue ?? undefined,
    refundAmount: refundAmountValue ?? undefined,
    itemsSold: itemsSoldValue ?? undefined,
  };

  const canonicalMetrics: Record<string, number> = {};
  if (actualRevenueValue !== null) canonicalMetrics.sales = Number(actualRevenueValue.toFixed(2));
  if (ordersValue !== null) canonicalMetrics.orders = ordersValue;
  if (discountTotalValue !== null) canonicalMetrics.discounts = Number(discountTotalValue.toFixed(2));
  if (tipTotalValue !== null) canonicalMetrics.tips = Number(tipTotalValue.toFixed(2));
  if (refundAmountValue !== null) canonicalMetrics.refunds = Number(refundAmountValue.toFixed(2));
  if (itemsSoldValue !== null) canonicalMetrics.items_sold = Number(itemsSoldValue.toFixed(2));
  if (avgOrderValue !== null) canonicalMetrics.avg_order_value = Number(avgOrderValue.toFixed(2));
  if (dailyOrders !== null) canonicalMetrics.daily_orders = dailyOrders;
  if (discountRate !== null) canonicalMetrics.discount_rate = discountRate;

  const dateRange = uniqueDays.length
    ? {
        start: `${uniqueDays[0]}T00:00:00.000Z`,
        end: `${uniqueDays[uniqueDays.length - 1]}T00:00:00.000Z`,
      }
    : undefined;

  const category = inferCategory(fileName, extractedText, columnProfiles, sourceType);
  const finalizedPlatformBreakdown = finalizeBreakdown(platformBreakdown);
  const finalizedOrderTypeBreakdown = finalizeBreakdown(orderTypeBreakdown);
  const detectedKeywords = deriveDetectedKeywords(sourceType, businessMetrics, platformBreakdown, orderTypeBreakdown);
  const datasetHints = deriveDatasetHints(sourceType, category, platformBreakdown, orderTypeBreakdown);

  const qualityFlags: string[] = [];
  if (sourceType === 'order_details' && !actualRevenueColumn && !grossRevenueColumn) qualityFlags.push('missing_revenue_column');
  if (sourceType === 'order_details' && !dateColumn) qualityFlags.push('missing_date_column');
  if (sourceType === 'item_summary' && !quantityColumn) qualityFlags.push('missing_quantity_column');
  if (sourceType === 'generic') qualityFlags.push('generic_dataset_layout');
  if (!workingRows.length) qualityFlags.push('no_rows_detected');
  if (!columnProfiles.length) qualityFlags.push('no_columns_detected');
  if (isSalesSummaryWorkbook) qualityFlags.push('sales_summary_total_row_applied');

  return {
    sourceType,
    category,
    businessMetrics,
    canonicalMetrics,
    platformBreakdown: finalizedPlatformBreakdown,
    orderTypeBreakdown: finalizedOrderTypeBreakdown,
    dateStats: { uniqueDays: uniqueDays.length || undefined },
    detectedKeywords,
    datasetHints,
    qualityFlags,
    dateRange,
  };
}

function buildSampleValues(rows: RowRecord[], columnProfiles: ColumnProfile[]) {
  return Object.fromEntries(
    columnProfiles.slice(0, 8).map((column) => [column.normalized, rows.find((row) => row[column.normalized])?.[column.normalized] ?? ''])
  );
}

function buildRowSample(rows: RowRecord[], columnProfiles: ColumnProfile[]) {
  return rows.slice(0, 3).map((row) =>
    Object.fromEntries(columnProfiles.slice(0, 6).map((column) => [column.raw, row[column.normalized] ?? '']))
  );
}

function computeParserConfidence({ sourceType, rowCount, qualityFlags }: { sourceType: SourceType; rowCount: number; qualityFlags: string[] }) {
  let confidence = sourceType === 'generic' ? 0.56 : 0.78;
  if (rowCount >= 30) confidence += 0.06;
  if (rowCount >= 100) confidence += 0.04;
  confidence -= Math.min(qualityFlags.length * 0.08, 0.32);
  return Number(Math.max(0.18, Math.min(0.96, confidence)).toFixed(2));
}

function summarizeStructuredDocument({
  fileName,
  rows,
  columnProfiles,
  extractedText,
  format,
}: {
  fileName: string;
  rows: RowRecord[];
  columnProfiles: ColumnProfile[];
  extractedText: string;
  format: StructuredFormat;
}) {
  const metricDetection = detectBusinessMetrics(fileName, rows, columnProfiles, extractedText);
  const parserConfidence = computeParserConfidence({
    sourceType: metricDetection.sourceType,
    rowCount: rows.length,
    qualityFlags: metricDetection.qualityFlags,
  });

  const excerptParts = [
    metricDetection.sourceType === 'order_details' ? '账单明细' : metricDetection.sourceType === 'item_summary' ? '菜品汇总' : '通用数据',
    `${rows.length} rows`,
    metricDetection.businessMetrics.actualRevenue !== null ? `revenue=${metricDetection.businessMetrics.actualRevenue}` : null,
    metricDetection.businessMetrics.totalOrders !== null ? `orders=${metricDetection.businessMetrics.totalOrders}` : null,
    metricDetection.businessMetrics.itemsSold !== null ? `itemsSold=${metricDetection.businessMetrics.itemsSold}` : null,
  ].filter(Boolean);

  return {
    category: metricDetection.category,
    excerpt: excerptParts.join(' · '),
    structuredPreview: {
      format,
      sourceType: metricDetection.sourceType,
      rowCount: rows.length,
      columns: columnProfiles.map((column) => column.raw).slice(0, 16),
      sampleValues: buildSampleValues(rows, columnProfiles),
      numericMetrics: metricDetection.canonicalMetrics,
      canonicalMetrics: metricDetection.canonicalMetrics,
      businessMetrics: metricDetection.businessMetrics,
      platformBreakdown: metricDetection.platformBreakdown,
      orderTypeBreakdown: metricDetection.orderTypeBreakdown,
      dateStats: metricDetection.dateStats,
      dateRange: metricDetection.dateRange,
      detectedKeywords: metricDetection.detectedKeywords,
      datasetHints: metricDetection.datasetHints,
      rowSample: buildRowSample(splitSummaryRows(rows, columnProfiles).detailRows, columnProfiles),
      qualityFlags: metricDetection.qualityFlags,
      parserConfidence,
      inferredTimeGrain: inferTimeGrain(rows.length, metricDetection.dateStats.uniqueDays ?? 0, metricDetection.dateRange),
    } satisfies StructuredPreview,
  };
}

function summarizeTextDocument(fileName: string, extractedText: string) {
  const lines = extractedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 40);
  const pseudoHeaders = Array.from(new Set(lines.flatMap((line) => line.split(/[：:=]/).slice(0, 1)))).filter(Boolean);
  const columnProfiles = buildColumnProfiles(pseudoHeaders.length ? pseudoHeaders : ['内容']);
  const rows = lines.map((line) => ({ 内容: line }));
  const summary = summarizeStructuredDocument({
    fileName,
    rows,
    columnProfiles,
    extractedText,
    format: 'text',
  });

  return {
    category: summary.category,
    excerpt: summary.excerpt || lines.slice(0, 3).join(' | ').slice(0, 240),
    structuredPreview: summary.structuredPreview,
  };
}

function mergeDateRanges(ranges: Array<{ start?: string; end?: string } | undefined>) {
  const values = ranges
    .flatMap((range) => [range?.start, range?.end])
    .filter((value): value is string => Boolean(value))
    .sort();
  if (!values.length) return undefined;
  return { start: values[0], end: values[values.length - 1] };
}

function mergeMetricMap(...metricMaps: Array<Record<string, number> | undefined>) {
  const merged: Record<string, number> = {};
  for (const metricMap of metricMaps) {
    if (!metricMap) continue;
    for (const [key, value] of Object.entries(metricMap)) {
      merged[key] = Number(((merged[key] ?? 0) + value).toFixed(2));
    }
  }
  return merged;
}

function mergeBreakdownMaps(...maps: Array<Record<string, { orders: number; revenue: number }> | undefined>) {
  const merged: Record<string, { orders: number; revenue: number }> = {};
  for (const breakdown of maps) {
    if (!breakdown) continue;
    for (const [key, value] of Object.entries(breakdown)) {
      const current = merged[key] ?? { orders: 0, revenue: 0 };
      current.orders += value.orders;
      current.revenue = Number((current.revenue + value.revenue).toFixed(2));
      merged[key] = current;
    }
  }
  return finalizeBreakdown(merged);
}

function mergeBusinessMetrics(metricsList: Array<BusinessMetrics | undefined>) {
  const merged: BusinessMetrics = {};
  const additiveKeys: Array<keyof BusinessMetrics> = [
    'totalOrders',
    'actualRevenue',
    'grossRevenue',
    'discountTotal',
    'tipsTotal',
    'refundCount',
    'refundAmount',
    'itemsSold',
  ];

  for (const metrics of metricsList) {
    if (!metrics) continue;
    for (const key of additiveKeys) {
      const value = metrics[key];
      if (typeof value !== 'number') continue;
      merged[key] = Number((((merged[key] as number | undefined) ?? 0) + value).toFixed(2));
    }
  }

  const uniqueDays = metricsList
    .map((metrics) => metrics?.daysWithData)
    .filter((value): value is number => typeof value === 'number' && value > 0);
  if (uniqueDays.length) {
    merged.daysWithData = uniqueDays.reduce((sum, value) => sum + value, 0);
  }

  return merged;
}

async function parseSpreadsheetDocument(file: File) {
  const [{ read, utils }, arrayBuffer] = await Promise.all([import('xlsx'), file.arrayBuffer()]);
  const workbook = read(arrayBuffer, {
    type: 'array',
    cellDates: true,
    dense: true,
  });

  const sheetSummaries = workbook.SheetNames.map((sheetName) => {
    const sheet = workbook.Sheets[sheetName];
    const matrix = utils.sheet_to_json<(string | number | boolean | Date | null)[]>(sheet, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: false,
    });

    const sanitized = matrix
      .map((row) => row.map((cell) => String(cell ?? '').trim()))
      .filter((row) => row.some(Boolean));

    if (!sanitized.length) return null;

    const columnProfiles = buildColumnProfiles(sanitized[0]);
    const rows = sanitized.slice(1).map((row) =>
      columnProfiles.reduce<RowRecord>((record, column, index) => {
        record[column.normalized] = row[index] ?? '';
        return record;
      }, {})
    );

    const extractedText = sanitized.slice(0, 50).map((row) => row.join(' | ')).join('\n');
    const summary = summarizeStructuredDocument({
      fileName: `${file.name}:${sheetName}`,
      rows,
      columnProfiles,
      extractedText,
      format: 'xlsx',
    });

    return { sheetName, rows, columnProfiles, extractedText, summary };
  }).filter(
    (
      sheet
    ): sheet is {
      sheetName: string;
      rows: RowRecord[];
      columnProfiles: ColumnProfile[];
      extractedText: string;
      summary: ReturnType<typeof summarizeStructuredDocument>;
    } => Boolean(sheet)
  );

  if (!sheetSummaries.length) return null;

  const combinedSourceType = sheetSummaries.every((sheet) => sheet.summary.structuredPreview.sourceType === sheetSummaries[0]?.summary.structuredPreview.sourceType)
    ? sheetSummaries[0]!.summary.structuredPreview.sourceType
    : 'generic';
  const columns = Array.from(new Set(sheetSummaries.flatMap((sheet) => sheet.summary.structuredPreview.columns ?? []))).slice(0, 20);
  const rowCount = sheetSummaries.reduce((sum, sheet) => sum + (sheet.summary.structuredPreview.rowCount ?? 0), 0);
  const sampleValues = Object.assign({}, ...sheetSummaries.map((sheet) => sheet.summary.structuredPreview.sampleValues ?? {}));
  const businessMetrics = mergeBusinessMetrics(sheetSummaries.map((sheet) => sheet.summary.structuredPreview.businessMetrics));
  const platformBreakdown = mergeBreakdownMaps(...sheetSummaries.map((sheet) => sheet.summary.structuredPreview.platformBreakdown));
  const orderTypeBreakdown = mergeBreakdownMaps(...sheetSummaries.map((sheet) => sheet.summary.structuredPreview.orderTypeBreakdown));
  const canonicalMetrics = mergeMetricMap(...sheetSummaries.map((sheet) => sheet.summary.structuredPreview.canonicalMetrics));
  const qualityFlags = Array.from(new Set(sheetSummaries.flatMap((sheet) => sheet.summary.structuredPreview.qualityFlags ?? [])));
  const detectedKeywords = Array.from(new Set(sheetSummaries.flatMap((sheet) => sheet.summary.structuredPreview.detectedKeywords ?? [])));
  const datasetHints = Array.from(new Set(sheetSummaries.flatMap((sheet) => sheet.summary.structuredPreview.datasetHints ?? [])));
  const rowSample = sheetSummaries.flatMap((sheet) => (sheet.summary.structuredPreview.rowSample ?? []).map((row) => ({ _sheet: sheet.sheetName, ...row }))).slice(0, 4);
  const dateRange = mergeDateRanges(sheetSummaries.map((sheet) => sheet.summary.structuredPreview.dateRange));
  const uniqueDays = sheetSummaries.reduce(
    (sum, sheet) => sum + (sheet.summary.structuredPreview.dateStats?.uniqueDays ?? 0),
    0
  );
  const parserConfidence = Number((sheetSummaries.reduce((sum, sheet) => sum + (sheet.summary.structuredPreview.parserConfidence ?? 0.6), 0) / sheetSummaries.length).toFixed(2));
  const category = inferCategory(
    file.name,
    sheetSummaries.map((sheet) => `${sheet.sheetName} ${sheet.extractedText}`).join('\n'),
    sheetSummaries.flatMap((sheet) => sheet.columnProfiles),
    combinedSourceType
  );

  return {
    category,
    excerpt: `Parsed ${sheetSummaries.length} sheet(s) · ${rowCount} row(s) · ${combinedSourceType}`,
    extractedText: sheetSummaries.map((sheet) => `[${sheet.sheetName}]\n${sheet.extractedText}`).join('\n\n').slice(0, 48_000),
    structuredPreview: {
      format: 'xlsx',
      sourceType: combinedSourceType,
      rowCount,
      columns,
      sampleValues,
      numericMetrics: canonicalMetrics,
      canonicalMetrics,
      businessMetrics,
      platformBreakdown,
      orderTypeBreakdown,
      dateStats: { uniqueDays: uniqueDays || undefined },
      dateRange,
      detectedKeywords,
      datasetHints,
      rowSample,
      qualityFlags,
      parserConfidence,
      inferredTimeGrain: inferTimeGrain(rowCount, uniqueDays, dateRange),
    } satisfies StructuredPreview,
    cleaningActions: [
      'read workbook sheets',
      'preserved chinese worksheet headers',
      'removed blank spreadsheet rows',
      'mapped order and item summary metrics',
    ],
  };
}

export function normalizeUploadedOpsDocument(document: UploadedOpsDocument) {
  const preview = document.structuredPreview;
  const columns = preview?.columns ?? [];
  const canonicalMetrics = preview?.canonicalMetrics ?? {};
  const datasetHints = preview?.datasetHints ?? [];
  const qualityFlags = preview?.qualityFlags ?? (document.parsingStatus === 'metadata_only' ? ['metadata_only_parser'] : []);
  const parserConfidence = preview?.parserConfidence ?? (document.parsingStatus === 'parsed' ? 0.72 : 0.2);
  const inferredTimeGrain = preview?.inferredTimeGrain ?? 'unknown';

  return {
    fileName: document.fileName,
    category: document.category,
    parsingStatus: document.parsingStatus,
    sourceType: preview?.sourceType ?? 'generic',
    format: preview?.format ?? 'binary',
    rowCount: preview?.rowCount ?? 0,
    columns,
    parserConfidence,
    inferredTimeGrain,
    datasetHints,
    qualityFlags,
    canonicalMetrics,
    businessMetrics: preview?.businessMetrics ?? {},
    platformBreakdown: preview?.platformBreakdown ?? {},
    orderTypeBreakdown: preview?.orderTypeBreakdown ?? {},
    dateStats: preview?.dateStats ?? {},
    dateRange: preview?.dateRange,
    cleaningActions: document.cleaningActions ?? [],
    excerpt: document.excerpt,
  };
}

export function buildOpsNormalizationDigest(uploadedDocuments: UploadedOpsDocument[] = []) {
  const normalizedDatasets = uploadedDocuments.map(normalizeUploadedOpsDocument);
  const aggregatedMetrics = mergeMetricMap(...normalizedDatasets.map((dataset) => dataset.canonicalMetrics));
  const qualityIssues = new Set<string>();

  for (const dataset of normalizedDatasets) {
    for (const issue of dataset.qualityFlags) qualityIssues.add(issue);
  }

  return {
    normalizedDatasets,
    aggregatedMetrics,
    qualitySummary: {
      parsedRatio: uploadedDocuments.length
        ? Number((normalizedDatasets.filter((dataset) => dataset.parsingStatus === 'parsed').length / uploadedDocuments.length).toFixed(2))
        : 0,
      metadataOnlyCount: normalizedDatasets.filter((dataset) => dataset.parsingStatus === 'metadata_only').length,
      flaggedDocumentCount: normalizedDatasets.filter((dataset) => dataset.qualityFlags.length > 0).length,
      issues: Array.from(qualityIssues),
    },
  };
}

export async function parseOpsUploads(files: File[]): Promise<UploadedOpsDocument[]> {
  return Promise.all(
    files.map(async (file) => {
      let parsingStatus: UploadedOpsDocument['parsingStatus'] = 'metadata_only';
      let extractedText = '';
      let category: UploadedOpsDocument['category'] = 'unknown';
      let excerpt = `Uploaded ${file.name} (${file.type || 'unknown mime'}) for Agent A parsing. Binary parser adapter not implemented yet.`;
      const cleaningActions: string[] = [];
      let structuredPreview: UploadedOpsDocument['structuredPreview'] = {
        format: 'binary',
        sourceType: 'generic',
        canonicalMetrics: {},
        businessMetrics: {},
        platformBreakdown: {},
        orderTypeBreakdown: {},
        dateStats: {},
        datasetHints: [],
        qualityFlags: ['binary_file_metadata_only'],
        parserConfidence: 0.2,
        inferredTimeGrain: 'unknown',
      };

      if (isSpreadsheetFile(file)) {
        try {
          const workbookSummary = await parseSpreadsheetDocument(file);
          if (workbookSummary) {
            parsingStatus = 'parsed';
            extractedText = workbookSummary.extractedText;
            category = workbookSummary.category;
            excerpt = workbookSummary.excerpt;
            structuredPreview = workbookSummary.structuredPreview;
            cleaningActions.push(...workbookSummary.cleaningActions);
          } else {
            cleaningActions.push('spreadsheet workbook had no readable rows');
            structuredPreview = {
              ...structuredPreview,
              qualityFlags: ['spreadsheet_empty_or_unreadable'],
              parserConfidence: 0.16,
            };
          }
        } catch {
          cleaningActions.push('spreadsheet parse failed, kept metadata only');
          structuredPreview = {
            ...structuredPreview,
            qualityFlags: ['spreadsheet_parse_failed_fallback_to_metadata'],
            parserConfidence: 0.14,
          };
        }
      } else if (isTextLike(file)) {
        try {
          const rawText = await file.text();
          extractedText = rawText.slice(0, 48_000);
          parsingStatus = extractedText ? 'parsed' : 'metadata_only';

          if (/\.(csv)$/i.test(file.name) || file.type === 'text/csv' || file.type === 'application/csv') {
            const { rows, columnProfiles } = parseDelimited(extractedText, ',');
            const summary = summarizeStructuredDocument({ fileName: file.name, rows, columnProfiles, extractedText, format: 'csv' });
            cleaningActions.push('trimmed whitespace', 'preserved original headers', 'removed empty rows');
            category = summary.category;
            excerpt = summary.excerpt;
            structuredPreview = summary.structuredPreview;
          } else if (/\.(tsv)$/i.test(file.name)) {
            const { rows, columnProfiles } = parseDelimited(extractedText, '\t');
            const summary = summarizeStructuredDocument({ fileName: file.name, rows, columnProfiles, extractedText, format: 'tsv' });
            cleaningActions.push('trimmed whitespace', 'preserved original headers', 'removed empty rows');
            category = summary.category;
            excerpt = summary.excerpt;
            structuredPreview = summary.structuredPreview;
          } else if (/\.(json)$/i.test(file.name) || file.type === 'application/json') {
            const { rows, columnProfiles } = parseJsonText(extractedText);
            const summary = summarizeStructuredDocument({ fileName: file.name, rows, columnProfiles, extractedText, format: 'json' });
            cleaningActions.push('parsed json', 'normalized object keys');
            category = summary.category;
            excerpt = summary.excerpt;
            structuredPreview = summary.structuredPreview;
          } else {
            const normalized = normalizeText(extractedText);
            const summary = summarizeTextDocument(file.name, normalized);
            cleaningActions.push('normalized whitespace', 'extracted key-value hints');
            category = summary.category;
            excerpt = summary.excerpt || normalized.slice(0, 240);
            structuredPreview = summary.structuredPreview;
            extractedText = normalized;
          }
        } catch {
          parsingStatus = 'metadata_only';
          structuredPreview = {
            ...structuredPreview,
            qualityFlags: ['parse_failed_fallback_to_metadata'],
            parserConfidence: 0.18,
          };
        }
      } else {
        cleaningActions.push('binary file indexed as metadata only');
      }

      return {
        id: crypto.randomUUID(),
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        category,
        parsingStatus,
        source: 'manual_upload',
        extractedText,
        excerpt,
        cleaningActions,
        structuredPreview,
        uploadedAt: new Date().toISOString(),
      } satisfies UploadedOpsDocument;
    })
  );
}
