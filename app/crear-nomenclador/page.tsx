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
import { useState, useEffect } from "react";
import { Combobox } from "@/components/ui/combobox";
import { useRutaApi } from "@/hooks/useRutaApi";
import { useEsquemas } from "@/hooks/useEsquemas";
import { useCrearNomenclador } from "@/hooks/useCrearNomenclador";
import { useDetectarDatabase } from "@/hooks/useDetectarDatabase";
import { eliminarSufijo, formatearNombre } from "@/utilities/entity-utils";
import { formatEntityName } from "@/utilities";

const nomencladorSchema = z.object({
  entityName: z.string().min(1, "El nombre del nomenclador es requerido"),
  esquema: z.string().optional(),
});

type NomencladorForm = z.infer<typeof nomencladorSchema>;

export default function CrearNomencladorPage() {
  const [previewData, setPreviewData] = useState<{
    entityName: string;
    esquema?: string;
  } | null>(null);

  const form = useForm<NomencladorForm>({
    resolver: zodResolver(nomencladorSchema),
    defaultValues: {
      entityName: "",
      esquema: "",
    },
  });

  const { ruta } = useRutaApi();
  const {
    esquemas,
    fetchEsquemas,
    loading: loadingEsquemas,
    error: errorEsquemas,
  } = useEsquemas(ruta);
  const { crearNomenclador, loading: loadingCrear } = useCrearNomenclador();
  const { databaseInfo } = useDetectarDatabase(ruta);

  useEffect(() => {
    if (ruta) {
      fetchEsquemas();
    }
  }, [ruta]);

  const onSubmit = (data: NomencladorForm) => {
    setPreviewData(data);
    toast.success(`Nomenclador validado: ${data.entityName}`);
  };

  const onCrearNomenclador = async () => {
    if (!previewData) return;

    const nomencladorData = {
      ...previewData,
      basePath: ruta,
    };

    const result = await crearNomenclador(nomencladorData);

    if (result.success) {
      toast.success(result.message);
      form.reset();
      setPreviewData(null);
    } else {
      toast.error(result.error || "Error al crear el nomenclador");
    }
  };

  const esquemaOptions = [
    { value: "", label: "(sin esquema)" },
    ...esquemas.map((e) => ({ value: e, label: e })),
  ];

  const entityName = previewData?.entityName || "";
  const className = entityName.endsWith("Entity")
    ? entityName
    : entityName
    ? entityName + "Entity"
    : "";
  const nombreSinSufijo = entityName
    ? eliminarSufijo(entityName, "Entity")
    : "";
  const tablaNombre = nombreSinSufijo
    ? `nom_${formatearNombre(nombreSinSufijo, "_")}`
    : "";

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-full mx-auto">
        <div className="space-y-4">
          <Card className="w-full">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Crear nuevo nomenclador
                {databaseInfo && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      Base de datos:
                    </span>
                    <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded">
                      {databaseInfo.databaseType === "postgresql"
                        ? "PostgreSQL"
                        : databaseInfo.databaseType === "mysql"
                        ? "MySQL"
                        : databaseInfo.databaseType === "sqlite"
                        ? "SQLite"
                        : databaseInfo.databaseType === "mssql"
                        ? "SQL Server"
                        : databaseInfo.databaseType === "oracle"
                        ? "Oracle"
                        : databaseInfo.databaseType}
                    </span>
                  </div>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmit)}
                  className="space-y-4"
                >
                  <div className="space-y-4">
                    <FormField
                      control={form.control}
                      name="entityName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">
                            Nombre del nomenclador
                          </FormLabel>
                          <FormControl>
                            <Input
                              placeholder="Ej: TipoUsuario"
                              {...field}
                              className="w-full h-9"
                            />
                          </FormControl>
                          <div className="text-xs text-muted-foreground mt-1">
                            Escribe el nombre del nomenclador. Usa PascalCase,
                            por ejemplo: <b>TipoUsuario</b>, <b>EstadoPedido</b>
                            , <b>CategoriaProducto</b>. Se añadirá automáticamente
                            el sufijo "Entity".
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="esquema"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-sm">
                            Esquema{" "}
                            <span className="text-xs text-muted-foreground">
                              (opcional)
                            </span>
                          </FormLabel>
                          <FormControl>
                            <Combobox
                              options={esquemaOptions}
                              value={field.value}
                              onValueChange={field.onChange}
                              placeholder={
                                loadingEsquemas ? "Cargando..." : "Esquema"
                              }
                              width="md"
                              className="w-full h-9"
                              disabled={loadingEsquemas}
                            />
                          </FormControl>
                          <div className="text-xs text-muted-foreground mt-1">
                            {errorEsquemas ? (
                              <span className="text-red-500">
                                No se pudieron cargar los esquemas.
                              </span>
                            ) : (
                              <>
                                Si usas <b>PostgreSQL</b> puedes especificar un
                                esquema (ej: public). En <b>MySQL</b> normalmente
                                se deja vacío.
                              </>
                            )}
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        form.reset();
                        setPreviewData(null);
                      }}
                    >
                      Limpiar
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={!form.getValues().entityName}
                    >
                      Validar nomenclador
                    </Button>
                  </div>
                </form>
              </Form>

              {previewData && (
                <div className="mt-8">
                  <div className="flex justify-end">
                    <Button
                      onClick={onCrearNomenclador}
                      disabled={loadingCrear}
                      className="w-full sm:w-auto"
                    >
                      {loadingCrear ? "Creando..." : "Crear nomenclador"}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="w-full">
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                Vista previa del nomenclador
                {className && (
                  <Badge variant="secondary" className="text-xs">{className}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 pb-3">
              {!entityName ? (
                <div className="text-center text-muted-foreground py-4">
                  <p className="text-xs">
                    Completa el formulario para ver la vista previa del
                    nomenclador
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  <div>
                    <h4 className="font-medium mb-1 text-xs">Información general</h4>
                    <div className="grid grid-cols-2 gap-1 text-[10px]">
                      <div>
                        <span className="font-medium">Nombre clase:</span>{" "}
                        {className}
                      </div>
                      <div>
                        <span className="font-medium">Esquema:</span>{" "}
                        {previewData?.esquema || "public"}
                      </div>
                      <div>
                        <span className="font-medium">Tabla:</span>{" "}
                        <code className="text-[10px] bg-muted px-1 py-0.5 rounded">
                          {tablaNombre}
                        </code>
                      </div>
                      <div>
                        <span className="font-medium">Herencia:</span>{" "}
                        GenericNomencladorEntity
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="font-medium mb-1 text-xs">Atributos heredados</h4>
                    <div className="space-y-1">
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-xs">id</span>
                          <span className="text-muted-foreground">:</span>
                          <Badge variant="outline" className="text-[10px]">number</Badge>
                        </div>
                        <div className="flex gap-1">
                          <Badge variant="secondary" className="text-[10px]">
                            @PrimaryGeneratedColumn
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-xs">nombre</span>
                          <span className="text-muted-foreground">:</span>
                          <Badge variant="outline" className="text-[10px]">string</Badge>
                        </div>
                        <div className="flex gap-1">
                          <Badge variant="secondary" className="text-[10px]">
                            @Column
                          </Badge>
                          <Badge variant="destructive" className="text-[10px]">
                            unique
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-xs">descripcion</span>
                          <span className="text-muted-foreground">:</span>
                          <Badge variant="outline" className="text-[10px]">string</Badge>
                        </div>
                        <div className="flex gap-1">
                          <Badge variant="secondary" className="text-[10px]">
                            @Column
                          </Badge>
                        </div>
                      </div>
                      <div className="flex items-center justify-between p-1.5 bg-muted rounded">
                        <div className="flex items-center gap-1">
                          <span className="font-medium text-xs">activo</span>
                          <span className="text-muted-foreground">:</span>
                          <Badge variant="outline" className="text-[10px]">boolean</Badge>
                        </div>
                        <div className="flex gap-1">
                          <Badge variant="secondary" className="text-[10px]">
                            @Column
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-[10px] text-muted-foreground pt-1 border-t">
                    <p>
                      • Entidad: <code className="bg-muted px-1 py-0.5 rounded">src/persistence/entity/{formatEntityName(entityName)}.entity.ts</code>
                    </p>
                    <p>• Se actualizará: persistence.service.ts, generic-nomenclador.repository.ts, nomenclador-type.enum.ts</p>
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
