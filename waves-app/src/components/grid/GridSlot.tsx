import { useState, useEffect } from 'react'
import { type Slot as SlotType } from '@/api/slots'
import type { ParticipantState, Participant as ParticipantType } from '@/api/participants'
import { setNewEpunch, setNewStartTime } from '@/actions/participantActions'
import type { PopulatedEntry } from '@/utils/PopulatedEntry'
import { getDisplayStates, ParticipantStateStyles } from '@/utils/styleHelpers'
import { ParticipantStateChangeButton } from './ParticipantStateChangeButton'

type Size = 'compact' | 'large'

export const DRAG_MIME_TYPE = 'application/x-waves-participant'

export interface DragParticipantPayload {
    participantId: string
    fromSlotId: string
    participantName: string
    fromCourse: string
}

interface Properties {
    slot: SlotType
    selectedParticipantHydrated: PopulatedEntry | undefined
    itemOnClick?: undefined
    toStateButtons: ParticipantState[]
    // "large" is for the call-up and e-punch stations; everything else uses "compact".
    size?: Size
    // Dim the cell (used for the read-only "up next" column).
    muted?: boolean
    // Interactive callbacks (used on FullGrid and optionally elsewhere)
    onParticipantClick?: (participant: ParticipantType, slot: SlotType) => void
    onOpenSlotClick?: (slot: SlotType) => void
    onMoveParticipant?: (participantId: string, fromSlotId: string, toSlotId: string) => void
}

// Every cell in a size has the same minimum height AND h-full so all boxes in a row
// stretch to the exact same height even when a neighbor wraps to multiple lines.
const SIZES: Record<Size, { cell: string; pad: string; name: string; detail: string; badge: string }> = {
    compact: {
        cell: 'h-full min-h-[2.75rem]',
        pad: 'px-1.5 py-1',
        name: 'text-xs leading-4',
        detail: 'text-[11px] leading-4',
        badge: 'text-[10px] leading-4',
    },
    large: {
        cell: 'h-full min-h-[2.65rem] sm:min-h-[3.25rem]',
        pad: 'px-1.5 py-0.5 sm:px-3 sm:py-1.5',
        name: 'text-xs sm:text-base leading-snug',
        detail: 'text-[11px] sm:text-sm leading-tight',
        badge: 'text-[10px] sm:text-xs leading-none',
    },
}

function Badge({ className, title, children }: { className: string; title?: string; children: string }) {
    return (
        <span title={title} className={`shrink-0 border px-1 font-semibold ${className}`}>
            {children}
        </span>
    )
}

function UnavailableCell({ size }: { size: Size }) {
    return (
        <div
            className={`${SIZES[size].cell} flex items-center justify-center bg-slate-100 text-slate-400 select-none`}
            title="Not available">
            –
        </div>
    )
}

