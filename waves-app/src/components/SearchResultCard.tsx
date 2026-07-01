import { type PopulatedEntry } from "@/utils/PopulatedEntry"
import { SlotStateTag } from "./SlotStateTag"
import { groupTag, ncTag, rentTag } from "./Tags"
import { ColorStyles } from "@/utils/styleHelpers"

interface Properties {
    entry: PopulatedEntry
    highlight: boolean
}

export function SearchResultCard({entry, highlight=false}: Properties) {
    const notAttendingStyle:string = entry.participant.state === "notAttending" ? 'opacity-60 line-through' : ''

    const borderColor = highlight ? `border-4 ${ColorStyles.get('pink')!.border}` : ''

    const originalStartRow = entry.participant.startChanged ? 
        <tr><td colSpan={2}>Original Start: {entry.participant.originalStartTime}</td></tr> :
        <></>

    return(
    <div 
        key={`entry-${entry.participant.id}`}
        className={`m-2 border-2 border-solid ${borderColor} rounded-md flex flex-row min-w-2xs max-w-md`}
        >
        <SlotStateTag state={entry.participant.state}/>
        <table className={`m-1 table-auto grow ${notAttendingStyle}`}>
            <tbody>
            <tr>
                <td>{entry.participant.name} {groupTag(entry.participant)} {ncTag(entry.participant)} {rentTag(entry.participant)}</td>
                <td></td>
            </tr>
            <tr>
                <td><span className='text-sm'>{entry.participant.club}</span>&nbsp;&nbsp;&nbsp;&nbsp;SI #: {entry.participant.epunch}</td>
                <td></td>
            </tr>
            <tr>
                <td colSpan={2}>{entry.time}&nbsp;&nbsp;&nbsp;&nbsp;{entry.course}-(class)</td>
            </tr>
            {originalStartRow}
            </tbody>
        </table>
    </div>
    )
}