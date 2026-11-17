import { useEffect, useRef, useState, type ReactNode } from "react"
import { useLiveQuery } from "@tanstack/react-db"
import { changesTanCollection, participantsTanCollection, slotsTanCollection } from "@/database"
import type { SlotDocType } from "@/Schema"
import type { ParticipantState } from "@/api/participants"
import type { PopulatedEntry } from "@/utils/PopulatedEntry"
import { Head } from "@/components/Head"
import { Modal } from "@/components/Modal"
import { EditEpunchModal } from "@/components/EditEpunchModal"
import { EditGroupSizeModal } from "@/components/EditGroupSizeModal"
import { RentCompassModal } from "@/components/RentCompassModal"
import { ManagerActionButton } from "@/components/ManagerActionButton"
import { StartGrid } from "@/components/grid/StartGrid"
import { ManagerSearchBox } from "@/components/manager/ManagerSearchBox"
import { AttentionQueue } from "@/components/manager/AttentionQueue"
import { OpenTimesPicker } from "@/components/manager/OpenTimesPicker"
import { AddParticipantModal, type AddParticipantPrefill } from "@/components/manager/AddParticipantModal"
import { hydrateParticipant } from "@/utils/hydrateParticipant"
import { populateSlotData } from "@/utils/populateSlotData"
import { getOriginalEpunch, getOriginalStart } from "@/utils/originalValues"
import { addMinutesToClock, courseShortLabel, findStandbyMatches, formatSlotTime, isMagicTime } from "@/utils/slotLabels"
import { getDisplayStates, hasNoShow, hasWrongEpunch, ParticipantStateStyles, getColorByIconName } from "@/utils/styleHelpers"
import { keepOnlyInSlot, putInNeedsAssignment } from "@/actions/repairActions"
import {
    assignStandbyToNoShowSlot,
    clearStateNoShow,
    setCompetitive,
    setGroupSize,
    setHasRentedCompass,
    setNeedsPayment,
    setNeedsWaiver,
    setNewEpunch,
    setNewStartTime,
    setNonCompetitive,
    setParticipantEligible,
    setStateNeedsAssignment,
    setStateNoShow,
    setStateNotAttending,
    setStatePresent,
    setStateValidated,
    setStateWaiting,
    setStateWrongEpunch,
    undoAssignStandbyToNoShowSlot,
} from "@/actions/participantActions"

const UNDO_VISIBLE_MS = 3500

interface Properties {
    clockTime: string
    waveOffsetMinutes: number
    selectedParticipantId: string
    setSelectedParticipantId: (id: string) => void
}

interface Snapshot {
    slotId: string
    slotTime: string
    state: ParticipantState
    prevState?: ParticipantState
}

interface UndoInfo {
    message: string
    run?: () => Promise<void>
}

async function applyState(participantId: string, state: ParticipantState, prevState?: ParticipantState) {
    if ((state === 'wrongEpunch' && prevState === 'noShow') || (state === 'noShow' && prevState === 'wrongEpunch')) {
        await setStateWaiting(participantId)
        await setStateNoShow(participantId)
        await setStateWrongEpunch(participantId)
        return
    }
    await setStateWaiting(participantId)
    switch (state) {
        case 'waiting': return
        case 'present': return setStatePresent(participantId)
        case 'validated': return setStateValidated(participantId)
        case 'wrongEpunch': return setStateWrongEpunch(participantId)
        case 'noShow': return setStateNoShow(participantId)
        case 'notAttending': return setStateNotAttending(participantId)
        case 'needsAssignment': return setStateNeedsAssignment(participantId)
        default: return
    }
}

async function restoreSnapshot(participantId: string, snapshot: Snapshot, current: PopulatedEntry | undefined) {
    if (current === undefined) {
        alert("Can't undo right now: this record isn't in exactly one slot. Wait a moment and try again.")
        return
    }
    if (
        current.slotId === snapshot.slotId &&
        current.participant.state === snapshot.state &&
        current.participant.prevState === snapshot.prevState
    ) {
        return
    }
    if (!isMagicTime(snapshot.slotTime) && current.slotId !== snapshot.slotId) {
        await setNewStartTime(participantId, current.slotId, snapshot.slotId)
    }
    await applyState(participantId, snapshot.state, snapshot.prevState)
}

function Pill({ className, children }: { className: string; children: ReactNode }) {
    return <span className={`border px-2 py-0.5 text-xs font-semibold ${className}`}>{children}</span>
}

function nextHarderCourse(currentCourse: string, courses: string[]): string {
    const idx = courses.indexOf(currentCourse)
    if (idx >= 0 && idx + 1 < courses.length) {
        return courses[idx + 1]!
    }
    return currentCourse
}

