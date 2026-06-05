export type FieldName =
  | "date"
  | "description"
  | "amount"
  | "category"
  | "source"
  | "type";

export interface SheetInfo {
  headers: Record<string, string>;            // { "A": "Date", "B": "Amount" }
  suggested_mapping: Record<FieldName, string | null>;
}

export interface ImportResponse {
  [sheetName: string]: SheetInfo;
}

export interface ColumnMapping {
  file_path: string;
  sheet_name: string;
  start_row: string;                          // "auto" or a number as string
  columns: Record<FieldName, string | null>;
}
