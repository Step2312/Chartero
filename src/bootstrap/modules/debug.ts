import { config, version } from '../../../package.json';
import { ClipboardHelper } from 'zotero-plugin-toolkit';
import { ICON_URL } from './utils';

export function addDebugMenu() {
    const Zotero_Tabs = (Zotero.getMainWindow() as unknown as _ZoteroTypes.MainWindow).Zotero_Tabs;
    addon.menu.register('item', { tag: 'menuseparator' });
    addon.menu.register('item', {
        tag: 'menuitem',
        label: '输出到控制台',
        icon: ICON_URL,
        commandListener: () => addon.log(Zotero.getActiveZoteroPane().getSelectedItems()),
    });
    addon.menu.register('item', {
        tag: 'menuitem',
        label: '复制调试信息',
        icon: ICON_URL,
        commandListener: () => copySelectedItemsDebugInfo(),
    });

    addon.menu.register('collection', { tag: 'menuseparator' });
    addon.menu.register('collection', {
        tag: 'menuitem',
        label: '输出到控制台',
        icon: ICON_URL,
        commandListener: () => addon.log(Zotero.getActiveZoteroPane().getCollectionTreeRow()?.ref),
    });
    addon.menu.register('collection', {
        tag: 'menuitem',
        label: '复制调试信息',
        icon: ICON_URL,
        commandListener: () => copyCollectionDebugInfo(),
    });

    addon.menu.register('menuHelp', { tag: 'menuseparator' });
    addon.menu.register('menuTools', {
        tag: 'menu',
        label: 'Chartero 调试',
        icon: ICON_URL,
        children: [
            {
                tag: 'menuitem',
                label: '打开调试控制台',
                commandListener: () => openDebugConsole(),
            },
            { tag: 'menuseparator' },
            {
                tag: 'menuitem',
                label: '复制调试快照',
                commandListener: () => copyDebugSnapshot(),
            },
            {
                tag: 'menuitem',
                label: '输出调试快照',
                commandListener: () => addon.log(getDebugSnapshot()),
            },
            { tag: 'menuseparator' },
            {
                tag: 'menuitem',
                label: '输出当前阅读器',
                commandListener: () => addon.log(getActiveReader()),
            },
            {
                tag: 'menuitem',
                label: '输出 iframe 窗口',
                commandListener: () => logIframeWindow(),
            },
            {
                tag: 'menuitem',
                label: '输出历史主条目',
                commandListener: () => addon.log((<any>addon.history)._mainItems),
            },
            { tag: 'menuseparator' },
            {
                tag: 'menuitem',
                label: '清理启动缓存',
                commandListener: () => clearStartupCache(),
            },
            {
                tag: 'menuitem',
                label: '重载 Chartero',
                commandListener: () => reloadAddon(true),
            },
            {
                tag: 'menuitem',
                label: '重启 Zotero',
                commandListener: () => restartZotero(true),
            },
        ],
    });
    addon.menu.register('menuHelp', {
        tag: 'menuitem',
        label: '输出阅读器到控制台',
        icon: ICON_URL,
        commandListener: () => addon.log(getActiveReader()),
    });
    addon.menu.register('menuHelp', {
        tag: 'menuitem',
        label: '输出 iframe 到控制台',
        icon: ICON_URL,
        commandListener: () => logIframeWindow(),
    });
    addon.menu.register('menuHelp', {
        tag: 'menuitem',
        label: '输出历史主条目',
        icon: ICON_URL,
        commandListener: () => addon.log((<any>addon.history)._mainItems),
    });
    addon.menu.register('menuFile', {
        tag: 'menuitem',
        label: '重载',
        icon: ICON_URL,
        commandListener: () => reloadAddon(true),
    });
    addon.menu.register('menuFile', {
        tag: 'menuitem',
        label: '重启',
        icon: ICON_URL,
        commandListener: () => restartZotero(true),
    });
}

function getMainWindow() {
    return Zotero.getMainWindow() as unknown as _ZoteroTypes.MainWindow;
}

function getActiveReader() {
    return Zotero.Reader.getByTabID(getMainWindow().Zotero_Tabs.selectedID);
}

