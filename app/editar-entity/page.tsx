"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Combobox } from "@/components/ui/combobox";
import { getColumns } from "./columns";
import { DataTable } from "./data-table";
import { EntityPreview } from "@/components/EntityPreview";
import { useRutaApi } from "@/hooks/useRutaApi";
import { useEntidades } from "@/hooks/useEntidades";
import { useEsquemas } from "@/hooks/useEsquemas";
import { useEditarEntidad } from "@/hooks/useEditarEntidad";
import { useDetectarDatabase } from "@/hooks/useDetectarDatabase";
import { toast } from "sonner";
import { Plus } from "lucide-react";

// Opciones para tipos de datos y relaciones
const tipoDatoOptions = [
    {value: "string", label: "string"},
    {value: "number", label: "number"},
    {value: "Date", label: "Date"},
    {value: "Timestamp", label: "Timestamp"},
    {value: "boolean", label: "boolean"},
    {value: "Geometry", label: "Geometry"},
    {value: "relation", label: "relation"},
];

const relacionOptions = [
    {value: "OneToOne", label: "OneToOne"},
    {value: "OneToMany", label: "OneToMany"},
    {value: "ManyToOne", label: "ManyToOne"},
    {value: "ManyToMany", label: "ManyToMany"},
];

const editarEntidadSchema = z.object({
    entityName: z.string().min(1, "Debe seleccionar una entidad"),
    esquema: z.string().optional(),
});

const atributoSchema = z.object({
    nombreAtributo: z.string().min(1, "El nombre del atributo es requerido"),
    tipoDato: z.string().min(1, "Debe seleccionar un tipo de dato"),
    length: z.string().optional(),
    integer: z.boolean().optional(),
    rEntity: z.string().optional(),
    tipoRelacion: z.string().optional(),
    nulo: z.boolean().optional(),
    unico: z.boolean().optional(),
}).refine((data) => {
    if (data.tipoDato === "relation") {
        return data.rEntity && data.tipoRelacion;
    }
    return true;
}, {
    message: "Para relaciones debe especificar entidad y tipo de relación",
    path: ["tipoRelacion"],
});

type EditarEntidadForm = z.infer<typeof editarEntidadSchema>;
type AtributoForm = z.infer<typeof atributoSchema>;