function RecordProblem({ name, slots, courses, onKeep, onPlace }: {
    name: string
    slots: SlotDocType[]
    courses: string[]
    onKeep: (slot: SlotDocType) => void
    onPlace: (course: string) => void
}) {
    return (
        <div className="flex flex-col gap-3 border-2 border-red-600 bg-red-50 p-4 text-red-950">
            <h3 className="text-base font-bold">Record Issue: {name}</h3>
            {slots.length === 0 ? (
                <>
                    <p className="text-xs">
                        Not in a start slot. Assign to standby queue:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {courses.map((c) => (
                            <button
                                key={c}
                                type="button"
                                onClick={() => onPlace(c)}
                                className="min-h-10 sm:min-h-0 border border-red-700 bg-red-700 px-3 py-1.5 sm:py-1 text-xs font-semibold text-white hover:bg-red-800">
                                {c}
                            </button>
                        ))}
                    </div>
                </>
            ) : (
                <>
                    <p className="text-xs">Listed in {slots.length} slots. Select slot to keep:</p>
                    <div className="flex flex-col gap-2">
                        {slots.map((slot) => (
                            <div key={slot.id} className="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 text-xs">
                                <span className="font-medium">{slot.course} · {formatSlotTime(slot.time)}</span>
                                <button
                                    type="button"
                                    onClick={() => onKeep(slot)}
                                    className="w-full sm:w-auto min-h-10 sm:min-h-0 border border-red-700 bg-red-700 px-3 py-1.5 sm:py-1 text-xs font-semibold text-white hover:bg-red-800">
                                    Keep this slot
                                </button>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

export function Manager({ clockTime, waveOffsetMinutes, selectedParticipantId, setSelectedParticipantId }: Properties) {
    const [isEpunchEditOpen, setEpunchEditOpen] = useState(false)
    const [isGroupSizeEditOpen, setGroupSizeEditOpen] = useState(false)
    const [isRentCompassOpen, setRentCompassOpen] = useState(false)
    const [addParticipantPrefill, setAddParticipantPrefill] = useState<AddParticipantPrefill | null | undefined>(undefined)
    const [confirmNotAttending, setConfirmNotAttending] = useState(false)
    const [timePickerOpen, setTimePickerOpen] = useState(false)
    const [timelineOpen, setTimelineOpen] = useState(false)
    const [focusToken, setFocusToken] = useState(0)
    const [undo, setUndo] = useState<UndoInfo | undefined>(undefined)
    const [restoreNote, setRestoreNote] = useState('')
    const [dismissedStandbyKeys, setDismissedStandbyKeys] = useState<Set<string>>(() => new Set())

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
    const dataRef = useRef(DATA)
    dataRef.current = DATA

    const slotsByParticipant = new Map<string, SlotDocType[]>()
    for (const slot of allSlots) {
        for (const pid of slot.participants) {
            const list = slotsByParticipant.get(pid)
            if (list === undefined) { slotsByParticipant.set(pid, [slot]) } else { list.push(slot) }
        }
    }
    const courses = [...new Set(allSlots.map((s) => s.course))].sort()

    const selectedDoc = selectedParticipantId === '' ? undefined : allParticipants.find((p) => p.id === selectedParticipantId)
    const selectedSlots = selectedDoc === undefined ? [] : (slotsByParticipant.get(selectedDoc.id) ?? [])
    const entry = selectedDoc !== undefined && selectedSlots.length === 1 ? hydrateParticipant(selectedDoc.id, DATA) : undefined

    const cutoff = addMinutesToClock(clockTime, waveOffsetMinutes)

    useEffect(() => {
        setConfirmNotAttending(false)
        setEpunchEditOpen(false)
        setGroupSizeEditOpen(false)
        setRestoreNote('')
    }, [selectedParticipantId])

    useEffect(() => {
        if (undo === undefined) { return }
        const timer = setTimeout(() => setUndo(undefined), UNDO_VISIBLE_MS)
        return () => clearTimeout(timer)
    }, [undo])

    const scrollToRef = useRef<HTMLTableRowElement>(null)
    useEffect(() => {
        if (timelineOpen && scrollToRef.current !== null) {
            scrollToRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
        }
    }, [timelineOpen, selectedParticipantId, entry?.slotId])

    function selectParticipant(id: string, openPicker = false) {
        setSelectedParticipantId(id)
        setTimePickerOpen(openPicker)
    }

    function clearSelection() {
        setSelectedParticipantId('')
        setFocusToken((t) => t + 1)
    }

    async function runWithUndo(message: string, action: () => Promise<unknown>, alsoUndo?: () => Promise<unknown>) {
        if (entry === undefined) { return }
        const id = entry.participant.id
        const snapshot: Snapshot = {
            slotId: entry.slotId,
            slotTime: entry.time,
            state: entry.participant.state,
            prevState: entry.participant.prevState,
        }
        await action()
        setUndo({
            message,
            run: async () => {
                await restoreSnapshot(id, snapshot, hydrateParticipant(id, dataRef.current))
                await alsoUndo?.()
            },
        })
    }

    function handleAssign(slot: SlotDocType) {
        if (entry === undefined) { return }
        setTimePickerOpen(false)
        void runWithUndo(
            `${entry.participant.name} moved to ${slot.course} · ${slot.time}`,
            () => setNewStartTime(entry.participant.id, entry.slotId, slot.id)
        )
    }

    function handlePlaceInQueue(course: string) {
        const magic = allSlots.find((s) => s.course === course && s.time === '_needsAssignment')
        if (selectedDoc === undefined || magic === undefined) {
            alert(`Couldn't find the standby queue for ${course}.`)
            return
        }
        void putInNeedsAssignment(selectedDoc.id, magic)
    }

    async function handleSlotStandbyRunner(
        standbyParticipantId: string,
        standbyName: string,
        noShowParticipantId: string,
        slot: SlotDocType
    ) {
        const ok = await assignStandbyToNoShowSlot(standbyParticipantId, noShowParticipantId, slot.id)
        if (!ok) return
        setUndo({
            message: `${standbyName} slotted into ${slot.course} · ${slot.time} as Present — send to E-punch Check`,
            run: async () => {
                await undoAssignStandbyToNoShowSlot(standbyParticipantId, noShowParticipantId, slot.id)
            },
        })
    }

    const allStandbyMatches = findStandbyMatches(allParticipants, allSlots, allChanges)
    const standbyMatches = allStandbyMatches.filter(
        (m) => !dismissedStandbyKeys.has(`${m.slot.id}|${m.noShowParticipant.id}`)
    )

    const standbyNotificationBanner =
        standbyMatches.length === 0 ? null : (
            <section
                role="region"
                aria-label="Standby slot notifications"
                className="flex flex-col gap-2 border-2 border-orange-600 bg-orange-50 p-3 text-slate-900">
                <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold uppercase tracking-wide text-orange-950">
                        Standby Slot Available ({standbyMatches.length})
                    </h3>
                </div>
                <div className="flex flex-col gap-1.5">
                    {standbyMatches.map((m) => {
                        const key = `${m.slot.id}|${m.noShowParticipant.id}`
                        const hint = courseShortLabel(m.course)
                        const courseLabel = hint !== '' ? `${m.course} (${hint})` : m.course
                        const priorityRunner = m.priorityStandbyParticipant
                        const conflict = m.conflictsByStandbyId[priorityRunner.id]
                        return (
                            <div
                                key={key}
                                className="flex flex-wrap items-center justify-between gap-2.5 border border-orange-500 bg-white px-3 py-2">
                                <div className="min-w-0">
                                    <div className="text-sm font-bold text-slate-900">
                                        Course {courseLabel} · {m.slot.time}
                                    </div>
                                    <div className="text-xs text-slate-600">
                                        No-show: <strong>{m.noShowParticipant.name}</strong>
                                        {conflict !== undefined && (
                                            <span className="ml-2 font-semibold text-amber-800">
                                                · &lt;6 min from {conflict.teammateName} ({conflict.teammateTime})
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex w-full sm:w-auto flex-wrap items-center gap-1.5">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            void handleSlotStandbyRunner(
                                                priorityRunner.id,
                                                priorityRunner.name,
                                                m.noShowParticipant.id,
                                                m.slot
                                            )
                                        }
                                        className="flex-1 sm:flex-initial min-h-10 sm:min-h-0 border border-emerald-700 bg-emerald-600 px-3 py-1.5 sm:py-1 text-xs font-bold text-white hover:bg-emerald-700">
                                        Assign {priorityRunner.name}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setDismissedStandbyKeys((prev) => {
                                                const next = new Set(prev)
                                                next.add(key)
                                                return next
                                            })
                                        }
                                        className="flex-1 sm:flex-initial min-h-10 sm:min-h-0 border border-slate-300 bg-white px-2.5 py-1.5 sm:py-1 text-xs font-semibold text-slate-700 hover:bg-slate-100">
                                        Dismiss
                                    </button>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </section>
        )

    const undoBanner = undo === undefined ? null : (
        <div className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-xl items-center gap-3 border-2 border-slate-900 bg-white px-4 py-3 text-slate-900 shadow-xl">
            <span className="flex-1 text-sm sm:text-base font-medium">{undo.message}</span>
            {undo.run !== undefined && (
                <button
                    type="button"
                    className="min-h-10 sm:min-h-0 border border-slate-900 bg-slate-900 px-3.5 py-1.5 sm:py-1 font-semibold text-white hover:bg-slate-800"
                    onClick={async () => { await undo.run?.(); setUndo(undefined) }}>
                    Undo
                </button>
            )}
        </div>
    )

    function renderDetail(e: PopulatedEntry) {
        const p = e.participant
        const displayStates = getDisplayStates(p)
        const inRealSlot = !isMagicTime(e.time)
        const club = p.club === '' || p.club === 'unknown' || p.club === 'None' ? '' : p.club
        const courseHint = courseShortLabel(e.course)
        const courseWithHint = courseHint !== '' ? `${e.course} (${courseHint})` : e.course
        const where = inRealSlot
            ? `Course ${courseWithHint} · ${e.time}`
            : hasNoShow(p)
              ? `Standby · Course ${courseWithHint}`
              : `${formatSlotTime(e.time)} · Course ${courseWithHint}`
        const originally = p.startChanged && p.originalStartTime !== '' && p.originalStartTime !== e.time
            ? `Originally ${p.originalStartTime}`
            : ''

        const originalStart = getOriginalStart(p.id, p.originalStartTime, e.course, allChanges)
        const startDiffers = originalStart !== undefined && (e.course !== originalStart.course || e.time !== originalStart.time)
        const originalEpunch = getOriginalEpunch(p.id, allChanges)
        const epunchDiffers = originalEpunch !== undefined &&
            (originalEpunch.epunch !== p.epunch || (originalEpunch.isRental !== undefined && originalEpunch.isRental !== p.isRental))
        const noEpunch = (value: string) => (value === '' ? 'none' : value)

        function findRestorableSlot(): SlotDocType | undefined {
            if (originalStart === undefined) { return undefined }
            const label = `${originalStart.course} · ${originalStart.time}`
            const target = allSlots.find((s) => s.course === originalStart.course && s.time === originalStart.time)
            if (target === undefined || target.isUsable === false) {
                setRestoreNote(`The original slot (${label}) isn't available any more. Pick a new time instead.`)
                return undefined
            }
            const others = target.participants.filter((id) => id !== p.id)
            if (others.length > 0) {
                const names = others.map((id) => allParticipants.find((x) => x.id === id)?.name ?? 'someone').join(', ')
                setRestoreNote(`${label} is now taken by ${names}. Pick a new time instead.`)
                return undefined
            }
            return target
        }

        function handleRestoreStart() {
            setRestoreNote('')
            const target = findRestorableSlot()
            if (target === undefined || originalStart === undefined) { return }
            void runWithUndo(
                `${p.name} restored to ${originalStart.course} · ${originalStart.time}`,
                () => setNewStartTime(p.id, e.slotId, target.id)
            )
        }

        function handleRestoreEpunch() {
            if (originalEpunch === undefined) { return }
            const before = { epunch: p.epunch, isRental: p.isRental }
            void runWithUndo(
                `${p.name}'s e-punch restored to ${noEpunch(originalEpunch.epunch)}`,
                () => setNewEpunch(p.id, originalEpunch.epunch, originalEpunch.isRental ?? p.isRental),
                () => setNewEpunch(p.id, before.epunch, before.isRental)
            )
        }

        function handleRestoreAll() {
            setRestoreNote('')
            const target = startDiffers ? findRestorableSlot() : undefined
            const epunchTarget = epunchDiffers ? originalEpunch : undefined
            if (target === undefined && epunchTarget === undefined) { return }
            const before = { epunch: p.epunch, isRental: p.isRental }
            const parts: string[] = []
            if (target !== undefined && originalStart !== undefined) { parts.push(`${originalStart.course} · ${originalStart.time}`) }
            if (epunchTarget !== undefined) { parts.push(`e-punch ${noEpunch(epunchTarget.epunch)}`) }
            void runWithUndo(
                `${p.name} restored to the original: ${parts.join(', ')}`,
                async () => {
                    if (target !== undefined) { await setNewStartTime(p.id, e.slotId, target.id) }
                    if (epunchTarget !== undefined) { await setNewEpunch(p.id, epunchTarget.epunch, epunchTarget.isRental ?? p.isRental) }
                },
                epunchTarget === undefined ? undefined : () => setNewEpunch(p.id, before.epunch, before.isRental)
            )
        }

        return (
            <div className="flex flex-col gap-4">
                <div className={timePickerOpen ? "grid gap-4 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]" : "flex max-w-2xl flex-col gap-4"}>
                    <div className="flex flex-col gap-4">
                        {/* Participant Summary Card */}
                        <div className="border border-slate-300 bg-white p-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-2xl font-bold text-slate-900">{p.name}</h2>
                                {p.isSecondCourse && <Pill className="border-purple-600 bg-purple-50 text-purple-800">2nd course</Pill>}
                                {p.needsWaiver && (
                                    <span className="border-2 border-red-800 bg-red-600 px-3 py-1 text-sm sm:text-base font-extrabold text-white">
                                        Hasn&apos;t signed shadow waiver (N)
                                    </span>
                                )}
                                {p.needsPayment && (
                                    <span className="border-2 border-red-800 bg-red-600 px-3 py-1 text-sm sm:text-base font-extrabold text-white">
                                        Needs payment (Need $)
                                    </span>
                                )}
                                {p.groupSize > 1 && <Pill className="border-emerald-600 bg-emerald-50 text-emerald-800">Group {p.groupSize}</Pill>}
                                {p.isNonCompete && <Pill className="border-indigo-600 bg-indigo-50 text-indigo-800">Non-competitive</Pill>}
                                {p.isRental && <Pill className="border-orange-600 bg-orange-50 text-orange-800">Rental e-punch</Pill>}
                                {p.hasRentedCompass && (
                                    <Pill className="border-amber-700 bg-amber-100 text-amber-950 font-mono">
                                        {p.compassId ? `Compass #${p.compassId}` : 'Compass rented'}
                                    </Pill>
                                )}
                                {displayStates.map((st) => {
                                    const stStyle = ParticipantStateStyles.get(st)
                                    if (!stStyle) return null
                                    return (
                                        <span key={st} className={`px-3 py-1 text-sm sm:text-base font-extrabold text-white ${stStyle.bg}`}>
                                            {stStyle.friendlyName}
                                        </span>
                                    )
                                })}
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                                <span>{club !== '' ? club : 'Independent'} ·</span>
                                <span
                                    className={
                                        hasWrongEpunch(p)
                                            ? 'border-2 border-pink-600 bg-pink-100 px-2.5 py-1 text-base font-extrabold text-pink-950'
                                            : ''
                                    }>
                                    E-punch{' '}
                                    <strong className="font-bold tabular-nums text-slate-900">
                                        {p.epunch === '' ? 'none' : p.epunch}
                                    </strong>
                                </span>
                            </div>
                            <div
                                className={`mt-3 px-3 py-2 ${
                                    hasNoShow(p)
                                        ? 'border-2 border-red-600 bg-red-50'
                                        : p.state === 'needsAssignment'
                                          ? 'border-2 border-orange-600 bg-orange-50'
                                          : 'border border-slate-300 bg-slate-50'
                                }`}>
                                <div className="text-lg font-bold text-slate-900">{where}</div>
                                {originally !== '' && <div className="text-sm font-medium text-amber-800">{originally}</div>}
                            </div>
                        </div>

                        {p.state === 'needsAssignment' &&
                            allStandbyMatches.filter((m) => m.course === e.course).length > 0 && (
                                <div className="flex flex-col gap-1.5">
                                    {allStandbyMatches
                                        .filter((m) => m.course === e.course)
                                        .map((m) => {
                                            const conflict = m.conflictsByStandbyId[p.id]
                                            return (
                                                <div
                                                    key={`${m.slot.id}|${m.noShowParticipant.id}`}
                                                    className="flex flex-wrap items-center justify-between gap-2 border-2 border-orange-600 bg-orange-50 px-3 py-2">
                                                    <div className="min-w-0">
                                                        <div className="text-sm font-bold text-slate-900">
                                                            Open Standby Slot: {m.course} · {m.slot.time} (No-show: {m.noShowParticipant.name})
                                                        </div>
                                                        {conflict !== undefined && (
                                                            <div className="text-xs font-medium text-amber-800">
                                                                &lt;6 min from {club} teammate {conflict.teammateName} ({conflict.teammateTime})
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            void handleSlotStandbyRunner(
                                                                p.id,
                                                                p.name,
                                                                m.noShowParticipant.id,
                                                                m.slot
                                                            )
                                                        }
                                                        className="border border-emerald-700 bg-emerald-600 px-3.5 py-1.5 text-sm font-bold text-white hover:bg-emerald-700">
                                                        Assign {p.name} to {m.slot.time}
                                                    </button>
                                                </div>
                                            )
                                        })}
                                </div>
                            )}

                        {(startDiffers || epunchDiffers) && (
                            <div className="flex flex-col gap-2 border border-slate-300 bg-slate-50 p-3">
                                <div className="flex items-center gap-3">
                                    <h3 className="flex-1 text-xs font-bold uppercase tracking-wider text-slate-600">Changed from original</h3>
                                    {startDiffers && epunchDiffers && (
                                        <button type="button" className="text-xs font-semibold text-sky-700 underline" onClick={handleRestoreAll}>
                                            Restore all
                                        </button>
                                    )}
                                </div>
                                {startDiffers && originalStart !== undefined && (
                                    <div className="flex items-center gap-3 text-xs">
                                        <span className="flex-1 text-slate-700">
                                            Start: {originalStart.course} · {originalStart.time}
                                            <span className="text-slate-400"> → </span>
                                            {e.course} · {formatSlotTime(e.time)}
                                        </span>
                                        <button
                                            type="button"
                                            className="border border-sky-600 bg-white px-2 py-0.5 text-xs font-semibold text-sky-700 hover:bg-sky-600 hover:text-white"
                                            onClick={handleRestoreStart}>
                                            Restore
                                        </button>
                                    </div>
                                )}
                                {epunchDiffers && originalEpunch !== undefined && (
                                    <div className="flex items-center gap-3 text-xs">
                                        <span className="flex-1 text-slate-700">
                                            E-punch: {noEpunch(originalEpunch.epunch)}{originalEpunch.isRental ? ' (rental)' : ''}
                                            <span className="text-slate-400"> → </span>
                                            {noEpunch(p.epunch)}{p.isRental ? ' (rental)' : ''}
                                        </span>
                                        <button
                                            type="button"
                                            className="border border-sky-600 bg-white px-2 py-0.5 text-xs font-semibold text-sky-700 hover:bg-sky-600 hover:text-white"
                                            onClick={handleRestoreEpunch}>
                                            Restore
                                        </button>
                                    </div>
                                )}
                                {restoreNote !== '' && <p className="text-xs font-medium text-amber-800">{restoreNote}</p>}
                            </div>
                        )}

                        {/* Grouped Actions Panel */}
                        <div className="flex flex-col gap-3 border border-slate-300 bg-white p-4">
                            <div>
                                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Runner Actions
                                </div>
                                <div className="grid grid-cols-1 sm:flex sm:flex-wrap items-center gap-2">
                                    {(p.needsWaiver || p.needsPayment) && (
                                        <ManagerActionButton
                                            action={() => {
                                                const prevWaiver = Boolean(p.needsWaiver)
                                                const prevPayment = Boolean(p.needsPayment)
                                                void setParticipantEligible(p.id)
                                                setUndo({
                                                    message: `${p.name} marked as Eligible`,
                                                    run: async () => {
                                                        if (prevWaiver) await setNeedsWaiver(p.id, true)
                                                        if (prevPayment) await setNeedsPayment(p.id, true)
                                                    },
                                                })
                                            }}
                                            text="Set as Eligible"
                                            icon="check-circle"
                                            color="emerald"
                                            buttonStyle="solid"
                                            className="px-4 py-2 text-base font-extrabold ring-2 ring-emerald-700 ring-offset-1" />
                                    )}
                                    <ManagerActionButton
                                        action={() => setTimePickerOpen((open) => !open)}
                                        text="Change start time"
                                        icon="clock"
                                        color="sky"
                                        buttonStyle={timePickerOpen || hasNoShow(p) || p.state === 'needsAssignment' ? "solid" : "outline"}
                                        className={hasNoShow(p) || p.state === 'needsAssignment' ? "px-4 py-2 text-base font-extrabold ring-2 ring-sky-700 ring-offset-1" : ""} />
                                    <ManagerActionButton
                                        action={() => setEpunchEditOpen(true)}
                                        text="Edit e-punch"
                                        icon="pencil"
                                        color={getColorByIconName("pencil")}
                                        buttonStyle={hasWrongEpunch(p) ? "solid" : "outline"}
                                        className={hasWrongEpunch(p) ? "px-4 py-2 text-base font-extrabold ring-2 ring-pink-700 ring-offset-1" : ""} />
                                    {inRealSlot && hasWrongEpunch(p) && (
                                        <ManagerActionButton
                                            action={() => void runWithUndo(`${p.name} marked Validated`, () => setStateValidated(p.id))}
                                            text="Mark e-punch validated"
                                            icon="check-badge"
                                            color={getColorByIconName("check-badge")}
                                            buttonStyle="solid"
                                            className="px-4 py-2 text-base font-extrabold" />
                                    )}
                                    {inRealSlot && !hasWrongEpunch(p) && (
                                        <ManagerActionButton
                                            action={() => void runWithUndo(`${p.name} marked Wrong e-punch`, () => setStateWrongEpunch(p.id))}
                                            text="Wrong e-punch"
                                            icon="triangle-bang"
                                            color="amber"
                                            buttonStyle="outline" />
                                    )}
                                    {p.isNonCompete ? (
                                        <ManagerActionButton
                                            action={() => setCompetitive(p.id)}
                                            text="Set competitive"
                                            icon="medal"
                                            color="purple"
                                            buttonStyle="outline" />
                                    ) : (
                                        <ManagerActionButton
                                            action={() => setNonCompetitive(p.id)}
                                            text="Set non-competitive"
                                            icon="medal"
                                            color="purple"
                                            buttonStyle="outline" />
                                    )}
                                    <ManagerActionButton
                                        action={() => setGroupSizeEditOpen(true)}
                                        text={p.groupSize > 1 ? `Group size (${p.groupSize})` : "Make group / Group size"}
                                        icon="group"
                                        color="emerald"
                                        buttonStyle="outline" />
                                    {p.hasRentedCompass ? (
                                        <>
                                            <ManagerActionButton
                                                action={() => {
                                                    const prevCompassId = p.compassId ?? ''
                                                    void setHasRentedCompass(p.id, false)
                                                    setUndo({
                                                        message: `${p.name} compass marked returned`,
                                                        run: async () => {
                                                            await setHasRentedCompass(p.id, true, prevCompassId)
                                                        },
                                                    })
                                                }}
                                                text="Compass Returned"
                                                icon="pin"
                                                color="amber"
                                                buttonStyle="solid" />
                                            <ManagerActionButton
                                                action={() => setRentCompassOpen(true)}
                                                text={`Edit Compass (${p.compassId || 'ID'})`}
                                                icon="pencil"
                                                color="amber"
                                                buttonStyle="outline" />
                                        </>
                                    ) : (
                                        <ManagerActionButton
                                            action={() => setRentCompassOpen(true)}
                                            text="Rent Compass"
                                            icon="pin"
                                            color="amber"
                                            buttonStyle="outline" />
                                    )}
                                    <ManagerActionButton
                                        action={() =>
                                            setAddParticipantPrefill({
                                                name: p.name,
                                                club: p.club ?? '',
                                                epunch: p.epunch ?? '',
                                                isRental: true,
                                                isNonCompete: true,
                                                suggestedCourse: nextHarderCourse(e.course, courses),
                                                isSecondCourse: true,
                                            })
                                        }
                                        text="Add 2nd course"
                                        icon="plus"
                                        color="emerald"
                                        buttonStyle="outline" />
                                </div>
                            </div>

                            <div className="border-t border-slate-200 pt-3">
                                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Attendance
                                </div>
                                <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2">
                                    {inRealSlot && !hasNoShow(p) && (
                                        <ManagerActionButton
                                            action={() => void runWithUndo(`${p.name} marked No show`, () => setStateNoShow(p.id))}
                                            text="No show"
                                            icon="question-circle"
                                            color={getColorByIconName("question-circle")}
                                            buttonStyle="outline" />
                                    )}
                                    {inRealSlot && hasNoShow(p) && (
                                        <ManagerActionButton
                                            action={() => void runWithUndo(`${p.name} no-show cleared`, () => clearStateNoShow(p.id))}
                                            text="Clear no-show"
                                            icon="question-circle"
                                            color={getColorByIconName("question-circle")}
                                            buttonStyle="solid" />
                                    )}
                                    {inRealSlot && p.state !== 'waiting' && (
                                        <ManagerActionButton
                                            action={() => void runWithUndo(`${p.name} reset to waiting`, () => setStateWaiting(p.id))}
                                            text="Reset to waiting"
                                            icon="clock"
                                            color={getColorByIconName("clock")}
                                            buttonStyle="outline" />
                                    )}
                                    {e.time !== '_needsAssignment' && (
                                        <ManagerActionButton
                                            action={() => {
                                                setTimePickerOpen(false)
                                                void runWithUndo(`${p.name} placed in standby`, () => setStateNeedsAssignment(p.id))
                                            }}
                                            text="Put on standby"
                                            icon="hourglass"
                                            color={getColorByIconName("hourglass")}
                                            buttonStyle="outline" />
                                    )}
                                    {p.state !== 'notAttending' && (
                                        <ManagerActionButton
                                            action={() => setConfirmNotAttending(true)}
                                            text="Not attending"
                                            icon="x"
                                            color="red"
                                            buttonStyle="outline" />
                                    )}
                                </div>
                            </div>

                            {confirmNotAttending && (
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 border border-amber-600 bg-amber-50 p-3 text-amber-950">
                                    <span className="flex-1 text-sm font-medium">Mark {p.name} not attending? Frees start slot.</span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            type="button"
                                            className="flex-1 sm:flex-initial min-h-10 sm:min-h-0 border border-amber-700 bg-amber-600 px-3 py-1.5 sm:py-1 text-xs font-bold text-white hover:bg-amber-700"
                                            onClick={() => {
                                                setConfirmNotAttending(false)
                                                void runWithUndo(`${p.name} marked Not attending`, () => setStateNotAttending(p.id))
                                            }}>
                                            Confirm
                                        </button>
                                        <button
                                            type="button"
                                            className="flex-1 sm:flex-initial min-h-10 sm:min-h-0 border border-slate-300 bg-white px-3 py-1.5 sm:py-1 text-xs font-semibold text-slate-800 hover:bg-slate-100"
                                            onClick={() => setConfirmNotAttending(false)}>
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {timePickerOpen && (
                        <OpenTimesPicker
                            key={p.id}
                            participantId={p.id}
                            participantName={p.name}
                            participantClub={p.club ?? ''}
                            currentCourse={e.course}
                            currentTime={e.time}
                            allSlots={allSlots}
                            allParticipants={allParticipants}
                            cutoff={cutoff}
                            onAssign={handleAssign}
                            onClose={() => setTimePickerOpen(false)} />
                    )}
                </div>

                <div className="flex flex-col gap-2">
                    <button
                        type="button"
                        className="self-start text-sm font-medium text-sky-700 underline"
                        onClick={() => setTimelineOpen((open) => !open)}>
                        {timelineOpen ? 'Hide' : 'Show'} full timeline for {e.course}
                    </button>
                    {timelineOpen && (
                        <StartGrid
                            data={populateSlotData(allSlots.filter((s) => s.course === e.course), allParticipants)}
                            selectedParticipantHydrated={e}
                            columns="course"
                            scrollTo={scrollToRef}
                            toStateButtons={[]}
                            className="max-h-96" />
                    )}
                </div>
            </div>
        )
    }

    let body: ReactNode
    if (selectedDoc === undefined) {
        body = (
            <>
                {selectedParticipantId !== '' && (
                    <p className="text-xs text-slate-500">
                        Participant record syncing…
                    </p>
                )}
                <AttentionQueue
                    participants={allParticipants}
                    slotsByParticipant={slotsByParticipant}
                    changes={allChanges}
                    onSelect={selectParticipant} />
            </>
        )
    } else if (entry === undefined) {
        body = (
            <RecordProblem
                name={selectedDoc.name}
                slots={selectedSlots}
                courses={courses}
                onKeep={(slot) => void keepOnlyInSlot(selectedDoc.id, slot, allSlots)}
                onPlace={handlePlaceInQueue} />
        )
    } else {
        body = renderDetail(entry)
    }

    return (
        <>
            <Head title='Start Manager' />
            <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-8 text-slate-900">
                {isEpunchEditOpen && entry !== undefined && (
                    <Modal
                        title={`Edit e-punch for ${entry.participant.name}`}
                        close={() => setEpunchEditOpen(false)}
                        content={<EditEpunchModal participant={entry} closeModal={() => setEpunchEditOpen(false)} />}
                    />
                )}

                {isGroupSizeEditOpen && entry !== undefined && (
                    <Modal
                        title={`Group size for ${entry.participant.name}`}
                        close={() => setGroupSizeEditOpen(false)}
                        content={
                            <EditGroupSizeModal
                                participant={entry}
                                closeModal={() => setGroupSizeEditOpen(false)}
                                onSaved={(oldSize, newSize) => {
                                    if (oldSize === newSize) return
                                    const pid = entry.participant.id
                                    const name = entry.participant.name
                                    setUndo({
                                        message:
                                            newSize === 1
                                                ? `${name} set to Individual (1 person)`
                                                : `${name} set to Group of ${newSize}`,
                                        run: async () => {
                                            await setGroupSize(pid, oldSize)
                                        },
                                    })
                                }}
                            />
                        }
                    />
                )}

                {isRentCompassOpen && entry !== undefined && (
                    <Modal
                        title={`Rent Compass for ${entry.participant.name}`}
                        close={() => setRentCompassOpen(false)}
                        content={
                            <RentCompassModal
                                participant={entry}
                                closeModal={() => setRentCompassOpen(false)}
                                onSaved={(compassId) => {
                                    const pid = entry.participant.id
                                    const name = entry.participant.name
                                    const wasRented = entry.participant.hasRentedCompass
                                    const prevId = entry.participant.compassId ?? ''
                                    setUndo({
                                        message: compassId
                                            ? `${name} rented Compass #${compassId}`
                                            : `${name} rented a compass (no ID)`,
                                        run: async () => {
                                            await setHasRentedCompass(pid, Boolean(wasRented), prevId)
                                        },
                                    })
                                }}
                            />
                        }
                    />
                )}

                {addParticipantPrefill !== undefined && (
                    <Modal
                        title={
                            addParticipantPrefill !== null
                                ? `Add 2nd Course for ${addParticipantPrefill.name}`
                                : 'Add Participant to Meet'
                        }
                        close={() => setAddParticipantPrefill(undefined)}
                        content={
                            <AddParticipantModal
                                allParticipants={allParticipants}
                                allSlots={allSlots}
                                cutoff={cutoff}
                                prefill={addParticipantPrefill ?? undefined}
                                onCreated={(newId, summary) => {
                                    setAddParticipantPrefill(undefined)
                                    selectParticipant(newId, false)
                                    setUndo({ message: summary })
                                }}
                                onClose={() => setAddParticipantPrefill(undefined)}
                            />
                        }
                    />
                )}

                {/* Top Command Bar */}
                <div className="flex flex-col sm:flex-row items-stretch gap-3">
                    <div className="min-w-0 flex-1">
                        <ManagerSearchBox
                            participants={allParticipants}
                            slotsByParticipant={slotsByParticipant}
                            onSelect={selectParticipant}
                            onEscapeWhenEmpty={clearSelection}
                            focusToken={focusToken} />
                    </div>

                    {selectedParticipantId === '' && (
                        <button
                            type="button"
                            onClick={() => setAddParticipantPrefill(null)}
                            className="flex shrink-0 items-center justify-center gap-2 border border-emerald-700 bg-emerald-600 px-4 py-3 text-base font-bold text-white transition hover:bg-emerald-700">
                            <span>Add Participant</span>
                        </button>
                    )}

                    {selectedParticipantId !== '' && (
                        <button
                            type="button"
                            onClick={clearSelection}
                            className="flex shrink-0 items-center justify-center gap-2 border border-slate-900 bg-slate-900 px-6 py-3 text-lg font-bold text-white transition hover:bg-slate-800">
                            <span>Done</span>
                        </button>
                    )}
                </div>

                {standbyNotificationBanner}
                {undoBanner}
                {body}
            </div>
        </>
    )
}
