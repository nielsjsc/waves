// adapted from https://github.com/mertJF/tailblocks

import { dropAllParticipants, dropAllSlots, participantsCollection, slotsCollection } from "@/database";
import type { JSX } from "react";
import { promise } from "valibot";

const LOGO = <svg
   width="24"
   height="24"
   viewBox="0 0 24 24"
   version="1.1"
   id="svg1"
   xmlns="http://www.w3.org/2000/svg">
  <defs
     id="defs1" />
  <g
     id="layer1">
    <path
       fill="none" stroke="currentColor" strokeWidth="1.13386" strokeLinecap="round"
       d="m 1.2319215,10.270986 v 3.458028"
       id="path1" />
    <path
       fill="none" stroke="currentColor" strokeWidth="1.13386" strokeLinecap="round"
       d="M 3.9239411,7.4768171 V 16.523183"
       id="path2" />
    <path
       fill="#none" stroke="currentColor" strokeWidth="1.1386" strokeLinecap="round"
       d="M 6.6159607,8.9936962 V 15.006304"
       id="path3" />
    <path
       fill="none" stroke="currentColor" strokeWidth="1.13386" strokeLinecap="round"
       d="M 9.3079804,5.5200909 V 18.479909"
       id="path4" />
    <path
       fill="none" stroke="currentColor" strokeWidth="1.13386" strokeLinecap="round"
       d="M 12,1.9333646 V 22.066636"
       id="path6" />
    <path
       fill="none" stroke="currentColor" strokeWidth="1.13386" strokeLinecap="round"
       d="M 14.692019,3.7919452 V 20.208055"
       id="path7" />
    <path
       fill="#none" stroke="currentColor" strokeWidth="1.1386" strokeLinecap="round"
       d="M 17.384039,8.3595775 V 15.640423"
       id="path8" />
    <path
       fill="none" stroke="currentColor" strokeWidth="1.13386" strokeLinecap="round"
       d="M 20.076058,6.0011641 V 17.998836"
       id="path9" />
    <path
       d="m 22.768078,10.239286 v 3.521428"
       fill="none" stroke="currentColor" strokeWidth="1.13386" strokeLinecap="round"
       id="path1-8" />
  </g>
</svg>

