import {type Slot as SlotType} from '@/api/slots'
import type { JSX } from 'react'
import { GridSlot } from './GridSlot'

interface Properties {
    data: SlotType[]
    columns: "time" | "course"
    highlightParticipant: string
}

function getCourses(data:SlotType[]):string[] {
    return data.reduce<string[]>((previous, slot) =>
		previous.some( x => x === slot.course) ? previous : [...previous, slot.course]
	, []).sort()
}

function getTimes(data:SlotType[]):string[] {
    return data.reduce<string[]>((previous, slot) =>
		previous.some( x => x === slot.time) ? previous : [...previous, slot.time]
	, []).sort()
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


function renderSlotsInRow(rowData:SlotType[], highlightParticipant:string): JSX.Element[] {
    if (rowData.length < 1) {
		return ([])
	} else {
		return (rowData.map((slot,) =>
		<td className='px-2 py-1' key={`SlotTd-${slot.time}-${slot.course}`}>
			<GridSlot slot={slot} highlightParticipant={highlightParticipant} key={`SlotCard-${slot.time}-${slot.course}`} />
		</td>
	))
	}

}

function renderRow(rowData:SlotType[], rowType:'time'|'course', highlightParticipant:string): JSX.Element {
    if (rowData.length === 0) {
        return <tr></tr>
    }
    const firstSlot = rowData[0]!
    const rowKeyIdentifier = rowType === 'time' ? firstSlot.time : firstSlot.course
    const rowKey = `${rowType}Row-${rowKeyIdentifier}`
    const rowNameKey = `${rowType}RowName-${rowKeyIdentifier}`
    return (
        <tr key={rowKey}>
            <td key={rowNameKey} className='font-bold text-center'>{rowKeyIdentifier}</td>
            {renderSlotsInRow(rowData, highlightParticipant)}
        </tr>
    )
}

function renderTimeColsTable(tableData:SlotType[][], times:string[], highlightParticipant:string):JSX.Element {
    return (
        <div className=''>
            <table className="table-fixed">
                <thead>
                    <tr key='gridHeaderRow'>
                        <th>Course</th>
                        {/* START TIMES */}
                        {times.map((time) => <th key={`wave-${time}`}>{time}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {tableData.map((row) => {
                        return renderRow(row, 'course', highlightParticipant);
                    })}
                </tbody>
            </table>
        </div>
    )
}

function renderCourseColsTable(tableData:SlotType[][], courses:string[], highlightParticipant:string):JSX.Element {
    return (
<div className=''>
    <table className="table-fixed">
        <thead>
            <tr key='gridHeaderRow'>
                <th>Time</th>
                {/* COURSE NAMES */}
                {courses.map((course) => <th key={`wave-${course}`}>{course}</th>)}
            </tr>
        </thead>
        <tbody>
            {tableData.map((row) => {
                return renderRow(row, 'time', highlightParticipant);
            })}
        </tbody>
    </table>
</div>
    )
}

export function StartGrid({data, columns, highlightParticipant}: Properties) {

    const tableData = buildTableArray(data, columns)

    if (columns === "time") {
        return renderTimeColsTable(tableData, getTimes(data), highlightParticipant)
    } else if (columns === "course") {
        return renderCourseColsTable(tableData, getCourses(data), highlightParticipant)
    } else {
        throw new Error("Unknown table column type")
    }
}

