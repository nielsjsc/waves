import { useState } from 'react'
import { useLiveQuery } from '@tanstack/react-db'
import { Head } from '@/components/Head'
import { EVENT_ID, changesTanCollection, participantsTanCollection, slotsTanCollection } from '@/database'
import type { ParticipantDocType, SlotDocType } from '@/Schema'
import { setAllChangesProcessed, setHasRentedCompass } from '@/actions/participantActions'
import { hydrateChange } from '@/utils/hydrateChange'
import type { PopulatedChange } from '@/utils/PopulatedChange'
import { clockHHMM, courseShortLabel, formatSlotTime } from '@/utils/slotLabels'
import {
    extractCourseCode,
    filterDownloadChanges,
    isDownloadChange,
    parseEpunchChangeValue,
} from '@/utils/downloadChanges'

export { isDownloadChange }

type ViewMode = 'pending' | 'all' | 'cleared'
type TypeFilter = 'all' | 'epunch' | 'course' | 'registration'
type DownloadChangeRow = PopulatedChange & { sourceChangeIds: string[] }

function matchesTypeFilter(changeType: string, filter: TypeFilter): boolean {
    if (filter === 'all') return true
    if (filter === 'epunch') return changeType === 'epunch'
    if (filter === 'course') {
        return (
            changeType === 'newCourse' ||
            changeType === 'competitiveStatus'
        )
    }
    if (filter === 'registration') return changeType === 'addedParticipant'
    return true
}

function formatCourseWithLabel(courseCode: string): string {
    if (!courseCode) return '—'
    const hint = courseShortLabel(courseCode)
    return hint !== '' ? `${courseCode.toUpperCase()} (${hint})` : courseCode.toUpperCase()
}

function formatClockHHMMSS(date: Date): string {
    const hh = String(date.getHours()).padStart(2, '0')
    const mm = String(date.getMinutes()).padStart(2, '0')
    const ss = String(date.getSeconds()).padStart(2, '0')
    return `${hh}:${mm}:${ss}`
}

function changeCategoryMeta(c: PopulatedChange): {
    code: string
    badgeClass: string
} {
    switch (c.changeType) {
        case 'epunch':
            return {
                code: 'E-PUNCH',
                badgeClass: 'border-sky-800 bg-sky-50 text-sky-950',
            }
        case 'newCourse':
            return {
                code: 'COURSE',
                badgeClass: 'border-amber-800 bg-amber-50 text-amber-950',
            }
        case 'addedParticipant':
            return {
                code: c.participant.isNonCompete ? '2ND COURSE' : 'REGISTRATION',
                badgeClass: 'border-emerald-800 bg-emerald-50 text-emerald-950',
            }
        case 'competitiveStatus':
            return {
                code: 'STATUS',
                badgeClass: 'border-purple-800 bg-purple-50 text-purple-950',
            }
        case 'groupSize':
            return {
                code: 'GROUP SIZE',
                badgeClass: 'border-teal-800 bg-teal-50 text-teal-950',
            }
        default:
            return {
                code: c.changeType.toUpperCase(),
                badgeClass: 'border-slate-500 bg-slate-100 text-slate-900',
            }
    }
}

function describeChangeForCsv(c: PopulatedChange): { oldText: string; newText: string } {
    if (c.changeType === 'epunch') {
        const oldVal = parseEpunchChangeValue(c.old)
        const newVal = parseEpunchChangeValue(c.new)
        return {
            oldText: `${oldVal.epunch} (${oldVal.isRental ? 'Rental' : 'Own'})`,
            newText: `${newVal.epunch} (${newVal.isRental ? 'Rental' : 'Own'})`,
        }
    }
    if (c.changeType === 'newCourse') {
        const oldCourse = extractCourseCode(c.old)
        const newCourse = extractCourseCode(c.new)
        return {
            oldText: formatCourseWithLabel(oldCourse),
            newText: formatCourseWithLabel(newCourse),
        }
    }
    if (c.changeType === 'addedParticipant') {
        const newCourse = extractCourseCode(c.new)
        return {
            oldText: '—',
            newText: `Registered on ${formatCourseWithLabel(newCourse)}`,
        }
    }
    if (c.changeType === 'groupSize') {
        return {
            oldText: c.old === '1' ? 'Individual (1)' : `Group (${c.old})`,
            newText: c.new === '1' ? 'Individual (1)' : `Group (${c.new})`,
        }
    }
    return {
        oldText: c.old || '—',
        newText: c.new || '—',
    }
}

