import { useState } from 'react'
import type { SlotDocType } from '@/Schema'
import { formatSlotTime, isMagicTime } from '@/utils/slotLabels'

interface Properties {
    participantName: string
    currentCourse: string
    currentTime: string
    allSlots: SlotDocType[]
    // Earliest time still worth offering (clock plus call-up offset). '' means no cutoff.
    cutoff: string
    onAssign: (slot: SlotDocType) => void
}

export function OpenTimesPicker({participantName, currentCourse, currentTime, allSlots, cutoff, onAssign}: Properties) {
    const [course, setCourse] = useState(currentCourse)
    const [showEarlier, setShowEarlier] = useState(false)
    // A slot on a different course waits here for an explicit confirmation.
    const [pending, setPending] = useState<SlotDocType | undefined>(undefined)

    const courses = [...new Set(allSlots.map((s) => s.course))].sort()

    const openSlots = allSlots
        .filter((s) =>
            s.course === course &&
            !isMagicTime(s.time) &&
            s.isUsable !== false &&
            s.participants.length === 0 &&
            (showEarlier || cutoff === '' || s.time >= cutoff))
        .sort((a, b) => a.time.localeCompare(b.time))

    function handlePick(slot: SlotDocType) {
        if (slot.course !== currentCourse) {
            setPending(slot)
        } else {
            onAssign(slot)
        }
    }

    return (
        <section className="flex flex-col gap-3 rounded-lg border border-gray-700 bg-gray-900 p-4">
            <h3 className="text-lg font-semibold text-gray-100">
                Move {participantName} to a new time
            </h3>

            <div className="flex flex-wrap items-center gap-1.5">
                <span className="mr-1 text-sm text-gray-400">Course</span>
                {courses.map((c) => (
                    <button
                        key={c}
                        type="button"
                        onClick={() => { setCourse(c); setPending(undefined) }}
                        title={c === currentCourse ? 'Their current course' : undefined}
                        className={`rounded-md px-3 py-1 text-sm font-semibold ${
                            c === course ? 'bg-pink-700 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                        } ${c === currentCourse ? 'ring-1 ring-gray-500' : ''}`}>
                        {c}
                    </button>
                ))}
            </div>

            <div className="text-sm text-gray-400">
                Open times on {course}
                {cutoff !== '' && !showEarlier ? ` from ${cutoff}` : ''}, soonest first
            </div>

            {openSlots.length === 0 ? (
                <p className="text-sm italic text-gray-500">
                    No open times here. Try another course{cutoff !== '' && !showEarlier ? ' or include earlier times' : ''}.
                </p>
            ) : (
                <div className="flex max-h-64 flex-wrap gap-2 overflow-auto">
                    {openSlots.map((slot, i) => (
                        <button
                            key={slot.id}
                            type="button"
                            onClick={() => handlePick(slot)}
                            className={`rounded-md border px-3 py-2 text-lg tabular-nums hover:bg-amber-600/80 hover:text-white ${
                                i === 0 ? 'border-amber-500 text-amber-200' : 'border-gray-600 text-gray-200'
                            }`}>
                            {slot.time}
                        </button>
                    ))}
                </div>
            )}

            {cutoff !== '' && (
                <label className="flex items-center gap-2 text-sm text-gray-400">
                    <input type="checkbox" checked={showEarlier} onChange={(e) => setShowEarlier(e.target.checked)} />
                    Include times already past call-up (before {cutoff})
                </label>
            )}

            {pending !== undefined && (
                <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-600/60 bg-amber-950 px-3 py-2 text-amber-100">
                    <span className="flex-1">
                        Move {participantName} from {currentCourse} · {formatSlotTime(currentTime)} to {pending.course} · {pending.time}?
                        This changes their course.
                    </span>
                    <button
                        type="button"
                        className="rounded bg-amber-600 px-3 py-1 font-semibold text-white hover:bg-amber-500"
                        onClick={() => { const slot = pending; setPending(undefined); onAssign(slot) }}>
                        Confirm move
                    </button>
                    <button type="button" className="rounded border border-amber-600/60 px-3 py-1" onClick={() => setPending(undefined)}>
                        Cancel
                    </button>
                </div>
            )}
        </section>
    )
}
