import React, { createContext, useContext } from 'react'
import { defaultTheme, type ThemeTokens } from './tokens'

const ThemeContext = createContext<ThemeTokens>(defaultTheme)

export function ThemeProvider({ theme = defaultTheme, children }: { theme?: ThemeTokens; children?: React.ReactNode }) {
  return <ThemeContext.Provider value={theme}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  return useContext(ThemeContext)
}

