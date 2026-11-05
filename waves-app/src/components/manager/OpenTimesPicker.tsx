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
        <section className="flex flex-col gap-3 border border-slate-300 bg-white p-4 text-slate-900">
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 pb-2">
                <h3 className="text-lg font-bold text-slate-900">
                    Assign Start Time for {participantName}
                </h3>
                <div className="flex items-center gap-2">
                    <span className="border border-slate-300 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                        Currently: {currentCourse} · {formatSlotTime(currentTime)}
                    </span>
                    {onClose !== undefined && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="border border-slate-300 bg-white px-2.5 py-0.5 text-xs font-medium text-slate-700 hover:bg-slate-100">
                            Hide
                        </button>
                    )}
                </div>
            </div>

            <div>
                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                                className={`flex flex-col items-start border px-2.5 py-1.5 text-left transition ${
                                    isSelected
                                        ? 'border-slate-900 bg-slate-900 text-white'
                                        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                                } ${isCurrent && !isSelected ? 'ring-1 ring-slate-400' : ''}`}>
                                <div className="flex w-full items-center justify-between gap-1">
                                    <span className="text-sm font-bold leading-tight">{c}</span>
                                    {isCurrent && (
                                        <span className={`text-[10px] font-medium ${isSelected ? 'text-slate-300' : 'text-slate-500'}`}>
                                            current
                                        </span>
                                    )}
                                </div>
                                {hint !== '' && (
                                    <span className={`truncate text-[11px] leading-tight ${isSelected ? 'text-slate-200' : 'text-slate-500'}`}>
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
                    className={`flex flex-wrap items-center justify-between gap-3 border px-3.5 py-2.5 ${
                        recommendation.recommendedSlot.isPreferred
                            ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                            : 'border-amber-600 bg-amber-50 text-amber-950'
                    }`}>
                    <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                                {recommendation.recommendedSlot.isPreferred
                                    ? 'Preferred Start Time'
                                    : 'Closest to 10-min Spacing'}
                            </span>
                            <span className="bg-emerald-700 px-2 py-0.5 text-base font-bold tabular-nums text-white">
                                {recommendation.recommendedSlot.slot.time}
                            </span>
                        </div>
                        <p className="mt-1 text-xs leading-relaxed text-slate-700">
                            {recommendation.reason}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={() => handlePick(recommendation.recommendedSlot!.slot)}
                        className="shrink-0 border border-emerald-700 bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white hover:bg-emerald-700">
                        Assign recommended
                    </button>
                </div>
            )}

            <div>
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        2. Pick Open Time on {course}{activeHint !== '' ? ` (${activeHint})` : ''}
                        {cutoff !== '' && !showEarlier ? ` from ${cutoff}` : ''}
                    </span>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        {hasAnyConflictSlots && (
                            <span className="text-amber-800">
                                Dashed = &lt;10 min from {recommendation.school} teammate (click to override)
                            </span>
                        )}
                        <span>
                            {openSlots.length} open slot{openSlots.length === 1 ? '' : 's'}
                        </span>
                    </div>
                </div>

                {openSlots.length === 0 ? (
                    <p className="border border-dashed border-slate-300 bg-slate-50 p-4 text-center text-sm italic text-slate-500">
                        No open times here. Try another course{cutoff !== '' && !showEarlier ? ' or include earlier times below' : ''}.
                    </p>
                ) : (
                    <div className="flex max-h-64 flex-wrap gap-2 overflow-auto border border-slate-300 bg-slate-50 p-3">
                        {recommendation.evaluatedSlots.map(({ slot, isPreferred, closestConflict }) => {
                            const isRecommended = slot.id === recommendedId
                            const conflictTitle = closestConflict
                                ? `Within 10 min of ${recommendation.school} teammate ${closestConflict.teammateName} (${closestConflict.teammateTime}, ${closestConflict.gapMinutes} min apart) — click to override`
                                : isRecommended
                                  ? 'Preferred start time (10+ min spacing from same-school teammates)'
                                  : '10+ min spacing from same-school teammates'

                            let btnStyle = 'border-slate-300 bg-white text-slate-900 hover:bg-slate-900 hover:text-white'
                            if (isRecommended && isPreferred) {
                                btnStyle = 'border-2 border-emerald-600 bg-emerald-50 text-emerald-950 hover:bg-emerald-600 hover:text-white'
                            } else if (!isPreferred) {
                                btnStyle = 'border-dashed border-amber-600 bg-amber-50 text-amber-900 hover:bg-amber-600 hover:text-white'
                            }

                            return (
                                <button
                                    key={slot.id}
                                    type="button"
                                    title={conflictTitle}
                                    onClick={() => handlePick(slot)}
                                    className={`border px-3.5 py-2 text-lg font-semibold tabular-nums transition ${btnStyle}`}>
                                    {slot.time}
                                </button>
                            )
                        })}
                    </div>
                )}
            </div>

            {cutoff !== '' && (
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                    <input
                        type="checkbox"
                        checked={showEarlier}
                        onChange={(e) => setShowEarlier(e.target.checked)}
                        className="size-4"
                    />
                    Include times already past call-up (before {cutoff})
                </label>
            )}

            {pending !== undefined && (
                <div className="flex flex-wrap items-center gap-3 border border-amber-600 bg-amber-50 px-3 py-2.5 text-amber-950">
                    <span className="flex-1 text-sm">
                        Move <strong>{participantName}</strong> from <strong>{currentCourse} · {formatSlotTime(currentTime)}</strong> to <strong>{pending.course} · {pending.time}</strong>?
                        This changes their course.
                    </span>
                    <button
                        type="button"
                        className="border border-amber-700 bg-amber-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-amber-700"
                        onClick={() => { const slot = pending; setPending(undefined); onAssign(slot) }}>
                        Confirm move
                    </button>
                    <button
                        type="button"
                        className="border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 hover:bg-slate-100"
                        onClick={() => setPending(undefined)}>
                        Cancel
                    </button>
                </div>
            )}
        </section>
    )
}
