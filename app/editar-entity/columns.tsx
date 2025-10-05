"use client"

import { ColumnDef } from "@tanstack/react-table";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {useState} from "react";

export type Columns = {
    id: string
    nombre: string
    longitud: number
    entero: boolean
    relacion: string
    tipoRelacion: string
    nulo: boolean
    unico: boolean
    acciones: string
};

// Recibe una función para eliminar atributo por id
export function getColumns(onDeleteAtributo: (id: string) => void): ColumnDef<Columns>[] {
  return [
    {
        accessorKey: "nombre",
        header: "Nombre",
    },
    {
        accessorKey: "longitud",
        header: "Longitud",
    },
    {
        accessorKey: "entero",
        header: "Entero",
        cell: ({ getValue }) => getValue() ? 'Sí' : 'No',
    },
      {
          accessorKey: "tipoRelacion",
          header: "Tipo Relación",
      },
    {
        accessorKey: "relacion",
        header: "Relación",
    },
    {
        accessorKey: "nulo",
        header: "Nulo",
        cell: ({ getValue }) => getValue() ? 'Sí' : 'No',
    },
    {
        accessorKey: "unico",
        header: "Único",
        cell: ({ getValue }) => getValue() ? 'Sí' : 'No',
    },
    {
        accessorKey: "acciones",
        header: "Acciones",
        cell: ({ row }) => {
          const [open, setOpen] = useState(false);
          return (
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive" size="sm">Eliminar</Button>
              </DialogTrigger>
              <DialogContent showCloseButton={false}>
                <DialogHeader>
                  <DialogTitle>¿Eliminar atributo?</DialogTitle>
                </DialogHeader>
                <p>¿Estás seguro que deseas eliminar este atributo? Esta acción no se puede deshacer.</p>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      onDeleteAtributo(row.original.id);
                      setOpen(false);
                      toast.success('Atributo eliminado');
                    }}
                  >
                    Eliminar
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          );
        },
    },
  ];
}