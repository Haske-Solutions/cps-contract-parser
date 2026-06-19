import { describe, it, expect } from 'vitest'
import { applyCandidateToMatch, updateMatchList } from '../renderer/store/sessionStore'
import type { ServiceMatch } from '../shared/types'

const multipleMatch: ServiceMatch = {
  extractedName: 'Deluxe Tent',
  peServiceId: null,
  peServiceName: null,
  peServiceCode: null,
  status: 'multiple_matches',
  candidates: [
    { id: 10, name: 'Deluxe Tent A', code: 'DTA' },
    { id: 11, name: 'Deluxe Tent B', code: 'DTB' },
  ],
}

describe('service match store helpers', () => {
  it('applyCandidateToMatch sets matched status and PE fields', () => {
    const updated = applyCandidateToMatch(multipleMatch, {
      id: 11,
      name: 'Deluxe Tent B',
      code: 'DTB',
    })

    expect(updated.status).toBe('matched')
    expect(updated.peServiceId).toBe(11)
    expect(updated.peServiceName).toBe('Deluxe Tent B')
    expect(updated.peServiceCode).toBe('DTB')
  })

  it('updateMatchList updates only the matching extracted name', () => {
    const other: ServiceMatch = {
      extractedName: 'Suite',
      peServiceId: 5,
      peServiceName: 'Suite',
      peServiceCode: 'SU',
      status: 'matched',
      candidates: [],
    }

    const result = updateMatchList(
      [multipleMatch, other],
      'Deluxe Tent',
      { id: 10, name: 'Deluxe Tent A', code: 'DTA' },
    )

    expect(result[0].peServiceId).toBe(10)
    expect(result[0].status).toBe('matched')
    expect(result[1].peServiceId).toBe(5)
  })
})
