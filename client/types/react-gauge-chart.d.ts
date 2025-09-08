declare module "react-gauge-chart" {
  import * as React from "react";
  export interface GaugeChartProps {
    id?: string;
    nrOfLevels?: number;
    arcsLength?: number[];
    colors?: string[];
    percent?: number; // 0..1
    arcWidth?: number; // 0..1
    arcPadding?: number; // 0..1, spacing between colored sections
    cornerRadius?: number;
    needleColor?: string;
    needleBaseColor?: string;
    textColor?: string;
    animate?: boolean;
    formatTextValue?: (value: string) => string;
    style?: React.CSSProperties;
    className?: string;
  }
  const GaugeChart: React.FC<GaugeChartProps>;
  export default GaugeChart;
}
