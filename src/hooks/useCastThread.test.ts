import { describe, expect, it } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useCastThread } from './useCastThread'

describe('useCastThread', () => {
  it('inicia con un cast vacío', () => {
    const { result } = renderHook(() => useCastThread())

    expect(result.current.casts).toHaveLength(1)
    expect(result.current.casts[0].content).toBe('')
    expect(result.current.casts[0].media).toEqual([])
    expect(result.current.isThread).toBe(false)
  })

  it('updateCast actualiza el contenido', () => {
    const { result } = renderHook(() => useCastThread())

    act(() => {
      result.current.updateCast(0, {
        ...result.current.casts[0],
        content: 'Hola mundo',
      })
    })

    expect(result.current.casts[0].content).toBe('Hola mundo')
  })

  it('addCast añade un nuevo cast', () => {
    const { result } = renderHook(() => useCastThread())

    act(() => {
      result.current.addCast()
    })

    expect(result.current.casts).toHaveLength(2)
    expect(result.current.isThread).toBe(true)
  })

  it('removeCast elimina un cast', () => {
    const { result } = renderHook(() => useCastThread())

    act(() => {
      result.current.addCast()
    })

    expect(result.current.casts).toHaveLength(2)

    act(() => {
      result.current.removeCast(1)
    })

    expect(result.current.casts).toHaveLength(1)
    expect(result.current.isThread).toBe(false)
  })

  it('removeCast no elimina si solo hay un cast', () => {
    const { result } = renderHook(() => useCastThread())

    act(() => {
      result.current.removeCast(0)
    })

    expect(result.current.casts).toHaveLength(1)
  })

  it('reset vuelve al estado inicial', () => {
    const { result } = renderHook(() => useCastThread())

    act(() => {
      result.current.updateCast(0, {
        ...result.current.casts[0],
        content: 'Contenido',
      })
      result.current.addCast()
    })

    expect(result.current.casts).toHaveLength(2)

    act(() => {
      result.current.reset()
    })

    expect(result.current.casts).toHaveLength(1)
    expect(result.current.casts[0].content).toBe('')
  })

  it('setCasts reemplaza todos los casts', () => {
    const { result } = renderHook(() => useCastThread())

    act(() => {
      result.current.setCasts([
        { id: '1', content: 'Cast 1', media: [], links: [] },
        { id: '2', content: 'Cast 2', media: [], links: [] },
      ])
    })

    expect(result.current.casts).toHaveLength(2)
    expect(result.current.casts[0].content).toBe('Cast 1')
    expect(result.current.casts[1].content).toBe('Cast 2')
  })
})
