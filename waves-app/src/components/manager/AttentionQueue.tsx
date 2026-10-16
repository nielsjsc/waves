import type { ReactNode } from 'react'
import type { ChangesDocType, ParticipantDocType, SlotDocType } from '@/Schema'
import { changeTypeLabel, clockHHMM, timeAgo } from '@/utils/slotLabels'

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

export function AttentionQueue({participants, slotsByParticipant, changes, onSelect}: Properties) {
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

    // Oldest start first: the people who have been waiting longest to be dealt with.
    const noShows = participants
        .filter((p) => p.state === 'noShow')
        .sort((a, b) => timeOf(a.id).localeCompare(timeOf(b.id)) || courseOf(a.id).localeCompare(courseOf(b.id)))

    const recent = [...changes].sort((a, b) => b.changedAt - a.changedAt).slice(0, 6)

    return (
        <div className="grid gap-6 lg:grid-cols-3">
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
    )
}
