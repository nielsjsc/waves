import Papa, { type ParseResult } from "papaparse"
import type { ParticipantDocType, SlotDocType } from "./Schema"
import { participantsTanCollection, slotsTanCollection } from "./database"

// adapted from
// https://dev.to/mahdi_falamarzi/how-to-read-csv-file-in-typescript-react-app-106h

// type PublicRegistrationRecord = {
//     FirstName: string
//     LastName: string
//     Email: string
//     Club: string | undefined
//     Class: string
//     Sex: "M" | "F" | undefined
//     EPunch: string | undefined
//     Rental: boolean
//     StartTime: string | undefined
//     Phone: string | undefined
//     EmergencyPhone: string | undefined
//     CarLicense: string | undefined
//     BirthYear: number
//     Newcomer: boolean | undefined
//     Group: number | undefined
//     Paid: boolean
//     Owed: number | undefined
//     Waiver: boolean
// }

// export function readPublicCSV():void {
//     Papa.parse("/2025-12-20_WL04_UW_PublicReg.csv", {
//         header: true,
//         download: true,
//         skipEmptyLines: true,
//         delimiter: ',',
//         complete: (parsed:ParseResult<PublicRegistrationRecord>) => {
//             insertPublicCsv(parsed.data)
//         },
//     })
//     return
// }

export function getCourseForClass(className:string):string {
    switch (className) {
        case '1':
        case 'W1F':
        case 'W1M':
            return 'c1'; // Beginner + Elementary
        case 'W2F':
        case 'W2M':
            return 'c2'; // Middle School
        case '3':
        case 'W3F':
            return 'c3'; // Advanced Beginner + HS Rookie Girls
        case 'W4M':
            return 'c4'; // HS Rookie Boys
        case '5':
        case 'W5F':
        case 'WICJVF':
        case 'WICJVM':
            return 'c5'; // Intermediate + JV Girls + College JV
        case 'W6M':
            return 'c6'; // JV Boys
        case 'W7F':
        case 'W7M':
            return 'c7'; // Varsity
        case '8O':
        case '8F':
        case '8G':
            return 'c8'; // Short Advanced
        case '9O':
        case '9F':
        case '9G':
        case 'W9F':
        case 'W9M':
            return 'c9'; // Long Advanced + College
        default:
            return className;
    }
}

function formatStartTime(timeString:string):string {
    let res = timeString;
    if (timeString.endsWith(":00")) {
        res = timeString.slice(0,-3)
    }
    if (res.startsWith("9:")) {
        res = "0"+res
    }
    return res;
}

// async function insertPublicCsv(data:PublicRegistrationRecord[]) {
//     const participants:ParticipantDocType[] = []
//     const slots:SlotDocType[] = []
//     console.log(`Data length: ${data.length}`)
//     data?.forEach((record) => {
//         if (record.StartTime === undefined || record.StartTime === "") {
//             return;
//         }
//         const participantId = crypto.randomUUID();
//         participants.push({
//             id: participantId, 
//             name:`${record.FirstName} ${record.LastName}`,
//             club: record.Club ?? 'None',
//             isRental: record.
//             state: 'waiting'
//         }),
//         slots.push({
//             id: crypto.randomUUID(),
//             time: formatStartTime(record.StartTime),
//             course: getCourseForClass(record.Class),
//             participants: [participantId]
//         })
//     })

//     const tx1 = participantsTanCollection.insert(participants)
//     await tx1.isPersisted.promise

//     const tx2 = slotsTanCollection.insert(slots)
//     await tx2.isPersisted.promise

//     Promise.all([tx1, tx2]).then(() => {
//         console.log("Mock Data Loaded")
//     })   
// }


