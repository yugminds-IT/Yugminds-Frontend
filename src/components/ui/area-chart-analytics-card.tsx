"use client";

import * as React from "react";
import { Area, AreaChart, XAxis, YAxis } from "recharts";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type AnalyticsPoint = {
  label: string;
  value: number;
};

export type AreaChartAnalyticsCardProps = {
  title: string;
  value: string | number;
  description: string;
  badge?: string;
  info?: string;
  icon?: React.ReactNode;
  data?: AnalyticsPoint[];
  accentColor?: string;
  sideMetric?: string;
  sideLabel?: string;
  className?: string;
};

const defaultData: AnalyticsPoint[] = [
  { label: "1", value: 12 },
  { label: "2", value: 18 },
  { label: "3", value: 14 },
  { label: "4", value: 24 },
  { label: "5", value: 20 },
  { label: "6", value: 28 },
];

const chartConfig = {
  value: {
    label: "Value",
    color: "var(--analytics-accent)",
  },
} satisfies ChartConfig;

export function AreaChartAnalyticsCard({
  title,
  value,
  description,
  badge = "Live",
  info,
  icon,
  data = defaultData,
  accentColor = "#0891b2",
  sideMetric,
  sideLabel,
  className,
}: AreaChartAnalyticsCardProps) {
  const displayValue =
    typeof value === "number" ? value.toLocaleString("en-IN") : value;

  const chartData = data.length > 0 ? data : defaultData;

  return (
    <Card
      className={cn(
        "flex h-full min-h-[132px] flex-col gap-0 overflow-hidden p-0 shadow-none",
        className,
      )}
      style={{ "--analytics-accent": accentColor } as React.CSSProperties}
    >
      <CardHeader className="flex flex-row items-start justify-between gap-3 px-4 pb-0 pt-4">
        <div className="flex min-w-0 items-center gap-1.5">
          <CardTitle className="truncate text-sm font-medium text-muted-foreground">
            {title}
          </CardTitle>
          {info && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger aria-label={`${title} details`} className="shrink-0">
                  <svg
                    width={18}
                    height={18}
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="size-4 text-muted-foreground/50"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M10 16.25a6.25 6.25 0 100-12.5 6.25 6.25 0 000 12.5zm1.116-3.041l.1-.408a1.709 1.709 0 01-.25.083 1.176 1.176 0 01-.308.048c-.193 0-.329-.032-.407-.095-.079-.064-.118-.184-.118-.359a3.514 3.514 0 01.118-.672l.373-1.318c.037-.121.062-.255.075-.4a3.73 3.73 0 00.02-.304.866.866 0 00-.292-.678c-.195-.174-.473-.26-.833-.26-.2 0-.412.035-.636.106-.224.07-.459.156-.704.256l-.1.409c.073-.028.16-.057.262-.087.101-.03.2-.045.297-.045.198 0 .331.034.4.1.07.066.105.185.105.354 0 .093-.01.197-.034.31a6.216 6.216 0 01-.084.36l-.374 1.325c-.033.14-.058.264-.073.374-.015.11-.022.22-.022.325 0 .272.1.496.301.673.201.177.483.265.846.265.236 0 .443-.03.621-.092s.417-.152.717-.27zM11.05 7.85a.772.772 0 00.26-.587.78.78 0 00-.26-.59.885.885 0 00-.628-.244.893.893 0 00-.63.244.778.778 0 00-.264.59c0 .23.088.426.263.587a.897.897 0 00.63.243.888.888 0 00.629-.243z"
                      fill="currentColor"
                    />
                  </svg>
                </TooltipTrigger>
                <TooltipContent showArrow className="max-w-72">
                  <p className="text-xs">{info}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
        <div className="text-muted-foreground">{icon}</div>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col gap-3 p-0">
        <div className="flex items-center gap-2 px-4">
          <span className="text-2xl font-medium tracking-tight tabular-nums">
            {displayValue}
          </span>
          <Badge className="rounded-full bg-green-100 text-[10px] text-green-800 hover:bg-green-100">
            {badge}
          </Badge>
        </div>
        <p className="px-4 text-xs text-muted-foreground">{description}</p>

        <div className="mt-auto grid h-[58px] grid-cols-[1fr_92px] border-t border-border">
          <ChartContainer
            config={chartConfig}
            className="aspect-auto h-auto w-full"
          >
            <AreaChart
              accessibilityLayer
              data={chartData}
              margin={{ left: 0, right: -5, top: 8, bottom: 0 }}
            >
              <XAxis dataKey="label" hide />
              <YAxis hide domain={["dataMin - 5", "dataMax + 5"]} />
              <ChartTooltip
                content={<ChartTooltipContent hideLabel />}
                cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
              />
              <Area
                type="linear"
                dataKey="value"
                stroke={chartConfig.value.color}
                fill={chartConfig.value.color}
                fillOpacity={0.18}
                strokeWidth={2}
                dot={false}
                activeDot={{
                  r: 4,
                  fill: chartConfig.value.color,
                  stroke: "#ffffff",
                  strokeWidth: 2,
                }}
              />
            </AreaChart>
          </ChartContainer>
          <div className="flex flex-col items-start justify-end border-l-2 border-[var(--analytics-accent)] px-3 pb-3">
            <div className="text-sm font-semibold tracking-[-0.006em] text-foreground">
              {sideMetric ?? displayValue}
            </div>
            <div className="text-[11px] font-medium tracking-[-0.006em] text-muted-foreground">
              {sideLabel ?? badge}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const Component = () => {
  return (
    <AreaChartAnalyticsCard
      title="Campaign Data"
      value="$1,750"
      description="Daily activity for the last 28 days"
      badge="Last 28 days"
      sideMetric="45%"
      sideLabel="$32.9K used"
    />
  );
};
