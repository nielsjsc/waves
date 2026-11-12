import { describe, expect, it } from 'vitest'
import { randomUUID, sha256Hex } from './cryptoHelpers'

async function nativeDigest(input: string): Promise<string> {
    const data = new TextEncoder().encode(input)
    const buf = await crypto.subtle.digest('SHA-256', data)
    return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, '0')).join('')
}

describe('cryptoHelpers (plain HTTP compatibility)', () => {
    it('computes identical SHA-256 hex digests to Web Crypto subtle.digest across inputs', async () => {
        const samples = [
            '',
            'abc',
            '79b4a276-participant-c3-09:44',
            'a'.repeat(55),
            'a'.repeat(56),
            'a'.repeat(64),
            'a'.repeat(128),
            '{"id":"p-1","name":"Åsa Öberg — 🌲","state":"present","groupSize":3}',
        ]
        for (const s of samples) {
            expect(await sha256Hex(s)).toBe(await nativeDigest(s))
        }
    })

    it('generates valid RFC 4122 v4 UUIDs even when crypto.randomUUID is unavailable (HTTP context)', () => {
        const originalRandomUUID = crypto.randomUUID
        try {
            Object.defineProperty(crypto, 'randomUUID', {
                value: undefined,
                configurable: true,
                writable: true,
            })
            const id1 = randomUUID()
            const id2 = randomUUID()
            expect(id1).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
            expect(id2).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
            expect(id1).not.toBe(id2)
        } finally {
            Object.defineProperty(crypto, 'randomUUID', {
                value: originalRandomUUID,
                configurable: true,
                writable: true,
            })
        }
    })
})
