<script lang="ts">
import HistoryAnalyzer from '$/history/analyzer';
import type { AttachmentHistory } from '$/history/history';
import { toTimeString } from '$/utils';

export default {
    props: {
        history: {
            type: Array<AttachmentHistory>,
            required: true,
        },
    },
    data() {
        return {
            items: new Array<{
                dot: 'default' | 'primary' | 'warning';
                date: Date;
                content: string;
                title?: string;
            }>(),
        };
    },
    watch: {
        history(newHis: AttachmentHistory[]) {
            this.items.length = 0;
            const ha = new HistoryAnalyzer(newHis),
                attachments = ha.validAttachments;
            attachments.forEach(att => {
                const title =
                    attachments.length > 1
                        ? (att.getField('title') as string)
                        : undefined;
                this.items.push(
                    {
                        dot: 'default',
                        date: new Date(att.dateAdded),
                        content: addon.locale.dateAdded,
                        title,
                    },
                    {
                        dot: 'warning',
                        date: new Date(att.dateModified),
                        content: addon.locale.dateModified,
                        title,
                    }
                );
            });
            newHis.forEach(his => {
                const ha = new HistoryAnalyzer([his]),
                    dateTimeStats = ha.dateTimeStats;
                dateTimeStats.forEach(({ date, time }) => {
                    this.items.push({
                        dot: 'primary',
                        date: new Date(date),
                        content: toTimeString(time),
                        title:
                            attachments.length > 1 ? ha.titles[0] : undefined,
                    });
                });
            });
            this.items = this.items.sort(
                (a, b) => a.date.getTime() - b.date.getTime()
            );
        },
    },
};
</script>

<template>
  <div class="timeline">
    <t-timeline style="margin: auto">
      <t-timeline-item
        v-for="item of items" :key="item.date.getTime()" 
        :label="item.date.toLocaleDateString()" 
        :dot-color="item.dot"
      >
        <t-tag v-if="item.title" theme="success" variant="light" max-width="220px">
          {{ item.title }}
        </t-tag>
        <p>{{ item.content }}</p>
      </t-timeline-item>
    </t-timeline>
  </div>
</template>

<style scoped>
.timeline {
    background: var(--td-bg-color-secondarycontainer, #f8fafc);
    border: 1px solid var(--td-border-level-1-color, #eef2f7);
    border-radius: 8px;
    box-sizing: border-box;
    min-height: 260px;
    padding: 14px 12px 8px;
}

.timeline :deep(.t-timeline) {
    margin: 0;
}

.timeline :deep(.t-timeline-item__content) {
    color: var(--td-text-color-primary, #111827);
    font-size: 13px;
}

.timeline :deep(.t-timeline-item__label) {
    color: var(--td-text-color-secondary, #64748b);
    font-size: 12px;
}

.timeline p {
    margin: 4px 0 0;
}
</style>