async function insertMockData() {
    const MRid = crypto.randomUUID()
    const NJid = crypto.randomUUID()
    const TWid = crypto.randomUUID()
    const TKid = crypto.randomUUID()
    const VMid = crypto.randomUUID()
    const GWid = crypto.randomUUID()
    const DBid = crypto.randomUUID()
    const EJid = crypto.randomUUID()
    const WEid = crypto.randomUUID()
    const BFid = crypto.randomUUID()
    const IUid = crypto.randomUUID()
    const GNid = crypto.randomUUID()
    const MBid = crypto.randomUUID()
    const LBid = crypto.randomUUID()
    const MFid = crypto.randomUUID()
    const LTid = crypto.randomUUID()

    const tx1 = participantsCollection.insert([
        {id: MRid, name: 'Marissa Roecks Group(4)', club: 'Cascade OC', state: 'waiting'},
        {id: NJid, name: 'Nate Jergensen', club: 'Summit Trails Middle', state: 'waiting'},
        {id: TWid, name: 'Traci Weygandt', club: 'Cascade OC', state: 'waiting'},
        {id: TKid, name: 'Thomas Kornelis', club: 'Bremerton', state: 'waiting'},
        {id: VMid, name: 'Venna Menzie', club: 'Tahoma', state: 'waiting'},
        {id: GWid, name: 'Graham Winters', club: 'Tahoma', state: 'waiting'},
        {id: DBid, name: 'Danny Buchholz', club: 'Shorewood', state: 'waiting'},
        {id: IUid, name: 'Ing Uhlin', club: "Cascade OC", state: 'waiting'},
        {id: EJid, name: 'Eric Jones', club: "Cascade OC", state: 'waiting'},

        {id: MBid, name: 'Millie Rebbeck', club: 'Seattle Country Day', state: 'waiting'},
        {id: LBid, name: 'Logan Burdette', club: 'Northwood Middle', state: 'present'},
        {id: MFid, name: 'Maria Franzie Ventolero', club: 'Oak Harbor', state: 'validated'},
        {id: LTid, name: 'Logan Taylor', club: 'Arlington', state: 'noShow'},
        
        {id: BFid, name: 'Bob Forgrave', club: "Cascade OC", state: 'notAttending'},
        {id: GNid, name: 'Gina Nuss', club: "Orienteer Kansas", state: 'needsAssignment'},
        {id: WEid, name: 'Will Enger', club: "Sammamish River", state: 'waiting'},
    ])
    await tx1.isPersisted.promise

    const tx2 = slotsCollection.insert([
        {id: crypto.randomUUID(), time: '10:02', course: 'c1', participants: [MRid]},
        {id: crypto.randomUUID(), time: '10:02', course: 'c2', participants: [NJid]},
        {id: crypto.randomUUID(), time: '10:02', course: 'c3', participants: [TWid]},
        {id: crypto.randomUUID(), time: '10:02', course: 'c4', participants: [TKid]},
        {id: crypto.randomUUID(), time: '10:02', course: 'c5', participants: [VMid]},
        {id: crypto.randomUUID(), time: '10:02', course: 'c6', participants: [GWid]},
        {id: crypto.randomUUID(), time: '10:02', course: 'c7', participants: [DBid]},
        {id: crypto.randomUUID(), time: '10:02', course: 'c8', participants: [IUid]},
        {id: crypto.randomUUID(), time: '10:02', course: 'c9', participants: [EJid]},

        {id: crypto.randomUUID(), time: '10:04', course: 'c1', participants: [MBid]},
        {id: crypto.randomUUID(), time: '10:04', course: 'c2', participants: [LBid]},
        {id: crypto.randomUUID(), time: '10:04', course: 'c3', participants: [MFid]},
        {id: crypto.randomUUID(), time: '10:04', course: 'c4', participants: [LTid]},
        {id: crypto.randomUUID(), time: '10:04', course: 'c5', participants: [BFid]},
        // {id: crypto.randomUUID(), time: '10:04', course: 'c6', participants: []},
        {id: crypto.randomUUID(), time: '10:04', course: 'c7', participants: []},
        {id: crypto.randomUUID(), time: '10:04', course: 'c8', participants: [GNid]},
        {id: crypto.randomUUID(), time: '10:04', course: 'c9', participants: [WEid]},

        // {id: crypto.randomUUID(), time: '10:06', course: 'c8', participants: [GNid]},
        // {id: crypto.randomUUID(), time: '10:06', course: 'c9', participants: [WEid]},
    ])
    await tx2.isPersisted.promise

    Promise.all([tx1, tx2]).then(() => {
        console.log("Mock Data Loaded")
    })
}

async function handleDataLoadClick() {
    const p1 = await dropAllSlots()
    const p2 = await dropAllParticipants()

    Promise.all([p1, p2])
    .then(() => {
        console.log('rxdb: cleaned up collections')
        insertMockData()
    })
}


export function Header():JSX.Element {
    return (
    <header className="text-gray-400 bg-gray-900 body-font">
        <div className="container mx-auto flex flex-wrap p-5 flex-col md:flex-row items-center">
            <a className="flex title-font font-medium items-center text-white mb-4 md:mb-0">
            {LOGO}
            <span className="ml-3 text-xl">Waves</span>
            </a>
            <nav className="md:ml-auto flex flex-wrap items-center text-base justify-center">
                <a className="mr-5 hover:text-white">Start Manager</a>
                <a className="mr-5 hover:text-white">Call-up</a>
                <a className="mr-5 hover:text-white">Epunch Check</a>
            </nav>
            <button 
                className="inline-flex items-center bg-gray-800 border-0 py-1 px-3 focus:outline-none hover:bg-gray-700 rounded text-base mt-4 md:mt-0"
                onClick={handleDataLoadClick}>
                Mock Data
            </button>
        </div>
    </header>
    )
}

