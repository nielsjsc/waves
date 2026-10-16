import { useEffect, useRef, useState } from 'react'
import type { ParticipantDocType, SlotDocType } from '@/Schema'
import { ParticipantStateStyles } from '@/utils/styleHelpers'
import { formatSlotTime } from '@/utils/slotLabels'

const MAX_RESULTS = 8

interface Properties {
    participants: ParticipantDocType[]
    slotsByParticipant: Map<string, SlotDocType[]>
    onSelect: (participantId: string) => void
    // Escape in an already-empty box, e.g. to leave the selected participant.
    onEscapeWhenEmpty?: () => void
    // Bump this number to put the cursor back in the box.
    focusToken: number
}

function whereIs(slots: SlotDocType[] | undefined): string {
    if (slots === undefined || slots.length === 0) {return 'not in any slot'}
    if (slots.length > 1) {return 'in several slots'}
    const slot = slots[0]!
    return `${slot.course} · ${formatSlotTime(slot.time)}`
}

export function ManagerSearchBox({participants, slotsByParticipant, onSelect, onEscapeWhenEmpty, focusToken}: Properties) {
    const [query, setQuery] = useState('')
    const [active, setActive] = useState(0)
    const inputRef = useRef<HTMLInputElement>(null)

    useEffect(() => {
        inputRef.current?.focus()
    }, [focusToken])

    useEffect(() => {
        setActive(0)
    }, [query])

    const q = query.trim().toLowerCase()
    let matches: ParticipantDocType[] = []
    if (q.length >= 2) {
        // Every word typed must appear in the name, club or e-punch number.
        const words = q.split(/\s+/)
        matches = participants
            .filter((p) => {
                const haystack = `${p.name} ${p.club ?? ''} ${p.epunch ?? ''}`.toLowerCase()
                return words.every((w) => haystack.includes(w))
            })
            .sort((a, b) => a.name.localeCompare(b.name))
    }
    const shown = matches.slice(0, MAX_RESULTS)

    function choose(participantId: string) {
        onSelect(participantId)
        setQuery('')
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'ArrowDown') {
            e.preventDefault()
            setActive((i) => Math.min(i + 1, shown.length - 1))
        } else if (e.key === 'ArrowUp') {
            e.preventDefault()
            setActive((i) => Math.max(i - 1, 0))
        } else if (e.key === 'Enter') {
            const pick = shown[active]
            if (pick !== undefined) {choose(pick.id)}
        } else if (e.key === 'Escape') {
            if (query === '') {onEscapeWhenEmpty?.()} else {setQuery('')}
        }
    }

    return (
        <div className="relative">
            <input
                ref={inputRef}
                type="text"
                aria-label="Search participants"
                autoComplete="off"
                className="w-full rounded-lg border-2 border-gray-600 bg-gray-800 px-4 py-3 text-xl text-white placeholder-gray-400 focus:border-pink-500 focus:outline-none"
                placeholder="Search by name, club or e-punch number"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleKeyDown}
            />
            {q.length >= 2 && (
                <ul className="absolute left-0 right-0 top-full z-30 mt-1 overflow-hidden rounded-lg border border-gray-600 bg-gray-900 shadow-xl">
                    {shown.length === 0 && (
                        <li className="px-4 py-3 text-gray-400">No one matches "{query.trim()}"</li>
                    )}
                    {shown.map((p, i) => {
                        const style = ParticipantStateStyles.get(p.state)
                        const club = p.club === undefined || p.club === 'unknown' || p.club === 'None' ? '' : p.club
                        return (
                            <li key={p.id}>
                                <button
                                    type="button"
                                    onMouseEnter={() => setActive(i)}
                                    onClick={() => choose(p.id)}
                                    className={`flex w-full items-center gap-3 px-4 py-2 text-left ${i === active ? 'bg-gray-700' : 'bg-gray-900'}`}>
                                    <span className="min-w-0 flex-1">
                                        <span className="font-semibold text-gray-100">{p.name}</span>
                                        {p.groupSize > 1 && (
                                            <span className="ml-2 text-xs text-emerald-300">group of {p.groupSize}</span>
                                        )}
                                        <span className="block truncate text-sm text-gray-400">
                                            {club}
                                            {club !== '' && ' · '}
                                            {p.epunch ? `E-punch ${p.epunch}` : 'no e-punch'}
                                        </span>
                                    </span>
                                    <span className="shrink-0 text-right text-sm text-gray-300">
                                        {whereIs(slotsByParticipant.get(p.id))}
                                    </span>
                                    {p.state !== 'waiting' && style !== undefined && (
                                        <span className={`shrink-0 rounded px-1.5 text-xs font-medium text-white ${style.bg}`}>
                                            {style.friendlyName}
                                        </span>
                                    )}
                                </button>
                            </li>
                        )
                    })}
                    {matches.length > MAX_RESULTS && (
                        <li className="px-4 py-2 text-sm text-gray-500">
                            {matches.length - MAX_RESULTS} more. Keep typing to narrow it down.
                        </li>
                    )}
                </ul>
            )}
        </div>
    )
}
