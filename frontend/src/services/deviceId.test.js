import { describe, expect, test } from 'vitest'
import { mockApi } from './mockApi'
import { deviceId } from './deviceId'

describe('one phone per QR code', () => {
  test('device id is stable', () => { expect(deviceId()).toBe(deviceId()); expect(deviceId().length).toBeGreaterThanOrEqual(16) })
  test('a second phone gets 423 until the first session is ended', async () => {
    const s = await mockApi.createSession('demo')
    await mockApi.getSession(s.token, { claim: true })
    await mockApi.getSession(s.token, { claim: true }) // same phone again: fine
    const all = JSON.parse(localStorage.getItem('pb_mock_sessions')); all[s.token].claimed_by = 'someone-else'
    localStorage.setItem('pb_mock_sessions', JSON.stringify(all))
    await expect(mockApi.getSession(s.token, { claim: true })).rejects.toMatchObject({ status: 423 })
    await mockApi.endSession(s.token)
    await expect(mockApi.getSession(s.token, { claim: true })).rejects.toMatchObject({ status: 410 })
  })
})
