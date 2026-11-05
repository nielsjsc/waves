import { useEffect, useRef, useState } from 'react'
import type { ParticipantDocType, SlotDocType } from '@/Schema'
import { addNewParticipant } from '@/actions/participantActions'
import { courseShortLabel, evaluateStartTimesForSchool, isMagicTime } from '@/utils/slotLabels'

export interface AddParticipantPrefill {
    name: string
    club: string
    epunch: string
    isRental: boolean
    isNonCompete: boolean
    suggestedCourse?: string
    targetSlotId?: string
    targetTime?: string
}

interface Properties {
    allParticipants: ParticipantDocType[]
    allSlots: SlotDocType[]
    cutoff: string
    prefill?: AddParticipantPrefill
    onCreated: (participantId: string, summary: string) => void
    onClose: () => void
}

export function AddParticipantModal({
    allParticipants,
    allSlots,
    cutoff,
    prefill,
    onCreated,
    onClose,
}: Properties) {
    const courses = [...new Set(allSlots.map((s) => s.course))].sort()
    const defaultCourse =
        prefill?.suggestedCourse && courses.includes(prefill.suggestedCourse)
            ? prefill.suggestedCourse
            : (courses[0] ?? 'c1')

    const [name, setName] = useState(prefill?.name ?? '')
    const [club, setClub] = useState(
        prefill?.club && prefill.club !== 'unknown' && prefill.club !== 'None' ? prefill.club : ''
    )
    const [epunch, setEpunch] = useState(prefill?.epunch ?? '')
    const [isRental, setIsRental] = useState(prefill?.isRental ?? (prefill?.isNonCompete ? true : false))
    const [isNonCompete, setIsNonCompete] = useState(prefill?.isNonCompete ?? false)
    const [groupSize, setGroupSize] = useState(1)
    const [course, setCourse] = useState(defaultCourse)
    const [showEarlier, setShowEarlier] = useState(() => {
        if (prefill?.targetTime && cutoff !== '' && prefill.targetTime < cutoff) {
            return true
        }
        return false
    })
    const [selectedSlotId, setSelectedSlotId] = useState<string>(prefill?.targetSlotId ?? '')
    const [errorMsg, setErrorMsg] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)

    const nameInputRef = useRef<HTMLInputElement>(null)
    useEffect(() => {
        nameInputRef.current?.focus()
    }, [])

    // Gather existing schools/clubs for autocomplete suggestions
    const existingSchools = [
        ...new Set(
            allParticipants
                .map((p) => p.club ?? '')
                .filter((c) => c !== '' && c !== 'unknown' && c !== 'None')
        ),
    ].sort()

    // Open start slots on the selected course
    const openSlots = allSlots
        .filter(
            (s) =>
                s.course === course &&
                !isMagicTime(s.time) &&
                s.isUsable !== false &&
                s.participants.length === 0 &&
                (showEarlier || cutoff === '' || s.time >= cutoff || s.id === prefill?.targetSlotId)
        )
        .sort((a, b) => a.time.localeCompare(b.time))

    const recommendation = evaluateStartTimesForSchool({
        openSlots,
        allSlots,
        allParticipants,
        course,
        participantClub: club,
    })

    const recommendedSlotId = recommendation.recommendedSlot?.slot.id

    // Default to explicit targetSlotId (when clicked on FullGrid) or the recommended open slot
    useEffect(() => {
        if (prefill?.targetSlotId && course === prefill.suggestedCourse && openSlots.some((s) => s.id === prefill.targetSlotId)) {
            setSelectedSlotId(prefill.targetSlotId)
        } else if (recommendedSlotId !== undefined) {
            setSelectedSlotId(recommendedSlotId)
        } else if (openSlots.length > 0) {
            setSelectedSlotId(openSlots[0]!.id)
        } else {
            setSelectedSlotId('QUEUE')
        }
    }, [course, club, showEarlier, cutoff, recommendedSlotId, openSlots.length, prefill?.targetSlotId, prefill?.suggestedCourse])

    // Find existing participants matching the typed name so volunteers can 1-click copy
    // school & e-punch when a school racer finishes their first course and runs a second one.
    const trimmedQuery = name.trim().toLowerCase()
    const matchingExisting =
        (prefill?.name ?? '') !== '' || trimmedQuery.length < 2
            ? []
            : allParticipants
                  .filter((p) => p.name.toLowerCase().includes(trimmedQuery))
                  .slice(0, 3)

    function applyExistingRacer(p: ParticipantDocType) {
        setName(p.name)
        setClub(p.club && p.club !== 'unknown' && p.club !== 'None' ? p.club : '')
        setEpunch(p.epunch ?? '')
        // Default to rental e-punch for a 2nd course
        setIsRental(true)
        setIsNonCompete(true)
        setErrorMsg('')
    }

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault()
        const cleanName = name.trim()
        const cleanEpunch = epunch.trim()

        if (cleanName === '') {
            setErrorMsg('Please enter the participant’s name.')
            return
        }
        if (cleanEpunch !== '' && !/^\d+$/.test(cleanEpunch)) {
            setErrorMsg('E-punch must contain only digits (or leave blank if none).')
            return
        }
        if (course === '') {
            setErrorMsg('Please select a course.')
            return
        }

        setIsSubmitting(true)
        setErrorMsg('')

        const targetSlotId = selectedSlotId === 'QUEUE' ? undefined : selectedSlotId
        const chosenSlot = targetSlotId ? allSlots.find((s) => s.id === targetSlotId) : undefined

        const createdId = await addNewParticipant({
            name: cleanName,
            course,
            club: club.trim(),
            epunch: cleanEpunch,
            isRental,
            isNonCompete,
            groupSize,
            targetSlotId,
        })

        setIsSubmitting(false)

        if (createdId === undefined) {
            setErrorMsg('Could not add participant. Please check the course selection and try again.')
            return
        }

        const whereLabel = chosenSlot ? `${course} · ${chosenSlot.time}` : `${course} (Needs new time)`
        onCreated(createdId, `Added ${cleanName} to ${whereLabel}`)
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left text-slate-900">
            {prefill !== undefined && prefill.name !== '' && (
                <div className="border border-sky-300 bg-sky-50 px-3 py-2 text-sm text-sky-900">
                    Adding another course entry for <strong>{prefill.name}</strong>. Their school and e-punch are pre-filled below (defaulted to Rental e-punch).
                </div>
            )}
            {prefill?.targetSlotId !== undefined && prefill.name === '' && (
                <div className="border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
                    Adding participant directly to open start slot <strong>{prefill.suggestedCourse} · {prefill.targetTime}</strong>.
                </div>
            )}

            {/* 1. Name & School */}
            <div className="grid gap-3 sm:grid-cols-2">
                <div>
                    <label htmlFor="add-p-name" className="block text-sm font-semibold text-slate-800">
                        Runner Name *
                    </label>
                    <input
                        ref={nameInputRef}
                        id="add-p-name"
                        type="text"
                        value={name}
                        onChange={(e) => {
                            setName(e.target.value)
                            if (errorMsg) setErrorMsg('')
                        }}
                        placeholder="e.g. Alex Smith"
                        className="mt-1 w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
                    />
                </div>

                <div>
                    <label htmlFor="add-p-club" className="block text-sm font-semibold text-slate-800">
                        School / Club
                    </label>
                    <input
                        id="add-p-club"
                        type="text"
                        list="existing-schools-list"
                        value={club}
                        onChange={(e) => setClub(e.target.value)}
                        placeholder="e.g. Ingraham High (or leave blank)"
                        className="mt-1 w-full rounded-none border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
                    />
                    <datalist id="existing-schools-list">
                        {existingSchools.map((s) => (
                            <option key={s} value={s} />
                        ))}
                    </datalist>
                </div>
            </div>

            {/* Quick-fill from existing racer if name matches */}
            {matchingExisting.length > 0 && (
                <div className="flex flex-col gap-1.5 border border-slate-300 bg-slate-50 p-2.5">
                    <span className="text-xs font-semibold text-slate-600">
                        Already in meet? Click to copy their school &amp; e-punch for a 2nd course:
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                        {matchingExisting.map((m) => {
                            const mClub = m.club && m.club !== 'unknown' && m.club !== 'None' ? m.club : 'Independent'
                            return (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => applyExistingRacer(m)}
                                    className="border border-sky-600 bg-white px-2.5 py-1 text-xs font-medium text-sky-800 hover:bg-sky-600 hover:text-white">
                                    {m.name} ({mClub}{m.epunch ? ` · E-punch ${m.epunch}` : ''})
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* 2. E-punch, Rental, Non-Compete, Group Size */}
            <div className="grid gap-3 sm:grid-cols-2">
                <div>
                    <label htmlFor="add-p-epunch" className="block text-sm font-semibold text-slate-800">
                        E-punch Number
                    </label>
                    <div className="mt-1 flex gap-2">
                        <input
                            id="add-p-epunch"
                            type="text"
                            inputMode="numeric"
                            value={epunch}
                            onChange={(e) => {
                                setEpunch(e.target.value)
                                if (errorMsg) setErrorMsg('')
                            }}
                            placeholder="e.g. 8654321"
                            className="min-w-0 flex-1 rounded-none border border-slate-300 bg-white px-3 py-2 text-base tabular-nums text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => setIsRental(false)}
                            className={`border px-2.5 py-1.5 text-xs font-semibold ${
                                !isRental
                                    ? 'border-sky-700 bg-sky-700 text-white'
                                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                            }`}>
                            Own
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsRental(true)}
                            className={`border px-2.5 py-1.5 text-xs font-semibold ${
                                isRental
                                    ? 'border-orange-700 bg-orange-600 text-white'
                                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                            }`}>
                            Rental
                        </button>
                    </div>
                </div>

                <div className="flex flex-col justify-end gap-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-800">
                        <input
                            type="checkbox"
                            checked={isNonCompete}
                            onChange={(e) => {
                                const checked = e.target.checked
                                setIsNonCompete(checked)
                                if (checked) {
                                    setIsRental(true)
                                }
                            }}
                            className="size-4"
                        />
                        <span>
                            <strong>Non-competitive (NC)</strong>{' '}
                            <span className="text-xs text-slate-500">(use for 2nd course)</span>
                        </span>
                    </label>

                    <div className="flex items-center gap-2 text-sm text-slate-800">
                        <label htmlFor="add-p-groupsize" className="font-medium">
                            Group size:
                        </label>
                        <input
                            id="add-p-groupsize"
                            type="number"
                            min={1}
                            max={50}
                            value={groupSize}
                            onChange={(e) => setGroupSize(Math.max(1, parseInt(e.target.value, 10) || 1))}
                            className="w-16 rounded-none border border-slate-300 bg-white px-2 py-1 text-center text-sm text-slate-900"
                        />
                    </div>
                </div>
            </div>

            {/* 3. Course Selection */}
            <div>
                <span className="block text-sm font-semibold text-slate-800">Select Course *</span>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                    {courses.map((c) => {
                        const hint = courseShortLabel(c)
                        const active = c === course
                        return (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setCourse(c)}
                                className={`flex flex-col items-start border px-2.5 py-1.5 text-left transition ${
                                    active
                                        ? 'border-slate-900 bg-slate-900 text-white'
                                        : 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                                }`}>
                                <span className="text-sm font-bold leading-tight">{c}</span>
                                {hint !== '' && (
                                    <span className={`truncate text-[11px] leading-tight ${active ? 'text-slate-200' : 'text-slate-500'}`}>
                                        {hint}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* 4. Start Time Selection */}
            <div className="border border-slate-300 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-slate-800">
                        Assign Start Time on {course}
                    </span>
                    <button
                        type="button"
                        onClick={() => setSelectedSlotId('QUEUE')}
                        className={`border px-2.5 py-1 text-xs font-semibold ${
                            selectedSlotId === 'QUEUE'
                                ? 'border-orange-700 bg-orange-600 text-white'
                                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                        }`}>
                        Assign later (Needs new time queue)
                    </button>
                </div>

                {recommendation.recommendedSlot !== undefined && (
                    <p className="mt-1.5 text-xs text-emerald-800">
                        <strong>Preferred ({recommendation.recommendedSlot.slot.time}):</strong> {recommendation.reason}
                    </p>
                )}

                {openSlots.length === 0 ? (
                    <p className="mt-2 text-xs italic text-slate-600">
                        No open start slots on {course}{cutoff !== '' && !showEarlier ? ` after ${cutoff}` : ''}. Will be placed in the "Needs a new time" queue.
                    </p>
                ) : (
                    <div className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-auto">
                        {recommendation.evaluatedSlots.map(({ slot, isPreferred, closestConflict }) => {
                            const picked = slot.id === selectedSlotId
                            const isRecommended = slot.id === recommendedSlotId
                            const conflictTitle = closestConflict
                                ? `Within 10 min of ${recommendation.school} teammate ${closestConflict.teammateName} (${closestConflict.teammateTime}, ${closestConflict.gapMinutes} min apart) — click to override`
                                : '10+ min spacing from same-school teammates'

                            let btnClass = 'border-slate-300 bg-white text-slate-800 hover:bg-slate-100'
                            if (picked) {
                                btnClass = 'border-slate-900 bg-slate-900 text-white'
                            } else if (isRecommended && isPreferred) {
                                btnClass = 'border-emerald-600 bg-emerald-50 text-emerald-900 hover:bg-emerald-100'
                            } else if (!isPreferred) {
                                btnClass = 'border-dashed border-amber-600 bg-amber-50 text-amber-900 hover:bg-amber-100'
                            }

                            return (
                                <button
                                    key={slot.id}
                                    type="button"
                                    title={conflictTitle}
                                    onClick={() => setSelectedSlotId(slot.id)}
                                    className={`border px-2.5 py-1 text-sm font-semibold tabular-nums ${btnClass}`}>
                                    {slot.time}
                                </button>
                            )
                        })}
                    </div>
                )}

                {cutoff !== '' && (
                    <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                        <input
                            type="checkbox"
                            checked={showEarlier}
                            onChange={(e) => setShowEarlier(e.target.checked)}
                        />
                        Include times already past call-up (before {cutoff})
                    </label>
                )}
            </div>

            {errorMsg !== '' && (
                <div role="alert" className="border border-red-600 bg-red-50 px-3 py-2 text-sm text-red-900">
                    {errorMsg}
                </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
                <button
                    type="button"
                    onClick={onClose}
                    className="border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100">
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="border border-emerald-700 bg-emerald-600 px-5 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-50">
                    {isSubmitting ? 'Adding…' : 'Add to Meet'}
                </button>
            </div>
        </form>
    )
}