function escapeCsvCell(value: string | number | boolean): string {
    const str = String(value ?? '')
    if (/[",\r\n]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`
    }
    return str
}

function downloadCsv(filename: string, headers: string[], rows: Array<Array<string | number | boolean>>) {
    const lines = [
        headers.map(escapeCsvCell).join(','),
        ...rows.map((r) => r.map(escapeCsvCell).join(',')),
    ]
    const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset-utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

export function Download() {
    const [viewMode, setViewMode] = useState<ViewMode>('pending')
    const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
    const [searchQuery, setSearchQuery] = useState('')
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc')
    const [confirmClearAll, setConfirmClearAll] = useState(false)
    const [copiedText, setCopiedText] = useState<string>('')
    const [lastClearedIds, setLastClearedIds] = useState<string[]>([])
    const [lastClearedName, setLastClearedName] = useState<string>('')
    const [lastClearedCompassParticipant, setLastClearedCompassParticipant] = useState<{
        id: string
        name: string
    } | null>(null)

    const { data: allParticipants } = useLiveQuery((q) =>
        q.from({ participant: participantsTanCollection })
    )
    const { data: allSlots } = useLiveQuery((q) =>
        q.from({ slot: slotsTanCollection })
    )
    const { data: allChanges } = useLiveQuery((q) =>
        q.from({ changes: changesTanCollection })
    )

    const DATA = {
        participants: allParticipants,
        slots: allSlots,
        changes: allChanges,
    }

    const slotsByParticipant = new Map<string, SlotDocType[]>()
    for (const slot of allSlots) {
        for (const pid of slot.participants) {
            const list = slotsByParticipant.get(pid)
            if (list === undefined) {
                slotsByParticipant.set(pid, [slot])
            } else {
                list.push(slot)
            }
        }
    }

    // All changes relevant to the finish/download station (epunch, course, new registration, competitive status)
    // collapsed to net changes per participant + category.
    const downloadChanges = filterDownloadChanges(allChanges)
        .map((c): DownloadChangeRow | undefined => {
            const hydrated = hydrateChange(c.id, DATA)
            if (hydrated === undefined) return undefined
            return {
                ...hydrated,
                old: c.old,
                new: c.new,
                changedAt: new Date(c.changedAt),
                sourceChangeIds: c.sourceChangeIds,
            }
        })
        .filter((c): c is DownloadChangeRow => c !== undefined)

    const pendingChanges = downloadChanges.filter((c) => !c.isProcessed)
    const clearedChanges = downloadChanges.filter((c) => c.isProcessed)

    const baseList =
        viewMode === 'pending'
            ? pendingChanges
            : viewMode === 'cleared'
              ? clearedChanges
              : downloadChanges

    const epunchCount = baseList.filter((c) => matchesTypeFilter(c.changeType, 'epunch')).length
    const courseCount = baseList.filter((c) => matchesTypeFilter(c.changeType, 'course')).length
    const registrationCount = baseList.filter((c) => matchesTypeFilter(c.changeType, 'registration')).length

    const q = searchQuery.trim().toLowerCase()
    const totalCompassRenters = allParticipants.filter((p) => Boolean(p.hasRentedCompass)).length
    const compassRenters = allParticipants
        .filter((p) => Boolean(p.hasRentedCompass))
        .filter((p) => {
            if (q === '') return true
            const slot = slotsByParticipant.get(p.id)?.[0]
            const haystack = [p.name, p.club ?? '', p.epunch ?? '', slot?.course ?? '']
                .join(' ')
                .toLowerCase()
            return haystack.includes(q)
        })
        .sort((a, b) => a.name.localeCompare(b.name))

    async function handleClearCompass(p: ParticipantDocType) {
        await setHasRentedCompass(p.id, false)
        setLastClearedCompassParticipant({ id: p.id, name: p.name })
    }

    const filteredChanges = baseList
        .filter((c) => {
            if (!matchesTypeFilter(c.changeType, typeFilter)) return false
            if (q !== '') {
                const slot = slotsByParticipant.get(c.participant.id)?.[0]
                const haystack = [
                    c.participant.name,
                    c.participant.club,
                    c.participant.epunch,
                    slot?.course ?? '',
                    c.old,
                    c.new,
                ]
                    .join(' ')
                    .toLowerCase()
                if (!haystack.includes(q)) return false
            }
            return true
        })
        .sort((a, b) => {
            const diff = a.changedAt.getTime() - b.changedAt.getTime()
            return sortOrder === 'asc' ? diff : -diff
        })

    async function handleClearSingle(c: DownloadChangeRow) {
        await setAllChangesProcessed(c.sourceChangeIds, true)
        setLastClearedIds(c.sourceChangeIds)
        setLastClearedName(c.participant.name)
    }

    async function handleRestoreSingle(c: DownloadChangeRow) {
        await setAllChangesProcessed(c.sourceChangeIds, false)
        if (lastClearedIds.some((id) => c.sourceChangeIds.includes(id))) {
            setLastClearedIds([])
            setLastClearedName('')
        }
    }

    async function handleClearAllPending() {
        const ids = pendingChanges.flatMap((c) => c.sourceChangeIds)
        setConfirmClearAll(false)
        await setAllChangesProcessed(ids, true)
    }

    function handleCopy(value: string, label: string) {
        if (!value || value === 'none') return
        if (navigator.clipboard) {
            void navigator.clipboard.writeText(value)
            setCopiedText(`${label}: ${value}`)
            setTimeout(() => {
                setCopiedText((prev) => (prev === `${label}: ${value}` ? '' : prev))
            }, 2000)
        }
    }

    function handleExportDownloadCsv() {
        const headers = [
            'Status',
            'Time',
            'Change Type',
            'Participant Name',
            'School / Club',
            'Current Course',
            'Current E-punch',
            'Rental',
            'Non-Competitive',
            'Group Size',
            'Previous Value',
            'New Value',
        ]
        const sortedForExport = [...downloadChanges].sort(
            (a, b) => a.changedAt.getTime() - b.changedAt.getTime()
        )
        const rows = sortedForExport.map((c) => {
            const slot = slotsByParticipant.get(c.participant.id)?.[0]
            const club =
                c.participant.club === 'unknown' || c.participant.club === 'None'
                    ? ''
                    : c.participant.club
            const meta = changeCategoryMeta(c)
            const diff = describeChangeForCsv(c)
            return [
                c.isProcessed ? 'CLEARED' : 'PENDING',
                clockHHMM(c.changedAt.getTime()),
                meta.code,
                c.participant.name,
                club,
                slot?.course?.toUpperCase() ?? '',
                c.participant.epunch || 'none',
                c.participant.isRental ? 'Yes' : 'No',
                c.participant.isNonCompete ? 'NC' : 'Competitive',
                c.participant.groupSize,
                diff.oldText,
                diff.newText,
            ]
        })
        downloadCsv(`waves-download-${EVENT_ID}.csv`, headers, rows)
    }

    function renderChangeDiff(c: PopulatedChange) {
        if (c.changeType === 'epunch') {
            const oldVal = parseEpunchChangeValue(c.old)
            const newVal = parseEpunchChangeValue(c.new)
            return (
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="font-mono tabular-nums text-slate-400 line-through">
                        {oldVal.epunch}{oldVal.isRental ? ' (R)' : ''}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="font-mono text-base font-bold tabular-nums text-slate-950">
                        {newVal.epunch}
                    </span>
                    {newVal.isRental && (
                        <span className="border border-orange-700 bg-orange-50 px-1.5 py-0.5 text-[11px] font-bold uppercase text-orange-900">
                            Rental
                        </span>
                    )}
                </div>
            )
        }

        if (c.changeType === 'newCourse') {
            const oldCourse = extractCourseCode(c.old)
            const newCourse = extractCourseCode(c.new)
            return (
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="text-slate-400 line-through">
                        {formatCourseWithLabel(oldCourse)}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="text-base font-bold text-slate-950">
                        {formatCourseWithLabel(newCourse)}
                    </span>
                </div>
            )
        }

        if (c.changeType === 'addedParticipant') {
            const addedCourse = extractCourseCode(c.new)
            return (
                <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-base font-bold text-slate-950">
                        {formatCourseWithLabel(addedCourse)}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="font-mono font-bold tabular-nums text-slate-950">
                        {c.participant.epunch || 'No e-punch'}
                    </span>
                    {c.participant.isRental && (
                        <span className="border border-orange-700 bg-orange-50 px-1.5 py-0.5 text-[11px] font-bold uppercase text-orange-900">
                            Rental
                        </span>
                    )}
                </div>
            )
        }

        if (c.changeType === 'groupSize') {
            return (
                <div className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="text-slate-400 line-through">
                        {c.old === '1' ? '1 person' : `Group of ${c.old}`}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="text-base font-bold text-slate-950">
                        {c.new === '1' ? '1 person' : `Group of ${c.new}`}
                    </span>
                </div>
            )
        }

        return (
            <div className="flex flex-wrap items-center gap-1.5 text-sm">
                <span className="text-slate-400 line-through">{c.old}</span>
                <span className="text-slate-400">→</span>
                <span className="font-bold text-slate-950">{c.new}</span>
            </div>
        )
    }

    const filterTabs: Array<{ id: TypeFilter; label: string; count: number }> = [
        { id: 'all', label: 'All', count: baseList.length },
        { id: 'epunch', label: 'E-punch', count: epunchCount },
        { id: 'course', label: 'Course & Status', count: courseCount },
        { id: 'registration', label: 'Registrations', count: registrationCount },
    ]

    return (
        <>
            <Head title="Download Station" />
            <div className="mx-auto flex max-w-7xl flex-col gap-3 pb-10 text-slate-900">
                {/* 1. Compact Station Header with Key Counts */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border border-slate-400 bg-white px-4 py-2.5">
                    <h1 className="text-xl font-bold tracking-tight text-slate-950">
                        Download Station
                    </h1>

                    <div className="flex flex-wrap items-center gap-2">
                        <div
                            className={`flex items-center gap-2 border px-3 py-1 ${
                                pendingChanges.length > 0
                                    ? 'border-amber-700 bg-amber-50 text-amber-950'
                                    : 'border-emerald-700 bg-emerald-50 text-emerald-950'
                            }`}>
                            <span className="text-xs font-bold uppercase tracking-wider">Pending</span>
                            <span className="font-mono text-lg font-bold tabular-nums leading-none">
                                {pendingChanges.length}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 border border-slate-300 bg-slate-50 px-3 py-1 text-slate-800">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Cleared</span>
                            <span className="font-mono text-lg font-bold tabular-nums leading-none text-slate-900">
                                {clearedChanges.length}
                            </span>
                        </div>

                        <div className="flex items-center gap-2 border border-slate-300 bg-slate-50 px-3 py-1 text-slate-800">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Total</span>
                            <span className="font-mono text-lg font-bold tabular-nums leading-none text-slate-900">
                                {downloadChanges.length}
                            </span>
                        </div>

                        <div
                            className={`flex items-center gap-2 border px-3 py-1 ${
                                totalCompassRenters > 0
                                    ? 'border-amber-700 bg-amber-50 text-amber-950'
                                    : 'border-slate-300 bg-slate-50 text-slate-800'
                            }`}>
                            <span className="text-xs font-bold uppercase tracking-wider">Compass Needs Return</span>
                            <span className="font-mono text-lg font-bold tabular-nums leading-none">
                                {totalCompassRenters}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Compass Needs Return List */}
                <section className="border border-slate-400 bg-white">
                    <div className="flex items-center justify-between border-b border-slate-300 bg-amber-50 px-4 py-2">
                        <h2 className="text-sm font-bold uppercase tracking-wider text-amber-950">
                            Compass Needs Return ({totalCompassRenters})
                        </h2>
                    </div>

                    {lastClearedCompassParticipant !== null && (
                        <div
                            role="status"
                            className="flex items-center justify-between gap-3 border-b border-slate-300 bg-slate-100 px-3 py-1.5 text-xs text-slate-900">
                            <span>
                                Cleared compass for <strong>{lastClearedCompassParticipant.name}</strong>.
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={async () => {
                                        const target = lastClearedCompassParticipant
                                        setLastClearedCompassParticipant(null)
                                        if (target) {
                                            await setHasRentedCompass(target.id, true)
                                        }
                                    }}
                                    className="min-h-8 border border-slate-800 bg-white px-2.5 py-0.5 text-xs font-bold text-slate-900 hover:bg-slate-200">
                                    Undo
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setLastClearedCompassParticipant(null)}
                                    className="min-h-8 px-1.5 py-0.5 text-xs text-slate-500 hover:text-slate-800">
                                    Dismiss
                                </button>
                            </div>
                        </div>
                    )}

                    {compassRenters.length === 0 ? (
                        <div className="px-4 py-3 text-xs text-slate-500">
                            {totalCompassRenters === 0
                                ? 'No rented compasses waiting to be returned.'
                                : 'No rented compasses match the current search filter.'}
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-200">
                            {compassRenters.map((p) => {
                                const slot = slotsByParticipant.get(p.id)?.[0]
                                const club =
                                    !p.club || p.club === 'unknown' || p.club === 'None'
                                        ? 'Independent'
                                        : p.club
                                return (
                                    <div
                                        key={p.id}
                                        data-compass-participant-id={p.id}
                                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                                        <div className="min-w-0 flex-1">
                                            <div className="flex flex-wrap items-center gap-2">
                                                <span className="text-base font-bold text-slate-950">
                                                    {p.name}
                                                </span>
                                                <span className="border border-amber-700 bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold uppercase text-amber-950">
                                                    Compass Needs Return
                                                </span>
                                            </div>
                                            <div className="mt-0.5 text-xs text-slate-600">
                                                {club}
                                                {slot ? ` · ${formatCourseWithLabel(slot.course)} (${formatSlotTime(slot.time)})` : ''}
                                                {p.epunch ? ` · E-punch ${p.epunch}` : ''}
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => void handleClearCompass(p)}
                                            className="min-h-9 border border-slate-900 bg-slate-900 px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-white transition hover:border-emerald-800 hover:bg-emerald-700">
                                            Clear
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                </section>

                {/* 2. View Mode Tabs, Category Filters, Search & Actions */}
                <div className="flex flex-col gap-2.5 border border-slate-300 bg-slate-50 p-3">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        {/* Primary View Switcher */}
                        <div className="flex items-center overflow-x-auto border border-slate-400 bg-white">
                            <button
                                type="button"
                                onClick={() => {
                                    setViewMode('pending')
                                    setSortOrder('asc')
                                }}
                                className={`min-h-10 shrink-0 px-3.5 py-1.5 text-xs sm:text-sm font-bold transition ${
                                    viewMode === 'pending'
                                        ? 'bg-slate-900 text-white'
                                        : 'text-slate-700 hover:bg-slate-100'
                                }`}>
                                Pending Queue ({pendingChanges.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setViewMode('all')
                                    setSortOrder('desc')
                                }}
                                className={`min-h-10 shrink-0 border-l border-slate-300 px-3.5 py-1.5 text-xs sm:text-sm font-bold transition ${
                                    viewMode === 'all'
                                        ? 'bg-slate-900 text-white'
                                        : 'text-slate-700 hover:bg-slate-100'
                                }`}>
                                Full Download Log ({downloadChanges.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setViewMode('cleared')
                                    setSortOrder('desc')
                                }}
                                className={`min-h-10 shrink-0 border-l border-slate-300 px-3.5 py-1.5 text-xs sm:text-sm font-bold transition ${
                                    viewMode === 'cleared'
                                        ? 'bg-slate-900 text-white'
                                        : 'text-slate-700 hover:bg-slate-100'
                                }`}>
                                Cleared ({clearedChanges.length})
                            </button>
                        </div>

                        {/* Right Controls: Sort, Clear All, Export */}
                        <div className="flex flex-wrap items-center gap-2">
                            {copiedText !== '' && (
                                <span
                                    role="status"
                                    className="border border-emerald-700 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-950">
                                    Copied {copiedText}
                                </span>
                            )}

                            <button
                                type="button"
                                onClick={() => setSortOrder((s) => (s === 'asc' ? 'desc' : 'asc'))}
                                className="min-h-9 border border-slate-300 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100">
                                {sortOrder === 'asc' ? 'Oldest first' : 'Newest first'}
                            </button>

                            {pendingChanges.length > 0 && !confirmClearAll && (
                                <button
                                    type="button"
                                    onClick={() => setConfirmClearAll(true)}
                                    className="min-h-9 border border-slate-400 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100">
                                    Clear all ({pendingChanges.length})
                                </button>
                            )}

                            {confirmClearAll && (
                                <div className="flex items-center gap-1.5 border border-amber-700 bg-amber-50 px-2 py-1">
                                    <span className="text-xs font-semibold text-amber-950">
                                        Clear all {pendingChanges.length}?
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => void handleClearAllPending()}
                                        className="min-h-8 border border-amber-800 bg-amber-700 px-2 py-0.5 text-xs font-bold text-white hover:bg-amber-800">
                                        Confirm
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setConfirmClearAll(false)}
                                        className="min-h-8 border border-slate-300 bg-white px-2 py-0.5 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                                        Cancel
                                    </button>
                                </div>
                            )}

                            <button
                                type="button"
                                onClick={handleExportDownloadCsv}
                                className="min-h-9 border border-slate-900 bg-white px-2.5 py-1 text-xs font-bold text-slate-900 hover:bg-slate-900 hover:text-white">
                                Export CSV
                            </button>
                        </div>
                    </div>

                    {/* Secondary Row: Category Filter & Search */}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 border-t border-slate-200 pt-2">
                        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
                            {filterTabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    type="button"
                                    onClick={() => setTypeFilter(tab.id)}
                                    className={`min-h-8 shrink-0 border px-2.5 py-1 text-xs font-semibold transition ${
                                        typeFilter === tab.id
                                            ? 'border-slate-800 bg-slate-800 text-white'
                                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                                    }`}>
                                    {tab.label} ({tab.count})
                                </button>
                            ))}
                        </div>

                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter runner, school, e-punch…"
                            aria-label="Filter download changes"
                            className="w-full sm:w-64 rounded-none border border-slate-400 bg-white px-2.5 py-1.5 text-sm sm:text-xs text-slate-900 placeholder-slate-400 focus:border-slate-950 focus:outline-none"
                        />
                    </div>
                </div>

                {/* Quick Undo Banner after clearing an item */}
                {lastClearedIds.length > 0 && (
                    <div
                        role="status"
                        className="flex items-center justify-between gap-3 border border-slate-400 bg-slate-100 px-3 py-1.5 text-xs text-slate-900">
                        <span>
                            Cleared <strong>{lastClearedName}</strong>.
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={async () => {
                                    const ids = lastClearedIds
                                    setLastClearedIds([])
                                    setLastClearedName('')
                                    await setAllChangesProcessed(ids, false)
                                }}
                                className="min-h-8 border border-slate-800 bg-white px-2.5 py-0.5 text-xs font-bold text-slate-900 hover:bg-slate-200">
                                Undo
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setLastClearedIds([])
                                    setLastClearedName('')
                                }}
                                className="min-h-8 px-1.5 py-0.5 text-xs text-slate-500 hover:text-slate-800">
                                Dismiss
                            </button>
                        </div>
                    </div>
                )}

                {/* 3. Responsive Data Table (Card layout on mobile, full table on desktop) */}
                {filteredChanges.length === 0 ? (
                    <div className="border border-slate-300 bg-white px-6 py-10 text-center">
                        <div className="text-base font-bold text-slate-700">
                            {viewMode === 'pending'
                                ? 'No pending changes.'
                                : viewMode === 'cleared'
                                  ? 'No cleared changes.'
                                  : 'No changes recorded.'}
                        </div>
                    </div>
                ) : (
                    <div className="overflow-x-auto border-0 md:border md:border-slate-400 bg-transparent md:bg-white">
                        <table className="block md:table w-full border-collapse text-left">
                            <thead className="hidden md:table-header-group">
                                <tr className="border-b-2 border-slate-400 bg-slate-100 text-[11px] font-bold uppercase tracking-wider text-slate-700">
                                    <th className="w-24 border-r border-slate-300 px-3 py-2">Time</th>
                                    <th className="w-36 border-r border-slate-300 px-3 py-2">Type</th>
                                    <th className="min-w-[13rem] border-r border-slate-300 px-3 py-2">
                                        Participant
                                    </th>
                                    <th className="min-w-[15rem] border-r border-slate-300 px-3 py-2">
                                        Change
                                    </th>
                                    <th className="w-48 border-r border-slate-300 px-3 py-2">
                                        Current Record
                                    </th>
                                    <th className="w-24 px-3 py-2 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="block md:table-row-group space-y-3 md:space-y-0 md:divide-y md:divide-slate-300">
                                {filteredChanges.map((c) => {
                                    const slot = slotsByParticipant.get(c.participant.id)?.[0]
                                    const currentCourse = slot?.course ?? ''
                                    const club =
                                        c.participant.club === 'unknown' || c.participant.club === 'None'
                                            ? 'Independent'
                                            : c.participant.club
                                    const meta = changeCategoryMeta(c)

                                    return (
                                        <tr
                                            key={c.id}
                                            data-change-id={c.id}
                                            className={`block md:table-row border border-slate-300 md:border-0 p-3.5 sm:p-4 md:p-0 transition-colors shadow-sm md:shadow-none ${
                                                c.isProcessed
                                                    ? 'bg-slate-50/70 text-slate-600'
                                                    : 'bg-white hover:bg-slate-50'
                                            }`}>
                                            {/* Column 1: Time */}
                                            <td className="inline-block md:table-cell md:border-r border-slate-200 px-0 py-0 pb-1.5 md:px-3 md:py-2.5 align-middle">
                                                <div className="flex items-center gap-2 md:block">
                                                    <div className="font-mono text-sm font-bold tabular-nums text-slate-900">
                                                        {formatClockHHMMSS(c.changedAt)}
                                                    </div>
                                                    <div className="mt-0 md:mt-0.5">
                                                        {c.isProcessed ? (
                                                            <span className="inline-block border border-slate-400 bg-slate-200 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-700">
                                                                CLEARED
                                                            </span>
                                                        ) : (
                                                            <span className="inline-block border border-amber-700 bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-950">
                                                                PENDING
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Column 2: Type */}
                                            <td className="inline-block md:table-cell md:border-r border-slate-200 px-0 py-0 pb-1.5 md:px-3 md:py-2.5 align-middle ml-2 md:ml-0">
                                                <span
                                                    className={`inline-block border px-2 py-0.5 text-xs font-bold tracking-wide ${meta.badgeClass}`}>
                                                    {meta.code}
                                                </span>
                                            </td>

                                            {/* Column 3: Participant */}
                                            <td className="block md:table-cell md:border-r border-slate-200 px-0 py-0 pt-1 pb-1.5 md:px-3 md:py-2.5 align-middle">
                                                <div className="flex flex-wrap items-center gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleCopy(c.participant.name, 'Name')}
                                                        title="Click to copy name"
                                                        className="text-left text-base font-bold text-slate-950 hover:underline">
                                                        {c.participant.name}
                                                    </button>
                                                    {c.participant.groupSize > 1 && (
                                                        <span className="border border-emerald-700 bg-emerald-50 px-1.5 py-0.5 text-[11px] font-bold text-emerald-900">
                                                            Group {c.participant.groupSize}
                                                        </span>
                                                    )}
                                                    {c.participant.isNonCompete && (
                                                        <span className="border border-indigo-700 bg-indigo-50 px-1.5 py-0.5 text-[11px] font-bold text-indigo-900">
                                                            NC
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-0.5 text-xs text-slate-600">
                                                    {club}
                                                </div>
                                            </td>

                                            {/* Column 4: Change */}
                                            <td className="block md:table-cell md:border-r border-slate-200 px-0 py-0 py-1.5 md:px-3 md:py-2.5 align-middle border-t md:border-t-0 border-slate-100">
                                                <div className="md:hidden text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-0.5">
                                                    Change
                                                </div>
                                                {renderChangeDiff(c)}
                                            </td>

                                            {/* Column 5: Current Record */}
                                            <td className="block md:table-cell md:border-r border-slate-200 px-0 py-0 py-1.5 md:px-3 md:py-2.5 align-middle border-t md:border-t-0 border-slate-100">
                                                <div className="flex items-center justify-between md:block gap-2">
                                                    <div className="text-xs font-bold text-slate-900">
                                                        {formatCourseWithLabel(currentCourse)}
                                                    </div>
                                                    <div className="mt-0 md:mt-1">
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                handleCopy(
                                                                    c.participant.epunch || '',
                                                                    'E-punch'
                                                                )
                                                            }
                                                            title="Click to copy"
                                                            className="border border-slate-400 bg-slate-100 px-2 py-0.5 font-mono text-xs font-bold tabular-nums text-slate-950 hover:bg-slate-200">
                                                            {c.participant.epunch || 'none'}
                                                            {c.participant.isRental ? ' (R)' : ''}
                                                        </button>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Column 6: Action */}
                                            <td className="block md:table-cell px-0 py-0 pt-2 md:pt-0 md:px-3 md:py-2.5 md:text-right align-middle border-t md:border-t-0 border-slate-200">
                                                {!c.isProcessed ? (
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleClearSingle(c)}
                                                        className="w-full md:w-auto min-h-10 md:min-h-0 border border-slate-900 bg-slate-900 px-3.5 py-2 md:py-1.5 text-xs font-bold uppercase tracking-wider text-white transition hover:border-emerald-800 hover:bg-emerald-700 active:bg-emerald-800">
                                                        Clear
                                                    </button>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        onClick={() => void handleRestoreSingle(c)}
                                                        className="w-full md:w-auto min-h-10 md:min-h-0 border border-slate-300 bg-white px-3 py-2 md:py-1 text-xs font-semibold text-slate-700 hover:border-slate-600 hover:bg-slate-100">
                                                        Restore
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </>
    )
}
