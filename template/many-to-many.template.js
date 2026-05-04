const destino=` @ManyToMany(() => $entity, ($entidad) => $entidad.$nAtributo)
  @JoinColumn()
  $atributo`;
const origen=`
@ManyToMany(() => $entity, ($entidad) => $entidad.$nAtributos,{eager: false})
@JoinTable({name: '$name_$entidad',
    joinColumn: {
        name: "$name_id",
        referencedColumnName: "id"
    },
    inverseJoinColumn: {
        name: "$entidad_id",
        referencedColumnName: "id"
    }})
    $atributo`;
module.exports={origen,destino}