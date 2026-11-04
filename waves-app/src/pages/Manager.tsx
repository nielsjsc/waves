import { useEffect, useRef, useState, type ReactNode } from "react"
import { useLiveQuery } from "@tanstack/react-db"
import { changesTanCollection, participantsTanCollection, slotsTanCollection } from "@/database"
import type { SlotDocType } from "@/Schema"
import type { ParticipantState } from "@/api/participants"
import type { PopulatedEntry } from "@/utils/PopulatedEntry"
import { Head } from "@/components/Head"
import { Modal } from "@/components/Modal"
import { EditEpunchModal } from "@/components/EditEpunchModal"
import { ManagerActionButton } from "@/components/ManagerActionButton"
import { SvgIcon } from "@/components/SvgIcon"
import { StartGrid } from "@/components/grid/StartGrid"
import { ManagerSearchBox } from "@/components/manager/ManagerSearchBox"
import { AttentionQueue } from "@/components/manager/AttentionQueue"
import { OpenTimesPicker } from "@/components/manager/OpenTimesPicker"
import { AddParticipantModal, type AddParticipantPrefill } from "@/components/manager/AddParticipantModal"
import { hydrateParticipant } from "@/utils/hydrateParticipant"
import { populateSlotData } from "@/utils/populateSlotData"
import { getOriginalEpunch, getOriginalStart } from "@/utils/originalValues"
import { addMinutesToClock, courseShortLabel, formatSlotTime, isMagicTime } from "@/utils/slotLabels"
import { ParticipantStateStyles, getColorByIconName } from "@/utils/styleHelpers"
import { keepOnlyInSlot, putInNeedsAssignment } from "@/actions/repairActions"
import {
    setCompetitive,
    setNewEpunch,
    setNewStartTime,
    setNonCompetitive,
    setStateNeedsAssignment,
    setStateNoShow,
    setStateNotAttending,
    setStatePresent,
    setStateValidated,
    setStateWaiting,
    setStateWrongEpunch,
} from "@/actions/participantActions"

// How long the Undo notice stays on screen before it fades away on its own.
const UNDO_VISIBLE_MS = 3500

interface Properties {
    // Header clock ("13:09:17", already corrected by the volunteer) and the call-up
    // offset, used to hide start times that are already past call-up.
    clockTime: string
    waveOffsetMinutes: number
    // Selection lives in the header so it survives switching to another page.
    selectedParticipantId: string
    setSelectedParticipantId: (id: string) => void
}

//// Undo ////

interface Snapshot {
    slotId: string
    slotTime: string
    state: ParticipantState
}

interface UndoInfo {
    message: string
    run?: () => Promise<void>
}

async function applyState(participantId: string, state: ParticipantState) {
    switch (state) {
        case 'waiting': return setStateWaiting(participantId)
        case 'present': return setStatePresent(participantId)
        case 'validated': return setStateValidated(participantId)
        case 'wrongEpunch': return setStateWrongEpunch(participantId)
        case 'noShow': return setStateNoShow(participantId)
        case 'notAttending': return setStateNotAttending(participantId)
        case 'needsAssignment': return setStateNeedsAssignment(participantId)
        default: return
    }
}

// Put a participant back where (and as what) they were before an action.
async function restoreSnapshot(participantId: string, snapshot: Snapshot, current: PopulatedEntry | undefined) {
    if (current === undefined) {
        alert("Can't undo right now: this record isn't in exactly one slot. Wait a moment and try again.")
        return
    }
    if (current.slotId === snapshot.slotId && current.participant.state === snapshot.state) {
        return // slot and state are unchanged, so there is nothing to put back
    }
    if (!isMagicTime(snapshot.slotTime) && current.slotId !== snapshot.slotId) {
        // Back to a real start time: move there (this also resets them to waiting)...
        await setNewStartTime(participantId, current.slotId, snapshot.slotId)
    }
    // ...then restore the state. For a queue slot this moves them back into the queue.
    await applyState(participantId, snapshot.state)
}

//// Small pieces ////

function Pill({className, children}: {className: string, children: ReactNode}) {
    return <span className={`rounded px-2 py-0.5 text-xs font-medium ${className}`}>{children}</span>
}

function nextHarderCourse(currentCourse: string, courses: string[]): string {
    const idx = courses.indexOf(currentCourse)
    if (idx >= 0 && idx + 1 < courses.length) {
        return courses[idx + 1]!
    }
    return currentCourse
}

