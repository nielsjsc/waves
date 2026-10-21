import { useState } from 'react'
import { useLiveQuery } from '@tanstack/react-db'
import { Head } from '@/components/Head'
import { SvgIcon } from '@/components/SvgIcon'
import { EVENT_ID, changesTanCollection, participantsTanCollection, slotsTanCollection } from '@/database'
import type { SlotDocType } from '@/Schema'
import { hydrateChange } from '@/utils/hydrateChange'
import { changeTypeLabel, clockHHMM, formatSlotTime, timeAgo } from '@/utils/slotLabels'
import { ParticipantStateStyles } from '@/utils/styleHelpers'

type FilterMode = 'pendingTiming' | 'allTiming' | 'allChanges'

function formatChangeValue(changeType: string, value: string): string {
    if (changeType === 'epunch') {
        const match = /^(.*),\s*Rental:(true|false)$/.exec(value)
        if (match !== null) {
            const ep = match[1]!.trim() || 'none'
            const isRental = match[2] === 'true'
            return isRental ? `${ep} (rental)` : ep
        }
    }
    if (value === '') return 'none'
    return formatSlotTime(value)
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
    const blob = new Blob([lines.join('\r\n') + '\r\n'], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

export function Changes() {
    const [filterMode, setFilterMode] = useState<FilterMode>('pendingTiming')
    const [searchQuery, setSearchQuery] = useState('')

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

    // Newest first so the timing desk sees the most recent changes at the top.
    const hydratedChanges = allChanges
        .map((x) => hydrateChange(x.id, DATA))
        .filter((x) => x !== undefined)
        .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime())

    const pendingTimingCount = hydratedChanges.filter((c) => c.needsProcessing && !c.isProcessed).length
    const allTimingCount = hydratedChanges.filter((c) => c.needsProcessing).length

    const q = searchQuery.trim().toLowerCase()
    const visibleChanges = hydratedChanges.filter((c) => {
        if (filterMode === 'pendingTiming' && (!c.needsProcessing || c.isProcessed)) return false
        if (filterMode === 'allTiming' && !c.needsProcessing) return false
        if (q !== '') {
            const slot = slotsByParticipant.get(c.participant.id)?.[0]
            const haystack = `${c.participant.name} ${c.participant.club} ${c.participant.epunch} ${slot?.course ?? ''} ${changeTypeLabel(c.changeType)} ${c.old} ${c.new}`.toLowerCase()
            if (!haystack.includes(q)) return false
        }
        return true
    })

    async function toggleProcessed(changeId: string, currentValue: boolean) {
        const tx = changesTanCollection.update(changeId, (draft) => {
            draft.isProcessed = !currentValue
        })
        await tx.isPersisted.promise
    }

    function handleExportChangesCsv() {
        const headers = [
            'Changed At',
            'Name',
            'School / Club',
            'Course',
            'Current Start',
            'Current E-punch',
            'Rental',
            'Non-Competitive',
            'Change Type',
            'Old Value',
            'New Value',
            'Needs Timing Entry',
            'Entered in Timing',
        ]
        const rows = hydratedChanges.map((c) => {
            const slot = slotsByParticipant.get(c.participant.id)?.[0]
            const club = c.participant.club === 'unknown' || c.participant.club === 'None' ? '' : c.participant.club
            return [
                clockHHMM(c.changedAt.getTime()),
                c.participant.name,
                club,
                slot?.course ?? '',
                slot ? formatSlotTime(slot.time) : '',
                c.participant.epunch,
                c.participant.isRental,
                c.participant.isNonCompete,
                changeTypeLabel(c.changeType),
                formatChangeValue(c.changeType, c.old),
                formatChangeValue(c.changeType, c.new),
                c.needsProcessing,
                c.isProcessed,
            ]
        })
        downloadCsv(`waves-changes-${EVENT_ID}.csv`, headers, rows)
    }

    function handleExportRosterCsv() {
        const headers = [
            'Course',
            'Current Start',
            'Original Start',
            'Name',
            'School / Club',
            'State',
            'E-punch',
            'Rental',
            'Non-Competitive',
            'Group Size',
        ]
        const sortedParticipants = [...allParticipants].sort((a, b) => {
            const sa = slotsByParticipant.get(a.id)?.[0]
            const sb = slotsByParticipant.get(b.id)?.[0]
            return (
                (sa?.course ?? '').localeCompare(sb?.course ?? '') ||
                (sa?.time ?? '').localeCompare(sb?.time ?? '') ||
                a.name.localeCompare(b.name)
            )
        })
        const rows = sortedParticipants.map((p) => {
            const slot = slotsByParticipant.get(p.id)?.[0]
            const club = p.club === undefined || p.club === 'unknown' || p.club === 'None' ? '' : p.club
            const stateLabel = ParticipantStateStyles.get(p.state)?.friendlyName ?? p.state
            return [
                slot?.course ?? '',
                slot ? formatSlotTime(slot.time) : '',
                p.originalStartTime ?? (slot ? formatSlotTime(slot.time) : ''),
                p.name,
                club,
                stateLabel,
                p.epunch ?? '',
                p.isRental,
                p.isNonCompete,
                p.groupSize,
            ]
        })
        downloadCsv(`waves-roster-${EVENT_ID}.csv`, headers, rows)
    }

    return (
        <>
            <Head title="Change Log & Timing Desk" />
            <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-8">
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-800 bg-gray-900 p-4">
                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setFilterMode('pendingTiming')}
                            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                                filterMode === 'pendingTiming'
                                    ? 'bg-pink-700 text-white'
                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}>
                            <span>Needs timing entry</span>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                                pendingTimingCount > 0 ? 'bg-amber-500 text-gray-950' : 'bg-gray-700 text-gray-300'
                            }`}>
                                {pendingTimingCount}
                            </span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterMode('allTiming')}
                            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                                filterMode === 'allTiming'
                                    ? 'bg-pink-700 text-white'
                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}>
                            All timing changes ({allTimingCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setFilterMode('allChanges')}
                            className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${
                                filterMode === 'allChanges'
                                    ? 'bg-pink-700 text-white'
                                    : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}>
                            All meet changes ({hydratedChanges.length})
                        </button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter by name, school, or e-punch…"
                            aria-label="Filter changes"
                            className="w-64 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-400 focus:border-pink-500 focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={handleExportChangesCsv}
                            className="rounded-md border border-sky-600 bg-sky-950/60 px-3 py-1.5 text-sm font-semibold text-sky-200 hover:bg-sky-800 hover:text-white">
                            Export Changes CSV
                        </button>
                        <button
                            type="button"
                            onClick={handleExportRosterCsv}
                            className="rounded-md border border-emerald-600 bg-emerald-950/60 px-3 py-1.5 text-sm font-semibold text-emerald-200 hover:bg-emerald-800 hover:text-white">
                            Export Full Roster CSV
                        </button>
                    </div>
                </div>

                {visibleChanges.length === 0 ? (
                    <div className="rounded-lg border border-gray-800 bg-gray-900 p-8 text-center text-gray-400">
                        {filterMode === 'pendingTiming'
                            ? 'All timing changes have been entered! Switch to "All timing changes" or "All meet changes" to review history.'
                            : 'No matching changes recorded yet.'}
                    </div>
                ) : (
                    <div className="flex flex-col gap-2">
                        {visibleChanges.map((c) => {
                            const slot = slotsByParticipant.get(c.participant.id)?.[0]
                            const club =
                                c.participant.club === 'unknown' || c.participant.club === 'None'
                                    ? ''
                                    : c.participant.club
                            const where = slot
                                ? `${slot.course} · ${formatSlotTime(slot.time)}`
                                : 'No slot'
                            const oldFormatted = formatChangeValue(c.changeType, c.old)
                            const newFormatted = formatChangeValue(c.changeType, c.new)

                            return (
                                <div
                                    key={c.id}
                                    className={`flex flex-col justify-between gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center ${
                                        c.isProcessed
                                            ? 'border-gray-800 bg-gray-900/60 opacity-75'
                                            : c.needsProcessing
                                              ? 'border-amber-700/60 bg-gray-800'
                                              : 'border-gray-800 bg-gray-800/80'
                                    }`}>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-lg font-bold text-white">
                                                {c.participant.name}
                                            </span>
                                            <span className="rounded bg-gray-700 px-2 py-0.5 text-xs font-semibold text-gray-200">
                                                {changeTypeLabel(c.changeType)}
                                            </span>
                                            {c.participant.isNonCompete && (
                                                <span className="rounded bg-indigo-800 px-2 py-0.5 text-xs font-medium text-indigo-100">
                                                    NC
                                                </span>
                                            )}
                                            {c.participant.isRental && (
                                                <span className="rounded bg-orange-800 px-2 py-0.5 text-xs font-medium text-orange-100">
                                                    Rental
                                                </span>
                                            )}
                                            <span className="text-xs text-gray-400">
                                                {clockHHMM(c.changedAt.getTime())} ({timeAgo(c.changedAt.getTime())})
                                            </span>
                                        </div>

                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-300">
                                            <span>{where}</span>
                                            {club !== '' && <span>· {club}</span>}
                                            <span>
                                                · Current e-punch:{' '}
                                                <strong className="font-semibold text-white">
                                                    {c.participant.epunch || 'none'}
                                                </strong>
                                            </span>
                                        </div>

                                        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                                            {c.old !== '' && (
                                                <>
                                                    <span className="text-gray-400 line-through">
                                                        {oldFormatted}
                                                    </span>
                                                    <SvgIcon icon="right" />
                                                </>
                                            )}
                                            <span className="font-semibold text-amber-300">
                                                {newFormatted}
                                            </span>
                                        </div>
                                    </div>

                                    {c.needsProcessing && (
                                        <div className="shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => void toggleProcessed(c.id, c.isProcessed)}
                                                className={`rounded-md px-3 py-2 text-sm font-semibold transition ${
                                                    c.isProcessed
                                                        ? 'border border-emerald-700 bg-emerald-950 text-emerald-300 hover:bg-emerald-900'
                                                        : 'bg-amber-600 text-white hover:bg-amber-500'
                                                }`}>
                                                {c.isProcessed ? 'Entered ✓' : 'Mark entered'}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </>
    )
}
