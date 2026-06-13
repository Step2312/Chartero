<template>
  <main class="debug-console">
    <aside class="command-list">
      <header>
        <h1>Chartero 调试</h1>
        <button @click="runSnapshot">刷新</button>
      </header>
      <button
        v-for="cmd in commands"
        :key="cmd.label"
        class="command"
        @click="setAndRun(cmd.expression)"
      >
        <span>{{ cmd.label }}</span>
        <small>{{ cmd.hint }}</small>
      </button>
    </aside>

    <section class="workspace">
      <div class="input-row">
        <textarea v-model="expression" spellcheck="false" @keydown.ctrl.enter.prevent="runExpression"></textarea>
        <div class="actions">
          <button @click="runExpression">运行</button>
          <button @click="copyOutput">复制</button>
          <button @click="clearEntries">清空</button>
        </div>
      </div>

      <div class="entries">
        <article v-for="entry in entries" :key="entry.id" :class="['entry', entry.ok ? 'ok' : 'error']">
          <div class="entry-meta">
            <span>{{ entry.time }}</span>
            <code>{{ entry.expression }}</code>
          </div>
          <pre>{{ entry.output }}</pre>
        </article>
      </div>
    </section>
  </main>
</template>

<script lang="ts">
type ConsoleEntry = {
    id: number;
    ok: boolean;
    time: string;
    expression: string;
    output: string;
};

const commands = [
    {
        label: '调试快照',
        hint: '插件、Zotero、标签页、选择项',
        expression: `({
  addon: { id: addon.basicOptions.addonID, rootURI: addon.rootURI },
  zotero: { version: Zotero.version, locale: Zotero.locale },
  tab: {
    id: Zotero.getMainWindow().Zotero_Tabs.selectedID,
    type: Zotero.getMainWindow().Zotero_Tabs.selectedType,
  },
  selectedItems: ZoteroPane.getSelectedItems().map(item => ({
    id: item.id,
    key: item.key,
    libraryID: item.libraryID,
    itemType: item.itemType,
    title: item.getField('title'),
  })),
})`,
    },
    {
        label: '选中条目',
        hint: '当前条目关键字段',
        expression: `ZoteroPane.getSelectedItems().map(item => ({
  id: item.id,
  key: item.key,
  libraryID: item.libraryID,
  itemType: item.itemType,
  parentID: item.parentID,
  title: item.getField('title'),
}))`,
    },
    {
        label: '当前分类',
        hint: '左侧选中 collection/search',
        expression: `(() => {
  const row = ZoteroPane.getCollectionTreeRow();
  const ref = row?.ref;
  return {
    type: row?.type,
    id: ref?.id,
    key: ref?.key,
    libraryID: ref?.libraryID,
    name: ref?.name,
  };
})()`,
    },
    {
        label: '当前阅读器',
        hint: '当前标签页 reader',
        expression: `(() => {
  const tabs = Zotero.getMainWindow().Zotero_Tabs;
  const reader = Zotero.Reader.getByTabID(tabs.selectedID);
  return reader && {
    itemID: reader.itemID,
    type: reader.type,
    tabID: reader.tabID,
    state: reader._state,
  };
})()`,
    },
    {
        label: '历史主条目',
        hint: 'Chartero 历史缓存',
        expression: `addon.history._mainItems?.map(item => item && ({
  id: item.id,
  key: item.key,
  libraryID: item.libraryID,
  title: item.getField('title'),
}))`,
    },
    {
        label: '插件设置',
        hint: '当前偏好设置',
        expression: `Object.fromEntries(Object.keys(addon.basicOptions.prefs || {}).map(key => [key, addon.getPref(key)]))`,
    },
];
const defaultCommand = commands[0]!;

export default {
    data() {
        return {
            commands,
            expression: defaultCommand.expression,
            entries: [] as ConsoleEntry[],
            seq: 0,
        };
    },
    mounted() {
        this.runSnapshot();
    },
    methods: {
        runSnapshot() {
            this.setAndRun(defaultCommand.expression);
        },
        setAndRun(expression: string) {
            this.expression = expression;
            void this.runExpression();
        },
        async runExpression() {
            const expression = this.expression.trim();
            if (!expression) return;
            try {
                const result = await evaluate(expression);
                this.pushEntry(true, expression, formatValue(result));
            } catch (error) {
                this.pushEntry(false, expression, formatError(error));
            }
        },
        copyOutput() {
            const output = this.entries.map(entry => `[${entry.time}] ${entry.expression}\n${entry.output}`).join('\n\n');
            navigator.clipboard?.writeText(output);
        },
        clearEntries() {
            this.entries = [];
        },
        pushEntry(ok: boolean, expression: string, output: string) {
            this.entries.unshift({
                id: ++this.seq,
                ok,
                time: new Date().toLocaleTimeString(),
                expression,
                output,
            });
        },
    },
};