function OpenCell({
    slot,
    selected,
    size,
    onOpenSlotClick,
    onMoveParticipant,
}: {
    slot: SlotType
    selected: PopulatedEntry | undefined
    size: Size
    onOpenSlotClick?: (slot: SlotType) => void
    onMoveParticipant?: (participantId: string, fromSlotId: string, toSlotId: string) => void
}) {
    const [isDragOver, setIsDragOver] = useState(false)
    const canAssign = selected !== undefined && selected.course === slot.course
    const isClickable = onOpenSlotClick !== undefined

    function handleDragOver(e: React.DragEvent) {
        if (!onMoveParticipant) return
        if (e.dataTransfer.types.includes(DRAG_MIME_TYPE) || e.dataTransfer.types.includes('text/plain')) {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            if (!isDragOver) setIsDragOver(true)
        }
    }

    function handleDragLeave() {
        if (isDragOver) setIsDragOver(false)
    }

    function handleDrop(e: React.DragEvent) {
        if (!onMoveParticipant) return
        e.preventDefault()
        setIsDragOver(false)
        const raw = e.dataTransfer.getData(DRAG_MIME_TYPE) || e.dataTransfer.getData('text/plain')
        if (!raw) return
        try {
            const payload = JSON.parse(raw) as DragParticipantPayload
            if (payload.participantId && payload.fromSlotId && payload.fromSlotId !== slot.id) {
                onMoveParticipant(payload.participantId, payload.fromSlotId, slot.id)
            }
        } catch {
            // ignore malformed drag data
        }
    }

    return (
        <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => {
                if (isClickable) onOpenSlotClick(slot)
            }}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={(e) => {
                if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onOpenSlotClick(slot)
                }
            }}
            title={isClickable ? `Click to add or assign a participant to ${slot.course} at ${slot.time}` : undefined}
            className={`${SIZES[size].cell} group flex items-center justify-between gap-1 border border-dashed px-2 transition-colors ${
                isDragOver
                    ? 'border-sky-600 bg-sky-100 text-sky-900 ring-1 ring-sky-600'
                    : isClickable
                      ? 'cursor-pointer border-slate-300 bg-slate-50 text-slate-600 hover:border-slate-500 hover:bg-slate-100 hover:text-slate-900'
                      : 'border-slate-300 bg-slate-50 text-slate-500'
            } ${size === 'large' ? 'text-sm' : 'text-xs'}`}>
            <span className={isDragOver ? 'font-semibold' : ''}>
                {isDragOver ? 'Drop here' : 'Open'}
            </span>
            {canAssign ? (
                <button
                    type="button"
                    className="border border-amber-600 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-900 hover:bg-amber-600 hover:text-white"
                    onClick={(e) => {
                        e.stopPropagation()
                        setNewStartTime(selected.participant.id, selected.slotId, slot.id)
                    }}>
                    Assign
                </button>
            ) : (
                isClickable &&
                !isDragOver && (
                    <span className="text-[11px] font-medium text-slate-400 opacity-0 group-hover:opacity-100">
                        + Add
                    </span>
                )
            )}
        </div>
    )
}