type PdfStartListRecord = {
    Time: string,
    "ELEMENTARYBEGINNER.1": string,
    "ELEMENTARYBEGINNER.2": string,
    "ELEMENTARYBEGINNER.3": string,
    "MIDDLE SCHOOL.1": string,
    "MIDDLE SCHOOL.2": string,
    "MIDDLE SCHOOL.3": string,
    "ROOKIE FEMALEADV BEGINNER.1": string,
    "ROOKIE FEMALEADV BEGINNER.2": string,
    "ROOKIE FEMALEADV BEGINNER.3": string,
    "ROOKIE MALE.1": string,
    "ROOKIE MALE.2": string,
    "ROOKIE MALE.3": string,
    "JV FEMALECOLLEGIATE JVINTERMEDIATE.1": string,
    "JV FEMALECOLLEGIATE JVINTERMEDIATE.2": string,
    "JV FEMALECOLLEGIATE JVINTERMEDIATE.3": string,
    "JV MALE.1": string,
    "JV MALE.2": string,
    "JV MALE.3": string,
    "VARSITY.1": string,
    "VARSITY.2": string,
    "VARSITY.3": string,
    "SHORT ADVANCED.1": string,
    "SHORT ADVANCED.2": string,
    "SHORT ADVANCED.3": string,
    "COLLEGE VARSITYLONG ADVANCED.1": string,
    "COLLEGE VARSITYLONG ADVANCED.2": string,
    "COLLEGE VARSITYLONG ADVANCED.3": string
}

export function readStartListCsv():void {
    Papa.parse("/startlist.csv", {
        header: true,
        download: true,
        skipEmptyLines: true,
        delimiter: ',',
        complete: (parsed:ParseResult<PdfStartListRecord>) => {
            insertStartListCsv(parsed.data)
        },
    })
    return
}

function participantFromStartListData(col1:string,col2:string,col3:string):ParticipantDocType|undefined {
    if (col1 === '') {
        return undefined
    }
    const participantId = crypto.randomUUID();
    const name = col1;
    if (/^[0-9]+.*/.test(col2)) {
        // move epunch value to col3 if its in col2
        col3 = col2;
        col2 = "";
    }
    const isGroup = col2.toLocaleLowerCase().includes("group")
    const groupSize = isGroup ? parseInt(/\(([0-9])\)/.exec(col2)?.[1]!) : 1

    const hasClub = !(col2 === "" || isGroup)
    const club = hasClub ? col2 : "unknown"
    const isRental = col3.toLocaleLowerCase().includes("r")
    const isNonCompete = col3.toLocaleLowerCase().includes("nc")
    const startsNumbers = /^[0-9]+/.test(col3)
    const epunch = startsNumbers ? /^[0-9]+/.exec(col3)?.[0]! : ""

    return {
        id: participantId,
        name: name,
        club: club,
        epunch: epunch,
        isRental: isRental,
        isNonCompete: isNonCompete,
        state: "waiting",
        groupSize: groupSize,
    }

}

