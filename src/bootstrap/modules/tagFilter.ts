export function getExcludedTagIDs() {
    return addon.getPref('excludedTags');
}

export function getExcludedTagPatterns() {
    return addon.getPref('excludedTagPatterns');
}

export function createExcludedTagRegExp(pattern: string) {
    const trimmed = pattern.trim(),
        literal = /^\/(.+)\/([dgimsuvy]*)$/.exec(trimmed);
    if (!trimmed) throw new Error('Empty tag pattern');
    if (!literal) return new RegExp(trimmed, 'i');

    const source = literal[1] ?? '',
        flags = literal[2] ?? '';
    return new RegExp(source, flags);
}

export function compileExcludedTagPatterns(patterns = getExcludedTagPatterns()) {
    const regexes: RegExp[] = [];
    for (const pattern of patterns) {
        try {
            regexes.push(createExcludedTagRegExp(pattern));
        } catch (error) {
            addon.log('Ignoring invalid excluded tag pattern:', pattern, error);
        }
    }
    return regexes;
}

export function isTagExcluded(
    tagName: string,
    tagID?: number | false | null,
    excludedTagIDs = getExcludedTagIDs(),
    excludedTagRegexes = compileExcludedTagPatterns(),
) {
    if (tagID && excludedTagIDs.includes(tagID)) return true;
    for (const regex of excludedTagRegexes) {
        regex.lastIndex = 0;
        if (regex.test(tagName)) return true;
    }
    return false;
}
