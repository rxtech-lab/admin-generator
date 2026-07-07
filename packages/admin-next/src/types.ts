// TypeScript mirror of the Go wire types in admin/types.go. Keep these in sync;
// the shapes are validated end-to-end by the example app.

export type ActionType =
  | "view"
  | "edit"
  | "delete"
  | "create"
  | "search"
  | "export"
  | (string & {});

export type ResourceType = "table" | "detail" | "form" | "custom";

export type ButtonType =
  | "primary"
  | "secondary"
  | "danger"
  | "warning"
  | "info"
  | "success";

export type Behavior =
  | "navigate"
  | "submit"
  | "openSheet"
  | "openDialog"
  | "confirmDialog";

export interface ActionButton {
  type: ButtonType;
  label: string;
  icon: string;
  behavior: Behavior;
  actionType: ActionType;
  onClick: string;
}

export interface ResourceInfo {
  id: string;
  name: string;
  description: string;
  icon: string;
  type: ResourceType;
  dataUrl: string;
  defaultAction: ActionType;
  supportedActions: ActionButton[];
}

export type ColumnFormat =
  | "date-time"
  | "date"
  | "time"
  | "email"
  | "url"
  | "tel"
  | "image"
  | "wallet-address"
  | "chip"
  | "color"
  | string;

export interface TableColumn {
  name: string;
  label: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  format?: ColumnFormat;
  width?: number;
  pinned: boolean;
  valueFrom?: string;
  link?: string;
}

export interface TableSchema {
  uiType: "table";
  type: ActionType;
  columns: TableColumn[];
}

export interface FormSchema {
  uiType: "form";
  type: ActionType;
  schema: Record<string, unknown>;
  uiSchema: Record<string, unknown>;
  supportedActions: ActionButton[];
}

export type ChartType =
  | "bar"
  | "line"
  | "BarChart"
  | "LineChart"
  | "AreaChart"
  | (string & {});

export interface ChartSeries {
  key: string;
  label?: string;
  color?: string;
}

export interface Chart {
  type: ChartType;
  title?: string;
  data: Record<string, unknown>[];
  xKey: string;
  yKey?: string;
  series?: ChartSeries[];
}

export interface Statistic {
  label: string;
  value: unknown;
  description?: string;
  trend?: string;
  tone?: string;
}

export type CustomPageSection =
  | {
      type: "charts";
      title?: string;
      description?: string;
      children?: Chart[];
    }
  | {
      type: "statistics";
      title?: string;
      description?: string;
      statistics?: Statistic[];
    }
  | {
      type: "text";
      title?: string;
      description?: string;
      body?: string;
    };

export interface CustomResourcePage {
  uiType: "custom";
  type: ActionType;
  actionButtons: ActionButton[] | null;
  sections: CustomPageSection[] | null;
}

export type ResourceSchema = TableSchema | FormSchema | CustomResourcePage;

export interface SearchItem {
  title: string;
  description?: string;
  value: string;
}

export interface Item {
  data: Record<string, unknown>;
  actions?: ActionButton[];
  dynamicPath?: string;
}

export interface PaginatedResponse {
  items: Item[];
  actions: ActionButton[];
  nextUrl?: string;
  previousUrl?: string;
}

export interface DetailResponse {
  data: Record<string, unknown>;
}

export type ActionResponse = PaginatedResponse | DetailResponse | SearchItem[];

export function isTableSchema(s: ResourceSchema): s is TableSchema {
  return s.uiType === "table";
}

export function isFormSchema(s: ResourceSchema): s is FormSchema {
  return s.uiType === "form";
}

export function isCustomResourcePage(s: ResourceSchema): s is CustomResourcePage {
  return s.uiType === "custom";
}

export function isPaginated(r: ActionResponse): r is PaginatedResponse {
  return !Array.isArray(r) && "items" in r;
}

export function isDetail(r: ActionResponse): r is DetailResponse {
  return !Array.isArray(r) && "data" in r;
}