async function insertStartListCsv(data:PdfStartListRecord[]) {
    const participants:ParticipantDocType[] = []
    const slots:SlotDocType[] = []

    for (const wave of data) {
        const waveTime = formatStartTime(wave.Time)
        
        const c1p = participantFromStartListData(wave["ELEMENTARYBEGINNER.1"], wave["ELEMENTARYBEGINNER.2"], wave["ELEMENTARYBEGINNER.3"])
        if (c1p !== undefined) {
            participants.push({...c1p, originalStartTime:waveTime, startChanged:false})
        }       
        slots.push({
            id: crypto.randomUUID(), 
            time: waveTime, 
            course: 'c1',
            participants: c1p !==undefined ? [c1p.id] : [],
            isUsable: true
        })

        const c2p = participantFromStartListData(wave["MIDDLE SCHOOL.1"], wave["MIDDLE SCHOOL.2"], wave["MIDDLE SCHOOL.3"])
        if (c2p !== undefined) {
            participants.push({...c2p, originalStartTime:waveTime, startChanged:false})
        }
        slots.push({
            id: crypto.randomUUID(), 
            time: waveTime, 
            course: 'c2',
            participants: c2p !== undefined ? [c2p.id] : [],
            isUsable: true
        })
        
        const c3p = participantFromStartListData(wave["ROOKIE FEMALEADV BEGINNER.1"], wave["ROOKIE FEMALEADV BEGINNER.2"], wave["ROOKIE FEMALEADV BEGINNER.3"])
        if (c3p !== undefined) {
            participants.push({...c3p, originalStartTime:waveTime, startChanged:false})
        }
        slots.push({
            id: crypto.randomUUID(), 
            time: waveTime, 
            course: 'c3',
            participants: c3p !== undefined ? [c3p.id] : [],
            isUsable: true
        })
        
        const c4p = participantFromStartListData(wave["ROOKIE MALE.1"], wave["ROOKIE MALE.2"], wave["ROOKIE MALE.3"])
        if (c4p !== undefined) {
            participants.push({...c4p, originalStartTime:waveTime, startChanged:false})
        }
        slots.push({
            id: crypto.randomUUID(), 
            time: waveTime, 
            course: 'c4',
            participants: c4p !== undefined ? [c4p.id] : [],
            isUsable: true
        })
        
        const c5p = participantFromStartListData(wave["JV FEMALECOLLEGIATE JVINTERMEDIATE.1"], wave["JV FEMALECOLLEGIATE JVINTERMEDIATE.2"], wave["JV FEMALECOLLEGIATE JVINTERMEDIATE.3"])
        if (c5p !== undefined) {
            participants.push({...c5p, originalStartTime:waveTime, startChanged:false})
        }
        slots.push({
            id: crypto.randomUUID(), 
            time: waveTime, 
            course: 'c5',
            participants: c5p !== undefined ? [c5p.id] : [],
            isUsable: true
        })
        
        const c6p = participantFromStartListData(wave["JV MALE.1"], wave["JV MALE.2"], wave["JV MALE.3"])
        if (c6p !== undefined) {
            participants.push({...c6p, originalStartTime:waveTime, startChanged:false})
        }
        slots.push({
            id: crypto.randomUUID(), 
            time: waveTime, 
            course: 'c6',
            participants: c6p !== undefined ? [c6p.id] : [],
            isUsable: true
        })
        
        const c7p = participantFromStartListData(wave["VARSITY.1"], wave["VARSITY.2"], wave["VARSITY.3"])
        if (c7p !== undefined) {
            participants.push({...c7p, originalStartTime:waveTime, startChanged:false})
        }
        slots.push({
            id: crypto.randomUUID(), 
            time: waveTime, 
            course: 'c7',
            participants: c7p !== undefined ? [c7p.id] : [],
            isUsable: true
        })
        
        const c8p = participantFromStartListData(wave["SHORT ADVANCED.1"], wave["SHORT ADVANCED.2"], wave["SHORT ADVANCED.3"])
        if (c8p !== undefined) {
            participants.push({...c8p, originalStartTime:waveTime, startChanged:false})
        }
        slots.push({
            id: crypto.randomUUID(), 
            time: waveTime, 
            course: 'c8',
            participants: c8p !== undefined ? [c8p.id] : [],
            isUsable: true
        })
        
        const c9p = participantFromStartListData(wave["COLLEGE VARSITYLONG ADVANCED.1"], wave["COLLEGE VARSITYLONG ADVANCED.2"], wave["COLLEGE VARSITYLONG ADVANCED.3"])
        if (c9p !== undefined) {
            participants.push({...c9p, originalStartTime:waveTime, startChanged:false})
        }
        slots.push({
            id: crypto.randomUUID(), 
            time: waveTime, 
            course: 'c9',
            participants: c9p !== undefined ? [c9p.id] : [],
            isUsable: true
        })
    }

    // add magic slots
    for (var course of ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9']) {
        for (var specialTime of ['_notAttending', '_needsAssignment']) {
            slots.push({
                id: crypto.randomUUID(),
                time: specialTime,
                course: course,
                participants: [],
                isUsable: true
            })
        }
    }

    const tx1 = participantsTanCollection.insert(participants)
    await tx1.isPersisted.promise

    const tx2 = slotsTanCollection.insert(slots)
    await tx2.isPersisted.promise

    Promise.all([tx1, tx2]).then(() => {
        console.log("Mock Data Loaded")
    })   
}