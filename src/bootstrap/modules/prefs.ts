import { compressHistory } from "./history/misc";
import {
    OFFICIAL_RANK_OPTIONS,
    refreshPublicationRankColumns,
} from './easyScholar';
import { createExcludedTagRegExp } from './tagFilter';

export default function initPrefsPane(win: Window) {
    // 绑定事件
    const $: typeof Document.prototype.getElementById = win.document.getElementById.bind(win.document);
    $('chartero-preferences-pane-history-compress')?.addEventListener('command', compressHistory);
    $('chartero-preferences-pane-refreshTagsTable')?.addEventListener(
        'command',
        () => void refreshExcludedTags(win.document)
    );
    $('chartero-preferences-pane-addExcludedTag')?.addEventListener(
        'click',
        () => void addExcludedTag(win.document)
    );
    $('chartero-preferences-pane-addExcludedTagPattern')?.addEventListener(
        'click',
        () => addExcludedTagPattern(win.document)
    );
    void refreshExcludedTags(win.document);
    refreshEasyScholarRanks(win.document);
    bindEasyScholarDisplayPrefs(win.document);
    updateHistorySize(win.document);
}

// 渲染标签
async function refreshExcludedTags(doc: Document) {
    const tags = addon.getPref('excludedTags'),
        patterns = addon.getPref('excludedTagPatterns'),
        table = doc.getElementById('chartero-preferences-pane-excludedTagsTable') as HTMLDivElement,
        patternTable = doc.getElementById('chartero-preferences-pane-excludedTagPatternsTable') as HTMLDivElement,
        tagSelect = doc.getElementById('chartero-preferences-pane-tagSelect') as HTMLSelectElement;
    table.replaceChildren();
    patternTable.replaceChildren();
    try {
        tags.forEach((tag: number) => addon.ui.appendElement({
            tag: 'div',
            id: 'chartero-preferences-pane-ignoredTag-' + tag,
            classList: ['chartero-preferences-pane-ignoredTag'],
            properties: { textContent: getTagName(tag) },
            listeners: [{ type: 'click', listener: onTagClick as EventListener }]
        }, table));
    } catch (error) {
        addon.log('Resetting ignoredTags: ', error);
        addon.setPref('excludedTags');
    }
    if (!table.childElementCount)
        table.innerText = addon.locale.noExcludedTags;

    patterns.forEach((pattern: string) => addon.ui.appendElement({
        tag: 'div',
        id: 'chartero-preferences-pane-ignoredTagPattern-' + encodeURIComponent(pattern),
        classList: ['chartero-preferences-pane-ignoredTag', 'chartero-preferences-pane-ignoredPattern'],
        properties: { textContent: pattern },
        listeners: [{ type: 'click', listener: onPatternClick as EventListener }]
    }, patternTable));
    if (!patternTable.childElementCount)
        patternTable.innerText = '暂无排除标签规则';

    await refreshTagSelect(tagSelect, tags);
}

async function refreshTagSelect(select: HTMLSelectElement, excludedTags: number[]) {
    if (!select) return;
    select.replaceChildren();
    const doc = select.ownerDocument;
    if (!doc) return;
    const ids = await getAutomaticTagIDs();
    for (const id of ids) {
        if (excludedTags.includes(id)) continue;
        const option = doc.createElement('option');
        option.value = String(id);
        option.textContent = getTagName(id);
        select.append(option);
    }
    if (!select.childElementCount) {
        const option = doc.createElement('option');
        option.value = '';
        option.textContent = 'No available automatic tags';
        select.append(option);
    }
}

async function getAutomaticTagIDs() {
    const libraryIDs = new Set<number>([Zotero.Libraries.userLibraryID]);
    try {
        for (const group of Zotero.Groups.getAll()) {
            const libraryID = Zotero.Groups.getLibraryIDFromGroupID(group.id);
            if (libraryID) libraryIDs.add(libraryID);
        }
    } catch (error) {
        addon.log('Failed to load group libraries for tag filter:', error);
    }

    const ids = new Set<number>();
    for (const libraryID of libraryIDs) {
        try {
            for (const id of await Zotero.Tags.getAutomaticInLibrary(libraryID))
                ids.add(id);
        } catch (error) {
            addon.log('Failed to load automatic tags:', libraryID, error);
        }
    }
    return Array.from(ids).sort((a, b) => getTagName(a).localeCompare(getTagName(b)));
}

function getTagName(tagID: number) {
    return Zotero.Tags.getName(tagID) || String(tagID);
}

async function addExcludedTag(doc: Document) {
    const select = doc.getElementById('chartero-preferences-pane-tagSelect') as HTMLSelectElement,
        tagID = Number(select.value);
    if (!tagID) return;

    const tags = addon.getPref('excludedTags');
    if (!tags.includes(tagID)) {
        tags.push(tagID);
        addon.setPref('excludedTags', tags);
    }
    await refreshExcludedTags(doc);
}

