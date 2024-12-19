import { PurchasableTiles, PlayerID } from "./utils";

export interface PropertyTradeOffer {
    type: "property";
    property: PurchasableTiles;
    from: PlayerID;
    to: PlayerID;
}
export interface MoneyTradeOffer {
    type: "money";
    money: number;
    from: PlayerID;
    to: PlayerID;
}
export type TradeOffers = PropertyTradeOffer | MoneyTradeOffer;
export interface TradeState {
    initiator: PlayerID,
    current: PlayerID,
    participants: PlayerID[],
    offers: TradeOffers[],
    deltaMoney: Partial<Record<PlayerID, number>>,
    confirmations: Partial<Record<PlayerID, boolean>>,
    status: TradeStateStatus
}
export enum TradeStateStatus {
    ModifyTrade,
    Confirmation,
}