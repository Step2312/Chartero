import {
    UITool,
    ExtraFieldTool,
    MenuManager,
    PatchHelper,
    BasicTool,
    unregister,
} from 'zotero-plugin-toolkit';
import { config, name as packageName } from '../../package.json';
import ReadingHistory from './modules/history/history';
import { onAddonLoad, onHistoryRecord, onItemSelect, onMainWindowLoad } from './events';
import { WorkerManager } from './modules/utils';
import { G } from './modules/global';

type DefaultPrefs = Omit<typeof config.defaultSettings, 'excludedTags' | 'excludedTagPatterns'> & {
    excludedTags: number[];
    excludedTagPatterns: string[];
};

export default class Addon extends BasicTool {
    readonly extraField: ExtraFieldTool;
    readonly ui: UITool;
    readonly menu: MenuManager;
    readonly patchSearch: PatchHelper;
    readonly history: ReadingHistory;
    readonly locale: typeof import('../../addon/locale/zh-CN/chartero.json');

    readonly rootURI = rootURI;
    overviewTabID?: string;
    debugTabID?: string;
    notifierID?: string;
    private _worker?: WorkerManager;
    private initialized = false;
    private initTimer?: number;
    private readonly prefsObserverIDs: symbol[] = [];
    private readonly listeners = new Array<{
        target: WeakRef<EventTarget>;
        type: string;
        listener: EventListenerOrEventListenerObject;
    }>();

    constructor() {
        super();
        if (!__dev__) {
            this.basicOptions.log.prefix = `[${config.addonName}]`;
            this.basicOptions.log.disableConsole = true;
        }
        this.basicOptions.debug.disableDebugBridgePassword = __dev__;
        this.ui = new UITool(this);
        this.menu = new MenuManager(this);
        this.extraField = new ExtraFieldTool(this);
        this.history = new ReadingHistory(this, onHistoryRecord);
        this.patchSearch = new PatchHelper();
        this.locale = JSON.parse(Zotero.File.getContentsFromURL('chrome://chartero/locale/chartero.json'));
        this.ui.basicOptions.ui.enableElementDOMLog = __dev__;
    }

    get worker() {
        return (this._worker ??= new WorkerManager(
            new ChromeWorker(`resource://${packageName}/${config.addonName}-worker.mjs`, { type: 'module' }),
        ));
    }

    getPref<K extends keyof DefaultPrefs>(key: K) {
        // 若获取不到则使用默认值
        const pref = Zotero.Prefs.get(`${packageName}.${key}`) ?? JSON.stringify(config.defaultSettings[key]);
        // if (__dev__)
        //     this.log(`Getting pref ${key}:`, pref);
        switch (typeof config.defaultSettings[key]) {
            case 'object':
                return JSON.parse(pref as string) as DefaultPrefs[K];
            case 'number':
                return Number(pref) as DefaultPrefs[K];
            default:
                return pref as DefaultPrefs[K];
        }
    }

    setPref<K extends keyof DefaultPrefs>(key: K, value?: DefaultPrefs[K]) {
        // 若未指定则设为默认值
        value ??= <DefaultPrefs[K]>config.defaultSettings[key];
        if (__dev__) this.log(`Setting pref ${key}:`, value);
        Zotero.Prefs.set(`${packageName}.${key}`, typeof value == 'object' ? JSON.stringify(value) : value);
    }

    // 仅供初始化调用
    addPrefsObserver(fn: () => void, key: keyof DefaultPrefs) {
        this.prefsObserverIDs.push(Zotero.Prefs.registerObserver(`${packageName}.${key}`, fn));
    }

    registerListener(
        target: EventTarget,
        type: string,
        listener: EventListener,
        options?: AddEventListenerOptions | boolean,
    ): boolean;
    registerListener<T extends EventTarget, K extends keyof GlobalEventHandlersEventMap>(
        target: T,
        type: K,
        listener: (this: T, ev: GlobalEventHandlersEventMap[K]) => any,
        options?: AddEventListenerOptions | boolean,
    ) {
        if (typeof target?.addEventListener != 'function') return false;
        target.addEventListener(type, listener as EventListener, options);
        this.listeners.push({ target: new WeakRef(target), type, listener });
        return true;
    }

    /**
     * 初始化插件时调用
     */
    init(win?: _ZoteroTypes.MainWindow) {
        try {
            if (win && this.initialized) {
                onMainWindowLoad(win);
            } else if (!win) {
                this.scheduleInit();
            } else {
                this.scheduleInit();
            }
        } catch (error) {
            this.log(error);
        }
    }

    private scheduleInit() {
        if (this.initialized || this.initTimer) return;
        const win = Zotero.getMainWindow();
        this.initTimer = win.setTimeout(() => {
            this.initTimer = undefined;
            this.doInit();
        }, 0);
    }

    private doInit() {
        if (this.initialized) return;
        this.initialized = true;
        onAddonLoad();
        Zotero.getMainWindows().forEach(onMainWindowLoad);
    }

    async unload() {
        if (this.initTimer) {
            Zotero.getMainWindow().clearTimeout(this.initTimer);
            this.initTimer = undefined;
        }
        this.patchSearch.disable();
        this.overviewTabID && G('Zotero_Tabs').close(this.overviewTabID);
        this.debugTabID && G('Zotero_Tabs').close(this.debugTabID);
        this.notifierID && Zotero.Notifier.unregisterObserver(this.notifierID);
        this.prefsObserverIDs.forEach(id => Zotero.Prefs.unregisterObserver(id));
        this.listeners.forEach(({ target, type, listener }) =>
            target?.deref()?.removeEventListener(type, listener as EventListener),
        );
        if (this.initialized)
            (Zotero.getActiveZoteroPane().itemsView as any).onSelect.removeListener(onItemSelect);
        await this._worker?.close();
        unregister(this);
    }

    async test(key: string) {
        // create a new file attachment
        if (!__dev__) return;

        const item = Zotero.Items.get(411);
        const attachment = new Zotero.Item('attachment');
        attachment.libraryID = item.libraryID;
        attachment.parentID = item.id;
        attachment.attachmentLinkMode = Zotero.Attachments.LINK_MODE_IMPORTED_FILE;
        attachment.attachmentFilename = key + '.json';
        attachment.attachmentPath = `storage:${key}.json`;
        attachment.attachmentContentType = 'application/json';
        attachment.setField('title', key);
        await attachment.saveTx({ skipSelect: true, skipNotifier: true });
        const path = await Zotero.Attachments.createDirectoryForItem(attachment);
        const file = Zotero.File.pathToFile(PathUtils.join(path, key + '.json'));
        Zotero.File.putContents(file, JSON.stringify({ key }));

        // this.log(await attachment.getFilePathAsync());
        const res = await fetch(attachment.getLocalFileURL());
        this.log(await res.json());
    }
}
