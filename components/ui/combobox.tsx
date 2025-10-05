"use client"

import * as React from "react"
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export interface ComboboxOption {
  value: string
  label: string
  disabled?: boolean
  [key: string]: any // Para propiedades adicionales
}

export interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  loading?: boolean
  error?: boolean
  className?: string
  triggerClassName?: string
  contentClassName?: string
  size?: "xs" | "sm" | "default" | "lg"
  width?: "auto" | "xs" | "sm" | "md" | "lg" | "xl"
  showSearch?: boolean
  multiple?: boolean
  selectedValues?: string[]
  onMultipleValueChange?: (values: string[]) => void
  renderOption?: (option: ComboboxOption) => React.ReactNode
  renderSelected?: (option: ComboboxOption) => React.ReactNode
  filterOptions?: (options: ComboboxOption[], search: string) => ComboboxOption[]
  groupBy?: (option: ComboboxOption) => string
  groupLabel?: (group: string) => string
}

const Combobox = React.forwardRef<HTMLButtonElement, ComboboxProps>(
  (
    {
      options,
      value,
      onValueChange,
      placeholder = "Seleccionar opción...",
      searchPlaceholder = "Buscar...",
      emptyMessage = "No se encontraron resultados.",
      disabled = false,
      loading = false,
      error = false,
      className,
      triggerClassName,
      contentClassName,
      size = "default",
      width = "auto",
      showSearch = true,
      multiple = false,
      selectedValues = [],
      onMultipleValueChange,
      renderOption,
      renderSelected,
      filterOptions,
      groupBy,
      groupLabel,
      ...props
    },
    ref
  ) => {
    const [open, setOpen] = React.useState(false)
    const [searchValue, setSearchValue] = React.useState("")

    // Filtrar opciones basado en la búsqueda
    const filteredOptions = React.useMemo(() => {
      if (!filterOptions) {
        return options.filter((option) =>
          option.label.toLowerCase().includes(searchValue.toLowerCase())
        )
      }
      return filterOptions(options, searchValue)
    }, [options, searchValue, filterOptions])

    // Agrupar opciones si se especifica groupBy
    const groupedOptions = React.useMemo(() => {
      if (!groupBy) return null

      const groups: Record<string, ComboboxOption[]> = {}
      filteredOptions.forEach((option) => {
        const group = groupBy(option)
        if (!groups[group]) {
          groups[group] = []
        }
        groups[group].push(option)
      })

      return Object.entries(groups).map(([group, options]) => ({
        group,
        options,
      }))
    }, [filteredOptions, groupBy])

    // Obtener la opción seleccionada
    const selectedOption = React.useMemo(() => {
      if (multiple) {
        return selectedValues
          .map((val) => options.find((opt) => opt.value === val))
          .filter(Boolean) as ComboboxOption[]
      }
      return options.find((option) => option.value === value)
    }, [options, value, selectedValues, multiple])

    // Manejar selección
    const handleSelect = React.useCallback(
      (selectedValue: string) => {
        if (multiple) {
          const newValues = selectedValues.includes(selectedValue)
            ? selectedValues.filter((v) => v !== selectedValue)
            : [...selectedValues, selectedValue]
          onMultipleValueChange?.(newValues)
        } else {
          onValueChange?.(selectedValue)
          setOpen(false)
          setSearchValue("")
        }
      },
      [multiple, selectedValues, onMultipleValueChange, onValueChange]
    )

    // Verificar si una opción está seleccionada
    const isSelected = React.useCallback(
      (optionValue: string) => {
        if (multiple) {
          return selectedValues.includes(optionValue)
        }
        return value === optionValue
      },
      [multiple, selectedValues, value]
    )

    // Renderizar el trigger
    const renderTrigger = () => {
      if (multiple && selectedOption.length > 0) {
        return (
          <div className="flex flex-wrap gap-1">
            {selectedOption.map((option) => (
              <span
                key={option.value}
                className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs"
              >
                {renderSelected ? renderSelected(option) : option.label}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleSelect(option.value)
                  }}
                  className="ml-1 rounded-full p-0.5 hover:bg-secondary-foreground/20"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )
      }

      if (selectedOption && !multiple) {
        return renderSelected ? renderSelected(selectedOption) : selectedOption.label
      }

      // Si hay un valor establecido pero no se encuentra en las opciones, mostrar el valor
      if (value && !multiple) {
        return value
      }

      return placeholder
    }

    // Clases de tamaño
    const sizeClasses = {
      sm: "h-8 px-2 text-xs",
      default: "h-9 px-3 text-sm",
      lg: "h-10 px-4 text-base",
    }

    // Clases de ancho
    const widthClasses = {
      auto: "w-auto",
      sm: "w-48",
      md: "w-64",
      lg: "w-80",
      xl: "w-96",
    }

    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            ref={ref}
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "justify-between",
              sizeClasses[size],
              widthClasses[width],
              error && "border-destructive",
              triggerClassName
            )}
            disabled={disabled || loading}
            {...props}
          >
            <span className="truncate">{renderTrigger()}</span>
            {loading ? (
              <div className="ml-2 h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            ) : (
              <ChevronDownIcon className="ml-2 h-4 w-4 shrink-0 opacity-50" />
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className={cn("p-0", contentClassName)}
          align="start"
          sideOffset={4}
        >
          <Command>
            {showSearch && (
              <CommandInput
                placeholder={searchPlaceholder}
                value={searchValue}
                onValueChange={setSearchValue}
              />
            )}
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              {groupedOptions ? (
                groupedOptions.map(({ group, options }) => (
                  <CommandGroup key={group} heading={groupLabel ? groupLabel(group) : group}>
                    {options.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        disabled={option.disabled}
                        onSelect={() => handleSelect(option.value)}
                        className="flex items-center gap-2"
                      >
                        <div className="flex items-center gap-2">
                          {multiple && (
                            <div
                              className={cn(
                                "flex h-4 w-4 items-center justify-center rounded border",
                                isSelected(option.value)
                                  ? "bg-primary border-primary"
                                  : "border-border"
                              )}
                            >
                              {isSelected(option.value) && (
                                <CheckIcon className="h-3 w-3 text-primary-foreground" />
                              )}
                            </div>
                          )}
                          {renderOption ? renderOption(option) : option.label}
                        </div>
                        {!multiple && isSelected(option.value) && (
                          <CheckIcon className="ml-auto h-4 w-4" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                ))
              ) : (
                <CommandGroup>
                  {filteredOptions.map((option) => (
                    <CommandItem
                      key={option.value}
                      value={option.value}
                      disabled={option.disabled}
                      onSelect={() => handleSelect(option.value)}
                      className="flex items-center gap-2"
                    >
                      <div className="flex items-center gap-2">
                        {multiple && (
                          <div
                            className={cn(
                              "flex h-4 w-4 items-center justify-center rounded border",
                              isSelected(option.value)
                                ? "bg-primary border-primary"
                                : "border-border"
                            )}
                          >
                            {isSelected(option.value) && (
                              <CheckIcon className="h-3 w-3 text-primary-foreground" />
                            )}
                          </div>
                        )}
                        {renderOption ? renderOption(option) : option.label}
                      </div>
                      {!multiple && isSelected(option.value) && (
                        <CheckIcon className="ml-auto h-4 w-4" />
                      )}
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    )
  }
)

Combobox.displayName = "Combobox"

export { Combobox } 