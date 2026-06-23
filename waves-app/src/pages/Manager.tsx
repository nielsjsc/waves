import { participantsTanCollection, slotsTanCollection } from "@/database";
import { useLiveQuery } from "@tanstack/react-db";

import { Head } from "@/components/Head";
import { Header } from "@/components/Header";
import { useState } from "react";
import { Search } from "@/components/Search";
import { populateEntryForParticipantId } from "@/utils/populateEntryForParticipantId";
import { Entry } from "@/components/Entry";
import { setNonCompetitive, setCompetitive, setStateNotAttending } from "@/actions/participantActions";
import { populateSlotData } from "@/utils/populateSlotData";
import { StartGrid } from "@/components/grid/StartGrid";
import { ManagerActionButton } from "@/components/ManagerActionButton";


export function Manager() {

    const [isSearchOpen, setSearchOpen] = useState(false)
    const [selectedParticipantId, setSelectedParticipantId] = useState('')

    const {data: allParticipants} = useLiveQuery((q) =>
        q.from({participant: participantsTanCollection})
    )
    const {data: allSlots} = useLiveQuery((q) =>
        q.from({slot: slotsTanCollection})
        )

    const selectedParticipantEntry = populateEntryForParticipantId(selectedParticipantId, allParticipants, allSlots)
 
    const slotsAtThisTime = selectedParticipantEntry?.time.startsWith('_') ? [] : populateSlotData(allSlots.filter(x => x.time === selectedParticipantEntry?.time), allParticipants)
    const slotsOnThisCourse = selectedParticipantEntry?.course === '' ? [] : populateSlotData(allSlots.filter(x => x.course === selectedParticipantEntry?.course), allParticipants)

    function toggleSearch() {
        if (isSearchOpen) {
            setSearchOpen(false);
        } else {
            setSearchOpen(true);
        }
    }



    const searchOverlay = isSearchOpen ? 
            <div className="fixed top-0 left-0 h-screen m-8 border z-50 px-8 py-4 bg-gray-700 overflow-y-auto"
            >
                <Search setParticipant={setSelectedParticipantId} closeSearch={()=>setSearchOpen(false)}/>
            </div> :
            <div></div>

    const selectedParticipantCard = 
        (selectedParticipantId === '' || selectedParticipantEntry === undefined) ? <div className="italic">Search for a participant to edit</div> :
        <Entry entry={selectedParticipantEntry} highlight={true}/>

    const competitiveToggle = selectedParticipantEntry === undefined ? <></> :
    selectedParticipantEntry!.participant.isNonCompete ? 
        <ManagerActionButton
            text="Set Competitive"
            action={()=>setCompetitive(selectedParticipantId)}
            icon="medal" /> 
        : <ManagerActionButton
            text="Set Non-Competitive"
            action={()=>setNonCompetitive(selectedParticipantId)}
            icon="medal" />  

    const actionsOrSearchPrompt = selectedParticipantEntry === undefined ? 
        <div className="">Select a participant to populate actions</div> :
        <div className="flex flex-wrap flex-row p-1 gap-2">
            <ManagerActionButton 
                action={()=>{}}
                text="Edit Name"
                icon="pencil" />
            <ManagerActionButton 
                action={()=>{}}
                text="Edit Epunch"
                icon="pencil" />
            <ManagerActionButton 
                action={()=>{}}
                text="Change Class/Course"
                icon="pencil" />
            {competitiveToggle}
            <ManagerActionButton 
                action={()=>setStateNotAttending(selectedParticipantId, selectedParticipantEntry!.slotId, selectedParticipantEntry!.course)}
                text="Mark as Not Attending"
                icon="x" />
            <ManagerActionButton 
                action={()=>{}}
                text="&nbsp;Change Group"
                icon="group" />
        </div>
        
        
    
    return (
        <>
            <Head title='Start Manager' />
            <div className="flex flex-col">
                <Header/>

                <div className="container mx-auto flex flex-col items-center">

                    {searchOverlay}

                    <div className="flex flex-row p-1 items-center gap-2">
                        <div>
                            {selectedParticipantCard}
                        </div>
                        <ManagerActionButton
                            action={toggleSearch}
                            text="&nbsp;Search"
                            icon="search" />
                    </div>

                    <h3 className="text-2xl mt-2">Actions</h3>
                    {actionsOrSearchPrompt}

                    <div className="flex flex-row flex-wrap mt-4"> {/*Slot Lists*/}
                        <div className="flex flex-col min-w-md">
                            <h3 className="text-2xl text-center">All starts at {selectedParticipantEntry?.time}</h3>
                            <div className="max-h-155 overflow-scroll">
                            <StartGrid data={slotsAtThisTime} highlightParticipant={selectedParticipantId} columns="time" />
                            </div>
                        </div>
                        <div className="flex flex-col min-w-md">
                            <h3 className="text-2xl text-center">All starts on course {selectedParticipantEntry?.course}</h3>
                            <div className="max-h-155 overflow-scroll">
                            <StartGrid data={slotsOnThisCourse} highlightParticipant={selectedParticipantId} columns="course" />
                            </div>
                        </div>
                    </div> {/*Slot Lists*/}

                </div> {/*body area*/}
            </div> {/*page*/}
            
            
        </>
    )
}