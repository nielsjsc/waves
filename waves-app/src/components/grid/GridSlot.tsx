import { type Slot as SlotType } from '@/api/slots'
import type {Participant as ParticipantType} from '@/api/participants'
import type { JSX } from 'react'
import { ParticipantStateIcon } from '../ParticipantStateIcon'
import { SvgIcon } from '../SvgIcon'
import { participantsTanCollection } from '@/database'
import { SlotStateTag } from '../SlotStateTag'
import { groupTag, ncTag } from '../Tags'
import { setNewStartTime, setStatePresent, setStateWaiting } from '@/actions/participantActions'

interface Properties {
    slot: SlotType
    selectedParticipantId: string
    selectedParticipantSlotId: string
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

function displayAvailable(slotId:string, selectedParticipantId:string, selectedParticipantSlotId:string):JSX.Element {
    // TODO
    // if someone is selected already on this course, allow direct assignment
    // if someone is selected NOT on this course, then need to prompt for a new class before assigning to this time/slot

    function slotContent():JSX.Element {
        // if no one is selected, don't show the assign button at all
        if (selectedParticipantId === '' || selectedParticipantId === undefined) {
            return <span className='p-1 italic place-self-center'>Available</span>
        } else {
            return(
            <button 
                className={`rounded m-1 px-2 py-1 bg-amber-600 hover:bg-amber-800`}
                onClick={()=>setNewStartTime(selectedParticipantId, selectedParticipantSlotId, slotId)} >
                <span className="flex flex-column">
                    <SvgIcon icon="arrow-box"/>
                    Assign
                </span>
            </button>
            )
        }
    }

    return (
        <div className='border-2 border-solid rounded-md flex flex-row items-stretch'>
            <SlotStateTag state="available"/>
            {slotContent()}
        </div>
    )
}

function displayParticipant(p:ParticipantType, selectedParticipantId:string):JSX.Element {
    const notAttendingStyle:string = p.state === "notAttending" ? 'opacity-60 line-through' : ''
    const borderColor:string = p.id === selectedParticipantId ? 'border-4 border-pink-600 bg-pink-800 text-white' : ''
    return (
        <div className={`border-2 border-solid ${borderColor} rounded-md flex flex-row min-w-2xs`}>
            <SlotStateTag state={p.state}/>
            <div className={`flex flex-col p-1 ${notAttendingStyle}`}>
                <span className='flex flex-row items-center'>
                    <span>{p.name} {groupTag(p)} {ncTag(p)}</span>
                </span>
                <span className='text-sm'>{p.club}</span>
            </div>
            <div className='flex flex-row p-1 items-center ml-auto'>
                <button 
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
                </button>
            </div>
        </div>
    )
}

function displayParticipants(participants:ParticipantType[], highlightParticipant:string):JSX.Element {
    const cards = participants.map((p) => displayParticipant(p, highlightParticipant))
    return (
        <div>
            {cards}
        </div>
    )
}

async function handleSetPresent2(e:React.MouseEvent<HTMLButtonElement,MouseEvent>) {
    const participantId = e.currentTarget.getAttribute('data-participant-id');
    if (participantId === null) {
        return;
    }
    const p = participantsTanCollection.get(participantId)
    if (p?.state === "waiting") {
        setStatePresent(participantId);
    } else if (p?.state === "present") {
        setStateWaiting(participantId);
    }
    return
}

export function GridSlot({slot, selectedParticipantId, selectedParticipantSlotId}: Properties) {
    if (slot.isUsable === false) {
        return displayNotAvailable()
    } else if (slot.participants.length === 0) {        
        return displayAvailable(slot.id, selectedParticipantId, selectedParticipantSlotId)
    } else if (slot.participants.length === 1) {
        return displayParticipant(slot.participants[0]!, selectedParticipantId)
    } else {
        return displayParticipants(slot.participants, selectedParticipantId)
    }
}