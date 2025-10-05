"use client";
import {useForm} from "react-hook-form";
import {z} from "zod";
import {zodResolver} from "@hookform/resolvers/zod";
import {Card, CardContent, CardHeader, CardTitle} from "@/components/ui/card";
import {Form, FormField, FormItem, FormLabel, FormControl, FormMessage} from "@/components/ui/form";
import {Input} from "@/components/ui/input";
import {Button} from "@/components/ui/button";
import {toast} from "sonner";
import {useState, useEffect} from "react";

import {getColumns} from "./columns";
import {Combobox} from "@/components/ui/combobox";
import {Checkbox} from "@/components/ui/checkbox";
import {DataTable} from "./data-table";
import {useRutaApi} from "@/hooks/useRutaApi";
import {useEsquemas} from "@/hooks/useEsquemas";
import { useEntidades } from '@/hooks/useEntidades';
import { useCrearEntidad } from '@/hooks/useCrearEntidad';
import { useDetectarDatabase } from '@/hooks/useDetectarDatabase';
import { EntityPreview } from '@/components/EntityPreview';

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

// Schemas y types
const nuevaEntitySchema = z.object({
    entityName: z.string().min(1, "El nombre de la entidad es requerido"),
    esquema: z.string().optional(),
});
type NuevaEntityForm = z.infer<typeof nuevaEntitySchema>;

const atributoSchema = z.object({
    nombreAtributo: z.string().min(1, "El nombre es requerido"),
    tipoDato: z.string().min(1, "El tipo de dato es requerido"),
    length: z.string().optional(),
    integer: z.boolean().optional(),
    rEntity: z.string().optional(),
    tipoRelacion: z.string().optional(),
    nulo: z.boolean().optional(),
    unico: z.boolean().optional(),
}).refine(
  (data) => {
    if (data.tipoDato === "relation") {
      return !!data.rEntity && !!data.tipoRelacion;
    }
    return true;
  },
  {
    message: "Debes seleccionar entidad relacionada y tipo de relación",
    path: ["tipoRelacion"],
  }
);
type AtributoForm = z.infer<typeof atributoSchema>;

