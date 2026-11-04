import { useState } from 'react'
import type { ParticipantDocType, SlotDocType } from '@/Schema'
import { courseShortLabel, evaluateStartTimesForSchool, formatSlotTime, isMagicTime } from '@/utils/slotLabels'

interface Properties {
    participantId: string
    participantName: string
    participantClub: string
    currentCourse: string
    currentTime: string
    allSlots: SlotDocType[]
    allParticipants: ParticipantDocType[]
    // Earliest time still worth offering (clock plus call-up offset). '' means no cutoff.
    cutoff: string
    onAssign: (slot: SlotDocType) => void
    onClose?: () => void
}

export function OpenTimesPicker({
    participantId,
    participantName,
    participantClub,
    currentCourse,
    currentTime,
    allSlots,
    allParticipants,
    cutoff,
    onAssign,
    onClose,
}: Properties) {
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

    const recommendation = evaluateStartTimesForSchool({
        openSlots,
        allSlots,
        allParticipants,
        course,
        participantClub,
        excludeParticipantId: participantId,
    })

    const hasAnyConflictSlots = recommendation.evaluatedSlots.some((s) => !s.isPreferred)
    const recommendedId = recommendation.recommendedSlot?.slot.id

    function handlePick(slot: SlotDocType) {
        if (slot.course !== currentCourse) {
            setPending(slot)
        } else {
            onAssign(slot)
        }
    }

    const activeHint = courseShortLabel(course)

    return (
        <section className="flex flex-col gap-3 rounded-lg border border-gray-700 bg-gray-900 p-4">
            <div className="flex items-center justify-between gap-2 border-b border-gray-800 pb-2">
                <h3 className="text-lg font-bold text-gray-100">
                    Assign Start Time for {participantName}
                </h3>
                <div className="flex items-center gap-2">
                    <span className="rounded bg-gray-800 px-2.5 py-0.5 text-xs font-medium text-gray-300">
                        Currently: {currentCourse} · {formatSlotTime(currentTime)}
                    </span>
                    {onClose !== undefined && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded border border-gray-600 px-2 py-0.5 text-xs font-medium text-gray-300 hover:bg-gray-700 hover:text-white">
                            Hide
                        </button>
                    )}
                </div>
            </div>

            <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">
                    1. Choose Course
                </div>
                <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                    {courses.map((c) => {
                        const hint = courseShortLabel(c)
                        const isSelected = c === course
                        const isCurrent = c === currentCourse
                        return (
                            <button
                                key={c}
                                type="button"
                                onClick={() => { setCourse(c); setPending(undefined) }}
                                title={isCurrent ? 'Their current course' : undefined}
                                className={`flex flex-col items-start rounded-md border px-2.5 py-1.5 text-left transition ${
                                    isSelected
                                        ? 'border-pink-500 bg-pink-700 text-white'
                                        : 'border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700'
                                } ${isCurrent && !isSelected ? 'ring-1 ring-gray-500' : ''}`}>
                                <div className="flex w-full items-center justify-between gap-1">
                                    <span className="text-sm font-bold leading-tight">{c}</span>
                                    {isCurrent && (
                                        <span className={`text-[10px] font-medium ${isSelected ? 'text-pink-200' : 'text-gray-400'}`}>
                                            current
                                        </span>
                                    )}
                                </div>
                                {hint !== '' && (
                                    <span className={`truncate text-[11px] leading-tight ${isSelected ? 'text-pink-100' : 'text-gray-400'}`}>
                                        {hint}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Recommendation Banner (10-minute same-school spacing rule) */}
            {recommendation.recommendedSlot !== undefined && (
                <div
                    className={`flex flex-wrap items-center justify-between gap-3 rounded-md border px-3.5 py-2.5 ${
                        recommendation.recommendedSlot.isPreferred
                            ? 'border-emerald-600/80 bg-emerald-950/40 text-emerald-100'
                            : 'border-amber-600/80 bg-amber-950/40 text-amber-100'
                    }`}>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-300">
                                {recommendation.recommendedSlot.isPreferred
                                    ? '★ Preferred Start Time'
                                    : 'Closest to 10-min Spacing'}
                            </span>
                            <span className="rounded bg-emerald-700 px-2 py-0.5 text-base font-bold tabular-nums text-white">
                                {recommendation.recommendedSlot.slot.time}
                            </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-gray-200">
                            {recommendation.reason}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => handlePick(recommendation.recommendedSlot!.slot)}
                        className="shrink-0 rounded-md bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white shadow hover:bg-emerald-500">
                        Assign recommended
                    </button>
                </div>
            )}

            <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                        2. Pick Open Time on {course}{activeHint !== '' ? ` (${activeHint})` : ''}
                        {cutoff !== '' && !showEarlier ? ` from ${cutoff}` : ''}
                    </span>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                        {hasAnyConflictSlots && (
                            <span className="text-amber-300/90">
                                Dashed = &lt;10 min from {recommendation.school} teammate (click to override)
                            </span>
                        )}
                        <span>
                            {openSlots.length} open slot{openSlots.length === 1 ? '' : 's'}
                        </span>
                    </div>
                </div>

                {openSlots.length === 0 ? (
                    <p className="rounded-md border border-dashed border-gray-700 p-4 text-center text-sm italic text-gray-400">
                        No open times here. Try another course{cutoff !== '' && !showEarlier ? ' or include earlier times below' : ''}.
                    </p>
                ) : (
                    <div className="flex max-h-64 flex-wrap gap-2 overflow-auto rounded-md border border-gray-800 bg-gray-950/60 p-3">
                        {recommendation.evaluatedSlots.map(({ slot, isPreferred, closestConflict }) => {
                            const isRecommended = slot.id === recommendedId
                            const conflictTitle = closestConflict
                                ? `Within 10 min of ${recommendation.school} teammate ${closestConflict.teammateName} (${closestConflict.teammateTime}, ${closestConflict.gapMinutes} min apart) — click to override`
                                : isRecommended
                                  ? 'Preferred start time (10+ min spacing from same-school teammates)'
                                  : '10+ min spacing from same-school teammates'

                            let btnStyle = 'border-gray-600 bg-gray-800 text-gray-200 hover:bg-amber-600 hover:text-white'
                            if (isRecommended && isPreferred) {
                                btnStyle = 'border-2 border-emerald-400 bg-emerald-950/80 text-emerald-100 ring-1 ring-emerald-400/50 hover:bg-emerald-600 hover:text-white'
                            } else if (!isPreferred) {
                                btnStyle = 'border-dashed border-amber-700/80 bg-amber-950/25 text-amber-300/80 hover:bg-amber-600 hover:text-white'
                            }

                            return (
                                <button
                                    key={slot.id}
                                    type="button"
                                    title={conflictTitle}
                                    onClick={() => handlePick(slot)}
                                    className={`rounded-md border px-3.5 py-2 text-lg font-semibold tabular-nums transition ${btnStyle}`}>
                                    {slot.time}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {cutoff !== '' && (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-300">
                    <input
                        type="checkbox"
                        checked={showEarlier}
                        onChange={(e) => setShowEarlier(e.target.checked)}
                        className="size-4 rounded"
                    />
                    Include times already past call-up (before {cutoff})
                </label>
            )}

            {pending !== undefined && (
                <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-600/60 bg-amber-950 px-3 py-2.5 text-amber-100">
                    <span className="flex-1 text-sm">
                        Move <strong>{participantName}</strong> from <strong>{currentCourse} · {formatSlotTime(currentTime)}</strong> to <strong>{pending.course} · {pending.time}</strong>?
                        This changes their course.
                    </span>
                    <button
                        type="button"
                        className="rounded bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-500"
                        onClick={() => { const slot = pending; setPending(undefined); onAssign(slot) }}>
                        Confirm move
                    </button>
                    <button
                        type="button"
                        className="rounded border border-amber-600/60 px-3 py-1.5 text-sm hover:bg-amber-900"
                        onClick={() => setPending(undefined)}>
                        Cancel
                    </button>
                </div>
            )}
        </section>
    )
}
