const mepperSinRelacion=`
import {Injectable} from '@nestjs/common';
import {$nameEntity} from "../../persistence/entity";
import {Create$nameDto, Read$nameDto, Update$nameDto} from "../../shared/dto";

@Injectable()
export class $nameMapper {

async dtoToEntity(create$nameDto: Create$nameDto): Promise<$nameEntity> {
return new $nameEntity($parametrosDtoToEntity);
}

async dtoToUpdateEntity(update$nameDto: Update$nameDto, update$nameEntity: $nameEntity): Promise<$nameEntity> {
$analisisDtoToUpdateEntity
return update$nameEntity;
}

async entityToDto($attrNameEntity: $nameEntity): Promise<Read$nameDto> {
const dtoToString: string = $attrNameEntity.toString();
return new Read$nameDto($parametrosEntityToDto);
}
}
`;
const mepperRelacion=`
import {Injectable} from '@nestjs/common';
import {$nameEntity} from "../../persistence/entity";
import {Create$nameDto, Read$nameDto, Update$nameDto} from "../../shared/dto";
import {$nameRepository,$repositorios} from "../../persistence/repository";
$import

@Injectable()
export class $nameMapper {
    constructor(
        protected $attrNameRepository: $nameRepository,
    $atributos
) {
}

async dtoToEntity(create$nameDto: Create$nameDto): Promise<$nameEntity> {
        $analisisDtoToEntity
return new $nameEntity($parametrosDtoToEntity);
}

async dtoToUpdateEntity(update$nameDto: Update$nameDto, update$nameEntity: $nameEntity): Promise<$nameEntity> {
$analisisDtoToUpdateEntity
return update$nameEntity;
}

async entityToDto($attrNameEntity: $nameEntity): Promise<Read$nameDto> {
    const $attrName: $nameEntity = await this.$attrNameRepository.findById($attrNameEntity.id);
 $analisisEntityToDto
const dtoToString: string = $attrNameEntity.toString();
return new Read$nameDto($parametrosEntityToDto);
}
}
`;
module.exports={mepperSinRelacion,mepperRelacion}