export default function NuevaEntityPage() {

    const [entidadValidada, setEntidadValidada] = useState(false);

    const form = useForm<NuevaEntityForm>({
        resolver: zodResolver(nuevaEntitySchema),
        defaultValues: {
            entityName: "",
            esquema: "",
        },
    });

    // Estado para atributos
    const [atributos, setAtributos] = useState<AtributoForm[]>([]);
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

    const {ruta} = useRutaApi();
    const {esquemas, fetchEsquemas, loading: loadingEsquemas, error: errorEsquemas} = useEsquemas(ruta);
    const { entidades, fetchEntidades, loading: loadingEntidades, error: errorEntidades } = useEntidades(ruta);
    const { crearEntidad, loading: loadingCrear, error: errorCrear } = useCrearEntidad();
    const { databaseInfo, loading: loadingDatabase, error: errorDatabase } = useDetectarDatabase(ruta);

    useEffect(() => {
        if (ruta) {
            fetchEsquemas();
        }
    }, [ruta]);

    useEffect(() => {
        if (atributoForm.watch('tipoDato') === 'relation') {
          fetchEntidades();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
      }, [atributoForm.watch('tipoDato'), ruta]);

    // Si el usuario cambia el nombre de la entidad, desvalidar
    useEffect(() => {
        const subscription = form.watch((values, { name }) => {
            if (name === "entityName") {
                setEntidadValidada(false);
            }
        });
        return () => subscription.unsubscribe();
    }, [form]);

    const onSubmit = (data: NuevaEntityForm) => {
        toast.success(`Entidad: ${data.entityName}, Esquema: ${data.esquema || '(sin esquema)'}`);
        setEntidadValidada(true);
        // Aquí luego se hará la validación de existencia y el flujo de atributos
    };

    const onAddAtributo = (data: AtributoForm) => {
        // Validar que no exista el nombre
        if (atributos.some(a => a.nombreAtributo === data.nombreAtributo)) {
            toast.error("Ya existe un atributo con ese nombre");
            return;
        }
        setAtributos(prev => [...prev, data]);
        atributoForm.reset();
        toast.success("Atributo agregado");
    };

    const onDeleteAtributo = (nombre: string) => {
        setAtributos(prev => prev.filter(a => a.nombreAtributo !== nombre));
    };

    const onCrearEntidad = async () => {
        const entityData = {
            ...form.getValues(),
            atributos,
            basePath: ruta,
            databaseType: databaseInfo?.databaseType || 'postgresql', // Default a PostgreSQL
        };
        
        const result = await crearEntidad(entityData);
        
        if (result.success) {
            toast.success(result.message);
            // Limpiar formulario después de crear exitosamente
            form.reset();
            setAtributos([]);
            setEntidadValidada(false);
        } else {
            toast.error(result.error || 'Error al crear la entidad');
        }
    };

    // Opciones dinámicas para el combobox de esquemas
    const esquemaOptions = [
        {value: "", label: "(sin esquema)"},
        ...esquemas.map(e => ({value: e, label: e}))
    ];

    return (
        <div className="min-h-screen bg-background p-4">
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 max-w-full mx-auto">
                {/* Columna izquierda - Formulario */}
                <div className="space-y-4">
                    <Card className="w-full">
                        <CardHeader>
                            <CardTitle className="flex items-center justify-between">
                                Crear nueva entidad
                                {databaseInfo && (
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-muted-foreground">Base de datos:</span>
                                        <span className="text-xs font-medium bg-blue-100 text-blue-800 px-2 py-1 rounded">
                                            {databaseInfo.databaseType === 'postgresql' ? 'PostgreSQL' :
                                             databaseInfo.databaseType === 'mysql' ? 'MySQL' :
                                             databaseInfo.databaseType === 'sqlite' ? 'SQLite' :
                                             databaseInfo.databaseType === 'mssql' ? 'SQL Server' :
                                             databaseInfo.databaseType === 'oracle' ? 'Oracle' :
                                             databaseInfo.databaseType}
                                        </span>
                                    </div>
                                )}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <Form {...form}>
                                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <FormField
                                            control={form.control}
                                            name="entityName"
                                            render={({field}) => (
                                                <FormItem>
                                                    <FormLabel className="text-sm">Nombre de la entidad</FormLabel>
                                                    <FormControl>
                                                        <Input placeholder="Ej: Usuario" {...field} className="w-full h-9"/>
                                                    </FormControl>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        Escribe el nombre de la entidad principal. Usa PascalCase, por
                                                        ejemplo: <b>Usuario</b>, <b>Producto</b>, <b>Cliente</b>.
                                                    </div>
                                                    <FormMessage/>
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="esquema"
                                            render={({field}) => (
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
                                                            disabled={loadingEsquemas}
                                                        />
                                                    </FormControl>
                                                    <div className="text-xs text-muted-foreground mt-1">
                                                        {errorEsquemas ? (
                                                            <span
                                                                className="text-red-500">No se pudieron cargar los esquemas.</span>
                                                        ) : (
                                                            <>Si usas <b>PostgreSQL</b> puedes especificar un esquema (ej:
                                                                public). En <b>MySQL</b> normalmente se deja vacío.</>
                                                        )}
                                                    </div>
                                                    <FormMessage/>
                                                </FormItem>
                                            )}
                                        />
                                    </div>
                                    <div className="flex justify-end">
                                        <Button type="submit" size="sm">Validar entidad</Button>
                                    </div>
                                </form>
                            </Form>

                            <div className="mt-8">
                                <h3 className="font-semibold mb-2">Atributos de la entidad</h3>
                                {/* Formulario para agregar atributos */}
                                <Form {...atributoForm}>
                                    <form onSubmit={atributoForm.handleSubmit(onAddAtributo)}
                                          className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 gap-y-2 items-end mb-4">
                                        {/* Fila 1 */}
                                        <FormField
                                            control={atributoForm.control}
                                            name="nombreAtributo"
                                            render={({field}) => (
                                                <FormItem>
                                                    <FormLabel className="text-xs">Nombre</FormLabel>
                                                    <FormControl>
                                                        <Input {...field} placeholder="nombre" className="w-full h-8 text-sm" disabled={!entidadValidada}/>
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
                                                          disabled={!entidadValidada}
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
                                                               disabled={atributoForm.watch("tipoDato") !== "string" || !entidadValidada}
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
                                                            disabled={atributoForm.watch("tipoDato") !== "number" || !entidadValidada}
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
                                                          disabled={atributoForm.watch("tipoDato") !== "relation" || !entidadValidada}
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
                                                <>
                                                  <FormItem>
                                                    <FormLabel className="text-xs">Entidad relacionada</FormLabel>
                                                    <FormControl>
                                                      {atributoForm.watch("tipoDato") === "relation" ? (
                                                        <Combobox
                                                          options={entidades.map(e => ({ value: e, label: e }))}
                                                          value={field.value}
                                                          onValueChange={field.onChange}
                                                          placeholder={loadingEntidades ? "Cargando..." : "Entidad"}
                                                          width="md"
                                                          className="w-full h-8 text-sm"
                                                          disabled={loadingEntidades || !entidadValidada}
                                                        />
                                                      ) : (
                                                          <Combobox
                                                              options={entidades.map(e => ({ value: e, label: e }))}
                                                              value={field.value}
                                                              onValueChange={field.onChange}
                                                              placeholder={loadingEntidades ? "Cargando..." : "Entidad"}
                                                              width="md"
                                                              className="w-full h-8 text-sm"
                                                              disabled={atributoForm.watch("tipoDato") !== "relation" || !entidadValidada}
                                                          />
                                                      )}
                                                    </FormControl>
                                                    {errorEntidades && <div className="text-xs text-red-500">{errorEntidades}</div>}
                                                    <FormMessage />
                                                  </FormItem>
                                                </>
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
                                                                    disabled={!entidadValidada}
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
                                                                    disabled={!entidadValidada}
                                                                />
                                                            </FormControl>
                                                            <FormLabel className="mb-0 text-xs">Único</FormLabel>
                                                            <FormMessage/>
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>
                                            <Button type="submit" size="sm" disabled={!entidadValidada}>Agregar</Button>
                                        </div>
                                    </form>
                                </Form>
                                {/* DataTable de atributos */}
                                <div className="overflow-x-auto">
                                    <DataTable
                                        columns={getColumns(onDeleteAtributo)}
                                        data={atributos.map(attr => ({
                                            id: attr.nombreAtributo,
                                            nombre: attr.nombreAtributo,
                                            longitud: attr.length ? Number(attr.length) : 0,
                                            entero: !!attr.integer,
                                            relacion: attr.rEntity || '-',
                                            tipoRelacion: attr.tipoRelacion || '-',
                                            nulo: !!attr.nulo,
                                            unico: !!attr.unico,
                                            acciones: '', // Aquí puedes poner botones o acciones si lo deseas
                                        }))}
                                    />
                                </div>
                                {/* Botón final para crear la entidad */}
                                <div className="flex justify-end mt-4">
                                    <Button
                                        onClick={onCrearEntidad}
                                        disabled={atributos.length === 0 || !form.getValues().entityName || loadingCrear}
                                    >
                                        {loadingCrear ? 'Creando...' : 'Crear entidad'}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Columna derecha - Vista previa */}
                <div className="space-y-4">
                    <EntityPreview
                        entityName={form.getValues().entityName}
                        esquema={form.getValues().esquema}
                        atributos={atributos}
                    />
                </div>
            </div>
        </div>
    );
}
