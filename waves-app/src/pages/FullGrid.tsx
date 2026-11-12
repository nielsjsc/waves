import { useState } from 'react'
import { useLiveQuery } from '@tanstack/react-db'
import { Head } from '@/components/Head'
import { Modal } from '@/components/Modal'
import { EditEpunchModal } from '@/components/EditEpunchModal'
import { EditGroupSizeModal } from '@/components/EditGroupSizeModal'
import { ManagerActionButton } from '@/components/ManagerActionButton'
import { StartGrid } from '@/components/grid/StartGrid'
import { ParticipantStateChangeButton } from '@/components/grid/ParticipantStateChangeButton'
import { AddParticipantModal, type AddParticipantPrefill } from '@/components/manager/AddParticipantModal'
import { OpenTimesPicker } from '@/components/manager/OpenTimesPicker'
import { changesTanCollection, participantsTanCollection, slotsTanCollection } from '@/database'
import type { Participant as ParticipantType, ParticipantState } from '@/api/participants'
import type { Slot as SlotType } from '@/api/slots'
import type { SlotDocType } from '@/Schema'
import {
    setCompetitive,
    setNewStartTime,
    setNonCompetitive,
    setStateNeedsAssignment,
    setStateNotAttending,
} from '@/actions/participantActions'
import { hydrateParticipant } from '@/utils/hydrateParticipant'
import { populateSlotData } from '@/utils/populateSlotData'
import { addMinutesToClock, courseShortLabel, formatSlotTime } from '@/utils/slotLabels'
import { getDisplayStates, ParticipantStateStyles } from '@/utils/styleHelpers'

interface Properties {
    clockTime?: string
    waveOffsetMinutes?: number
    readOnly?: boolean
    onRequestUnlock?: () => void
    onOpenInManager?: (participantId: string) => void
}

const GRID_STATE_BUTTONS: ParticipantState[] = [
    'waiting',
    'present',
    'validated',
    'wrongEpunch',
    'noShow',
]

