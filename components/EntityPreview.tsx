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
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        Vista previa de la entidad
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center text-muted-foreground py-8">
                        <p>Completa el formulario para ver la vista previa de la entidad</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    if (atributos.length === 0) {
        return (
            <Card className="w-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        Vista previa de la entidad
                        <Badge variant="secondary">{entityName}</Badge>
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="space-y-4">
                        <div>
                            <h4 className="font-medium mb-2">Información general</h4>
                            <div className="grid grid-cols-2 gap-2 text-sm">
                                <div><span className="font-medium">Nombre:</span> {entityName}</div>
                                <div><span className="font-medium">Esquema:</span> {esquema || 'public'}</div>
                                <div><span className="font-medium">Atributos:</span> 0</div>
                                <div><span className="font-medium">Herencia:</span> GenericEntity</div>
                            </div>
                        </div>
                        <div className="text-center text-muted-foreground py-4">
                            <p>Agrega atributos para ver la vista previa completa</p>
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
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    Vista previa de la entidad
                    <Badge variant="secondary">{entityName}</Badge>
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="space-y-4">
                    <div>
                        <h4 className="font-medium mb-2">Información general</h4>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                            <div><span className="font-medium">Nombre:</span> {entityName}</div>
                            <div><span className="font-medium">Esquema:</span> {esquema || 'public'}</div>
                            <div><span className="font-medium">Atributos:</span> {atributos.length}</div>
                            <div><span className="font-medium">Herencia:</span> GenericEntity</div>
                        </div>
                    </div>
                    
                    <div>
                        <h4 className="font-medium mb-2">Atributos</h4>
                        <div className="space-y-2">
                            {atributos.map((atributo, index) => (
                                <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                                    <div className="flex items-center gap-2">
                                        <span className="font-medium">{atributo.nombreAtributo}</span>
                                        <span className="text-muted-foreground">:</span>
                                        <Badge variant="outline">{getTipoDisplay(atributo)}</Badge>
                                    </div>
                                    <div className="flex gap-1">
                                        {getDecoradores(atributo).map((decorador, i) => (
                                            <Badge key={i} variant="secondary" className="text-xs">
                                                @{decorador}
                                            </Badge>
                                        ))}
                                        {atributo.nulo && <Badge variant="destructive" className="text-xs">nullable</Badge>}
                                        {atributo.unico && <Badge variant="destructive" className="text-xs">unique</Badge>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    <div className="text-xs text-muted-foreground">
                        <p>• La entidad se creará o modificará en: <code>src/persistence/entity/{formatEntityName(entityName)}.entity.ts</code></p>
                        <p>• Se actualizará automáticamente el módulo persistence.module.ts</p>
                        <p>• Se agregará la exportación en el index.ts del directorio entity</p>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
} 