import { type Slot as SlotType } from '@/api/slots'
import type {Participant as ParticipantType} from '@/api/participants'
import { type JSX } from 'react'
import { SvgIcon } from '../SvgIcon'
import { SlotStateTag } from '../SlotStateTag'
import { groupTag, ncTag } from '../Tags'
import { setNewStartTime, } from '@/actions/participantActions'
import type { PopulatedEntry } from '@/utils/PopulatedEntry'

interface Properties {
    slot: SlotType
    selectedParticipantHydrated:PopulatedEntry|undefined,
    itemOnClick: Function|undefined
    itemButtons: {icon:string, text:string, onClick:Function}[]|undefined
}

function displayNotAvailable():JSX.Element {
    return (
        <div className='border-2 border-solid rounded-md flex flex-row brightness-50'>
        <div className='flex flex-col p-1 italic'>NOT Available</div>
        <div className='flex flex-row p-1 items-center ml-auto'>
            <SvgIcon icon="dots-vertical"/>
        </div>
        </div>
    )
}

function displayAvailable(slot:SlotType, selectedParticipantHydrated:PopulatedEntry|undefined):JSX.Element {
    // TODO
    // if someone is selected NOT on this course, then need to prompt for a new class before assigning to this time/slot

    function assignButton():JSX.Element {
        if (selectedParticipantHydrated === undefined){
            return <></>
        }

        if (selectedParticipantHydrated.course === slot.course) {
            return (
            <div className='flex flex-row p-1 items-center ml-auto'>
                <button 
                    className={`rounded m-1 px-2 py-1 border border-2 border-amber-600/80 text-amber-300/60 hover:bg-amber-600/80 hover:text-white`}
                    onClick={()=>setNewStartTime(selectedParticipantHydrated.participant.id, selectedParticipantHydrated.slotId, slot.id)} >
                    <span className="flex flex-column">
                        <SvgIcon icon="arrow-box"/>
                        <span className='text-sm place-self-center'>Assign</span>
                    </span>
                </button>
            </div>
        )} else {
            return <></>
        }
    }

    return (
        <div className='border-2 border-solid rounded-md flex flex-row items-stretch'>
            <SlotStateTag state="available"/>
            <span className='p-1 italic place-self-center text-amber-100/60'>Available</span>
            {/* {button} */}
            {assignButton()}
        </div>
    )
}

function displayParticipant(p:ParticipantType, highlightEntry:PopulatedEntry|undefined):JSX.Element {
    const notAttendingStyle:string = p.state === "notAttending" ? 'opacity-60 line-through' : ''
    const borderColor:string = p.id === highlightEntry?.participant.id ? 'border-4 border-pink-600 bg-pink-800 text-white' : ''
    return (
        <div className={`border-2 border-solid ${borderColor} rounded-md flex flex-row min-w-2xs`} key={p.id} data-participant-id={p.id}>
            <SlotStateTag state={p.state}/>
            <div className={`flex flex-col p-1 ${notAttendingStyle}`}>
                <span className='flex flex-row items-center'>
                    <span>{p.name} {groupTag(p)} {ncTag(p)}</span>
                </span>
                <span className='text-sm'>{p.club}</span>
            </div>
            <div className='flex flex-row p-1 items-center ml-auto'>
                {/* <button 
                    className='bg-sky-200 rounded-sm p-1'
                    onClick={(e) => handleSetPresent2(e)}
                    data-participant-id={p.id}
                    >
                    <ParticipantStateIcon state="present"/>
                </button>
                <button 
                    className='rounded-sm p-1 bg-slate-600 ml-1'
                    >
                    <SvgIcon icon="dots-vertical"/>
                </button> */}
            </div>
        </div>
    )
}

function displayParticipants(participants:ParticipantType[], highlightEntry:PopulatedEntry|undefined):JSX.Element {
    const cards = participants.map((p) => displayParticipant(p, highlightEntry))
    return (
        <div>
            {cards}
        </div>
    )
}

export function GridSlot({slot, selectedParticipantHydrated, itemOnClick, itemButtons}: Properties) {

    if (slot.isUsable === false) {
        return displayNotAvailable()
    } else if (slot.participants.length === 0) {        
        return displayAvailable(slot, selectedParticipantHydrated)
    } else {
        return displayParticipants(slot.participants, selectedParticipantHydrated)
    }
}