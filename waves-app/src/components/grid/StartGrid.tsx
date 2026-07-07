import {type Slot as SlotType} from '@/api/slots'
import type { JSX, Ref } from 'react'
import { GridSlot } from './GridSlot'
import type { PopulatedEntry } from '@/utils/PopulatedEntry'
import type { SlotDocType } from '@/Schema'
import type { ParticipantState } from '@/api/participants'

interface Properties {
    data: SlotType[]
    columns: "time" | "course"
    selectedParticipantHydrated:PopulatedEntry|undefined
    scrollTo?:Ref<HTMLTableRowElement>
    itemOnClick?: undefined
    toStateButtons: ParticipantState[]
}

function getUniqueCoursesFromSlots(data:SlotType[]):string[] {
    return data.reduce<string[]>((previous, slot) =>
		previous.some( x => x === slot.course) ? previous : [...previous, slot.course]
	, []).sort()
}

export function getUniqueTimesFromSlots(data:SlotType[]|SlotDocType[]):string[] {
    return data.reduce<string[]>((previous, slot) =>
		previous.some( x => x === slot.time) ? previous : [...previous, slot.time]
	, []).sort().filter(x => x.startsWith('_') === false)
}

function buildTableArray(data:SlotType[], columns:"time"|"course"):SlotType[][] {
    var tableData: SlotType[][] = [];
    if (columns === "time") {
        getUniqueCoursesFromSlots(data).forEach((c) => {
            var rowData: SlotType[] = [];
            getUniqueTimesFromSlots(data).forEach((t) => {
                var thisSlot = data.find(x => x.course === c && x.time === t);
                if (thisSlot) {
                    rowData.push(thisSlot);
                } else {
                    rowData.push({id: crypto.randomUUID(), course: c, time: t, participants: [], isUsable:false});
                }
            })
            tableData.push(rowData);
        })
    } else if (columns === "course") {
        getUniqueTimesFromSlots(data).forEach((t) => {
            var rowData: SlotType[] = [];
            getUniqueCoursesFromSlots(data).forEach((c) => {
                var thisSlot = data.find(x => x.course === c && x.time === t);
                if (thisSlot) {
                    rowData.push(thisSlot);
                } else {
                    rowData.push({id: crypto.randomUUID(), course: c, time: t, participants: [], isUsable:false});
                }
            })
            tableData.push(rowData);
        })
    }
    return tableData
}


function renderSlotsInRow(
        rowData:SlotType[], 
        selectedParticipantHydrated:PopulatedEntry|undefined,
        itemOnClick:undefined, 
        toStateButtons:ParticipantState[]
    ): JSX.Element[] {
    if (rowData.length < 1) {
		return ([])
	} else {
        const firstSlot = rowData.shift()!
        const firstItem = [<td className='px-2 py-1' key={`SlotTd-${firstSlot.time}-${firstSlot.course}`}>
			<GridSlot 
                slot={firstSlot} 
                selectedParticipantHydrated={selectedParticipantHydrated}
                itemOnClick={itemOnClick}
                toStateButtons={toStateButtons}
                key={`SlotCard-${firstSlot.time}-${firstSlot.course}`} />
		</td>]
		return firstItem.concat(rowData.map((slot,) =>
		<td className='px-2 py-1' key={`SlotTd-${slot.time}-${slot.course}`}>
			<GridSlot 
                slot={slot} 
                selectedParticipantHydrated={selectedParticipantHydrated}
                itemOnClick={itemOnClick}
                toStateButtons={[]}
                key={`SlotCard-${slot.time}-${slot.course}`} />
		</td>
	))
	}
}

function renderRow(
        rowData:SlotType[], 
        rowType:'time'|'course', 
        selectedParticipantHydrated:PopulatedEntry|undefined,
        scrollTo:Ref<HTMLTableRowElement>|undefined,
        itemOnClick:undefined,
        toStateButtons:ParticipantState[]
    ): JSX.Element {
    if (rowData.length === 0) {
        return <tr></tr>
    }
    const firstSlot = rowData[0]!
    const rowKeyIdentifier = rowType === 'time' ? firstSlot.time : firstSlot.course
    const rowKey = `${rowType}Row-${rowKeyIdentifier}`
    const rowNameKey = `${rowType}RowName-${rowKeyIdentifier}`
    const containsSelected = selectedParticipantHydrated ? rowData.flatMap(x => x.participants.map(p=>p.id)).includes(selectedParticipantHydrated.participant.id) : false
    const ref = containsSelected ? scrollTo : undefined
    return (
        <tr key={rowKey} data-contains-selected-participant={containsSelected} ref={ref}>
            <td key={rowNameKey} className='font-bold text-center'>{rowKeyIdentifier}</td>
            {renderSlotsInRow(rowData, selectedParticipantHydrated, itemOnClick, toStateButtons)}
        </tr>
    )
}


export function StartGrid({data, columns, selectedParticipantHydrated, scrollTo, itemOnClick, toStateButtons}: Properties) {
    const tableData = buildTableArray(data, columns)

    const firstHeader = columns === 'time' ? 'Course' : 'Time'
    const otherHeaders = columns === 'time' ? 
        getUniqueTimesFromSlots(data).map((time) => <th key={`wave-${time}`}>{time}</th>) :
        getUniqueCoursesFromSlots(data).map((course) => <th key={`wave-${course}`}>{course}</th>)
    
    const rowType = columns === 'time' ? 'course' : 'time'
    const rows = tableData.map((row) => 
        renderRow(row, rowType, selectedParticipantHydrated, scrollTo, itemOnClick, toStateButtons))

    return(
        <div className='flex flex-col'>
            <table className="table-fixed">
                <thead>
                    <tr key='gridHeaderRow'>
                        <th>{firstHeader}</th>
                        {otherHeaders}
                    </tr>
                </thead>
                <tbody>
                    {rows}
                </tbody>
            </table>
        </div>
    )
}