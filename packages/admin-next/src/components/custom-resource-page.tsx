"use client";

import * as React from "react";
import * as Icons from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ActionButton,
  Chart,
  ChartSeries,
  CustomPageSection,
  CustomResourcePage,
} from "../types.js";
import { Button, buttonVariantFor } from "./ui.js";
import { cn } from "../lib/utils.js";

export interface CustomResourcePageViewProps {
  schema: CustomResourcePage;
  pending?: boolean;
  onAction: (button: ActionButton) => void;
}

const palette = ["#2563eb", "#16a34a", "#dc2626", "#9333ea", "#f59e0b"];

function paletteColor(index: number): string {
  return palette[index % palette.length] ?? "#2563eb";
}

function ActionIcon({ name }: { name: string }) {
  const pascal = name
    .split(/[-_]/)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join("");
  const Cmp =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[
      pascal
    ] ?? null;
  return Cmp ? <Cmp className="size-3.5" /> : null;
}

export function CustomResourcePageView({
  schema,
  pending,
  onAction,
}: CustomResourcePageViewProps): React.JSX.Element {
  const actionButtons = schema.actionButtons ?? [];
  const sections = schema.sections ?? [];

  return (
    <div className={cn("space-y-5", pending && "opacity-60")}>
      {actionButtons.length > 0 && (
        <div className="flex flex-wrap justify-end gap-2">
          {actionButtons.map((button, index) => (
            <Button
              key={`${button.actionType}:${index}`}
              variant={buttonVariantFor(button.type)}
              onClick={() => onAction(button)}
            >
              <ActionIcon name={button.icon} />
              {button.label}
            </Button>
          ))}
        </div>
      )}

      {sections.map((section, index) => (
        <Section key={`${section.type}:${index}`} section={section} />
      ))}
    </div>
  );
}

function Section({ section }: { section: CustomPageSection }): React.JSX.Element {
  switch (section.type) {
    case "charts":
      return <ChartSection section={section} />;
    case "statistics":
      return <StatisticsSection section={section} />;
    case "text":
      return <TextSection section={section} />;
  }
}

