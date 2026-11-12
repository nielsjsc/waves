import { useEffect, useRef, type Ref } from 'react'
import { type Slot as SlotType } from '@/api/slots'
import type { Participant as ParticipantType, ParticipantState } from '@/api/participants'
import type { SlotDocType } from '@/Schema'
import type { PopulatedEntry } from '@/utils/PopulatedEntry'
import { GridSlot } from './GridSlot'
import { courseHeaderColor, courseShortLabel } from '@/utils/slotLabels'

// Layout sizes, in rem. Wide enough so full runner names are never cut off.
const COL_REM = 13 // one wave (when columns="time")
const BUTTON_COL_REM = 15 // first column when it carries state buttons (call-up, e-punch)
// Sticky first column: narrow for course names (c1) or compact time labels (09:42).
const labelRemFor = (columns: 'time' | 'course') => (columns === 'time' ? 4 : 3.25)

// "station" variant (call-up, e-punch): fills the width, with the wave being
// worked taking this share and the "up next" wave taking the rest.
const STATION_LABEL_REM = 6.5
const STATION_FIRST_COL_PERCENT = 62

interface Properties {
    data: SlotType[]
    // What runs across the top: "time" puts waves across and courses down the side.
    columns: 'time' | 'course'
    selectedParticipantHydrated: PopulatedEntry | undefined
    scrollTo?: Ref<HTMLTableRowElement>
    itemOnClick?: undefined
    toStateButtons: ParticipantState[]
    // Optional: highlight this wave's column and scroll it into view (columns="time" only).
    currentWave?: string
    // Optional: override the default max height of the scroll area.
    className?: string
    // "grid" (default) is the compact scrolling grid. "station" is the large
    // two-column layout for call-up and e-punch check.
    variant?: 'grid' | 'station'
    // For station layout on mobile: toggle between current and next wave
    mobileStationTab?: 'current' | 'next'
    // Optional text above each column's time, in column order (e.g. "Calling now", "Up next").
    columnLabels?: string[]
    // Optional interactive handlers for FullGrid
    onParticipantClick?: (participant: ParticipantType, slot: SlotType) => void
    onOpenSlotClick?: (slot: SlotType) => void
    onMoveParticipant?: (participantId: string, fromSlotId: string, toSlotId: string) => void
}

function getUniqueCoursesFromSlots(data: SlotType[]): string[] {
    const courses = new Set<string>()
    for (const slot of data) courses.add(slot.course)
    return [...courses].sort()
}

// Exported: also used by the header and the wave picker.
export function getUniqueTimesFromSlots(data: SlotType[] | SlotDocType[]): string[] {
    const times = new Set<string>()
    for (const slot of data) times.add(slot.time)
    return [...times].sort().filter((t) => !t.startsWith('_'))
}

interface GridRow {
    key: string
    slots: SlotType[]
}

function buildTable(data: SlotType[], columns: 'time' | 'course') {
    const courses = getUniqueCoursesFromSlots(data)
    const times = getUniqueTimesFromSlots(data)

    const lookup = new Map<string, SlotType>()
    for (const slot of data) {
        const key = `${slot.course}|${slot.time}`
        if (!lookup.has(key)) lookup.set(key, slot)
    }
    const slotAt = (course: string, time: string): SlotType =>
        lookup.get(`${course}|${time}`) ?? {
            id: `missing-${course}-${time}`,
            course,
            time,
            participants: [],
            isUsable: false,
        }

    const columnKeys = columns === 'time' ? times : courses
    const rowKeys = columns === 'time' ? courses : times
    const rows: GridRow[] = rowKeys.map((rowKey) => ({
        key: rowKey,
        slots: columnKeys.map((colKey) =>
            columns === 'time' ? slotAt(rowKey, colKey) : slotAt(colKey, rowKey)
        ),
    }))
    return { columnKeys, rows }
}

