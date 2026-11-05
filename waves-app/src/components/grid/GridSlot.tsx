import { useState } from 'react'
import { type Slot as SlotType } from '@/api/slots'
import type { ParticipantState, Participant as ParticipantType } from '@/api/participants'
import { setNewStartTime } from '@/actions/participantActions'
import type { PopulatedEntry } from '@/utils/PopulatedEntry'
import { ParticipantStateStyles } from '@/utils/styleHelpers'
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
        pad: 'px-2 py-1',
        name: 'text-xs leading-4',
        detail: 'text-[11px] leading-4',
        badge: 'text-[10px] leading-4',
    },
    large: {
        cell: 'h-full min-h-[2.85rem]',
        pad: 'px-3 py-1.5',
        name: 'text-base leading-5',
        detail: 'text-sm leading-5',
        badge: 'text-xs leading-4',
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
                      ? 'cursor-pointer border-slate-300 bg-white text-slate-500 hover:border-slate-500 hover:bg-slate-50 hover:text-slate-900'
                      : 'border-slate-300 bg-white text-slate-400'
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
    const sz = SIZES[size]
    const large = size === 'large'
    const style = ParticipantStateStyles.get(p.state)!
    const notAttending = p.state === 'notAttending'
    const isClickable = onParticipantClick !== undefined
    const isDraggable = onMoveParticipant !== undefined

    // Enforce mutual exclusion in the UI:
    // - A runner marked No Show at Call-up cannot be marked Wrong E-punch or Validated until checked in.
    // - A runner already at E-punch Check (Validated or Wrong E-punch) cannot be marked No Show.
    const allowedStateButtons = toStateButtons.filter((btnState) => {
        if (p.state === 'noShow' && (btnState === 'wrongEpunch' || btnState === 'validated')) {
            return false
        }
        if ((p.state === 'wrongEpunch' || p.state === 'validated') && btnState === 'noShow') {
            return false
        }
        return true
    })

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
                // Large cells put the buttons beside the text on wide screens, which keeps rows short.
                large ? 'gap-1 lg:flex-row lg:items-center lg:gap-4' : ''
            }`}>
            <div className="min-w-0 flex-1 flex flex-col justify-between h-full">
                <div className="flex items-start justify-between gap-1.5">
                    <span
                        className={`break-words whitespace-normal font-semibold text-slate-900 ${sz.name} ${
                            notAttending ? 'line-through text-slate-500' : ''
                        }`}>
                        {p.name}
                    </span>
                    {/* Waiting is the default, so only other states get a label. */}
                    {p.state !== 'waiting' && (
                        <span
                            className={`ml-auto shrink-0 px-1.5 font-semibold text-white ${sz.badge} ${style.bg}`}>
                            {style.friendlyName}
                        </span>
                    )}
                </div>
                <div className={`mt-0.5 flex flex-wrap items-center gap-1.5 text-slate-600 ${sz.detail}`}>
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
                    {club !== '' && (
                        <span className="min-w-0 truncate text-slate-600" title={club}>
                            {club}
                        </span>
                    )}
                    <span
                        className={`ml-auto shrink-0 tabular-nums ${
                            large
                                ? 'border border-slate-400 bg-slate-100 px-2 py-0 text-base font-bold tracking-wider text-slate-900 leading-5'
                                : 'font-medium text-slate-700'
                        }`}>
                        {p.epunch}
                    </span>
                </div>
            </div>
            {allowedStateButtons.length > 0 && (
                <div
                    className={
                        large
                            ? 'flex shrink-0 gap-2 [&_button]:min-h-9 [&_button]:px-3 [&_button]:py-1 [&_button]:text-sm [&_svg]:size-5'
                            : 'mt-1 flex gap-1'
                    }>
                    {allowedStateButtons.map((toState) => (
                        <ParticipantStateChangeButton
                            key={toState}
                            participant={p}
                            toState={toState}
                        />
                    ))}
                </div>
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
