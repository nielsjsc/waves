import { type Slot as SlotType } from '@/api/slots'
import type { ParticipantState, Participant as ParticipantType } from '@/api/participants'
import { setNewStartTime } from '@/actions/participantActions'
import type { PopulatedEntry } from '@/utils/PopulatedEntry'
import { ParticipantStateStyles } from '@/utils/styleHelpers'
import { ParticipantStateChangeButton } from './ParticipantStateChangeButton'

type Size = 'compact' | 'large'

interface Properties {
    slot: SlotType
    selectedParticipantHydrated: PopulatedEntry | undefined
    itemOnClick?: undefined
    toStateButtons: ParticipantState[]
    // "large" is for the call-up and e-punch stations; everything else uses "compact".
    size?: Size
    // Dim the cell (used for the read-only "up next" column).
    muted?: boolean
}

// Every cell in a size has the same minimum height so rows line up whether a
// slot is occupied, open or unavailable.
const SIZES: Record<Size, { cell: string; pad: string; name: string; detail: string; badge: string }> = {
    compact: {
        cell: 'min-h-[2.5rem]',
        pad: 'px-1.5 py-0.5',
        name: 'text-sm leading-5',
        detail: 'text-[11px] leading-4',
        badge: 'text-[10px] leading-4',
    },
    large: {
        cell: 'min-h-[3.5rem]',
        pad: 'px-3 py-1.5',
        name: 'text-lg leading-6',
        detail: 'text-sm leading-5',
        badge: 'text-xs leading-5',
    },
}

function Badge({ className, title, children }: { className: string; title?: string; children: string }) {
    return (
        <span title={title} className={`shrink-0 rounded px-1 font-medium ${className}`}>
            {children}
        </span>
    )
}

function UnavailableCell({ size }: { size: Size }) {
    return (
        <div
            className={`${SIZES[size].cell} flex items-center justify-center rounded bg-gray-950/50 text-gray-700`}
            title="Not available">
            –
        </div>
    )
}

function OpenCell({
    slot,
    selected,
    size,
}: {
    slot: SlotType
    selected: PopulatedEntry | undefined
    size: Size
}) {
    // Only offer "Assign" when the selected participant is on this slot's course.
    // TODO: moving someone to a different course needs a course-change flow first.
    const canAssign = selected !== undefined && selected.course === slot.course

    return (
        <div
            className={`${SIZES[size].cell} flex items-center justify-between gap-1 rounded border border-dashed border-gray-700 px-2 text-gray-500 ${size === 'large' ? 'text-sm' : 'text-xs'}`}>
            <span className="italic">Open</span>
            {canAssign && (
                <button
                    className="rounded border border-amber-600/80 px-2 py-0.5 text-amber-300 hover:bg-amber-600/80 hover:text-white"
                    onClick={() =>
                        setNewStartTime(selected.participant.id, selected.slotId, slot.id)
                    }>
                    Assign
                </button>
            )}
        </div>
    )
}

function ParticipantCard({
    p,
    selected,
    toStateButtons,
    size,
}: {
    p: ParticipantType
    selected: boolean
    toStateButtons: ParticipantState[]
    size: Size
}) {
    const sz = SIZES[size]
    const large = size === 'large'
    const style = ParticipantStateStyles.get(p.state)!
    const notAttending = p.state === 'notAttending'
    const surface = selected ? 'bg-pink-950 ring-2 ring-pink-500' : 'bg-gray-800'
    // "unknown" is the importer's placeholder, not a real club name.
    const club = p.club === 'unknown' || p.club === 'None' ? '' : p.club

    return (
        <div
            data-participant-id={p.id}
            className={`${sz.cell} ${sz.pad} rounded ${surface} ${notAttending ? 'opacity-60' : ''} ${
                // Large cells put the buttons beside the text on wide screens, which keeps rows short.
                large ? 'flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-4' : ''
            }`}>
            <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-1.5">
                    <span
                        className={`truncate font-semibold text-gray-100 ${sz.name} ${notAttending ? 'line-through' : ''}`}
                        title={p.name}>
                        {p.name}
                    </span>
                    {/* Waiting is the default, so only other states get a label. */}
                    {p.state !== 'waiting' && (
                        <span
                            className={`ml-auto shrink-0 rounded px-1.5 font-medium text-white ${sz.badge} ${style.bg}`}>
                            {style.friendlyName}
                        </span>
                    )}
                </div>
                <div className={`flex min-w-0 items-center gap-1.5 text-gray-400 ${sz.detail}`}>
                    {p.groupSize > 1 && (
                        <Badge
                            className={`bg-emerald-800 text-emerald-100 ${sz.badge}`}
                            title={`Group of ${p.groupSize}`}>
                            {`Group ${p.groupSize}`}
                        </Badge>
                    )}
                    {p.isNonCompete && (
                        <Badge
                            className={`bg-indigo-800 text-indigo-100 ${sz.badge}`}
                            title="Non-competitive">
                            NC
                        </Badge>
                    )}
                    {p.isRental && (
                        <Badge
                            className={`bg-orange-800 text-orange-100 ${sz.badge}`}
                            title="Rental e-punch">
                            Rental
                        </Badge>
                    )}
                    <span className="min-w-0 truncate" title={club}>
                        {club}
                    </span>
                    <span
                        className={`ml-auto shrink-0 tabular-nums ${
                            large
                                ? 'rounded border border-gray-700 bg-gray-900/90 px-2 py-0.5 text-xl font-bold tracking-wider text-amber-200'
                                : 'text-gray-300'
                        }`}>
                        {p.epunch}
                    </span>
                </div>
            </div>
            {toStateButtons.length > 0 && (
                <div
                    className={
                        large
                            ? 'flex shrink-0 gap-2 [&_button]:min-h-11 [&_button]:px-4 [&_button]:text-base'
                            : 'mt-1 flex gap-1'
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
    )
}

export function GridSlot({
    slot,
    selectedParticipantHydrated,
    toStateButtons,
    size = 'compact',
    muted = false,
}: Properties) {
    if (slot.isUsable === false) {
        return <UnavailableCell size={size} />
    }
    if (slot.participants.length === 0) {
        return <OpenCell slot={slot} selected={selectedParticipantHydrated} size={size} />
    }
    return (
        <div className={`flex flex-col gap-0.5 ${muted ? 'opacity-75' : ''}`}>
            {slot.participants.map((p) => (
                <ParticipantCard
                    key={p.id}
                    p={p}
                    selected={p.id === selectedParticipantHydrated?.participant.id}
                    toStateButtons={toStateButtons}
                    size={size}
                />
            ))}
        </div>
    )
}