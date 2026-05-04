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
import { useRutaApi } from "@/hooks/useRutaApi";
import { useCrearMapper } from "@/hooks/useCrearMapper";
import { useEntidades } from "@/hooks/useEntidades";
import { formatearNombre, eliminarSufijo, aInicialMinuscula } from "@/utilities/entity-utils";

const mapperSchema = z.object({
  entityName: z.string().min(1, "El nombre de la entidad es requerido"),
});
type MapperForm = z.infer<typeof mapperSchema>;

export default function CrearMapperPage() {
  const form = useForm<MapperForm>({
    resolver: zodResolver(mapperSchema),
    defaultValues: {
      entityName: "",
    },
  });

  const { ruta } = useRutaApi();
  const { entidades } = useEntidades(ruta);
  const { crearMapper, loading: loadingCrear, error: errorCrear } = useCrearMapper();

  const entityName = form.watch("entityName");
  const nombreSinEntity = entityName.endsWith("Entity")
    ? entityName.replace(/Entity$/, "")
    : entityName;
  const mapperClassName = `${nombreSinEntity}Mapper`;
  const createDtoName = `Create${nombreSinEntity}Dto`;
  const readDtoName = `Read${nombreSinEntity}Dto`;
  const updateDtoName = `Update${nombreSinEntity}Dto`;
  const paramName = aInicialMinuscula(nombreSinEntity);

  const onSubmit = async (data: MapperForm) => {
    const mapperData = {
      entityName: data.entityName,
      basePath: ruta,
    };

    const result = await crearMapper(mapperData);

    if (result.success) {
      toast.success(result.message);
      form.reset();
    } else {
      toast.error(result.error || "Error al crear el mapper");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-full mx-auto">
        <div className="space-y-4">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Crear Mapper</CardTitle>
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
                          Selecciona una entidad existente para generar su mapper.
                          El mapper convertirá entre entidades y DTOs.
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={loadingCrear}>
                      {loadingCrear ? "Creando..." : "Crear Mapper"}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="w-full">
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                Mapper a crear
                {entityName && (
                  <Badge variant="secondary" className="text-xs">
                    {mapperClassName}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 pb-3">
              {!entityName ? (
                <div className="text-center text-muted-foreground py-4">
                  <p className="text-xs">
                    Ingresa el nombre de la entidad para ver el mapper que se creará
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
                        <span className="font-medium">Injectable:</span>{" "}
                        Sí
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-1 text-xs">
                      Estructura del Mapper
                    </h4>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="font-medium text-xs">
                          Clase
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {mapperClassName}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="font-medium text-xs">
                          Decorador
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          @Injectable()
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-1 text-xs">
                      Métodos principales
                    </h4>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="font-medium text-xs">
                          dtoToEntity
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {createDtoName} → {entityName}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="font-medium text-xs">
                          dtoToUpdateEntity
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {updateDtoName} → {entityName}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="font-medium text-xs">
                          entityToDto
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {entityName} → {readDtoName}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-1 text-xs">
                      DTOs utilizados
                    </h4>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 p-1.5 bg-muted rounded text-[10px]">
                        <Badge variant="outline" className="text-[10px]">Create</Badge>
                        <span>{createDtoName}</span>
                      </div>
                      <div className="flex items-center gap-2 p-1.5 bg-muted rounded text-[10px]">
                        <Badge variant="outline" className="text-[10px]">Read</Badge>
                        <span>{readDtoName}</span>
                      </div>
                      <div className="flex items-center gap-2 p-1.5 bg-muted rounded text-[10px]">
                        <Badge variant="outline" className="text-[10px]">Update</Badge>
                        <span>{updateDtoName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-muted-foreground pt-1 border-t">
                    <p>
                      • Mapper: {" "}
                      <code className="bg-muted px-1 py-0.5 rounded">
                        src/core/mapper/{formatearNombre(nombreSinEntity, "-")}.mapper.ts
                      </code>
                    </p>
                    <p>• Se actualizará: index.ts del directorio mapper</p>
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
