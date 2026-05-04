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
import { useCrearDto } from "@/hooks/useCrearDto";
import { useEntidades } from "@/hooks/useEntidades";

const tipoDatoOptions = [
  { value: "string", label: "string" },
  { value: "number", label: "number" },
  { value: "date", label: "date" },
  { value: "boolean", label: "boolean" },
  { value: "any", label: "any" },
  { value: "dto", label: "dto" },
  { value: "string[]", label: "string[]" },
  { value: "number[]", label: "number[]" },
  { value: "date[]", label: "date[]" },
  { value: "boolean[]", label: "boolean[]" },
  { value: "any[]", label: "any[]" },
  { value: "dto[]", label: "dto[]" },
];

const nuloOpcionalOptions = [
  { value: "noNulo", label: "Requerido (IsNotEmpty)" },
  { value: "esNulo", label: "Acepta null" },
  { value: "esOpcional", label: "Opcional (?)" },
];

const dtoSchema = z.object({
  dtoName: z.string().min(1, "El nombre del DTO es requerido"),
});
type DtoForm = z.infer<typeof dtoSchema>;

const atributoSchema = z.object({
  nombreAtributo: z.string().min(1, "El nombre es requerido"),
  tipoDato: z.string().min(1, "El tipo de dato es requerido"),
  dtoReferencia: z.string().optional(),
  nuloOpcional: z.enum(["esNulo", "noNulo", "esOpcional"]),
  descripcion: z.string().min(1, "La descripción es requerida"),
  ejemplo: z.string().min(1, "El ejemplo es requerido"),
});
type AtributoForm = z.infer<typeof atributoSchema>;

