import { expect, test, type Page } from '@playwright/test'

const TEST_EVENT_JSON = JSON.stringify({
	eventId: 'e2etest01',
	source: 'e2e-fixture.xlsx',
	createdAt: '2026-10-21T12:00:00Z',
	starters: 4,
})

const CSV_HEADERS = [
	'Time',
	'ELEMENTARYBEGINNER.1', 'ELEMENTARYBEGINNER.2', 'ELEMENTARYBEGINNER.3',
	'MIDDLE SCHOOL.1', 'MIDDLE SCHOOL.2', 'MIDDLE SCHOOL.3',
	'ROOKIE FEMALEADV BEGINNER.1', 'ROOKIE FEMALEADV BEGINNER.2', 'ROOKIE FEMALEADV BEGINNER.3',
	'ROOKIE MALE.1', 'ROOKIE MALE.2', 'ROOKIE MALE.3',
	'JV FEMALECOLLEGIATE JVINTERMEDIATE.1', 'JV FEMALECOLLEGIATE JVINTERMEDIATE.2', 'JV FEMALECOLLEGIATE JVINTERMEDIATE.3',
	'JV MALE.1', 'JV MALE.2', 'JV MALE.3',
	'VARSITY.1', 'VARSITY.2', 'VARSITY.3',
	'SHORT ADVANCED.1', 'SHORT ADVANCED.2', 'SHORT ADVANCED.3',
	'COLLEGE VARSITYLONG ADVANCED.1', 'COLLEGE VARSITYLONG ADVANCED.2', 'COLLEGE VARSITYLONG ADVANCED.3',
]

function makeCsvRow(time: string, cells: Record<string, string>): string {
	return CSV_HEADERS.map((h) => (h === 'Time' ? time : (cells[h] ?? ''))).join(',')
}

const TEST_STARTLIST_CSV = [
	CSV_HEADERS.join(','),
	makeCsvRow('10:00:00', {
		'ELEMENTARYBEGINNER.1': 'Ada Lovelace',
		'ELEMENTARYBEGINNER.2': 'Ingraham High',
		'ELEMENTARYBEGINNER.3': '100001',
		'MIDDLE SCHOOL.1': 'Grace Hopper',
		'MIDDLE SCHOOL.2': 'Group (12)',
		'MIDDLE SCHOOL.3': '100003',
		'VARSITY.1': 'Alan Turing',
		'VARSITY.2': 'Garfield High',
		'VARSITY.3': '100002',
	}),
	makeCsvRow('10:02:00', {
		'ELEMENTARYBEGINNER.1': 'Katherine Johnson',
		'ELEMENTARYBEGINNER.2': 'Lakeside School',
		'ELEMENTARYBEGINNER.3': '100004 - NC - N',
		'ROOKIE MALE.1': 'Colton Boone',
		'ROOKIE MALE.2': 'Oak Harbor',
		'ROOKIE MALE.3': '2221885- Need $',
	}),
	makeCsvRow('10:04:00', {}),
].join('\r\n')

async function navigateToStation(page: Page, stationLabel: 'Call-up' | 'Epunch Check' | 'Start Manager' | 'Full Grid' | 'Download' | 'Change Log') {
	await page.locator('header nav').getByRole('button', { name: stationLabel, exact: true }).click()
}

