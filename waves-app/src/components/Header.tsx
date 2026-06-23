// adapted from https://github.com/mertJF/tailblocks

import { dropAllChanges, dropAllParticipants, dropAllSlots, insertMockData } from "@/database";
import { readStartListCsv } from "@/dataImport";
import type { JSX } from "react";

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

async function handleDataLoadClick() {
    const p1 = await dropAllSlots()
    const p2 = await dropAllParticipants()

    Promise.all([p1, p2])
    .then(() => {
        console.log('rxdb: cleaned up collections')
        insertMockData()
    })
}

// async function handlePublicLoadClick() {
//     const p1 = await dropAllSlots()
//     const p2 = await dropAllParticipants()

//     Promise.all([p1, p2])
//     .then(() => {
//         console.log('rxdb: re-created collections')
//         readPublicCSV()
//     })
// }

async function handleUWLoadClick() {
    const p1 = await dropAllSlots()
    const p2 = await dropAllParticipants()
    const p3 = await dropAllChanges()

    Promise.all([p1, p2, p3])
    .then(() => {
        console.log('rxdb: re-created collections')
        readStartListCsv()
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
            <div className='title-font text-xl px-2'>
                10:02
                <span className='text-base px-2'>next in 29s</span>
                <span className='text-base px-2'>Clock Time: 9:55:31. Waves are 8 minutes ahead.</span>
            </div>
            {/* <button 
                className="inline-flex items-center bg-gray-800 border-0 ml-2 py-1 px-3 focus:outline-none hover:bg-gray-700 rounded text-base mt-4 md:mt-0"
                onClick={handleDataLoadClick}>
                Reset 1
            </button> */}
            {/* <button 
                className="inline-flex items-center bg-gray-800 border-0 ml-2 py-1 px-3 focus:outline-none hover:bg-gray-700 rounded text-base mt-4 md:mt-0"
                onClick={handlePublicLoadClick}>
                Reset 2
            </button> */}
            <button 
                className="inline-flex items-center bg-gray-800 border-0 ml-2 py-1 px-3 focus:outline-none hover:bg-gray-700 rounded text-base mt-4 md:mt-0"
                onClick={handleUWLoadClick}>
                Reset 3
            </button>
            <nav className="md:ml-auto flex flex-wrap items-center text-base justify-center">
                <a className="mr-5 hover:text-white" href="/manager">Start Manager</a>
                <a className="mr-5 hover:text-white" href="/">Call-up</a>
                <a className="mr-5 hover:text-white">Epunch Check</a>
            </nav>
        </div>
    </header>
    )
}