async function evaluate(expression: string) {
    const ZoteroPane = Zotero.getActiveZoteroPane();
    return new Function('Zotero', 'ZoteroPane', 'addon', `return (${expression})`)(Zotero, ZoteroPane, addon);
}

function formatValue(value: unknown) {
    if (typeof value == 'string') return value;
    return JSON.stringify(value, getCircularReplacer(), 2);
}

function formatError(error: unknown) {
    if (error instanceof Error) return `${error.name}: ${error.message}\n${error.stack ?? ''}`.trim();
    return String(error);
}

function getCircularReplacer() {
    const seen = new WeakSet<object>();
    return (_key: string, value: unknown) => {
        if (typeof value != 'object' || value == null) return value;
        if (seen.has(value)) return '[Circular]';
        seen.add(value);
        return value;
    };
}
</script>

<style scoped>
.debug-console {
    display: grid;
    grid-template-columns: minmax(220px, 280px) 1fr;
    height: 100vh;
    color: var(--td-text-color-primary);
    background: var(--td-bg-color-page);
    font: 13px/1.45 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}

.command-list {
    border-right: 1px solid var(--td-component-border);
    background: var(--td-bg-color-container);
    overflow: auto;
}

header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 14px;
    border-bottom: 1px solid var(--td-component-border);
}

h1 {
    margin: 0;
    font-size: 16px;
    font-weight: 650;
}

button {
    border: 1px solid var(--td-component-border);
    border-radius: 4px;
    padding: 6px 10px;
    color: var(--td-text-color-primary);
    background: var(--td-bg-color-container);
    cursor: pointer;
}

button:hover {
    background: var(--td-bg-color-container-hover);
}

.command {
    display: grid;
    width: calc(100% - 16px);
    margin: 8px;
    text-align: left;
}

.command span {
    font-weight: 600;
}

.command small {
    margin-top: 2px;
    color: var(--td-text-color-secondary);
}

.workspace {
    display: grid;
    grid-template-rows: auto 1fr;
    min-width: 0;
}

.input-row {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 10px;
    padding: 12px;
    border-bottom: 1px solid var(--td-component-border);
    background: var(--td-bg-color-container);
}

textarea {
    box-sizing: border-box;
    width: 100%;
    min-height: 132px;
    resize: vertical;
    border: 1px solid var(--td-component-border);
    border-radius: 4px;
    padding: 10px;
    color: var(--td-text-color-primary);
    background: var(--td-bg-color-secondarycontainer);
    font: 12px/1.45 Consolas, "Cascadia Mono", monospace;
}

.actions {
    display: grid;
    align-content: start;
    gap: 8px;
    min-width: 88px;
}

.entries {
    overflow: auto;
    padding: 12px;
}

.entry {
    margin-bottom: 10px;
    border: 1px solid var(--td-component-border);
    border-left-width: 4px;
    border-radius: 6px;
    background: var(--td-bg-color-container);
}

.entry.ok {
    border-left-color: var(--td-success-color);
}

.entry.error {
    border-left-color: var(--td-error-color);
}

.entry-meta {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    padding: 8px 10px;
    border-bottom: 1px solid var(--td-component-border);
    color: var(--td-text-color-secondary);
}

.entry-meta code {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

pre {
    max-height: 420px;
    margin: 0;
    overflow: auto;
    padding: 10px;
    white-space: pre-wrap;
    word-break: break-word;
    font: 12px/1.45 Consolas, "Cascadia Mono", monospace;
}

@media (max-width: 760px) {
    .debug-console {
        grid-template-columns: 1fr;
        grid-template-rows: auto 1fr;
    }

    .command-list {
        max-height: 220px;
        border-right: 0;
        border-bottom: 1px solid var(--td-component-border);
    }

    .input-row {
        grid-template-columns: 1fr;
    }

    .actions {
        grid-template-columns: repeat(3, minmax(0, 1fr));
    }
}
</style>