function ParticipantCard({
    p,
    slot,
    selected,
    toStateButtons,
    size,
    onParticipantClick,
    onMoveParticipant,
}: {
    p: ParticipantType
    slot: SlotType
    selected: boolean
    toStateButtons: ParticipantState[]
    size: Size
    onParticipantClick?: (participant: ParticipantType, slot: SlotType) => void
    onMoveParticipant?: (participantId: string, fromSlotId: string, toSlotId: string) => void
}) {
    const [isDragging, setIsDragging] = useState(false)
    const [inlineEpunch, setInlineEpunch] = useState('')
    const [inlineIsRental, setInlineIsRental] = useState(Boolean(p.isRental))
    const sz = SIZES[size]
    const large = size === 'large'
    const displayStates = getDisplayStates(p)
    const notAttending = p.state === 'notAttending'
    const isClickable = onParticipantClick !== undefined
    const isDraggable = onMoveParticipant !== undefined
    const showInlineEpunchEditor =
        large && toStateButtons.includes('wrongEpunch') && displayStates.includes('wrongEpunch')

    useEffect(() => {
        setInlineIsRental(Boolean(p.isRental))
    }, [p.isRental])

    const surface = selected
        ? 'border-pink-600 bg-pink-50 ring-2 ring-pink-600'
        : 'border-slate-300 bg-white hover:border-slate-400'
    // "unknown" is the importer's placeholder, not a real club name.
    const club = p.club === 'unknown' || p.club === 'None' ? '' : p.club

    function handleDragStart(e: React.DragEvent) {
        if (!isDraggable) return
        setIsDragging(true)
        const payload: DragParticipantPayload = {
            participantId: p.id,
            fromSlotId: slot.id,
            participantName: p.name,
            fromCourse: slot.course,
        }
        const json = JSON.stringify(payload)
        e.dataTransfer.setData(DRAG_MIME_TYPE, json)
        e.dataTransfer.setData('text/plain', json)
        e.dataTransfer.effectAllowed = 'move'
    }

    function handleDragEnd() {
        setIsDragging(false)
    }

    return (
        <div
            data-participant-id={p.id}
            draggable={isDraggable}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            onClick={() => {
                if (isClickable) onParticipantClick(p, slot)
            }}
            role={isClickable ? 'button' : undefined}
            tabIndex={isClickable ? 0 : undefined}
            onKeyDown={(e) => {
                if (isClickable && (e.key === 'Enter' || e.key === ' ')) {
                    e.preventDefault()
                    onParticipantClick(p, slot)
                }
            }}
            title={
                isDraggable && isClickable
                    ? `${p.name} — Click for options or drag to an open start time`
                    : p.name
            }
            className={`${sz.cell} ${sz.pad} flex flex-1 flex-col justify-between border transition-colors ${surface} ${
                notAttending ? 'opacity-60' : ''
            } ${isDragging ? 'opacity-40 ring-2 ring-sky-500' : ''} ${
                isClickable ? 'cursor-pointer hover:bg-slate-50' : ''
            } ${
                large
                    ? 'gap-1 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-4'
                    : 'gap-0.5'
            }`}>
            <div className="min-w-0 flex-1 flex flex-col justify-center">
                <div className="flex flex-wrap items-baseline gap-1.5">
                    <span
                        className={`font-bold text-slate-900 break-words whitespace-normal ${sz.name} ${
                            notAttending ? 'line-through text-slate-500' : ''
                        }`}
                        title={p.name}>
                        {p.name}
                    </span>
                    {/* Waiting is the default, so only other states get a label. */}
                    {displayStates.length > 0 && (
                        <div className="flex shrink-0 flex-wrap gap-1">
                            {displayStates.map((st) => {
                                const stStyle = ParticipantStateStyles.get(st)!
                                return (
                                    <span
                                        key={st}
                                        className={`shrink-0 px-1.5 py-0.5 font-bold text-white ${sz.badge} ${stStyle.bg}`}>
                                        {stStyle.friendlyName}
                                    </span>
                                )
                            })}
                        </div>
                    )}
                </div>
                <div className={`mt-0.5 flex flex-wrap items-center gap-1 sm:gap-1.5 text-slate-600 ${sz.detail}`}>
                    {p.isSecondCourse && (
                        <Badge
                            className={`border-purple-600 bg-purple-50 text-purple-800 ${sz.badge}`}
                            title="Running a second course">
                            2nd course
                        </Badge>
                    )}
                    {p.needsWaiver && (
                        <Badge
                            className={`border-red-700 bg-red-600 text-white font-extrabold ${sz.badge}`}
                            title="Parent has not signed shadow waiver">
                            N
                        </Badge>
                    )}
                    {p.needsPayment && (
                        <Badge
                            className={`border-red-700 bg-red-600 text-white font-extrabold ${sz.badge}`}
                            title="Needs payment">
                            Need $
                        </Badge>
                    )}
                    {p.groupSize > 1 && (
                        <Badge
                            className={`border-emerald-600 bg-emerald-50 text-emerald-800 ${sz.badge}`}
                            title={`Group of ${p.groupSize}`}>
                            {`Group ${p.groupSize}`}
                        </Badge>
                    )}
                    {p.isNonCompete && (
                        <Badge
                            className={`border-indigo-600 bg-indigo-50 text-indigo-800 ${sz.badge}`}
                            title="Non-competitive">
                            NC
                        </Badge>
                    )}
                    {p.isRental && (
                        <Badge
                            className={`border-orange-600 bg-orange-50 text-orange-800 ${sz.badge}`}
                            title="Rental e-punch">
                            Rental
                        </Badge>
                    )}
                    {p.hasRentedCompass && (
                        <Badge
                            className={`border-amber-700 bg-amber-50 text-amber-900 ${sz.badge}`}
                            title="Rented compass">
                            Compass
                        </Badge>
                    )}
                    {club !== '' && (
                        <span className={`min-w-0 truncate text-slate-600 ${large ? 'hidden sm:inline' : ''}`} title={club}>
                            {club}
                        </span>
                    )}
                    {/* Inline on desktop station mode or in compact mode */}
                    <span
                        className={`tabular-nums ${
                            large
                                ? 'hidden lg:inline border border-slate-400 bg-slate-100 px-2 py-0 text-base font-bold tracking-wider text-slate-900 leading-5'
                                : 'ml-auto shrink-0 font-medium text-slate-700'
                        }`}>
                        {p.epunch}
                    </span>
                </div>
            </div>

            {(toStateButtons.length > 0 || (large && p.epunch)) && (
                <div className={
                    large
                        ? 'flex shrink-0 items-center justify-between lg:justify-end gap-2'
                        : 'mt-1 flex gap-1'
                }>
                    {/* On mobile station mode, display e-punch badge next to buttons */}
                    {large && (
                        <span
                            className="lg:hidden shrink-0 tabular-nums border border-slate-400 bg-slate-100 px-1.5 py-0.5 text-xs font-bold tracking-wider text-slate-900 leading-none">
                            {p.epunch}
                        </span>
                    )}

                    {toStateButtons.length > 0 && (
                        <div className={
                            large
                                ? 'flex shrink-0 items-center gap-1 sm:gap-2 [&_button]:min-h-7 sm:[&_button]:min-h-8 lg:[&_button]:min-h-10 [&_button]:px-2 sm:[&_button]:px-2.5 lg:[&_button]:px-3 [&_button]:py-0.5 sm:[&_button]:py-1 lg:[&_button]:py-1.5 [&_button]:text-xs sm:[&_button]:text-sm lg:[&_button]:text-base [&_svg]:size-3.5 sm:[&_svg]:size-4 lg:[&_svg]:size-5'
                                : 'flex gap-1'
                        }>
                            {toStateButtons.map((toState) => (
                                <ParticipantStateChangeButton
                                    key={toState}
                                    participant={p}
                                    toState={toState}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}

            {showInlineEpunchEditor && (
                <form
                    onClick={(e) => e.stopPropagation()}
                    onSubmit={async (e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        const trimmed = inlineEpunch.trim()
                        if (!trimmed) return
                        await setNewEpunch(p.id, trimmed, inlineIsRental)
                        setInlineEpunch('')
                    }}
                    className="mt-1.5 flex w-full flex-wrap items-center gap-2 border-t border-pink-200 bg-pink-50/70 px-2 py-1.5">
                    <label className="text-xs font-bold text-pink-950">New e-punch #:</label>
                    <input
                        type="text"
                        inputMode="numeric"
                        autoFocus
                        value={inlineEpunch}
                        onChange={(e) => setInlineEpunch(e.target.value)}
                        placeholder={p.epunch ? `Was ${p.epunch}` : 'Enter e-punch #'}
                        className="min-w-[8rem] flex-1 border border-slate-400 bg-white px-2 py-1 text-sm font-bold tabular-nums text-slate-900 focus:border-sky-600 focus:outline-none focus:ring-1 focus:ring-sky-600"
                    />
                    <div className="flex shrink-0 items-center border border-slate-300 bg-white text-xs font-semibold">
                        <button
                            type="button"
                            onClick={() => setInlineIsRental(false)}
                            className={`px-2 py-1 ${
                                !inlineIsRental ? 'bg-slate-800 text-white' : 'text-slate-700 hover:bg-slate-100'
                            }`}>
                            Own
                        </button>
                        <button
                            type="button"
                            onClick={() => setInlineIsRental(true)}
                            className={`border-l border-slate-300 px-2 py-1 ${
                                inlineIsRental ? 'bg-orange-600 text-white' : 'text-slate-700 hover:bg-slate-100'
                            }`}>
                            Rental
                        </button>
                    </div>
                    <button
                        type="submit"
                        disabled={inlineEpunch.trim() === ''}
                        className="shrink-0 bg-emerald-700 px-3 py-1 text-xs sm:text-sm font-bold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500">
                        Save e-punch
                    </button>
                </form>
            )}
        </div>
    )
}

export function GridSlot({
    slot,
    selectedParticipantHydrated,
    toStateButtons,
    size = 'compact',
    muted = false,
    onParticipantClick,
    onOpenSlotClick,
    onMoveParticipant,
}: Properties) {
    if (slot.isUsable === false) {
        return <UnavailableCell size={size} />
    }
    if (slot.participants.length === 0) {
        return (
            <OpenCell
                slot={slot}
                selected={selectedParticipantHydrated}
                size={size}
                onOpenSlotClick={onOpenSlotClick}
                onMoveParticipant={onMoveParticipant}
            />
        )
    }
    return (
        <div className={`flex h-full flex-col gap-0.5 ${muted ? 'opacity-75' : ''}`}>
            {slot.participants.map((p) => (
                <ParticipantCard
                    key={p.id}
                    p={p}
                    slot={slot}
                    selected={p.id === selectedParticipantHydrated?.participant.id}
                    toStateButtons={toStateButtons}
                    size={size}
                    onParticipantClick={onParticipantClick}
                    onMoveParticipant={onMoveParticipant}
                />
            ))}
        </div>
    )
}
