import { AttachmentHistory } from './history';
import readerStyles from './reader.sass';

// 防止阅读器侧边栏搜索到主条目下的笔记
export const patchedZoteroSearch = ((origin: Zotero.Search['search']) =>
    async function (this: Zotero.Search, asTempTable: boolean) {
        const ids: number[] = await origin.apply(this, asTempTable), // 原始搜索结果
            conditions = this.getConditions(); // 当前搜索的条件
        if (
            !asTempTable &&
            !conditions[2] &&
            conditions[0]?.condition == 'libraryID' &&
            conditions[0]?.operator == 'is' &&
            conditions[1]?.condition == 'itemType' &&
            conditions[1]?.operator == 'is' &&
            conditions[1]?.value == 'note'
        ) {
            // 必须在这个if语句内，否则可能产生递归！
            const mainItem = await addon.history.getMainItem(parseInt(conditions[0].value));
            // window.console.trace(ids, conditions, mainItemKey);
            return ids.filter(id => Zotero.Items.get(id).parentItemKey != mainItem.key);
        }
        return ids;
    }) as any;

export function protectData(event: string, ids: number[] | string[]) {
    if (!addon.history.cacheLoaded || __dev__) return;
    const restore = (item: Zotero.DataObject) => {
        Zotero.debug(addon.locale.history.deletingItem);
        Zotero.debug(item);
        // 恢复被删的条目
        item.deleted = false;
        item.saveTx({ skipDateModifiedUpdate: true, skipNotifier: true });
    },
        items = ids.map(id => Zotero.Items.get(id)), // 触发事件的条目
        mainItems = items.filter(it => addon.history.isMainItem(it)); // 筛选出的主条目

    switch (event) {
        case 'trash':
            mainItems.forEach(restore); // 恢复所有被删的主条目
            for (const it of items) // 恢复主条目下所有笔记
                if (addon.history.isHistoryNote(it)) restore(it);
            break;

        case 'modify':
            mainItems.forEach(it => {
                // TODO: 若archiveLocation已被修改，则此处无法获取，考虑patch setField
            });
            // for (const it of items)
            //     if (await addon.history.isHistoryNote(it))
            //         window.alert(addon.locale.history.modifyingNote);
            break; // TODO：此处并不能阻止修改，且保存时需skipNotify

        default:
            break;
    }
}

/**
 * 清理无效记录
 * 1. 若条目已被删除，则删除相应的记录
 * 2. 若存在重复记录，则合并所有的记录
 */
export async function compressHistory() {
    for (const mainItem of addon.history.mainItems) {
        // 遍历文库
        const hisMap: { [key: string]: AttachmentHistory } = {};
        for (const noteItem of Zotero.Items.get(mainItem.getNotes())) {
            const history = addon.history.parseNote(noteItem),
                att = history && Zotero.Items.getByLibraryAndKey(noteItem.libraryID, history.key);
            if (!att || att.deleted) {
                // 条目已被删除或记录解析失败
                noteItem.deleted = true;
                addon.log('Deleting invalid history note', noteItem);
                await noteItem.saveTx({ skipSelect: true, skipNotifier: true });
            } else if (att instanceof Zotero.Item) {
                // 有效记录
                if (att.addRelatedItem(noteItem)) await att.saveTx({ skipSelect: true, skipNotifier: true });
                if (noteItem.addRelatedItem(att))
                    await noteItem.saveTx({ skipSelect: true, skipNotifier: true });

                if (hisMap[history.key]) {
                    // 合并重复记录
                    hisMap[history.key].record.mergeJSON(JSON.parse(JSON.stringify(history.record)));
                    noteItem.deleted = true;
                    addon.log('Deleting duplicate history note', noteItem);
                    await noteItem.saveTx({ skipSelect: true, skipNotifier: true });
                } else hisMap[history.key] = { note: noteItem, ...history };
            }
        }
        for (const his of Object.values(hisMap)) {
            // 压缩后保存记录
            addon.history.compress(his.record);
            addon.log('Saving compressed history note', his.note);
            his.note.setNote(`chartero#${his.key}\n${JSON.stringify(his.record)}`);
            await his.note.saveTx({ skipSelect: true, skipNotifier: true });
        }
    }
    if (Zotero.getMainWindow().confirm(addon.locale.confirmRestart)) Zotero.Utilities.Internal.quit(true);
}

export function initReaderAlert(doc: Document) {
    const container = doc?.getElementById('split-view');
    if (!container) return;

    addon.ui.appendElement(
        {
            tag: 'style',
            namespace: 'html',
            ignoreIfExists: true,
            properties: { textContent: readerStyles },
        },
        doc.head!,
    );
    addon.ui.appendElement(
        {
            tag: 'div',
            classList: ['hidden'],
            ignoreIfExists: true,
            id: 'chartero-reader-alert',
        },
        container,
    );

    // 立即隐藏警告
    const frames = doc.defaultView?.frames;
    for (let i = 0; i < (frames?.length ?? 0); ++i)
        (['wheel', 'keydown'] as Array<keyof WindowEventMap>).forEach(event =>
            frames![i].addEventListener(event, () => {
                doc.getElementById('chartero-reader-alert')?.classList.toggle('hidden', true);
            }),
        );
}

export function hideDeleteMenuForHistory({ target }: Event) {
    const doc = (target as Element).ownerDocument!,
        menu = doc.querySelector('#zotero-itemmenu .zotero-menuitem-move-to-trash') as XULMenuItemElement,
        hasHis = Zotero.getActiveZoteroPane()
            .getSelectedItems()
            .some(item => addon.history.isMainItem(item) || addon.history.isHistoryNote(item));
    menu.setAttribute('disabled', hasHis.toString());
}
