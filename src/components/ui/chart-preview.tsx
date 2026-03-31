"use client";

import React, { useMemo } from "react";

/**
 * Renders a Chart.js chart inside a sandboxed iframe.
 * The AI generates a JSON config block, and this component
 * converts it to a full Chart.js HTML page rendered live.
 */
export function ChartPreview({ config }: { config: string }) {
  const html = useMemo(() => {
    let parsed: any;
    try {
      parsed = JSON.parse(config);
    } catch {
      return `<html><body style="font-family:sans-serif;padding:20px;color:#999;">Invalid chart config</body></html>`;
    }

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js"></script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { background: #1a1a1a; display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 16px; }
    canvas { max-width: 100%; }
  </style>
</head>
<body>
  <canvas id="chart"></canvas>
  <script>
    const ctx = document.getElementById('chart').getContext('2d');
    const config = ${JSON.stringify(parsed)};
    // Apply dark theme defaults
    if (!config.options) config.options = {};
    if (!config.options.plugins) config.options.plugins = {};
    if (!config.options.plugins.legend) config.options.plugins.legend = {};
    if (!config.options.plugins.legend.labels) config.options.plugins.legend.labels = {};
    config.options.plugins.legend.labels.color = '#ccc';
    if (!config.options.scales) config.options.scales = {};
    ['x', 'y'].forEach(axis => {
      if (!config.options.scales[axis]) config.options.scales[axis] = {};
      if (!config.options.scales[axis].ticks) config.options.scales[axis].ticks = {};
      config.options.scales[axis].ticks.color = '#999';
      if (!config.options.scales[axis].grid) config.options.scales[axis].grid = {};
      config.options.scales[axis].grid.color = '#333';
    });
    new Chart(ctx, config);
  </script>
</body>
</html>`;
  }, [config]);

  return (
    <div className="my-4 rounded-xl border border-[var(--border-subtle)] bg-[#1a1a1a] overflow-hidden">
      <iframe
        title="Chart Preview"
        srcDoc={html}
        sandbox="allow-scripts"
        className="w-full h-[350px] border-none"
      />
    </div>
  );
}
