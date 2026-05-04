import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {formatEntityName} from "@/utilities";

interface Atributo {
    nombreAtributo: string;
    tipoDato: string;
    length?: string;
    integer?: boolean;
    rEntity?: string;
    tipoRelacion?: string;
    nulo?: boolean;
    unico?: boolean;
}

interface EntityPreviewProps {
    entityName: string;
    esquema?: string;
    atributos: Atributo[];
}

export function EntityPreview({ entityName, esquema, atributos }: EntityPreviewProps) {
    if (!entityName) {
        return (
            <Card className="w-full">
                <CardHeader className="py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        Vista previa de la entidad
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-2 pb-3">
                    <div className="text-center text-muted-foreground py-4">
                        <p className="text-xs">Completa el formulario para ver la vista previa de la entidad</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (atributos.length === 0) {
        return (
            <Card className="w-full">
                <CardHeader className="py-3">
                    <CardTitle className="flex items-center gap-2 text-sm">
                        Vista previa de la entidad
                        <Badge variant="secondary" className="text-xs">{entityName}</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent className="pt-2 pb-3">
                    <div className="space-y-2">
                        <div>
                            <h4 className="font-medium mb-1 text-xs">Información general</h4>
                            <div className="grid grid-cols-2 gap-1 text-[10px]">
                                <div><span className="font-medium">Nombre:</span> {entityName}</div>
                                <div><span className="font-medium">Esquema:</span> {esquema || 'public'}</div>
                                <div><span className="font-medium">Atributos:</span> 0</div>
                                <div><span className="font-medium">Herencia:</span> GenericEntity</div>
                            </div>
                        </div>
                        <div className="text-center text-muted-foreground py-2">
                            <p className="text-xs">Agrega atributos para ver la vista previa completa</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const getTipoDisplay = (atributo: Atributo) => {
        if (atributo.tipoDato === 'relation') {
            return `${atributo.tipoRelacion}(${atributo.rEntity})`;
        }
        
        let tipo = atributo.tipoDato;
        if (atributo.tipoDato === 'string' && atributo.length) {
            tipo += `(${atributo.length})`;
        }
        if (atributo.tipoDato === 'number' && atributo.integer) {
            tipo = 'int';
        }
        
        return tipo;
    };

    const getDecoradores = (atributo: Atributo) => {
        const decoradores = [];
        
        if (atributo.tipoDato === 'relation') {
            decoradores.push(atributo.tipoRelacion);
            if (atributo.tipoRelacion === 'OneToOne' || atributo.tipoRelacion === 'ManyToOne') {
                decoradores.push('JoinColumn');
            }
            if (atributo.tipoRelacion === 'ManyToMany') {
                decoradores.push('JoinTable');
            }
        } else {
            decoradores.push('Column');
        }
        
        return decoradores;
    };

    return (
        <Card className="w-full">
            <CardHeader className="py-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                    Vista previa de la entidad
                    <Badge variant="secondary" className="text-xs">{entityName}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent className="pt-2 pb-3">
                <div className="space-y-2">
                    <div>
                        <h4 className="font-medium mb-1 text-xs">Información general</h4>
                        <div className="grid grid-cols-2 gap-1 text-[10px]">
                            <div><span className="font-medium">Nombre:</span> {entityName}</div>
                            <div><span className="font-medium">Esquema:</span> {esquema || 'public'}</div>
                            <div><span className="font-medium">Atributos:</span> {atributos.length}</div>
                            <div><span className="font-medium">Herencia:</span> GenericEntity</div>
                        </div>
                    </div>
                    
                    <div>
                        <h4 className="font-medium mb-1 text-xs">Atributos</h4>
                        <div className="space-y-1">
                            {atributos.map((atributo, index) => (
                                <div key={index} className="flex items-center justify-between p-1.5 bg-muted rounded">
                                    <div className="flex items-center gap-1">
                                        <span className="font-medium text-xs">{atributo.nombreAtributo}</span>
                                        <span className="text-muted-foreground">:</span>
                                        <Badge variant="outline" className="text-[10px]">{getTipoDisplay(atributo)}</Badge>
                                    </div>
                                    <div className="flex gap-1">
                                        {getDecoradores(atributo).map((decorador, i) => (
                                            <Badge key={i} variant="secondary" className="text-[10px]">
                                                @{decorador}
                                            </Badge>
                                        ))}
                                        {atributo.nulo && <Badge variant="destructive" className="text-[10px]">nullable</Badge>}
                                        {atributo.unico && <Badge variant="destructive" className="text-[10px]">unique</Badge>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="text-[10px] text-muted-foreground pt-1 border-t">
                        <p>• Entidad: <code>{formatEntityName(entityName)}.entity.ts</code></p>
                        <p>• Se actualizará: persistence.module.ts e index.ts</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
} 