function SectionHeading({
  title,
  description,
}: {
  title?: string;
  description?: string;
}): React.JSX.Element | null {
  if (!title && !description) return null;
  return (
    <div className="mb-3">
      {title && <h2 className="text-base font-semibold">{title}</h2>}
      {description && (
        <p className="text-sm text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

function ChartSection({
  section,
}: {
  section: Extract<CustomPageSection, { type: "charts" }>;
}): React.JSX.Element {
  const charts = section.children ?? [];
  const gridClassName =
    charts.length === 1 ? "grid gap-3" : "grid gap-3 @2xl/main:grid-cols-2";

  return (
    <section>
      <SectionHeading title={section.title} description={section.description} />
      <div className={gridClassName}>
        {charts.map((chart, index) => {
          const isOddLastChart =
            charts.length > 1 &&
            charts.length % 2 === 1 &&
            index === charts.length - 1;

          return (
            <div
              key={`${chart.title ?? chart.type}:${index}`}
              className={`rounded-lg border border-border p-4${
                isOddLastChart ? " @2xl/main:col-span-2" : ""
              }`}
            >
              {chart.title && (
                <div className="mb-3 text-sm font-medium">{chart.title}</div>
              )}
              <SimpleChart chart={chart} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function StatisticsSection({
  section,
}: {
  section: Extract<CustomPageSection, { type: "statistics" }>;
}): React.JSX.Element {
  return (
    <section>
      <SectionHeading title={section.title} description={section.description} />
      <div className="grid gap-3 @xl/main:grid-cols-2 @4xl/main:grid-cols-4">
        {(section.statistics ?? []).map((stat, index) => (
          <div
            key={`${stat.label}:${index}`}
            className="rounded-lg border border-border p-4"
          >
            <div className="text-sm text-muted-foreground">{stat.label}</div>
            <div className="mt-2 text-2xl font-semibold">{String(stat.value)}</div>
            {(stat.description || stat.trend) && (
              <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {stat.trend && (
                  <span
                    className={cn(
                      "font-medium",
                      stat.tone === "positive" && "text-emerald-600",
                      stat.tone === "negative" && "text-destructive",
                    )}
                  >
                    {stat.trend}
                  </span>
                )}
                {stat.description && <span>{stat.description}</span>}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}

function TextSection({
  section,
}: {
  section: Extract<CustomPageSection, { type: "text" }>;
}): React.JSX.Element {
  return (
    <section className="rounded-lg border border-border p-4">
      <SectionHeading title={section.title} description={section.description} />
      <div className="whitespace-pre-wrap text-sm leading-6">
        {section.body ?? ""}
      </div>
    </section>
  );
}

function SimpleChart({ chart }: { chart: Chart }): React.JSX.Element {
  const series = chartSeries(chart);
  const kind = chartKind(chart);
  const data = normalizeChartData(chart, series);

  if (chart.data.length === 0 || series.length === 0) {
    return (
      <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
        No chart data.
      </div>
    );
  }

  return (
    <div className="w-full" data-chart-type={kind}>
      <ResponsiveContainer
        width="100%"
        height={256}
        minWidth={0}
      >
        {kind === "line" ? (
          <AreaChart
            data={data}
            margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey={chart.xKey}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis hide />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ stroke: "var(--border)" }}
              offset={0}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ color: "var(--muted-foreground)", fontSize: 12 }}
            />
            {series.map((s, index) => {
              const color = s.color ?? paletteColor(index);
              return (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  name={s.label ?? s.key}
                  stroke={color}
                  fill={color}
                  fillOpacity={0.12}
                  strokeWidth={3}
                  dot={{ r: 4, fill: color, strokeWidth: 0 }}
                  activeDot={{ r: 5 }}
                />
              );
            })}
          </AreaChart>
        ) : (
          <BarChart
            data={data}
            margin={{ top: 8, right: 16, bottom: 0, left: 0 }}
            accessibilityLayer
          >
            <CartesianGrid stroke="var(--border)" vertical={false} />
            <XAxis
              dataKey={chart.xKey}
              axisLine={false}
              tickLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
            />
            <YAxis hide />
            <Tooltip
              content={<ChartTooltip />}
              cursor={{ fill: "var(--muted)" }}
              offset={0}
            />
            <Legend
              iconType="circle"
              wrapperStyle={{ color: "var(--muted-foreground)", fontSize: 12 }}
            />
            {series.map((s, index) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label ?? s.key}
                fill={s.color ?? paletteColor(index)}
                radius={[4, 4, 0, 0]}
              />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

function ChartTooltip({
  active,
  label,
  payload,
}: {
  active?: boolean;
  label?: unknown;
  payload?: Array<{ color?: string; name?: string; value?: unknown }>;
}): React.JSX.Element | null {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      role="tooltip"
      className="rounded-md border border-border bg-background px-3 py-2 text-xs text-foreground shadow-md"
    >
      <div className="font-medium">{String(label ?? "")}</div>
      <div className="mt-1 space-y-1 text-muted-foreground">
        {payload.map((item) => (
          <div key={item.name} className="flex items-center gap-1.5">
            <span
              className="size-2 rounded-full"
              style={{ backgroundColor: item.color ?? paletteColor(0) }}
            />
            <span>{item.name}</span>
            <span className="ml-auto font-medium text-foreground">
              {String(item.value ?? "")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function chartKind(chart: Chart): "bar" | "line" {
  const raw = String(chart.type).toLowerCase();
  if (raw.includes("line") || raw.includes("area")) return "line";
  return "bar";
}

function chartSeries(chart: Chart): ChartSeries[] {
  if (chart.series && chart.series.length > 0) return chart.series;
  if (chart.yKey) return [{ key: chart.yKey }];
  return [];
}

function normalizeChartData(
  chart: Chart,
  series: ChartSeries[],
): Record<string, unknown>[] {
  return chart.data.map((item) => {
    const normalized: Record<string, unknown> = { ...item };
    for (const s of series) {
      normalized[s.key] = numericValue(item[s.key]);
    }
    return normalized;
  });
}

function numericValue(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
}
