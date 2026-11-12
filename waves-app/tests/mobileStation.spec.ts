import { test, expect } from '@playwright/test'

const TEST_EVENT_JSON = JSON.stringify({
	eventId: 'mobiletest01',
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
		'ELEMENTARYBEGINNER.1': 'Ada Augusta Lovelace',
		'ELEMENTARYBEGINNER.2': 'Ingraham High',
		'ELEMENTARYBEGINNER.3': '100001',
		'MIDDLE SCHOOL.1': 'Grace Brewster Hopper',
		'MIDDLE SCHOOL.2': 'Group (12)',
		'MIDDLE SCHOOL.3': '100003',
		'VARSITY.1': 'Alan Mathison Turing',
		'VARSITY.2': 'Garfield High',
		'VARSITY.3': '100002',
	}),
	makeCsvRow('10:02:00', {
		'ELEMENTARYBEGINNER.1': 'Katherine Coleman Goble Johnson',
		'ELEMENTARYBEGINNER.2': 'Lakeside School',
		'ELEMENTARYBEGINNER.3': '100004 [R] *NC*',
	}),
	makeCsvRow('10:04:00', {}),
].join('\r\n')

test('Mobile Call-up and E-punch Check viewports show all 9 courses without scrolling', async ({ context, page }) => {
	await context.route('**/event.json', async (route) => {
		await route.fulfill({ status: 200, contentType: 'application/json', body: TEST_EVENT_JSON })
	})
	await context.route('**/startlist.csv', async (route) => {
		await route.fulfill({ status: 200, contentType: 'text/csv', body: TEST_STARTLIST_CSV })
	})

	// Set mobile viewport (iPhone 12/13/14 portrait: 390x844)
	await page.setViewportSize({ width: 390, height: 844 })
	await page.goto('/')

	// Set appPage directly in localStorage to call-up and unlock volunteer mode
	await page.evaluate(() => {
		localStorage.setItem('waves.volunteerUnlocked', 'true')
		localStorage.setItem('waves.appPage', 'call-up')
	})
	await page.reload()

	await expect(page.getByText('Calling now')).toBeVisible({ timeout: 15000 })

	// Verify all 9 courses from c1 to c9 are visible in the viewport simultaneously without scrolling
	for (let i = 1; i <= 9; i++) {
		await expect(page.getByRole('rowheader', { name: new RegExp(`c${i}`, 'i') })).toBeInViewport()
	}

	// Switch to E-punch check station
	await page.evaluate(() => localStorage.setItem('waves.appPage', 'epunch'))
	await page.reload()

	await expect(page.getByText('Checking now')).toBeVisible({ timeout: 15000 })

	// Verify all 9 courses from c1 to c9 are visible in the viewport on E-punch check too
	for (let i = 1; i <= 9; i++) {
		await expect(page.getByRole('rowheader', { name: new RegExp(`c${i}`, 'i') })).toBeInViewport()
	}

	// Also verify on a small 375x667 mobile screen (iPhone SE)
	await page.setViewportSize({ width: 375, height: 667 })
	await page.evaluate(() => localStorage.setItem('waves.appPage', 'call-up'))
	await page.reload()
	await expect(page.getByText('Calling now')).toBeVisible({ timeout: 15000 })
	for (let i = 1; i <= 9; i++) {
		await expect(page.getByRole('rowheader', { name: new RegExp(`c${i}`, 'i') })).toBeInViewport()
	}
})
