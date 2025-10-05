import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Usuario, Persona, Producto } from './entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Usuario, Persona, Producto]),
  ],
  controllers: [],
  providers: [],
  exports: [],
})
export class PersistenceModule {} 