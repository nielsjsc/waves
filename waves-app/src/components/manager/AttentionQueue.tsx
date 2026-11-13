import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { ChangesDocType, ParticipantDocType, SlotDocType } from '@/Schema'
import { changeTypeLabel, clockHHMM, formatSlotTime, isMagicTime, timeAgo } from '@/utils/slotLabels'
import { getDisplayStates, hasNoShow, hasWrongEpunch, ParticipantStateStyles } from '@/utils/styleHelpers'

interface Properties {
    participants: ParticipantDocType[]
    slotsByParticipant: Map<string, SlotDocType[]>
    changes: ChangesDocType[]
    onSelect: (participantId: string, openPicker?: boolean) => void
}

function TriageCard({
    title,
    count,
    empty,
    accent,
    children,
}: {
    title: string
    count: number
    empty: string
    accent: 'amber' | 'orange' | 'red'
    children: ReactNode
}) {
    const activeBorder =
        accent === 'amber'
            ? 'border-amber-600 bg-amber-50/50'
            : accent === 'orange'
              ? 'border-orange-600 bg-orange-50/50'
              : 'border-red-600 bg-red-50/50'
    const badgeColor =
        accent === 'amber'
            ? 'bg-amber-600 text-white'
            : accent === 'orange'
              ? 'bg-orange-600 text-white'
              : 'bg-red-700 text-white'

    return (
        <section
            className={`flex min-w-0 flex-col gap-2 border p-3 ${
                count > 0 ? activeBorder : 'border-slate-300 bg-white'
            }`}>
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-slate-900">
                    {title}{' '}
                    <span
                        className={`ml-1 inline-block px-2 py-0.5 text-xs font-bold ${
                            count > 0 ? badgeColor : 'bg-slate-200 text-slate-700'
                        }`}>
                        ({count})
                    </span>
                </h3>
            </div>
            {count === 0 ? (
                <p className="py-2 text-xs font-medium text-slate-400">{empty}</p>
            ) : (
                <div className="flex max-h-72 flex-col gap-1.5 overflow-y-auto pr-0.5">{children}</div>
            )}
        </section>
    )
}

function Row({
    title,
    badge,
    detail,
    aside,
    onClick,
}: {
    title: string
    badge?: string
    detail: string
    aside: string
    onClick: () => void
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex min-h-11 w-full items-center gap-3 border border-slate-300 bg-white px-3 py-2 text-left transition hover:border-slate-500 hover:bg-slate-50 active:bg-slate-100">
            <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-1.5">
                    <span className="truncate font-semibold text-slate-900">{title}</span>
                    {badge && (
                        <span className="shrink-0 border border-purple-600 bg-purple-50 px-1.5 py-0.5 text-[10px] font-bold text-purple-800">
                            {badge}
                        </span>
                    )}
                </span>
                <span className="block truncate text-xs text-slate-600">{detail}</span>
            </span>
            <span className="shrink-0 text-xs font-semibold text-slate-600">{aside}</span>
        </button>
    )
}

interface SchoolSummary {
    name: string
    members: ParticipantDocType[]
    checkedIn: number
    waiting: number
    attention: number
    notAttending: number
}

