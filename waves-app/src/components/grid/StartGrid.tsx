import {type Slot as SlotType} from '@/api/slots'
import type { JSX, Ref } from 'react'
import { GridSlot } from './GridSlot'
import type { PopulatedEntry } from '@/utils/PopulatedEntry'

interface Properties {
    data: SlotType[]
    columns: "time" | "course"
    selectedParticipantHydrated:PopulatedEntry|undefined
    scrollTo?:Ref<HTMLTableRowElement>
    itemOnClick?: Function
    itemButtons?: {icon:string, text:string, onClick:Function}[]
}

function getCourses(data:SlotType[]):string[] {
    return data.reduce<string[]>((previous, slot) =>
		previous.some( x => x === slot.course) ? previous : [...previous, slot.course]
	, []).sort()
}

function getTimes(data:SlotType[]):string[] {
    return data.reduce<string[]>((previous, slot) =>
		previous.some( x => x === slot.time) ? previous : [...previous, slot.time]
	, []).sort().filter(x => x.startsWith('_') === false)
}

function buildTableArray(data:SlotType[], columns:"time"|"course"):SlotType[][] {
    var tableData: SlotType[][] = [];
    if (columns === "time") {
        getCourses(data).forEach((c) => {
            var rowData: SlotType[] = [];
            getTimes(data).forEach((t) => {
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
        getTimes(data).forEach((t) => {
            var rowData: SlotType[] = [];
            getCourses(data).forEach((c) => {
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
        itemOnClick:Function|undefined, 
        itemButtons:{icon:string, text:string, onClick:Function}[]|undefined
    ): JSX.Element[] {
    if (rowData.length < 1) {
		return ([])
	} else {
		return (rowData.map((slot,) =>
		<td className='px-2 py-1' key={`SlotTd-${slot.time}-${slot.course}`}>
			<GridSlot 
                slot={slot} 
                selectedParticipantHydrated={selectedParticipantHydrated}
                itemOnClick={itemOnClick}
                itemButtons={itemButtons}
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
        itemOnClick:Function|undefined,
        itemButtons:{icon:string, text:string, onClick:Function}[]|undefined
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
            {renderSlotsInRow(rowData, selectedParticipantHydrated, itemOnClick, itemButtons)}
        </tr>
    )
}


export function StartGrid({data, columns, selectedParticipantHydrated, scrollTo, itemOnClick, itemButtons}: Properties) {
    const tableData = buildTableArray(data, columns)

    const firstHeader = columns === 'time' ? 'Course' : 'Time'
    const otherHeaders = columns === 'time' ? 
        getTimes(data).map((time) => <th key={`wave-${time}`}>{time}</th>) :
        getCourses(data).map((course) => <th key={`wave-${course}`}>{course}</th>)
    
    const rowType = columns === 'time' ? 'course' : 'time'
    const rows = tableData.map((row) => 
        renderRow(row, rowType, selectedParticipantHydrated, scrollTo, itemOnClick, itemButtons))

    return(
        <div className=''>
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