export default function NuevoDtoPage() {
  const [atributos, setAtributos] = useState<AtributoForm[]>([]);
  const [dtoValidado, setDtoValidado] = useState(false);

  const form = useForm<DtoForm>({
    resolver: zodResolver(dtoSchema),
    defaultValues: {
      dtoName: "",
    },
  });

  const atributoForm = useForm<AtributoForm>({
    resolver: zodResolver(atributoSchema),
    defaultValues: {
      nombreAtributo: "",
      tipoDato: "",
      dtoReferencia: "",
      nuloOpcional: "noNulo",
      descripcion: "",
      ejemplo: "",
    },
  });

  const { ruta } = useRutaApi();
  const { entidades } = useEntidades(ruta);
  const { crearDto, loading: loadingCrear } = useCrearDto();

  useEffect(() => {
    if (atributoForm.watch("tipoDato") === "dto" || atributoForm.watch("tipoDato") === "dto[]") {
      // Cargar entidades si es necesario
    }
  }, [atributoForm.watch("tipoDato")]);

  const onSubmitNombre = (data: DtoForm) => {
    toast.success(`DTO validado: ${data.dtoName}`);
    setDtoValidado(true);
  };

  const onAddAtributo = (data: AtributoForm) => {
    if (atributos.some((a) => a.nombreAtributo === data.nombreAtributo)) {
      toast.error("Ya existe un atributo con ese nombre");
      return;
    }
    setAtributos((prev) => [...prev, data]);
    atributoForm.reset();
    toast.success("Atributo agregado");
  };

  const onDeleteAtributo = (nombre: string) => {
    setAtributos((prev) => prev.filter((a) => a.nombreAtributo !== nombre));
  };

  const onCrearDto = async () => {
    if (atributos.length === 0) {
      toast.error("Debe agregar al menos un atributo");
      return;
    }

    const dtoData = {
      dtoName: form.getValues().dtoName,
      atributos,
      basePath: ruta,
      modo: "nuevo" as const,
    };

    const result = await crearDto(dtoData);

    if (result.success) {
      toast.success(result.message);
      form.reset();
      setAtributos([]);
      setDtoValidado(false);
    } else {
      toast.error(result.error || "Error al crear el DTO");
    }
  };

  const getTipoDisplay = (atributo: AtributoForm) => {
    if (atributo.tipoDato === "dto" || atributo.tipoDato === "dto[]") {
      return `${atributo.tipoDato}(${atributo.dtoReferencia || "?"})`;
    }
    return atributo.tipoDato;
  };

  const getValidadores = (atributo: AtributoForm) => {
    const validadores = [];
    
    switch (atributo.nuloOpcional) {
      case "noNulo":
        validadores.push("IsNotEmpty");
        break;
    }
    
    switch (atributo.tipoDato) {
      case "string":
        validadores.push("IsString");
        break;
      case "number":
        validadores.push("IsNumber");
        break;
      case "date":
        validadores.push("IsDate");
        break;
      case "boolean":
        validadores.push("IsBoolean");
        break;
      case "string[]":
      case "number[]":
      case "date[]":
      case "boolean[]":
      case "any[]":
      case "dto[]":
        validadores.push("IsArray");
        break;
    }
    
    return validadores;
  };

  return (
    <div className="min-h-screen bg-background p-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-full mx-auto">
        <div className="space-y-4">
          <Card className="w-full">
            <CardHeader>
              <CardTitle>Crear nuevo DTO</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(onSubmitNombre)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="dtoName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm">
                          Nombre del DTO
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Ej: UsuarioDto"
                            {...field}
                            className="w-full h-9"
                          />
                        </FormControl>
                        <div className="text-xs text-muted-foreground mt-1">
                          Escribe el nombre del DTO. Usa PascalCase y
                          termina con "Dto", por ejemplo:{" "}
                          <b>UsuarioDto</b>, <b>ProductoDto</b>.
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex justify-end">
                    <Button type="submit" size="sm">
                      Validar DTO
                    </Button>
                  </div>
                </form>
              </Form>

              {dtoValidado && (
                <div className="mt-8">
                  <h3 className="font-semibold mb-2">Atributos del DTO</h3>
                  <Form {...atributoForm}>
                    <form
                      onSubmit={atributoForm.handleSubmit(onAddAtributo)}
                      className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-end mb-4"
                    >
                      <FormField
                        control={atributoForm.control}
                        name="nombreAtributo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">Nombre</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="nombre"
                                className="w-full h-8 text-sm"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={atributoForm.control}
                        name="tipoDato"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">
                              Tipo de dato
                            </FormLabel>
                            <FormControl>
                              <Combobox
                                options={tipoDatoOptions}
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="Tipo"
                                width="sm"
                                className="w-full h-8 text-sm"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      {(atributoForm.watch("tipoDato") === "dto" ||
                        atributoForm.watch("tipoDato") === "dto[]") && (
                        <FormField
                          control={atributoForm.control}
                          name="dtoReferencia"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-xs">
                                DTO Referencia
                              </FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder="Ej: UsuarioDto"
                                  className="w-full h-8 text-sm"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      )}
                      <FormField
                        control={atributoForm.control}
                        name="nuloOpcional"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">
                              Validación
                            </FormLabel>
                            <FormControl>
                              <Combobox
                                options={nuloOpcionalOptions}
                                value={field.value}
                                onValueChange={field.onChange}
                                placeholder="Validación"
                                width="md"
                                className="w-full h-8 text-sm"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={atributoForm.control}
                        name="descripcion"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">
                              Descripción
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Descripción del campo"
                                className="w-full h-8 text-sm"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={atributoForm.control}
                        name="ejemplo"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-xs">
                              Ejemplo
                            </FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                placeholder="Valor de ejemplo"
                                className="w-full h-8 text-sm"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="sm:col-span-2 flex justify-end">
                        <Button type="submit" size="sm">
                          Agregar Atributo
                        </Button>
                      </div>
                    </form>
                  </Form>

                  {atributos.length > 0 && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium">
                        Atributos agregados:
                      </h4>
                      <div className="space-y-1">
                        {atributos.map((attr, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">
                                {attr.nombreAtributo}
                              </span>
                              <span className="text-muted-foreground">
                                :
                              </span>
                              <Badge variant="outline">
                                {getTipoDisplay(attr)}
                              </Badge>
                              <span className="text-xs text-muted-foreground">
                                ({attr.nuloOpcional})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex gap-1">
                                {getValidadores(attr).map((v, i) => (
                                  <Badge
                                    key={i}
                                    variant="secondary"
                                    className="text-xs"
                                  >
                                    @{v}
                                  </Badge>
                                ))}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  onDeleteAtributo(attr.nombreAtributo)
                                }
                              >
                                Eliminar
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-end pt-2">
                        <Button
                          onClick={onCrearDto}
                          disabled={loadingCrear}
                        >
                          {loadingCrear ? "Creando..." : "Crear DTO"}
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="w-full">
            <CardHeader className="py-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                Vista previa del DTO
                {dtoValidado && form.getValues().dtoName && (
                  <Badge variant="secondary" className="text-xs">
                    {form.getValues().dtoName}
                  </Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 pb-3">
              {!dtoValidado ? (
                <div className="text-center text-muted-foreground py-4">
                  <p className="text-xs">
                    Completa el formulario para ver la vista previa del DTO
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
                        <span className="font-medium">Nombre:</span>{" "}
                        {form.getValues().dtoName}
                      </div>
                      <div>
                        <span className="font-medium">Atributos:</span>{" "}
                        {atributos.length}
                      </div>
                    </div>
                  </div>

                  {atributos.length > 0 && (
                    <div>
                      <h4 className="font-medium mb-1 text-xs">Atributos</h4>
                      <div className="space-y-1">
                        {atributos.map((atributo, index) => (
                          <div
                            key={index}
                            className="flex items-center justify-between p-1.5 bg-muted rounded"
                          >
                            <div className="flex items-center gap-1">
                              <span className="font-medium text-xs">
                                {atributo.nombreAtributo}
                              </span>
                              <span className="text-muted-foreground">:</span>
                              <Badge variant="outline" className="text-[10px]">
                                {getTipoDisplay(atributo)}
                              </Badge>
                            </div>
                            <div className="flex gap-1">
                              {getValidadores(atributo).map((decorador, i) => (
                                <Badge
                                  key={i}
                                  variant="secondary"
                                  className="text-[10px]"
                                >
                                  @{decorador}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="text-[10px] text-muted-foreground pt-1 border-t">
                    <p>
                      • DTO: {" "}
                      <code className="bg-muted px-1 py-0.5 rounded">
                        src/shared/dto/
                        {form
                          .getValues()
                          .dtoName.toLowerCase()
                          .replace(/dto$/, "")}
                        .dto.ts
                      </code>
                    </p>
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