export default function EditarEntidadPage() {
    const [entidadSeleccionada, setEntidadSeleccionada] = useState<string>("");
    const [atributos, setAtributos] = useState<AtributoForm[]>([]);

    const form = useForm<EditarEntidadForm>({
        resolver: zodResolver(editarEntidadSchema),
        defaultValues: {
            entityName: "",
            esquema: "",
        },
    });

    const esquemaActual = form.watch("esquema");

    const atributoForm = useForm<AtributoForm>({
        resolver: zodResolver(atributoSchema),
        defaultValues: {
            nombreAtributo: "",
            tipoDato: "",
            length: "",
            integer: false,
            rEntity: "",
            tipoRelacion: "",
            nulo: false,
            unico: false,
        },
    });

    const { ruta } = useRutaApi();
    const { esquemas, fetchEsquemas, loading: loadingEsquemas, error: errorEsquemas } = useEsquemas(ruta);
    const { entidades, fetchEntidades, loading: loadingEntidades, error: errorEntidades } = useEntidades(ruta);
    const { obtenerAtributosEntidad, actualizarEntidad, loading: loadingEditar } = useEditarEntidad();
    const { } = useDetectarDatabase(ruta);

    // Crear opciones para esquemas
    const esquemaOptions = [
        { value: "", label: "(sin esquema)" },
        ...esquemas.map(esquema => ({ value: esquema, label: esquema }))
    ];

    useEffect(() => {
        if (ruta) {
            fetchEsquemas();
            fetchEntidades();
        }
    }, [ruta]);

    useEffect(() => {
        if (atributoForm.watch('tipoDato') === 'relation') {
            fetchEntidades();
        }
    }, [atributoForm.watch('tipoDato'), ruta]);

    const onSeleccionarEntidad = async (entityName: string) => {
        if (!ruta || !entityName) return;

        setEntidadSeleccionada(entityName);
        form.setValue("entityName", entityName);

        // Obtener atributos de la entidad seleccionada
        const resultado = await obtenerAtributosEntidad(ruta, entityName);
        if (resultado) {
            setAtributos(resultado.atributos);

            // Mejorar el parsing del esquema - múltiples patrones
            let esquemaEncontrado = null;

            // Patrón 1: @Entity('tabla', { schema: SchemaEnum.esquema })
            const patron1 = resultado.content.match(/@Entity\([^)]*,\s*{\s*schema:\s*SchemaEnum\.(\w+)\s*}/);
            if (patron1) {
                esquemaEncontrado = patron1[1];
            }

            // Patrón 2: schema: SchemaEnum.esquema
            if (!esquemaEncontrado) {
                const patron2 = resultado.content.match(/schema:\s*SchemaEnum\.(\w+)/);
                if (patron2) {
                    esquemaEncontrado = patron2[1];
                }
            }

            // Patrón 3: @Entity('tabla', { schema: 'esquema' })
            if (!esquemaEncontrado) {
                const patron3 = resultado.content.match(/@Entity\([^)]*,\s*{\s*schema:\s*['"`](\w+)['"`]\s*}/);
                if (patron3) {
                    esquemaEncontrado = patron3[1];
                }
            }

            // Patrón 4: schema: 'esquema'
            if (!esquemaEncontrado) {
                const patron4 = resultado.content.match(/schema:\s*['"`](\w+)['"`]/);
                if (patron4) {
                    esquemaEncontrado = patron4[1];
                }
            }

            // Patrón 5: @Entity('tabla', { schema: esquema }) - sin comillas
            if (!esquemaEncontrado) {
                const patron5 = resultado.content.match(/@Entity\([^)]*,\s*{\s*schema:\s*(\w+)\s*}/);
                if (patron5) {
                    esquemaEncontrado = patron5[1];
                }
            }

            // Patrón 6: schema: esquema - sin comillas
            if (!esquemaEncontrado) {
                const patron6 = resultado.content.match(/schema:\s*(\w+)/);
                if (patron6) {
                    esquemaEncontrado = patron6[1];
                }
            }

            // Si encontramos un esquema, lo establecemos
            if (esquemaEncontrado) {
                form.setValue("esquema", esquemaEncontrado);
            } else {
                // Si no hay esquema, limpiar
                form.setValue("esquema", "");
            }
        }
    };

    const onAgregarAtributo = (data: AtributoForm) => {
        // Verificar que no exista un atributo con el mismo nombre
        if (atributos.some(attr => attr.nombreAtributo === data.nombreAtributo)) {
            toast.error("Ya existe un atributo con ese nombre");
            return;
        }

        setAtributos([...atributos, data]);
        atributoForm.reset();
        toast.success("Atributo agregado correctamente");
    };

    const onEliminarAtributo = (nombreAtributo: string) => {
        setAtributos(atributos.filter(attr => attr.nombreAtributo !== nombreAtributo));
        toast.success("Atributo eliminado correctamente");
    };

    const onActualizarEntidad = async () => {
        if (!ruta || !entidadSeleccionada || atributos.length === 0) {
            toast.error("Debe seleccionar una entidad y tener al menos un atributo");
            return;
        }

        const resultado = await actualizarEntidad({
            basePath: ruta,
            entityName: entidadSeleccionada,
            atributos,
            esquema: esquemaActual
        });

        if (resultado) {
            toast.success(resultado.message);
        }
    };

    return (
        <div className="min-h-screen bg-background p-4">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-full mx-auto">
                {/* Columna izquierda - Formulario */}
                <div className="space-y-4">
                    <Card className="w-full">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                Editar entidad existente
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(() => {})} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="entityName"
                                            render={() => (
                                                <FormItem>
                                                    <FormLabel className="text-sm">Entidad a editar</FormLabel>
                                                    <FormControl>
                                                        <Select
                                                            value={entidadSeleccionada}
                                                            onValueChange={onSeleccionarEntidad}
                                                            disabled={loadingEntidades}
                                                        >
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="Selecciona una entidad" />
                                                            </SelectTrigger>
                                                            <SelectContent>
                                                                {entidades.map((entidad) => (
                                                                    <SelectItem key={entidad} value={entidad}>
                                                                        {entidad}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                    </FormControl>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        Selecciona la entidad que deseas modificar para agregar o quitar atributos.
                                                    </div>
                                                    <FormMessage/>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="esquema"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel className="text-sm">Esquema <span
                                                        className="text-xs text-muted-foreground">(opcional)</span></FormLabel>
                                                    <FormControl>
                                                        <Combobox
                                                            options={esquemaOptions}
                                                            value={field.value}
                                                            onValueChange={field.onChange}
                                                            placeholder={loadingEsquemas ? "Cargando..." : "Esquema"}
                                                            width="md"
                                                            className="w-full h-9"
                                                            disabled={loadingEsquemas || !entidadSeleccionada}
                                                        />
                                                    </FormControl>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {errorEsquemas ? (
                                                            <span className="text-red-500">No se pudieron cargar los esquemas.</span>
                                                        ) : (
                                                            <>Si usas <b>PostgreSQL</b> puedes especificar un esquema (ej: public). En <b>MySQL</b> normalmente se deja vacío.</>
                                                        )}
                                                    </div>
                                                    <FormMessage/>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                </form>
                            </Form>

                            {entidadSeleccionada && (
                                <div className="mt-8">
                                    <h3 className="font-semibold mb-2">Atributos de la entidad</h3>
                                    {/* Formulario para agregar atributos */}
                                    <Form {...atributoForm}>
                                        <form onSubmit={atributoForm.handleSubmit(onAgregarAtributo)}
                                              className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 gap-y-2 items-end mb-4">
                                            {/* Fila 1 */}
                                            <FormField
                                                control={atributoForm.control}
                                                name="nombreAtributo"
                                                render={({field}) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Nombre</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} placeholder="nombre" className="w-full h-8 text-sm"/>
                                                        </FormControl>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={atributoForm.control}
                                                name="tipoDato"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Tipo de dato</FormLabel>
                                                        <FormControl>
                                                            <Combobox
                                                              options={tipoDatoOptions}
                                                              value={field.value}
                                                              onValueChange={field.onChange}
                                                              placeholder="Tipo"
                                                              width="xs"
                                                              className="w-full h-8 text-sm"
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={atributoForm.control}
                                                name="length"
                                                render={({field}) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Longitud</FormLabel>
                                                        <FormControl>
                                                            <Input {...field} placeholder="255" type="number"
                                                                   disabled={atributoForm.watch("tipoDato") !== "string"}
                                                                   className="w-full h-8 text-sm"/>
                                                        </FormControl>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={atributoForm.control}
                                                name="integer"
                                                render={({field}) => (
                                                    <FormItem className="flex flex-row items-center gap-2 h-8">
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={field.value}
                                                                onCheckedChange={field.onChange}
                                                                disabled={atributoForm.watch("tipoDato") !== "number"}
                                                            />
                                                        </FormControl>
                                                        <FormLabel className="mb-0 text-xs">¿Entero?</FormLabel>
                                                        <FormMessage/>
                                                    </FormItem>
                                                )}
                                            />
                                            {/* Fila 2 */}
                                            <FormField
                                                control={atributoForm.control}
                                                name="tipoRelacion"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Tipo relación</FormLabel>
                                                        <FormControl>
                                                            <Combobox
                                                              options={relacionOptions}
                                                              value={field.value}
                                                              onValueChange={field.onChange}
                                                              placeholder="Relación"
                                                              width="xs"
                                                              className="w-full h-8 text-sm"
                                                              disabled={atributoForm.watch("tipoDato") !== "relation"}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <FormField
                                                control={atributoForm.control}
                                                name="rEntity"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="text-xs">Entidad relacionada</FormLabel>
                                                        <FormControl>
                                                            <Combobox
                                                                options={entidades.map(e => ({ value: e, label: e }))}
                                                                value={field.value}
                                                                onValueChange={field.onChange}
                                                                placeholder={loadingEntidades ? "Cargando..." : "Entidad"}
                                                                width="md"
                                                                className="w-full h-8 text-sm"
                                                                disabled={loadingEntidades || atributoForm.watch("tipoDato") !== "relation"}
                                                            />
                                                        </FormControl>
                                                        {errorEntidades && <div className="text-xs text-red-500">{errorEntidades}</div>}
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                            <div className="sm:col-span-2 xl:col-span-4 flex items-center justify-between gap-4">
                                                <div className="flex items-center gap-4">
                                                    <FormField
                                                        control={atributoForm.control}
                                                        name="nulo"
                                                        render={({field}) => (
                                                            <FormItem className="flex flex-row items-center gap-2 h-8">
                                                                <FormControl>
                                                                    <Checkbox
                                                                        checked={field.value}
                                                                        onCheckedChange={field.onChange}
                                                                    />
                                                                </FormControl>
                                                                <FormLabel className="mb-0 text-xs">Nulo</FormLabel>
                                                                <FormMessage/>
                                                            </FormItem>
                                                        )}
                                                    />
                                                    <FormField
                                                        control={atributoForm.control}
                                                        name="unico"
                                                        render={({field}) => (
                                                            <FormItem className="flex flex-row items-center gap-2 h-8">
                                                                <FormControl>
                                                                    <Checkbox
                                                                        checked={field.value}
                                                                        onCheckedChange={field.onChange}
                                                                    />
                                                                </FormControl>
                                                                <FormLabel className="mb-0 text-xs">Único</FormLabel>
                                                                <FormMessage/>
                                                            </FormItem>
                                                        )}
                                                    />
                                                </div>
                                                <Button type="submit" size="sm">
                                                    <Plus className="h-4 w-4 mr-2" />
                                                    Agregar
                                                </Button>
                                            </div>
                                        </form>
                                    </Form>
                                    {/* DataTable de atributos */}
                                    <div className="overflow-x-auto">
                                        <DataTable
                                            columns={getColumns(onEliminarAtributo)}
                                            data={atributos.map(attr => ({
                                                id: attr.nombreAtributo,
                                                nombre: attr.nombreAtributo,
                                                longitud: attr.length ? Number(attr.length) : 0,
                                                entero: !!attr.integer,
                                                relacion: attr.rEntity || '-',
                                                tipoRelacion: attr.tipoRelacion || '-',
                                                nulo: !!attr.nulo,
                                                unico: !!attr.unico,
                                                acciones: '',
                                            }))}
                                        />
                                    </div>
                                    {/* Botón final para actualizar la entidad */}
                                    <div className="flex justify-end mt-4">
                                        <Button
                                            onClick={onActualizarEntidad}
                                            disabled={atributos.length === 0 || !entidadSeleccionada || loadingEditar}
                                        >
                                            {loadingEditar ? 'Actualizando...' : 'Actualizar Entidad'}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>

                {/* Columna derecha - Vista previa */}
                <div className="space-y-4">
                    <EntityPreview
                        entityName={entidadSeleccionada}
                        esquema={esquemaActual}
                        atributos={atributos}
                    />
                </div>
            </div>
        </div>
    );
}