export function AttentionQueue({ participants, slotsByParticipant, changes, onSelect }: Properties) {
    const [triageFilter, setTriageFilter] = useState<'all' | 'wrongEpunch' | 'standby' | 'noShows' | 'ineligible'>('all')
    const [schoolsExpanded, setSchoolsExpanded] = useState(false)
    const [selectedSchool, setSelectedSchool] = useState<string | undefined>(undefined)
    const [schoolFilter, setSchoolFilter] = useState('')
    const openSchoolRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (selectedSchool !== undefined && openSchoolRef.current !== null) {
            openSchoolRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
    }, [selectedSchool])

    // Latest change time per participant and change type, for "how long ago".
    const lastChange = new Map<string, number>()
    for (const c of changes) {
        const key = `${c.participantId}|${c.changeType}`
        if ((lastChange.get(key) ?? 0) < c.changedAt) {
            lastChange.set(key, c.changedAt)
        }
    }
    const participantById = new Map(participants.map((p) => [p.id, p]))
    const nameById = new Map(participants.map((p) => [p.id, p.name]))

    const courseOf = (id: string) => slotsByParticipant.get(id)?.[0]?.course ?? '?'
    const timeOf = (id: string) => slotsByParticipant.get(id)?.[0]?.time ?? ''
    const dueTimeOf = (p: ParticipantDocType) => {
        const cur = timeOf(p.id)
        if (cur !== '' && !isMagicTime(cur)) return cur
        return p.originalStartTime ?? ''
    }
    const clubOf = (p: ParticipantDocType) => (p.club === undefined || p.club === 'unknown' || p.club === 'None' ? '' : p.club)

    const standbyTimeOf = (id: string) =>
        lastChange.get(`${id}|needsAssignment`) ?? lastChange.get(`${id}|addedParticipant`)

    const standbyRunners = participants
        .filter((p) => p.state === 'needsAssignment')
        .sort(
            (a, b) =>
                (standbyTimeOf(a.id) ?? 0) - (standbyTimeOf(b.id) ?? 0) ||
                courseOf(a.id).localeCompare(courseOf(b.id)) ||
                a.name.localeCompare(b.name)
        )

    // People flagged at Tent 1 with an incorrect e-punch, ordered by upcoming start time.
    const wrongEpunch = participants
        .filter((p) => hasWrongEpunch(p))
        .sort((a, b) => dueTimeOf(a).localeCompare(dueTimeOf(b)) || courseOf(a.id).localeCompare(courseOf(b.id)) || a.name.localeCompare(b.name))

    // Oldest start first: the people who have been waiting longest to be dealt with.
    // A participant can appear in BOTH Wrong e-punch and No-shows simultaneously.
    const noShows = participants
        .filter((p) => hasNoShow(p))
        .sort((a, b) => dueTimeOf(a).localeCompare(dueTimeOf(b)) || courseOf(a.id).localeCompare(courseOf(b.id)))

    // Racers flagged with "N" (missing parent shadow waiver) or "Need $" (owes payment)
    const ineligibleRacers = participants
        .filter((p) => (Boolean(p.needsWaiver) || Boolean(p.needsPayment)) && p.state !== 'notAttending')
        .sort(
            (a, b) =>
                dueTimeOf(a).localeCompare(dueTimeOf(b)) ||
                courseOf(a.id).localeCompare(courseOf(b.id)) ||
                a.name.localeCompare(b.name)
        )

    // Filter out superseded noShow / wrongEpunch change records that no longer match the participant's current state
    const activeChanges = changes.filter((c) => {
        const p = participantById.get(c.participantId)
        if (!p) return true
        if (c.changeType === 'noShow' && !hasNoShow(p)) return false
        if (c.changeType === 'wrongEpunch' && !hasWrongEpunch(p)) return false
        return true
    })
    const recent = [...activeChanges].sort((a, b) => b.changedAt - a.changedAt).slice(0, 6)

    // Surface any participant who is in 0 slots or 2+ slots (once slots have loaded)
    const brokenRecords = slotsByParticipant.size === 0
        ? []
        : participants
              .filter((p) => (slotsByParticipant.get(p.id)?.length ?? 0) !== 1)
              .sort((a, b) => a.name.localeCompare(b.name))

    // Overall meet stats
    let totalCheckedIn = 0
    let totalWaiting = 0
    let totalAttention = 0
    let totalNotAttending = 0
    for (const p of participants) {
        if (p.state === 'present' || p.state === 'validated' || p.state === 'started') {
            totalCheckedIn++
        } else if (p.state === 'waiting') {
            totalWaiting++
        } else if (p.state === 'noShow' || p.state === 'needsAssignment' || p.state === 'wrongEpunch') {
            totalAttention++
        } else if (p.state === 'notAttending') {
            totalNotAttending++
        }
    }

    // Group participants by school/club
    const bySchool = new Map<string, ParticipantDocType[]>()
    for (const p of participants) {
        const schoolName = clubOf(p) || 'Independent / No school'
        const list = bySchool.get(schoolName)
        if (list === undefined) {
            bySchool.set(schoolName, [p])
        } else {
            list.push(p)
        }
    }

    const schools: SchoolSummary[] = [...bySchool.entries()]
        .map(([name, members]) => {
            let checkedIn = 0
            let waiting = 0
            let attention = 0
            let notAttending = 0
            for (const m of members) {
                if (m.state === 'present' || m.state === 'validated' || m.state === 'started') {
                    checkedIn++
                } else if (m.state === 'waiting') {
                    waiting++
                } else if (m.state === 'noShow' || m.state === 'needsAssignment' || m.state === 'wrongEpunch') {
                    attention++
                } else if (m.state === 'notAttending') {
                    notAttending++
                }
            }
            return { name, members, checkedIn, waiting, attention, notAttending }
        })
        .sort((a, b) => {
            if (a.name === 'Independent / No school') return 1
            if (b.name === 'Independent / No school') return -1
            return a.name.localeCompare(b.name)
        })

    const filterText = schoolFilter.trim().toLowerCase()
    const visibleSchools = filterText === ''
        ? schools
        : schools.filter((s) => s.name.toLowerCase().includes(filterText))

    const totalTriageCount = wrongEpunch.length + standbyRunners.length + noShows.length + ineligibleRacers.length

    return (
        <div className="flex flex-col gap-4 text-slate-900">
            {brokenRecords.length > 0 && (
                <section className="flex flex-col gap-2.5 border-2 border-red-600 bg-red-50 p-3 text-red-950">
                    <h3 className="text-base font-bold text-red-950">
                        Records needing repair ({brokenRecords.length})
                    </h3>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {brokenRecords.map((p) => {
                            const count = slotsByParticipant.get(p.id)?.length ?? 0
                            const issue = count === 0 ? 'Not in any slot' : `Listed in ${count} slots`
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => onSelect(p.id)}
                                    className="flex min-h-11 items-center justify-between gap-2 border border-red-600 bg-white px-3 py-1.5 text-left hover:bg-red-100">
                                    <span className="truncate font-semibold text-slate-900">{p.name}</span>
                                    <span className="shrink-0 bg-red-700 px-2 py-0.5 text-xs font-semibold text-white">
                                        {issue}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </section>
            )}

            {/* Meet Status Overview Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 border border-slate-300 bg-white px-3.5 py-2 text-xs">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">Meet Status</span>
                    <span className="border border-slate-300 bg-slate-100 px-2 py-0.5 font-bold text-slate-800">
                        {participants.length} entries
                    </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 font-semibold">
                    <span className="border border-emerald-700 bg-emerald-50 px-2 py-0.5 text-emerald-950">
                        {totalCheckedIn} checked in
                    </span>
                    <span className="border border-slate-300 bg-slate-100 px-2 py-0.5 text-slate-800">
                        {totalWaiting} waiting
                    </span>
                    {totalAttention > 0 && (
                        <span className="border border-amber-700 bg-amber-50 px-2 py-0.5 text-amber-950">
                            {totalAttention} need attention
                        </span>
                    )}
                    {totalNotAttending > 0 && (
                        <span className="border border-slate-300 bg-slate-100 px-2 py-0.5 text-slate-600">
                            {totalNotAttending} not attending
                        </span>
                    )}
                </div>
            </div>

            {/* Mobile Triage Queue Selector */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:hidden">
                <button
                    type="button"
                    onClick={() => setTriageFilter('all')}
                    className={`min-h-9 shrink-0 px-3 py-1.5 text-xs font-bold transition ${
                        triageFilter === 'all'
                            ? 'border border-slate-900 bg-slate-900 text-white'
                            : 'border border-slate-300 bg-white text-slate-700'
                    }`}>
                    All Queues ({totalTriageCount})
                </button>
                <button
                    type="button"
                    onClick={() => setTriageFilter('wrongEpunch')}
                    className={`min-h-9 shrink-0 px-3 py-1.5 text-xs font-bold transition ${
                        triageFilter === 'wrongEpunch'
                            ? 'border border-amber-600 bg-amber-600 text-white'
                            : 'border border-amber-300 bg-amber-50 text-amber-900'
                    }`}>
                    Wrong e-punch ({wrongEpunch.length})
                </button>
                <button
                    type="button"
                    onClick={() => setTriageFilter('standby')}
                    className={`min-h-9 shrink-0 px-3 py-1.5 text-xs font-bold transition ${
                        triageFilter === 'standby'
                            ? 'border border-orange-600 bg-orange-600 text-white'
                            : 'border border-orange-300 bg-orange-50 text-orange-900'
                    }`}>
                    Standby ({standbyRunners.length})
                </button>
                <button
                    type="button"
                    onClick={() => setTriageFilter('noShows')}
                    className={`min-h-9 shrink-0 px-3 py-1.5 text-xs font-bold transition ${
                        triageFilter === 'noShows'
                            ? 'border border-red-700 bg-red-700 text-white'
                            : 'border border-red-300 bg-red-50 text-red-900'
                    }`}>
                    No-shows ({noShows.length})
                </button>
                <button
                    type="button"
                    onClick={() => setTriageFilter('ineligible')}
                    className={`min-h-9 shrink-0 px-3 py-1.5 text-xs font-bold transition ${
                        triageFilter === 'ineligible'
                            ? 'border border-red-700 bg-red-700 text-white'
                            : 'border border-red-300 bg-red-50 text-red-900'
                    }`}>
                    Ineligible ({ineligibleRacers.length})
                </button>
            </div>

            {/* 1. Four Actionable Triage Queues */}
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                <div className={triageFilter === 'all' || triageFilter === 'wrongEpunch' ? 'block' : 'hidden md:block'}>
                    <TriageCard
                        title="Wrong e-punch"
                        count={wrongEpunch.length}
                        empty="None"
                        accent="amber">
                        {wrongEpunch.map((p) => {
                            const at = lastChange.get(`${p.id}|wrongEpunch`)
                            const ep = p.epunch ? `E-punch ${p.epunch}` : 'no e-punch'
                            return (
                                <Row
                                    key={p.id}
                                    title={p.name}
                                    badge={p.isSecondCourse ? '2nd course' : undefined}
                                    detail={[courseOf(p.id), `starts ${formatSlotTime(timeOf(p.id))}`, ep, clubOf(p)].filter((x) => x !== '').join(' · ')}
                                    aside={at === undefined ? '' : timeAgo(at)}
                                    onClick={() => onSelect(p.id)}
                                />
                            )
                        })}
                    </TriageCard>
                </div>

                <div className={triageFilter === 'all' || triageFilter === 'standby' ? 'block' : 'hidden md:block'}>
                    <TriageCard
                        title="Standby"
                        count={standbyRunners.length}
                        empty="None"
                        accent="orange">
                        {standbyRunners.map((p) => {
                            const at = standbyTimeOf(p.id)
                            const was = p.startChanged && p.originalStartTime ? `was ${p.originalStartTime}` : ''
                            return (
                                <Row
                                    key={p.id}
                                    title={p.name}
                                    badge={p.isSecondCourse ? '2nd course' : undefined}
                                    detail={[courseOf(p.id), p.isSecondCourse ? '2nd course' : '', clubOf(p), was].filter((x) => x !== '').join(' · ')}
                                    aside={at === undefined ? 'in standby' : timeAgo(at)}
                                    onClick={() => onSelect(p.id, false)}
                                />
                            )
                        })}
                    </TriageCard>
                </div>

                <div className={triageFilter === 'all' || triageFilter === 'noShows' ? 'block' : 'hidden md:block'}>
                    <TriageCard
                        title="No-shows"
                        count={noShows.length}
                        empty="None"
                        accent="red">
                        {noShows.map((p) => {
                            const at = lastChange.get(`${p.id}|noShow`)
                            const due = dueTimeOf(p)
                            const takenByStandby = isMagicTime(timeOf(p.id))
                            const dueLabel = due !== '' ? `was due ${due}${takenByStandby ? ' (slot taken)' : ''}` : ''
                            return (
                                <Row
                                    key={p.id}
                                    title={p.name}
                                    badge={p.isSecondCourse ? '2nd course' : undefined}
                                    detail={[courseOf(p.id), clubOf(p), dueLabel].filter((x) => x !== '').join(' · ')}
                                    aside={at === undefined ? '' : timeAgo(at)}
                                    onClick={() => onSelect(p.id)}
                                />
                            )
                        })}
                    </TriageCard>
                </div>

                <div className={triageFilter === 'all' || triageFilter === 'ineligible' ? 'block' : 'hidden md:block'}>
                    <TriageCard
                        title="Ineligible racers"
                        count={ineligibleRacers.length}
                        empty="None"
                        accent="red">
                        {ineligibleRacers.map((p) => {
                            const reasons = [
                                p.needsWaiver ? 'N' : '',
                                p.needsPayment ? 'Need $' : '',
                            ].filter(Boolean).join(', ')
                            return (
                                <Row
                                    key={p.id}
                                    title={p.name}
                                    badge={p.isSecondCourse ? '2nd course' : undefined}
                                    detail={[courseOf(p.id), `starts ${formatSlotTime(timeOf(p.id))}`, clubOf(p)].filter((x) => x !== '').join(' · ')}
                                    aside={reasons}
                                    onClick={() => onSelect(p.id)}
                                />
                            )
                        })}
                    </TriageCard>
                </div>
            </div>

            {/* 2. Expandable Schools & Clubs Directory (starts closed) */}
            <section className="flex flex-col gap-3 border border-slate-300 bg-white p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={() => setSchoolsExpanded((open) => !open)}
                        className="flex min-h-10 items-center gap-2 text-left">
                        <h3 className="text-base font-bold text-slate-900">
                            Schools &amp; Clubs <span className="text-slate-500">({schools.length})</span>
                        </h3>
                        <span className="border border-slate-300 bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 hover:bg-slate-200">
                            {schoolsExpanded ? 'Hide' : 'Show'}
                        </span>
                    </button>

                    {schoolsExpanded && (
                        <input
                            type="text"
                            value={schoolFilter}
                            onChange={(e) => setSchoolFilter(e.target.value)}
                            placeholder="Filter schools…"
                            aria-label="Filter schools"
                            className="w-full sm:w-56 rounded-none border border-slate-300 bg-white px-3 py-2 sm:py-1 text-sm sm:text-xs text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
                        />
                    )}
                </div>

                {schoolsExpanded && (
                    visibleSchools.length === 0 ? (
                        <p className="text-xs text-slate-400">No schools match "{schoolFilter.trim()}".</p>
                    ) : (
                        <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                            {visibleSchools.map((s) => {
                                const isSelected = s.name === selectedSchool
                                if (!isSelected) {
                                    return (
                                        <button
                                            key={s.name}
                                            type="button"
                                            onClick={() => setSelectedSchool(s.name)}
                                            className="flex min-h-11 flex-col gap-1 border border-slate-300 bg-white px-2.5 py-2 text-left transition hover:border-slate-600 hover:bg-slate-50 active:bg-slate-100">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="truncate font-semibold text-slate-900">{s.name}</span>
                                                <span className="shrink-0 bg-slate-200 px-1.5 py-0.5 text-[11px] font-bold text-slate-800">
                                                    {s.members.length}
                                                </span>
                                            </div>
                                            <div className="flex flex-wrap gap-2 text-[11px]">
                                                <span className="text-emerald-700">{s.checkedIn} in</span>
                                                <span className="text-slate-600">{s.waiting} waiting</span>
                                                {s.attention > 0 && (
                                                    <span className="font-semibold text-amber-700">{s.attention} alert</span>
                                                )}
                                            </div>
                                        </button>
                                    )
                                }

                                const sortedMembers = [...s.members].sort(
                                    (a, b) =>
                                        timeOf(a.id).localeCompare(timeOf(b.id)) ||
                                        courseOf(a.id).localeCompare(courseOf(b.id)) ||
                                        a.name.localeCompare(b.name)
                                )

                                return (
                                    <div
                                        key={s.name}
                                        ref={openSchoolRef}
                                        className="col-span-full flex flex-col gap-2.5 border-2 border-slate-900 bg-slate-50 p-3">
                                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-300 pb-2">
                                            <button
                                                type="button"
                                                onClick={() => setSelectedSchool(undefined)}
                                                className="text-left">
                                                <h4 className="text-lg font-bold text-slate-900 hover:text-sky-700">
                                                    {s.name}
                                                </h4>
                                                <p className="text-xs text-slate-600">
                                                    {s.members.length} starters ·{' '}
                                                    <span className="font-medium text-emerald-700">{s.checkedIn} in</span> ·{' '}
                                                    <span>{s.waiting} waiting</span>
                                                    {s.attention > 0 ? ` · ${s.attention} alert` : ''}
                                                    {s.notAttending > 0 ? ` · ${s.notAttending} out` : ''}
                                                </p>
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setSelectedSchool(undefined)}
                                                className="border border-slate-400 bg-white px-2.5 py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100">
                                                Close
                                            </button>
                                        </div>

                                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                            {sortedMembers.map((p) => {
                                                const displayStates = getDisplayStates(p)
                                                const waitingStyle = ParticipantStateStyles.get('waiting')
                                                const slotTime = formatSlotTime(timeOf(p.id))
                                                return (
                                                    <button
                                                        key={p.id}
                                                        type="button"
                                                        onClick={() => onSelect(p.id)}
                                                        className="flex min-h-11 items-center justify-between gap-2 border border-slate-300 bg-white px-3 py-1.5 text-left transition hover:border-slate-600 hover:bg-slate-50 active:bg-slate-100">
                                                        <span className="min-w-0 flex-1">
                                                            <span className="block truncate font-semibold text-slate-900">
                                                                {p.name}
                                                                {p.groupSize > 1 ? ` (Group ${p.groupSize})` : ''}
                                                                {p.isNonCompete ? ' (NC)' : ''}
                                                            </span>
                                                            <span className="block truncate text-xs text-slate-600">
                                                                {courseOf(p.id)} · {slotTime}
                                                                {p.epunch ? ` · E-punch ${p.epunch}` : ''}
                                                            </span>
                                                        </span>
                                                        <div className="flex shrink-0 flex-wrap justify-end gap-1">
                                                            {displayStates.length > 0 ? (
                                                                displayStates.map((st) => {
                                                                    const stStyle = ParticipantStateStyles.get(st)!
                                                                    return (
                                                                        <span
                                                                            key={st}
                                                                            className={`shrink-0 px-2 py-0.5 text-xs font-semibold text-white ${stStyle.bg}`}>
                                                                            {stStyle.friendlyName}
                                                                        </span>
                                                                    )
                                                                })
                                                            ) : (
                                                                waitingStyle !== undefined && (
                                                                    <span className={`shrink-0 px-2 py-0.5 text-xs font-semibold text-white ${waitingStyle.bg}`}>
                                                                        {waitingStyle.friendlyName}
                                                                    </span>
                                                                )
                                                            )}
                                                        </div>
                                                    </button>
                                                )
                                            })}
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )
                )}
            </section>

            {/* 3. Recent Changes Strip */}
            <section className="flex flex-col gap-2 border border-slate-300 bg-white p-3">
                <h3 className="text-sm font-bold text-slate-900">
                    Recent Changes <span className="text-slate-500">({recent.length})</span>
                </h3>
                {recent.length === 0 ? (
                    <p className="text-xs text-slate-400">No changes recorded.</p>
                ) : (
                    <div className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                        {recent.map((c) => (
                            <Row
                                key={c.id}
                                title={nameById.get(c.participantId) ?? 'Unknown participant'}
                                detail={`${changeTypeLabel(c.changeType)}${c.new ? ': ' + c.new : ''}`}
                                aside={clockHHMM(c.changedAt)}
                                onClick={() => onSelect(c.participantId)}
                            />
                        ))}
                    </div>
                )}
            </section>
        </div>
    )
}
