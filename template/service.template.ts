module.exports=`import {Injectable} from '@nestjs/common';
import {$nameEntity} from '../../persistence/entity';
import {$nameRepository} from "../../persistence/repository";
import {$nameMapper} from "../mapper";
import {LogHistoryService} from "./log-history.service";
import {GenericService} from "./generic.service";
import { ConfigService } from '@nestjs/config';

@Injectable()
export class $nameService extends GenericService<$nameEntity> {
    constructor(
        protected configService: ConfigService,
        protected $paramRepository: $nameRepository,
        protected $paramMapper: $nameMapper,
        protected logHistoryService: LogHistoryService,
    ) {
        super(configService, $paramRepository, $paramMapper, logHistoryService, $traza);
    }
}`;