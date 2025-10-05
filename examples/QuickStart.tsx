"use client"

import React, { useState } from 'react'
import { Combobox, ComboboxOption } from '@/components/ui/combobox'

// Datos de ejemplo
const countries: ComboboxOption[] = [
  { value: 'us', label: 'Estados Unidos' },
  { value: 'ca', label: 'Canadá' },
  { value: 'mx', label: 'México' },
  { value: 'br', label: 'Brasil' },
  { value: 'ar', label: 'Argentina' },
]

const categories: ComboboxOption[] = [
  { value: 'tech', label: 'Tecnología' },
  { value: 'fashion', label: 'Moda' },
  { value: 'sports', label: 'Deportes' },
  { value: 'food', label: 'Comida' },
  { value: 'travel', label: 'Viajes' },
]

export function QuickStartExample() {
  const [selectedCountry, setSelectedCountry] = useState('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-2">Combobox - Inicio Rápido</h1>
        <p className="text-muted-foreground">
          Ejemplos básicos para empezar a usar el componente Combobox
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Combobox Simple */}
        <div className="space-y-2">
          <label className="text-sm font-medium">País</label>
          <Combobox
            options={countries}
            value={selectedCountry}
            onValueChange={setSelectedCountry}
            placeholder="Seleccionar país..."
            width="md"
          />
          {selectedCountry && (
            <p className="text-sm text-muted-foreground">
              Seleccionado: {countries.find(c => c.value === selectedCountry)?.label}
            </p>
          )}
        </div>

        {/* Combobox Múltiple */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Categorías</label>
          <Combobox
            options={categories}
            selectedValues={selectedCategories}
            onMultipleValueChange={setSelectedCategories}
            placeholder="Seleccionar categorías..."
            multiple
            width="md"
          />
          {selectedCategories.length > 0 && (
            <p className="text-sm text-muted-foreground">
              Seleccionadas: {selectedCategories.length} categorías
            </p>
          )}
        </div>
      </div>

      {/* Estado del formulario */}
      <div className="bg-muted p-4 rounded-md">
        <h3 className="font-medium mb-2">Estado del Formulario:</h3>
        <pre className="text-sm">
          {JSON.stringify(
            {
              country: selectedCountry,
              categories: selectedCategories,
            },
            null,
            2
          )}
        </pre>
      </div>
    </div>
  )
}

// Ejemplo con datos del servidor (simulado)
export function ServerDataExample() {
  const [selectedUser, setSelectedUser] = useState('')
  const [users, setUsers] = useState<ComboboxOption[]>([])
  const [loading, setLoading] = useState(false)

  // Simular carga de datos del servidor
  React.useEffect(() => {
    setLoading(true)
    // Simular llamada a API
    setTimeout(() => {
      const mockUsers: ComboboxOption[] = [
        { value: '1', label: 'Juan Pérez', email: 'juan@example.com' },
        { value: '2', label: 'María García', email: 'maria@example.com' },
        { value: '3', label: 'Carlos López', email: 'carlos@example.com' },
      ]
      setUsers(mockUsers)
      setLoading(false)
    }, 1000)
  }, [])

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-xl font-bold mb-2">Datos del Servidor</h2>
        <p className="text-muted-foreground">
          Ejemplo con carga de datos desde el servidor
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Usuario</label>
        <Combobox
          options={users}
          value={selectedUser}
          onValueChange={setSelectedUser}
          placeholder="Buscar usuario..."
          loading={loading}
          width="md"
          renderOption={(option) => (
            <div className="flex flex-col">
              <span className="font-medium">{option.label}</span>
              <span className="text-xs text-muted-foreground">{option.email}</span>
            </div>
          )}
        />
      </div>
    </div>
  )
} 