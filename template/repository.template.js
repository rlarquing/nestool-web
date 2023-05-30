module.exports=`
import {Injectable} from "@nestjs/common";
import {GenericRepository} from "./generic.repository";
import {IRepository} from "../../shared/interface";
import {InjectRepository} from "@nestjs/typeorm";
import {Repository } from "typeorm";
import { $nameEntity } from "../entity";

@Injectable()
export class $nameRepository extends GenericRepository<$nameEntity> implements IRepository<$nameEntity>{
    constructor( @InjectRepository($nameEntity)
                 private $paramRepository: Repository<$nameEntity>){
        super($paramRepository,[$relations]);
    }

}`;