export function StartGrid({
    data,
    columns,
    selectedParticipantHydrated,
    scrollTo,
    itemOnClick,
    toStateButtons,
    currentWave,
    className,
    variant = 'grid',
    mobileStationTab = 'current',
    columnLabels,
    onParticipantClick,
    onOpenSlotClick,
    onMoveParticipant,
}: Properties) {
    const containerRef = useRef<HTMLDivElement>(null)
    const { columnKeys, rows } = buildTable(data, columns)
    const isStation = variant === 'station'

    // Keep the current wave in view as the clock moves (the station layout never scrolls sideways).
    useEffect(() => {
        if (isStation || !currentWave || columns !== 'time') return
        containerRef.current
            ?.querySelector<HTMLElement>(`th[data-wave="${currentWave}"]`)
            ?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
    }, [isStation, currentWave, columns])

    const labelRem = isStation ? STATION_LABEL_REM : labelRemFor(columns)
    const firstColumnHasButtons = toStateButtons.length > 0
    // Full Grid (columns === 'course') and station layouts fit 100% of the viewport width
    // so all 9 courses are visible at once without horizontal scrolling.
    const fitFullWidth = isStation || columns === 'course'

    const stationColVisibility = (i: number): string => {
        if (!isStation || columnKeys.length <= 1) return ''
        if (mobileStationTab === 'next') {
            return i === 0 ? 'hidden md:table-cell' : 'table-cell'
        }
        return i === 0 ? 'table-cell' : 'hidden md:table-cell'
    }

    // Width of each data column. In station mode only the first column is pinned
    // (to a percentage) and the next one takes whatever is left. In course-column mode
    // (Full Grid), columns share the remaining table width equally.
    const widthOf = (index: number): string | undefined => {
        if (isStation) {
            return columnKeys.length > 1 && index === 0 ? `${STATION_FIRST_COL_PERCENT}%` : undefined
        }
        if (columns === 'course') {
            return undefined
        }
        return `${firstColumnHasButtons && index === 0 ? BUTTON_COL_REM : COL_REM}rem`
    }
    const totalRem =
        labelRem +
        columnKeys.reduce((sum, _key, i) => sum + (firstColumnHasButtons && i === 0 ? BUTTON_COL_REM : COL_REM), 0)

    const isCurrentColumn = (key: string) => columns === 'time' && key === currentWave

    return (
        <div
            ref={containerRef}
            className={`isolate border border-slate-300 bg-white text-slate-900 ${className ?? (isStation ? 'overflow-x-hidden overflow-y-auto' : 'overflow-auto max-h-[calc(100vh_-_6rem)]')}`}>
            <table
                className={`table-fixed border-separate border-spacing-0 ${
                    columns === 'course' && columnKeys.length > 3
                        ? 'min-w-[54rem] md:min-w-0 w-full'
                        : fitFullWidth
                          ? 'w-full'
                          : ''
                }`}
                style={fitFullWidth ? undefined : { width: `${totalRem}rem` }}>
                {!isStation ? (
                    <colgroup>
                        <col style={{ width: `${labelRem}rem` }} />
                        {columnKeys.map((key, i) => (
                            <col key={key} style={{ width: widthOf(i) }} />
                        ))}
                    </colgroup>
                ) : (
                    <colgroup>
                        <col className="w-[4.5rem] sm:w-20 md:w-[6.5rem]" />
                        {columnKeys.map((key, i) => (
                            <col
                                key={key}
                                className={
                                    columnKeys.length > 1
                                        ? mobileStationTab === 'next'
                                            ? i === 0
                                                ? 'hidden md:table-column md:w-[62%]'
                                                : 'table-column md:w-[38%]'
                                            : i === 0
                                              ? 'table-column md:w-[62%]'
                                              : 'hidden md:table-column md:w-[38%]'
                                        : 'table-column'
                                }
                            />
                        ))}
                    </colgroup>
                )}
                <thead>
                    <tr>
                        <th className={`sticky left-0 top-0 z-30 border-b border-r border-slate-300 bg-slate-100 px-1 py-1 text-center text-xs font-bold uppercase tracking-wider text-slate-700 ${
                            isStation ? 'w-[4.5rem] sm:w-20 md:w-[6.5rem]' : ''
                        }`}>
                            {columns === 'time' ? 'Course' : 'Time'}
                        </th>
                        {columnKeys.map((key, i) => {
                            const label = columnLabels?.[i]
                            const current = isCurrentColumn(key)
                            const courseColor = columns === 'course' ? courseHeaderColor(key) : undefined
                            return (
                                <th
                                    key={key}
                                    data-wave={columns === 'time' ? key : undefined}
                                    data-course-header={columns === 'course' ? key : undefined}
                                    style={courseColor ? { backgroundColor: courseColor.bgHex } : undefined}
                                    className={`sticky top-0 z-20 border-b border-l border-slate-300 p-0 text-center tabular-nums leading-tight ${
                                        stationColVisibility(i)
                                    } ${
                                        isStation ? 'text-base' : 'text-sm'
                                    } ${
                                        current
                                            ? 'bg-emerald-700 font-bold text-white'
                                            : courseColor
                                              ? 'font-bold text-slate-950'
                                              : 'bg-slate-100 font-bold text-slate-800'
                                    }`}>
                                    <div className="px-1.5 py-1.5">
                                        {label && (
                                            <div
                                                className={`text-xs font-medium ${current ? 'text-emerald-100' : 'text-slate-500'}`}>
                                                {label}
                                            </div>
                                        )}
                                        <div>{key}</div>
                                        {columns === 'course' && courseShortLabel(key) !== '' && (
                                            <div className="text-[11px] font-semibold leading-tight text-slate-900">
                                                {courseShortLabel(key)}
                                            </div>
                                        )}
                                    </div>
                                </th>
                            )
                        })}
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        const containsSelected =
                            selectedParticipantHydrated !== undefined &&
                            row.slots.some((slot) =>
                                slot.participants.some(
                                    (p) => p.id === selectedParticipantHydrated.participant.id
                                )
                            )
                        return (
                            <tr
                                key={row.key}
                                className="h-px"
                                data-contains-selected-participant={containsSelected}
                                ref={containsSelected ? scrollTo : undefined}>
                                <th
                                    scope="row"
                                    className={`sticky left-0 z-10 border-b border-r border-slate-300 bg-slate-50 px-1 py-1 text-center font-bold tabular-nums text-slate-900 ${
                                        isStation ? 'w-[4.5rem] sm:w-20 md:w-[6.5rem]' : 'text-sm'
                                    }`}>
                                    <div className="flex flex-col items-center justify-center">
                                        <span className="text-sm sm:text-base font-extrabold text-slate-900 leading-tight">
                                            {row.key}
                                        </span>
                                        {columns === 'time' && courseShortLabel(row.key) !== '' && (
                                            <span className="mt-0.5 text-[10px] sm:text-xs font-semibold leading-tight text-slate-600 text-center break-words">
                                                {courseShortLabel(row.key)}
                                            </span>
                                        )}
                                    </div>
                                </th>
                                {row.slots.map((slot, i) => (
                                    <td
                                        key={`${slot.time}-${slot.course}`}
                                        className={`h-full border-b border-l border-slate-200 align-top ${
                                            stationColVisibility(i)
                                        } ${
                                            isStation ? 'px-1 py-0.5' : 'p-0.5'
                                        } ${
                                            isCurrentColumn(columns === 'time' ? slot.time : '')
                                                ? 'bg-emerald-50/70'
                                                : 'bg-white'
                                        }`}>
                                        <GridSlot
                                            slot={slot}
                                            selectedParticipantHydrated={
                                                selectedParticipantHydrated
                                            }
                                            itemOnClick={itemOnClick}
                                            // Buttons only on the first column: the wave being worked.
                                            toStateButtons={i === 0 ? toStateButtons : []}
                                            size={isStation && i === 0 ? 'large' : 'compact'}
                                            muted={isStation && i > 0}
                                            onParticipantClick={onParticipantClick}
                                            onOpenSlotClick={onOpenSlotClick}
                                            onMoveParticipant={onMoveParticipant}
                                        />
                                    </td>
                                ))}
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
    )
}
