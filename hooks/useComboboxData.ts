import { useState, useEffect, useCallback } from 'react'
import { ComboboxOption } from '@/components/ui/combobox'

export interface UseComboboxDataOptions {
  endpoint?: string
  transformData?: (data: any[]) => ComboboxOption[]
  staticOptions?: ComboboxOption[]
  searchParam?: string
  debounceMs?: number
  enabled?: boolean
  onError?: (error: Error) => void
}

export interface UseComboboxDataReturn {
  options: ComboboxOption[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  search: (query: string) => void
}

export function useComboboxData({
  endpoint,
  transformData,
  staticOptions = [],
  searchParam = 'search',
  debounceMs = 300,
  enabled = true,
  onError,
}: UseComboboxDataOptions = {}): UseComboboxDataReturn {
  const [options, setOptions] = useState<ComboboxOption[]>(staticOptions)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Función para transformar datos por defecto
  const defaultTransformData = useCallback((data: any[]): ComboboxOption[] => {
    return data.map((item) => ({
      value: item.id?.toString() || item.value?.toString() || item.key?.toString(),
      label: item.name || item.label || item.title || item.text || item.value,
      ...item,
    }))
  }, [])

  // Función para cargar datos del servidor
  const fetchData = useCallback(async (query?: string) => {
    if (!endpoint || !enabled) return

    setLoading(true)
    setError(null)

    try {
      const url = new URL(endpoint, window.location.origin)
      if (query) {
        url.searchParams.set(searchParam, query)
      }

      const response = await fetch(url.toString())
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      const transformedData = (transformData || defaultTransformData)(data)
      
      // Combinar con opciones estáticas si existen
      const allOptions = [...staticOptions, ...transformedData]
      setOptions(allOptions)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('Error desconocido')
      setError(error)
      onError?.(error)
    } finally {
      setLoading(false)
    }
  }, [endpoint, enabled, searchParam, transformData, defaultTransformData, staticOptions, onError])

  // Debounce para la búsqueda
  useEffect(() => {
    if (!endpoint) return

    const timeoutId = setTimeout(() => {
      fetchData(searchQuery)
    }, debounceMs)

    return () => clearTimeout(timeoutId)
  }, [searchQuery, fetchData, debounceMs, endpoint])

  // Cargar datos iniciales
  useEffect(() => {
    if (enabled && endpoint) {
      fetchData()
    } else if (staticOptions.length > 0) {
      setOptions(staticOptions)
    }
  }, [enabled, endpoint, staticOptions, fetchData])

  // Función para buscar
  const search = useCallback((query: string) => {
    setSearchQuery(query)
  }, [])

  // Función para recargar datos
  const refetch = useCallback(async () => {
    await fetchData(searchQuery)
  }, [fetchData, searchQuery])

  return {
    options,
    loading,
    error,
    refetch,
    search,
  }
}

// Hook para opciones estáticas
export function useStaticComboboxData(
  options: ComboboxOption[]
): UseComboboxDataReturn {
  return {
    options,
    loading: false,
    error: null,
    refetch: async () => {},
    search: () => {},
  }
}

// Hook para combinar datos estáticos y dinámicos
export function useHybridComboboxData(
  staticOptions: ComboboxOption[],
  dynamicOptions: UseComboboxDataReturn
): UseComboboxDataReturn {
  const allOptions = [...staticOptions, ...dynamicOptions.options]

  return {
    options: allOptions,
    loading: dynamicOptions.loading,
    error: dynamicOptions.error,
    refetch: dynamicOptions.refetch,
    search: dynamicOptions.search,
  }
} 