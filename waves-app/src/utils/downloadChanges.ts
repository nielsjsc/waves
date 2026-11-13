import type { ChangesDocType } from '@/Schema'

export type EpunchChangeValue = {
    epunch: string
    isRental: boolean
}

export type CollapsedDownloadChange = ChangesDocType & {
    sourceChangeIds: string[]
}

const COLLAPSIBLE_CHANGE_TYPES = new Set(['newCourse', 'epunch', 'competitiveStatus'])

/**
 * Returns true if the given change type requires action or visibility at the Download station.
 */
export function isDownloadChange(changeType: string): boolean {
    return (
        changeType === 'epunch' ||
        changeType === 'newCourse' ||
        changeType === 'addedParticipant' ||
        changeType === 'competitiveStatus'
    )
}

/**
 * Parses a logged e-punch value string (`"<epunch>, Rental:<true|false>"`) into normalized fields.
 */
export function parseEpunchChangeValue(raw: string): EpunchChangeValue {
    const match = /^(.*),\s*Rental:(true|false)$/.exec(raw)
    if (match !== null) {
        return {
            epunch: match[1]!.trim() || 'none',
            isRental: match[2] === 'true',
        }
    }
    return { epunch: raw.trim() || 'none', isRental: false }
}

/**
 * Extracts the leading course code token from a course/time change value.
 */
export function extractCourseCode(raw: string): string {
    const trimmed = raw.trim()
    if (trimmed === '') return ''
    return trimmed.split(/\s+/)[0] ?? ''
}

function normalizeChangeValue(changeType: string, raw: string): string {
    if (changeType === 'newCourse') {
        return extractCourseCode(raw).toLowerCase()
    }
    if (changeType === 'epunch') {
        const parsed = parseEpunchChangeValue(raw)
        return `${parsed.epunch.trim()}|${parsed.isRental}`
    }
    return raw.trim().toLowerCase()
}

type IndexedChange = {
    change: ChangesDocType
    index: number
}

/**
 * Collapses contiguous runs of matching `isProcessed` status within one participant+category
 * series into at most one net change from the first `old` to the last `new`, dropping runs
 * whose endpoints match (no net change).
 */
function collapseRunsForSeries(sorted: IndexedChange[]): CollapsedDownloadChange[] {
    const result: CollapsedDownloadChange[] = []
    let runStart = 0

    while (runStart < sorted.length) {
        const processedState = sorted[runStart]!.change.isProcessed
        let runEnd = runStart + 1
        while (runEnd < sorted.length && sorted[runEnd]!.change.isProcessed === processedState) {
            runEnd++
        }

        const first = sorted[runStart]!.change
        const last = sorted[runEnd - 1]!.change
        const netOld = normalizeChangeValue(first.changeType, first.old)
        const netNew = normalizeChangeValue(last.changeType, last.new)

        if (netOld !== netNew) {
            const sourceChangeIds: string[] = []
            for (let i = runStart; i < runEnd; i++) {
                sourceChangeIds.push(sorted[i]!.change.id)
            }
            result.push({
                ...last,
                old: first.old,
                new: last.new,
                sourceChangeIds,
            })
        }

        runStart = runEnd
    }

    return result
}

/**
 * Returns Download-relevant changes collapsed to net changes per participant for `newCourse`,
 * `epunch`, and `competitiveStatus`. Intermediate hops are folded into a single net row, and
 * round-trips back to the starting value are omitted.
 */
export function filterDownloadChanges(changes: readonly ChangesDocType[]): CollapsedDownloadChange[] {
    const out: CollapsedDownloadChange[] = []
    const groups = new Map<string, IndexedChange[]>()

    for (let index = 0; index < changes.length; index++) {
        const c = changes[index]!
        if (!isDownloadChange(c.changeType)) continue

        if (!COLLAPSIBLE_CHANGE_TYPES.has(c.changeType)) {
            out.push({ ...c, sourceChangeIds: [c.id] })
            continue
        }

        const key = `${c.participantId}\0${c.changeType}`
        const list = groups.get(key)
        if (list === undefined) {
            groups.set(key, [{ change: c, index }])
        } else {
            list.push({ change: c, index })
        }
    }

    for (const group of groups.values()) {
        const sorted = [...group].sort(
            (a, b) => a.change.changedAt - b.change.changedAt || a.index - b.index
        )
        out.push(...collapseRunsForSeries(sorted))
    }

    return out
}
