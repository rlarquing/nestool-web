module.exports=`
@ManyToOne(() => $entity, ($name) => $name.$nAtributos, {
    onDelete: 'CASCADE',
})
@JoinColumn({name: '$name_id'})
$atributo`;