function addExcludedTagPattern(doc: Document) {
    const input = doc.getElementById('chartero-preferences-pane-tagPatternInput') as HTMLInputElement,
        pattern = input.value.trim();
    if (!pattern) return;

    try {
        createExcludedTagRegExp(pattern);
    } catch (error) {
        doc.defaultView?.alert(`Invalid regex: ${error}`);
        return;
    }

    const patterns = addon.getPref('excludedTagPatterns');
    if (!patterns.includes(pattern)) {
        patterns.push(pattern);
        addon.setPref('excludedTagPatterns', patterns);
    }
    input.value = '';
    void refreshExcludedTags(doc);
}

function onTagClick(event: MouseEvent) {
    const div = event.target as HTMLDivElement,
        win = div.ownerDocument?.defaultView;
    if (win?.confirm(addon.locale.confirmRemoveExcludedTag)) {
        const tagID = div.id.split('-').at(-1),
            tags = addon.getPref('excludedTags');
        tags.splice(tags.indexOf(Number(tagID)), 1);
        addon.setPref('excludedTags', tags);
        void refreshExcludedTags(win.document);
    }
}

function onPatternClick(event: MouseEvent) {
    const div = event.target as HTMLDivElement,
        win = div.ownerDocument?.defaultView,
        pattern = decodeURIComponent(div.id.split('-').at(-1) ?? '');
    if (win?.confirm('Remove this excluded tag regex?')) {
        const patterns = addon.getPref('excludedTagPatterns'),
            index = patterns.indexOf(pattern);
        if (index >= 0) patterns.splice(index, 1);
        addon.setPref('excludedTagPatterns', patterns);
        void refreshExcludedTags(win.document);
    }
}

function refreshEasyScholarRanks(doc: Document) {
    const container = doc.getElementById('chartero-preferences-pane-easyScholar-ranks') as HTMLDivElement | null;
    if (!container) return;

    const selected = new Set(addon.getPref('easyScholarOfficialRankKeys'));
    container.replaceChildren();
    for (const group of EASY_SCHOLAR_RANK_GROUPS) {
        const section = doc.createElement('section'),
            title = doc.createElement('div'),
            grid = doc.createElement('div');
        section.className = 'chartero-preferences-pane-rank-group';
        title.className = 'chartero-preferences-pane-rank-group-title';
        title.textContent = group.label;
        grid.className = 'chartero-preferences-pane-rank-chip-grid';
        for (const option of OFFICIAL_RANK_OPTIONS.filter(item => group.keys.includes(item.key))) {
            const label = doc.createElement('label'),
                checkbox = doc.createElement('input'),
                text = doc.createElement('span');
            label.className = 'chartero-preferences-pane-rank-chip';
            checkbox.type = 'checkbox';
            checkbox.checked = selected.has(option.key);
            text.textContent = option.label;
            checkbox.addEventListener('change', () => {
                if (checkbox.checked) selected.add(option.key);
                else selected.delete(option.key);
                addon.setPref('easyScholarOfficialRankKeys', [...selected]);
                refreshPublicationRankColumns();
            });
            label.append(checkbox, text);
            grid.append(label);
        }
        section.append(title, grid);
        container.append(section);
    }
}

const EASY_SCHOLAR_RANK_GROUPS = [
    {
        label: '核心 / 会议',
        keys: ['zhongguokejihexin', 'ccf', 'eii', 'pku', 'cssci', 'cscd', 'ahci'],
    },
    {
        label: 'SCI / 中科院',
        keys: ['sci', 'ssci', 'sciUp', 'sciUpTop', 'sciUpSmall', 'sciBase', 'sciwarn'],
    },
    {
        label: '指标',
        keys: ['sciif', 'sciif5', 'jci', 'esi'],
    },
    {
        label: '商管',
        keys: ['ajg', 'ft50', 'utd24', 'fms'],
    },
    {
        label: '新锐 / 高校',
        keys: [
            'xr', 'xrWarn', 'xrTop', 'xrSmall', 'swufe', 'cufe', 'uibe', 'sdufe',
            'ruc', 'xmu', 'sjtu', 'fdu', 'hhu', 'scu', 'cpu', 'cqu', 'nju',
            'xju', 'cug', 'xdu', 'swjtu', 'cju', 'zju',
        ],
    },
];

function bindEasyScholarDisplayPrefs(doc: Document) {
    [
        'easyScholarShowOfficialSelected',
        'easyScholarShowOfficialAllFallback',
        'easyScholarShowCustom',
        'easyScholarRankLimit',
    ].forEach(key => {
        const input = doc.getElementById(`chartero-${key}`);
        input?.addEventListener('change', () => {
            refreshPublicationRankColumns();
        });
        input?.addEventListener('command', () => {
            refreshPublicationRankColumns();
        });
    });
}

function updateHistorySize(doc: Document) {
    const size = addon.history.getAll().reduce(
        (acc, cur) => acc += (cur?.note.note.length ?? 0)
        , 0
    ) / 1024;
    doc.getElementById(
        'chartero-preferences-pane-history-size'
    )?.setAttribute(
        'data-l10n-args',
        JSON.stringify({ size: size.toFixed(2) })
    );
}
