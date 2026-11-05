import { useState } from 'react'
import { useLiveQuery } from '@tanstack/react-db'
import { Head } from '@/components/Head'
import { SvgIcon } from '@/components/SvgIcon'
import { EVENT_ID, changesTanCollection, participantsTanCollection, slotsTanCollection } from '@/database'
import type { SlotDocType } from '@/Schema'
import { hydrateChange } from '@/utils/hydrateChange'
import { changeTypeLabel, clockHHMM, formatSlotTime, timeAgo } from '@/utils/slotLabels'
import { ParticipantStateStyles } from '@/utils/styleHelpers'

type CategoryFilter = 'all' | 'epunch' | 'timeCourse' | 'attendance'

function categoryOf(changeType: string): CategoryFilter {
    switch (changeType) {
        case 'epunch':
        case 'wrongEpunch':
            return 'epunch'
        case 'newTime':
        case 'newCourse':
        case 'needsAssignment':
        case 'addedParticipant':
            return 'timeCourse'
        default:
            return 'attendance'
    }
}

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
    const [category, setCategory] = useState<CategoryFilter>('all')
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

    const hydratedChanges = allChanges
        .map((x) => hydrateChange(x.id, DATA))
        .filter((x) => x !== undefined)
        .filter((c) => {
            if (c.changeType === 'noShow' && c.participant.state !== 'noShow') return false
            if (c.changeType === 'wrongEpunch' && c.participant.state !== 'wrongEpunch') return false
            return true
        })
        .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime())

    const epunchCount = hydratedChanges.filter((c) => categoryOf(c.changeType) === 'epunch').length
    const timeCourseCount = hydratedChanges.filter((c) => categoryOf(c.changeType) === 'timeCourse').length
    const attendanceCount = hydratedChanges.filter((c) => categoryOf(c.changeType) === 'attendance').length

    const q = searchQuery.trim().toLowerCase()
    const visibleChanges = hydratedChanges.filter((c) => {
        if (category !== 'all' && categoryOf(c.changeType) !== category) return false
        if (q !== '') {
            const slot = slotsByParticipant.get(c.participant.id)?.[0]
            const haystack = `${c.participant.name} ${c.participant.club} ${c.participant.epunch} ${slot?.course ?? ''} ${changeTypeLabel(c.changeType)} ${c.old} ${c.new}`.toLowerCase()
            if (!haystack.includes(q)) return false
        }
        return true
    })

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

    const filterTabs: Array<{ id: CategoryFilter; label: string; count: number }> = [
        { id: 'all', label: 'All changes', count: hydratedChanges.length },
        { id: 'epunch', label: 'E-punch', count: epunchCount },
        { id: 'timeCourse', label: 'Time & Course', count: timeCourseCount },
        { id: 'attendance', label: 'Attendance & Status', count: attendanceCount },
    ]

    return (
        <>
            <Head title="Change Log" />
            <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-8 text-slate-900">
                <div className="flex flex-wrap items-center justify-between gap-3 border border-slate-300 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center gap-1.5">
                        {filterTabs.map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setCategory(tab.id)}
                                className={`border px-3 py-1.5 text-sm font-semibold transition ${
                                    category === tab.id
                                        ? 'border-slate-900 bg-slate-900 text-white'
                                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                                }`}>
                                {tab.label} ({tab.count})
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Filter by name, school, or e-punch…"
                            aria-label="Filter changes"
                            className="w-64 rounded-none border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={handleExportChangesCsv}
                            className="border border-sky-700 bg-white px-3 py-1.5 text-sm font-semibold text-sky-800 hover:bg-sky-700 hover:text-white">
                            Export Changes CSV
                        </button>
                        <button
                            type="button"
                            onClick={handleExportRosterCsv}
                            className="border border-emerald-700 bg-white px-3 py-1.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-700 hover:text-white">
                            Export Full Roster CSV
                        </button>
                    </div>
                </div>

                {visibleChanges.length === 0 ? (
                    <div className="border border-slate-300 bg-white p-8 text-center text-slate-500">
                        No changes recorded in this view yet.
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
                                    className="flex flex-col justify-between gap-2 border border-slate-300 bg-white px-4 py-3 sm:flex-row sm:items-center">
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="text-lg font-bold text-slate-900">
                                                {c.participant.name}
                                            </span>
                                            <span className="border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">
                                                {changeTypeLabel(c.changeType)}
                                            </span>
                                            {c.participant.isNonCompete && (
                                                <span className="border border-indigo-600 bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-800">
                                                    NC
                                                </span>
                                            )}
                                            {c.participant.isRental && (
                                                <span className="border border-orange-600 bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-800">
                                                    Rental
                                                </span>
                                            )}
                                            <span className="text-xs text-slate-500">
                                                {clockHHMM(c.changedAt.getTime())} ({timeAgo(c.changedAt.getTime())})
                                            </span>
                                        </div>

                                        <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                                            <span>{where}</span>
                                            {club !== '' && <span>· {club}</span>}
                                            <span>
                                                · E-punch:{' '}
                                                <strong className="font-semibold text-slate-900">
                                                    {c.participant.epunch || 'none'}
                                                </strong>
                                            </span>
                                        </div>
                                    </div>

                                    <div className="flex shrink-0 items-center gap-2 text-base">
                                        {c.old !== '' && (
                                            <>
                                                <span className="text-slate-400 line-through">
                                                    {oldFormatted}
                                                </span>
                                                <SvgIcon icon="right" />
                                            </>
                                        )}
                                        <span className="font-bold text-slate-900">
                                            {newFormatted}
                                        </span>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                )}
            </div>
        </>
    )
}
