// import {delay, HttpResponse, http} from 'msw'
// import fruits from './data/fruits.json' with {type: 'json'}
// import slots from './data/slots.json' with {type: 'json'}
// import { get } from '@/database'
// import type { Slot } from '@/api/slots'
// import type { RxDocument } from 'rxdb'
// import type { ParticipantDocType } from '@/Schema'
// import type { Participant, ParticipantState } from '@/api/participants'

// const db = get()

// export const handlers = [
// 	http.get('/fruits', async () => {
// 		await delay('real')
// 		return HttpResponse.json(fruits)
// 	}),
// 	http.get('/slots', async () => {
// 		await delay('real')
// 		return HttpResponse.json(slots)
// 	}),
// 	http.get('/rxslots', async () => {
// 		let slots:Slot[] = []
// 		const slotDocs = await (await db).slots.find().exec()
// 		for (const s of slotDocs) {
// 			await s.populate('participants')
// 				.then((participantDocs:RxDocument<ParticipantDocType>[]) => {
// 					let slotParticipants:Participant[] = []
// 					participantDocs.forEach((p) => {
// 						slotParticipants.push({
// 							id: p.id, 
// 							name: p.name, 
// 							club: p.club ?? 'None',
// 							state: p.state as ParticipantState})
// 					})
// 					slots.push({
// 						time: s.time,
// 						course: s.course,
// 						participants: slotParticipants,
// 						isUsable: true
// 					})
// 				})
// 		}

// 		return HttpResponse.json(slots)
// 	})
// ]