function RecordProblem({name, slots, courses, onKeep, onPlace}: {
    name: string
    slots: SlotDocType[]
    courses: string[]
    onKeep: (slot: SlotDocType) => void
    onPlace: (course: string) => void
}) {
    return (
        <div className="flex flex-col gap-3 rounded-lg border border-red-700 bg-red-950 p-4 text-red-100">
            <h3 className="text-lg font-semibold">Problem with {name}'s record</h3>
            {slots.length === 0 ? (
                <>
                    <p>
                        {name} isn't in any start slot. This can show up for a few seconds while changes sync.
                        If it stays, choose a course to put them in its "needs a new time" queue:
                    </p>
                    <div className="flex flex-wrap gap-2">
                        {courses.map((c) => (
                            <button key={c} type="button" onClick={() => onPlace(c)}
                                className="rounded-md bg-red-800 px-3 py-1 font-semibold hover:bg-red-700">
                                {c}
                            </button>
                        ))}
                    </div>
                </>
            ) : (
                <>
                    <p>{name} is listed in {slots.length} slots at once. Choose the one to keep:</p>
                    <div className="flex flex-col gap-2">
                        {slots.map((slot) => (
                            <div key={slot.id} className="flex items-center gap-3">
                                <span className="flex-1">{slot.course} · {formatSlotTime(slot.time)}</span>
                                <button type="button" onClick={() => onKeep(slot)}
                                    className="rounded-md bg-red-800 px-3 py-1 font-semibold hover:bg-red-700">
                                    Keep this one
                                </button>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}

//// Page ////

export function Manager({clockTime, waveOffsetMinutes, selectedParticipantId, setSelectedParticipantId}: Properties) {

    const [isEpunchEditOpen, setEpunchEditOpen] = useState(false)
    const [addParticipantPrefill, setAddParticipantPrefill] = useState<AddParticipantPrefill | null | undefined>(undefined)
    const [confirmNotAttending, setConfirmNotAttending] = useState(false)
    const [timePickerOpen, setTimePickerOpen] = useState(false)
    const [timelineOpen, setTimelineOpen] = useState(false)
    const [focusToken, setFocusToken] = useState(0)
    const [undo, setUndo] = useState<UndoInfo | undefined>(undefined)
    const [restoreNote, setRestoreNote] = useState('')

    const {data: allParticipants} = useLiveQuery((q) =>
        q.from({participant: participantsTanCollection})
    )
    const {data: allSlots} = useLiveQuery((q) =>
        q.from({slot: slotsTanCollection})
    )
    const {data: allChanges} = useLiveQuery((q) =>
        q.from({changes: changesTanCollection})
    )

    const DATA = {
        participants: allParticipants,
        slots: allSlots,
        changes: allChanges
    }
    // Undo runs later, so it reads the data as it is then, not as it was when the action ran.
    const dataRef = useRef(DATA)
    dataRef.current = DATA

    // Which slot(s) each participant is in. Exactly one is healthy.
    const slotsByParticipant = new Map<string, SlotDocType[]>()
    for (const slot of allSlots) {
        for (const pid of slot.participants) {
            const list = slotsByParticipant.get(pid)
            if (list === undefined) {slotsByParticipant.set(pid, [slot])} else {list.push(slot)}
        }
    }
    const courses = [...new Set(allSlots.map((s) => s.course))].sort()

    const selectedDoc = selectedParticipantId === '' ? undefined : allParticipants.find((p) => p.id === selectedParticipantId)
    const selectedSlots = selectedDoc === undefined ? [] : (slotsByParticipant.get(selectedDoc.id) ?? [])
    const entry = selectedDoc !== undefined && selectedSlots.length === 1 ? hydrateParticipant(selectedDoc.id, DATA) : undefined

    const cutoff = addMinutesToClock(clockTime, waveOffsetMinutes)

    // Changing who is selected closes anything that was open for the previous person.
    useEffect(() => {
        setConfirmNotAttending(false)
        setEpunchEditOpen(false)
        setRestoreNote('')
    }, [selectedParticipantId])

    // The Undo notice fades away by itself; a newer action replaces it and restarts the timer.
    useEffect(() => {
        if (undo === undefined) {return}
        const timer = setTimeout(() => setUndo(undefined), UNDO_VISIBLE_MS)
        return () => clearTimeout(timer)
    }, [undo])

    // Scroll the timeline to the selected participant when it's open.
    const scrollToRef = useRef<HTMLTableRowElement>(null)
    useEffect(() => {
        if (timelineOpen && scrollToRef.current !== null) {
            scrollToRef.current.scrollIntoView({behavior: 'smooth', block: 'nearest'})
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

    // Run an action and offer a one-click undo afterwards. alsoUndo adds a step to the undo,
    // for changes the slot/state snapshot can't cover (like the e-punch number).
    async function runWithUndo(message: string, action: () => Promise<unknown>, alsoUndo?: () => Promise<unknown>) {
        if (entry === undefined) {return}
        const id = entry.participant.id
        const snapshot: Snapshot = {slotId: entry.slotId, slotTime: entry.time, state: entry.participant.state}
        await action()
        setUndo({
            message,
            run: async () => {
                await restoreSnapshot(id, snapshot, hydrateParticipant(id, dataRef.current))
                await alsoUndo?.()
            }
        })
    }

    function handleAssign(slot: SlotDocType) {
        if (entry === undefined) {return}
        setTimePickerOpen(false)
        void runWithUndo(
            `${entry.participant.name} moved to ${slot.course} · ${slot.time}`,
            () => setNewStartTime(entry.participant.id, entry.slotId, slot.id))
    }

    function handlePlaceInQueue(course: string) {
        const magic = allSlots.find((s) => s.course === course && s.time === '_needsAssignment')
        if (selectedDoc === undefined || magic === undefined) {
            alert(`Couldn't find the needs-new-time queue for ${course}.`)
            return
        }
        void putInNeedsAssignment(selectedDoc.id, magic)
    }

    //// Rendering ////

    // A toast pinned to the bottom of the screen: it never pushes the page around and fades on its own.
    const undoBanner = undo === undefined ? null : (
        <div className="fixed inset-x-4 bottom-4 z-30 mx-auto flex max-w-xl items-center gap-3 rounded-lg border border-amber-600/60 bg-amber-950 px-4 py-3 text-amber-100 shadow-xl">
            <span className="flex-1">{undo.message}</span>
            {undo.run !== undefined && (
                <button type="button" className="rounded bg-amber-600 px-3 py-1 font-semibold text-white hover:bg-amber-500"
                    onClick={async () => { await undo.run?.(); setUndo(undefined) }}>
                    Undo
                </button>
            )}
        </div>
    )

    function renderDetail(e: PopulatedEntry) {
        const p = e.participant
        const style = ParticipantStateStyles.get(p.state)
        const inRealSlot = !isMagicTime(e.time)
        const club = p.club === '' || p.club === 'unknown' || p.club === 'None' ? '' : p.club
        const courseHint = courseShortLabel(e.course)
        const courseWithHint = courseHint !== '' ? `${e.course} (${courseHint})` : e.course
        const where = inRealSlot
            ? `Course ${courseWithHint} · starts ${e.time}`
            : `${formatSlotTime(e.time)} · course ${courseWithHint}`
        const originally = p.startChanged && p.originalStartTime !== '' && p.originalStartTime !== e.time
            ? `Originally ${p.originalStartTime}`
            : ''

        // What would "restore original" change for this person?
        const originalStart = getOriginalStart(p.id, p.originalStartTime, e.course, allChanges)
        const startDiffers = originalStart !== undefined && (e.course !== originalStart.course || e.time !== originalStart.time)
        const originalEpunch = getOriginalEpunch(p.id, allChanges)
        const epunchDiffers = originalEpunch !== undefined &&
            (originalEpunch.epunch !== p.epunch || (originalEpunch.isRental !== undefined && originalEpunch.isRental !== p.isRental))
        const noEpunch = (value: string) => (value === '' ? 'none' : value)

        // The original slot, if it can be moved back into. Otherwise says why not.
        function findRestorableSlot(): SlotDocType | undefined {
            if (originalStart === undefined) {return undefined}
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
            if (target === undefined || originalStart === undefined) {return}
            void runWithUndo(
                `${p.name} restored to ${originalStart.course} · ${originalStart.time}`,
                () => setNewStartTime(p.id, e.slotId, target.id))
        }

        function handleRestoreEpunch() {
            if (originalEpunch === undefined) {return}
            const before = {epunch: p.epunch, isRental: p.isRental}
            void runWithUndo(
                `${p.name}'s e-punch restored to ${noEpunch(originalEpunch.epunch)}`,
                () => setNewEpunch(p.id, originalEpunch.epunch, originalEpunch.isRental ?? p.isRental),
                () => setNewEpunch(p.id, before.epunch, before.isRental))
        }

        function handleRestoreAll() {
            setRestoreNote('')
            const target = startDiffers ? findRestorableSlot() : undefined
            const epunchTarget = epunchDiffers ? originalEpunch : undefined
            if (target === undefined && epunchTarget === undefined) {return}
            const before = {epunch: p.epunch, isRental: p.isRental}
            const parts: string[] = []
            if (target !== undefined && originalStart !== undefined) {parts.push(`${originalStart.course} · ${originalStart.time}`)}
            if (epunchTarget !== undefined) {parts.push(`e-punch ${noEpunch(epunchTarget.epunch)}`)}
            void runWithUndo(
                `${p.name} restored to the original: ${parts.join(', ')}`,
                async () => {
                    if (target !== undefined) {await setNewStartTime(p.id, e.slotId, target.id)}
                    if (epunchTarget !== undefined) {await setNewEpunch(p.id, epunchTarget.epunch, epunchTarget.isRental ?? p.isRental)}
                },
                epunchTarget === undefined ? undefined : () => setNewEpunch(p.id, before.epunch, before.isRental))
        }

        return (
            <div className="flex flex-col gap-4">
                <div className={timePickerOpen ? "grid gap-4 lg:grid-cols-[minmax(0,28rem)_minmax(0,1fr)]" : "flex max-w-2xl flex-col gap-4"}>
                    <div className="flex flex-col gap-4">
                        {/* Participant Summary Card */}
                        <div className="rounded-lg border border-gray-700 bg-gray-800 p-4">
                            <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-2xl font-bold text-white">{p.name}</h2>
                                {p.groupSize > 1 && <Pill className="bg-emerald-800 text-emerald-100">Group {p.groupSize}</Pill>}
                                {p.isNonCompete && <Pill className="bg-indigo-800 text-indigo-100">Non-competitive</Pill>}
                                {p.isRental && <Pill className="bg-orange-800 text-orange-100">Rental e-punch</Pill>}
                                {style !== undefined && p.state !== 'waiting' && (
                                    <Pill className={`${style.bg} text-white`}>{style.friendlyName}</Pill>
                                )}
                            </div>
                            <div className="mt-1.5 text-sm text-gray-300">
                                {club !== '' ? club : 'Independent / No school'} · E-punch{' '}
                                <strong className="font-bold text-amber-200">
                                    {p.epunch === '' ? 'none' : p.epunch}
                                </strong>
                            </div>
                            <div className="mt-3 rounded-md border border-gray-700 bg-gray-900/80 px-3 py-2">
                                <div className="text-lg font-bold text-gray-100">{where}</div>
                                {originally !== '' && <div className="text-sm text-amber-300">{originally}</div>}
                            </div>
                        </div>

                        {(startDiffers || epunchDiffers) && (
                            <div className="flex flex-col gap-2 rounded-lg border border-gray-700 bg-gray-900 p-3">
                                <div className="flex items-center gap-3">
                                    <h3 className="flex-1 text-sm font-semibold text-gray-300">Changed from the original</h3>
                                    {startDiffers && epunchDiffers && (
                                        <button type="button" className="text-sm text-sky-300 underline" onClick={handleRestoreAll}>
                                            Restore all
                                        </button>
                                    )}
                                </div>
                                {startDiffers && originalStart !== undefined && (
                                    <div className="flex items-center gap-3 text-sm">
                                        <span className="flex-1 text-gray-300">
                                            Start: {originalStart.course} · {originalStart.time}
                                            <span className="text-gray-500"> → now </span>
                                            {e.course} · {formatSlotTime(e.time)}
                                        </span>
                                        <button type="button" className="rounded border border-sky-500 px-2 py-0.5 text-sky-300 hover:bg-sky-600 hover:text-white"
                                            onClick={handleRestoreStart}>
                                            Restore
                                        </button>
                                    </div>
                                )}
                                {epunchDiffers && originalEpunch !== undefined && (
                                    <div className="flex items-center gap-3 text-sm">
                                        <span className="flex-1 text-gray-300">
                                            E-punch: {noEpunch(originalEpunch.epunch)}{originalEpunch.isRental ? ' (rental)' : ''}
                                            <span className="text-gray-500"> → now </span>
                                            {noEpunch(p.epunch)}{p.isRental ? ' (rental)' : ''}
                                        </span>
                                        <button type="button" className="rounded border border-sky-500 px-2 py-0.5 text-sky-300 hover:bg-sky-600 hover:text-white"
                                            onClick={handleRestoreEpunch}>
                                            Restore
                                        </button>
                                    </div>
                                )}
                                {restoreNote !== '' && <p className="text-sm text-amber-300">{restoreNote}</p>}
                            </div>
                        )}

                        {/* Grouped Actions Panel */}
                        <div className="flex flex-col gap-3 rounded-lg border border-gray-700 bg-gray-900 p-4">
                            <div>
                                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                                    Start Time, E-punch, Status &amp; 2nd Course
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <ManagerActionButton
                                        action={() => setTimePickerOpen((open) => !open)}
                                        text="Change start time"
                                        icon="clock"
                                        color="sky"
                                        buttonStyle={timePickerOpen ? "solid" : "outline"} />
                                    <ManagerActionButton
                                        action={() => setEpunchEditOpen(true)}
                                        text="Edit e-punch"
                                        icon="pencil"
                                        color={getColorByIconName("pencil")}
                                        buttonStyle="outline" />
                                    {inRealSlot && p.state === 'wrongEpunch' && (
                                        <ManagerActionButton
                                            action={() => void runWithUndo(`${p.name} marked Validated`, () => setStateValidated(p.id))}
                                            text="Mark e-punch validated"
                                            icon="check-badge"
                                            color={getColorByIconName("check-badge")}
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
                                        action={() =>
                                            setAddParticipantPrefill({
                                                name: p.name,
                                                club: p.club ?? '',
                                                epunch: p.epunch ?? '',
                                                isRental: p.isRental,
                                                isNonCompete: true,
                                                suggestedCourse: nextHarderCourse(e.course, courses),
                                            })
                                        }
                                        text="Add 2nd course"
                                        icon="plus"
                                        color="emerald"
                                        buttonStyle="outline" />
                                </div>
                            </div>

                            <div className="border-t border-gray-800 pt-3">
                                <div className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                                    Attendance &amp; Queue
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {inRealSlot && p.state !== 'noShow' && (
                                        <ManagerActionButton
                                            action={() => void runWithUndo(`${p.name} marked No show`, () => setStateNoShow(p.id))}
                                            text="No show"
                                            icon="question-circle"
                                            color={getColorByIconName("question-circle")}
                                            buttonStyle="outline" />
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
                                                setTimePickerOpen(true)
                                                void runWithUndo(`${p.name} moved to needs a new time`, () => setStateNeedsAssignment(p.id))
                                            }}
                                            text="Needs new time"
                                            icon="hourglass"
                                            color={getColorByIconName("hourglass")}
                                            buttonStyle="outline" />
                                    )}
                                    {e.time !== '_notAttending' && (
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
                                <div className="flex flex-wrap items-center gap-3 rounded-md border border-amber-600/60 bg-amber-950 px-3 py-2 text-amber-100">
                                    <span className="flex-1 text-sm">Mark {p.name} as not attending? This frees their start slot.</span>
                                    <button type="button" className="rounded bg-amber-600 px-3 py-1 text-sm font-semibold text-white hover:bg-amber-500"
                                        onClick={() => {
                                            setConfirmNotAttending(false)
                                            void runWithUndo(`${p.name} marked Not attending`, () => setStateNotAttending(p.id))
                                        }}>
                                        Yes, not attending
                                    </button>
                                    <button type="button" className="rounded border border-amber-600/60 px-3 py-1 text-sm"
                                        onClick={() => setConfirmNotAttending(false)}>
                                        Cancel
                                    </button>
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
                    <button type="button" className="self-start text-sm text-sky-300 underline"
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
                    <p className="text-gray-400">
                        That participant isn't in the data yet. If you just selected them, changes may still be syncing.
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
            <div className="mx-auto flex max-w-6xl flex-col gap-4 pb-8">
                {isEpunchEditOpen && entry !== undefined && (
                    <Modal
                        title={`Edit e-punch for ${entry.participant.name}`}
                        close={() => setEpunchEditOpen(false)}
                        content={<EditEpunchModal participant={entry} closeModal={() => setEpunchEditOpen(false)} />}
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
                <div className="flex flex-wrap items-stretch gap-3">
                    <div className="min-w-[16rem] flex-1">
                        <ManagerSearchBox
                            participants={allParticipants}
                            slotsByParticipant={slotsByParticipant}
                            onSelect={selectParticipant}
                            onEscapeWhenEmpty={clearSelection}
                            focusToken={focusToken} />
                    </div>

                    <button
                        type="button"
                        onClick={() => setAddParticipantPrefill(null)}
                        className="flex shrink-0 items-center gap-2 rounded-lg border-2 border-emerald-500 bg-emerald-700 px-4 py-3 text-base font-bold text-white shadow-md transition hover:bg-emerald-600">
                        <SvgIcon icon="plus" />
                        <span>Add Participant</span>
                    </button>

                    {selectedParticipantId !== '' && (
                        <button
                            type="button"
                            onClick={clearSelection}
                            className="flex shrink-0 items-center gap-2 rounded-lg border-2 border-red-500 bg-red-700 px-6 py-3 text-lg font-bold text-white shadow-md transition hover:bg-red-600">
                            <SvgIcon icon="x" />
                            <span>Done</span>
                        </button>
                    )}
                </div>

                {undoBanner}
                {body}
            </div>
        </>
    )
}
