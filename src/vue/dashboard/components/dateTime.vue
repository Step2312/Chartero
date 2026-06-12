<template>
  <section class="reading-chart">
    <header class="chart-summary">
      <div>
        <span>{{ addon.locale.totalTime }}</span>
        <strong>{{ toTimeString(stats.total) }}</strong>
      </div>
      <div>
        <span>{{ addon.locale.date }}</span>
        <strong>{{ stats.days }}</strong>
      </div>
      <div>
        <span>{{ averageLabel }}</span>
        <strong>{{ toTimeString(stats.average) }}</strong>
      </div>
    </header>
    <Chart :key="JSON.stringify(theme)" ref="chart" class="chart" :options="options" />
  </section>
</template>

<script lang="ts">
import { Chart } from 'highcharts-vue';
import { defineComponent } from 'vue';
import { buttons, helpMessageOption } from '@/utils';
import Highcharts from '@/highcharts';
import HistoryAnalyzer from '$/history/analyzer';
import type {
    ExportingOptions,
    Options,
    SeriesColumnOptions,
    Tooltip,
} from 'highcharts';
import type { AttachmentHistory } from '$/history/history';
import { toTimeString } from '$/utils';

function tooltipFormatter(
    this: { x?: number; y?: number; series: { color?: string; name: string } },
    tooltip: Tooltip
) {
    const result =
        tooltip.chart.series.length > 1
            ? `<span style="color: ${this.series.color}">\u25CF</span> ${this.series.name}:<br>`
            : '';
    return (
        result +
        `${addon.locale.date}: ${Highcharts.dateFormat(
            '%Y-%m-%d',
            this.x as number
        )}<br>${addon.locale.time}: ${toTimeString(this.y as number)}`
    );
}

export default defineComponent({
    data() {
        return {
            addon,
            toTimeString,
            averageLabel: `${addon.locale.time}/${addon.locale.date}`,
            stats: {
                total: 0,
                days: 0,
                average: 0,
            },
            chartOpts: {
                exporting: {
                    buttons,
                    menuItemDefinitions: helpMessageOption(
                        addon.locale.doc.dateTime
                    ),
                } as ExportingOptions,
                chart: {
                    backgroundColor: 'transparent',
                    height: 280,
                    spacing: [8, 8, 8, 8],
                    zooming: { type: 'x' },
                },
                plotOptions: {
                    series: {
                        animation: { duration: 260 },
                        cursor: 'auto',
                    },
                    column: {
                        borderRadius: 5,
                        borderWidth: 0,
                        color: '#2563eb',
                        pointPadding: 0.08,
                    },
                },
                legend: { enabled: false },
                tooltip: {
                    formatter: tooltipFormatter,
                },
                xAxis: {
                    type: 'datetime',
                    tickLength: 0,
                    title: { text: undefined },
                },
                yAxis: {
                    gridLineDashStyle: 'Dash',
                    min: 0,
                    title: { text: undefined },
                    labels: { formatter: ctx => toTimeString(ctx.value) },
                },
                series: [{ type: 'column' }],
            } as Options,
        };
    },
    computed: {
        options() {
            return Highcharts.merge(this.chartOpts, this.theme);
        },
    },
    watch: {
        history: {
            immediate: true,
            handler(newHis: AttachmentHistory[]) {
            if (!newHis) return;
            (this.$refs.chart as typeof Chart | undefined)?.chart?.hideData();
            const allStats = newHis.flatMap(attHis => new HistoryAnalyzer([attHis]).dateTimeStats),
                total = allStats.reduce((sum, stat) => sum + stat.time, 0);
            this.stats = {
                total,
                days: allStats.length,
                average: allStats.length ? Math.round(total / allStats.length) : 0,
            };

            this.chartOpts.series = newHis.map(attHis => {
                const ha = new HistoryAnalyzer([attHis]);
                return {
                    type: 'column',
                    name:
                        newHis.length > 1
                            ? ha.titles[0]
                            : `${addon.locale.time}(${addon.locale.seconds})`,
                    data: ha.dateTimeStats.map(obj => [obj.date, obj.time]),
                } as SeriesColumnOptions;
            });
            this.chartOpts.legend!.enabled = newHis.length > 1;
        },
        },
    },
    props: {
        history: { type: Array<AttachmentHistory>, required: true },
        theme: Object,
    },
    components: { Chart },
});
</script>

<style scoped>
.reading-chart {
    display: grid;
    gap: 10px;
}

.chart-summary {
    display: grid;
    gap: 8px;
    grid-template-columns: repeat(3, minmax(0, 1fr));
}

.chart-summary div {
    background: var(--td-bg-color-secondarycontainer, #f8fafc);
    border: 1px solid var(--td-border-level-1-color, #eef2f7);
    border-radius: 8px;
    display: grid;
    gap: 2px;
    min-width: 0;
    padding: 9px 10px;
}

.chart-summary span {
    color: var(--td-text-color-secondary, #64748b);
    font-size: 12px;
    line-height: 16px;
}

.chart-summary strong {
    color: var(--td-text-color-primary, #111827);
    font-size: 15px;
    line-height: 20px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.chart {
    min-height: 280px;
}
</style>
