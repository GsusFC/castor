'use client'

import { createContext, useContext, useState, ReactNode, useCallback } from 'react'

interface SearchContextType {
    isOpen: boolean
    open: () => void
    close: () => void
    toggle: () => void
}

const SearchContext = createContext<SearchContextType | undefined>(undefined)

export function SearchProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false)

    const open = useCallback(() => setIsOpen(true), [])
    const close = useCallback(() => setIsOpen(false), [])
    const toggle = useCallback(() => setIsOpen((prev) => !prev), [])

    return (
        <SearchContext.Provider value={{ isOpen, open, close, toggle }}>
            {children}
        </SearchContext.Provider>
    )
}

export function useSearch() {
    const context = useContext(SearchContext)
    if (context === undefined) {
        throw new Error('useSearch must be used within a SearchProvider')
    }
    return context
}
