import { useEffect, useRef, type Ref } from 'react'
import { type Slot as SlotType } from '@/api/slots'
import type { ParticipantState } from '@/api/participants'
import type { SlotDocType } from '@/Schema'
import type { PopulatedEntry } from '@/utils/PopulatedEntry'
import { GridSlot } from './GridSlot'
import { courseShortLabel } from '@/utils/slotLabels'

// Layout sizes, in rem. Tweak these to fit more or fewer waves on screen.
const COL_REM = 9.5 // one wave (or one course)
const BUTTON_COL_REM = 14 // first column when it carries state buttons (call-up, e-punch)
// Sticky first column: narrow for course names (c1), a bit wider for times (09:42).
const labelRemFor = (columns: 'time' | 'course') => (columns === 'time' ? 3.5 : 4.5)

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
    // Optional text above each column's time, in column order (e.g. "Calling now", "Up next").
    columnLabels?: string[]
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
    columnLabels,
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

    // Width of each data column. In station mode only the first column is pinned
    // (to a percentage) and the next one takes whatever is left.
    const widthOf = (index: number): string | undefined => {
        if (isStation) {
            return columnKeys.length > 1 && index === 0 ? `${STATION_FIRST_COL_PERCENT}%` : undefined
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
            className={`isolate overflow-auto rounded-lg border border-gray-800 bg-gray-900 text-gray-100 ${className ?? 'max-h-[calc(100vh_-_6rem)]'}`}>
            <table
                className={`table-fixed border-separate border-spacing-0 ${isStation ? 'w-full' : ''}`}
                style={isStation ? undefined : { width: `${totalRem}rem` }}>
                <colgroup>
                    <col style={{ width: `${labelRem}rem` }} />
                    {columnKeys.map((key, i) => (
                        <col key={key} style={{ width: widthOf(i) }} />
                    ))}
                </colgroup>
                <thead>
                    <tr>
                        <th className="sticky left-0 top-0 z-30 border-b border-r border-gray-700 bg-gray-900 px-2 py-1 text-left text-xs font-normal text-gray-400">
                            {columns === 'time' ? 'Course' : 'Time'}
                        </th>
                        {columnKeys.map((key, i) => {
                            const label = columnLabels?.[i]
                            const current = isCurrentColumn(key)
                            return (
                                <th
                                    key={key}
                                    data-wave={columns === 'time' ? key : undefined}
                                    className={`sticky top-0 z-20 border-b border-gray-700 px-2 text-center tabular-nums ${
                                        isStation ? 'py-2 text-lg' : 'py-1 text-sm'
                                    } ${
                                        current
                                            ? 'bg-emerald-900 font-bold text-emerald-100'
                                            : 'bg-gray-900 font-semibold text-gray-300'
                                    }`}>
                                    {label && (
                                        <div
                                            className={`text-xs font-normal ${current ? 'text-emerald-200' : 'text-gray-400'}`}>
                                            {label}
                                        </div>
                                    )}
                                    <div>{key}</div>
                                    {columns === 'course' && courseShortLabel(key) !== '' && (
                                        <div className="text-[11px] font-normal leading-tight text-gray-400">
                                            {courseShortLabel(key)}
                                        </div>
                                    )}
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
                                data-contains-selected-participant={containsSelected}
                                ref={containsSelected ? scrollTo : undefined}>
                                <th
                                    scope="row"
                                    className={`sticky left-0 z-10 border-b border-r border-gray-800 bg-gray-900 px-2 text-center font-bold text-gray-200 ${
                                        isStation ? 'text-base' : 'text-sm'
                                    }`}>
                                    <div>{row.key}</div>
                                    {columns === 'time' && courseShortLabel(row.key) !== '' && (
                                        <div className="text-[11px] font-normal leading-tight text-gray-400">
                                            {courseShortLabel(row.key)}
                                        </div>
                                    )}
                                </th>
                                {row.slots.map((slot, i) => (
                                    <td
                                        key={`${slot.time}-${slot.course}`}
                                        className={`border-b border-l border-gray-800 align-top ${
                                            isStation ? 'p-1' : 'p-0.5'
                                        } ${
                                            isCurrentColumn(columns === 'time' ? slot.time : '')
                                                ? 'bg-emerald-950/40'
                                                : ''
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