export function FullGrid({ clockTime = '', waveOffsetMinutes = 8, readOnly = false, onRequestUnlock, onOpenInManager }: Properties) {
    const [activeParticipantId, setActiveParticipantId] = useState<string>('')
    const [movingParticipantId, setMovingParticipantId] = useState<string>('')
    const [showTimePickerInModal, setShowTimePickerInModal] = useState(false)
    const [isEpunchModalOpen, setIsEpunchModalOpen] = useState(false)
    const [isGroupSizeModalOpen, setIsGroupSizeModalOpen] = useState(false)
    const [addPrefill, setAddPrefill] = useState<AddParticipantPrefill | undefined>(undefined)
    const [bannerMessage, setBannerMessage] = useState<string>('')
    const [mobileCourseFilter, setMobileCourseFilter] = useState<string>('all')

    const { data: allSlots } = useLiveQuery((q) => q.from({ slot: slotsTanCollection }))
    const { data: allParticipants } = useLiveQuery((q) =>
        q.from({ participant: participantsTanCollection })
    )
    const { data: allChanges } = useLiveQuery((q) => q.from({ changes: changesTanCollection }))

    const data = populateSlotData(allSlots, allParticipants)
    const cutoff = addMinutesToClock(clockTime, waveOffsetMinutes)
    const courses = [...new Set(allSlots.map((s) => s.course))].sort()

    const DATA = {
        participants: allParticipants,
        slots: allSlots,
        changes: allChanges,
    }

    const activeHydrated =
        activeParticipantId !== '' ? hydrateParticipant(activeParticipantId, DATA) : undefined
    const movingHydrated =
        movingParticipantId !== '' ? hydrateParticipant(movingParticipantId, DATA) : undefined

    function showNotice(msg: string) {
        setBannerMessage(msg)
    }

    async function handleMoveParticipant(participantId: string, fromSlotId: string, toSlotId: string) {
        if (fromSlotId === toSlotId) return
        const p = allParticipants.find((x) => x.id === participantId)
        const toSlot = allSlots.find((s) => s.id === toSlotId)
        await setNewStartTime(participantId, fromSlotId, toSlotId)
        setMovingParticipantId('')
        if (p && toSlot) {
            showNotice(`Moved ${p.name} to ${toSlot.course} · ${toSlot.time}`)
        }
    }

    function handleParticipantClick(participant: ParticipantType, _slot: SlotType) {
        setActiveParticipantId(participant.id)
        setShowTimePickerInModal(false)
        setIsEpunchModalOpen(false)
        setIsGroupSizeModalOpen(false)
    }

    function handleOpenSlotClick(slot: SlotType) {
        if (movingHydrated !== undefined) {
            void handleMoveParticipant(movingHydrated.participant.id, movingHydrated.slotId, slot.id)
            return
        }
        setAddPrefill({
            name: '',
            club: '',
            epunch: '',
            isRental: false,
            isNonCompete: false,
            suggestedCourse: slot.course,
            targetSlotId: slot.id,
            targetTime: slot.time,
        })
    }

    function handleAssignFromPicker(slot: SlotDocType) {
        if (!activeHydrated) return
        void handleMoveParticipant(activeHydrated.participant.id, activeHydrated.slotId, slot.id)
        setShowTimePickerInModal(false)
        setActiveParticipantId('')
    }

    const availableModalStateButtons = activeHydrated ? GRID_STATE_BUTTONS : []

    const displayData =
        mobileCourseFilter === 'all'
            ? data
            : data.filter((s) => s.course === mobileCourseFilter)

    return (
        <>
            <Head title="Start Grid" />
            <div className="flex flex-col gap-2">
                {/* Crisp Action & Status Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border border-slate-300 bg-slate-50 px-3 py-1.5 text-xs text-slate-700">
                    <div className="flex flex-wrap items-center gap-3">
                        {!readOnly && movingHydrated !== undefined && (
                            <div className="flex items-center gap-2 border border-pink-600 bg-pink-50 px-2.5 py-1 text-xs font-semibold text-pink-950">
                                <span>
                                    Moving <strong>{movingHydrated.participant.name}</strong> — click any Open slot on the grid
                                </span>
                                <button
                                    type="button"
                                    onClick={() => setMovingParticipantId('')}
                                    className="border border-pink-600 bg-white px-1.5 py-0.5 text-xs font-semibold text-pink-900 hover:bg-pink-100">
                                    Cancel
                                </button>
                            </div>
                        )}
                        {!readOnly && bannerMessage !== '' && (
                            <div
                                role="status"
                                className="flex items-center gap-2 border border-emerald-600 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-950">
                                <span>{bannerMessage}</span>
                                <button
                                    type="button"
                                    onClick={() => setBannerMessage('')}
                                    className="px-1 text-emerald-800 hover:text-emerald-950">
                                    ×
                                </button>
                            </div>
                        )}
                    </div>
                    {readOnly ? (
                        onRequestUnlock !== undefined && (
                            <button
                                type="button"
                                onClick={onRequestUnlock}
                                className="border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800">
                                Unlock Editing (PIN)
                            </button>
                        )
                    ) : (
                        <button
                            type="button"
                            onClick={() =>
                                setAddPrefill({
                                    name: '',
                                    club: '',
                                    epunch: '',
                                    isRental: false,
                                    isNonCompete: false,
                                    suggestedCourse: courses[0] ?? 'c1',
                                })
                            }
                            className="border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-semibold text-white hover:bg-slate-800">
                            + Add Participant
                        </button>
                    )}
                </div>

                {/* Mobile Course Filter Pills */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 md:hidden">
                    <button
                        type="button"
                        onClick={() => setMobileCourseFilter('all')}
                        className={`shrink-0 border px-2.5 py-1 text-xs font-bold transition ${
                            mobileCourseFilter === 'all'
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                        }`}>
                        All courses
                    </button>
                    {courses.map((c) => {
                        const hint = courseShortLabel(c)
                        const isSelected = mobileCourseFilter === c
                        return (
                            <button
                                key={c}
                                type="button"
                                onClick={() => setMobileCourseFilter(c)}
                                className={`shrink-0 border px-2.5 py-1 text-xs font-bold transition ${
                                    isSelected
                                        ? 'border-slate-900 bg-slate-900 text-white'
                                        : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                                }`}>
                                {c}{hint ? ` (${hint})` : ''}
                            </button>
                        )
                    })}
                </div>

                <StartGrid
                    data={displayData}
                    columns="course"
                    selectedParticipantHydrated={readOnly ? undefined : (movingHydrated ?? activeHydrated)}
                    toStateButtons={[]}
                    onParticipantClick={readOnly ? undefined : handleParticipantClick}
                    onOpenSlotClick={readOnly ? undefined : handleOpenSlotClick}
                    onMoveParticipant={readOnly ? undefined : ((pid, fromId, toId) => void handleMoveParticipant(pid, fromId, toId))}
                />
            </div>

            {/* Participant Action Modal when clicking a runner on Full Grid */}
            {activeHydrated !== undefined && !isEpunchModalOpen && !isGroupSizeModalOpen && (
                <Modal
                    title={activeHydrated.participant.name}
                    close={() => {
                        setActiveParticipantId('')
                        setShowTimePickerInModal(false)
                    }}
                    content={
                        <div className="flex flex-col gap-4 text-slate-900">
                            <div className="flex flex-wrap items-center justify-between gap-2 border border-slate-300 bg-slate-50 p-3">
                                <div>
                                    <div className="text-base font-bold text-slate-900">
                                        Course {activeHydrated.course}
                                        {courseShortLabel(activeHydrated.course) !== ''
                                            ? ` (${courseShortLabel(activeHydrated.course)})`
                                            : ''}{' '}
                                        · {formatSlotTime(activeHydrated.time)}
                                    </div>
                                    <div className="mt-0.5 text-sm text-slate-600">
                                        {activeHydrated.participant.club &&
                                        activeHydrated.participant.club !== 'unknown' &&
                                        activeHydrated.participant.club !== 'None'
                                            ? activeHydrated.participant.club
                                            : 'Independent / No school'}{' '}
                                        · E-punch:{' '}
                                        <strong className="font-bold tabular-nums text-slate-900">
                                            {activeHydrated.participant.epunch || 'none'}
                                        </strong>
                                        {activeHydrated.participant.isRental ? ' (Rental)' : ''}
                                        {activeHydrated.participant.isNonCompete ? ' · Non-competitive' : ''}
                                    </div>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {getDisplayStates(activeHydrated.participant).map((st) => {
                                        const stStyle = ParticipantStateStyles.get(st)
                                        if (!stStyle) return null
                                        return (
                                            <span
                                                key={st}
                                                className={`px-2.5 py-1 text-xs font-semibold text-white ${stStyle.bg}`}>
                                                {stStyle.friendlyName}
                                            </span>
                                        )
                                    })}
                                </div>
                            </div>

                            {/* Status Buttons */}
                            <div>
                                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Status
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                    {availableModalStateButtons.map((st) => (
                                        <ParticipantStateChangeButton
                                            key={st}
                                            participant={activeHydrated.participant}
                                            toState={st}
                                        />
                                    ))}
                                </div>
                            </div>

                            {/* Actions */}
                            <div>
                                <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                    Actions
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    <ManagerActionButton
                                        text="Change start time"
                                        icon="clock"
                                        color="sky"
                                        buttonStyle={showTimePickerInModal ? 'solid' : 'outline'}
                                        action={() => setShowTimePickerInModal((v) => !v)}
                                    />
                                    <ManagerActionButton
                                        text="Select to click open slot on grid"
                                        icon="arrow-box"
                                        color="orange"
                                        buttonStyle="outline"
                                        action={() => {
                                            setMovingParticipantId(activeHydrated.participant.id)
                                            setActiveParticipantId('')
                                        }}
                                    />
                                    <ManagerActionButton
                                        text="Edit e-punch"
                                        icon="pencil"
                                        color="sky"
                                        buttonStyle="outline"
                                        action={() => setIsEpunchModalOpen(true)}
                                    />
                                    {activeHydrated.participant.isNonCompete ? (
                                        <ManagerActionButton
                                            text="Set competitive"
                                            icon="medal"
                                            color="purple"
                                            buttonStyle="outline"
                                            action={() => void setCompetitive(activeHydrated.participant.id)}
                                        />
                                    ) : (
                                        <ManagerActionButton
                                            text="Set non-competitive"
                                            icon="medal"
                                            color="purple"
                                            buttonStyle="outline"
                                            action={() => void setNonCompetitive(activeHydrated.participant.id)}
                                        />
                                    )}
                                    <ManagerActionButton
                                        text={
                                            activeHydrated.participant.groupSize > 1
                                                ? `Group size (${activeHydrated.participant.groupSize})`
                                                : 'Make group / Group size'
                                        }
                                        icon="group"
                                        color="emerald"
                                        buttonStyle="outline"
                                        action={() => setIsGroupSizeModalOpen(true)}
                                    />
                                    <ManagerActionButton
                                        text="Add 2nd course"
                                        icon="plus"
                                        color="emerald"
                                        buttonStyle="outline"
                                        action={() => {
                                            const p = activeHydrated.participant
                                            const idx = courses.indexOf(activeHydrated.course)
                                            const nextCourse =
                                                idx >= 0 && idx + 1 < courses.length
                                                    ? courses[idx + 1]!
                                                    : activeHydrated.course
                                            setActiveParticipantId('')
                                            setAddPrefill({
                                                name: p.name,
                                                club: p.club ?? '',
                                                epunch: p.epunch ?? '',
                                                isRental: true,
                                                isNonCompete: true,
                                                suggestedCourse: nextCourse,
                                            })
                                        }}
                                    />
                                    <ManagerActionButton
                                        text="Put on standby"
                                        icon="hourglass"
                                        color="orange"
                                        buttonStyle="outline"
                                        action={() => {
                                            void setStateNeedsAssignment(activeHydrated.participant.id)
                                            setActiveParticipantId('')
                                        }}
                                    />
                                    <ManagerActionButton
                                        text="Not attending"
                                        icon="x"
                                        color="red"
                                        buttonStyle="outline"
                                        action={() => {
                                            void setStateNotAttending(activeHydrated.participant.id)
                                            setActiveParticipantId('')
                                        }}
                                    />
                                    {onOpenInManager !== undefined && (
                                        <ManagerActionButton
                                            text="Open in Start Manager"
                                            icon="right"
                                            color="mauve"
                                            buttonStyle="outline"
                                            action={() => {
                                                const id = activeHydrated.participant.id
                                                setActiveParticipantId('')
                                                onOpenInManager(id)
                                            }}
                                        />
                                    )}
                                </div>
                            </div>

                            {showTimePickerInModal && (
                                <OpenTimesPicker
                                    participantId={activeHydrated.participant.id}
                                    participantName={activeHydrated.participant.name}
                                    participantClub={activeHydrated.participant.club ?? ''}
                                    currentCourse={activeHydrated.course}
                                    currentTime={activeHydrated.time}
                                    allSlots={allSlots}
                                    allParticipants={allParticipants}
                                    cutoff={cutoff}
                                    onAssign={handleAssignFromPicker}
                                    onClose={() => setShowTimePickerInModal(false)}
                                />
                            )}
                        </div>
                    }
                />
            )}

            {/* Edit E-punch Modal */}
            {activeHydrated !== undefined && isEpunchModalOpen && (
                <Modal
                    title={`Edit e-punch for ${activeHydrated.participant.name}`}
                    close={() => setIsEpunchModalOpen(false)}
                    content={
                        <EditEpunchModal
                            participant={activeHydrated}
                            closeModal={() => setIsEpunchModalOpen(false)}
                        />
                    }
                />
            )}

            {/* Edit Group Size Modal */}
            {activeHydrated !== undefined && isGroupSizeModalOpen && (
                <Modal
                    title={`Group size for ${activeHydrated.participant.name}`}
                    close={() => setIsGroupSizeModalOpen(false)}
                    content={
                        <EditGroupSizeModal
                            participant={activeHydrated}
                            closeModal={() => setIsGroupSizeModalOpen(false)}
                            onSaved={(oldSize, newSize) => {
                                if (oldSize === newSize) return
                                showNotice(
                                    newSize === 1
                                        ? `${activeHydrated.participant.name} set to Individual (1 person)`
                                        : `${activeHydrated.participant.name} set to Group of ${newSize}`
                                )
                            }}
                        />
                    }
                />
            )}

            {/* Add Participant Modal (triggered by clicking any Open cell or + Add Participant) */}
            {addPrefill !== undefined && (
                <Modal
                    title={
                        addPrefill.name !== ''
                            ? `Add 2nd Course for ${addPrefill.name}`
                            : addPrefill.targetTime
                              ? `Add Participant to ${addPrefill.suggestedCourse} · ${addPrefill.targetTime}`
                              : 'Add Participant to Meet'
                    }
                    close={() => setAddPrefill(undefined)}
                    content={
                        <AddParticipantModal
                            allParticipants={allParticipants}
                            allSlots={allSlots}
                            cutoff={cutoff}
                            prefill={addPrefill}
                            onCreated={(_newId, summary) => {
                                setAddPrefill(undefined)
                                showNotice(summary)
                            }}
                            onClose={() => setAddPrefill(undefined)}
                        />
                    }
                />
            )}
        </>
    )
}
