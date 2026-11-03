import { useEffect, useRef, useState } from 'react'
import type { ParticipantDocType, SlotDocType } from '@/Schema'
import { addNewParticipant } from '@/actions/participantActions'
import { courseShortLabel, isMagicTime } from '@/utils/slotLabels'

export interface AddParticipantPrefill {
    name: string
    club: string
    epunch: string
    isRental: boolean
    isNonCompete: boolean
    suggestedCourse?: string
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
    const defaultCourse = prefill?.suggestedCourse && courses.includes(prefill.suggestedCourse)
        ? prefill.suggestedCourse
        : (courses[0] ?? 'c1')

    const [name, setName] = useState(prefill?.name ?? '')
    const [club, setClub] = useState(
        prefill?.club && prefill.club !== 'unknown' && prefill.club !== 'None' ? prefill.club : ''
    )
    const [epunch, setEpunch] = useState(prefill?.epunch ?? '')
    const [isRental, setIsRental] = useState(prefill?.isRental ?? false)
    const [isNonCompete, setIsNonCompete] = useState(prefill?.isNonCompete ?? false)
    const [groupSize, setGroupSize] = useState(1)
    const [course, setCourse] = useState(defaultCourse)
    const [showEarlier, setShowEarlier] = useState(false)
    const [selectedSlotId, setSelectedSlotId] = useState<string>('')
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
                (showEarlier || cutoff === '' || s.time >= cutoff)
        )
        .sort((a, b) => a.time.localeCompare(b.time))

    // Default to the soonest open slot on the chosen course whenever course/cutoff changes
    useEffect(() => {
        if (openSlots.length > 0) {
            setSelectedSlotId((prev) => (openSlots.some((s) => s.id === prev) ? prev : openSlots[0]!.id))
        } else {
            setSelectedSlotId('QUEUE')
        }
    }, [course, showEarlier, cutoff, openSlots.length])

    // Find existing participants matching the typed name so volunteers can 1-click copy
    // school & e-punch when a school racer finishes their first course and runs a second one.
    const trimmedQuery = name.trim().toLowerCase()
    const matchingExisting =
        prefill !== undefined || trimmedQuery.length < 2
            ? []
            : allParticipants
                  .filter((p) => p.name.toLowerCase().includes(trimmedQuery))
                  .slice(0, 3)

    function applyExistingRacer(p: ParticipantDocType) {
        setName(p.name)
        setClub(p.club && p.club !== 'unknown' && p.club !== 'None' ? p.club : '')
        setEpunch(p.epunch ?? '')
        setIsRental(p.isRental)
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
            {prefill !== undefined && (
                <div className="rounded-md border border-sky-700/70 bg-sky-950/60 px-3 py-2 text-sm text-sky-200">
                    Adding another course entry for <strong>{prefill.name}</strong>. Their school and e-punch are pre-filled below.
                </div>
            )}

            {/* 1. Name & School */}
            <div className="grid gap-3 sm:grid-cols-2">
                <div>
                    <label htmlFor="add-p-name" className="block text-sm font-semibold text-gray-200">
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
                        className="mt-1 w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-base text-white placeholder-gray-500 focus:border-pink-500 focus:outline-none"
                    />
                </div>

                <div>
                    <label htmlFor="add-p-club" className="block text-sm font-semibold text-gray-200">
                        School / Club
                    </label>
                    <input
                        id="add-p-club"
                        type="text"
                        list="existing-schools-list"
                        value={club}
                        onChange={(e) => setClub(e.target.value)}
                        placeholder="e.g. Ingraham High (or leave blank)"
                        className="mt-1 w-full rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-base text-white placeholder-gray-500 focus:border-pink-500 focus:outline-none"
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
                <div className="flex flex-col gap-1.5 rounded-md border border-gray-700 bg-gray-900/90 p-2.5">
                    <span className="text-xs font-semibold text-gray-400">
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
                                    className="rounded border border-sky-600/70 bg-sky-950/60 px-2.5 py-1 text-xs font-medium text-sky-200 hover:bg-sky-800 hover:text-white">
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
                    <label htmlFor="add-p-epunch" className="block text-sm font-semibold text-gray-200">
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
                            className="min-w-0 flex-1 rounded-md border border-gray-600 bg-gray-900 px-3 py-2 text-base tabular-nums text-white placeholder-gray-500 focus:border-pink-500 focus:outline-none"
                        />
                        <button
                            type="button"
                            onClick={() => setIsRental(false)}
                            className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                                !isRental
                                    ? 'border-sky-500 bg-sky-800 text-white'
                                    : 'border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}>
                            Own
                        </button>
                        <button
                            type="button"
                            onClick={() => setIsRental(true)}
                            className={`rounded-md border px-2.5 py-1.5 text-xs font-semibold ${
                                isRental
                                    ? 'border-orange-500 bg-orange-700 text-white'
                                    : 'border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700'
                            }`}>
                            Rental
                        </button>
                    </div>
                </div>

                <div className="flex flex-col justify-end gap-2">
                    <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-200">
                        <input
                            type="checkbox"
                            checked={isNonCompete}
                            onChange={(e) => setIsNonCompete(e.target.checked)}
                            className="size-4 rounded"
                        />
                        <span>
                            <strong>Non-competitive (NC)</strong>{' '}
                            <span className="text-xs text-gray-400">(use for 2nd course)</span>
                        </span>
                    </label>

                    <div className="flex items-center gap-2 text-sm text-gray-200">
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
                            className="w-16 rounded border border-gray-600 bg-gray-900 px-2 py-1 text-center text-sm text-white"
                        />
                    </div>
                </div>
            </div>

            {/* 3. Course Selection */}
            <div>
                <span className="block text-sm font-semibold text-gray-200">Select Course *</span>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5 sm:grid-cols-5">
                    {courses.map((c) => {
                        const hint = courseShortLabel(c)
                        const active = c === course
                        return (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setCourse(c)}
                                className={`flex flex-col items-start rounded-md border px-2.5 py-1.5 text-left transition ${
                                    active
                                        ? 'border-pink-500 bg-pink-800 text-white'
                                        : 'border-gray-700 bg-gray-900 text-gray-200 hover:bg-gray-700'
                                }`}>
                                <span className="text-sm font-bold leading-tight">{c}</span>
                                {hint !== '' && (
                                    <span className={`truncate text-[11px] leading-tight ${active ? 'text-pink-100' : 'text-gray-400'}`}>
                                        {hint}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* 4. Start Time Selection */}
            <div className="rounded-md border border-gray-700 bg-gray-900 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-gray-200">
                        Assign Start Time on {course}
                    </span>
                    <button
                        type="button"
                        onClick={() => setSelectedSlotId('QUEUE')}
                        className={`rounded border px-2.5 py-1 text-xs font-semibold ${
                            selectedSlotId === 'QUEUE'
                                ? 'border-orange-500 bg-orange-700 text-white'
                                : 'border-gray-600 bg-gray-800 text-gray-300 hover:bg-gray-700'
                        }`}>
                        Assign later (Needs new time queue)
                    </button>
                </div>

                {openSlots.length === 0 ? (
                    <p className="mt-2 text-xs italic text-gray-400">
                        No open start slots on {course}{cutoff !== '' && !showEarlier ? ` after ${cutoff}` : ''}. Will be placed in the "Needs a new time" queue.
                    </p>
                ) : (
                    <div className="mt-2 flex max-h-32 flex-wrap gap-1.5 overflow-auto">
                        {openSlots.map((slot) => {
                            const picked = slot.id === selectedSlotId
                            return (
                                <button
                                    key={slot.id}
                                    type="button"
                                    onClick={() => setSelectedSlotId(slot.id)}
                                    className={`rounded border px-2.5 py-1 text-sm font-semibold tabular-nums ${
                                        picked
                                            ? 'border-amber-400 bg-amber-600 text-white'
                                            : 'border-gray-600 bg-gray-800 text-gray-200 hover:bg-gray-700'
                                    }`}>
                                    {slot.time}
                                </button>
                            )
                        })}
                    </div>
                )}

                {cutoff !== '' && (
                    <label className="mt-2 flex items-center gap-2 text-xs text-gray-400">
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
                <div role="alert" className="rounded-md border border-red-600 bg-red-950/90 px-3 py-2 text-sm text-red-200">
                    {errorMsg}
                </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-md border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-700">
                    Cancel
                </button>
                <button
                    type="submit"
                    disabled={isSubmitting}
                    className="rounded-md bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow hover:bg-emerald-500 disabled:opacity-50">
                    {isSubmitting ? 'Adding…' : 'Add to Meet'}
                </button>
            </div>
        </form>
    )
}
