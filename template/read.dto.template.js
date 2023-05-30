module.exports=`import {ApiProperty, $swagger} from "@nestjs/swagger";
$import
$herencia
export class Read$nameDto $padre {
    @ApiProperty({ description: 'Nombre del objeto', example: 'Objeto 1' })
    dtoToString: string;
    @ApiProperty({description: 'id de la entidad.', example: 1})
    id: number;
    $atributos
    constructor(dtoToString: string, id: number, $parametros) {
    $super      
        $thisAtributos
    }
}`;