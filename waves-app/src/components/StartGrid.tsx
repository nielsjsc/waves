import {type Slot as SlotType} from '@/api/slots'
import type { JSX } from 'react'
import { Slot } from './Slot'

interface Properties {
    data: SlotType[]
    columns: "time" | "course"
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
                    rowData.push({course: c, time: t, participants: [], isUsable:false});
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
                    rowData.push({course: c, time: t, participants: [], isUsable:false});
                }
            })
            tableData.push(rowData);
        })
    }
    return tableData
}


function renderSlotsInRow(rowData:SlotType[]): JSX.Element[] {
    if (rowData.length < 1) {
		return ([])
	} else {
		return (rowData.map((slot,) =>
		<td className='px-2 py-1' key={`SlotTd-${slot.time}-${slot.course}`}>
			<Slot slot={slot} key={`SlotCard-${slot.time}-${slot.course}`} />
		</td>
	))
	}

}

function renderCourseRow(rowData:SlotType[]): JSX.Element {
    if (rowData.length < 1) {
        return <tr></tr>
    } else {
        const firstSlot = rowData[0]!
        const courseName = firstSlot.course
        return (
            <tr key={`CourseRow-${courseName}`}>
                <td key={`CourseTd-${courseName}`} className='font-bold text-center'>{courseName}</td>
                {renderSlotsInRow(rowData)}
            </tr>
        )
    }
}

function renderTimeRow(rowData:SlotType[]): JSX.Element {
    if (rowData.length < 1) {
        return <tr></tr>
    } else {
        const firstSlot = rowData[0]!
        const time = firstSlot.time
        return (
            <tr key={`CourseRow-${time}`}>
                <td key={`CourseTd-${time}`} className='font-bold text-center'>{time}</td>
                {renderSlotsInRow(rowData)}
            </tr>
        )
    }
}


function renderTimeColsTable(tableData:SlotType[][], times:string[]):JSX.Element {
    return (
        <div className='overflow-x-auto'>
            <table className="table-fixed">
                <thead>
                    <tr key='gridHeaderRow'>
                        <th>Course</th>
                        {times.map((time) => <th key={`wave-${time}`}>{time}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {tableData.map((row) => {
                        return renderCourseRow(row);
                    })}
                </tbody>
            </table>
        </div>
    )
}

function renderCourseColsTable(tableData:SlotType[][], courses:string[]):JSX.Element {
    return (
<div className='overflow-x-auto'>
    <table className="table-fixed">
        <thead>
            <tr key='gridHeaderRow'>
                <th>Time</th>
                {courses.map((course) => <th key={`wave-${course}`}>{course}</th>)}
            </tr>
        </thead>
        <tbody>
            {tableData.map((row) => {
                return renderTimeRow(row);
            })}
        </tbody>
    </table>
</div>
    )
}

export function StartGrid({data, columns}: Properties) {

    const tableData = buildTableArray(data, columns)

    if (columns === "time") {
        return renderTimeColsTable(tableData, getTimes(data))
    } else if (columns === "course") {
        return renderCourseColsTable(tableData, getCourses(data))
    } else {
        throw new Error("Unknown table column type")
    }
}