test('Full multi-station orienteering meet simulation (Call-up -> E-punch Check -> Start Manager -> Timing Desk & CSV Export)', async ({ context }) => {
	// Serve an isolated test event so the E2E suite never overwrites or depends on local meet data.
	await context.route('**/event.json', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'application/json',
			body: TEST_EVENT_JSON,
		})
	})
	await context.route('**/startlist.csv', async (route) => {
		await route.fulfill({
			status: 200,
			contentType: 'text/csv',
			body: TEST_STARTLIST_CSV,
		})
	})

	const callupPage = await context.newPage()
	await callupPage.goto('/')

	// Wait for the startlist to finish auto-importing into IndexedDB
	await expect(callupPage.getByText('Ada Lovelace')).toBeVisible({ timeout: 15000 })
	await expect(callupPage.getByText('Group 12')).toBeVisible()
	// Verify "N" and "Need $" badges appear on the Full Grid
	await expect(callupPage.getByText('Need $').first()).toBeVisible()
	await expect(callupPage.locator('[data-participant-id="e2etest01-participant-c1-10:02"]')).toContainText('N')

	// Verify the app starts in locked mode until the volunteer PIN (9465) is entered
	await expect(callupPage.getByRole('button', { name: '+ Add Participant' })).toHaveCount(0)
	await callupPage.getByRole('button', { name: 'Volunteer Login' }).first().click()
	await callupPage.locator('#volunteer-pin-input').fill('0000')
	await callupPage.getByRole('button', { name: 'Unlock', exact: true }).click()
	await expect(callupPage.getByText('Incorrect PIN. Please try again.')).toBeVisible()
	await callupPage.locator('#volunteer-pin-input').fill('9465')
	await callupPage.getByRole('button', { name: 'Unlock', exact: true }).click()
	await expect(callupPage.getByRole('button', { name: '+ Add Participant' })).toBeVisible()

	// -------------------------------------------------------------------------
	// 1. STATION 1: CALL-UP (+6 min wave offset)
	// -------------------------------------------------------------------------
	await navigateToStation(callupPage, 'Call-up')
	await expect(callupPage.getByText('Calling now')).toBeVisible()
	await expect(callupPage.getByRole('button', { name: '(+6)' })).toBeVisible()
	await expect(callupPage.getByRole('rowheader', { name: /c1/i })).toBeInViewport()
	await expect(callupPage.getByRole('rowheader', { name: /c9/i })).toBeInViewport()

	const adaCardCallup = callupPage.locator('[data-participant-id="e2etest01-participant-c1-10:00"]')
	const graceCardCallup = callupPage.locator('[data-participant-id="e2etest01-participant-c2-10:00"]')
	const alanCardCallup = callupPage.locator('[data-participant-id="e2etest01-participant-c7-10:00"]')

	// Verify that switching from No Show -> Present -> deselecting Present clears the state back to no state ("waiting")
	await adaCardCallup.getByRole('button', { name: 'No Show' }).click()
	await adaCardCallup.getByRole('button', { name: 'Present' }).click()
	await callupPage.waitForTimeout(400)
	await adaCardCallup.getByRole('button', { name: 'Present' }).click()
	await expect(adaCardCallup.getByRole('button', { name: 'Present' })).not.toHaveClass(/bg-/)
	await expect(adaCardCallup.getByRole('button', { name: 'No Show' })).not.toHaveClass(/bg-/)

	await adaCardCallup.getByRole('button', { name: 'Present' }).click()
	await graceCardCallup.getByRole('button', { name: 'Present' }).click()
	await alanCardCallup.getByRole('button', { name: 'No Show' }).click()

	// -------------------------------------------------------------------------
	// 2. STATION 2: E-PUNCH CHECK (+4 min wave offset & inline e-punch editing)
	// -------------------------------------------------------------------------
	const epunchPage = await context.newPage()
	await epunchPage.goto('/')
	await navigateToStation(epunchPage, 'Epunch Check')
	await expect(epunchPage.getByText('Checking now')).toBeVisible()
	await expect(epunchPage.getByRole('button', { name: '(+4)' })).toBeVisible()

	const adaCardEpunch = epunchPage.locator('[data-participant-id="e2etest01-participant-c1-10:00"]')
	const graceCardEpunch = epunchPage.locator('[data-participant-id="e2etest01-participant-c2-10:00"]')
	const alanCardEpunch = epunchPage.locator('[data-participant-id="e2etest01-participant-c7-10:00"]')

	// Verify Call-up's "Present" state synced to the E-punch Check tab
	await expect(adaCardEpunch).toContainText('Present')

	// Verify Alan Turing (marked No Show at Call-up) can ALSO be flagged as Wrong E-punch at the same time
	await expect(alanCardEpunch).toContainText('No Show')
	await alanCardEpunch.getByRole('button', { name: 'Wrong E-punch' }).click()
	await expect(alanCardEpunch).toContainText('No Show')
	await expect(alanCardEpunch).toContainText('Wrong E-punch')

	// Verify the button says "Validate" BEFORE clicking, and changes to "Validated" AFTER clicking
	const adaValidateBtn = adaCardEpunch.getByRole('button', { name: 'Validate', exact: true })
	await expect(adaValidateBtn).toBeVisible()
	await adaValidateBtn.click()
	await expect(adaCardEpunch.getByRole('button', { name: 'Validated', exact: true })).toBeVisible()

	// Flag Grace Hopper as having a Wrong E-punch and update her e-punch inline right on the E-punch Check station!
	await graceCardEpunch.getByRole('button', { name: 'Wrong E-punch' }).click()
	await expect(graceCardEpunch).toContainText('Wrong E-punch')
	await expect(graceCardEpunch.getByText('New e-punch #:')).toBeVisible()
	await graceCardEpunch.locator('input[type="text"]').fill('9876543')
	await graceCardEpunch.getByRole('button', { name: 'Rental', exact: true }).click()
	await graceCardEpunch.getByRole('button', { name: 'Save e-punch' }).click()
	await expect(graceCardEpunch).toContainText('Validated')
	await expect(graceCardEpunch).toContainText('9876543')

	// -------------------------------------------------------------------------
	// 3. STATION 3: START MANAGER (Ineligible racers queue, Standby priority, 2nd course)
	// -------------------------------------------------------------------------
	const managerPage = await context.newPage()
	await managerPage.goto('/')
	await navigateToStation(managerPage, 'Start Manager')

	// Verify zero broken records, 1 Wrong e-punch (Alan Turing, since Grace Hopper was resolved at Epunch Check), 0 Standby, 1 No-show, and 2 Ineligible racers (Katherine Johnson N + Colton Boone Need $)
	await expect(managerPage.getByText('Records needing repair')).toHaveCount(0)
	await expect(managerPage.getByRole('heading', { name: /Wrong e-punch/i })).toContainText('(1)')
	await expect(managerPage.getByRole('heading', { name: /Standby/i })).toContainText('(0)')
	await expect(managerPage.getByRole('heading', { name: /No-shows/i })).toContainText('(1)')
	await expect(managerPage.getByRole('heading', { name: /Ineligible racers/i })).toContainText('(2)')

	// Click Katherine Johnson in Ineligible racers, verify "Hasn't signed shadow waiver (N)" is highlighted, and click "Set as Eligible"
	await managerPage.getByRole('button', { name: /Katherine Johnson/i }).first().click()
	await expect(managerPage.getByText(/Hasn't signed shadow waiver \(N\)/i).first()).toBeVisible()
	await managerPage.getByRole('button', { name: 'Set as Eligible' }).first().click()
	await expect(managerPage.getByText(/Hasn't signed shadow waiver \(N\)/i)).toHaveCount(0)
	await managerPage.getByRole('button', { name: 'Done' }).click()
	await expect(managerPage.getByRole('heading', { name: /Ineligible racers/i })).toContainText('(1)')

	// Expand the Schools & Clubs directory (starts closed) to find Garfield High -> Alan Turing
	await expect(managerPage.getByPlaceholder('Filter schools…')).toHaveCount(0)
	await managerPage.getByRole('button', { name: /Schools & Clubs/i }).click()
	await managerPage.getByPlaceholder('Filter schools…').fill('Garfield')
	await managerPage.getByRole('button', { name: /^Garfield High/i }).click()
	await managerPage.getByRole('button', { name: /Alan Turing/i }).first().click()

	// Verify that clicking a person from the school page does NOT automatically show the time picker
	await expect(managerPage.getByText('Assign Start Time for Alan Turing')).toHaveCount(0)
	await managerPage.getByRole('button', { name: 'Change start time' }).click()
	await expect(managerPage.getByText('Assign Start Time for Alan Turing')).toBeVisible()

	// Reassign Alan Turing to 10:04 on c7 (enabling earlier times if current clock is past 10:04)
	const includeEarlierCheckbox = managerPage.getByLabel(/Include times already past call-up/i)
	if (await includeEarlierCheckbox.isVisible()) {
		await includeEarlierCheckbox.check()
	}
	await managerPage.getByRole('button', { name: '10:04' }).click()
	await expect(managerPage.getByText('Alan Turing moved to c7 · 10:04')).toBeVisible()
	await expect(managerPage.getByText('Originally 10:00')).toBeVisible()
	await expect(managerPage.getByText('Assign Start Time for Alan Turing')).toHaveCount(0)

	// Verify leaving and coming back to Start Manager automatically closes Alan Turing's page
	// Also verify Full Grid displays Excel course header colors and fits within the viewport without horizontal overflow
	await navigateToStation(managerPage, 'Full Grid')
	await expect(managerPage.locator('th[data-course-header="c2"]')).toHaveCSS('background-color', 'rgb(255, 255, 0)')
	await expect(managerPage.locator('th[data-course-header="c7"]')).toHaveCSS('background-color', 'rgb(0, 176, 80)')
	await expect(managerPage.locator('th[data-course-header="c7"]')).toBeInViewport()
	await navigateToStation(managerPage, 'Start Manager')
	await expect(managerPage.getByRole('button', { name: 'Done' })).toHaveCount(0)

	// Add a new participant / 2nd-course runner from Start Manager in Standby
	await managerPage.getByRole('button', { name: 'Add Participant' }).click()
	await managerPage.locator('#add-p-name').fill('Margaret Hamilton')
	await managerPage.locator('#add-p-club').fill('Ingraham High')
	await managerPage.locator('#add-p-epunch').fill('5551234')
	await managerPage.getByLabel('2nd course').check()
	await managerPage.getByRole('button', { name: 'Put on standby' }).click()
	await managerPage.getByRole('button', { name: 'Add to Meet' }).click()
	await expect(managerPage.getByRole('heading', { name: 'Margaret Hamilton', exact: true })).toBeVisible()
	await expect(managerPage.getByText('2nd course').first()).toBeVisible()

	// Change Margaret Hamilton from Individual (1) to a Group of 3
	await managerPage.getByRole('button', { name: 'Make group / Group size' }).click()
	await managerPage.getByRole('button', { name: 'Group (3)' }).click()
	await managerPage.getByRole('button', { name: 'Save' }).click()
	await expect(managerPage.getByText('Group 3')).toBeVisible()

	// Return to Start Manager queues and verify "2nd course" appears in the Standby list
	await managerPage.getByRole('button', { name: 'Done' }).click()
	await expect(managerPage.getByRole('heading', { name: /Standby/i })).toContainText('(1)')
	await expect(managerPage.getByText('2nd course').first()).toBeVisible()

	// -------------------------------------------------------------------------
	// 4. STATION 4: DOWNLOAD STATION (Finish Tent)
	// -------------------------------------------------------------------------
	const timingPage = await context.newPage()
	await timingPage.goto('/')
	await navigateToStation(timingPage, 'Download')

	// Verify only download-relevant changes appear (Grace Hopper e-punch + Margaret Hamilton registration)
	// Alan Turing's same-course start time change and Margaret Hamilton's group size change must NOT appear on Download
	await expect(timingPage.getByRole('button', { name: /Pending Queue \(2\)/i })).toBeVisible()
	await expect(timingPage.getByText('Grace Hopper')).toBeVisible()
	await expect(timingPage.getByRole('button', { name: 'Margaret Hamilton' }).first()).toBeVisible()
	await expect(timingPage.getByText('GROUP SIZE')).toHaveCount(0)
	await expect(timingPage.getByText('Alan Turing')).toHaveCount(0)

	// Clear Grace Hopper's e-punch change after entering it into download software
	await timingPage.getByRole('button', { name: 'Clear', exact: true }).first().click()
	await expect(timingPage.getByRole('button', { name: /Pending Queue \(1\)/i })).toBeVisible()
	await expect(timingPage.getByRole('button', { name: /Cleared \(1\)/i })).toBeVisible()

	// Switch to Full Download Log and verify both cleared and pending records are visible
	await timingPage.getByRole('button', { name: /Full Download Log \(2\)/i }).click()
	await expect(timingPage.getByRole('button', { name: 'Grace Hopper' })).toBeVisible()
	await expect(timingPage.getByRole('button', { name: 'Margaret Hamilton' }).first()).toBeVisible()
	await expect(timingPage.getByText('CLEARED', { exact: true })).toBeVisible()
	await expect(timingPage.getByText('PENDING', { exact: true }).first()).toBeVisible()
	await expect(timingPage.getByRole('button', { name: /Export CSV/i })).toHaveCount(0)

	// -------------------------------------------------------------------------
	// 5. STATION 5: CHANGE LOG
	// -------------------------------------------------------------------------
	await navigateToStation(timingPage, 'Change Log')

	// Verify the chronological change log, category filters, and that manual CSV buttons are removed
	await expect(timingPage.getByRole('button', { name: /All changes/i })).toBeVisible()
	await expect(timingPage.getByText('Grace Hopper').first()).toBeVisible()
	await expect(timingPage.getByText('9876543 (rental)')).toBeVisible()

	await timingPage.getByRole('button', { name: /^Time & Course/i }).click()
	await expect(timingPage.getByText('Alan Turing').first()).toBeVisible()
	await timingPage.getByRole('button', { name: /^All changes/i }).click()

	await expect(timingPage.getByRole('button', { name: /Export Changes CSV/i })).toHaveCount(0)
	await expect(timingPage.getByRole('button', { name: /Export Full Roster CSV/i })).toHaveCount(0)
})
