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
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useRutaApi } from "@/hooks/useRutaApi";
import { useCrearService } from "@/hooks/useCrearService";
import { useEntidades } from "@/hooks/useEntidades";
import { formatearNombre, eliminarSufijo, aInicialMinuscula } from "@/utilities/entity-utils";

const serviceSchema = z.object({
  entityName: z.string().min(1, "El nombre de la entidad es requerido"),
  traza: z.boolean(),
});
type ServiceForm = z.infer<typeof serviceSchema>;

export default function CrearServicePage() {
  const form = useForm<ServiceForm>({
    resolver: zodResolver(serviceSchema),
    defaultValues: {
      entityName: "",
      traza: true,
    },
  });

  const { ruta } = useRutaApi();
  const { entidades } = useEntidades(ruta);
  const { crearService, loading: loadingCrear, error: errorCrear } = useCrearService();

  const entityName = form.watch("entityName");
  const traza = form.watch("traza");
  const nombreSinEntity = entityName.endsWith("Entity")
    ? entityName.replace(/Entity$/, "")
    : entityName;
  const serviceClassName = `${nombreSinEntity}Service`;
  const repositoryName = `${nombreSinEntity}Repository`;
  const mapperName = `${nombreSinEntity}Mapper`;
  const paramName = aInicialMinuscula(nombreSinEntity);

  const onSubmit = async (data: ServiceForm) => {
    const serviceData = {
      entityName: data.entityName,
      basePath: ruta,
      traza: data.traza,
    };

    const result = await crearService(serviceData);

    if (result.success) {
      toast.success(result.message);
      form.reset();
    } else {
      toast.error(result.error || "Error al crear el service");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-full mx-auto">
        <div className="space-y-4">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Crear Service</CardTitle>
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
                          Selecciona una entidad existente para generar su service.
                          El service extenderá de GenericService.
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
                            Habilita el registro de auditoría para este servicio
                          </div>
                        </div>
                      </FormItem>
                    )}
                  />

                  <div className="flex justify-end">
                    <Button type="submit" disabled={loadingCrear}>
                      {loadingCrear ? "Creando..." : "Crear Service"}
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
                Service a crear
                {entityName && (
                  <Badge variant="secondary" className="text-xs">
                    {serviceClassName}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 pb-3">
              {!entityName ? (
                <div className="text-center text-muted-foreground py-4">
                  <p className="text-xs">
                    Ingresa el nombre de la entidad para ver el service que se creará
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
                        <span className="font-medium">Trazas:</span>{" "}
                        {traza ? "Activadas" : "Desactivadas"}
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-1 text-xs">
                      Estructura del Service
                    </h4>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="font-medium text-xs">
                          Clase
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {serviceClassName}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="font-medium text-xs">
                          Extiende
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          GenericService&lt;{entityName}&gt;
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="font-medium text-xs">
                          Repository
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {repositoryName}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="font-medium text-xs">
                          Mapper
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {mapperName}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-1 text-xs">
                      Dependencias inyectadas
                    </h4>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 p-1.5 bg-muted rounded text-[10px]">
                        <Badge variant="outline" className="text-[10px]">ConfigService</Badge>
                        <span>configService</span>
                      </div>
                      <div className="flex items-center gap-2 p-1.5 bg-muted rounded text-[10px]">
                        <Badge variant="outline" className="text-[10px]">{repositoryName}</Badge>
                        <span>{paramName}Repository</span>
                      </div>
                      <div className="flex items-center gap-2 p-1.5 bg-muted rounded text-[10px]">
                        <Badge variant="outline" className="text-[10px]">{mapperName}</Badge>
                        <span>{paramName}Mapper</span>
                      </div>
                      <div className="flex items-center gap-2 p-1.5 bg-muted rounded text-[10px]">
                        <Badge variant="outline" className="text-[10px]">TrazaService</Badge>
                        <span>trazaService</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-muted-foreground pt-1 border-t">
                    <p>
                      • Service: {" "}
                      <code className="bg-muted px-1 py-0.5 rounded">
                        src/core/service/{formatearNombre(nombreSinEntity, "-")}.service.ts
                      </code>
                    </p>
                    <p>• Se actualizará: core.service.ts e index.ts</p>
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
