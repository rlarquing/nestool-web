"use client";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { useRutaApi } from "@/hooks/useRutaApi";
import { useCrearDto } from "@/hooks/useCrearDto";

const crudSchema = z.object({
  entityName: z.string().min(1, "El nombre de la entidad es requerido"),
  esNomenclador: z.boolean().default(false),
});
type CrudForm = z.infer<typeof crudSchema>;

export default function DtoCrudPage() {
  const form = useForm<CrudForm>({
    resolver: zodResolver(crudSchema),
    defaultValues: {
      entityName: "",
      esNomenclador: false,
    },
  });

  const { ruta } = useRutaApi();
  const { crearDto, loading: loadingCrear } = useCrearDto();

  const onSubmit = async (data: CrudForm) => {
    const dtoData = {
      dtoName: data.entityName,
      atributos: [],
      basePath: ruta,
      modo: "crud" as const,
      esNomenclador: data.esNomenclador,
    };

    const result = await crearDto(dtoData);

    if (result.success) {
      toast.success(result.message);
      form.reset();
    } else {
      toast.error(result.error || "Error al crear los DTOs");
    }
  };

  const entityName = form.watch("entityName");
  const esNomenclador = form.watch("esNomenclador");

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-full mx-auto">
        {/* Columna izquierda - Formulario */}
        <div className="space-y-4">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Crear DTOs para CRUD</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="entityName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">
                          Nombre de la entidad
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: UsuarioEntity"
                            {...field}
                            className="w-full h-9"
                          />
                        </FormControl>
                        <div className="text-xs text-muted-foreground mt-1">
                          Escribe el nombre de la entidad para generar los 4
                          DTOs del CRUD: Create, Update, UpdateMultiple y Read.
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="esNomenclador"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm">
                            ¿Es un nomenclador?
                          </FormLabel>
                          <p className="text-xs text-muted-foreground">
                            Si es un nomenclador, los DTOs extenderán de los
                            DTOs base de nomenclador.
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={loadingCrear}>
                      {loadingCrear ? "Creando..." : "Crear DTOs CRUD"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        {/* Columna derecha - Vista previa */}
        <div className="space-y-4">
          <Card className="w-full">
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                DTOs a crear
                {entityName && (
                  <Badge variant="secondary" className="text-xs">
                    {entityName}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 pb-3">
              {!entityName ? (
                <div className="text-center text-muted-foreground py-4">
                  <p className="text-xs">
                    Ingresa el nombre de la entidad para ver los DTOs que se crearán
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <h4 className="font-medium mb-1 text-xs">
                      Información general
                    </h4>
                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      <div>
                        <span className="font-medium">Entidad:</span>{" "}
                        {entityName}
                      </div>
                      <div>
                        <span className="font-medium">Nomenclador:</span>{" "}
                        {esNomenclador ? "Sí" : "No"}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-1 text-xs">
                      DTOs que se generarán
                    </h4>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="font-medium text-xs">
                          Create{entityName.replace(/Entity$/, "")}Dto
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          @ApiProperty
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="font-medium text-xs">
                          Update{entityName.replace(/Entity$/, "")}Dto
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          @ApiProperty
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="font-medium text-xs">
                          UpdateMultiple{entityName.replace(/Entity$/, "")}Dto
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          @ApiProperty + id
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="font-medium text-xs">
                          Read{entityName.replace(/Entity$/, "")}Dto
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          id + dtoToString
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-muted-foreground pt-1 border-t">
                    <p>
                      • Ubicación: <code className="bg-muted px-1 py-0.5 rounded">src/shared/dto/</code>
                    </p>
                    {esNomenclador && (
                      <p>• Extenderán de: CreateNomencladorDto, UpdateNomencladorDto, etc.</p>
                    )}
                    <p>• Se actualizará: index.ts del directorio dto</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
