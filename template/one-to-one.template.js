module.exports=`
@OneToOne(() => $entity, { onDelete: 'CASCADE'})
@JoinColumn({ name: '$name_id' })
$atributo`;