function logIframeWindow() {
    const reader = getActiveReader();
    addon.log((reader?._primaryView as _ZoteroTypes.Reader.PDFView | undefined)?._iframeWindow);
}

function copyToClipboard(data: unknown) {
    const text = typeof data == 'string' ? data : JSON.stringify(data, null, 2);
    new ClipboardHelper().addText(text, 'text/plain').copy();
    addon.log('已复制 Chartero 调试信息到剪贴板', data);
}

function copySelectedItemsDebugInfo() {
    copyToClipboard({
        selectedItems: getSelectedItemsInfo(),
    });
}

function copyCollectionDebugInfo() {
    copyToClipboard({
        collection: getCollectionInfo(),
    });
}

function copyDebugSnapshot() {
    copyToClipboard(getDebugSnapshot());
}

function getDebugSnapshot() {
    const reader = getActiveReader(),
        tab = getMainWindow().Zotero_Tabs;
    return {
        addon: {
            id: config.addonID,
            name: config.addonName,
            version,
            dev: true,
        },
        zotero: {
            version: Zotero.version,
            platform: Services.appinfo.OS,
            locale: Zotero.locale,
        },
        tab: {
            id: tab.selectedID,
            type: tab.selectedType,
        },
        reader: reader && {
            itemID: reader.itemID,
            type: reader.type,
            tabID: reader.tabID,
        },
        selection: getSelectedItemsInfo(),
        collection: getCollectionInfo(),
        history: {
            cacheLoaded: addon.history.cacheLoaded,
            mainItems: ((<any>addon.history)._mainItems ?? []).map(itemInfo),
        },
    };
}

function getSelectedItemsInfo() {
    try {
        return Zotero.getActiveZoteroPane().getSelectedItems().map(itemInfo);
    } catch (error) {
        Zotero.logError(toError(error));
        return [];
    }
}

function getCollectionInfo() {
    try {
        const row = Zotero.getActiveZoteroPane().getCollectionTreeRow(),
            ref = row?.ref as (Zotero.Collection | Zotero.Search | Zotero.Library | undefined);
        return {
            type: row?.type,
            id: (ref as any)?.id,
            key: (ref as any)?.key,
            libraryID: (ref as any)?.libraryID,
            name: (ref as any)?.name,
        };
    } catch (error) {
        Zotero.logError(toError(error));
        return null;
    }
}

function itemInfo(item: Zotero.Item | null | undefined) {
    if (!item) return null;
    return {
        id: item.id,
        key: item.key,
        libraryID: item.libraryID,
        itemType: item.itemType,
        isRegularItem: item.isRegularItem(),
        parentID: item.parentID,
        title: item.getField('title'),
    };
}

function clearStartupCache() {
    Services.obs.notifyObservers({}, 'startupcache-invalidate');
    addon.log('已清理启动缓存');
}

async function reloadAddon(confirm = false) {
    if (confirm && !getMainWindow().confirm('重载 Chartero？')) return;
    clearStartupCache();
    const { AddonManager } = ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs'),
        currentAddon = await AddonManager.getAddonByID(config.addonID);
    await currentAddon.reload();
}

function restartZotero(confirm = false) {
    if (confirm && !getMainWindow().confirm('重启 Zotero？')) return;
    Zotero.Utilities.Internal.quit(true);
}

function toError(error: unknown) {
    return error instanceof Error ? error : new Error(String(error));
}

function openDebugConsole() {
    const Zotero_Tabs = getMainWindow().Zotero_Tabs;
    if (addon.debugTabID) {
        Zotero_Tabs.select(addon.debugTabID);
        return;
    }

    const { id, container } = Zotero_Tabs.add({
        type: 'library',
        title: 'Chartero 调试',
        data: {},
        select: true,
        onClose: () => (addon.debugTabID = undefined),
    });
    addon.debugTabID = id;

    const debugConsole = addon.ui.appendElement(
        {
            tag: 'iframe',
            namespace: 'xul',
            attributes: {
                flex: 1,
                src: `chrome://${config.addonName}/content/debug/index.html`,
            },
        },
        container,
    ) as HTMLIFrameElement;
    (debugConsole.contentWindow as any).addon = addon;
}
