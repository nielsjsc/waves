import { Head } from "@/components/Head";
import { Header } from "@/components/Header";
import { participantsTanCollection, slotsTanCollection } from "@/database";
import type { ParticipantDocType } from "@/Schema";
import { populateSlotData } from "@/utils/populateSlotData";
import { useLiveQuery } from "@tanstack/react-db";
import { useEffect, useState, type JSX } from "react";
import { pivotSlotsToEntries, } from "@/utils/pivotSlotsToEntries";
import { Entry } from "@/components/Entry";


export function Manager() {

    const [nameQuery, setNameQuery] = useState('');
    const [nameQueryDebounced, setNameQueryDebounced] = useState('');
    const [clubQuery, setClubQuery] = useState('');
    const [clubQueryDebounced, setClubQueryDebounced] = useState('');

    const {data: allParticipants} = useLiveQuery((q) =>
        q.from({participant: participantsTanCollection})
    )

    const {data: allSlots} = useLiveQuery((q) =>
        q.from({slot: slotsTanCollection})
    )

    function searchByName(q:string):ParticipantDocType[] {
        if (q.length < 2) {
            return []
        }
        return (allParticipants.filter(x => x.name.toLocaleLowerCase().includes(q.toLocaleLowerCase()))) 
    }

    function searchByClub(q:string):ParticipantDocType[] {
        if (q.length < 2) {
            return []
        }
        return(allParticipants.filter(x => x.club?.toLocaleLowerCase().includes(q.toLocaleLowerCase())))
    }

    function commonSearchResults(a:ParticipantDocType[], b:ParticipantDocType[]):ParticipantDocType[] {
        if (a.length === 0 && b.length === 0) {
            return(allParticipants)
        }
        if (a.length === 0 || b.length === 0) {
            return(a.concat(b))
        }
        return(a.filter(x => b.includes(x)))
    }

    function getParticipantSlots(participants:ParticipantDocType[]) {
        const pids:string[] = participants.map(x => x.id)
        return (allSlots.filter(x => x.participants?.some(x => pids.includes(x))))
    }

    const handleNameQueryChange = (event:React.ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();
        setNameQuery(event.target.value);
    }
    useEffect(() => {
        const nameDebouncer = setTimeout(() => setNameQueryDebounced(nameQuery), 500);
        return () => clearTimeout(nameDebouncer)
        }, 
        [nameQuery, 500]
    )

    const handleClubQueryChange = (event:React.ChangeEvent<HTMLInputElement>) => {
        event.preventDefault();
        setClubQuery(event.target.value);
    }
    useEffect(() => {
        const clubDebouncer = setTimeout(() => setClubQueryDebounced(clubQuery), 500);
        return () => clearTimeout(clubDebouncer)
        }, 
        [clubQuery, 500]
    )

    const nameQueryResults = searchByName(nameQueryDebounced)
    const clubQueryResults = searchByClub(clubQueryDebounced)
    const combinedResults = commonSearchResults(nameQueryResults, clubQueryResults)
    const populatedSlots = populateSlotData(getParticipantSlots(combinedResults), combinedResults)
    const entries = pivotSlotsToEntries(populatedSlots).sort((a,b) => (a.participant.name.localeCompare(b.participant.name)))

    return (
        <>
            <Head title='Tent 1: Call-up' />
            <Header/>
            <div className='flex flex-col'>
                <h1 className='title-font text-2xl font-medium p-2'>Start Manager. Wave: 10:02 <span className='text-base'>next in 29s</span></h1>
                <div className='text-base p-2'>
                    <div>
                        <form>
                            <label htmlFor='search-name' className="text-lg">Search by Name: </label>
                            <input 
                                id='search-name'
                                type="text"
                                className="border border-solid border-2 p-1 rounded text-lg"
                                placeholder="name"
                                onChange={handleNameQueryChange}
                                value={nameQuery}
                            />
                        </form>
                        <form>
                            <label htmlFor='search-club' className="text-lg">Search by School/Club: </label>
                            <input 
                                id='search-club'
                                type="text"
                                className="border border-solid border-2 p-1 rounded text-lg"
                                placeholder="school / club"
                                onChange={handleClubQueryChange}
                                value={clubQuery}
                            />
                        </form>
                    </div>
                    <div className="flex flex-wrap">
                        {entries.map(e => <Entry entry={e} key={e.participant.id} />)}
                    </div> 
                </div>  
            </div>
        </>
    )
}