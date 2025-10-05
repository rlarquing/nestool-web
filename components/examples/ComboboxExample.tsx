"use client"

import React, { useState } from 'react'
import { Combobox, ComboboxOption } from '@/components/ui/combobox'
import { useComboboxData, useStaticComboboxData } from '@/hooks/useComboboxData'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

// Datos estáticos de ejemplo
const staticCountries: ComboboxOption[] = [
  { value: 'us', label: 'Estados Unidos', code: 'US' },
  { value: 'ca', label: 'Canadá', code: 'CA' },
  { value: 'mx', label: 'México', code: 'MX' },
  { value: 'br', label: 'Brasil', code: 'BR' },
  { value: 'ar', label: 'Argentina', code: 'AR' },
  { value: 'cl', label: 'Chile', code: 'CL' },
  { value: 'co', label: 'Colombia', code: 'CO' },
  { value: 'pe', label: 'Perú', code: 'PE' },
]

const staticCategories: ComboboxOption[] = [
  { value: 'electronics', label: 'Electrónicos', category: 'tech' },
  { value: 'clothing', label: 'Ropa', category: 'fashion' },
  { value: 'books', label: 'Libros', category: 'education' },
  { value: 'sports', label: 'Deportes', category: 'lifestyle' },
  { value: 'home', label: 'Hogar', category: 'lifestyle' },
  { value: 'automotive', label: 'Automotriz', category: 'transport' },
]

export function ComboboxExample() {
  const [selectedCountry, setSelectedCountry] = useState<string>('')
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [selectedUser, setSelectedUser] = useState<string>('')

  // Hook para datos estáticos
  const countriesData = useStaticComboboxData(staticCountries)
  
  // Hook para datos del servidor (simulado)
  const usersData = useComboboxData({
    endpoint: '/api/users', // Endpoint simulado
    transformData: (data) => data.map((user: any) => ({
      value: user.id.toString(),
      label: `${user.name} (${user.email})`,
      email: user.email,
      role: user.role,
    })),
    onError: (error) => console.error('Error cargando usuarios:', error),
  })

  // Hook para categorías con agrupación
  const categoriesData = useStaticComboboxData(staticCategories)

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Ejemplos de Combobox</h1>
        <p className="text-muted-foreground">
          Componente Combobox generalizado con soporte para valores estáticos y dinámicos
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Combobox básico con datos estáticos */}
        <Card>
          <CardHeader>
            <CardTitle>Combobox Básico</CardTitle>
            <CardDescription>
              Selección simple con datos estáticos
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="country">País</Label>
              <Combobox
                options={countriesData.options}
                value={selectedCountry}
                onValueChange={setSelectedCountry}
                placeholder="Seleccionar país..."
                width="md"
              />
            </div>
            {selectedCountry && (
              <div className="text-sm text-muted-foreground">
                Seleccionado: {countriesData.options.find(opt => opt.value === selectedCountry)?.label}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Combobox con datos del servidor */}
        <Card>
          <CardHeader>
            <CardTitle>Combobox con Datos del Servidor</CardTitle>
            <CardDescription>
              Carga dinámica de datos con búsqueda
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="user">Usuario</Label>
              <Combobox
                options={usersData.options}
                value={selectedUser}
                onValueChange={setSelectedUser}
                placeholder="Buscar usuario..."
                searchPlaceholder="Buscar por nombre o email..."
                loading={usersData.loading}
                error={!!usersData.error}
                width="md"
                renderOption={(option) => (
                  <div className="flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    <span className="text-xs text-muted-foreground">{option.role}</span>
                  </div>
                )}
              />
            </div>
            {usersData.error && (
              <div className="text-sm text-destructive">
                Error: {usersData.error.message}
              </div>
            )}
            {selectedUser && (
              <div className="text-sm text-muted-foreground">
                Seleccionado: {usersData.options.find(opt => opt.value === selectedUser)?.label}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Combobox múltiple */}
        <Card>
          <CardHeader>
            <CardTitle>Combobox Múltiple</CardTitle>
            <CardDescription>
              Selección múltiple con categorías
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="categories">Categorías</Label>
              <Combobox
                options={categoriesData.options}
                selectedValues={selectedCategories}
                onMultipleValueChange={setSelectedCategories}
                placeholder="Seleccionar categorías..."
                multiple
                width="md"
                groupBy={(option) => option.category || 'other'}
                groupLabel={(group) => {
                  const labels: Record<string, string> = {
                    tech: 'Tecnología',
                    fashion: 'Moda',
                    education: 'Educación',
                    lifestyle: 'Estilo de Vida',
                    transport: 'Transporte',
                  }
                  return labels[group] || group
                }}
              />
            </div>
            {selectedCategories.length > 0 && (
              <div className="text-sm text-muted-foreground">
                Seleccionados: {selectedCategories.length} categorías
              </div>
            )}
          </CardContent>
        </Card>

        {/* Combobox con renderizado personalizado */}
        <Card>
          <CardHeader>
            <CardTitle>Combobox Personalizado</CardTitle>
            <CardDescription>
              Con renderizado personalizado de opciones
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom">País con Código</Label>
              <Combobox
                options={countriesData.options}
                value={selectedCountry}
                onValueChange={setSelectedCountry}
                placeholder="Seleccionar país..."
                width="md"
                renderOption={(option) => (
                  <div className="flex items-center justify-between w-full">
                    <span>{option.label}</span>
                    <span className="text-xs text-muted-foreground font-mono">
                      {option.code}
                    </span>
                  </div>
                )}
                renderSelected={(option) => (
                  <span className="flex items-center gap-2">
                    <span>{option.label}</span>
                    <span className="text-xs text-muted-foreground">({option.code})</span>
                  </span>
                )}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />

      {/* Información de estado */}
      <Card>
        <CardHeader>
          <CardTitle>Estado del Formulario</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-md text-sm overflow-auto">
            {JSON.stringify(
              {
                selectedCountry,
                selectedCategories,
                selectedUser,
                countriesCount: countriesData.options.length,
                usersCount: usersData.options.length,
                categoriesCount: categoriesData.options.length,
              },
              null,
              2
            )}
          </pre>
        </CardContent>
      </Card>
    </div>
  )
}

// Componente de ejemplo para formularios
export function ComboboxFormExample() {
  const [formData, setFormData] = useState({
    country: '',
    categories: [] as string[],
    user: '',
  })

  const countriesData = useStaticComboboxData(staticCountries)
  const categoriesData = useStaticComboboxData(staticCategories)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    console.log('Formulario enviado:', formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6">
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Formulario con Combobox</h2>
        <p className="text-muted-foreground">
          Ejemplo de integración en un formulario
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="country">País *</Label>
          <Combobox
            options={countriesData.options}
            value={formData.country}
            onValueChange={(value) => setFormData(prev => ({ ...prev, country: value }))}
            placeholder="Seleccionar país..."
            error={!formData.country}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="categories">Categorías</Label>
          <Combobox
            options={categoriesData.options}
            selectedValues={formData.categories}
            onMultipleValueChange={(values) => setFormData(prev => ({ ...prev, categories: values }))}
            placeholder="Seleccionar categorías..."
            multiple
          />
        </div>
      </div>

      <div className="flex gap-4">
        <button
          type="submit"
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Enviar Formulario
        </button>
        <button
          type="button"
          onClick={() => setFormData({ country: '', categories: [], user: '' })}
          className="px-4 py-2 bg-secondary text-secondary-foreground rounded-md hover:bg-secondary/90"
        >
          Limpiar
        </button>
      </div>
    </form>
  )
} 