import { type Entry as EntryType } from "@/utils/pivotSlotsToEntries"
import { SlotStateTag } from "./SlotStateTag"
import { SvgIcon } from "./SvgIcon"
import { groupTag, ncTag, rentTag } from "./Tags"

interface Properties {
    entry: EntryType
}

export function Entry({entry}: Properties) {
    const notAttendingStyle:string = entry.participant.state === "notAttending" ? 'opacity-60 line-through' : ''
    return(
    <div 
        key={`entry-${entry.participant.id}`}
        className='m-2 border-2 border-solid rounded-md flex flex-row min-w-2xs max-w-md'
        >
        <SlotStateTag state={entry.participant.state}/>
        <table className='m-1 table-auto grow'>
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
            </tbody>
        </table>
        <div className='flex flex-row p-1 items-center ml-auto'>
            <button 
                className='rounded-sm p-1 bg-slate-600 ml-1'
                >
                <SvgIcon icon="dots-vertical"/>
            </button>
        </div>
    </div>
    )
}