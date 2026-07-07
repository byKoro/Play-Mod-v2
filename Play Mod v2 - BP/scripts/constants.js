// Identificador do item usado para acessar os recursos do Play Mod
// (abre o menu principal / controle de reprodução ao usar).
//
// TODO(Yuri): trocar pelo typeId definitivo assim que o item ativador
// for criado. É o único lugar que precisa mudar — o resto do addon
// (trava de drop, devolução em morte, filtro do itemUse) já usa essa
// constante e não precisa de nenhum outro ajuste.
export const ACTIVATOR_ITEM_ID = "minecraft:compass";
