export const origen=`
@OneToOne(() => $entity, { onDelete: 'CASCADE'})
@JoinColumn({ name: '$name_id' })
$atributo`;