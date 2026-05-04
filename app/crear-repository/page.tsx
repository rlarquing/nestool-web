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
import { useCrearRepository } from "@/hooks/useCrearRepository";
import { useEntidades } from "@/hooks/useEntidades";
import { formatearNombre, eliminarSufijo, aInicialMinuscula } from "@/utilities/entity-utils";

const repositorySchema = z.object({
  entityName: z.string().min(1, "El nombre de la entidad es requerido"),
});
type RepositoryForm = z.infer<typeof repositorySchema>;

export default function CrearRepositoryPage() {
  const form = useForm<RepositoryForm>({
    resolver: zodResolver(repositorySchema),
    defaultValues: {
      entityName: "",
    },
  });

  const { ruta } = useRutaApi();
  const { entidades } = useEntidades(ruta);
  const { crearRepository, loading: loadingCrear, error: errorCrear } = useCrearRepository();

  const entityName = form.watch("entityName");
  const nombreSinEntity = entityName.endsWith("Entity")
    ? entityName.replace(/Entity$/, "")
    : entityName;
  const repositoryClassName = `${nombreSinEntity}Repository`;
  const paramName = aInicialMinuscula(nombreSinEntity);

  const onSubmit = async (data: RepositoryForm) => {
    const repositoryData = {
      entityName: data.entityName,
      basePath: ruta,
    };

    const result = await crearRepository(repositoryData);

    if (result.success) {
      toast.success(result.message);
      form.reset();
    } else {
      toast.error(result.error || "Error al crear el repository");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-full mx-auto">
        <div className="space-y-4">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Crear Repository</CardTitle>
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
                          Selecciona una entidad existente para generar su repository.
                          El repository extenderá de GenericRepository.
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" disabled={loadingCrear}>
                      {loadingCrear ? "Creando..." : "Crear Repository"}
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
                Repository a crear
                {entityName && (
                  <Badge variant="secondary" className="text-xs">
                    {repositoryClassName}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 pb-3">
              {!entityName ? (
                <div className="text-center text-muted-foreground py-4">
                  <p className="text-xs">
                    Ingresa el nombre de la entidad para ver el repository que se creará
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
                      Estructura del Repository
                    </h4>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="font-medium text-xs">
                          Clase
                        </span>
                        <Badge variant="secondary" className="text-[10px]">
                          {repositoryClassName}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="font-medium text-xs">
                          Extiende
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          GenericRepository&lt;{entityName}&gt;
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="font-medium text-xs">
                          Implementa
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          IRepository&lt;{entityName}&gt;
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
                        <Badge variant="outline" className="text-[10px]">@InjectRepository</Badge>
                        <span>Repository&lt;{entityName}&gt;</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-1 text-xs">
                      Características
                    </h4>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="text-xs">Operaciones CRUD</span>
                        <Badge variant="default" className="text-[10px]">Incluidas</Badge>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="text-xs">Filtrado y búsqueda</span>
                        <Badge variant="default" className="text-[10px]">Incluidas</Badge>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <span className="text-xs">Manejo de relaciones</span>
                        <Badge variant="default" className="text-[10px]">Automático</Badge>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-muted-foreground pt-1 border-t">
                    <p>
                      • Repository: {" "}
                      <code className="bg-muted px-1 py-0.5 rounded">
                        src/persistence/repository/{formatearNombre(nombreSinEntity, "-")}.repository.ts
                      </code>
                    </p>
                    <p>• Se actualizará: persistence.module.ts e index.ts</p>
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
