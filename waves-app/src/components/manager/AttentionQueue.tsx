import { useState, type ReactNode } from 'react'
import type { ChangesDocType, ParticipantDocType, SlotDocType } from '@/Schema'
import { changeTypeLabel, clockHHMM, formatSlotTime, timeAgo } from '@/utils/slotLabels'
import { ParticipantStateStyles } from '@/utils/styleHelpers'

interface Properties {
    participants: ParticipantDocType[]
    slotsByParticipant: Map<string, SlotDocType[]>
    changes: ChangesDocType[]
    onSelect: (participantId: string) => void
}

function Section({title, count, empty, children}: {title: string, count: number, empty: string, children: ReactNode}) {
    return (
        <section className="flex min-w-0 flex-col gap-2">
            <h3 className="text-lg font-semibold text-gray-200">
                {title} <span className="text-gray-500">({count})</span>
            </h3>
            {count === 0 ? <p className="text-sm italic text-gray-500">{empty}</p> : children}
        </section>
    )
}

function Row({title, detail, aside, onClick}: {title: string, detail: string, aside: string, onClick: () => void}) {
    return (
        <button
            type="button"
            onClick={onClick}
            className="flex w-full items-center gap-3 rounded-md bg-gray-800 px-3 py-2 text-left hover:bg-gray-700">
            <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold text-gray-100">{title}</span>
                <span className="block truncate text-sm text-gray-400">{detail}</span>
            </span>
            <span className="shrink-0 text-sm text-gray-400">{aside}</span>
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

export function AttentionQueue({participants, slotsByParticipant, changes, onSelect}: Properties) {
    const [selectedSchool, setSelectedSchool] = useState<string | undefined>(undefined)
    const [schoolFilter, setSchoolFilter] = useState('')

    // Latest change time per participant and change type, for "how long ago".
    const lastChange = new Map<string, number>()
    for (const c of changes) {
        const key = `${c.participantId}|${c.changeType}`
        if ((lastChange.get(key) ?? 0) < c.changedAt) {
            lastChange.set(key, c.changedAt)
        }
    }
    const nameById = new Map(participants.map((p) => [p.id, p.name]))

    const courseOf = (id: string) => slotsByParticipant.get(id)?.[0]?.course ?? '?'
    const timeOf = (id: string) => slotsByParticipant.get(id)?.[0]?.time ?? ''
    const clubOf = (p: ParticipantDocType) => (p.club === undefined || p.club === 'unknown' || p.club === 'None' ? '' : p.club)

    const needsTime = participants
        .filter((p) => p.state === 'needsAssignment')
        .sort((a, b) => courseOf(a.id).localeCompare(courseOf(b.id)) || a.name.localeCompare(b.name))

    // People flagged at Tent 1 with an incorrect e-punch, ordered by upcoming start time.
    const wrongEpunch = participants
        .filter((p) => p.state === 'wrongEpunch')
        .sort((a, b) => timeOf(a.id).localeCompare(timeOf(b.id)) || courseOf(a.id).localeCompare(courseOf(b.id)) || a.name.localeCompare(b.name))

    // Oldest start first: the people who have been waiting longest to be dealt with.
    const noShows = participants
        .filter((p) => p.state === 'noShow')
        .sort((a, b) => timeOf(a.id).localeCompare(timeOf(b.id)) || courseOf(a.id).localeCompare(courseOf(b.id)))

    const recent = [...changes].sort((a, b) => b.changedAt - a.changedAt).slice(0, 6)

    // Surface any participant who is in 0 slots or 2+ slots (once slots have loaded)
    // so the Start Manager spots and repairs sync anomalies without having to search for them.
    const brokenRecords = slotsByParticipant.size === 0
        ? []
        : participants
              .filter((p) => (slotsByParticipant.get(p.id)?.length ?? 0) !== 1)
              .sort((a, b) => a.name.localeCompare(b.name))

    // Group participants by school/club so volunteers can browse any school's roster without typing names.
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

    const activeSchool = selectedSchool === undefined
        ? undefined
        : schools.find((s) => s.name === selectedSchool)

    const activeSchoolMembers = activeSchool === undefined
        ? []
        : [...activeSchool.members].sort(
            (a, b) => timeOf(a.id).localeCompare(timeOf(b.id)) || courseOf(a.id).localeCompare(courseOf(b.id)) || a.name.localeCompare(b.name)
        )

    return (
        <div className="flex flex-col gap-8">
            {brokenRecords.length > 0 && (
                <section className="flex flex-col gap-3 rounded-lg border border-red-700 bg-red-950 p-4 text-red-100">
                    <div>
                        <h3 className="text-lg font-semibold text-white">
                            Records needing repair ({brokenRecords.length})
                        </h3>
                        <p className="text-sm text-red-200">
                            Every participant should be in exactly one slot. Click a record below to fix it:
                        </p>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {brokenRecords.map((p) => {
                            const count = slotsByParticipant.get(p.id)?.length ?? 0
                            const issue = count === 0 ? 'Not in any slot' : `Listed in ${count} slots`
                            return (
                                <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => onSelect(p.id)}
                                    className="flex items-center justify-between gap-2 rounded-md border border-red-700 bg-red-900/70 px-3 py-2 text-left hover:bg-red-800">
                                    <span className="truncate font-semibold text-white">{p.name}</span>
                                    <span className="shrink-0 rounded bg-red-800 px-2 py-0.5 text-xs font-semibold text-red-100">
                                        {issue}
                                    </span>
                                </button>
                            )
                        })}
                    </div>
                </section>
            )}

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
                <Section title="Wrong e-punch" count={wrongEpunch.length} empty="No e-punch issues right now.">
                    {wrongEpunch.map((p) => {
                        const at = lastChange.get(`${p.id}|wrongEpunch`)
                        const ep = p.epunch ? `E-punch ${p.epunch}` : 'no e-punch'
                        return (
                            <Row
                                key={p.id}
                                title={p.name}
                                detail={[courseOf(p.id), `starts ${formatSlotTime(timeOf(p.id))}`, ep, clubOf(p)].filter((x) => x !== '').join(' · ')}
                                aside={at === undefined ? '' : timeAgo(at)}
                                onClick={() => onSelect(p.id)}
                            />
                        )
                    })}
                </Section>

                <Section title="Needs a new time" count={needsTime.length} empty="Nobody is waiting for a new time.">
                    {needsTime.map((p) => {
                        const at = lastChange.get(`${p.id}|needsAssignment`)
                        const was = p.startChanged && p.originalStartTime ? `was ${p.originalStartTime}` : ''
                        return (
                            <Row
                                key={p.id}
                                title={p.name}
                                detail={[courseOf(p.id), clubOf(p), was].filter((x) => x !== '').join(' · ')}
                                aside={at === undefined ? 'no start yet' : timeAgo(at)}
                                onClick={() => onSelect(p.id)}
                            />
                        )
                    })}
                </Section>

                <Section title="No-shows" count={noShows.length} empty="No no-shows so far.">
                    {noShows.map((p) => {
                        const at = lastChange.get(`${p.id}|noShow`)
                        return (
                            <Row
                                key={p.id}
                                title={p.name}
                                detail={[courseOf(p.id), clubOf(p), `was due ${timeOf(p.id)}`].filter((x) => x !== '').join(' · ')}
                                aside={at === undefined ? '' : timeAgo(at)}
                                onClick={() => onSelect(p.id)}
                            />
                        )
                    })}
                </Section>

                <Section title="Recent changes" count={recent.length} empty="Nothing has changed yet.">
                    {recent.map((c) => (
                        <Row
                            key={c.id}
                            title={nameById.get(c.participantId) ?? 'Unknown participant'}
                            detail={`${changeTypeLabel(c.changeType)}${c.new ? ': ' + c.new : ''}`}
                            aside={clockHHMM(c.changedAt)}
                            onClick={() => onSelect(c.participantId)}
                        />
                    ))}
                </Section>
            </div>

            <section className="flex flex-col gap-3 border-t border-gray-800 pt-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="text-lg font-semibold text-gray-200">
                        Schools &amp; Clubs <span className="text-gray-500">({schools.length})</span>
                    </h3>
                    <input
                        type="text"
                        value={schoolFilter}
                        onChange={(e) => setSchoolFilter(e.target.value)}
                        placeholder="Filter schools…"
                        aria-label="Filter schools"
                        className="w-56 rounded-md border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white placeholder-gray-400 focus:border-pink-500 focus:outline-none"
                    />
                </div>

                {activeSchool !== undefined && (
                    <div className="flex flex-col gap-3 rounded-lg border border-sky-700/70 bg-gray-900 p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                                <h4 className="text-xl font-bold text-white">{activeSchool.name}</h4>
                                <p className="text-sm text-gray-400">
                                    {activeSchool.members.length} starter{activeSchool.members.length === 1 ? '' : 's'} ·{' '}
                                    {activeSchool.checkedIn} checked in · {activeSchool.waiting} waiting
                                    {activeSchool.attention > 0 ? ` · ${activeSchool.attention} need attention` : ''}
                                    {activeSchool.notAttending > 0 ? ` · ${activeSchool.notAttending} not attending` : ''}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedSchool(undefined)}
                                className="rounded-md border border-gray-600 px-3 py-1 text-sm font-medium text-gray-200 hover:bg-gray-800">
                                Close school
                            </button>
                        </div>

                        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {activeSchoolMembers.map((p) => {
                                const style = ParticipantStateStyles.get(p.state)
                                const slotTime = formatSlotTime(timeOf(p.id))
                                return (
                                    <button
                                        key={p.id}
                                        type="button"
                                        onClick={() => onSelect(p.id)}
                                        className="flex items-center justify-between gap-2 rounded-md border border-gray-700 bg-gray-800 px-3 py-2 text-left hover:border-sky-500 hover:bg-gray-700">
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate font-semibold text-gray-100">
                                                {p.name}
                                                {p.groupSize > 1 ? ` (Group ${p.groupSize})` : ''}
                                            </span>
                                            <span className="block truncate text-xs text-gray-400">
                                                {courseOf(p.id)} · {slotTime}
                                                {p.epunch ? ` · E-punch ${p.epunch}` : ''}
                                            </span>
                                        </span>
                                        {style !== undefined && (
                                            <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium text-white ${style.bg}`}>
                                                {style.friendlyName}
                                            </span>
                                        )}
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                )}

                {visibleSchools.length === 0 ? (
                    <p className="text-sm italic text-gray-500">No schools match "{schoolFilter.trim()}".</p>
                ) : (
                    <div className="grid gap-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
                        {visibleSchools.map((s) => {
                            const isSelected = s.name === selectedSchool
                            return (
                                <button
                                    key={s.name}
                                    type="button"
                                    onClick={() => setSelectedSchool(isSelected ? undefined : s.name)}
                                    className={`flex flex-col gap-1 rounded-md border px-3 py-2 text-left transition ${
                                        isSelected
                                            ? 'border-sky-500 bg-sky-950/60'
                                            : 'border-gray-800 bg-gray-800/80 hover:border-gray-600 hover:bg-gray-800'
                                    }`}>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="truncate font-semibold text-gray-100">{s.name}</span>
                                        <span className="shrink-0 rounded bg-gray-700 px-1.5 py-0.5 text-xs font-bold text-gray-200">
                                            {s.members.length}
                                        </span>
                                    </div>
                                    <div className="flex flex-wrap gap-2 text-xs">
                                        <span className="text-emerald-400">{s.checkedIn} in</span>
                                        <span className="text-gray-400">{s.waiting} waiting</span>
                                        {s.attention > 0 && (
                                            <span className="font-semibold text-amber-400">{s.attention} alert</span>
                                        )}
                                    </div>
                                </button>
                            )
                        })}
                    </div>
                )}
            </section>
        </div>
    )
}
