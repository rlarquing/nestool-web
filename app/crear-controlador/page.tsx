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
import { useCrearController } from "@/hooks/useCrearController";
import { useEntidades } from "@/hooks/useEntidades";
import { formatearNombre } from "@/utilities/entity-utils";

const controllerSchema = z.object({
  entityName: z.string().min(1, "El nombre de la entidad es requerido"),
});
type ControllerForm = z.infer<typeof controllerSchema>;

export default function CrearControllerPage() {
  const form = useForm<ControllerForm>({
    resolver: zodResolver(controllerSchema),
    defaultValues: {
      entityName: "",
    },
  });

  const { ruta } = useRutaApi();
  const { entidades } = useEntidades(ruta);
  const { crearController, loading: loadingCrear, error: errorCrear } = useCrearController();

  const entityName = form.watch("entityName");
  const nombreSinEntity = entityName.endsWith("Entity")
    ? entityName.replace(/Entity$/, "")
    : entityName;
  const controllerClassName = `${nombreSinEntity}Controller`;
  const serviceName = `${nombreSinEntity}Service`;
  const routePath = nombreSinEntity.toLowerCase();

  const onSubmit = async (data: ControllerForm) => {
    const controllerData = {
      entityName: data.entityName,
      basePath: ruta,
    };

    const result = await crearController(controllerData);

    if (result.success) {
      toast.success(result.message);
      form.reset();
    } else {
      toast.error(result.error || "Error al crear el controller");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-full mx-auto">
        <div className="space-y-4">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Crear Controller</CardTitle>
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
                          Selecciona una entidad existente para generar su controller.
                          El controller extenderá de GenericController.
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={loadingCrear}>
                      {loadingCrear ? "Creando..." : "Crear Controller"}
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
                Controller a crear
                {entityName && (
                  <Badge variant="secondary" className="text-xs">
                    {controllerClassName}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 pb-3">
              {!entityName ? (
                <div className="text-center text-muted-foreground py-4">
                  <p className="text-xs">
                    Ingresa el nombre de la entidad para ver el controller que se creará
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
                        <span className="font-medium">Ruta:</span>{" "}
                        <code className="bg-muted px-1 py-0.5 rounded">
                          /{routePath}
                        </code>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-1 text-xs">
                      Estructura del Controller
                    </h4>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="font-medium text-xs">
                          Clase
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {controllerClassName}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="font-medium text-xs">
                          Extiende
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          GenericController
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="font-medium text-xs">
                          Servicio
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {serviceName}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-1 text-xs">
                      Endpoints
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
                    <p>
                      • Controller: {" "}
                      <code className="bg-muted px-1 py-0.5 rounded">
                        src/api/controller/{formatearNombre(nombreSinEntity, "-")}.controller.ts
                      </code>
                    </p>
                    <p>• Se actualizará: api.module.ts e index.ts</p>
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
