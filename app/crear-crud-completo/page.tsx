"use client";
import { useForm } from "react-hook-form";
import { useEffect } from "react";
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
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useRutaApi } from "@/hooks/useRutaApi";
import { useCrearCrudCompleto } from "@/hooks/useCrearCrudCompleto";
import { useEntidades } from "@/hooks/useEntidades";
import { formatearNombre, eliminarSufijo, aInicialMinuscula } from "@/utilities/entity-utils";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const crudSchema = z.object({
  entityName: z.string().min(1, "El nombre de la entidad es requerido"),
  traza: z.boolean(),
});
type CrudForm = z.infer<typeof crudSchema>;

export default function CrearCrudCompletoPage() {
  const form = useForm<CrudForm>({
    resolver: zodResolver(crudSchema),
    defaultValues: {
      entityName: "",
      traza: true,
    },
  });

  const { ruta } = useRutaApi();
  const { entidades, fetchEntidades, loading: loadingEntidades } = useEntidades(ruta);
  const { crearCrudCompleto, loading: loadingCrear, error: errorCrear, results } = useCrearCrudCompleto();

  // Cargar entidades sin CRUD y excluyendo nomencladores
  useEffect(() => {
    if (ruta) {
      fetchEntidades({ filtrarSinCrud: true, excluirNomencladores: true });
    }
  }, [ruta, fetchEntidades]);

  const entityName = form.watch("entityName");
  const traza = form.watch("traza");
  const nombreSinEntity = entityName ? eliminarSufijo(entityName, 'Entity') : "";
  const nombreLower = aInicialMinuscula(nombreSinEntity);
  const routePath = nombreSinEntity.toLowerCase();

  const componentes = [
    { nombre: "DTOs", archivo: `create-${formatearNombre(nombreSinEntity, "-")}.dto.ts`, descripcion: "Create, Read, Update DTOs" },
    { nombre: "Mapper", clase: `${nombreSinEntity}Mapper`, archivo: `${formatearNombre(nombreSinEntity, "-")}.mapper.ts` },
    { nombre: "Repository", clase: `${nombreSinEntity}Repository`, archivo: `${formatearNombre(nombreSinEntity, "-")}.repository.ts` },
    { nombre: "Service", clase: `${nombreSinEntity}Service`, archivo: `${formatearNombre(nombreSinEntity, "-")}.service.ts` },
    { nombre: "Controller", clase: `${nombreSinEntity}Controller`, archivo: `${formatearNombre(nombreSinEntity, "-")}.controller.ts` },
  ];

  const onSubmit = async (data: CrudForm) => {
    const crudData = {
      entityName: data.entityName,
      basePath: ruta,
      traza: data.traza,
    };

    const result = await crearCrudCompleto(crudData);

    if (result.success) {
      toast.success(result.message);
      form.reset();
    } else {
      toast.error(result.error || "Error al crear el CRUD completo");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-full mx-auto">
        <div className="space-y-4">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Crear CRUD Completo</CardTitle>
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
                          Seleccionar entidad
                        </FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          disabled={loadingEntidades || entidades.length === 0}
                        >
                          <FormControl>
                            <SelectTrigger className="w-full h-9">
                              <SelectValue placeholder={
                                loadingEntidades 
                                  ? "Cargando entidades..." 
                                  : entidades.length === 0 
                                    ? "No hay entidades disponibles" 
                                    : "Selecciona una entidad"
                              } />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {entidades.map((entidad) => (
                              <SelectItem key={entidad} value={entidad}>
                                {entidad}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div className="text-xs text-muted-foreground mt-1">
                          Solo se muestran entidades que no tienen CRUD creado y no son nomencladores.
                          {entidades.length === 0 && !loadingEntidades && (
                            <span className="block mt-1 text-amber-600">
                              No se encontraron entidades disponibles. Todas las entidades ya tienen CRUD creado o son nomencladores.
                            </span>
                          )}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="traza"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel className="text-sm">
                            Activar trazas
                          </FormLabel>
                          <div className="text-xs text-muted-foreground">
                            Habilita el registro de auditoría para el service
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" disabled={loadingCrear}>
                      {loadingCrear ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creando CRUD...
                        </>
                      ) : (
                        "Crear CRUD Completo"
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </Card>

          {results && (
            <Card className="w-full">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Resultados</CardTitle>
              </CardHeader>
              <CardContent className="pt-2 pb-3">
                <div className="space-y-2">
                  {results.dto && (
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-xs font-medium">DTOs</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{results.dto.message}</span>
                        {results.dto.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                  )}
                  {results.mapper && (
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-xs font-medium">Mapper</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{results.mapper.message}</span>
                        {results.mapper.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                  )}
                  {results.repository && (
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-xs font-medium">Repository</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{results.repository.message}</span>
                        {results.repository.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                  )}
                  {results.service && (
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-xs font-medium">Service</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{results.service.message}</span>
                        {results.service.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                  )}
                  {results.controller && (
                    <div className="flex items-center justify-between p-2 bg-muted rounded">
                      <span className="text-xs font-medium">Controller</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-muted-foreground">{results.controller.message}</span>
                        {results.controller.success ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="w-full">
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                Componentes a crear
                {entityName && (
                  <Badge variant="secondary" className="text-xs">
                    {nombreSinEntity}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 pb-3">
              {!entityName ? (
                <div className="text-center text-muted-foreground py-4">
                  <p className="text-xs">
                    Selecciona una entidad para ver los componentes que se crearán
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
                        <span className="font-medium">Nombre base:</span>{" "}
                        {nombreSinEntity}
                      </div>
                      <div>
                        <span className="font-medium">Ruta API:</span>{" "}
                        <code className="bg-muted px-1 py-0.5 rounded">
                          /{routePath}
                        </code>
                      </div>
                      <div>
                        <span className="font-medium">Trazas:</span>{" "}
                        {traza ? "Activadas" : "Desactivadas"}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-1 text-xs">
                      Componentes del CRUD
                    </h4>
                    <div className="space-y-1">
                      {componentes.map((comp, idx) => (
                        <div key={idx} className="flex items-center justify-between p-1.5 bg-muted rounded">
                          <div className="flex flex-col">
                            <span className="font-medium text-xs">{comp.nombre}</span>
                            <span className="text-[10px] text-muted-foreground">{comp.archivo}</span>
                          </div>
                          {comp.clase && (
                            <Badge variant="secondary" className="text-[10px]">
                              {comp.clase}
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-1 text-xs">
                      Endpoints disponibles
                    </h4>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 p-1.5 bg-muted rounded">
                        <Badge variant="default" className="text-[10px]">GET</Badge>
                        <code className="text-[10px]">/{routePath}/</code>
                      </div>
                      <div className="flex items-center gap-2 p-1.5 bg-muted rounded">
                        <Badge variant="default" className="text-[10px]">GET</Badge>
                        <code className="text-[10px]">/{routePath}/:id</code>
                      </div>
                      <div className="flex items-center gap-2 p-1.5 bg-muted rounded">
                        <Badge variant="default" className="text-[10px]">POST</Badge>
                        <code className="text-[10px]">/{routePath}/</code>
                      </div>
                      <div className="flex items-center gap-2 p-1.5 bg-muted rounded">
                        <Badge variant="default" className="text-[10px]">PATCH</Badge>
                        <code className="text-[10px]">/{routePath}/:id</code>
                      </div>
                      <div className="flex items-center gap-2 p-1.5 bg-muted rounded">
                        <Badge variant="default" className="text-[10px]">POST</Badge>
                        <code className="text-[10px]">/{routePath}/filtrar</code>
                      </div>
                      <div className="flex items-center gap-2 p-1.5 bg-muted rounded">
                        <Badge variant="default" className="text-[10px]">POST</Badge>
                        <code className="text-[10px]">/{routePath}/buscar</code>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-muted-foreground pt-1 border-t">
                    <p className="font-medium mb-1">Archivos que se crearán:</p>
                    <ul className="space-y-0.5">
                      <li>• src/shared/dto/create-{formatearNombre(nombreSinEntity, "-")}.dto.ts</li>
                      <li>• src/shared/dto/read-{formatearNombre(nombreSinEntity, "-")}.dto.ts</li>
                      <li>• src/shared/dto/update-{formatearNombre(nombreSinEntity, "-")}.dto.ts</li>
                      <li>• src/core/mapper/{formatearNombre(nombreSinEntity, "-")}.mapper.ts</li>
                      <li>• src/persistence/repository/{formatearNombre(nombreSinEntity, "-")}.repository.ts</li>
                      <li>• src/core/service/{formatearNombre(nombreSinEntity, "-")}.service.ts</li>
                      <li>• src/api/controller/{formatearNombre(nombreSinEntity, "-")}.controller.ts</li>
                    </ul>
                    <p className="mt-2">• Se actualizarán todos los archivos index.ts y módulos necesarios</p>
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
