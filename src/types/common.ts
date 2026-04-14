export type RDiceRule = "coc" | "dnd";

export interface RDiceRuleConfig {
    rule: RDiceRule;
    defaultDice: number;
    version: string;
}